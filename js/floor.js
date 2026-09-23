// floor.js — THE ARCADE FLOOR: machines are physical. One player per machine,
// a line to wait in, a window to watch through, and chat around the cabinet.
//
// Each machine (game) has one "seat" doc:
//   { player, beat, queue: [names], chat: [{a,t,at}], snap, snapAt }
//
// The rules of the floor:
//   · sitting takes the seat — atomically, so two players can't share a stool
//   · the seated player heartbeats every few seconds; a silent seat goes
//     STALE after 25s (closed tab, crash) and anyone may take it
//   · if there's a line, the seat only accepts the FRONT of the line
//   · while someone plays, everyone else sees SNAPSHOTS of their screen
//     (a few frames per second-ish — a window, not a broadcast) and can chat
//
// Pure decision logic lives in exported functions so it's testable headless;
// Firestore transactions just apply it.

import { db } from "./firebase.js";
import { userDocId, auth } from "./auth.js";
import {
  doc, onSnapshot, runTransaction, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export {
  STALE_MS, BEAT_MS, QBEAT_MS, HOG_MS, NUDGE_COOLDOWN_MS, clampHogMins, seatTakenBy,
  sitBlocker, liveQueue, snapFromEngine, snapToObjects, seatAgeMs, waitedMs,
  eligibleKickers, canNudge, canVoteKick, kickThreshold, countKickVotes, voteCarries, pruneLine
} from "./floor-rules.js";
import {
  BEAT_MS, QBEAT_MS, HOG_MS, seatTakenBy, sitBlocker, liveQueue,
  seatAgeMs, waitedMs, eligibleKickers, canNudge, canVoteKick,
  kickThreshold, countKickVotes, voteCarries, pruneLine, releaseFrom
} from "./floor-rules.js";

const seatRef = (gameId) => doc(db, "seats", gameId);

// ------------------------------------------------------------- the client

export function createFloor(gameId, me, { hogMs = HOG_MS } = {}) {
  const ref = seatRef(gameId);
  // ONE ACCOUNT, ONE MACHINE: this doc records where the player currently is;
  // sitting or lining up somewhere new releases the old machine atomically.
  const presRef = me ? doc(db, "present", userDocId(me)) : null;

  // inside a transaction: read where I am now, and if it's another machine,
  // read that machine too so I can be released from it. ALL reads, no writes.
  const readElsewhere = async (tx) => {
    if (!presRef) return null;
    const p = await tx.get(presRef);
    const prevGame = p.exists() ? p.data().game : null;
    if (!prevGame || prevGame === gameId) return null;
    const otherRef = seatRef(prevGame);
    const os = await tx.get(otherRef);
    return os.exists() ? { otherRef, otherData: os.data() } : { otherRef: null, otherData: null };
  };
  let state = null;
  let ready = false;      // true once the first snapshot has arrived
  let listeners = [];
  let beatTimer = null;
  let lineTimer = null;   // while in line, this page proves you're still here
  let unsub = null;

  const emit = () => { for (const fn of listeners) { try { fn(state); } catch {} } };

  // being in line is AUTOMATIC presence: the spot lives only while a page on
  // this machine keeps beating for it — close the tab and it evaporates
  const lineBeatOnce = async () => {
    try {
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        const data = s.exists() ? s.data() : {};
        if (!(data.queue || []).includes(me)) return;
        const { queue, qbeat, qsince } = pruneLine({ ...data, qbeat: { ...(data.qbeat || {}), [me]: Date.now() } });
        tx.set(ref, { ...data, queue, qbeat, qsince }, { merge: false });
      });
    } catch {}
  };
  const startLineBeat = () => {
    if (lineTimer) return;
    lineBeatOnce();
    lineTimer = setInterval(lineBeatOnce, QBEAT_MS);
  };
  const stopLineBeat = () => { if (lineTimer) { clearInterval(lineTimer); lineTimer = null; } };

  unsub = onSnapshot(ref, (s) => {
    state = s.exists() ? s.data() : null;
    ready = true;
    // keep my spot alive while I'm on this page — and only then
    if (me && state && (state.queue || []).includes(me) && seatTakenBy(state) !== me) startLineBeat();
    else stopLineBeat();
    emit();
  }, () => {});   // a broken listener just means no live floor — playable anyway

  const floor = {
    hogMs,
    get state() { return state; },
    holder() { return seatTakenBy(state); },
    mine() { return seatTakenBy(state) === me; },
    line() { return liveQueue(state); },
    onChange(fn) { listeners.push(fn); if (ready) { try { fn(state); } catch {} } },

    // take the seat (atomically). Returns null on success, or the blocker.
    async sit() {
      if (!me) return { reason: "login" };
      try {
        return await runTransaction(db, async (tx) => {
          const elsewhere = await readElsewhere(tx);
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          const block = sitBlocker(data, me);
          if (block) return block;
          if (elsewhere && elsewhere.otherRef) tx.set(elsewhere.otherRef, releaseFrom(elsewhere.otherData, me));
          if (presRef) tx.set(presRef, { user: me, uid: auth.currentUser?.uid || null, game: gameId, kind: "seat", at: Date.now() });
          const pruned = pruneLine(data);
          delete pruned.qbeat[me];
          delete pruned.qsince[me];
          tx.set(ref, {
            ...data,
            player: me,
            beat: Date.now(),
            since: Date.now(),        // the hog clock starts fresh for me
            kickvotes: [],
            nudgeAt: 0,
            queue: pruned.queue.filter(u => u !== me),
            qbeat: pruned.qbeat,
            qsince: pruned.qsince,
            snap: null,
            snapAt: 0
          });
          return null;
        });
      } catch (err) { return { reason: "error", message: err.message }; }
    },

    // the heartbeat: proves the seat is alive + carries the watchers' window
    startBeating(getSnap) {
      floor.stopBeating();
      const beatOnce = async () => {
        try {
          await runTransaction(db, async (tx) => {
            const s = await tx.get(ref);
            const data = s.exists() ? s.data() : {};
            if (data.player !== me) return;          // lost the seat — stop claiming it
            const snap = getSnap ? getSnap() : null;
            tx.update(ref, { beat: Date.now(), ...(snap ? { snap, snapAt: snap.at } : {}) });
          });
        } catch {}
      };
      beatOnce();
      beatTimer = setInterval(beatOnce, BEAT_MS);
    },
    stopBeating() { if (beatTimer) { clearInterval(beatTimer); beatTimer = null; } },

    async leave() {
      floor.stopBeating();
      if (!me) return;
      try {
        await runTransaction(db, async (tx) => {
          const p = presRef ? await tx.get(presRef) : null;
          const s = await tx.get(ref);
          if (!s.exists() || s.data().player !== me) return;
          tx.update(ref, { player: null, snap: null, snapAt: 0, kickvotes: [] });
          if (presRef && p?.exists() && p.data().game === gameId) {
            tx.set(presRef, { user: me, uid: auth.currentUser?.uid || null, game: null, at: Date.now() });
          }
        });
      } catch {}
    },

    // best-effort on tab close (transactions can't run in pagehide) —
    // and even if this write is lost, the missing heartbeats clean up in ~25s
    leaveBeacon() {
      floor.stopBeating();
      stopLineBeat();
      if (!state || !me) return;
      const upd = {};
      if (state.player === me) Object.assign(upd, { player: null, snap: null, snapAt: 0, kickvotes: [] });
      if ((state.queue || []).includes(me)) {
        const pruned = pruneLine(state);
        delete pruned.qbeat[me];
        delete pruned.qsince[me];
        upd.queue = pruned.queue.filter(u => u !== me);
        upd.qbeat = pruned.qbeat;
        upd.qsince = pruned.qsince;
      }
      if (Object.keys(upd).length) {
        updateDoc(ref, upd).catch(() => {});
        if (presRef) setDoc(presRef, { user: me, uid: auth.currentUser?.uid || null, game: null, at: Date.now() }).catch(() => {});
      }
    },

    async joinLine() {
      if (!me) return;
      try {
        await runTransaction(db, async (tx) => {
          const elsewhere = await readElsewhere(tx);
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          if (elsewhere && elsewhere.otherRef) tx.set(elsewhere.otherRef, releaseFrom(elsewhere.otherData, me));
          if (presRef) tx.set(presRef, { user: me, uid: auth.currentUser?.uid || null, game: gameId, kind: "line", at: Date.now() });
          const pruned = pruneLine(data);
          const queue = pruned.queue.filter(u => u !== me).slice(0, 19);
          queue.push(me);
          const qbeat = { ...pruned.qbeat, [me]: Date.now() };
          const qsince = { ...pruned.qsince, [me]: pruned.qsince[me] || Date.now() };
          tx.set(ref, { ...data, queue, qbeat, qsince }, { merge: true });
        });
        startLineBeat();
      } catch {}
    },

    async leaveLine() {
      stopLineBeat();
      if (!me) return;
      try {
        await runTransaction(db, async (tx) => {
          const p = presRef ? await tx.get(presRef) : null;
          const s = await tx.get(ref);
          if (!s.exists()) return;
          const data = s.data();
          const pruned = pruneLine(data);
          delete pruned.qbeat[me];
          delete pruned.qsince[me];
          tx.update(ref, { queue: pruned.queue.filter(u => u !== me), qbeat: pruned.qbeat, qsince: pruned.qsince });
          if (presRef && p?.exists() && p.data().game === gameId) {
            tx.set(presRef, { user: me, uid: auth.currentUser?.uid || null, game: null, at: Date.now() });
          }
        });
      } catch {}
    },

    // waited 15+ minutes? ask the player to wrap up — the machine says it
    // out loud in chat, so the warning is public and on the record
    async nudge() {
      if (!me) return false;
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          if (!canNudge(data, me, Date.now(), hogMs)) return false;
          const mins = Math.round(hogMs / 60000);
          const chat = [...(data.chat || []),
            { a: "🕹 machine", t: `${me} has been waiting ${mins}+ minutes and asks for a turn — wrap it up when you can!`, at: Date.now() }
          ].slice(-50);
          tx.set(ref, { ...data, chat, nudgeAt: Date.now(), nudgeBy: me }, { merge: true });
          return true;
        });
      } catch { return false; }
    },

    // the hog clock: eligible waiters vote; UNANIMOUS (2+ of them) frees the seat
    async voteKick() {
      if (!me) return { ok: false };
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          if (!canVoteKick(data, me, Date.now(), hogMs)) return { ok: false };
          const kickvotes = [...new Set([...(data.kickvotes || []), me])];
          const next = { ...data, kickvotes };
          if (voteCarries(next, Date.now(), hogMs)) {
            tx.set(ref, { ...next, player: null, snap: null, snapAt: 0, kickvotes: [] });
            return { ok: true, kicked: true };
          }
          tx.set(ref, next);
          return { ok: true, kicked: false, votes: countKickVotes(next, Date.now(), hogMs), need: eligibleKickers(next, Date.now(), hogMs).length };
        });
      } catch { return { ok: false }; }
    },

    // arcade etiquette: your play ended and people are waiting —
    // the seat frees and you go to the BACK of the line
    async rotateToBack() {
      floor.stopBeating();
      if (!me) return false;
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          if (!s.exists() || s.data().player !== me) return false;
          const data = s.data();
          const pruned = pruneLine(data);
          const queue = pruned.queue.filter(u => u !== me);
          if (queue.length === 0) return false;      // nobody waiting — keep the seat
          queue.push(me);
          const qbeat = { ...pruned.qbeat, [me]: Date.now() };
          const qsince = { ...pruned.qsince, [me]: Date.now() };
          tx.set(ref, { ...data, player: null, snap: null, snapAt: 0, kickvotes: [], nudgeAt: 0, queue, qbeat, qsince });
          if (presRef) tx.set(presRef, { user: me, uid: auth.currentUser?.uid || null, game: gameId, kind: "line", at: Date.now() });
          return true;
        });
      } catch { return false; }
    },

    async chat(text) {
      text = String(text || "").trim().slice(0, 120);
      if (!me || !text) return;
      try {
        await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          const chat = [...(data.chat || []), { a: me, t: text, at: Date.now() }].slice(-50);
          tx.set(ref, { ...data, chat }, { merge: true });
        });
      } catch {}
    },

    stop() {
      floor.stopBeating();
      stopLineBeat();
      if (unsub) { unsub(); unsub = null; }
      listeners = [];
    }
  };

  return floor;
}

// ------------------------------------------------------------- the panel UI
// Status line ("FREE" / "X IS PLAYING · LINE: …"), the line button, and chat.

export function renderFloorPanel(mount, floor, me) {
  mount.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "floor-panel";

  const statusRow = document.createElement("div");
  statusRow.className = "floor-status";
  const statusTx = document.createElement("span");
  const btns = document.createElement("span");
  btns.style.display = "flex";
  btns.style.gap = "6px";
  const kickBtn = document.createElement("button");
  kickBtn.className = "btn btn-small btn-ghost";
  kickBtn.style.display = "none";
  const lineBtn = document.createElement("button");
  lineBtn.className = "btn btn-small btn-ghost";
  btns.append(kickBtn, lineBtn);
  statusRow.append(statusTx, btns);

  const note = document.createElement("p");
  note.className = "floor-note";

  const chatBox = document.createElement("div");
  chatBox.className = "floor-chat";
  const msgs = document.createElement("div");
  msgs.className = "floor-msgs";
  const chatRow = document.createElement("div");
  chatRow.className = "floor-chat-row";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 120;
  input.placeholder = me ? "Say something at the machine…" : "Log in to chat";
  input.disabled = !me;
  const send = document.createElement("button");
  send.className = "btn btn-small";
  send.textContent = "Chat";
  send.disabled = !me;
  chatRow.append(input, send);
  chatBox.append(msgs, chatRow);

  panel.append(statusRow, note, chatBox);
  mount.appendChild(panel);

  const doSend = () => { floor.chat(input.value); input.value = ""; input.focus(); };
  send.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } e.stopPropagation(); });

  let lastChatLen = -1;
  const hogMins = Math.round((floor.hogMs || HOG_MS) / 60000);
  floor.onChange((data) => {
    const holder = seatTakenBy(data);
    const queue = liveQueue(data);
    const inLine = me && queue.includes(me);
    const myPos = inLine ? queue.indexOf(me) + 1 : 0;
    const lineTx = queue.length ? ` · in line: ${queue.join(" → ")}` : "";

    note.textContent = "";
    if (holder && holder !== me) {
      const mins = Math.floor(seatAgeMs(data) / 60000);
      statusTx.textContent = `🕹 ${holder} is playing` + (mins >= 1 ? ` (${mins} min)` : "") + lineTx;
      if (inLine) note.textContent = `You're #${myPos} in line. Stay on this page to keep your spot — leaving gives it up. The screen above shows their game live.`;
      else note.textContent = "You can watch their screen above, chat below, or get in line for your turn.";
    } else if (holder === me && me) {
      statusTx.textContent = "🕹 You're at the machine" + lineTx;
      if (queue.length) note.textContent = "People are waiting — when your play ends, you'll head to the back of the line.";
    } else if (queue.length) {
      if (me && queue[0] === me) {
        statusTx.textContent = `✅ YOUR TURN — press PLAY!` + (queue.length > 1 ? ` · behind you: ${queue.slice(1).join(" → ")}` : "");
      } else {
        statusTx.textContent = `Machine free — ${queue[0]}'s turn` + lineTx;
        if (inLine) note.textContent = `You're #${myPos} in line. Stay on this page to keep your spot.`;
      }
    } else {
      statusTx.textContent = "🟢 Machine free — walk right up";
    }

    lineBtn.style.display = (!me || holder === me || (queue[0] === me && !holder)) ? "none" : "";
    lineBtn.textContent = inLine ? "Leave line" : "Get in line";
    lineBtn.onclick = () => (inLine ? floor.leaveLine() : floor.joinLine());

    // floor rights, earned by waiting under the current player:
    // 1 eligible waiter → ASK them to wrap up; 2+ → a unanimous vote kicks
    const eligible = eligibleKickers(data, Date.now(), floor.hogMs);
    if (canVoteKick(data, me, Date.now(), floor.hogMs)) {
      const votes = countKickVotes(data, Date.now(), floor.hogMs);
      const need = eligible.length;
      const voted = (data.kickvotes || []).includes(me);
      note.textContent = `${need} of you have waited ${hogMins}+ minutes — if ALL ${need} vote, the player is skipped.`;
      kickBtn.style.display = "";
      kickBtn.disabled = voted;
      kickBtn.textContent = voted ? `Kick vote cast (${votes}/${need})` : `Vote to skip (${votes}/${need})`;
      kickBtn.onclick = async () => {
        const r = await floor.voteKick();
        if (r && r.kicked) kickBtn.style.display = "none";
      };
    } else if (eligible.length === 1 && me && eligible[0] === me) {
      note.textContent = `You've waited ${hogMins}+ minutes. One person can't kick — but you can ask them to wrap it up.`;
      kickBtn.style.display = "";
      const may = canNudge(data, me, Date.now(), floor.hogMs);
      kickBtn.disabled = !may;
      kickBtn.textContent = may ? "Ask them to wrap up" : "Asked — give them a minute";
      kickBtn.onclick = () => floor.nudge();
    } else {
      kickBtn.style.display = "none";
    }

    // the seated player sees the warnings, plainly
    if (holder === me && me) {
      const votes = countKickVotes(data, Date.now(), floor.hogMs);
      if (eligible.length >= 2 && votes > 0) {
        note.textContent = `⚠ The line is voting to skip you (${votes}/${eligible.length}) — a unanimous vote ends your turn.`;
      } else if (data?.nudgeAt && Date.now() - data.nudgeAt < 5 * 60 * 1000 && data.nudgeBy) {
        note.textContent = `⏰ ${data.nudgeBy} has been waiting ${hogMins}+ minutes and asked for a turn — wrap it up when you can.`;
      }
    }

    const chat = data?.chat || [];
    if (chat.length !== lastChatLen) {
      lastChatLen = chat.length;
      msgs.innerHTML = "";
      for (const m of chat.slice(-50)) {
        const row = document.createElement("div");
        const who = document.createElement("b");
        who.textContent = m.a + ": ";
        row.appendChild(who);
        row.appendChild(document.createTextNode(m.t));
        msgs.appendChild(row);
      }
      msgs.scrollTop = msgs.scrollHeight;
    }
  });

  return panel;
}

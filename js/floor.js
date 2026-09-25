// floor.js — THE ARCADE FLOOR: machines are physical. A game declares how
// many players fit (1–8 seats); walk up and take any empty one, like a
// little Roblox server wearing an arcade cabinet. The line only forms when
// EVERY seat is full, watchers see the longest-seated player's screen, and
// the hog clock aims at whoever has been seated the longest.
//
// Pure decision logic lives in floor-rules.js so it's testable headless;
// Firestore transactions in here just apply it.

import { db } from "./firebase.js";
import { userDocId, auth } from "./auth.js";
import { myBracket } from "./age.js";
import { canUseFreeText, QUICK_CHAT } from "./ratings.js";
import {
  doc, onSnapshot, runTransaction, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Free typing at the machine is for a declared 13+; everyone else picks from
// QUICK_CHAT (see ratings.js). Looked up once per page.
let _freeText = null;
const freeTextAllowed = () => (_freeText ??= myBracket().then(canUseFreeText).catch(() => false));

export {
  STALE_MS, BEAT_MS, QBEAT_MS, HOG_MS, NUDGE_COOLDOWN_MS, MAX_SEATS,
  clampHogMins, clampSeats, seatTakenBy, seatedPlayers, isSeated, freeSlot,
  kickTarget, sitBlocker, liveQueue, snapFromEngine, snapToObjects, seatAgeMs,
  waitedMs, eligibleKickers, canNudge, canVoteKick, kickThreshold,
  countKickVotes, voteCarries, pruneLine, withSeating
} from "./floor-rules.js";
import {
  BEAT_MS, QBEAT_MS, HOG_MS, clampSeats, seatTakenBy, seatedPlayers, isSeated,
  freeSlot, sitBlocker, liveQueue, seatAgeMs, waitedMs, eligibleKickers,
  canNudge, canVoteKick, countKickVotes, voteCarries, pruneLine, releaseFrom,
  withSeating, kickTarget
} from "./floor-rules.js";

const seatRef = (gameId) => doc(db, "seats", gameId);

// the current players map from any doc shape (legacy or multi-seat)
const playersOf = (data, now = Date.now()) => {
  const out = {};
  for (const p of seatedPlayers(data, now)) out[p.user] = { beat: p.beat, since: p.since, slot: p.slot };
  return out;
};

// ------------------------------------------------------------- the client

export function createFloor(gameId, me, { hogMs = HOG_MS, seats = 1 } = {}) {
  seats = clampSeats(seats);
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
  let mySeatSlot = 0;     // the slot my last successful sit() took — the live
                          // snapshot lags a beat behind the transaction, and
                          // the game wires its net seat the instant play starts
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
    if (me && state && (state.queue || []).includes(me) && !isSeated(state, me)) startLineBeat();
    else stopLineBeat();
    emit();
  }, () => {});   // a broken listener just means no live floor — playable anyway

  const floor = {
    hogMs,
    seats,
    get state() { return state; },
    holder() { return seatTakenBy(state); },          // the PRIMARY (longest-seated)
    primary() { return seatTakenBy(state); },
    mine() { return isSeated(state, me); },
    seated() { return seatedPlayers(state); },
    full() { return freeSlot(state, Date.now(), seats) === 0; },
    mySlot() {
      const p = seatedPlayers(state).find(x => x.user === me);
      return p ? p.slot : mySeatSlot;   // snapshot first, my own sit() second
    },
    line() { return liveQueue(state); },
    onChange(fn) { listeners.push(fn); if (ready) { try { fn(state); } catch {} } },

    // take a seat (atomically). Returns null on success, or the blocker.
    async sit() {
      if (!me) return { reason: "login" };
      let taken = 0;
      try {
        const res = await runTransaction(db, async (tx) => {
          const elsewhere = await readElsewhere(tx);
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          const now = Date.now();
          const block = sitBlocker(data, me, now, seats);
          if (block) return block;
          if (elsewhere && elsewhere.otherRef) tx.set(elsewhere.otherRef, releaseFrom(elsewhere.otherData, me));
          if (presRef) tx.set(presRef, { user: me, uid: auth.currentUser?.uid || null, game: gameId, kind: "seat", at: now });
          const players = playersOf(data, now);
          const already = players[me];
          players[me] = {
            beat: now,
            since: already ? already.since : now,   // re-sitting never resets the hog clock
            slot: already ? already.slot : freeSlot(data, now, seats)
          };
          taken = players[me].slot;
          const pruned = pruneLine(data, now);
          delete pruned.qbeat[me];
          delete pruned.qsince[me];
          tx.set(ref, {
            ...withSeating(data, players, now),
            queue: pruned.queue.filter(u => u !== me),
            qbeat: pruned.qbeat,
            qsince: pruned.qsince
          });
          return null;
        });
        if (res === null) mySeatSlot = taken;   // my seat is known BEFORE the snapshot echoes
        return res;
      } catch (err) { return { reason: "error", message: err.message }; }
    },

    // the heartbeat: proves my seat is alive; the PRIMARY also carries the
    // watchers' window (one screen per cabinet, the longest-seated player's)
    startBeating(getSnap) {
      floor.stopBeating();
      const beatOnce = async () => {
        try {
          await runTransaction(db, async (tx) => {
            const s = await tx.get(ref);
            const data = s.exists() ? s.data() : {};
            const now = Date.now();
            const players = playersOf(data, now);
            if (!players[me]) return;                // lost the seat — stop claiming it
            players[me] = { ...players[me], beat: now };
            const next = withSeating(data, players, now);
            if (next.player === me) {
              const snap = getSnap ? getSnap() : null;
              if (snap) { next.snap = snap; next.snapAt = snap.at; }
            }
            tx.set(ref, next);
          });
        } catch {}
      };
      beatOnce();
      beatTimer = setInterval(beatOnce, BEAT_MS);
    },
    stopBeating() { if (beatTimer) { clearInterval(beatTimer); beatTimer = null; } },

    async leave() {
      floor.stopBeating();
      mySeatSlot = 0;
      if (!me) return;
      try {
        await runTransaction(db, async (tx) => {
          const p = presRef ? await tx.get(presRef) : null;
          const s = await tx.get(ref);
          if (!s.exists() || !isSeated(s.data(), me)) return;
          tx.set(ref, releaseFrom(s.data(), me));
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
      mySeatSlot = 0;
      if (!state || !me) return;
      if (isSeated(state, me) || (state.queue || []).includes(me)) {
        setDoc(ref, releaseFrom(state, me)).catch(() => {});
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

    // waited long enough? ask the longest-seated player to wrap up — the
    // machine says it out loud in chat, so the warning is public
    async nudge() {
      if (!me) return false;
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          if (!canNudge(data, me, Date.now(), hogMs, seats)) return false;
          const target = kickTarget(data);
          const mins = Math.round(hogMs / 60000);
          const chat = [...(data.chat || []),
            { a: "🕹 machine", t: `${me} has been waiting ${mins}+ minutes and asks ${target} for a turn — wrap it up when you can!`, at: Date.now() }
          ].slice(-50);
          tx.set(ref, { ...data, chat, nudgeAt: Date.now(), nudgeBy: me }, { merge: true });
          return true;
        });
      } catch { return false; }
    },

    // the hog clock: eligible waiters vote; UNANIMOUS (2+) skips the
    // LONGEST-SEATED player — votes die if that target changes
    async voteKick() {
      if (!me) return { ok: false };
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          const now = Date.now();
          if (!canVoteKick(data, me, now, hogMs, seats)) return { ok: false };
          const target = kickTarget(data, now);
          const stale = data.kicktgt != null && data.kicktgt !== target;
          const kickvotes = [...new Set([...(stale ? [] : (data.kickvotes || [])), me])];
          const next = { ...data, kickvotes, kicktgt: target };
          if (voteCarries(next, now, hogMs, seats)) {
            tx.set(ref, releaseFrom(next, target, now));
            return { ok: true, kicked: true, target };
          }
          tx.set(ref, next);
          return {
            ok: true, kicked: false, target,
            votes: countKickVotes(next, now, hogMs, seats),
            need: eligibleKickers(next, now, hogMs, seats).length
          };
        });
      } catch { return { ok: false }; }
    },

    // arcade etiquette: your play ended and people are waiting —
    // your seat frees and you go to the BACK of the line
    async rotateToBack() {
      floor.stopBeating();
      mySeatSlot = 0;
      if (!me) return false;
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          if (!s.exists() || !isSeated(s.data(), me)) return false;
          const data = s.data();
          const pruned = pruneLine(data);
          const queue = pruned.queue.filter(u => u !== me);
          if (queue.length === 0) return false;      // nobody waiting — keep the seat
          const released = releaseFrom(data, me);
          queue.push(me);
          tx.set(ref, {
            ...released,
            queue,
            qbeat: { ...released.qbeat, [me]: Date.now() },
            qsince: { ...released.qsince, [me]: Date.now() }
          });
          if (presRef) tx.set(presRef, { user: me, uid: auth.currentUser?.uid || null, game: gameId, kind: "line", at: Date.now() });
          return true;
        });
      } catch { return false; }
    },

    async chat(text) {
      text = String(text || "").trim().slice(0, 120);
      if (!me || !text) return;
      // under-13 / undeclared: fixed phrases only
      if (!(await freeTextAllowed()) && !QUICK_CHAT.includes(text)) return;
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
// Status line, the line button, floor rights, and machine chat.

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
  // quick chat: the phrase picker shown instead of the text box for
  // under-13 and undeclared accounts
  const quick = document.createElement("select");
  quick.style.display = "none";
  quick.style.flex = "1";
  for (const phrase of QUICK_CHAT) {
    const o = document.createElement("option");
    o.value = o.textContent = phrase;
    quick.appendChild(o);
  }
  chatRow.append(input, quick, send);
  chatBox.append(msgs, chatRow);

  panel.append(statusRow, note, chatBox);
  mount.appendChild(panel);

  let useQuick = false;
  if (me) {
    freeTextAllowed().then((free) => {
      if (free) return;
      useQuick = true;
      input.style.display = "none";
      quick.style.display = "";
      quick.title = "Typing your own messages is for players who've declared 13+ in ⚙ Account.";
    });
  }

  const doSend = () => {
    if (useQuick) { floor.chat(quick.value); return; }
    floor.chat(input.value); input.value = ""; input.focus();
  };
  send.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } e.stopPropagation(); });
  quick.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } e.stopPropagation(); });

  let lastChatLen = -1;
  const hogMins = Math.round((floor.hogMs || HOG_MS) / 60000);
  const seats = floor.seats || 1;
  floor.onChange((data) => {
    const now = Date.now();
    const seated = seatedPlayers(data, now);
    const target = seated[0]?.user || null;
    const meSeated = me && seated.some(p => p.user === me);
    const open = freeSlot(data, now, seats) !== 0;
    const queue = liveQueue(data, now);
    const inLine = me && queue.includes(me);
    const myPos = inLine ? queue.indexOf(me) + 1 : 0;
    const lineTx = queue.length ? ` · in line: ${queue.join(" → ")}` : "";
    const names = seated.map(p => p.user === target && seated.length > 1
      ? `${p.user} (${Math.max(0, Math.floor((now - p.since) / 60000))} min)` : p.user).join(", ");

    note.textContent = "";
    if (meSeated) {
      statusTx.textContent = seats > 1
        ? `🕹 You're playing — ${seated.length}/${seats} seats: ${seated.map(p => p.user).join(", ")}` + lineTx
        : "🕹 You're at the machine" + lineTx;
      if (queue.length) note.textContent = "People are waiting — when your play ends, you'll head to the back of the line.";
    } else if (seated.length && !open) {
      const mins = Math.floor(seatAgeMs(data, now) / 60000);
      statusTx.textContent = seats > 1
        ? `🕹 FULL — ${seated.length}/${seats} playing: ${names}` + lineTx
        : `🕹 ${target} is playing` + (mins >= 1 ? ` (${mins} min)` : "") + lineTx;
      if (inLine) note.textContent = `You're #${myPos} in line. Stay on this page to keep your spot — leaving gives it up. The screen above shows ${target}'s game live.`;
      else note.textContent = "You can watch the screen above, chat below, or get in line for a seat.";
    } else if (seated.length && open) {
      statusTx.textContent = `🟢 ${seated.length}/${seats} playing: ${seated.map(p => p.user).join(", ")} — seats open!` + lineTx;
      if (queue.length && me && queue[0] === me) statusTx.textContent = `✅ YOUR TURN — press PLAY!` + lineTx;
      else note.textContent = "A seat is open — press PLAY above to join them.";
    } else if (queue.length) {
      if (me && queue[0] === me) {
        statusTx.textContent = `✅ YOUR TURN — press PLAY!` + (queue.length > 1 ? ` · behind you: ${queue.slice(1).join(" → ")}` : "");
      } else {
        statusTx.textContent = `Machine free — ${queue[0]}'s turn` + lineTx;
        if (inLine) note.textContent = `You're #${myPos} in line. Stay on this page to keep your spot.`;
      }
    } else {
      statusTx.textContent = seats > 1 ? `🟢 Machine free — ${seats} seats, walk right up` : "🟢 Machine free — walk right up";
    }

    lineBtn.style.display = (!me || meSeated || open) ? "none" : "";
    lineBtn.textContent = inLine ? "Leave line" : "Get in line";
    lineBtn.onclick = () => (inLine ? floor.leaveLine() : floor.joinLine());

    // floor rights, earned by waiting while every seat is full:
    // 1 eligible waiter → ASK the longest-seated to wrap up; 2+ → unanimous vote
    const eligible = eligibleKickers(data, now, floor.hogMs, seats);
    if (canVoteKick(data, me, now, floor.hogMs, seats)) {
      const votes = countKickVotes(data, now, floor.hogMs, seats);
      const need = eligible.length;
      const voted = (data.kickvotes || []).includes(me) && data.kicktgt === target;
      note.textContent = `${need} of you have waited ${hogMins}+ minutes — if ALL ${need} vote, ${target} (longest at the machine) is skipped.`;
      kickBtn.style.display = "";
      kickBtn.disabled = voted;
      kickBtn.textContent = voted ? `Kick vote cast (${votes}/${need})` : `Vote to skip ${target} (${votes}/${need})`;
      kickBtn.onclick = async () => {
        const r = await floor.voteKick();
        if (r && r.kicked) kickBtn.style.display = "none";
      };
    } else if (eligible.length === 1 && me && eligible[0] === me) {
      note.textContent = `You've waited ${hogMins}+ minutes. One person can't kick — but you can ask ${target} to wrap it up.`;
      kickBtn.style.display = "";
      const may = canNudge(data, me, now, floor.hogMs, seats);
      kickBtn.disabled = !may;
      kickBtn.textContent = may ? "Ask them to wrap up" : "Asked — give them a minute";
      kickBtn.onclick = () => floor.nudge();
    } else {
      kickBtn.style.display = "none";
    }

    // the player in the crosshairs sees the warnings, plainly
    if (me && target === me && meSeated) {
      const votes = countKickVotes(data, now, floor.hogMs, seats);
      if (eligible.length >= 2 && votes > 0) {
        note.textContent = `⚠ The line is voting to skip you (${votes}/${eligible.length}) — you've been at the machine longest, and a unanimous vote ends your turn.`;
      } else if (data?.nudgeAt && now - data.nudgeAt < 5 * 60 * 1000 && data.nudgeBy) {
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
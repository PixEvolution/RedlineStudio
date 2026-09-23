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
import {
  doc, onSnapshot, runTransaction, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export {
  STALE_MS, BEAT_MS, HOG_MS, seatTakenBy, sitBlocker, snapFromEngine, snapToObjects,
  seatAgeMs, canVoteKick, kickThreshold, countKickVotes, voteCarries
} from "./floor-rules.js";
import {
  BEAT_MS, seatTakenBy, sitBlocker,
  seatAgeMs, canVoteKick, kickThreshold, countKickVotes, voteCarries
} from "./floor-rules.js";

const seatRef = (gameId) => doc(db, "seats", gameId);

// ------------------------------------------------------------- the client

export function createFloor(gameId, me) {
  const ref = seatRef(gameId);
  let state = null;
  let ready = false;      // true once the first snapshot has arrived
  let listeners = [];
  let beatTimer = null;
  let unsub = null;

  const emit = () => { for (const fn of listeners) { try { fn(state); } catch {} } };

  unsub = onSnapshot(ref, (s) => {
    state = s.exists() ? s.data() : null;
    ready = true;
    emit();
  }, () => {});   // a broken listener just means no live floor — playable anyway

  const floor = {
    get state() { return state; },
    holder() { return seatTakenBy(state); },
    mine() { return seatTakenBy(state) === me; },
    line() { return (state?.queue || []); },
    onChange(fn) { listeners.push(fn); if (ready) { try { fn(state); } catch {} } },

    // take the seat (atomically). Returns null on success, or the blocker.
    async sit() {
      if (!me) return { reason: "login" };
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          const block = sitBlocker(data, me);
          if (block) return block;
          tx.set(ref, {
            ...data,
            player: me,
            beat: Date.now(),
            since: Date.now(),        // the hog clock starts
            kickvotes: [],
            queue: (data.queue || []).filter(u => u !== me),
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
          const s = await tx.get(ref);
          if (!s.exists() || s.data().player !== me) return;
          tx.update(ref, { player: null, snap: null, snapAt: 0, kickvotes: [] });
        });
      } catch {}
    },

    // best-effort on tab close (transactions can't run in pagehide)
    leaveBeacon() {
      floor.stopBeating();
      if (state && state.player === me) {
        updateDoc(ref, { player: null, snap: null, snapAt: 0, kickvotes: [] }).catch(() => {});
      }
    },

    async joinLine() {
      if (!me) return;
      try {
        await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          const queue = (data.queue || []).filter(u => u !== me).slice(0, 19);
          queue.push(me);
          tx.set(ref, { ...data, queue }, { merge: true });
        });
      } catch {}
    },

    async leaveLine() {
      if (!me) return;
      try {
        await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          if (!s.exists()) return;
          tx.update(ref, { queue: (s.data().queue || []).filter(u => u !== me) });
        });
      } catch {}
    },

    // the hog clock: line members vote; a carried vote frees the seat
    async voteKick() {
      if (!me) return { ok: false };
      try {
        return await runTransaction(db, async (tx) => {
          const s = await tx.get(ref);
          const data = s.exists() ? s.data() : {};
          if (!canVoteKick(data, me)) return { ok: false };
          const kickvotes = [...new Set([...(data.kickvotes || []), me])];
          const next = { ...data, kickvotes };
          if (voteCarries(next)) {
            tx.set(ref, { ...next, player: null, snap: null, snapAt: 0, kickvotes: [] });
            return { ok: true, kicked: true };
          }
          tx.set(ref, next);
          return { ok: true, kicked: false, votes: countKickVotes(next), need: kickThreshold((next.queue || []).length) };
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
          const queue = (data.queue || []).filter(u => u !== me);
          if (queue.length === 0) return false;      // nobody waiting — keep the seat
          queue.push(me);
          tx.set(ref, { ...data, player: null, snap: null, snapAt: 0, kickvotes: [], queue });
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

  panel.append(statusRow, chatBox);
  mount.appendChild(panel);

  const doSend = () => { floor.chat(input.value); input.value = ""; input.focus(); };
  send.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } e.stopPropagation(); });

  let lastChatLen = -1;
  floor.onChange((data) => {
    const holder = seatTakenBy(data);
    const queue = (data?.queue || []);
    const inLine = me && queue.includes(me);

    if (holder && holder !== me) {
      const mins = Math.floor(seatAgeMs(data) / 60000);
      statusTx.textContent = `🕹 ${holder} is playing` + (mins >= 1 ? ` (${mins}m)` : "") +
        (queue.length ? ` · line: ${queue.join(" → ")}` : "");
    } else if (holder === me && me) {
      statusTx.textContent = "🕹 You're at the machine" + (queue.length ? ` · line: ${queue.join(" → ")}` : "");
    } else if (queue.length) {
      statusTx.textContent = `Machine free · line: ${queue.join(" → ")}` + (me && queue[0] === me ? " — YOUR TURN" : "");
    } else {
      statusTx.textContent = "Machine free";
    }

    lineBtn.style.display = (!me || holder === me) ? "none" : "";
    lineBtn.textContent = inLine ? "Leave line" : "Get in line";
    lineBtn.onclick = () => (inLine ? floor.leaveLine() : floor.joinLine());

    // the hog clock: after 15 minutes, the line can vote to skip
    if (canVoteKick(data, me)) {
      const votes = countKickVotes(data);
      const need = kickThreshold(queue.length);
      const voted = (data.kickvotes || []).includes(me);
      kickBtn.style.display = "";
      kickBtn.disabled = voted;
      kickBtn.textContent = voted ? `Kick vote cast (${votes}/${need})` : `Vote to skip (${votes}/${need})`;
      kickBtn.onclick = async () => {
        const r = await floor.voteKick();
        if (r && r.kicked) kickBtn.style.display = "none";
      };
    } else {
      kickBtn.style.display = "none";
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

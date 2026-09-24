// duel.js — ⚔ ONLINE DUELS: a second human in the machine, over the live wire.
//
// THE NET CONTRACT (blocks or code, like everything in the Studio):
//   set net1 … net6       your outgoing state (numbers), sent ~7×/second
//   read foe1 … foe6      the opponent's latest state
//   change netev by 1     send a pulse (a hit, an event) — arrives as foeev
//   duel                  1 while an opponent is connected, else 0
//   netslot               1 = the machine's player, 2 = the challenger
// A game that sets net1 AND reads foe1 "speaks net" — its page grows a
// ⚔ DUEL button so a second player can join the seat-holder's game.
// Maze War (1974) is the reference: load it and read the duel block.
//
// Honest model (same as the casino odds): each browser simulates its own
// player and believes what the other reports. No referee server — that's
// the Cloud-Functions/Durable-Objects era, someday.

import { liveDb } from "./rtdb.js";
import {
  ref, set, get, remove, onValue, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const RATE_MS = 150;      // outgoing state, ~7×/second
const FRESH_MS = 8000;    // silence this long = the opponent is gone

export function duelAvailable() {
  return !!liveDb();
}

// Is the challenger slot open? (For enabling the ⚔ button before paying.)
export async function guestSlotOpen(gameId, username) {
  const db = liveDb();
  if (!db) return false;
  try {
    const cur = (await get(ref(db, `rooms/${gameId}/guest`))).val();
    return !cur || cur.user === username || Date.now() - (cur.at || 0) > FRESH_MS;
  } catch { return false; }
}

// Wire an engine into the room. role: "host" (the seat holder) or "guest"
// (the challenger). Throws if a guest tries to take an occupied slot.
export async function attachDuel(engine, gameId, username, uid, role) {
  const db = liveDb();
  if (!db) return null;
  const myRef = ref(db, `rooms/${gameId}/${role}`);
  const theirRef = ref(db, `rooms/${gameId}/${role === "host" ? "guest" : "host"}`);

  if (role === "guest") {
    const cur = (await get(myRef)).val();
    if (cur && cur.user !== username && Date.now() - (cur.at || 0) < FRESH_MS) {
      throw new Error(`${cur.user} is already the challenger — get in line for the seat instead.`);
    }
  }
  engine.vars.netslot = role === "host" ? 1 : 2;
  try { onDisconnect(myRef).remove(); } catch {}

  // outgoing: my net vars, on a steady clock
  const pub = setInterval(() => {
    const v = engine.vars;
    set(myRef, {
      user: username || "", uid: uid || null, at: Date.now(),
      n1: Number(v.net1) || 0, n2: Number(v.net2) || 0, n3: Number(v.net3) || 0,
      n4: Number(v.net4) || 0, n5: Number(v.net5) || 0, n6: Number(v.net6) || 0,
      ev: Number(v.netev) || 0
    }).catch(() => {});
  }, RATE_MS);

  // incoming: their net vars become my foe vars; silence flips duel off
  let lastSeen = 0, foeUser = "";
  const un = onValue(theirRef, (s) => {
    const v = s.val();
    if (!v) { engine.vars.duel = 0; return; }
    lastSeen = Date.now();
    foeUser = String(v.user || "");
    engine.vars.duel = 1;
    engine.vars.foe1 = Number(v.n1) || 0;
    engine.vars.foe2 = Number(v.n2) || 0;
    engine.vars.foe3 = Number(v.n3) || 0;
    engine.vars.foe4 = Number(v.n4) || 0;
    engine.vars.foe5 = Number(v.n5) || 0;
    engine.vars.foe6 = Number(v.n6) || 0;
    engine.vars.foeev = Number(v.ev) || 0;
  }, () => { engine.vars.duel = 0; });
  const fresher = setInterval(() => {
    if (engine.vars.duel === 1 && Date.now() - lastSeen > FRESH_MS) engine.vars.duel = 0;
  }, 1000);

  return {
    opponent: () => (engine.vars.duel === 1 ? foeUser : ""),
    destroy() {
      clearInterval(pub);
      clearInterval(fresher);
      try { un(); } catch {}
      try { remove(myRef).catch(() => {}); } catch {}
      engine.vars.duel = 0;
    }
  };
}

// party.js — the net contract for MULTI-SEAT machines: everyone seated at
// the cabinet shares one room over the live wire, one node per seat.
//
// THE CONTRACT, extended from duels (blocks or code, like everything):
//   set net1 … net6        your outgoing state (numbers), sent ~7×/second
//   netslot                your seat number (the harness sets it when you sit)
//   fon[s]                 1 if seat s has a live player (0 = empty/gone)
//   f1[s] … f6[s]          seat s's net1…net6, arriving live
//   fev[s]                 seat s's event counter
//   pcount                 live players in the room, including you
//   set nettgt to s, then change netev by 1   →   seat s's `hits` var +1
//   change netev by 1 (nettgt 0)              →   a broadcast pulse (fev)
//   duel / foe1..foe6 / foeev   still work: mirrored from the lowest other
//                               seat, so 2-seat games written with the duel
//                               vars work unchanged
//
// Honest model (same as the casino odds): every browser simulates its own
// player and believes what the others report.

import { liveDb } from "./rtdb.js";
import {
  ref, set, remove, onValue, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const RATE_MS = 150;      // outgoing state, ~7×/second
const FRESH_MS = 8000;    // silence this long = that seat is gone

export function partyAvailable() {
  return !!liveDb();
}

export function attachParty(engine, gameId, username, uid, slot, seats) {
  const db = liveDb();
  if (!db || !slot) return null;
  const myRef = ref(db, `rooms/${gameId}/s${slot}`);
  const roomRef = ref(db, `rooms/${gameId}`);
  engine.vars.netslot = slot;
  engine.vars.hits = 0;
  try { onDisconnect(myRef).remove(); } catch {}

  // outgoing: my net vars + the targeted-event fields
  const pub = setInterval(() => {
    const v = engine.vars;
    set(myRef, {
      user: username || "", uid: uid || null, at: Date.now(),
      n1: Number(v.net1) || 0, n2: Number(v.net2) || 0, n3: Number(v.net3) || 0,
      n4: Number(v.net4) || 0, n5: Number(v.net5) || 0, n6: Number(v.net6) || 0,
      ev: Number(v.netev) || 0, tgt: Number(v.nettgt) || 0
    }).catch(() => {});
  }, RATE_MS);

  // incoming: every other seat's node → the f-lists (and duel-compat mirrors)
  const seen = {};      // slot -> local receipt time
  const lastEv = {};    // slot -> last event counter we processed
  const users = {};     // slot -> username
  const apply = (room) => {
    const now = Date.now();
    let count = 1, firstOther = 0;
    const fon = {}, f1 = {}, f2 = {}, f3 = {}, f4 = {}, f5 = {}, f6 = {}, fev = {};
    for (let s = 1; s <= seats; s++) {
      if (s === slot) continue;
      const node = room?.["s" + s];
      const fresh = node && now - (seen["s" + s] || 0) < FRESH_MS;
      fon[s] = fresh ? 1 : 0;
      if (!fresh) continue;
      count++;
      if (!firstOther) firstOther = s;
      users[s] = String(node.user || "");
      f1[s] = Number(node.n1) || 0; f2[s] = Number(node.n2) || 0; f3[s] = Number(node.n3) || 0;
      f4[s] = Number(node.n4) || 0; f5[s] = Number(node.n5) || 0; f6[s] = Number(node.n6) || 0;
      fev[s] = Number(node.ev) || 0;
      // targeted events: their counter advanced while aiming at MY seat
      if (lastEv[s] === undefined) lastEv[s] = fev[s];
      if (fev[s] !== lastEv[s]) {
        if ((Number(node.tgt) || 0) === slot) {
          engine.vars.hits = (Number(engine.vars.hits) || 0) + 1;
        }
        lastEv[s] = fev[s];
      }
    }
    engine.lists.fon = fon;
    engine.lists.f1 = f1; engine.lists.f2 = f2; engine.lists.f3 = f3;
    engine.lists.f4 = f4; engine.lists.f5 = f5; engine.lists.f6 = f6;
    engine.lists.fev = fev;
    engine.vars.pcount = count;
    // duel-compat mirrors from the lowest live other seat
    engine.vars.duel = firstOther ? 1 : 0;
    if (firstOther) {
      engine.vars.foe1 = f1[firstOther]; engine.vars.foe2 = f2[firstOther];
      engine.vars.foe3 = f3[firstOther]; engine.vars.foe4 = f4[firstOther];
      engine.vars.foe5 = f5[firstOther]; engine.vars.foe6 = f6[firstOther];
      engine.vars.foeev = fev[firstOther];
    }
  };

  let lastRoom = null;
  const un = onValue(roomRef, (s) => {
    lastRoom = s.val() || {};
    const now = Date.now();
    for (let k = 1; k <= seats; k++) {
      const node = lastRoom["s" + k];
      if (node && k !== slot) {
        // receipt time only moves when THEIR clock does (a fresh write)
        if (seen["at" + k] !== node.at) { seen["at" + k] = node.at; seen["s" + k] = now; }
      }
    }
    apply(lastRoom);
  }, () => {});
  const fresher = setInterval(() => apply(lastRoom), 1000);

  return {
    who: (s) => users[s] || "",
    destroy() {
      clearInterval(pub);
      clearInterval(fresher);
      try { un(); } catch {}
      try { remove(myRef).catch(() => {}); } catch {}
      engine.vars.duel = 0;
      engine.vars.pcount = 1;
    }
  };
}

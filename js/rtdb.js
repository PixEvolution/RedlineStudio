// rtdb.js — the FAST database connection (Firebase Realtime Database).
// Firestore (firebase.js) is the filing cabinet: accounts, coins, games,
// comments — slow, structured, must-be-correct state. THIS is the live wire:
// watch-window frames and duel rooms — tiny messages, many per second,
// pushed to everyone listening in a fraction of a second.
//
// ONE-TIME SETUP (Firebase console):
//   Build → Realtime Database → Create database → United States (us-central1)
//   → Start in locked mode → Rules tab → paste rtdb.rules.json → Publish.
//   (Picked a different region? The console shows the database URL — paste
//   it into DB_URL below and re-upload this file.)
//
// Until that database exists, everything degrades gracefully: the watch
// window falls back to the slower Firestore snapshots and duels just don't
// offer themselves. Nothing breaks.

import { app } from "./firebase.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const DB_URL = "";   // only needed if the RTDB lives outside us-central1

let db = null, tried = false;
export function liveDb() {
  if (!tried) {
    tried = true;
    try {
      db = DB_URL ? getDatabase(app, DB_URL) : getDatabase(app);
    } catch (err) {
      console.warn("live wire off (RTDB not reachable):", err?.message);
      db = null;
    }
  }
  return db;
}

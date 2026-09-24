// live.js — 🔴 LIVE watching: the fast feed behind the watch window.
//
// The player at a machine publishes their screen ~5×/second to the live
// wire; everyone standing at the cabinet sees the game essentially live.
// The old Firestore snapshot (every few seconds) still runs underneath as
// the fallback — if the live wire is off or drops, watchers quietly get
// the slow feed instead. Frames are disposable: the node deletes itself
// when the player disconnects.

import { liveDb } from "./rtdb.js";
import {
  ref, set, remove, onValue, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const HZ = 5;   // frames per second on the wire

// The player's side. start(getSnap) begins broadcasting; stop() cleans up.
export function createLivePublisher(gameId, username) {
  const db = liveDb();
  if (!db) return { start() {}, stop() {} };
  const node = ref(db, "live/" + gameId);
  let timer = null;
  return {
    start(getSnap) {
      this.stop();
      try { onDisconnect(node).remove(); } catch {}
      timer = setInterval(() => {
        try {
          const snap = getSnap();
          if (snap) set(node, { by: username || "", at: Date.now(), snap }).catch(() => {});
        } catch {}
      }, Math.round(1000 / HZ));
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      try { remove(node).catch(() => {}); } catch {}
    }
  };
}

// A watcher's side: onFrame(snap) for every live frame, onFrame(null) when
// the feed ends. Returns an unsubscribe function.
export function watchLive(gameId, onFrame) {
  const db = liveDb();
  if (!db) return () => {};
  const node = ref(db, "live/" + gameId);
  const un = onValue(node, (s) => {
    const v = s.val();
    onFrame(v && v.snap ? v.snap : null);
  }, () => onFrame(null));
  return () => { try { un(); } catch {} };
}

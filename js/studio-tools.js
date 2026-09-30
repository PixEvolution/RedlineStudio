// studio-tools.js — the Studio's modern comforts, as pure logic: the
// undo/redo history and grid snapping. No DOM in here, so it's testable
// like everything else that matters.

// ---- undo / redo -----------------------------------------------------------
// Snapshot-based: the editor hands us serialized states (strings). seed() sets
// the baseline; commit() records the PREVIOUS state whenever the new one
// differs (so undo returns exactly to before the change); undo/redo swap the
// current state onto the opposite stack and hand back where to go.
export function createHistory(cap = 60) {
  let past = [], future = [], last = null;
  return {
    seed(snap) { past = []; future = []; last = snap; },
    commit(snap) {
      if (snap === last) return false;    // nothing actually changed
      past.push(last);
      if (past.length > cap) past.shift();
      last = snap;
      future = [];                        // a new change orphans the redo line
      return true;
    },
    undo(current) {
      if (!past.length) return null;
      future.push(current);
      last = past.pop();
      return last;
    },
    redo(current) {
      if (!future.length) return null;
      past.push(current);
      last = future.pop();
      return last;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    depth: () => past.length
  };
}

// ---- grid snapping ---------------------------------------------------------
export const GRID = 20;
export function snapCoord(v, on, grid = GRID) {
  const n = Number(v) || 0;
  return on ? Math.round(n / grid) * grid : Math.round(n);
}

// ---- unique object ids -----------------------------------------------------
// Selection is by id, so two objects sharing one (a hand-edited file, an old
// import, a copy bug from anywhere) select TOGETHER. This sweep heals any
// list of objects on its way into the editor: missing or repeated ids get
// fresh ones; names are untouched (names may repeat — ids may not).
// Returns how many ids it had to fix.
export function ensureUniqueIds(objects) {
  if (!Array.isArray(objects)) return 0;
  const seen = new Set();
  let fixed = 0, n = 0;
  for (const o of objects) {
    if (!o || typeof o !== "object") continue;
    if (!o.id || typeof o.id !== "string" || seen.has(o.id)) {
      let id;
      do { id = "o" + Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6); }
      while (seen.has(id));
      o.id = id;
      fixed++;
    }
    seen.add(o.id);
  }
  return fixed;
}

// ---- percent-of-pool helper (the owner's till) ------------------------------
export function poolShare(pool, pct) {
  const p = Math.max(0, Math.floor(Number(pool) || 0));
  return Math.max(0, Math.floor(p * pct / 100));
}

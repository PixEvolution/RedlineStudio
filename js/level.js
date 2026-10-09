// level.js — the player LEVEL: 1 + courses completed. It is never STORED
// anywhere — it's computed from /progress (world-readable, owner-written),
// so the only way to raise it is to actually pass a course's live-verified
// steps; no file, import or hand-made API call can fake it. Everyone starts
// at level 1, and the ladder of 58 courses runs it to 59 (the cap grows
// itself as new courses get written).
//
// It rides beside usernames all over the site as "name N" — the number a
// shade dimmer, so "vic 3" reads as player-plus-level, not a longer name.
// A lookup is two PUBLIC reads (users → uid, progress → courses), cached
// per page and for ten minutes in the browser, so lists of names stay cheap.

// Firebase loads lazily inside levelFor, so levelFrom stays pure —
// importable by the hub, the lesson window, and the tests.
const fb = async () => {
  const [{ db }, { userDocId }, fs] = await Promise.all([
    import("./firebase.js"),
    import("./auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
  ]);
  return { db, userDocId, ...fs };
};

export const levelFrom = (courses) => 1 + Object.keys(courses || {}).length;

const TTL = 10 * 60 * 1000;
const inflight = new Map();   // username → Promise<level> (dedupes a page full of the same name)

// the level for any username — 0 means "don't know" (no such user, offline,
// rules not published…) and callers show nothing rather than guessing
export function levelFor(username) {
  const name = String(username || "").trim();
  if (!name) return Promise.resolve(0);
  if (inflight.has(name)) return inflight.get(name);
  const K = "rl_lvl_" + name;
  try {
    const hit = JSON.parse(sessionStorage.getItem(K) || "null");
    if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.v);
  } catch {}
  const p = (async () => {
    try {
      const { db, userDocId, doc, getDoc } = await fb();
      const u = await getDoc(doc(db, "users", userDocId(name)));
      const uid = u.exists() && u.data().uid;
      if (!uid) return 0;
      const pr = await getDoc(doc(db, "progress", uid));
      const v = levelFrom(pr.exists() ? pr.data().courses : null);
      try { sessionStorage.setItem(K, JSON.stringify({ v, t: Date.now() })); } catch {}
      return v;
    } catch { return 0; }
  })();
  inflight.set(name, p);
  return p;
}

// append " N" to an element that shows a username
export function wireLevel(el, username) {
  if (!el) return;
  levelFor(username).then((n) => {
    if (!n) return;
    const s = document.createElement("span");
    s.className = "lvl-num";
    s.style.cssText = "opacity:.75;font-size:.85em;color:#8dffa9;font-weight:400";
    s.textContent = " " + n;
    el.appendChild(s);
  }).catch(() => {});
}

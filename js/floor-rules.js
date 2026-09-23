// floor-rules.js — the arcade floor's PURE logic: who holds a seat, who may
// sit, and the snapshot format watchers see. No database in here, so it runs
// headless in tests; floor.js applies these rules inside Firestore
// transactions.

export const STALE_MS = 25000;
export const BEAT_MS = 3000;
export const QBEAT_MS = 10000;   // line members prove they're still here every 10s


// ---------------------------------------------------------------- pure rules

export function seatTakenBy(data, now = Date.now()) {
  if (!data || !data.player) return null;
  if (now - (Number(data.beat) || 0) > STALE_MS) return null;   // stale = free
  return data.player;
}

// THE LIVE LINE: you're only in line while a page is open on this machine —
// line members heartbeat (qbeat), and a silent member's spot evaporates.
// Every rule below sees only the live line, so ghosts never block anyone.
export function liveQueue(data, now = Date.now()) {
  const qbeat = data?.qbeat || {};
  return (data?.queue || []).filter(u => now - (Number(qbeat[u]) || 0) <= STALE_MS);
}

// Why can't I sit? null = you can. "occupied" / "line" otherwise.
// A free seat with a line only accepts the FRONT of the (live) line.
export function sitBlocker(data, me, now = Date.now()) {
  const holder = seatTakenBy(data, now);
  if (holder && holder !== me) return { reason: "occupied", by: holder };
  const queue = liveQueue(data, now);
  if (!holder && queue.length > 0 && queue[0] !== me) return { reason: "line", next: queue[0] };
  return null;
}

// ------------------------------------------------------------- the snapshots

// A compact frame of a running game: visible objects + the teletype tail.
export function snapFromEngine(engine) {
  return {
    o: engine.objects.filter(o => Number(o.visible)).slice(0, 80).map(o => ({
      t: o.type,
      x: Math.round(o.x), y: Math.round(o.y),
      s: Math.round(Number(o.size) || 0),
      a: Math.round(Number(o.angle) || 0),
      c: String(o.color || "#39ff5e"),
      g: Math.round(Number(o.glow) || 0),
      tx: o.type === "text" ? String(o.text ?? "").slice(0, 64) : ""
    })),
    term: engine.termLines.slice(-12),
    at: Date.now()
  };
}

// ...and back into drawFrame-able objects for the watchers.
export function snapToObjects(snap) {
  return (snap?.o || []).map((o, i) => ({
    id: "sn" + i, name: "sn" + i, type: o.t,
    x: o.x, y: o.y, size: o.s, angle: o.a,
    color: o.c, glow: o.g, visible: 1, text: o.tx, script: []
  }));
}


// ------------------------------------------------------------- the hog clock
// A game with no proper ending lets you sit as long as you like — but the
// line has rights, earned by WAITING:
//   · wait 15 minutes under the current player and you may ASK them to wrap
//     up (a warning — the machine announces it in chat)
//   · kicking is a GROUP EFFORT: it takes at least TWO people who've each
//     waited 15+ minutes, and EVERY one of them must vote — unanimous or
//     nothing. One grumpy waiter can never kick alone.
//   · your wait counts under the CURRENT player only (seat changes hands →
//     the clock restarts), so a player who just fairly got their turn can't
//     be insta-kicked by a line that waited through someone else.

export const HOG_MS = 15 * 60 * 1000;             // the default — devs set their own
export const NUDGE_COOLDOWN_MS = 3 * 60 * 1000;   // one "wrap it up" per 3 min

// Each game chooses its own line patience (minutes) in the Studio.
export function clampHogMins(mins) {
  const m = Math.floor(Number(mins));
  if (!m || m < 1) return 15;
  return Math.min(120, m);
}

export function seatAgeMs(data, now = Date.now()) {
  if (!seatTakenBy(data, now)) return 0;
  return Math.max(0, now - (Number(data.since) || Number(data.beat) || now));
}

// How long has `user` waited under the CURRENT player?
export function waitedMs(data, user, now = Date.now()) {
  const qsince = Number(data?.qsince?.[user]) || 0;
  if (!qsince) return 0;
  const clockStart = Math.max(qsince, Number(data?.since) || 0);
  return Math.max(0, now - clockStart);
}

// The live line members who have earned floor rights (waited long enough).
export function eligibleKickers(data, now = Date.now(), hogMs = HOG_MS) {
  if (!seatTakenBy(data, now)) return [];
  return liveQueue(data, now).filter(u => waitedMs(data, u, now) >= hogMs);
}

// May `me` ask the player to wrap up? (any eligible waiter, rate-limited)
export function canNudge(data, me, now = Date.now(), hogMs = HOG_MS) {
  const holder = seatTakenBy(data, now);
  if (!holder || !me || holder === me) return false;
  if (!eligibleKickers(data, now, hogMs).includes(me)) return false;
  return now - (Number(data?.nudgeAt) || 0) >= NUDGE_COOLDOWN_MS;
}

// May `me` cast a kick vote? Only when kicking is even possible (2+ eligible).
export function canVoteKick(data, me, now = Date.now(), hogMs = HOG_MS) {
  const holder = seatTakenBy(data, now);
  if (!holder || !me || holder === me) return false;
  const el = eligibleKickers(data, now, hogMs);
  return el.length >= 2 && el.includes(me);
}

// Votes needed = EVERY eligible waiter (and there must be at least 2).
export function kickThreshold(eligibleCount) {
  return Math.max(2, Number(eligibleCount) || 0);
}

// Only eligible waiters' votes count.
export function countKickVotes(data, now = Date.now(), hogMs = HOG_MS) {
  const el = eligibleKickers(data, now, hogMs);
  return (data?.kickvotes || []).filter(v => el.includes(v)).length;
}

export function voteCarries(data, now = Date.now(), hogMs = HOG_MS) {
  const el = eligibleKickers(data, now, hogMs);
  if (el.length < 2) return false;                          // never a solo kick
  const votes = data?.kickvotes || [];
  return el.every(u => votes.includes(u));                  // unanimous or nothing
}

// Housekeeping applied inside every write: drop ghosts from the stored doc.
export function pruneLine(data, now = Date.now()) {
  const live = liveQueue(data, now);
  const qbeat = {}, qsince = {};
  for (const u of live) {
    qbeat[u] = Number(data?.qbeat?.[u]) || 0;
    qsince[u] = Number(data?.qsince?.[u]) || 0;
  }
  return { queue: live, qbeat, qsince };
}

// One account, one machine: when a player sits or lines up somewhere new,
// the old machine releases them completely — seat, line spot, kick votes.
export function releaseFrom(data, user, now = Date.now()) {
  const pruned = pruneLine(data, now);
  delete pruned.qbeat[user];
  delete pruned.qsince[user];
  const wasSeated = data?.player === user;
  return {
    ...data,
    player: wasSeated ? null : (data?.player ?? null),
    ...(wasSeated ? { snap: null, snapAt: 0 } : {}),
    kickvotes: (data?.kickvotes || []).filter(v => v !== user),
    queue: pruned.queue.filter(u => u !== user),
    qbeat: pruned.qbeat,
    qsince: pruned.qsince
  };
}

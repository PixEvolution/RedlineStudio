// floor-rules.js — the arcade floor's PURE logic: who holds a seat, who may
// sit, and the snapshot format watchers see. No database in here, so it runs
// headless in tests; floor.js applies these rules inside Firestore
// transactions.

export const STALE_MS = 25000;
export const BEAT_MS = 3000;


// ---------------------------------------------------------------- pure rules

export function seatTakenBy(data, now = Date.now()) {
  if (!data || !data.player) return null;
  if (now - (Number(data.beat) || 0) > STALE_MS) return null;   // stale = free
  return data.player;
}

// Why can't I sit? null = you can. "occupied" / "line" otherwise.
// A free seat with a line only accepts the FRONT of the line.
export function sitBlocker(data, me, now = Date.now()) {
  const holder = seatTakenBy(data, now);
  if (holder && holder !== me) return { reason: "occupied", by: holder };
  const queue = data?.queue || [];
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
// A game with no proper ending lets you sit as long as you like — but after
// 15 minutes, the people waiting IN LINE can vote to skip you. No line, no
// vote: hogging an empty machine bothers nobody.

export const HOG_MS = 15 * 60 * 1000;

export function seatAgeMs(data, now = Date.now()) {
  if (!seatTakenBy(data, now)) return 0;
  return Math.max(0, now - (Number(data.since) || Number(data.beat) || now));
}

// May `me` vote to kick right now? (standing: you must be in the line)
export function canVoteKick(data, me, now = Date.now()) {
  const holder = seatTakenBy(data, now);
  if (!holder || !me || holder === me) return false;
  if (!(data.queue || []).includes(me)) return false;
  return seatAgeMs(data, now) >= HOG_MS;
}

// Votes needed: half the line, rounded up — one waiter alone can carry it.
export function kickThreshold(queueLength) {
  return Math.max(1, Math.ceil((Number(queueLength) || 0) / 2));
}

// Only votes from people still in line count (leave the line, lose your vote).
export function countKickVotes(data) {
  const queue = data?.queue || [];
  return (data?.kickvotes || []).filter(v => queue.includes(v)).length;
}

export function voteCarries(data, now = Date.now()) {
  const queue = data?.queue || [];
  if (queue.length === 0) return false;
  if (seatAgeMs(data, now) < HOG_MS) return false;
  return countKickVotes(data) >= kickThreshold(queue.length);
}

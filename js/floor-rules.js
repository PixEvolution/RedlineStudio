// floor-rules.js — the arcade floor's PURE logic: who holds a seat, who may
// sit, and the snapshot format watchers see. No database in here, so it runs
// headless in tests; floor.js applies these rules inside Firestore
// transactions.
//
// MULTI-SEAT MACHINES: a game declares how many players fit (1–8 seats,
// like a Roblox server in arcade clothes). Seats aren't ordered — walk up
// and take any empty one. The line only forms once EVERY seat is full, and
// the hog clock aims at the player who's been seated the LONGEST. A game
// with one seat behaves exactly as the floor always has.
//
// Doc shape (new fields beside the originals):
//   players: { user: { beat, since, slot } }   the seated players
//   player / beat / since                      LEGACY mirrors of the "primary"
//     (the longest-seated player — also whose screen the watchers see)
//   kicktgt                                    who the current kick votes aim at

export const STALE_MS = 25000;
export const BEAT_MS = 3000;
export const QBEAT_MS = 10000;   // line members prove they're still here every 10s

export const MAX_SEATS = 8;
export function clampSeats(n) {
  const s = Math.floor(Number(n));
  if (!s || s < 1) return 1;
  return Math.min(MAX_SEATS, s);
}

// ---------------------------------------------------------------- the seats

// Every LIVE seated player, longest-seated first.
// Reads the new `players` map, or a legacy single-player doc.
export function seatedPlayers(data, now = Date.now()) {
  const out = [];
  if (data?.players && typeof data.players === "object") {
    for (const [user, p] of Object.entries(data.players)) {
      if (!p) continue;
      if (now - (Number(p.beat) || 0) > STALE_MS) continue;   // stale = gone
      out.push({ user, beat: Number(p.beat) || 0, since: Number(p.since) || 0, slot: Number(p.slot) || 1 });
    }
  } else if (data?.player) {
    if (now - (Number(data.beat) || 0) <= STALE_MS) {
      out.push({ user: data.player, beat: Number(data.beat) || 0, since: Number(data.since) || 0, slot: 1 });
    }
  }
  out.sort((a, b) => a.since - b.since || String(a.user).localeCompare(String(b.user)));
  return out;
}

export function isSeated(data, user, now = Date.now()) {
  return !!user && seatedPlayers(data, now).some(p => p.user === user);
}

// The PRIMARY: the longest-seated live player. Watchers see their screen,
// legacy clients read them as "the player", and the hog clock aims at them.
export function seatTakenBy(data, now = Date.now()) {
  const seated = seatedPlayers(data, now);
  return seated.length ? seated[0].user : null;
}
export const kickTarget = seatTakenBy;

// The lowest empty seat number (1-based), or 0 when the machine is full.
export function freeSlot(data, now = Date.now(), seats = 1) {
  const used = new Set(seatedPlayers(data, now).map(p => p.slot));
  for (let s = 1; s <= clampSeats(seats); s++) if (!used.has(s)) return s;
  return 0;
}

// THE LIVE LINE: you're only in line while a page is open on this machine —
// line members heartbeat (qbeat), and a silent member's spot evaporates.
// Every rule below sees only the live line, so ghosts never block anyone.
export function liveQueue(data, now = Date.now()) {
  const qbeat = data?.qbeat || {};
  return (data?.queue || []).filter(u => now - (Number(qbeat[u]) || 0) <= STALE_MS);
}

// Why can't I sit? null = you can. "occupied" (all seats full) / "line"
// (a seat is open but the front of the live line gets it first).
export function sitBlocker(data, me, now = Date.now(), seats = 1) {
  if (isSeated(data, me, now)) return null;               // re-sit your own seat
  const seated = seatedPlayers(data, now);
  if (!freeSlot(data, now, seats)) {
    return { reason: "occupied", by: seated[0]?.user || null, count: seated.length, seats: clampSeats(seats) };
  }
  const queue = liveQueue(data, now);
  if (queue.length > 0 && queue[0] !== me) return { reason: "line", next: queue[0] };
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
// line has rights, earned by WAITING (and only while EVERY seat is full):
//   · wait the game's patience under the current longest-seated player and
//     you may ASK them to wrap up (a warning — the machine says it in chat)
//   · kicking is a GROUP EFFORT: it takes at least TWO people who've each
//     waited long enough, and EVERY one of them must vote — unanimous or
//     nothing. One grumpy waiter can never kick alone.
//   · the vote always aims at the LONGEST-SEATED player, and your wait
//     counts under them only — when they leave, the clock (and any votes)
//     restart against the next-longest.

export const HOG_MS = 15 * 60 * 1000;             // the default — devs set their own
export const NUDGE_COOLDOWN_MS = 3 * 60 * 1000;   // one "wrap it up" per 3 min

// Each game chooses its own line patience (minutes) in the Studio.
export function clampHogMins(mins) {
  const m = Math.floor(Number(mins));
  if (!m || m < 1) return 15;
  return Math.min(120, m);
}

export function seatAgeMs(data, now = Date.now()) {
  const seated = seatedPlayers(data, now);
  if (!seated.length) return 0;
  return Math.max(0, now - (seated[0].since || seated[0].beat || now));
}

// How long has `user` waited under the current kick target?
export function waitedMs(data, user, now = Date.now()) {
  const qsince = Number(data?.qsince?.[user]) || 0;
  if (!qsince) return 0;
  const seated = seatedPlayers(data, now);
  const targetSince = seated.length ? seated[0].since : 0;
  return Math.max(0, now - Math.max(qsince, targetSince));
}

// The live line members who have earned floor rights: they've waited long
// enough AND there's genuinely nowhere to sit (every seat full).
export function eligibleKickers(data, now = Date.now(), hogMs = HOG_MS, seats = 1) {
  if (freeSlot(data, now, seats) !== 0) return [];   // a seat is open — just sit
  return liveQueue(data, now).filter(u => waitedMs(data, u, now) >= hogMs);
}

// May `me` ask the longest-seated player to wrap up? (rate-limited)
export function canNudge(data, me, now = Date.now(), hogMs = HOG_MS, seats = 1) {
  if (!me || isSeated(data, me, now)) return false;
  if (!eligibleKickers(data, now, hogMs, seats).includes(me)) return false;
  return now - (Number(data?.nudgeAt) || 0) >= NUDGE_COOLDOWN_MS;
}

// May `me` cast a kick vote? Only when kicking is even possible (2+ eligible).
export function canVoteKick(data, me, now = Date.now(), hogMs = HOG_MS, seats = 1) {
  if (!me || isSeated(data, me, now)) return false;
  const el = eligibleKickers(data, now, hogMs, seats);
  return el.length >= 2 && el.includes(me);
}

// Votes needed = EVERY eligible waiter (and there must be at least 2).
export function kickThreshold(eligibleCount) {
  return Math.max(2, Number(eligibleCount) || 0);
}

// Votes only count against the CURRENT target (kicktgt pins who a vote was
// cast against; a legacy doc without it counts as current).
function votesValid(data, now) {
  return data?.kicktgt == null || data.kicktgt === kickTarget(data, now);
}

// Only eligible waiters' votes count.
export function countKickVotes(data, now = Date.now(), hogMs = HOG_MS, seats = 1) {
  if (!votesValid(data, now)) return 0;
  const el = eligibleKickers(data, now, hogMs, seats);
  return (data?.kickvotes || []).filter(v => el.includes(v)).length;
}

export function voteCarries(data, now = Date.now(), hogMs = HOG_MS, seats = 1) {
  if (!votesValid(data, now)) return false;
  const el = eligibleKickers(data, now, hogMs, seats);
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

// Rebuild the players map + the legacy mirrors after any seating change.
// Stale players are dropped, the primary is recomputed, and kick votes
// evaporate whenever the target they aimed at changes.
export function withSeating(data, players, now = Date.now()) {
  const next = { ...data, players };
  const seated = seatedPlayers(next, now);
  const primary = seated[0] || null;
  next.player = primary ? primary.user : null;
  next.beat = primary ? primary.beat : 0;
  next.since = primary ? primary.since : 0;
  if ((next.kicktgt ?? null) !== (next.player ?? null)) {
    next.kickvotes = [];
    next.kicktgt = next.player ?? null;
    next.nudgeAt = 0;
  }
  if (!primary) { next.snap = null; next.snapAt = 0; }
  return next;
}

// One account, one machine: when a player sits or lines up somewhere new,
// the old machine releases them completely — seat, line spot, kick votes.
export function releaseFrom(data, user, now = Date.now()) {
  const pruned = pruneLine(data, now);
  delete pruned.qbeat[user];
  delete pruned.qsince[user];
  const players = {};
  for (const p of seatedPlayers(data, now)) {
    if (p.user !== user) players[p.user] = { beat: p.beat, since: p.since, slot: p.slot };
  }
  const wasPrimary = seatTakenBy(data, now) === user;
  const next = withSeating(data, players, now);
  return {
    ...next,
    ...(wasPrimary ? { snap: null, snapAt: 0 } : {}),
    kickvotes: (next.kickvotes || []).filter(v => v !== user),
    queue: pruned.queue.filter(u => u !== user),
    qbeat: pruned.qbeat,
    qsince: pruned.qsince
  };
}

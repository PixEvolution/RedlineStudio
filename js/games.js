// games.js — publishing, listing, and loading games. Nothing else lives here.
//
// Every game document is saved with a version number and an open-ended `data`
// field, so the studio can grow new powers later without breaking old games.

import { cleanRating } from "./ratings.js";
import { cardFields } from "./cardfields.js";
export { cardFields };
import { db } from "./firebase.js";
import { auth } from "./auth.js";
import {
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc, setDoc, writeBatch,
  query, where, orderBy, limit, startAfter, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GAMES = "games";
const CARDS = "cards";

// ---- THE CARDS COLLECTION: a light mirror of each game, one doc per game,
// same id. List pages read CARDS (kilobytes), play.html reads GAMES (the
// real thing). The card's shape lives in cardfields.js (pure, tested).
// This is why room 1 opens instantly on a phone.

export async function publishGame({ title, owner, data, engine = "v1", description = "", price = 0, screen = null, casino = false, unlisted = false, hogmins = 15, seats = 1, rating = "E", thumb = "" }) {
  if (!title || title.trim().length === 0) throw new Error("Your game needs a title.");
  if (title.length > 40) throw new Error("Title must be 40 characters or less.");

  const ref = doc(collection(db, GAMES));           // the id, up front
  const batch = writeBatch(db);
  batch.set(ref, {
    ownerUid: auth.currentUser?.uid || null,   // security rules enforce owner-only edits
    ...(casino ? { casino: true, pool: 0 } : {}),   // casino machines carry a coin pool
    unlisted: !!unlisted,                            // unlisted = saved but off the public pages
    hogmins: Math.max(1, Math.min(120, Math.floor(Number(hogmins) || 15))),   // line patience (minutes)
    seats: casino ? 1 : Math.max(1, Math.min(8, Math.floor(Number(seats) || 1))),   // players at once (multi-seat machines)
    rating: casino ? "A18" : cleanRating(rating),   // content rating (the casino is always adult)
    version: 1,           // game format version — bump when the studio evolves
    engine,               // which engine/player understands this game
    title: title.trim(),
    owner,                // username of the creator
    data,                 // the game itself (open-ended)
    description: String(description || "").slice(0, 200),
    price: cleanPrice(price),
    screen: cleanScreen(screen),
    plays: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  // the card rides in the same batch — the two can never disagree
  batch.set(doc(db, CARDS, ref.id), {
    ...cardFields({ title, owner, ownerUid: auth.currentUser?.uid || null, description, price, casino, unlisted, seats: casino ? 1 : seats, rating, data, screen, thumb }),
    plays: 0,
    likes: 0,
    dislikes: 0,
    ...(casino ? { pool: 0 } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  return ref.id;
}

// Overwrite an existing game with new content (republish/update).
export async function updateGame(gameId, { title, data, engine, description, price, screen, casino, unlisted, hogmins, seats, rating = "E", thumb = "" }) {
  const batch = writeBatch(db);
  batch.update(doc(db, GAMES, gameId), {
    rating: casino ? "A18" : cleanRating(rating),
    ownerUid: auth.currentUser?.uid || null,   // stamps legacy games on their next save
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(data !== undefined ? { data } : {}),
    ...(engine !== undefined ? { engine } : {}),
    ...(casino !== undefined ? { casino: !!casino } : {}),
    ...(unlisted !== undefined ? { unlisted: !!unlisted } : {}),
    ...(hogmins !== undefined ? { hogmins: Math.max(1, Math.min(120, Math.floor(Number(hogmins) || 15))) } : {}),
    ...(seats !== undefined ? { seats: Math.max(1, Math.min(8, Math.floor(Number(seats) || 1))) } : {}),
    ...(description !== undefined ? { description: String(description || "").slice(0, 200) } : {}),
    ...(price !== undefined ? { price: cleanPrice(price) } : {}),
    ...(screen !== undefined ? { screen: cleanScreen(screen) } : {}),
    updatedAt: serverTimestamp()
  });
  // the card mirrors the new state; merge keeps its counters (plays, votes,
  // pool) — and quietly rebuilds a card that never existed (pre-cards games)
  batch.set(doc(db, CARDS, gameId), {
    ...cardFields({ title, owner: undefined, ownerUid: auth.currentUser?.uid || null, description, price, casino, unlisted, seats, rating, data, screen, thumb }),
    updatedAt: serverTimestamp()
  }, { merge: true });
  await batch.commit();
}

function cleanPrice(p) {
  return Math.min(100000, Math.max(0, Math.floor(Number(p) || 0)));
}

function cleanScreen(s) {
  if (!s || !s.mode || s.mode === "none") return { mode: "none", objects: [] };
  return { mode: s.mode === "live" ? "live" : "static", objects: s.objects || [] };
}

export async function deleteGame(gameId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, GAMES, gameId));
  batch.delete(doc(db, CARDS, gameId));
  await batch.commit();
}

// Newest games for the home page.
export async function listGames(max = 50) {
  const all = await listAllGames(max);
  return all.filter(g => !g.casino && !g.unlisted);
}

// ---- ROOMS: the Games page shows the arcade in rooms of ROOM_SIZE, but
// search and sort work across ALL of it — so the whole public collection
// is fetched once (in batches of 40, by cursor, capped sanely), sorted
// globally in the browser, and only THEN cut into rooms. A thumbs-down
// game sorts to the very end of the last room, never ahead of unrated ones.
export const ROOM_SIZE = 24;
async function scanPublic(col, casino, cap) {
  // THE CASINO asks for its machines directly (casino == true), so however
  // big the arcade grows, no machine is ever pushed out of the casino by
  // newer GAMES. One equality filter and no orderBy = no index needed;
  // the newest-first order is applied right here instead.
  if (casino) {
    const snap = await getDocs(query(collection(db, col), where("casino", "==", true)));
    const machines = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => !g.unlisted);
    machines.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return machines;
  }
  const out = [];
  let cur = null, scanned = 0, total = 0;
  do {
    const q = cur
      ? query(collection(db, col), orderBy("createdAt", "desc"), startAfter(cur), limit(40))
      : query(collection(db, col), orderBy("createdAt", "desc"), limit(40));
    const snap = await getDocs(q);
    scanned = snap.docs.length;
    total += scanned;
    for (const d of snap.docs) {
      cur = d;
      const g = { id: d.id, ...d.data() };
      if (!!g.casino !== !!casino || g.unlisted) continue;   // not this floor's kind
      out.push(g);
    }
  } while (scanned === 40 && total < cap);
  return out;
}
export async function listAllPublic(casino = false, cap = 400) {
  // the lists read CARDS — light docs, so phones open room 1 instantly.
  // Before the one-time backfill has run, cards may be empty: fall back to
  // the old full-games scan so the site never goes blank in between.
  try {
    const cards = await scanPublic(CARDS, casino, cap);
    if (cards.length > 0) return cards;
  } catch { /* cards unreadable — rules not deployed yet */ }
  return scanPublic(GAMES, casino, cap);
}

// The Casino floor: EVERY public machine. (It used to read only the newest
// 50 games site-wide and keep the machines among them — so once the arcade
// passed 50 games, older machines silently fell off the floor.)
export async function listCasino() {
  return listAllPublic(true);
}

async function listAllGames(max = 50) {
  const q = query(collection(db, GAMES), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// One creator's games as LIGHT CARDS (profile pages). Falls back to the
// full-games scan until the one-time backfill has run.
export async function listCardsBy(owner) {
  try {
    const snap = await getDocs(query(collection(db, CARDS), where("owner", "==", owner)));
    const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (cards.length > 0) {
      cards.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return cards;
    }
  } catch { /* pre-backfill */ }
  return listGamesBy(owner);
}

// All games by one creator — the FULL docs (the studio's My Games needs
// them to open a game for editing). Profile pages use listCardsBy instead.
export async function listGamesBy(owner) {
  const q = query(collection(db, GAMES), where("owner", "==", owner));
  const snap = await getDocs(q);
  const games = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  games.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return games;
}

// Load one game to play it.
export async function getGame(gameId) {
  const snap = await getDoc(doc(db, GAMES, gameId));
  if (!snap.exists()) throw new Error("Game not found — it may have been deleted.");
  return { id: snap.id, ...snap.data() };
}

// Count a play (fire-and-forget).
export function countPlay(gameId) {
  updateDoc(doc(db, GAMES, gameId), { plays: increment(1) }).catch(() => {});
  updateDoc(doc(db, CARDS, gameId), { plays: increment(1) }).catch(() => {});
}
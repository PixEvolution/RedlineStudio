// games.js — publishing, listing, and loading games. Nothing else lives here.
//
// Every game document is saved with a version number and an open-ended `data`
// field, so the studio can grow new powers later without breaking old games.

import { db } from "./firebase.js";
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GAMES = "games";

// Publish a brand-new game. `data` is the game's content — its shape can evolve.
// `price` = coins to insert per play (0 = free, arcade style).
// `screen` = the attract screen shown on the card and before playing:
//            { mode: "none"|"static"|"live", objects: [...] }
export async function publishGame({ title, owner, data, engine = "v1", description = "", price = 0, screen = null, casino = false, unlisted = false, hogmins = 15 }) {
  if (!title || title.trim().length === 0) throw new Error("Your game needs a title.");
  if (title.length > 40) throw new Error("Title must be 40 characters or less.");

  const ref = await addDoc(collection(db, GAMES), {
    ...(casino ? { casino: true, pool: 0 } : {}),   // casino machines carry a coin pool
    unlisted: !!unlisted,                            // unlisted = saved but off the public pages
    hogmins: Math.max(1, Math.min(120, Math.floor(Number(hogmins) || 15))),   // line patience (minutes)
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
  return ref.id;
}

// Overwrite an existing game with new content (republish/update).
export async function updateGame(gameId, { title, data, engine, description, price, screen, casino, unlisted, hogmins }) {
  await updateDoc(doc(db, GAMES, gameId), {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(data !== undefined ? { data } : {}),
    ...(engine !== undefined ? { engine } : {}),
    ...(casino !== undefined ? { casino: !!casino } : {}),
    ...(unlisted !== undefined ? { unlisted: !!unlisted } : {}),
    ...(hogmins !== undefined ? { hogmins: Math.max(1, Math.min(120, Math.floor(Number(hogmins) || 15))) } : {}),
    ...(description !== undefined ? { description: String(description || "").slice(0, 200) } : {}),
    ...(price !== undefined ? { price: cleanPrice(price) } : {}),
    ...(screen !== undefined ? { screen: cleanScreen(screen) } : {}),
    updatedAt: serverTimestamp()
  });
}

function cleanPrice(p) {
  return Math.min(100000, Math.max(0, Math.floor(Number(p) || 0)));
}

function cleanScreen(s) {
  if (!s || !s.mode || s.mode === "none") return { mode: "none", objects: [] };
  return { mode: s.mode === "live" ? "live" : "static", objects: s.objects || [] };
}

export async function deleteGame(gameId) {
  await deleteDoc(doc(db, GAMES, gameId));
}

// Newest games for the home page.
export async function listGames(max = 50) {
  const all = await listAllGames(max);
  return all.filter(g => !g.casino && !g.unlisted);
}

// The Casino floor: only machines.
export async function listCasino(max = 50) {
  const all = await listAllGames(max);
  return all.filter(g => !!g.casino && !g.unlisted);
}

async function listAllGames(max = 50) {
  const q = query(collection(db, GAMES), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// All games by one creator (for "My Games" in the studio).
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
}

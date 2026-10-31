// universes.js — Emergence universes: the .emergence files players share.
// The game makes them (My Universes → EXPORT). This module checks a file,
// uploads it in chunks, lists the shelf, and rebuilds the file on download.
//
// THE PROMISE (same idea as the .rlgame file): a universe is DATA.
//   1. The SEAL — SHA-256 over every field, computed the same way by the
//      game. Edited or damaged in transit → refused here AND in the game.
//   2. The SHAPE — this page checks every field's type and size, that the
//      thumbnail is a real small PNG, and that the data unpacks to a universe.
//   3. The GAME — rebuilds the universe field by field on import, building
//      only numbers, text, number arrays and its own objects. The worst a
//      bad file can do is fail to import.
//
// STORAGE: Firestore docs cap at 1 MB, so a universe is split across
//   universes/{id}                 — what a card shows (+ the seal), light
//   universeParts/{id}_{n}         — the universe itself, ≤ 200 KB per part
// Written as many SMALL writes (one giant write can stall on some
// connections without ever erroring). The card starts as ready:false —
// hidden everywhere — and flips to ready:true only once the server has
// confirmed every part. A failed upload cleans up after itself.

import { db } from "./firebase.js";
import { auth, userDocId } from "./auth.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter,
  writeBatch, serverTimestamp, increment, updateDoc, addDoc, setDoc, deleteDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const FORMAT = "EMERGENCE1";
export const PART = 200000;          // characters per chunk (keep in sync with the game: SHARE_PART)
export const MAX_PARTS = 36;         // ~7 MB of universe (game: SHARE_MAX_PARTS)
const WRITE_TIMEOUT = 60000;         // one small write that takes a full minute has stalled
export const MAX_DESC = 500;
const MAX_THUMB = 540000;            // base64 characters (~400 KB PNG — the game's own cap)
const PAGE = 24;
const INT_FIELDS = ["seed", "age", "laws", "matter", "kinds", "colonies"];

// ---- the seal --------------------------------------------------------------
// Exactly the game's share_seal(): the fields in this order, joined by "\n",
// SHA-256, first 32 hex characters.
export async function sealOf(f) {
  const s = [f.format, f.name, f.seed, f.age, f.laws, f.matter, f.kinds, f.colonies, f.thumb, f.data]
    .map(String).join("\n");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ---- checking a file -------------------------------------------------------
const isB64 = (s) => typeof s === "string" && s.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(s);

export function thumbOk(b64) {
  if (b64 === "") return true;
  if (!isB64(b64) || b64.length > MAX_THUMB) return false;
  const head = atob(b64.slice(0, 32));
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (head.charCodeAt(i) !== sig[i]) return false;
  const u32 = (o) => ((head.charCodeAt(o) << 24) >>> 0) + (head.charCodeAt(o + 1) << 16) + (head.charCodeAt(o + 2) << 8) + head.charCodeAt(o + 3);
  const w = u32(16), h = u32(20);
  return w > 0 && w <= 640 && h > 0 && h <= 400;
}

function cleanName(s) {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40);
}

// Does the packed data really unpack to a universe? (zlib → JSON → Universe)
async function unpacksToUniverse(data) {
  if (typeof DecompressionStream === "undefined") return true;   // old browser: the game still checks
  try {
    const bin = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream("deflate"));
    const text = await new Response(stream).text();
    const tree = JSON.parse(text);
    return !!tree && tree.$o === "Universe" && typeof tree.d === "object" && tree.d !== null;
  } catch {
    return false;
  }
}

// text of a .emergence file → the checked file object (throws a friendly Error)
export async function checkFile(text) {
  if (typeof text !== "string" || text.length > PART * MAX_PARTS + MAX_THUMB + 4096) {
    throw new Error("That file is too big to share here (7 MB max). Try a younger or smaller universe.");
  }
  let f;
  try { f = JSON.parse(text); } catch { throw new Error("That isn't a universe file."); }
  if (!f || typeof f !== "object" || f.format !== FORMAT) throw new Error("That isn't an Emergence universe file.");
  for (const k of ["name", "thumb", "data", "seal"]) {
    if (typeof f[k] !== "string") throw new Error("That universe file is missing pieces.");
  }
  for (const k of INT_FIELDS) {
    if (!Number.isSafeInteger(f[k]) || f[k] < 0) throw new Error("That universe file is missing pieces.");
  }
  if (f.name.length > 40) throw new Error("That universe's name is too long.");
  if (!thumbOk(f.thumb)) throw new Error("That universe's picture isn't a normal thumbnail.");
  if (!isB64(f.data) || f.data.length === 0) throw new Error("That universe file is damaged.");
  if (f.data.length > PART * MAX_PARTS) throw new Error("That universe is too big to share here (7 MB max).");
  if ((await sealOf(f)) !== f.seal) throw new Error("The seal is broken — this file was edited or damaged. Export it again from the game.");
  if (!(await unpacksToUniverse(f.data))) throw new Error("That file's seal is fine but there's no universe inside.");
  return f;
}

// ---- uploading -------------------------------------------------------------
// A write the server never confirms would leave the button spinning forever,
// so every write gets a deadline.
function withTimeout(promise, what) {
  let t;
  const timer = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`the connection stalled while sending ${what} — check your internet and try again`)), WRITE_TIMEOUT);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

// onProgress(done, total) is called as parts land.
export async function uploadUniverse(f, description, username, onProgress = () => {}) {
  const uid = auth.currentUser?.uid;
  if (!uid || !username) throw new Error("Log in to share a universe.");
  description = String(description || "").trim().slice(0, MAX_DESC);
  const parts = [];
  for (let i = 0; i < f.data.length; i += PART) parts.push(f.data.slice(i, i + PART));
  if (parts.length < 1 || parts.length > MAX_PARTS) throw new Error("That universe is too big to share here.");

  const ref = doc(collection(db, "universes"));
  const total = parts.length + 2;
  onProgress(0, total);
  // 1. the card, hidden until everything else has landed
  await withTimeout(setDoc(ref, {
    format: FORMAT, name: f.name, seed: f.seed, age: f.age, laws: f.laws, matter: f.matter,
    kinds: f.kinds, colonies: f.colonies, thumb: f.thumb, seal: f.seal,
    parts: parts.length, size: f.data.length, description,
    owner: username, ownerUid: uid, ownerDoc: userDocId(username),
    listed: false, price: 0, ready: false,
    likes: 0, dislikes: 0, downloads: 0, createdAt: serverTimestamp()
  }), "the universe's card");
  onProgress(1, total);
  let sent = 0;
  try {
    // 2. the universe itself, one small part at a time
    for (let n = 0; n < parts.length; n++) {
      await withTimeout(setDoc(doc(db, "universeParts", ref.id + "_" + n),
        { uni: ref.id, n, data: parts[n], ownerUid: uid }), `part ${n + 1} of ${parts.length}`);
      sent = n + 1;
      onProgress(n + 2, total);
    }
    // 3. everything is on the server: show it
    await withTimeout(updateDoc(ref, { ready: true }), "the finishing touch");
    onProgress(total, total);
  } catch (err) {
    // leave nothing half-uploaded behind
    for (let n = 0; n < sent; n++) deleteDoc(doc(db, "universeParts", ref.id + "_" + n)).catch(() => {});
    deleteDoc(ref).catch(() => {});
    throw err;
  }
  return ref.id;
}

// ---- the shelf -------------------------------------------------------------
// order: "createdAt" | "likes" | "downloads". Pass the returned `last` back
// in as `after` for the next page.
export async function listUniverses(order = "createdAt", after = null) {
  const parts = [collection(db, "universes"), orderBy(order, "desc")];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE));
  const snap = await getDocs(query(...parts));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => !u.unlisted && u.ready !== false);
  return { items, last: snap.docs[snap.docs.length - 1] || null, more: snap.docs.length === PAGE };
}

export async function getUniverse(id) {
  const snap = await getDoc(doc(db, "universes", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---- downloading -----------------------------------------------------------
// Rebuilds the exact file the game exported, re-checks it, saves it, and
// counts the download (the rules allow anyone exactly +1).
export async function downloadUniverse(u) {
  const n = Number(u.parts) || 0;
  if (n < 1 || n > MAX_PARTS) throw new Error("That upload is incomplete.");
  const chunks = [];
  for (let i = 0; i < n; i++) {
    let p;
    try { p = await getDoc(doc(db, "universeParts", u.id + "_" + i)); }
    catch (err) {
      if (String(err.code || err.message || "").includes("permission")) {
        throw new Error("This universe is sold for coins — buy it first, then the download is yours forever.");
      }
      throw err;
    }
    if (!p.exists() || typeof p.data().data !== "string") throw new Error("That upload is incomplete.");
    chunks.push(p.data().data);
  }
  const f = {
    format: FORMAT, name: u.name, seed: u.seed, age: u.age, laws: u.laws, matter: u.matter,
    kinds: u.kinds, colonies: u.colonies, thumb: u.thumb, data: chunks.join(""), seal: u.seal
  };
  if ((await sealOf(f)) !== f.seal) throw new Error("This upload's seal doesn't match — it may be damaged.");
  const text = JSON.stringify(f);
  const safe = (cleanName(u.name) || "Universe").replace(/[^A-Za-z0-9 _-]/g, "_");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = `${safe} ${u.seed}.emergence`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  updateDoc(doc(db, "universes", u.id), { downloads: increment(1) }).catch(() => {});
}

// ---- the market -------------------------------------------------------------
// Selling works exactly like the PC Racer parts market: the owner sets a
// price (or back to free), a PRICED universe's data is readable only by the
// owner, its buyers and mods, and a buy is ONE transaction — buyer pays,
// seller receives, receipt written. The database rules enforce every coin.
export const MAX_PRICE = 100000;

export async function listMine() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "universes"), where("ownerUid", "==", uid)));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return items;
}

export async function listBought() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "uniOwned"), where("uid", "==", uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function ownsUniverse(u) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  if (u.ownerUid === uid) return true;
  try { return (await getDoc(doc(db, "uniOwned", u.id + "_" + uid))).exists(); } catch { return false; }
}

// sell it (price > 0) or make it free again — also pins ownerDoc so uploads
// from before the market can be sold too
export async function setSale(id, price, username) {
  price = Math.max(0, Math.min(MAX_PRICE, Math.floor(Number(price) || 0)));
  await updateDoc(doc(db, "universes", id), {
    listed: price > 0, price, ownerDoc: userDocId(username)
  });
}

export async function buyUniverse(u, buyerUsername) {
  const uid = auth.currentUser?.uid;
  if (!uid || !buyerUsername) throw new Error("Log in to buy.");
  if (u.ownerUid === uid) throw new Error("That's already yours — you shared it.");
  const price = Number(u.price) || 0;
  if (!u.listed || price <= 0) throw new Error("That one isn't for sale.");
  if (!u.ownerDoc) throw new Error("This upload is too old to buy — ask the owner to re-set its price.");
  const buyerRef = doc(db, "users", userDocId(buyerUsername));
  const sellerRef = doc(db, "users", u.ownerDoc);
  const receiptRef = doc(db, "uniOwned", u.id + "_" + uid);
  await runTransaction(db, async (t) => {
    const b = await t.get(buyerRef);
    const s = await t.get(sellerRef);
    if (!b.exists()) throw new Error("Your account wasn't found.");
    if (!s.exists()) throw new Error("The seller's account wasn't found.");
    const coins = Number(b.data().coins) || 0;
    if (coins < price) throw new Error(`Not enough coins — that costs ◎${price} and you have ◎${coins}.`);
    t.update(buyerRef, { coins: coins - price });
    t.update(sellerRef, { coins: (Number(s.data().coins) || 0) + price });
    t.set(receiptRef, { item: u.id, uid, user: buyerUsername, buyerDoc: userDocId(buyerUsername), price, at: Date.now() });
  });
}

// ---- owner / moderator -----------------------------------------------------
export async function deleteUniverse(u) {
  const n = Math.min(Number(u.parts) || 0, MAX_PARTS);
  for (let i = 0; i < n; i++) {
    await deleteDoc(doc(db, "universeParts", u.id + "_" + i)).catch(() => {});
  }
  await deleteDoc(doc(db, "universes", u.id));
}

export async function editDescription(id, description) {
  await updateDoc(doc(db, "universes", id), { description: String(description || "").trim().slice(0, MAX_DESC) });
}

export async function reportUniverse(u, by, reason) {
  await addDoc(collection(db, "reports"), {
    game: "universe:" + u.id, title: u.name || ("Universe #" + u.seed), owner: u.owner,
    by, reason: String(reason).trim().slice(0, 300), at: serverTimestamp()
  });
}

// ---- display helpers ---------------------------------------------------------
// Universe time, exactly the way the game's fmt_time() shows it
// (1 physics step = 2880 universe-seconds).
const COS_PER_TICK = 2880, DAY = 86400, YEAR = Math.floor(365.25 * DAY);
const pad = (n, w) => String(n).padStart(w, "0");
export function fmtAge(ticks) {
  let s = Math.floor(Math.max(0, Number(ticks) || 0) * COS_PER_TICK);
  const y = Math.floor(s / YEAR); s -= y * YEAR;
  const d = Math.floor(s / DAY); s -= d * DAY;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (y) return `${y}y ${pad(d, 3)}d`;
  if (d) return `${d}d ${pad(h, 2)}h`;
  if (h) return `${h}h ${pad(m, 2)}m`;
  return `${m}m ${pad(s, 2)}s`;
}

export const displayName = (u) => cleanName(u.name) || ("Universe #" + u.seed);

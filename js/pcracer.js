// pcracer.js — PC Racer on the site: leaderboards (pcrTimes) and the parts
// market (.pcrpart files — bodies, rims and tires made in the game's garage).
// Parts are LOOKS ONLY: coins never buy speed, so the boards stay honest.
//
// THE PROMISE (same idea as universes/packs): a part is DATA.
//   1. The SEAL — SHA-256 (first 32 hex) of the part object's JSON exactly as
//      it sits in the file. The site verifies the literal bytes between the
//      braces, so it never depends on how the game happened to format JSON.
//   2. The SHAPE — kind, canvas sizes, pixel coordinates and colors, name
//      lengths and counts are all checked here before anything is stored.
//   3. The GAME — checks it all again on import and only ever reads pixels
//      and labels out of it. The worst a bad file can do is fail to import.
//
// STORAGE (like sprite packs): pcrParts/{id} is the card (+ seal and a
// thumbnail drawn here from the part's own pixels); pcrPartParts/{id}_{n}
// holds the file text, ≤ 200 KB per chunk, max 2 (the 400 KB file cap).
// The card starts ready:false and only shows once every chunk has landed.
//
// SELLING: the owner lists the part free or for coins. A PRICED part's text
// is readable only by the owner and its buyers (the thumbnail is the public
// preview); buying is ONE transaction — buyer pays, seller receives, and a
// receipt (pcrOwned/{partId}_{buyerUid}) unlocks the download. The database
// rules enforce every coin of that, not this file.

import { db } from "./firebase.js";
import { auth, userDocId } from "./auth.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter,
  serverTimestamp, increment, updateDoc, addDoc, setDoc, deleteDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const FORMAT = "PCRPART1";
export const PART = 200000;          // characters per chunk
export const MAX_PARTS = 2;          // 400 KB file cap (the game's own limit)
export const MAX_DESC = 500;
export const MAX_PRICE = 100000;
const MAX_THUMB = 200000;
const WRITE_TIMEOUT = 60000;
const PAGE = 24;

export const KINDS = { body: "🚗 Body", rim: "⚙ Rim", tire: "⬤ Tire" };
const DRIVES = ["fwd", "rwd", "awd"];
const PROFILES = ["low", "mid", "tall"];

// The boards the game submits times for — a FIXED list, pinned in the rules
// too, so no junk boards can ever exist. 3 drag + 20 weight pull + 15 track.
export const DRAG_TRACKS = [
  ["quarter", "¼ mile · 1320 ft"],
  ["eighth", "⅛ mile · 660 ft"],
  ["thousand", "1000 ft"],
  ["half", "½ mile · 2640 ft"],
  ["mile", "1 mile · 5280 ft"]
];
export const WP_CLASSES = ["street", "sportsman", "limited", "prostock", "unlimited"];
export const WP_FEET = [[660, "⅛ mile"], [1320, "¼ mile"], [2640, "½ mile"], [5280, "1 mile"]];
export const CIRCUITS = [
  ["lakeside_oval", "Lakeside Oval"],
  ["redline_circuit", "Redline Circuit"],
  ["grand_prix_circuit", "Grand Prix Circuit"]
];
export const TRACK_LAPS = [1, 2, 3, 5, 10];

// ---- the seal ---------------------------------------------------------------
export async function sha32(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// The literal text of the "part" object inside the raw file — a balanced-brace
// scan that knows about strings, so the seal never depends on JSON formatting.
export function partSlice(text) {
  const key = text.indexOf('"part"');
  if (key < 0) return null;
  const start = text.indexOf("{", key + 6);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

// ---- checking a file --------------------------------------------------------
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);
const isB64 = (s) => typeof s === "string" && s.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(s);
const rgbOk = (v) => Array.isArray(v) && v.length === 3 && v.every(c => Number.isInteger(c) && c >= 0 && c <= 255);
const xyOk = (v, w, h) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)
  && v[0] >= 0 && v[0] < w && v[1] >= 0 && v[1] < h;

function pixelsOk(px, w, h, max) {
  if (!px || typeof px !== "object" || Array.isArray(px)) return false;
  const keys = Object.keys(px);
  if (keys.length < 1 || keys.length > max) return false;
  for (const k of keys) {
    const m = /^(\d{1,3}),(\d{1,3})$/.exec(k);
    if (!m || Number(m[1]) >= w || Number(m[2]) >= h) return false;
    if (!rgbOk(px[k])) return false;
  }
  return true;
}

// text of a .pcrpart file → { text, file, seal } (throws a friendly Error)
export async function checkPart(text) {
  if (typeof text !== "string" || text.length > PART * MAX_PARTS) throw new Error("That part file is too big to share here (400 KB max).");
  let f;
  try { f = JSON.parse(text); } catch { throw new Error("That isn't a PC Racer part file."); }
  if (!f || typeof f !== "object" || f.format !== FORMAT) throw new Error("That isn't a PC Racer part file.");
  if (!(f.kind in KINDS)) throw new Error("That part file is damaged (unknown kind).");
  const p = f.part;
  if (!p || typeof p !== "object") throw new Error("That part file is missing its part.");
  if (typeof p.name !== "string" || p.name.trim().length < 1 || p.name.length > 40) throw new Error("That part's name is missing or too long.");

  if (f.kind === "body") {
    if (p.w !== 160 || p.h !== 64) throw new Error("A body's canvas must be 160×64.");
    if (!pixelsOk(p.pixels, 160, 64, 12000)) throw new Error("That body's pixels are damaged.");
    if (!xyOk(p.front, 160, 64) || !xyOk(p.rear, 160, 64)) throw new Error("That body's wheel positions are damaged.");
    if (!DRIVES.includes(p.drive)) throw new Error("That body has an odd drive type.");
  } else if (f.kind === "rim") {
    if (!Number.isInteger(p.diameter) || p.diameter < 15 || p.diameter > 22) throw new Error("A rim's diameter must be 15–22.");
    if (!Number.isInteger(p.spokes) || p.spokes < 0 || p.spokes > 32) throw new Error("That rim has odd settings.");
    if (!rgbOk(p.base)) throw new Error("That rim's base color is damaged.");
    if (!pixelsOk(p.pixels, 128, 128, 5000)) throw new Error("That rim's pixels are damaged.");
  } else {
    if (!Number.isInteger(p.diameter) || p.diameter < 10 || p.diameter > 40) throw new Error("That tire has an odd diameter.");
    if (!PROFILES.includes(p.profile)) throw new Error("That tire has an odd profile.");
    if (!rgbOk(p.base)) throw new Error("That tire's base color is damaged.");
    if (!pixelsOk(p.pixels, 128, 128, 5000)) throw new Error("That tire's pixels are damaged.");
  }

  if (typeof f.seal !== "string" || f.seal.length !== 32) throw new Error("That part file is missing its seal.");
  const raw = partSlice(text);
  if (!raw || (await sha32(raw)) !== f.seal) {
    throw new Error("The seal is broken — this file was edited or damaged. Export it again from the game's garage.");
  }
  return { text, file: f, seal: f.seal };
}

// ---- the card picture, drawn from the part's own pixels ---------------------
export function drawThumb(file, canvas) {
  const W = 240, H = 150;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#101522"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#1c2433"; g.fillRect(0, H - 26, W, 26);
  const p = file.part;
  const entries = Object.entries(p.pixels || {});
  // where the drawing actually lives
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (const [k] of entries) {
    const [x, y] = k.split(",").map(Number);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) { minX = minY = 0; maxX = maxY = 1; }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const s = Math.max(1, Math.floor(Math.min((W - 20) / bw, (H - 40) / bh)));
  const ox = Math.floor((W - bw * s) / 2), oy = Math.floor((H - 26 - bh * s) / 2) + 6;
  if (file.kind !== "body" && rgbOk(p.base)) {
    // rims and tires: show the base color as a disc behind the pixels
    g.fillStyle = `rgb(${p.base[0]},${p.base[1]},${p.base[2]})`;
    g.beginPath();
    g.arc(W / 2, oy + (bh * s) / 2, Math.min(bw, bh) * s * 0.55, 0, Math.PI * 2);
    g.fill();
  }
  for (const [k, v] of entries) {
    if (!rgbOk(v)) continue;
    const [x, y] = k.split(",").map(Number);
    g.fillStyle = `rgb(${v[0]},${v[1]},${v[2]})`;
    g.fillRect(ox + (x - minX) * s, oy + (y - minY) * s, s, s);
  }
  const url = canvas.toDataURL("image/png");
  const b64 = url.slice(url.indexOf(",") + 1);
  return b64.length <= MAX_THUMB ? b64 : "";
}

// ---- uploading --------------------------------------------------------------
function withTimeout(promise, what) {
  let t;
  const timer = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`the connection stalled while sending ${what} — check your internet and try again`)), WRITE_TIMEOUT);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

export async function uploadPart(checked, thumb, description, username, onProgress = () => {}) {
  const uid = auth.currentUser?.uid;
  if (!uid || !username) throw new Error("Log in to share a part.");
  const { text, file, seal } = checked;
  description = String(description || "").trim().slice(0, MAX_DESC);
  const chunks = [];
  for (let i = 0; i < text.length; i += PART) chunks.push(text.slice(i, i + PART));
  if (chunks.length < 1 || chunks.length > MAX_PARTS) throw new Error("That part file is too big to share here.");
  const ref = doc(collection(db, "pcrParts"));
  const total = chunks.length + 2;
  onProgress(0, total);
  await withTimeout(setDoc(ref, {
    format: FORMAT, kind: file.kind, name: clean(file.part.name, 40) || "Part",
    thumb, seal, parts: chunks.length, size: text.length, description,
    owner: username, ownerUid: uid, ownerDoc: userDocId(username),
    listed: false, price: 0, ready: false,
    likes: 0, dislikes: 0, downloads: 0, createdAt: serverTimestamp()
  }), "the part's card");
  onProgress(1, total);
  let sent = 0;
  try {
    for (let n = 0; n < chunks.length; n++) {
      await withTimeout(setDoc(doc(db, "pcrPartParts", ref.id + "_" + n),
        { part: ref.id, n, data: chunks[n], ownerUid: uid }), `piece ${n + 1} of ${chunks.length}`);
      sent = n + 1;
      onProgress(n + 2, total);
    }
    await withTimeout(updateDoc(ref, { ready: true }), "the finishing touch");
    onProgress(total, total);
  } catch (err) {
    for (let n = 0; n < sent; n++) deleteDoc(doc(db, "pcrPartParts", ref.id + "_" + n)).catch(() => {});
    deleteDoc(ref).catch(() => {});
    throw err;
  }
  return ref.id;
}

// ---- the market shelf -------------------------------------------------------
export async function listParts(order = "createdAt", after = null) {
  const parts = [collection(db, "pcrParts"), orderBy(order, "desc")];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE));
  const snap = await getDocs(query(...parts));
  // the market shows what sellers chose to show: listed, finished uploads
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.listed === true && p.ready !== false);
  return { items, last: snap.docs[snap.docs.length - 1] || null, more: snap.docs.length === PAGE };
}

export async function listMine() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "pcrParts"), where("ownerUid", "==", uid)));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return items;
}

export async function listBought() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "pcrOwned"), where("uid", "==", uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPart(id) {
  const snap = await getDoc(doc(db, "pcrParts", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function ownsPart(p) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  if (p.ownerUid === uid) return true;
  try { return (await getDoc(doc(db, "pcrOwned", p.id + "_" + uid))).exists(); } catch { return false; }
}

// ---- buying: ONE transaction — pay, receive, receipt ------------------------
export async function buyPart(p, buyerUsername) {
  const uid = auth.currentUser?.uid;
  if (!uid || !buyerUsername) throw new Error("Log in to buy a part.");
  if (p.ownerUid === uid) throw new Error("That's already yours — you made it.");
  const price = Number(p.price) || 0;
  if (!p.listed || price <= 0) throw new Error("That part isn't for sale.");
  const buyerRef = doc(db, "users", userDocId(buyerUsername));
  const sellerRef = doc(db, "users", p.ownerDoc);
  const receiptRef = doc(db, "pcrOwned", p.id + "_" + uid);
  await runTransaction(db, async (t) => {
    const b = await t.get(buyerRef);
    const s = await t.get(sellerRef);
    if (!b.exists()) throw new Error("Your account wasn't found.");
    if (!s.exists()) throw new Error("The seller's account wasn't found.");
    const coins = Number(b.data().coins) || 0;
    if (coins < price) throw new Error(`Not enough coins — that costs ◎${price} and you have ◎${coins}.`);
    t.update(buyerRef, { coins: coins - price });
    t.update(sellerRef, { coins: (Number(s.data().coins) || 0) + price });
    t.set(receiptRef, { part: p.id, uid, user: buyerUsername, buyerDoc: userDocId(buyerUsername), price, at: Date.now() });
  });
}

// ---- downloading ------------------------------------------------------------
export async function fetchPartText(p) {
  const n = Number(p.parts) || 0;
  if (n < 1 || n > MAX_PARTS) throw new Error("That upload is incomplete.");
  const chunks = [];
  for (let i = 0; i < n; i++) {
    const s = await getDoc(doc(db, "pcrPartParts", p.id + "_" + i));
    if (!s.exists() || typeof s.data().data !== "string") throw new Error("That upload is incomplete.");
    chunks.push(s.data().data);
  }
  const text = chunks.join("");
  const raw = partSlice(text);
  if (!raw || (await sha32(raw)) !== p.seal) throw new Error("This upload's seal doesn't match — it may be damaged.");
  return text;
}

export async function downloadPart(p) {
  const text = await fetchPartText(p);
  const safe = (clean(p.name, 40) || "part").replace(/[^A-Za-z0-9 _-]/g, "_");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = `${safe}.pcrpart`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  updateDoc(doc(db, "pcrParts", p.id), { downloads: increment(1) }).catch(() => {});
}

// ---- owner / moderator ------------------------------------------------------
export async function setListing(id, listed, price, description) {
  price = Math.max(0, Math.min(MAX_PRICE, Math.floor(Number(price) || 0)));
  await updateDoc(doc(db, "pcrParts", id), {
    listed: !!listed, price, description: String(description || "").trim().slice(0, MAX_DESC)
  });
}

export async function deletePart(p) {
  const n = Math.min(Number(p.parts) || 0, MAX_PARTS);
  for (let i = 0; i < n; i++) await deleteDoc(doc(db, "pcrPartParts", p.id + "_" + i)).catch(() => {});
  await deleteDoc(doc(db, "pcrParts", p.id));
}

export async function reportPart(p, by, reason) {
  await addDoc(collection(db, "reports"), {
    game: "pcrpart:" + p.id, title: p.name || "PC Racer part", owner: p.owner,
    by, reason: String(reason).trim().slice(0, 300), at: serverTimestamp()
  });
}

// ---- leaderboards -----------------------------------------------------------
export async function loadTimes(trackId, n = 25) {
  const snap = await getDocs(query(
    collection(db, "pcrTimes", trackId, "entries"), orderBy("ms", "asc"), limit(n)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function strikeTime(trackId, entryId) {   // mods only (the rules check)
  await deleteDoc(doc(db, "pcrTimes", trackId, "entries", entryId));
}

// 9482 → "9.482s" · 62345 → "1:02.345"
export function fmtMs(ms) {
  ms = Math.max(0, Math.floor(Number(ms) || 0));
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), f = ms % 1000;
  return m ? `${m}:${String(s).padStart(2, "0")}.${String(f).padStart(3, "0")}`
           : `${s}.${String(f).padStart(3, "0")}s`;
}

export const thumbOk = (b64) => b64 === "" || (isB64(b64) && b64.length <= MAX_THUMB && atob(b64.slice(0, 8)).startsWith("\x89PNG"));
export const displayName = (p) => clean(p.name, 40) || "Part";

// packs.js — Emergence sprite packs: the .emergencepack files players make in
// the game (main menu → SPRITE PACKS) and share here. Like texture packs:
// they change how planet objects, creatures, hand items, buildings and
// starting ships LOOK, never the game.
//
// THE PROMISE (same idea as universes.js): a pack is DATA.
//   1. The SEAL — SHA-256 over the file's exact text (first 32 hex). Edited or
//      damaged in transit → refused here AND in the game.
//   2. The SHAPE — every object and ship look is checked here: canvas sizes,
//      pixel data lengths, names, the lists' sizes.
//   3. The GAME — checks it all again on import and only ever reads pixels and
//      labels out of it. The worst a bad file can do is fail to import.
//
// STORAGE (like universes): packs/{id} is the card (+ seal and a thumbnail
// drawn here from the pack's own pixels); packParts/{id}_{n} holds the file
// text, ≤ 200 KB per part. The card starts ready:false and only shows once
// every part has landed.

import { db } from "./firebase.js";
import { auth, userDocId } from "./auth.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter,
  serverTimestamp, increment, updateDoc, addDoc, setDoc, deleteDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const FORMAT = "EMERGENCEPACK1";
export const PART = 200000;          // characters per chunk (game: PART in sprite_packs.py)
export const MAX_PARTS = 32;         // ~6 MB (the game's own limit for a pack file)
export const MAX_DESC = 500;
const MAX_THUMB = 200000;
const WRITE_TIMEOUT = 60000;
const PAGE = 24;
const CANVASES = ["16x16", "24x24", "16x32", "32x32", "32x48", "24x16", "32x24", "48x32"];
const TEMPERS = ["passive", "neutral", "hostile"];
const HAND_SLOTS = ["hand", "axe", "pick", "shovel", "spear", "drill", "blaster"];
const BUILD_SLOTS = ["campfire", "shelter", "storage", "lamp", "wall", "beacon", "hut"];
const SIZES = ["tiny", "small", "medium", "large", "huge"];
const COMMON = ["rare", "normal", "common"];
const TYPES = ["any", "jungle", "ocean", "desert", "rocky", "ice", "lava", "toxic", "barren"];
const KINDS = ["pship", "probe", "colony", "hauler", "fighter", "frigate", "dread", "harvester", "courier", "escape"];
const CHARS = "0123456789abcdefghijklmnopqrstuv";
// the game's ship palette (ship_designer.py PALETTE); 1-3 follow the agency colour - shown here in light blue
const TINT = [120, 200, 255];
const PAL = [null, "t1", "t2", "t3", [245, 245, 250], [180, 185, 195], [120, 125, 140], [65, 68, 80], [22, 22, 30],
  [220, 60, 55], [255, 150, 60], [255, 220, 90], [150, 220, 80], [60, 160, 90], [50, 170, 170], [110, 220, 255],
  [60, 110, 220], [35, 50, 110], [140, 80, 200], [240, 120, 190], [130, 85, 55], [210, 180, 130], [255, 190, 110],
  [255, 245, 200]];

export async function sealOf(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);
const isB64 = (s) => typeof s === "string" && s.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(s);

function palColour(i) {
  const v = PAL[i];
  if (!v) return null;
  if (v === "t1") return TINT.map(c => Math.floor(c * 0.45));
  if (v === "t2") return TINT;
  if (v === "t3") return TINT.map(c => Math.floor(c + (255 - c) * 0.5));
  return v;
}

// text of a .emergencepack file → { text, pack, seal } (throws a friendly Error)
export async function checkPack(text) {
  if (typeof text !== "string" || text.length > PART * MAX_PARTS) throw new Error("That pack is too big to share here (6 MB max).");
  let p;
  try { p = JSON.parse(text); } catch { throw new Error("That isn't a sprite pack file."); }
  if (!p || typeof p !== "object" || p.format !== FORMAT) throw new Error("That isn't an Emergence sprite pack.");
  if (typeof p.id !== "string" || !/^[0-9a-zA-Z_-]{4,40}$/.test(p.id)) throw new Error("That pack file is damaged.");
  if (typeof p.name !== "string" || p.name.length > 40) throw new Error("That pack's name is too long.");
  const objs = Array.isArray(p.objects) ? p.objects : [];
  const ships = Array.isArray(p.ships) ? p.ships : [];
  const crits = Array.isArray(p.creatures) ? p.creatures : [];
  const hand = Array.isArray(p.hand) ? p.hand : [];
  const builds = Array.isArray(p.builds) ? p.builds : [];
  if ([objs, ships, crits, hand, builds].some(l => l.length > 300)) throw new Error("That pack has too many pieces (300 of each max).");
  const pixelsOk = (o) => o && CANVASES.includes(`${o.w}x${o.h}`) && isB64(o.rgba) && atob(o.rgba).length === o.w * o.h * 4;
  for (const o of crits) {
    if (!pixelsOk(o)) throw new Error("A creature's pixels are damaged.");
    if (typeof o.name !== "string" || o.name.length > 30) throw new Error("A creature's name is too long.");
    if (!SIZES.includes(o.size) || !COMMON.includes(o.common) || !TEMPERS.includes(o.temper)) throw new Error("A creature has odd settings.");
    if (!Array.isArray(o.where) || o.where.some(t => !TYPES.includes(t))) throw new Error("A creature has odd settings.");
  }
  for (const o of hand) {
    if (!pixelsOk(o) || !HAND_SLOTS.includes(o.slot)) throw new Error("A hand item is damaged.");
  }
  for (const o of builds) {
    if (!pixelsOk(o) || !BUILD_SLOTS.includes(o.slot)) throw new Error("A building is damaged.");
  }
  for (const o of objs) {
    if (!o || !CANVASES.includes(`${o.w}x${o.h}`)) throw new Error("A world object has an odd canvas size.");
    if (!isB64(o.rgba) || atob(o.rgba).length !== o.w * o.h * 4) throw new Error("A world object's pixels are damaged.");
    if (typeof o.name !== "string" || o.name.length > 30) throw new Error("A world object's name is too long.");
    if (!SIZES.includes(o.size) || !COMMON.includes(o.common)) throw new Error("A world object has odd settings.");
    if (!Array.isArray(o.where) || o.where.some(t => !TYPES.includes(t))) throw new Error("A world object has odd settings.");
  }
  for (const s of ships) {
    if (!s || !KINDS.includes(s.kind) || typeof s.px !== "string" || s.px.length !== 576 ||
        [...s.px].some(c => CHARS.indexOf(c) < 0 || CHARS.indexOf(c) >= PAL.length)) {
      throw new Error("A ship look is damaged.");
    }
  }
  if (!objs.length && !ships.length && !crits.length && !hand.length && !builds.length) {
    throw new Error("That pack is empty - add some world objects, creatures, hand items, buildings or ship looks first.");
  }
  return { text, pack: p, seal: await sealOf(text) };
}

// A picture for the card, drawn from the pack's own pixels: objects standing on a strip of ground, ships above.
export function drawThumb(pack, canvas) {
  const W = 240, H = 150;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#304060"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#3c6a3a"; g.fillRect(0, H - 24, W, 24);
  const objs = [...(pack.objects || []), ...(pack.creatures || []), ...(pack.builds || []), ...(pack.hand || [])].slice(0, 8);
  let x = 8;
  for (const o of objs) {
    const img = g.createImageData(o.w, o.h);
    const raw = atob(o.rgba);
    for (let i = 0; i < raw.length; i++) img.data[i] = raw.charCodeAt(i);
    const tmp = document.createElement("canvas");
    tmp.width = o.w; tmp.height = o.h;
    tmp.getContext("2d").putImageData(img, 0, 0);
    const s = Math.max(1, Math.floor(Math.min(80 / o.h, 40 / o.w)));
    if (x + o.w * s > W) break;
    g.drawImage(tmp, x, H - 18 - o.h * s, o.w * s, o.h * s);
    x += o.w * s + 6;
  }
  let sx = 8;
  for (const sh of (pack.ships || []).slice(0, 6)) {
    for (let i = 0; i < 576; i++) {
      const c = palColour(CHARS.indexOf(sh.px[i]));
      if (!c) continue;
      g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      g.fillRect(sx + (i % 24) * 1.5, 6 + Math.floor(i / 24) * 1.5, 1.5, 1.5);
    }
    sx += 40;
  }
  const url = canvas.toDataURL("image/png");
  const b64 = url.slice(url.indexOf(",") + 1);
  return b64.length <= MAX_THUMB ? b64 : "";
}

function withTimeout(promise, what) {
  let t;
  const timer = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`the connection stalled while sending ${what} — check your internet and try again`)), WRITE_TIMEOUT);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

export async function uploadPack(checked, thumb, description, username, onProgress = () => {}) {
  const uid = auth.currentUser?.uid;
  if (!uid || !username) throw new Error("Log in to share a pack.");
  const { text, pack, seal } = checked;
  description = String(description || "").trim().slice(0, MAX_DESC);
  const parts = [];
  for (let i = 0; i < text.length; i += PART) parts.push(text.slice(i, i + PART));
  if (parts.length < 1 || parts.length > MAX_PARTS) throw new Error("That pack is too big to share here.");
  const ref = doc(collection(db, "packs"));
  const total = parts.length + 2;
  onProgress(0, total);
  await withTimeout(setDoc(ref, {
    format: FORMAT, name: clean(pack.name, 40) || "Sprite pack", author: clean(pack.author, 40), packId: pack.id,
    objects: ["objects", "creatures", "hand", "builds"].reduce((n, k) => n + (pack[k] || []).length, 0),
    ships: (pack.ships || []).length, thumb, seal,
    parts: parts.length, size: text.length, description,
    owner: username, ownerUid: uid, ownerDoc: userDocId(username),
    listed: false, price: 0, ready: false,
    likes: 0, dislikes: 0, downloads: 0, createdAt: serverTimestamp()
  }), "the pack's card");
  onProgress(1, total);
  let sent = 0;
  try {
    for (let n = 0; n < parts.length; n++) {
      await withTimeout(setDoc(doc(db, "packParts", ref.id + "_" + n),
        { pack: ref.id, n, data: parts[n], ownerUid: uid }), `part ${n + 1} of ${parts.length}`);
      sent = n + 1;
      onProgress(n + 2, total);
    }
    await withTimeout(updateDoc(ref, { ready: true }), "the finishing touch");
    onProgress(total, total);
  } catch (err) {
    for (let n = 0; n < sent; n++) deleteDoc(doc(db, "packParts", ref.id + "_" + n)).catch(() => {});
    deleteDoc(ref).catch(() => {});
    throw err;
  }
  return ref.id;
}

export async function listPacks(order = "createdAt", after = null) {
  const parts = [collection(db, "packs"), orderBy(order, "desc")];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE));
  const snap = await getDocs(query(...parts));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.unlisted && p.ready !== false);
  return { items, last: snap.docs[snap.docs.length - 1] || null, more: snap.docs.length === PAGE };
}

export async function getPack(id) {
  const snap = await getDoc(doc(db, "packs", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchPackText(p) {
  const n = Number(p.parts) || 0;
  if (n < 1 || n > MAX_PARTS) throw new Error("That upload is incomplete.");
  const chunks = [];
  for (let i = 0; i < n; i++) {
    let s;
    try { s = await getDoc(doc(db, "packParts", p.id + "_" + i)); }
    catch (err) {
      if (String(err.code || err.message || "").includes("permission")) {
        throw new Error("This pack is sold for coins — buy it first, then the download is yours forever.");
      }
      throw err;
    }
    if (!s.exists() || typeof s.data().data !== "string") throw new Error("That upload is incomplete.");
    chunks.push(s.data().data);
  }
  const text = chunks.join("");
  if ((await sealOf(text)) !== p.seal) throw new Error("This upload's seal doesn't match — it may be damaged.");
  return text;
}

export async function downloadPack(p) {
  const text = await fetchPackText(p);
  const safe = (clean(p.name, 40) || "Sprite pack").replace(/[^A-Za-z0-9 _-]/g, "_");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = `${safe}.emergencepack`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  updateDoc(doc(db, "packs", p.id), { downloads: increment(1) }).catch(() => {});
}

// ---- the market -------------------------------------------------------------
// Same as universes and the PC Racer parts market: the owner sets a price (or
// back to free), a PRICED pack's data is readable only by the owner, buyers
// and mods, and a buy is ONE coin-conserving transaction with a receipt
// (packOwned/{packId}_{buyerUid}). The database rules enforce every coin.
export const MAX_PRICE = 100000;

export async function listMine() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "packs"), where("ownerUid", "==", uid)));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return items;
}

export async function listBought() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "packOwned"), where("uid", "==", uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function ownsPack(p) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  if (p.ownerUid === uid) return true;
  try { return (await getDoc(doc(db, "packOwned", p.id + "_" + uid))).exists(); } catch { return false; }
}

export async function setSale(id, price, username) {
  price = Math.max(0, Math.min(MAX_PRICE, Math.floor(Number(price) || 0)));
  await updateDoc(doc(db, "packs", id), {
    listed: price > 0, price, ownerDoc: userDocId(username)
  });
}

export async function buyPack(p, buyerUsername) {
  const uid = auth.currentUser?.uid;
  if (!uid || !buyerUsername) throw new Error("Log in to buy.");
  if (p.ownerUid === uid) throw new Error("That's already yours — you shared it.");
  const price = Number(p.price) || 0;
  if (!p.listed || price <= 0) throw new Error("That one isn't for sale.");
  if (!p.ownerDoc) throw new Error("This upload is too old to buy — ask the owner to re-set its price.");
  const buyerRef = doc(db, "users", userDocId(buyerUsername));
  const sellerRef = doc(db, "users", p.ownerDoc);
  const receiptRef = doc(db, "packOwned", p.id + "_" + uid);
  await runTransaction(db, async (t) => {
    const b = await t.get(buyerRef);
    const s = await t.get(sellerRef);
    if (!b.exists()) throw new Error("Your account wasn't found.");
    if (!s.exists()) throw new Error("The seller's account wasn't found.");
    const coins = Number(b.data().coins) || 0;
    if (coins < price) throw new Error(`Not enough coins — that costs ◎${price} and you have ◎${coins}.`);
    t.update(buyerRef, { coins: coins - price });
    t.update(sellerRef, { coins: (Number(s.data().coins) || 0) + price });
    t.set(receiptRef, { item: p.id, uid, user: buyerUsername, buyerDoc: userDocId(buyerUsername), price, at: Date.now() });
  });
}

export async function deletePack(p) {
  const n = Math.min(Number(p.parts) || 0, MAX_PARTS);
  for (let i = 0; i < n; i++) await deleteDoc(doc(db, "packParts", p.id + "_" + i)).catch(() => {});
  await deleteDoc(doc(db, "packs", p.id));
}

export async function reportPack(p, by, reason) {
  await addDoc(collection(db, "reports"), {
    game: "pack:" + p.id, title: p.name || "Sprite pack", owner: p.owner,
    by, reason: String(reason).trim().slice(0, 300), at: serverTimestamp()
  });
}

export const thumbOk = (b64) => b64 === "" || (isB64(b64) && b64.length <= MAX_THUMB && atob(b64.slice(0, 8)).startsWith("\x89PNG"));
export const displayName = (p) => clean(p.name, 40) || "Sprite pack";

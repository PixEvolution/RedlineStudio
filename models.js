// models.js — reusable models (groups of objects + their scripts), the player's
// inventory, and the market. Just like Roblox models: save a group, keep it in
// your inventory, insert it into any game fully editable, sell it for free or coins.

import { db } from "./firebase.js";
import { userDocId } from "./auth.js";
import {
  collection, doc, addDoc, getDocs, updateDoc, deleteDoc, getDoc,
  query, where, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MODELS = "models";

// Save a group of objects (with scripts) as a model in the owner's inventory.
export async function saveModel({ name, owner, objects }) {
  if (!name || !name.trim()) throw new Error("Your model needs a name.");
  if (name.length > 30) throw new Error("Model name must be 30 characters or less.");
  if (!objects || objects.length === 0) throw new Error("Select at least one object to save.");
  const ref = await addDoc(collection(db, MODELS), {
    version: 1,
    name: name.trim(),
    owner,
    creator: owner,               // original creator, kept through sales
    objects: JSON.parse(JSON.stringify(objects)),
    listed: false,
    price: 0,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

// The player's inventory.
export async function listMyModels(owner) {
  const q = query(collection(db, MODELS), where("owner", "==", owner));
  const snap = await getDocs(q);
  const models = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  models.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return models;
}

// Everything for sale on the market.
export async function listMarket() {
  const q = query(collection(db, MODELS), where("listed", "==", true));
  const snap = await getDocs(q);
  const models = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  models.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return models;
}

// List / unlist on the market. price 0 = free.
export async function setListing(modelId, listed, price = 0) {
  price = Math.max(0, Math.floor(Number(price) || 0));
  await updateDoc(doc(db, MODELS, modelId), { listed: !!listed, price });
}

export async function deleteModel(modelId) {
  await deleteDoc(doc(db, MODELS, modelId));
}

// Get a model (free) or buy it (coins move from buyer to seller).
// Either way the buyer receives their own fully-editable copy in inventory.
export async function acquireModel(modelId, buyer) {
  const modelRef = doc(db, MODELS, modelId);

  const snap = await getDoc(modelRef);
  if (!snap.exists()) throw new Error("That model is gone.");
  const model = snap.data();
  if (!model.listed) throw new Error("That model isn't for sale anymore.");
  if (model.owner === buyer) throw new Error("That's already yours.");

  const copy = {
    version: 1,
    name: model.name,
    owner: buyer,
    creator: model.creator || model.owner,
    objects: model.objects,
    listed: false,
    price: 0,
    boughtFrom: model.owner,
    createdAt: serverTimestamp()
  };

  const price = Number(model.price) || 0;
  if (price === 0) {
    await addDoc(collection(db, MODELS), copy);
    return { paid: 0 };
  }

  const buyerRef = doc(db, "users", userDocId(buyer));
  const sellerRef = doc(db, "users", userDocId(model.owner));
  const newCopyRef = doc(collection(db, MODELS));

  await runTransaction(db, async (t) => {
    const bSnap = await t.get(buyerRef);
    const sSnap = await t.get(sellerRef);
    if (!bSnap.exists()) throw new Error("Your account wasn't found.");
    const bCoins = Number(bSnap.data().coins) || 0;
    if (bCoins < price) throw new Error(`Not enough coins — that costs ${price} and you have ${bCoins}.`);
    t.update(buyerRef, { coins: bCoins - price });
    if (sSnap.exists()) t.update(sellerRef, { coins: (Number(sSnap.data().coins) || 0) + price });
    t.set(newCopyRef, { ...copy, createdAt: null });
  });
  await updateDoc(newCopyRef, { createdAt: serverTimestamp() }).catch(() => {});
  return { paid: price };
}

// Insert a model's objects into a scene: fresh ids, de-clashed names,
// scripts carried over untouched (fully configurable, exactly like Roblox).
export function instantiateModel(model, scene) {
  const existing = new Set(scene.objects.map(o => o.name));
  const renames = {};
  const copies = JSON.parse(JSON.stringify(model.objects));

  for (const o of copies) {
    o.id = "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    if (existing.has(o.name)) {
      let n = 2;
      while (existing.has(o.name + n)) n++;
      renames[o.name] = o.name + n;
      o.name = o.name + n;
    }
    existing.add(o.name);
  }

  // Fix name references inside the model's own scripts (expressions are text,
  // so a simple word-boundary rename keeps everything wired together).
  if (Object.keys(renames).length > 0) {
    const fix = (str) => {
      let out = String(str);
      for (const [oldN, newN] of Object.entries(renames)) {
        out = out.replace(new RegExp(`\\b${oldN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), newN);
      }
      return out;
    };
    const fixStmts = (list) => (list || []).forEach(s => {
      for (const f of ["lhs", "value", "by", "cond", "times", "seconds", "target", "source"]) {
        if (typeof s[f] === "string") s[f] = fix(s[f]);
      }
      fixStmts(s.then); fixStmts(s.else); fixStmts(s.body);
    });
    for (const o of copies) {
      for (const ev of o.script || []) {
        if (typeof ev.source === "string") ev.source = fix(ev.source);
        fixStmts(ev.body);
      }
    }
  }

  scene.objects.push(...copies);
  return copies;
}

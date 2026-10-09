// mod.js — moderation, from the site itself.
//
// WHO IS A MOD: whoever has a doc in the /mods collection keyed by their
// Firebase Auth uid. That collection is console-only — the security rules let
// NOBODY write it from the site — so mod status is handed out exactly one
// way: the operator opens the Firebase console and creates the doc.
// (Your uid is shown in ⚙ Account. Collection "mods", doc id = the uid,
// any field, e.g. role: "owner". Delete the doc to un-mod.)
//
// WHAT A MOD CAN DO (enforced by the database rules, not just this file):
//   · read and resolve ⚑ reports
//   · unlist or re-rate any game — and touch nothing else on it
//   · delete any game, model, comment, forum thread or post
//   · strike a cheated high-score row
//   · erase an account's DATA (its login is then deleted in the console)

import { auth, authReady } from "./auth.js";
import { db } from "./firebase.js";
import {
  doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, limit,
  writeBatch, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cardFields } from "./games.js";
import { renderThumb } from "./cards.js";

let cached = null;

// "Is the logged-in player a moderator?" — one read, then cached for the page.
export async function amIMod() {
  await authReady;
  const u = auth.currentUser;
  if (!u) return false;
  if (cached !== null) return cached;
  try { cached = (await getDoc(doc(db, "mods", u.uid))).exists(); }
  catch { cached = false; }
  return cached;
}

// The narrow game powers: unlist/relist and re-rate (the rules allow a mod
// to change exactly these fields and nothing else).
export async function modUnlistGame(gameId, unlisted) {
  await updateDoc(doc(db, "games", gameId), { unlisted: !!unlisted });
  updateDoc(doc(db, "cards", gameId), { unlisted: !!unlisted }).catch(() => {});
}
export async function modRateGame(gameId, rating) {
  await updateDoc(doc(db, "games", gameId), { rating });
  updateDoc(doc(db, "cards", gameId), { rating }).catch(() => {});
}

// ---- THE ONE-TIME BACKFILL: give every existing game its light card.
// Mod-only (the rules let a mod create any card). Idempotent — running it
// twice just rewrites the same cards, counters included. Thumbs are rendered
// right here in the browser from each game's screen (or the game itself).
export async function backfillCards(onProgress = () => {}) {
  const snap = await getDocs(collection(db, "games"));
  const docs = snap.docs;
  let done = 0, batch = writeBatch(db), inBatch = 0;
  for (const d of docs) {
    const g = d.data();
    const src = (g.screen && g.screen.mode !== "none" && g.screen.objects?.length)
      ? g.screen.objects : (g.data?.objects || []);
    const thumb = renderThumb(src, Number(g.data?.w) || 480, Number(g.data?.h) || 360, 240, g.data?.display || "modern");
    batch.set(doc(db, "cards", d.id), {
      ...cardFields({
        title: g.title, owner: g.owner, ownerUid: g.ownerUid || null,
        description: g.description, price: g.price, casino: g.casino,
        unlisted: g.unlisted, seats: g.seats, rating: g.rating,
        data: g.data, screen: g.screen, thumb
      }),
      plays: Number(g.plays) || 0,
      likes: Number(g.likes) || 0,
      dislikes: Number(g.dislikes) || 0,
      ...(g.casino ? { pool: Number(g.pool) || 0 } : {}),
      createdAt: g.createdAt || null,
      updatedAt: g.updatedAt || null
    }, { merge: false });
    inBatch++;
    done++;
    if (inBatch >= 300) { await batch.commit(); batch = writeBatch(db); inBatch = 0; onProgress(done, docs.length); }
  }
  if (inBatch > 0) await batch.commit();
  onProgress(done, docs.length);
  return done;
}

// ⚑ reports: the mod inbox
export async function listReports(max = 100) {
  const snap = await getDocs(query(collection(db, "reports"), orderBy("at", "desc"), limit(max)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function resolveReport(reportId) {
  await deleteDoc(doc(db, "reports", reportId));
}

// 📨 the contact form's inbox (contact.html → /inbox): privacy and parent
// requests, appeals, copyright notices. Anyone can write one (even logged
// out); only mods read and clear them.
export async function listInbox(max = 200) {
  const snap = await getDocs(query(collection(db, "inbox"), orderBy("at", "desc"), limit(max)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function resolveInbox(msgId) {
  await deleteDoc(doc(db, "inbox", msgId));
}

// ---- THE ONE-TIME BRACKET MIGRATION: move every old PUBLIC age bracket
// (users docs from before Sept 25, 2026) into the private /ages/{uid}
// records, all at once, instead of waiting for each account to visit again.
// Idempotent and safe to re-run: it only touches users docs that still carry
// a public ageBracket. Accounts with no uid stamp (v1 accounts that never
// logged in under the new auth) can't be migrated — their uid isn't known —
// so they're counted and keep migrating themselves on their next visit.
export async function migrateBrackets(onProgress = () => {}) {
  const snap = await getDocs(collection(db, "users"));
  const carriers = snap.docs.filter(d => typeof d.data().ageBracket === "string");
  let moved = 0, cleared = 0, skipped = 0, done = 0;
  let batch = writeBatch(db), inBatch = 0;
  const flush = async () => { if (inBatch) { await batch.commit(); batch = writeBatch(db); inBatch = 0; } };
  for (const d of carriers) {
    const u = d.data();
    done++;
    if (!u.uid) { skipped++; continue; }           // pre-auth-v2 account — no uid to key on
    const privSnap = await getDoc(doc(db, "ages", u.uid));
    if (privSnap.exists()) {
      // the private record already exists — just clear the public copy if it matches
      if (privSnap.data().ageBracket === u.ageBracket) {
        batch.update(d.ref, { ageBracket: deleteField() });
        inBatch++; cleared++;
      } else skipped++;                            // mismatch — leave for a human look
    } else {
      batch.set(doc(db, "ages", u.uid), { ageBracket: u.ageBracket });
      batch.update(d.ref, { ageBracket: deleteField() });
      inBatch += 2; moved++;
    }
    if (inBatch >= 300) { await flush(); onProgress(done, carriers.length); }
  }
  await flush();
  onProgress(done, carriers.length);
  return { total: carriers.length, moved, cleared, skipped };
}

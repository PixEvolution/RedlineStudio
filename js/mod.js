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
  doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
}
export async function modRateGame(gameId, rating) {
  await updateDoc(doc(db, "games", gameId), { rating });
}

// ⚑ reports: the mod inbox
export async function listReports(max = 100) {
  const snap = await getDocs(query(collection(db, "reports"), orderBy("at", "desc"), limit(max)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function resolveReport(reportId) {
  await deleteDoc(doc(db, "reports", reportId));
}

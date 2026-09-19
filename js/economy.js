// economy.js — coins. Daily grant for now; premium/purchases come later.

import { db } from "./firebase.js";
import { userDocId } from "./auth.js";
import {
  doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const DAILY_COINS = 100;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function getCoins(username) {
  const snap = await getDoc(doc(db, "users", userDocId(username)));
  if (!snap.exists()) return 0;
  return Number(snap.data().coins) || 0;
}

// Returns { claimed, coins }
export async function claimDaily(username) {
  const ref = doc(db, "users", userDocId(username));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Account not found.");
  const data = snap.data();
  const coins = Number(data.coins) || 0;
  if (data.lastDaily === todayStr()) return { claimed: false, coins };
  const newCoins = coins + DAILY_COINS;
  await updateDoc(ref, { coins: newCoins, lastDaily: todayStr() });
  return { claimed: true, coins: newCoins };
}

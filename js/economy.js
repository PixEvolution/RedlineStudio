// economy.js — coins. Daily grant for now; premium/purchases come later.

import { db } from "./firebase.js";
import { userDocId } from "./auth.js";
import {
  doc, getDoc, updateDoc, runTransaction
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

// Move coins from one player to another (arcade fees, purchases, tips...).
// All-or-nothing: either the payer has the coins and both balances update, or nothing happens.
export async function transferCoins(from, to, amount) {
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) return;
  if (from === to) return;
  const fromRef = doc(db, "users", userDocId(from));
  const toRef = doc(db, "users", userDocId(to));
  await runTransaction(db, async (t) => {
    const fSnap = await t.get(fromRef);
    const tSnap = await t.get(toRef);
    if (!fSnap.exists()) throw new Error("Your account wasn't found.");
    const balance = Number(fSnap.data().coins) || 0;
    if (balance < amount) throw new Error(`Not enough coins — that costs 🪙 ${amount} and you have 🪙 ${balance}.`);
    t.update(fromRef, { coins: balance - amount });
    if (tSnap.exists()) t.update(toRef, { coins: (Number(tSnap.data().coins) || 0) + amount });
  });
}

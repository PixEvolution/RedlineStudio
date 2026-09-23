// casino.js — real-money side of casino machines (the odds live in
// casino-odds.js, in platform code no game script can touch).
//
// A machine is a published game with casino: true and a coin POOL on its doc.
// Money only ever moves player ↔ pool, atomically:
//   spinMachine  — bet in, winnings out, one transaction (the casino loop)
//   fundMachine  — the owner loads coins into the pool (bigger payouts)
//   collectPool  — the owner takes coins back out (the house's take)

import { db } from "./firebase.js";
import { userDocId } from "./auth.js";
import { rollMultiplier, settleSpin, clampBet } from "./casino-odds.js";
import {
  doc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GAMES = "games";

// One pull of the lever. Returns { mult, win, coins, pool }.
export async function spinMachine(gameId, username, bet) {
  bet = clampBet(bet);
  const userRef = doc(db, "users", userDocId(username));
  const gameRef = doc(db, GAMES, gameId);

  return runTransaction(db, async (tx) => {
    const [userSnap, gameSnap] = [await tx.get(userRef), await tx.get(gameRef)];
    if (!userSnap.exists()) throw new Error("Account not found.");
    if (!gameSnap.exists()) throw new Error("Machine not found.");
    const coins = Number(userSnap.data().coins) || 0;
    if (coins < bet) throw new Error("Not enough coins.");

    const mult = rollMultiplier();
    const s = settleSpin(gameSnap.data().pool, bet, mult);
    const newCoins = coins - bet + s.win;

    tx.update(userRef, { coins: newCoins });
    tx.update(gameRef, { pool: s.pool });
    return { mult, win: s.win, coins: newCoins, pool: s.pool };
  });
}

// Owner loads the machine. Returns { coins, pool }.
export async function fundMachine(gameId, username, amount) {
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) throw new Error("Enter an amount.");
  const userRef = doc(db, "users", userDocId(username));
  const gameRef = doc(db, GAMES, gameId);

  return runTransaction(db, async (tx) => {
    const [userSnap, gameSnap] = [await tx.get(userRef), await tx.get(gameRef)];
    if (!userSnap.exists() || !gameSnap.exists()) throw new Error("Not found.");
    if (gameSnap.data().owner !== username) throw new Error("Only the owner can fund this machine.");
    const coins = Number(userSnap.data().coins) || 0;
    if (coins < amount) throw new Error("Not enough coins.");
    const pool = (Number(gameSnap.data().pool) || 0) + amount;
    tx.update(userRef, { coins: coins - amount });
    tx.update(gameRef, { pool });
    return { coins: coins - amount, pool };
  });
}

// Owner empties (part of) the till. Returns { coins, pool }.
export async function collectPool(gameId, username, amount) {
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) throw new Error("Enter an amount.");
  const userRef = doc(db, "users", userDocId(username));
  const gameRef = doc(db, GAMES, gameId);

  return runTransaction(db, async (tx) => {
    const [userSnap, gameSnap] = [await tx.get(userRef), await tx.get(gameRef)];
    if (!userSnap.exists() || !gameSnap.exists()) throw new Error("Not found.");
    if (gameSnap.data().owner !== username) throw new Error("Only the owner can collect from this machine.");
    const pool = Number(gameSnap.data().pool) || 0;
    if (pool < amount) throw new Error("The pool only holds ◎ " + pool + ".");
    const coins = (Number(userSnap.data().coins) || 0) + amount;
    tx.update(userRef, { coins });
    tx.update(gameRef, { pool: pool - amount });
    return { coins, pool: pool - amount };
  });
}

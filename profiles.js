// profiles.js — player profiles: the public list of accounts, one player's
// profile data, and saving their custom page (an ordinary engine scene stored
// on their account — same blocks and scripts as games, but it lives on their
// profile and can't touch their games or stats, which the site renders itself).

import { db } from "./firebase.js";
import { userDocId } from "./auth.js";
import {
  collection, doc, getDoc, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Every account on the platform (public info only).
export async function listUsers() {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map(d => {
    const data = d.data();
    return { username: data.username, createdAt: data.createdAt };
  }).filter(u => u.username);
  users.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return users;
}

// One player's profile: account info + their custom page scene (if any).
export async function getProfile(username) {
  const snap = await getDoc(doc(db, "users", userDocId(username)));
  if (!snap.exists()) throw new Error("No player with that name.");
  const data = snap.data();
  return {
    username: data.username,
    createdAt: data.createdAt,
    pageScene: data.pageScene || null
  };
}

// Save the player's custom page (called by the Page Studio).
export async function savePageScene(username, scene) {
  await updateDoc(doc(db, "users", userDocId(username)), {
    pageScene: JSON.parse(JSON.stringify(scene)),
    pageUpdatedAt: Date.now()
  });
}

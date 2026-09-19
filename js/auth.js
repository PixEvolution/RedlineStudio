// auth.js — accounts, login, sessions. Nothing else lives here.
//
// Rules (v1):
//   Username: 1-10 characters, ANY character allowed, caps matter, must be unique (exact match).
//   Password: 1-10 characters, ANY character allowed, caps matter.
//   Passwords are hashed (SHA-256) before saving — the real password is never stored anywhere.

import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SESSION_KEY = "rl_session_v1";

// ---------- validation ----------

export function validateName(value, label) {
  if (typeof value !== "string" || value.length < 1) return `${label} can't be empty.`;
  if (value.length > 10) return `${label} must be 10 characters or less.`;
  return null; // any character is allowed
}

// ---------- internals ----------

// Usernames can contain ANY character, but database IDs can't.
// So we encode the username (base64url) to make a safe, exact, case-sensitive ID.
function userDocId(username) {
  const bytes = new TextEncoder().encode(username);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "u_" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashPassword(password) {
  const data = new TextEncoder().encode("redline::" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------- accounts ----------

export async function createAccount(username, password) {
  const nameErr = validateName(username, "Username");
  if (nameErr) throw new Error(nameErr);
  const passErr = validateName(password, "Password");
  if (passErr) throw new Error(passErr);

  const ref = doc(db, "users", userDocId(username));
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("That username is taken. (Changing a capital letter makes it a new name.)");

  await setDoc(ref, {
    version: 1,
    username,
    passHash: await hashPassword(password),
    createdAt: serverTimestamp()
  });

  setSession(username);
  return username;
}

export async function login(username, password) {
  const ref = doc(db, "users", userDocId(username));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("No account with that username. (Caps matter!)");

  const passHash = await hashPassword(password);
  if (snap.data().passHash !== passHash) throw new Error("Wrong password. (Caps matter!)");

  setSession(username);
  return username;
}

// ---------- session ----------

function setSession(username) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ username })); } catch {}
}

export function currentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw).username : null;
  } catch { return null; }
}

export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// Redirect helper for pages that require login (like the studio).
export function requireLogin(loginPath) {
  const user = currentUser();
  if (!user) window.location.href = loginPath;
  return user;
}

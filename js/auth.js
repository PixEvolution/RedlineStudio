// auth.js — accounts, login, sessions. Nothing else lives here.
//
// Rules (unchanged from v1):
//   Username: 1-10 characters, ANY character allowed, caps matter, must be unique (exact match).
//   Password: 1-10 characters, ANY character allowed, caps matter.
//
// What changed (v2): logins now go through Firebase Authentication, so the database
// can tell who is really logged in. Editing localStorage or using the browser console
// no longer lets someone act as another player. Players see no difference.
//
// Behind the scenes (players never see or type any of this):
//   - Each username becomes a hidden login ID: <hash of the exact username>@users.redlinestudio.dev
//     (a hash keeps ANY character and exact caps working).
//   - The password is sent to Firebase with a fixed prefix, so 1-character passwords still
//     pass Firebase's 6-character minimum.
//   - Passwords are stored only by Firebase Authentication, never in our database.
//
// Old v1 accounts upgrade themselves the first time they log in with their old password.
//
// Same exports as v1 (createAccount, login, currentUser, logout, requireLogin,
// userDocId, validateName), plus `auth` and `authReady`.

import { app, db } from "./firebase.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  updateEmail,
  verifyBeforeUpdateEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const auth = getAuth(app);

const SESSION_KEY = "rl_session_v1";          // display cache only — NOT what grants access
const EMAIL_DOMAIN = "users.redlinestudio.dev";
const PASS_PREFIX = "redline::";

// ---------- validation ----------

export function validateName(value, label) {
  if (typeof value !== "string" || value.length < 1) return `${label} can't be empty.`;
  if (value.length > 10) return `${label} must be 10 characters or less.`;
  return null; // any character is allowed
}

// ---------- internals ----------

// Unchanged from v1: other modules (economy, models) use this to find user docs.
export function userDocId(username) {
  const bytes = new TextEncoder().encode(username);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "u_" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Exact username (any characters, caps matter) -> hidden login ID.
async function loginIdFor(username) {
  return (await sha256Hex("user::" + username)).slice(0, 40) + "@" + EMAIL_DOMAIN;
}

function firebasePassword(password) {
  return PASS_PREFIX + password;
}

// v1 password hash — only used to upgrade old accounts.
async function legacyHash(password) {
  return sha256Hex("redline::" + password);
}

function friendlyError(err) {
  switch (err && err.code) {
    case "auth/email-already-in-use":
      return "That username is taken. (Changing a capital letter makes it a new name.)";
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Wrong username or password. (Caps matter!)";
    case "auth/too-many-requests":
      return "Too many tries. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Couldn't reach the server. Check your connection.";
    case "auth/operation-not-allowed":
      return "Logins aren't switched on yet (Firebase Authentication setup).";
    default:
      return (err && err.message) || "Something went wrong.";
  }
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

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, await loginIdFor(username), firebasePassword(password));
  } catch (err) {
    throw new Error(friendlyError(err));
  }

  try {
    await updateProfile(cred.user, { displayName: username });
    await setDoc(ref, {
      version: 2,
      uid: cred.user.uid,   // ties this profile to the Firebase login (used by security rules)
      username,
      coins: 100,           // starting coins
      lastDaily: "",        // for the daily coin claim
      createdAt: serverTimestamp()
    });
  } catch (err) {
    // Don't leave a half-made account behind.
    try { await cred.user.delete(); } catch {}
    throw new Error(friendlyError(err));
  }

  setSession(username);
  return username;
}

export async function login(username, password) {
  if (!username || !password) throw new Error("Enter your username and password.");

  // an email in the username box = email login (accounts with a linked email)
  if (username.includes("@")) {
    try {
      const cred = await signInWithEmailAndPassword(auth, username.trim(), firebasePassword(password));
      const name = cred.user.displayName || username;
      setSession(name);
      return name;
    } catch (err) { throw new Error(friendlyError(err)); }
  }

  const loginId = await loginIdFor(username);

  try {
    await signInWithEmailAndPassword(auth, loginId, firebasePassword(password));
    setSession(username);
    return username;
  } catch (err) {
    // Not a Firebase account yet? Maybe it's an old v1 account — try upgrading it.
    const code = err && err.code;
    if (code !== "auth/invalid-credential" && code !== "auth/user-not-found") {
      throw new Error(friendlyError(err));
    }
    if (await upgradeLegacyAccount(username, password, loginId)) {
      setSession(username);
      return username;
    }
    // an account with a LINKED EMAIL logs in with the email, not the username
    try {
      const snap = await getDoc(doc(db, "users", userDocId(username)));
      if (snap.exists() && snap.data().hasEmail) {
        throw new Error("This account has a linked email — type your EMAIL in the username box to log in.");
      }
    } catch (e2) { if (String(e2.message).includes("linked email")) throw e2; }
    throw new Error(friendlyError(err));
  }
}

// ---------- account settings (account.html) ----------

// Sensitive changes re-prove the password first, whatever the auth email is.
async function reauth(currentPassword) {
  const u = auth.currentUser;
  if (!u) throw new Error("You're not logged in.");
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, firebasePassword(currentPassword)));
  } catch (err) {
    throw new Error("Current password is wrong. (Caps matter!)");
  }
  return u;
}

export async function changePassword(currentPassword, newPassword) {
  const passErr = validateName(newPassword, "New password");
  if (passErr) throw new Error(passErr);
  const u = await reauth(currentPassword);
  await updatePassword(u, firebasePassword(newPassword));
}

// Link a real email: it becomes the account's login email (username + password
// keeps working until the link lands, then login is EMAIL + password), and it
// enables password recovery.
//
// Firebase has two moods about this, depending on a console setting:
//   · classic: updateEmail() attaches it at once, then we mail a verification
//   · protected (the default on new projects): updateEmail() is refused, and
//     the email attaches only AFTER its owner clicks a link we mail them —
//     linked and verified in one click.
// We try classic and fall back to protected, so it works either way.
// Returns "linked" (attached now, verify mail sent) or "pending" (the mail
// does the attaching — nothing changes until it's clicked).
export async function linkEmail(currentPassword, email) {
  email = String(email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That doesn't look like an email address.");
  const u = await reauth(currentPassword);
  try {
    await updateEmail(u, email);
    try { await sendEmailVerification(u); } catch {}
    return "linked";
  } catch (err) {
    if (err && err.code === "auth/email-already-in-use") throw new Error("That email is already on another account.");
    if (err && err.code === "auth/operation-not-allowed") {
      // the protected flow: the mail's link performs the linking
      try {
        await verifyBeforeUpdateEmail(u, email);
        return "pending";
      } catch (err2) {
        if (err2 && err2.code === "auth/email-already-in-use") throw new Error("That email is already on another account.");
        throw new Error(friendlyError(err2));
      }
    }
    throw new Error(friendlyError(err));
  }
}

export async function resendVerification() {
  const u = auth.currentUser;
  if (!u) throw new Error("You're not logged in.");
  await sendEmailVerification(u);
}

// Fresh truth about the login: linked email (if any) and whether it's verified.
export async function emailStatus() {
  const u = auth.currentUser;
  if (!u) return { linked: false, email: "", verified: false };
  try { await u.reload(); } catch {}
  const real = u.email && !u.email.endsWith("@" + EMAIL_DOMAIN);
  return { linked: !!real, email: real ? u.email : "", verified: !!(real && u.emailVerified) };
}

export async function sendReset(email) {
  email = String(email || "").trim();
  if (!email.includes("@")) throw new Error("Enter the email linked to your account.");
  await sendPasswordResetEmail(auth, email);
}

// Proves the password without changing anything — account.html checks this
// BEFORE it starts erasing, so a typo can never leave a half-deleted account.
export async function verifyPassword(currentPassword) {
  await reauth(currentPassword);
}

// Deletes the LOGIN. The caller (account.html) erases the account's data
// first — this is the last, irreversible step.
export async function deleteLogin(currentPassword) {
  const u = await reauth(currentPassword);
  await deleteUser(u);
  clearSession();
}

// Old accounts have passHash and no uid. If the old password matches, create the
// Firebase login for them, link it, and remove the old hash. Keeps coins and games.
async function upgradeLegacyAccount(username, password, loginId) {
  const ref = doc(db, "users", userDocId(username));
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const data = snap.data();
  if (data.uid || !data.passHash) return false;
  if (data.passHash !== await legacyHash(password)) return false;

  const cred = await createUserWithEmailAndPassword(auth, loginId, firebasePassword(password));
  await updateProfile(cred.user, { displayName: username });
  await updateDoc(ref, { uid: cred.user.uid, version: 2, passHash: deleteField() });
  return true;
}

// ---------- session ----------

function setSession(username) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ username })); } catch {}
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// Resolves once Firebase has restored (or not) the saved login for this browser.
// Await it before any database write that must happen right as a page loads.
let _resolveReady;
export const authReady = new Promise(r => { _resolveReady = r; });

onAuthStateChanged(auth, (user) => {
  if (user && user.displayName) {
    setSession(user.displayName);
  } else if (!user) {
    // Old v1 sessions (or a faked localStorage entry) get cleared here.
    clearSession();
  }
  // user without displayName = mid-signup; createAccount/login sets the session itself.
  _resolveReady(user);
});

// Fast synchronous name for the UI. The real permission check is the Firebase login,
// which the database rules enforce.
export function currentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw).username : null;
  } catch { return null; }
}

export function logout() {
  clearSession();
  signOut(auth).catch(() => {});
}

// Redirect helper for pages that require login (like the studio).
export function requireLogin(loginPath) {
  const user = currentUser();
  if (!user) window.location.href = loginPath;
  // If the cached name turns out to be stale, send them to log in once Firebase checks.
  authReady.then(u => { if (!u) window.location.href = loginPath; });
  return user;
}

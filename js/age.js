// age.js — where a player's AGE BRACKET lives. Nothing else lives here.
//
// The bracket ("u13" / "13" / "16" / "18") is PRIVATE: it's stored in
// /ages/{uid}, which only that login can read (see firestore.rules). The
// birth date itself is never sent anywhere — ratings.js turns it into a
// bracket inside the browser.
//
// Old accounts kept the bracket on their PUBLIC users doc. The first time
// myBracket() runs for such an account, it moves the bracket into the private
// doc and removes the public copy in one atomic batch.
//
// Every page that gates content by age should ask myBracket() — never read
// ageBracket off a users doc.

import { db } from "./firebase.js";
import { auth, authReady, currentUser, userDocId } from "./auth.js";
import { growsDue } from "./ratings.js";
import {
  doc, getDoc, setDoc, deleteDoc, writeBatch, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const BRACKETS = ["u13", "13", "16", "18"];
let cached;   // undefined = not looked up yet this page · null = undeclared

const ageRef = (uid) => doc(db, "ages", uid);

// The logged-in player's bracket, or null (logged out / never declared).
export async function myBracket() {
  await authReady;
  const u = auth.currentUser;
  if (!u) return null;
  if (cached !== undefined) return cached;

  try {
    const a = await getDoc(ageRef(u.uid));
    if (a.exists() && BRACKETS.includes(a.data().ageBracket)) {
      cached = a.data().ageBracket;
      // GROWING UP: an under-13 declaration carries the MONTH the account
      // turns 13 (never the birth date). When that month arrives, the
      // bracket upgrades itself — the rules check the month against the
      // server clock, so this can't be pulled forward.
      if (cached === "u13" && growsDue(a.data().grows)) {
        try {
          await setDoc(ageRef(u.uid), { ageBracket: "13" });
          cached = "13";
        } catch {}   // rules not live yet — still u13 this visit
      }
      return cached;
    }
  } catch {
    return null;   // couldn't read — don't cache a guess
  }

  // not declared privately — is there an OLD public copy to move?
  const name = u.displayName || currentUser();
  if (!name) { cached = null; return cached; }
  let legacy = null;
  try {
    const uref = doc(db, "users", userDocId(name));
    const s = await getDoc(uref);
    if (s.exists() && s.data().uid === u.uid && BRACKETS.includes(s.data().ageBracket)) {
      legacy = s.data().ageBracket;
      const batch = writeBatch(db);
      batch.set(ageRef(u.uid), { ageBracket: legacy });
      batch.update(uref, { ageBracket: deleteField() });
      await batch.commit();
    }
  } catch {
    // the move failed (e.g. rules not published yet) — the old bracket still
    // counts, so nobody gets locked out; the move retries on a later page
    if (legacy) return legacy;
  }
  cached = legacy;
  return cached;
}

// Declare the bracket — once. Throws if one is already set.
// An under-13 declaration also stores `grows`, the YYYYMM month the account
// turns 13 (from ratings.growsFromBirthdate) — the month, never the date —
// so the account unlocks on its own instead of staying a child forever.
export async function declareBracket(bracket, grows = null) {
  if (!BRACKETS.includes(bracket)) throw new Error("That isn't a valid age bracket.");
  await authReady;
  const u = auth.currentUser;
  if (!u) throw new Error("You're not logged in.");
  if (await myBracket()) throw new Error("Your age bracket is already set.");
  const rec = bracket === "u13" && Number.isFinite(grows)
    ? { ageBracket: "u13", grows } : { ageBracket: bracket };
  await setDoc(ageRef(u.uid), rec);
  cached = bracket;
  return bracket;
}

// Account deletion: erase the private age record.
export async function eraseMyAge() {
  await authReady;
  const u = auth.currentUser;
  if (!u) return;
  await deleteDoc(ageRef(u.uid));
  cached = null;
}

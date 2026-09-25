// forum.js — the Forums: threads and replies. Simple, honest, modular.
//
// Posting (a new thread or a reply) is for a declared 13+ — typing where
// other players read it. The database rules enforce the same thing.

import { db } from "./firebase.js";
import { auth } from "./auth.js";
import { myBracket } from "./age.js";
import { canUseFreeText } from "./ratings.js";
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const NEED_13 = "Posting on the Forums is for players who've declared 13+ in ⚙ Account.";

// Can the logged-in player post? (forums.html can use this to hide the form.)
export async function canPost() {
  try { return canUseFreeText(await myBracket()); } catch { return false; }
}

export async function listThreads() {
  const snap = await getDocs(collection(db, "threads"));
  const out = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  out.sort((a, b) => (b.lastAt?.seconds || b.createdAt?.seconds || 0) - (a.lastAt?.seconds || a.createdAt?.seconds || 0));
  return out;
}

export async function getThread(id) {
  const snap = await getDoc(doc(db, "threads", id));
  if (!snap.exists()) throw new Error("Thread not found — it may have been deleted.");
  return { id: snap.id, ...snap.data() };
}

export async function createThread(author, title, body) {
  title = String(title || "").trim();
  body = String(body || "").trim();
  if (!author) throw new Error("Log in to post.");
  if (!(await canPost())) throw new Error(NEED_13);
  if (!title) throw new Error("Your thread needs a title.");
  if (title.length > 60) throw new Error("Title must be 60 characters or less.");
  if (!body) throw new Error("Write the first post.");
  if (body.length > 1000) throw new Error("Posts max out at 1000 characters.");
  const t = await addDoc(collection(db, "threads"), {
    title, author, authorUid: auth.currentUser?.uid || null, replies: 0,
    createdAt: serverTimestamp(), lastAt: serverTimestamp()
  });
  await addDoc(collection(db, "posts"), {
    thread: t.id, author, authorUid: auth.currentUser?.uid || null, text: body, createdAt: serverTimestamp()
  });
  return t.id;
}

export async function listPosts(threadId) {
  const q = query(collection(db, "posts"), where("thread", "==", threadId));
  const snap = await getDocs(q);
  const out = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  out.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));   // oldest first
  return out;
}

export async function replyToThread(threadId, author, text) {
  text = String(text || "").trim();
  if (!author) throw new Error("Log in to reply.");
  if (!(await canPost())) throw new Error(NEED_13);
  if (!text) throw new Error("Write something first.");
  if (text.length > 1000) throw new Error("Posts max out at 1000 characters.");
  await addDoc(collection(db, "posts"), {
    thread: threadId, author, authorUid: auth.currentUser?.uid || null, text, createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "threads", threadId), {
    replies: increment(1), lastAt: serverTimestamp()
  }).catch(() => {});
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, "posts", postId));
}

// Thread author can delete their whole thread (posts stay orphaned — hobby scale).
export async function deleteThread(threadId) {
  await deleteDoc(doc(db, "threads", threadId));
}

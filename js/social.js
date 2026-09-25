// social.js — likes/dislikes and comments, shared by games, players, and models.
// One system, three targets: kind is "games", "models", or "users" (players).
// Votes live ON the target doc (a votes map + cached like/dislike counts), so
// lists can show counts with no extra reads. Comments are their own collection.

import { amIMod } from "./mod.js";
import { db } from "./firebase.js";
import { auth } from "./auth.js";
import { userDocId } from "./auth.js";
import {
  collection, doc, addDoc, getDocs, getDoc, deleteDoc, updateDoc,
  query, where, serverTimestamp, runTransaction, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function targetRef(kind, id) {
  // players are addressed by username; games/models by doc id
  return doc(db, kind, kind === "users" ? userDocId(id) : id);
}

// ---------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------

// value: 1 = like, -1 = dislike. Voting the same way again removes your vote.
export async function vote(kind, id, value, username) {
  if (!username) throw new Error("Log in to vote.");
  const ref = targetRef(kind, id);
  const key = userDocId(username);
  let out = { likes: 0, dislikes: 0, my: 0 };
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error("That doesn't exist anymore.");
    const data = snap.data();
    const votes = { ...(data.votes || {}) };
    const old = Number(votes[key]) || 0;
    const next = old === value ? 0 : value;
    if (next === 0) delete votes[key];
    else votes[key] = next;
    const likes = Math.max(0, (Number(data.likes) || 0) + (next === 1 ? 1 : 0) - (old === 1 ? 1 : 0));
    const dislikes = Math.max(0, (Number(data.dislikes) || 0) + (next === -1 ? 1 : 0) - (old === -1 ? 1 : 0));
    t.update(ref, { votes, likes, dislikes });
    out = { likes, dislikes, my: next };
  });
  return out;
}

export function myVote(docData, username) {
  if (!username || !docData?.votes) return 0;
  return Number(docData.votes[userDocId(username)]) || 0;
}

// Renders ▲ n / ▼ n buttons into `mount` and keeps them live.
export function renderVotes(mount, kind, id, docData, username) {
  mount.innerHTML = "";
  mount.className = "votes";
  let likes = Number(docData?.likes) || 0;
  let dislikes = Number(docData?.dislikes) || 0;
  let my = myVote(docData, username);

  const up = document.createElement("button");
  const down = document.createElement("button");
  const paint = () => {
    up.className = "vote-btn up" + (my === 1 ? " active" : "");
    down.className = "vote-btn down" + (my === -1 ? " active" : "");
    up.textContent = "▲ " + likes;
    down.textContent = "▼ " + dislikes;
  };
  const press = (v) => async () => {
    if (!username) { window.location.href = relRoot() + "login.html"; return; }
    up.disabled = down.disabled = true;
    try {
      const r = await vote(kind, id, v, username);
      likes = r.likes; dislikes = r.dislikes; my = r.my;
      paint();
    } catch (err) { console.warn(err); }
    up.disabled = down.disabled = false;
  };
  up.addEventListener("click", press(1));
  down.addEventListener("click", press(-1));
  paint();
  mount.append(up, down);
}

function relRoot() {
  // pages that use social.js all live at the site root
  return "";
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addComment(kind, id, author, text) {
  text = String(text || "").trim();
  if (!author) throw new Error("Log in to comment.");
  if (!text) throw new Error("Write something first.");
  if (text.length > 300) throw new Error("Comments max out at 300 characters.");
  const ref = await addDoc(collection(db, "comments"), {
    kind, target: String(id), author, authorUid: auth.currentUser?.uid || null,
    text, createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function listComments(kind, id) {
  const q = query(collection(db, "comments"), where("kind", "==", kind), where("target", "==", String(id)));
  const snap = await getDocs(q);
  const out = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  out.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return out;
}

export async function deleteComment(commentId) {
  await deleteDoc(doc(db, "comments", commentId));
}

// Full comments widget: input (when logged in) + live list. Renders into `mount`.
export function renderComments(mount, kind, id, me, { heading = "Comments" } = {}) {
  mount.innerHTML = "";
  mount.className = "comments";

  const h = document.createElement("h3");
  h.textContent = heading;
  mount.appendChild(h);

  const list = document.createElement("div");

  if (me) {
    const row = document.createElement("div");
    row.className = "comment-input";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 300;
    input.placeholder = "Say something…";
    const send = document.createElement("button");
    send.className = "btn btn-small";
    send.textContent = "Post";
    const submit = async () => {
      send.disabled = true;
      try {
        await addComment(kind, id, me, input.value);
        input.value = "";
        load();
      } catch (err) { console.warn(err); }
      send.disabled = false;
    };
    send.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    row.append(input, send);
    mount.appendChild(row);
  } else {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.innerHTML = `<a href="login.html" style="color:#ff8f8c">Log in</a> to comment.`;
    mount.appendChild(hint);
  }

  mount.appendChild(list);

  async function load() {
      const mod = await amIMod();
    try {
      const comments = await listComments(kind, id);
      list.innerHTML = "";
      if (comments.length === 0) {
        list.innerHTML = `<p class="hint">No comments yet — be the first.</p>`;
        return;
      }
      for (const c of comments) {
        const row = document.createElement("div");
        row.className = "comment";
        const who = document.createElement("a");
        who.className = "comment-author";
        who.textContent = c.author;
        who.href = "profile.html?u=" + encodeURIComponent(c.author);
        const text = document.createElement("span");
        text.className = "comment-text";
        text.textContent = c.text;
        row.append(who, text);
        if (me === c.author || mod) {
          const del = document.createElement("button");
          del.className = "blk-mini blk-del";
          del.textContent = "✕";
          del.title = me === c.author ? "Delete my comment" : "Remove (moderation)";
          del.addEventListener("click", async () => { await deleteComment(c.id); load(); });
          row.appendChild(del);
        }
        list.appendChild(row);
      }
    } catch (err) {
      list.innerHTML = `<p class="hint">Couldn't load comments.</p>`;
    }
  }
  load();
}

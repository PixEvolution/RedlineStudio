// scores.js — ★ HIGH SCORES: the leaderboard every real arcade cabinet had.
//
// A game earns its table automatically by using two reserved vars together:
//   score    — the points (set / change it like any variable, blocks or code)
//   endplay  — set to 1 when the play is OVER (the arcade contract)
// When a play ends, the platform records the player's `score` — ONE row per
// player per game, personal best only, forever. Glory, not coins: scores
// can't be spent, and the table is public on the game's page.
//
// Honest limit (same class as the casino odds): the score VALUE is reported
// by the player's own browser, so a technical user could post a fake one.
// The security rules still guarantee nobody can ever touch anyone ELSE's row.

import { db } from "./firebase.js";
import { auth, userDocId } from "./auth.js";
import {
  doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// one row per player per game — the row's id IS the player's account id,
// which the security rules verify against the login
const entryRef = (gameId, username) =>
  doc(db, "scores", gameId, "entries", userDocId(username));

// Record a finished play. Personal best only.
// Returns { best, improved } — or null when there's nothing to record.
export async function submitScore(gameId, username, score) {
  score = Math.floor(Number(score) || 0);
  if (!username || score <= 0) return null;
  const ref = entryRef(gameId, username);
  const snap = await getDoc(ref);
  const best = snap.exists() ? (Number(snap.data().score) || 0) : 0;
  if (snap.exists() && score <= best) return { best, improved: false };
  await setDoc(ref, {
    user: username,
    uid: auth.currentUser?.uid || null,
    score,
    at: serverTimestamp()
  });
  return { best: score, improved: true };
}

// The top of the table, best first.
export async function topScores(gameId, n = 10) {
  const q = query(
    collection(db, "scores", gameId, "entries"),
    orderBy("score", "desc"), limit(n)
  );
  const snaps = await getDocs(q);
  const out = [];
  snaps.forEach((s) => out.push(s.data()));
  return out;
}

// The HIGH SCORES panel on a game's page. Returns { refresh }.
export function renderScoreboard(mount, gameId, me) {
  mount.innerHTML = "";
  mount.className = "panel scoreboard";

  const h = document.createElement("h3");
  h.textContent = "★ HIGH SCORES";
  const list = document.createElement("div");
  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = me
    ? "Finish a play to post your score — the table keeps your personal best."
    : "Log in and finish a play to get your name on the table.";
  mount.append(h, list, note);

  async function refresh() {
    try {
      const rows = await topScores(gameId, 10);
      list.innerHTML = "";
      if (rows.length === 0) {
        list.innerHTML = `<p class="hint">No scores yet — the table is waiting for its first name.</p>`;
        return;
      }
      rows.forEach((r, i) => {
        const row = document.createElement("div");
        row.className = "score-row" + (r.user === me ? " mine" : "");
        const rank = document.createElement("span");
        rank.className = "score-rank";
        rank.textContent = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
        const name = document.createElement("a");
        name.className = "score-name";
        name.href = "profile.html?u=" + encodeURIComponent(r.user);
        name.textContent = r.user;
        const pts = document.createElement("span");
        pts.className = "score-pts";
        pts.textContent = r.score;
        row.append(rank, name, pts);
        list.appendChild(row);
      });
    } catch (err) {
      console.warn("scoreboard:", err);
      list.innerHTML = `<p class="hint">Couldn't load the table — if this is your site, make sure the newest security rules are published in the Firebase console.</p>`;
    }
  }
  refresh();
  return { refresh };
}

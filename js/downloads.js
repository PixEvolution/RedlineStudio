// downloads.js — the DOWNLOAD buttons for Redline Digital's desktop games.
// Each button names the game's file (data-asset="PC_Racer.exe"). What it serves
// is decided by the Mod Desk's ⬇ Download links setting (config/downloads):
//   · tag "auto"  — the most recently uploaded copy of that exact file across
//     every GitHub release. Several games share one repo, so GitHub's own
//     "latest release" link could point at the wrong game — this looks for
//     each game's file BY NAME, so updating one game can't break the other.
//   · tag "V1.4"  — pinned: that release's copy, until the tag goes back to auto.
// If GitHub or the setting can't be reached, the button opens the Releases page.

import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const REPO = "PixEvolution/RedlineStudio";

// the games and their exact exe names — a new game gets a row here
export const GAMES = {
  emergence: { label: "Emergence", file: "Emergence.exe" },
  pcracer: { label: "PC Racer", file: "PC_Racer.exe" }
};

export const linkFor = ({ tag, file }) =>
  `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`;

// the saved setting, with "auto" filled in wherever nothing is saved
export async function getDownloads() {
  let data = {};
  try { data = (await getDoc(doc(db, "config", "downloads"))).data() || {}; } catch {}
  const out = {};
  for (const [id, g] of Object.entries(GAMES)) {
    const c = data[id] || {};
    out[id] = {
      tag: typeof c.tag === "string" && c.tag.trim() ? c.tag.trim() : "auto",
      file: typeof c.file === "string" && c.file.trim() ? c.file.trim() : g.file
    };
  }
  return out;
}

// Mod Desk saves it — the database rules only let a moderator write this
export async function saveDownloads(cfg) {
  const out = {};
  for (const [id, g] of Object.entries(GAMES)) {
    const c = cfg[id] || {};
    out[id] = {
      tag: String(c.tag || "auto").trim() || "auto",
      file: String(c.file || g.file).trim() || g.file
    };
  }
  await setDoc(doc(db, "config", "downloads"), out);
}

async function newest(name) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=50`);
  if (!r.ok) return null;
  let best = null;
  for (const rel of await r.json()) {
    if (rel.draft || rel.prerelease) continue;
    for (const a of rel.assets || []) {
      if (String(a.name).toLowerCase() === name.toLowerCase() && (!best || a.updated_at > best.updated_at)) best = a;
    }
  }
  return best ? best.browser_download_url : null;
}

let cfgOnce = null;   // the setting is read once per page, on the first click

async function resolve(asset) {
  cfgOnce = cfgOnce || getDownloads();
  const cfg = await cfgOnce;
  const want = String(asset).toLowerCase();
  for (const [id, g] of Object.entries(GAMES)) {
    if (cfg[id].file.toLowerCase() !== want && g.file.toLowerCase() !== want) continue;
    if (cfg[id].tag.toLowerCase() !== "auto") return linkFor({ tag: cfg[id].tag, file: cfg[id].file });
    return await newest(cfg[id].file);
  }
  return await newest(asset);   // a button for a game with no row here yet
}

export function wireDownloads(root = document) {
  root.querySelectorAll("a[data-asset]").forEach(a => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      let url = null;
      try { url = await resolve(a.dataset.asset); } catch { url = null; }
      window.location.href = url || `https://github.com/${REPO}/releases`;
    });
  });
}

wireDownloads();

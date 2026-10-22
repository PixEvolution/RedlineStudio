// downloads.js — the download links as a SETTING, not hard-coded HTML.
// One tiny Firestore doc (config/downloads) says which GitHub release tag and
// file name each game's DOWNLOAD button points at. Every page reads it on
// load; the Mod Desk has a panel that edits it. Ship a new version = upload
// the exe to GitHub, then type the new tag into Mod Desk — no file edits.
//
// If the doc is missing or the database is unreachable, the buttons keep the
// pinned fallback links baked into the pages, so downloads never go dark.

import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const REPO = "https://github.com/PixEvolution/RedlineStudio/releases/download";
const REF = () => doc(db, "config", "downloads");

// the games this controls — ids match the data-dl="" attribute on the pages
export const GAMES = { pcracer: "PC Racer", emergence: "Emergence" };
export const DEFAULTS = {
  pcracer: { tag: "V1.4", file: "PC_Racer.exe" },
  emergence: { tag: "V1.0.3", file: "Emergence.exe" }
};

const TAG_RE = /^[A-Za-z0-9._-]{1,40}$/;
const FILE_RE = /^[A-Za-z0-9._ -]{1,60}$/;

export const linkFor = (e) => `${REPO}/${encodeURIComponent(e.tag)}/${encodeURIComponent(e.file)}`;

// current settings, with the defaults filling any gap
export async function getDownloads() {
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const snap = await getDoc(REF());
    if (snap.exists()) {
      const d = snap.data();
      for (const k of Object.keys(GAMES)) {
        const e = d[k];
        if (e && TAG_RE.test(String(e.tag || "")) && FILE_RE.test(String(e.file || ""))) {
          out[k] = { tag: String(e.tag), file: String(e.file) };
        }
      }
    }
  } catch {}
  return out;
}

// point every <a data-dl="pcracer|emergence"> at the configured release.
// Call it once per page; the baked-in href stays until (and unless) this lands.
export async function wireDownloadLinks(root = document) {
  const cfg = await getDownloads();
  for (const a of root.querySelectorAll("[data-dl]")) {
    const e = cfg[a.dataset.dl];
    if (e) a.href = linkFor(e);
  }
  return cfg;
}

// Mod Desk saves the whole doc (the rules only let moderators write it)
export async function saveDownloads(cfg) {
  const clean = {};
  for (const k of Object.keys(GAMES)) {
    const e = cfg[k] || {};
    const tag = String(e.tag || "").trim();
    const file = String(e.file || "").trim();
    if (!TAG_RE.test(tag)) throw new Error(`${GAMES[k]}: that tag doesn't look like a release tag (letters, numbers, dots and dashes only).`);
    if (!FILE_RE.test(file)) throw new Error(`${GAMES[k]}: that file name doesn't look right.`);
    clean[k] = { tag, file };
  }
  await setDoc(REF(), clean);
  return clean;
}

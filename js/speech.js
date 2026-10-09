// speech.js — 🔊 LISTEN buttons: browser text-to-speech for every chunk of
// text on the site, for players who'd rather hear it than read it.
//
// Built on the Web Speech API that ships in every browser: free, offline,
// nothing to host — the voice is the DEVICE's built-in one, so it sounds
// great on phones and Macs and more robotic on some desktops. Long text is
// spoken sentence by sentence (one giant utterance is where the API breaks),
// one speaker plays at a time, a speaking button turns into ⏹, and leaving
// the page stops the voice.

export const canSpeak = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

// Long text → speakable sentence chunks (the API mumbles or dies on huge
// blocks). Splits on sentence ends, then hard-wraps anything still over ~220
// characters at the nearest space. Whitespace (including a code table's
// column gaps) collapses to single spaces.
export function toChunks(text, max = 220) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const out = [];
  for (let s of sentences) {
    while (s.length > max) {
      let cut = s.lastIndexOf(" ", max);
      if (cut < max * 0.4) cut = max;
      out.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

// The text a listener should hear from a DOM node: everything except
// controls (buttons, inputs, selects) — what's on screen, spoken.
export function textOf(node) {
  const ghost = node.cloneNode(true);
  ghost.querySelectorAll("button, select, input, textarea, .g-read, .g-chev, .speak-btn").forEach(x => x.remove());
  return ghost.textContent || "";
}

// ---- the chosen voice + speed, per DEVICE (voices differ machine to
// machine, so this lives in the browser, not on the account). Set from the
// ⚙ Account page; every 🔊 on the site obeys it.
const PREFS_KEY = "rl_voice_prefs";
export function getVoicePrefs() {
  try { return { voice: "", rate: 1, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")) }; }
  catch { return { voice: "", rate: 1 }; }
}
export function setVoicePrefs({ voice = "", rate = 1 } = {}) {
  rate = Number(rate);
  if (!Number.isFinite(rate)) rate = 1;
  rate = Math.min(1.4, Math.max(0.7, rate));
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ voice: String(voice), rate })); } catch {}
  return { voice, rate };
}

// Every voice the DEVICE offers (they load async in some browsers — this
// resolves once the list is real, or empty if the API is missing).
export function listVoices() {
  return new Promise((resolve) => {
    if (!canSpeak()) { resolve([]); return; }
    const got = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) { resolve([...v].sort((a, b) => (a.lang + a.name).localeCompare(b.lang + b.name))); return true; }
      return false;
    };
    if (got()) return;
    window.speechSynthesis.onvoiceschanged = got;
    setTimeout(() => { if (!got()) resolve([]); }, 2000);
  });
}

function chosenVoice() {
  const { voice } = getVoicePrefs();
  if (!voice) return null;
  try { return window.speechSynthesis.getVoices().find(v => v.name === voice) || null; } catch { return null; }
}

let current = null;   // { btn, stop } — the one voice allowed at a time

export function stopSpeaking() {
  if (current) { const c = current; current = null; c.restore(); }
  try { window.speechSynthesis.cancel(); } catch {}
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", stopSpeaking);
}

function speakChunks(chunks, onDone) {
  const synth = window.speechSynthesis;
  synth.cancel();
  let i = 0, dead = false;
  const v = chosenVoice();
  const { rate } = getVoicePrefs();
  const next = () => {
    if (dead || i >= chunks.length) { onDone(); return; }
    const u = new SpeechSynthesisUtterance(chunks[i++]);
    if (v) u.voice = v;
    u.rate = rate;
    u.onend = next;
    u.onerror = next;
    synth.speak(u);
  };
  next();
  return () => { dead = true; };
}

// Make `btn` a play/stop toggle for getText()'s content.
export function wireSpeaker(btn, getText) {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (current && current.btn === btn) { stopSpeaking(); return; }
    stopSpeaking();
    const chunks = toChunks(getText());
    if (!chunks.length) return;
    const was = btn.textContent;
    btn.textContent = "⏹";
    btn.title = "Stop";
    const restore = () => { btn.textContent = was; btn.title = "Listen"; };
    const kill = speakChunks(chunks, () => { if (current && current.btn === btn) current = null; restore(); });
    current = { btn, restore: () => { kill(); restore(); } };
  });
}

function makeBtn() {
  const b = document.createElement("button");
  b.className = "speak-btn";
  b.type = "button";
  b.textContent = "🔊";
  b.title = "Listen";
  b.style.cssText = "margin-left:8px; font-size:.72em; background:transparent; border:1px solid #3a4452; border-radius:6px; color:#8fa0b4; padding:1px 8px; cursor:pointer; vertical-align:2px";
  return b;
}

// 🔊 on every .panel's heading: reads that whole panel.
export function addPanelSpeakers(root = document) {
  if (!canSpeak()) return 0;
  let n = 0;
  for (const panel of root.querySelectorAll(".panel")) {
    if (panel.classList.contains("g-toc")) continue;   // the contents list isn't prose
    // the button lives on the heading — or on the first paragraph when a
    // panel has none (the Games page intro), so every chunk of text can talk
    const h = panel.querySelector("h2, h3") || panel.querySelector("p");
    if (!h || h.querySelector(".speak-btn") || panel.querySelector(".speak-btn") || !textOf(panel).trim()) continue;
    const btn = makeBtn();
    wireSpeaker(btn, () => textOf(panel));
    h.appendChild(btn);
    n++;
  }
  return n;
}

// 🔊 on each sub-heading (the Museum's 57 entries): reads from that heading
// to the next one of the same kind.
export function addEntrySpeakers(sel) {
  if (!canSpeak()) return 0;
  const heads = [...document.querySelectorAll(sel)];
  for (const h of heads) {
    if (h.querySelector(".speak-btn")) continue;
    const btn = makeBtn();
    wireSpeaker(btn, () => {
      let t = textOf(h);
      for (let el = h.nextElementSibling; el && el.tagName !== h.tagName; el = el.nextElementSibling) {
        t += " " + textOf(el);
      }
      return t;
    });
    h.appendChild(btn);
  }
  return heads.length;
}

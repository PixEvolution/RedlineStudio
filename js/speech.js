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

// Every voice the DEVICE offers. Browsers deliver this list LATE and in
// PIECES — Chrome often hands over local voices first and its network voices
// a beat later — so this collects for a moment and returns the biggest list
// seen, instead of trusting the first answer. (The browser can still only
// list INSTALLED voices: each OS offers more behind Settings → Speech /
// Spoken Content / Text-to-speech — once installed, they show up here.)
// The warm cache: browsers hand over an EMPTY voice list on a fresh page
// until something asks — so this module asks the moment it loads, on every
// page, and keeps listening for the late deliveries. Without this, a chosen
// voice silently falls back to the default everywhere but the settings page.
let voiceCache = [];
function warmVoices() {
  try {
    const v = window.speechSynthesis.getVoices() || [];
    if (v.length > voiceCache.length) voiceCache = v;
  } catch {}
}
if (typeof window !== "undefined" && canSpeak()) {
  warmVoices();
  const synth = window.speechSynthesis;
  if (synth.addEventListener) synth.addEventListener("voiceschanged", warmVoices);
  else synth.onvoiceschanged = warmVoices;
}

export function listVoices({ wait = 700 } = {}) {
  return new Promise((resolve) => {
    if (!canSpeak()) { resolve([]); return; }
    warmVoices();
    const finish = () => {
      warmVoices();
      resolve([...voiceCache].sort((a, b) => (a.lang + a.name).localeCompare(b.lang + b.name)));
    };
    // resolve quickly when something is already there, but give the late
    // deliveries their beat; an empty start waits the full window
    setTimeout(finish, voiceCache.length ? wait : wait * 3);
  });
}

// The player's chosen voice, resolved against the live list — WAITING for
// the list when a fresh page hasn't delivered it yet (the whole bug).
async function resolveVoice() {
  const { voice } = getVoicePrefs();
  if (!voice) return null;
  warmVoices();
  if (!voiceCache.length) await listVoices({ wait: 120 });
  return voiceCache.find(v => v.name === voice) || null;
}

let current = null;   // { btn, stop } — the one voice allowed at a time

export function stopSpeaking() {
  if (current) { const c = current; current = null; c.restore(); }
  try { window.speechSynthesis.cancel(); } catch {}
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", stopSpeaking);
}

function speakChunks(chunks, v, onDone) {
  const synth = window.speechSynthesis;
  synth.cancel();
  let i = 0, dead = false;
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
  btn.addEventListener("click", async (e) => {
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
    let kill = null, killed = false;
    current = { btn, restore: () => { killed = true; if (kill) kill(); restore(); } };
    const v = await resolveVoice();   // waits out a fresh page's empty voice list
    if (killed || !current || current.btn !== btn) return;   // stopped during the wait
    kill = speakChunks(chunks, v, () => { if (current && current.btn === btn) current = null; restore(); });
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

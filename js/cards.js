// cards.js — the game card used on the Games list and player profiles.
// If a game has an arcade screen, the card shows it: "live" runs the screen's
// scripts right on the card (an attract mode, like a real cabinet), "static"
// draws it once, "none" keeps the plain text card.
//
// LIVE SCREENS, SIZED TO THE MACHINE THEY RUN ON:
//   · on a PC, a whole room's worth of attract screens runs at once — the
//     reach margin is bigger than a room, so all 24 cabinets play together
//     like a real arcade aisle
//   · on a phone (coarse pointer or narrow screen), live cards follow the
//     scroll instead: only the handful near the viewport run, capped at 5,
//     and the ones you're looking at are always the ones running
// Either way the cap is the seatbelt: past MAX_LIVE running at once,
// newcomers show a static frame until a running one frees the slot.

import { Engine, drawFrame, CANVAS_W, CANVAS_H } from "./engine.js";
import { fmtDate } from "./ui.js";

// Render a scene once into a small JPEG dataURL — the card THUMBNAIL that
// rides on the light cards collection (same trick as model thumbs). Static
// screens become one picture instead of a sack of objects; only LIVE screens
// still carry objects. Returns "" when anything goes wrong (headless, etc).
export function renderThumb(objects, w = CANVAS_W, h = CANVAS_H, maxW = 240, display = "modern") {
  try {
    if (!Array.isArray(objects) || objects.length === 0) return "";
    const full = document.createElement("canvas");
    full.width = w; full.height = h;
    drawFrame(full.getContext("2d"), JSON.parse(JSON.stringify(objects)), { w, h, display });
    const scale = Math.min(1, maxW / w);
    const small = document.createElement("canvas");
    small.width = Math.round(w * scale);
    small.height = Math.round(h * scale);
    const c = small.getContext("2d");
    c.drawImage(full, 0, 0, small.width, small.height);
    const url = small.toDataURL("image/jpeg", 0.65);
    return url.length <= 60000 ? url : small.toDataURL("image/jpeg", 0.4);
  } catch { return ""; }
}

const SMALL = typeof matchMedia !== "undefined"
  && (matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 700px)").matches);
const MAX_LIVE = SMALL ? 5 : 24;        // phone: a handful · PC: the whole room
const NEAR = SMALL ? "300px" : "2600px"; // phone: follow the scroll · PC: the whole room is "near"

const running = new Set();      // cards with a live engine right now
const waiting = new Set();      // visible cards waiting for a free slot
let observer = null;

function stopCard(card) {
  if (card._eng) { try { card._eng.stop(); } catch {} card._eng = null; }
  if (running.delete(card) && waiting.size) {
    // a slot freed — wake the longest-waiting visible card
    const next = waiting.values().next().value;
    waiting.delete(next);
    startCard(next);
  }
}

function startCard(card) {
  if (card._eng || !card.isConnected) return;
  if (running.size >= MAX_LIVE) { waiting.add(card); return; }
  running.add(card);
  card._eng = new Engine(card._canvas, card._screen.objects, {
    input: false, w: card._w, h: card._h,
    display: card._display, hardware: card._hardware   // era-correct attract reels
  });
  card._eng.start();
}

function ensureObserver() {
  if (observer || typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const card = en.target;
      if (en.isIntersecting) startCard(card);
      else { waiting.delete(card); stopCard(card); }
    }
  }, { rootMargin: NEAR });
}

// Pages call this when they re-render their grid: every old card's engine
// stops and the observer forgets them (removed nodes never report "left").
export function resetLiveCardBudget() {
  for (const card of [...running]) { if (card._eng) { try { card._eng.stop(); } catch {} card._eng = null; } }
  running.clear();
  waiting.clear();
  if (observer) { observer.disconnect(); observer = null; }
}

export function gameCard(g, { rootPath = "", showOwner = true } = {}) {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = rootPath + "play.html?id=" + encodeURIComponent(g.id);

  const screen = g.screen;
  const hasObjects = screen && screen.mode !== "none" && screen.objects?.length > 0;
  if (!hasObjects && g.thumb) {
    // a cards-collection card: the screen is one small picture
    const img = document.createElement("img");
    img.src = g.thumb;
    img.alt = g.title || "";
    img.className = "card-screen";
    img.draggable = false;
    card.appendChild(img);
  }
  if (hasObjects) {
    // the card's screen matches the game's own world size (default 480×360)
    const w = Number(g.w) || Number(g.data?.w) || CANVAS_W;
    const h = Number(g.h) || Number(g.data?.h) || CANVAS_H;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.className = "card-screen";
    card.appendChild(canvas);
    // the game's ERA shows on its card too (display from the game's data)
    const dsp = g.display || g.data?.display, hdw = g.hardware || g.data?.hardware;
    // every screen starts as a still frame; live ones wake when scrolled to
    drawFrame(canvas.getContext("2d"), screen.objects, { w, h, display: dsp });
    if (screen.mode === "live") {
      card._canvas = canvas;
      card._screen = screen;
      card._w = w;
      card._h = h;
      card._display = dsp;
      card._hardware = hdw;
      ensureObserver();
      if (observer) observer.observe(card);
      else startCard(card);   // ancient browser: run it (still capped)
    }
  }

  const title = document.createElement("div");
  title.className = "game-title";
  title.textContent = g.title;
  title.title = g.title;             // hover = full name
  card.appendChild(title);

  if (g.description) {
    const desc = document.createElement("div");
    desc.className = "game-desc";
    desc.textContent = g.description;
    card.appendChild(desc);
  }

  const meta = document.createElement("div");
  meta.className = "game-meta";
  const bits = [];
  if (showOwner) bits.push("by " + g.owner);
  bits.push(`${g.plays || 0} plays`);
  bits.push(`▲ ${Number(g.likes) || 0} ▼ ${Number(g.dislikes) || 0}`);
  bits.push(fmtDate(g.createdAt));
  meta.textContent = bits.filter(Boolean).join(" · ");
  card.appendChild(meta);

  const badge = document.createElement("div");
  if (g.casino) {
    badge.className = "price-badge paid";
    badge.textContent = `🎰 pool ◎ ${Number(g.pool) || 0}`;
  } else {
    const price = Number(g.price) || 0;
    badge.className = "price-badge" + (price > 0 ? " paid" : "");
    badge.textContent = price > 0 ? `◎ ${price} / play` : "FREE";
  }
  card.appendChild(badge);

  return card;
}

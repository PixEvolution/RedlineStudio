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
  card._eng = new Engine(card._canvas, card._screen.objects, { input: false, w: card._w, h: card._h });
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
  if (screen && screen.mode !== "none" && screen.objects?.length > 0) {
    // the card's screen matches the game's own world size (default 480×360)
    const w = Number(g.data?.w) || CANVAS_W;
    const h = Number(g.data?.h) || CANVAS_H;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.className = "card-screen";
    card.appendChild(canvas);
    // every screen starts as a still frame; live ones wake when scrolled to
    drawFrame(canvas.getContext("2d"), screen.objects, { w, h });
    if (screen.mode === "live") {
      card._canvas = canvas;
      card._screen = screen;
      card._w = w;
      card._h = h;
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

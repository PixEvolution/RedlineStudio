// cards.js — the game card used on the Games list and player profiles.
// If a game has an arcade screen, the card shows it: "live" runs the screen's
// scripts right on the card (an attract mode, like a real cabinet), "static"
// draws it once, "none" keeps the plain text card.

import { Engine, drawFrame, CANVAS_W, CANVAS_H } from "./engine.js";
import { fmtDate } from "./ui.js";

const MAX_LIVE_CARDS = 12; // keep list pages smooth
let liveCount = 0;

export function resetLiveCardBudget() { liveCount = 0; }

export function gameCard(g, { rootPath = "", showOwner = true } = {}) {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = rootPath + "play.html?id=" + encodeURIComponent(g.id);

  const screen = g.screen;
  if (screen && screen.mode !== "none" && screen.objects?.length > 0) {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.className = "card-screen";
    card.appendChild(canvas);
    if (screen.mode === "live" && liveCount < MAX_LIVE_CARDS) {
      liveCount++;
      const eng = new Engine(canvas, screen.objects);
      eng.start();
    } else {
      drawFrame(canvas.getContext("2d"), screen.objects);
    }
  }

  const title = document.createElement("div");
  title.className = "game-title";
  title.textContent = g.title;
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
  bits.push(fmtDate(g.createdAt));
  meta.textContent = bits.filter(Boolean).join(" · ");
  card.appendChild(meta);

  const price = Number(g.price) || 0;
  const badge = document.createElement("div");
  badge.className = "price-badge" + (price > 0 ? " paid" : "");
  badge.textContent = price > 0 ? `🪙 ${price} / play` : "FREE";
  card.appendChild(badge);

  return card;
}

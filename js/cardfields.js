// cardfields.js — what a game's CARD holds, as pure logic (no database, no
// browser), so the shape is testable and games.js / mod.js share one truth.
//
// A card is the light mirror of a game that list pages read: title, counters,
// a small JPEG thumbnail — and the attract screen's objects ONLY when the
// owner chose LIVE (capped, so no card can smuggle a whole game).

import { cleanRating } from "./ratings.js";

export const THUMB_CAP = 60000;   // a card thumbnail stays a small JPEG
export const LIVE_CAP = 150000;   // a live screen bigger than this ships as a thumb

export function cardFields({ title, owner, ownerUid = null, description = "", price = 0,
  casino = false, unlisted = false, seats = 1, rating = "E", data = null, screen = null, thumb = "" }) {
  const live = !!(screen && screen.mode === "live" && Array.isArray(screen.objects)
    && screen.objects.length > 0 && JSON.stringify(screen.objects).length <= LIVE_CAP);
  return {
    ownerUid,
    title: String(title || "Untitled Game").trim().slice(0, 40),
    ...(owner !== undefined ? { owner: String(owner || "") } : {}),
    description: String(description || "").slice(0, 200),
    price: Math.min(100000, Math.max(0, Math.floor(Number(price) || 0))),
    casino: !!casino,
    unlisted: !!unlisted,
    seats: Math.max(1, Math.min(8, Math.floor(Number(seats) || 1))),
    rating: casino ? "A18" : cleanRating(rating),
    w: Number(data?.w) || null,
    h: Number(data?.h) || null,
    thumb: (typeof thumb === "string" && thumb.startsWith("data:image/") && thumb.length <= THUMB_CAP) ? thumb : "",
    screen: live ? { mode: "live", objects: screen.objects } : { mode: "none", objects: [] },
  };
}

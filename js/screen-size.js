// screen-size.js — how big the CRT is on your monitor.
//
// Two jobs, both about the same complaint ("the screen is tiny"):
//   sharpenCanvas(canvas)      — renders the 480×360 game at DOUBLE resolution
//                                (same logical coordinates, so no game changes),
//                                so scaling the screen up stays crisp
//   attachScreenSizeButton(btn, stage)
//                              — a button that cycles the on-page screen size
//                                S → M → L → MAX; the choice is remembered on
//                                this device and applies to every machine
// The CSS reads the choice from the --screen-max variable on the stage.
// (⛶ Fullscreen is still there for the full-monitor version.)

import { CANVAS_W, CANVAS_H } from "./engine.js";

const KEY = "rl_screen_size_v1";
const SIZES = [["S", "480px"], ["M", "640px"], ["L", "860px"], ["MAX", "none"]];
const DEFAULT = "M";

// Double the canvas's real pixels and scale the context to match, so games
// keep drawing in their own world coordinates (w×h, default 480×360) while
// the glass holds twice that. setTransform (not scale) keeps this safe to
// call any number of times on the same canvas — including when a game's
// world size changes in the Studio.
export function sharpenCanvas(canvas, k = 2, w = CANVAS_W, h = CANVAS_H) {
  if (!canvas) return;
  canvas.width = w * k;
  canvas.height = h * k;
  canvas.getContext("2d").setTransform(k, 0, 0, k, 0, 0);
}

function saved() {
  try {
    const v = localStorage.getItem(KEY);
    return SIZES.some(([n]) => n === v) ? v : DEFAULT;
  } catch { return DEFAULT; }
}

export function applyScreenSize(stage, name = saved()) {
  const size = SIZES.find(([n]) => n === name) || SIZES[1];
  stage.style.setProperty("--screen-max", size[1]);
  return size[0];
}

// The size button: cycles S → M → L → MAX and remembers the choice.
export function attachScreenSizeButton(btn, stage) {
  let current = applyScreenSize(stage);
  const label = () => { btn.textContent = `🖥 ${current}`; };
  btn.title = "Screen size — S, M, L, or as wide as the page goes";
  label();
  btn.addEventListener("click", () => {
    const i = SIZES.findIndex(([n]) => n === current);
    current = SIZES[(i + 1) % SIZES.length][0];
    try { localStorage.setItem(KEY, current); } catch {}
    applyScreenSize(stage, current);
    label();
  });
}

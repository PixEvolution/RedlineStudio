// hardware.js — ERA SIMULATION: display hardware and engine hardware as two
// per-game settings the maker can mix, match, upgrade and revert at any time.
//
// The honest rule that makes "revert anytime" true: every constraint here is
// enforced at the RENDER and SOUND edge only. A 1977 machine flickers its
// over-budget sprites and clamps its colors exactly like the real chip did —
// but collisions, scripts and scores run identically in every era, so
// switching hardware can never corrupt a game, and MODERN brings every pixel
// back. The Studio's 🐞 Debug panel reports what the old chip couldn't do.
//
// DISPLAY (the monitor):            HARDWARE (the video/sound chip):
//   modern   — today's neon CRT       modern   — no limits
//   vector79 — XY phosphor monitor    vector79 — beam budget, no sprites
//   arcade8  — 8-bit raster arcade    arcade8  — 8 sprites/line, 3 colors each
//   tv2600   — home TV via an Atari   tv2600   — 5 movables/line, 1-color sprites
//   bw72     — a 1972 B&W television  logic72  — wired logic: no sprites, 1 voice

// ---- the eras ---------------------------------------------------------------

const hex2 = (n) => ("0" + Math.round(Math.max(0, Math.min(255, n))).toString(16)).slice(-2);
const rgbHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);

// a generated approximation of the Atari TIA's NTSC palette — the real chip
// made 16 hues × 8 luminances = 128 colors, hue 0 being the gray ramp
function tiaPalette() {
  const out = [];
  for (let hue = 0; hue < 16; hue++) {
    for (let lum = 0; lum < 8; lum++) {
      if (hue === 0) { const v = 20 + lum * 33; out.push(rgbHex(v, v, v)); continue; }
      const H = ((hue - 1) * 24 + 250) % 360;
      const L = 0.16 + lum * 0.085, S = 0.62;
      // hsl → rgb
      const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = L - c / 2;
      const k = Math.floor(H / 60);
      const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
      out.push(rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255));
    }
  }
  return out;
}

// the canonical 8-bit arcade/console palette approximation (the famous
// 54-ish usable colors of the 2C02-class chips every tutorial prints)
const ARCADE8_PAL = [
  "#7c7c7c", "#0000fc", "#0000bc", "#4428bc", "#940084", "#a80020", "#a81000", "#881400",
  "#503000", "#007800", "#006800", "#005800", "#004058", "#000000",
  "#bcbcbc", "#0078f8", "#0058f8", "#6844fc", "#d800cc", "#e40058", "#f83800", "#e45c10",
  "#ac7c00", "#00b800", "#00a800", "#00a844", "#008888",
  "#f8f8f8", "#3cbcfc", "#6888fc", "#9878f8", "#f878f8", "#f85898", "#f87858", "#fca044",
  "#f8b800", "#b8f818", "#58d854", "#58f898", "#00e8d8", "#787878",
  "#fcfcfc", "#a4e4fc", "#b8b8f8", "#d8b8f8", "#f8b8f8", "#f8a4c0", "#f0d0b0", "#fce0a8",
  "#f8d878", "#d8f878", "#b8f8b8", "#b8f8d8", "#00fcfc", "#f8d8f8"
];

const BW_PAL = ["#000000", "#242424", "#484848", "#6c6c6c", "#909090", "#b4b4b4", "#d8d8d8", "#ffffff"];

// DISPLAYS — how the monitor shows the frame. px = the era's resolution the
// frame is rendered at before scaling up with hard pixels (null = native);
// palette snaps every color; scan = extra scanline strength; outline = draw
// filled shapes as glowing strokes (an XY monitor has no "fill").
export const DISPLAYS = {
  modern:   { name: "MODERN",        blurb: "today's neon CRT — the engine as it is",            px: null,           palette: null,         scan: 0,    outline: false, bg: null },
  vector79: { name: "VECTOR '79",    blurb: "XY phosphor monitor — glowing strokes, no fills",   px: null,           palette: null,         scan: 0,    outline: true,  bg: "#020503" },
  arcade8:  { name: "ARCADE 8-BIT",  blurb: "8-bit raster arcade — 256×240, the classic colors", px: { w: 256, h: 240 }, palette: ARCADE8_PAL, scan: 0.14, outline: false, bg: "#000000" },
  tv2600:   { name: "HOME TV '77",   blurb: "a 2600 on the living-room set — 160 fat pixels",    px: { w: 208, h: 156 }, palette: tiaPalette(), scan: 0.2,  outline: false, bg: "#000000" },
  bw72:     { name: "B&W TV '72",    blurb: "a 1972 black-and-white television",                 px: { w: 240, h: 180 }, palette: BW_PAL,      scan: 0.22, outline: false, bg: "#000000" },
};

// HARDWARE — what the video/sound chip can DO per frame. Enforced at the
// render/sound edge only (see the header):
//   movables  — moving objects per scan band before the extras flicker
//   bandPx    — the height of a "scanline" band at our resolution
//   sprPerBand— hardware sprites per band (NES-style OAM limit)
//   sprColors — colors one sprite may show at once (0 = sprites impossible:
//               drawn as single-color silhouettes of the era)
//   voices    — simultaneous beep channels (a new sound steals the oldest)
//   beam      — stroke budget before an XY monitor's beam visibly dims
export const HARDWARE = {
  modern:   { name: "MODERN",       blurb: "no limits — the full engine",                                          movables: 0, bandPx: 0,  sprPerBand: 0, sprColors: 0, voices: 0, beam: 0 },
  logic72:  { name: "LOGIC '72",    blurb: "wired TTL chips, no CPU — silhouettes only, one voice",                movables: 6, bandPx: 24, sprPerBand: 0, sprColors: -1, voices: 1, beam: 0 },
  vector79: { name: "VECTOR '79",   blurb: "an XY beam — ~48 strokes before it dims, pixels impossible",           movables: 0, bandPx: 0,  sprPerBand: 0, sprColors: -1, voices: 2, beam: 48 },
  tv2600:   { name: "ATARI 2600",   blurb: "2 players, 2 missiles, a ball per line — 5 movables, 1-color sprites", movables: 5, bandPx: 16, sprPerBand: 0, sprColors: 1,  voices: 2, beam: 0 },
  arcade8:  { name: "ARCADE 8-BIT", blurb: "8 sprites a line (the 9th flickers), 3 colors each, 3 voices",         movables: 0, bandPx: 8,  sprPerBand: 8, sprColors: 3,  voices: 3, beam: 0 },
};

export const displayOf = (k) => DISPLAYS[k] ? k : "modern";
export const hardwareOf = (k) => HARDWARE[k] ? k : "modern";

// ---- color snapping (pure, cached) -----------------------------------------

const snapCache = new Map();
const parseHex = (c) => {
  let s = String(c || "");
  const m3 = /^#([0-9a-f]{3})$/i.exec(s);
  if (m3) s = "#" + m3[1].split("").map((ch) => ch + ch).join("");
  const m = /^#([0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

export function snapColor(color, palette) {
  if (!palette) return color;
  const key = palette === ARCADE8_PAL ? "a" : palette === BW_PAL ? "b" : "t";
  const ck = key + String(color);
  const hit = snapCache.get(ck);
  if (hit) return hit;
  const rgb = parseHex(color);
  if (!rgb) { snapCache.set(ck, color); return color; }   // named/odd colors pass through
  let best = palette[0], bd = Infinity;
  for (const p of palette) {
    const q = parseHex(p);
    const d = (q[0] - rgb[0]) ** 2 + (q[1] - rgb[1]) ** 2 * 1.4 + (q[2] - rgb[2]) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  if (snapCache.size > 4000) snapCache.clear();
  snapCache.set(ck, best);
  return best;
}

// ---- sprite color clamping (pure, cached) -----------------------------------
// A 2600 sprite was ONE color; an 8-bit arcade sprite had 3 + transparent.
// We keep the frame's most-used colors and map the rest to the nearest kept
// one — the art survives, the era shows. budget -1 = silhouette (every lit
// pixel becomes palette slot 1).

const clampCache = new Map();
export function clampSpriteFrame(frame, budget) {
  if (!budget) return frame;
  const f = String(frame);
  const ck = budget + ":" + f;
  const hit = clampCache.get(ck);
  if (hit !== undefined) return hit;
  let out;
  if (budget < 0) {
    out = f.replace(/[1-9a-f]/gi, "1");
  } else {
    const counts = {};
    for (const ch of f) if (ch !== "0") counts[ch] = (counts[ch] || 0) + 1;
    const kept = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, budget);
    if (Object.keys(counts).length <= budget) out = f;
    else {
      const map = {};
      for (const ch of Object.keys(counts)) {
        map[ch] = kept.includes(ch) ? ch
          : kept.reduce((m, k) => Math.abs(parseInt(k, 16) - parseInt(ch, 16)) < Math.abs(parseInt(m, 16) - parseInt(ch, 16)) ? k : m, kept[0]);
      }
      out = f.replace(/[1-9a-f]/gi, (ch) => map[ch.toLowerCase()] || ch);
    }
  }
  if (clampCache.size > 600) clampCache.clear();
  clampCache.set(ck, out);
  return out;
}

// ---- the per-frame hardware plan (pure, headless-testable) -------------------
// Given the visible objects and the tick, decide what the era's chip draws:
// which objects flicker out this frame, how dim the beam runs, what to report.
// `moved` is the engine's judgment of which objects changed position lately
// (static scenery is "playfield" — real chips drew it free).

export function planHardware(objects, tik, hwKey, movedFlag = "_hwMoved") {
  const hw = HARDWARE[hardwareOf(hwKey)];
  const plan = { skip: null, dim: 1, sprColors: hw.sprColors, notes: [] };
  if (hw === HARDWARE.modern) return plan;

  // beam budget: an XY monitor spreads its beam thin past ~48 strokes
  if (hw.beam) {
    let strokes = 0;
    for (const o of objects) {
      if (!o.visible || Number(o.visible) === 0) continue;
      strokes += o.type === "text" ? Math.ceil(String(o.text ?? "").length / 4) : 1;
    }
    if (strokes > hw.beam) {
      plan.dim = Math.max(0.45, hw.beam / strokes);
      plan.notes.push(`VECTOR '79: ${strokes} strokes on a ${hw.beam}-stroke beam — the phosphor dims (draw less to run bright)`);
    }
  }

  // scan-band budgets: count the movables (or sprites) sharing each band;
  // past the budget, the extras FLICKER — drawn on alternating frames with a
  // rotating pick, exactly the trick 8-bit games used
  if (hw.bandPx && (hw.movables || hw.sprPerBand)) {
    const bands = {};
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      if (!o.visible || Number(o.visible) === 0) continue;
      const counted = hw.sprPerBand ? o.type === "sprite" : (o[movedFlag] || o.type === "sprite");
      if (!counted) continue;
      const band = Math.floor((Number(o.y) || 0) / hw.bandPx);
      (bands[band] = bands[band] || []).push(i);
    }
    const budget = hw.sprPerBand || hw.movables;
    for (const band in bands) {
      const row = bands[band];
      if (row.length <= budget) continue;
      // rotate which ones draw this frame (budget of N from the row)
      const offset = tik % row.length;
      for (let k = budget; k < row.length; k++) {
        const idx = row[(offset + k) % row.length];
        (plan.skip = plan.skip || new Set()).add(idx);
      }
      plan.notes.push(`${hw.name}: ${row.length} moving objects share a scan band (budget ${budget}) — the extras flicker, like the real chip`);
    }
  }
  return plan;
}

// ---- what the maker reads in the Studio -------------------------------------

export function describeEra(displayKey, hardwareKey) {
  const d = DISPLAYS[displayOf(displayKey)], h = HARDWARE[hardwareOf(hardwareKey)];
  if (d === DISPLAYS.modern && h === HARDWARE.modern) return "";
  return `${d.name} display · ${h.name} hardware — era limits shape the picture and sound only; the game's logic never changes, and MODERN reverts everything.`;
}

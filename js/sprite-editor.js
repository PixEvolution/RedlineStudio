// sprite-editor.js — 🎨 the pixel sprite editor: draw characters and
// animations pixel by pixel, right in the Studio. A sprite is frames of
// hex characters ("0" transparent, "1".."f" the palette), so everything
// here is string surgery — the pure helpers below are the whole art
// program, and the DOM around them is just brushes.
//
// The museum rebuilds stay primitives on purpose; sprites are for the
// players' own games (and for Models — an animated character sells on
// the Market like anything else).

import { SPRITE_PAL, SPRITE_SIZES, SPRITE_MAX_FRAMES, blankFrame } from "./engine.js";

// ---------------------------------------------------------------------------
// pure pixel surgery (unit-tested; no DOM anywhere near them)
// ---------------------------------------------------------------------------

export function getPix(frame, s, x, y) {
  if (x < 0 || y < 0 || x >= s || y >= s) return 0;
  return parseInt(frame[y * s + x], 16) || 0;
}

export function setPix(frame, s, x, y, v) {
  if (x < 0 || y < 0 || x >= s || y >= s) return frame;
  const i = y * s + x;
  return frame.slice(0, i) + (Number(v) || 0).toString(16) + frame.slice(i + 1);
}

export function floodFill(frame, s, x, y, v) {
  const from = getPix(frame, s, x, y);
  const to = Number(v) || 0;
  if (from === to || x < 0 || y < 0 || x >= s || y >= s) return frame;
  const px = frame.split("");
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= s || cy >= s) continue;
    const i = cy * s + cx;
    if ((parseInt(px[i], 16) || 0) !== from) continue;
    px[i] = to.toString(16);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return px.join("");
}

export function flipH(frame, s) {
  let out = "";
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) out += frame[y * s + (s - 1 - x)];
  }
  return out;
}

export function flipV(frame, s) {
  let out = "";
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) out += frame[(s - 1 - y) * s + x];
  }
  return out;
}

// nudge the whole drawing, wrapping round the edges
export function shiftFrame(frame, s, dx, dy) {
  let out = "";
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const sx = ((x - dx) % s + s) % s;
      const sy = ((y - dy) % s + s) % s;
      out += frame[sy * s + sx];
    }
  }
  return out;
}

// nearest-neighbour rescale between the three grid sizes
export function resizeFrame(frame, from, to) {
  if (from === to) return frame;
  let out = "";
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      const sx = Math.min(from - 1, Math.floor(x * from / to));
      const sy = Math.min(from - 1, Math.floor(y * from / to));
      out += frame[sy * from + sx];
    }
  }
  return out;
}

// paint one frame onto any 2d context (thumbnails, the preview, anything)
export function paintFrame(ctx, frame, s, px, pal = SPRITE_PAL) {
  for (let i = 0; i < s * s && i < frame.length; i++) {
    const v = parseInt(frame[i], 16);
    if (!v) continue;
    ctx.fillStyle = pal[v] || "#ffffff";
    ctx.fillRect((i % s) * px, Math.floor(i / s) * px, px + 0.3, px + 0.3);
  }
}

// ---------------------------------------------------------------------------
// the editor panel
// ---------------------------------------------------------------------------

const EDIT_W = 264;

export function mountSpriteEditor(container, { onEdit = () => {}, onStructure = () => {} } = {}) {
  const st = { o: null, fi: 0, tool: "pen", color: 8, down: false, erasing: false };

  container.innerHTML = "";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px";
  const row2 = document.createElement("div");
  row2.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start";
  const left = document.createElement("div");
  const right = document.createElement("div");
  right.style.cssText = "display:flex;flex-direction:column;gap:8px;min-width:120px";
  row2.append(left, right);
  container.append(bar, row2);

  // ---- tools
  const toolBtns = {};
  const mkBtn = (label, title, fn) => {
    const b = document.createElement("button");
    b.className = "btn btn-small btn-ghost";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", fn);
    bar.appendChild(b);
    return b;
  };
  for (const [t, label, title] of [
    ["pen", "✏️", "Pencil — left mouse paints, right mouse erases"],
    ["eraser", "🩹", "Eraser"],
    ["fill", "🪣", "Fill a connected area"],
  ]) {
    toolBtns[t] = mkBtn(label, title, () => { st.tool = t; syncTools(); });
  }
  const syncTools = () => {
    for (const t in toolBtns) toolBtns[t].style.outline = st.tool === t ? "1px solid #39ff5e" : "none";
  };
  mkBtn("↔", "Flip horizontally", () => edit((f, s) => flipH(f, s)));
  mkBtn("↕", "Flip vertically", () => edit((f, s) => flipV(f, s)));
  mkBtn("⬅", "Nudge left (wraps)", () => edit((f, s) => shiftFrame(f, s, -1, 0)));
  mkBtn("➡", "Nudge right (wraps)", () => edit((f, s) => shiftFrame(f, s, 1, 0)));
  mkBtn("⬆", "Nudge up (wraps)", () => edit((f, s) => shiftFrame(f, s, 0, -1)));
  mkBtn("⬇", "Nudge down (wraps)", () => edit((f, s) => shiftFrame(f, s, 0, 1)));
  mkBtn("🧹", "Clear this frame", () => edit((f, s) => blankFrame(s)));

  // grid size
  const sizeSel = document.createElement("select");
  sizeSel.className = "blk-add";
  sizeSel.style.margin = "0";
  sizeSel.title = "Grid size — resizing rescales every frame";
  for (const z of SPRITE_SIZES) {
    const opt = document.createElement("option");
    opt.value = z; opt.textContent = z + "×" + z;
    sizeSel.appendChild(opt);
  }
  sizeSel.addEventListener("change", () => {
    if (!st.o) return;
    const to = Number(sizeSel.value);
    const from = st.o.sprite.s;
    if (to === from) return;
    st.o.sprite.frames = st.o.sprite.frames.map((f) => resizeFrame(f, from, to));
    st.o.sprite.s = to;
    redrawAll(); onStructure();
  });
  bar.appendChild(sizeSel);

  // ---- the drawing canvas
  const cv = document.createElement("canvas");
  cv.width = EDIT_W; cv.height = EDIT_W;
  cv.style.cssText = "border:1px solid #2a3a4a;border-radius:6px;cursor:crosshair;touch-action:none;image-rendering:pixelated;background:#0a1410";
  left.appendChild(cv);
  const cx2 = cv.getContext("2d");

  // ---- palette
  const palRow = document.createElement("div");
  palRow.style.cssText = "display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin-top:8px;max-width:264px";
  left.appendChild(palRow);
  const swatches = [];
  SPRITE_PAL.forEach((c, i) => {
    const sw = document.createElement("button");
    sw.title = i === 0 ? "Transparent (eraser color)" : "Color " + i.toString(16);
    sw.style.cssText = "height:22px;border-radius:4px;border:1px solid #2a3a4a;cursor:pointer;" +
      (i === 0
        ? "background:repeating-conic-gradient(#223 0% 25%, #112 0% 50%) 0 0/8px 8px"
        : "background:" + c);
    sw.addEventListener("click", () => { st.color = i; st.tool = i === 0 ? "eraser" : (st.tool === "eraser" ? "pen" : st.tool); syncPal(); syncTools(); });
    palRow.appendChild(sw);
    swatches.push(sw);
  });
  const syncPal = () => swatches.forEach((sw, i) => { sw.style.outline = i === st.color ? "2px solid #39ff5e" : "none"; });

  // ---- frames strip + fps + preview
  const framesLabel = document.createElement("label");
  framesLabel.textContent = "Frames";
  const strip = document.createElement("div");
  strip.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;max-width:140px";
  const frameBar = document.createElement("div");
  frameBar.style.cssText = "display:flex;gap:4px;flex-wrap:wrap";
  const fAdd = document.createElement("button");
  fAdd.className = "btn btn-small btn-ghost"; fAdd.textContent = "＋"; fAdd.title = "Add a blank frame";
  const fDup = document.createElement("button");
  fDup.className = "btn btn-small btn-ghost"; fDup.textContent = "⧉"; fDup.title = "Duplicate this frame";
  const fDel = document.createElement("button");
  fDel.className = "btn btn-small btn-ghost"; fDel.textContent = "✕"; fDel.title = "Delete this frame";
  frameBar.append(fAdd, fDup, fDel);
  const fpsLabel = document.createElement("label");
  fpsLabel.textContent = "FPS (0 = script drives self.frame)";
  const fpsIn = document.createElement("input");
  fpsIn.type = "number"; fpsIn.min = 0; fpsIn.max = 30; fpsIn.step = 1;
  fpsIn.title = "Frames per second — 0 means scripts set self.frame themselves";
  const prevLabel = document.createElement("label");
  prevLabel.textContent = "Preview";
  const prev = document.createElement("canvas");
  prev.width = 96; prev.height = 96;
  prev.style.cssText = "border:1px solid #2a3a4a;border-radius:6px;background:#0a1410;image-rendering:pixelated";
  right.append(framesLabel, strip, frameBar, fpsLabel, fpsIn, prevLabel, prev);

  fAdd.addEventListener("click", () => {
    if (!st.o || st.o.sprite.frames.length >= SPRITE_MAX_FRAMES) return;
    st.o.sprite.frames.splice(st.fi + 1, 0, blankFrame(st.o.sprite.s));
    st.fi++;
    redrawAll(); onStructure();
  });
  fDup.addEventListener("click", () => {
    if (!st.o || st.o.sprite.frames.length >= SPRITE_MAX_FRAMES) return;
    st.o.sprite.frames.splice(st.fi + 1, 0, st.o.sprite.frames[st.fi]);
    st.fi++;
    redrawAll(); onStructure();
  });
  fDel.addEventListener("click", () => {
    if (!st.o || st.o.sprite.frames.length <= 1) return;
    st.o.sprite.frames.splice(st.fi, 1);
    st.fi = Math.max(0, st.fi - 1);
    redrawAll(); onStructure();
  });
  fpsIn.addEventListener("input", () => {
    if (!st.o) return;
    st.o.fps = Math.max(0, Math.min(30, Number(fpsIn.value) || 0));
    onEdit();
  });

  // ---- painting
  const cellAt = (e) => {
    const r = cv.getBoundingClientRect();
    const s = st.o.sprite.s;
    const px = EDIT_W / s;
    return [
      Math.floor((e.clientX - r.left) / (r.width / EDIT_W) / px),
      Math.floor((e.clientY - r.top) / (r.height / EDIT_W) / px),
    ];
  };
  const applyTool = (x, y, erase) => {
    const s = st.o.sprite.s;
    const v = erase || st.tool === "eraser" ? 0 : st.color;
    const f = st.o.sprite.frames[st.fi];
    const nf = st.tool === "fill" && !erase ? floodFill(f, s, x, y, v) : setPix(f, s, x, y, v);
    if (nf !== f) {
      st.o.sprite.frames[st.fi] = nf;
      drawGrid(); drawStrip();
      onEdit();
    }
  };
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("pointerdown", (e) => {
    if (!st.o) return;
    cv.setPointerCapture(e.pointerId);
    st.down = true;
    st.erasing = e.button === 2;
    const [x, y] = cellAt(e);
    applyTool(x, y, st.erasing);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!st.o || !st.down || st.tool === "fill") return;
    const [x, y] = cellAt(e);
    applyTool(x, y, st.erasing);
  });
  cv.addEventListener("pointerup", () => { st.down = false; st.erasing = false; });

  // ---- drawing the editor
  function drawGrid() {
    if (!st.o) return;
    const s = st.o.sprite.s;
    const px = EDIT_W / s;
    cx2.clearRect(0, 0, EDIT_W, EDIT_W);
    // transparent checker
    cx2.fillStyle = "#101a22";
    for (let y = 0; y < s; y++) for (let x = (y % 2); x < s; x += 2) cx2.fillRect(x * px, y * px, px, px);
    paintFrame(cx2, st.o.sprite.frames[st.fi], s, px);
    cx2.strokeStyle = "rgba(90,110,130,0.25)";
    cx2.lineWidth = 1;
    for (let i = 0; i <= s; i++) {
      cx2.beginPath(); cx2.moveTo(i * px, 0); cx2.lineTo(i * px, EDIT_W); cx2.stroke();
      cx2.beginPath(); cx2.moveTo(0, i * px); cx2.lineTo(EDIT_W, i * px); cx2.stroke();
    }
  }
  function drawStrip() {
    strip.innerHTML = "";
    if (!st.o) return;
    const s = st.o.sprite.s;
    st.o.sprite.frames.forEach((f, i) => {
      const th = document.createElement("canvas");
      th.width = 32; th.height = 32;
      th.style.cssText = "border-radius:4px;cursor:pointer;background:#0a1410;image-rendering:pixelated;border:" +
        (i === st.fi ? "2px solid #39ff5e" : "1px solid #2a3a4a");
      paintFrame(th.getContext("2d"), f, s, 32 / s);
      th.title = "Frame " + (i + 1);
      th.addEventListener("click", () => { st.fi = i; drawGrid(); drawStrip(); });
      strip.appendChild(th);
    });
  }
  function redrawAll() {
    if (!st.o) return;
    st.fi = Math.max(0, Math.min(st.o.sprite.frames.length - 1, st.fi));
    sizeSel.value = st.o.sprite.s;
    fpsIn.value = Number(st.o.fps) || 0;
    drawGrid(); drawStrip(); syncPal(); syncTools();
  }

  // ---- the looping preview
  let pframe = 0, ptick = 0;
  const pcx = prev.getContext("2d");
  const loop = () => {
    if (st.o && container.offsetParent !== null) {
      const sp = st.o.sprite;
      const fps = Number(st.o.fps) > 0 ? Number(st.o.fps) : 6;
      ptick += fps / 60;
      if (ptick >= 1) { pframe += Math.floor(ptick); ptick %= 1; }
      const f = sp.frames[pframe % sp.frames.length];
      pcx.clearRect(0, 0, 96, 96);
      paintFrame(pcx, f, sp.s, 96 / sp.s);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    setObject(o) {
      st.o = (o && o.type === "sprite" && o.sprite) ? o : null;
      if (st.o && !Array.isArray(st.o.sprite.frames)) st.o.sprite.frames = [blankFrame(st.o.sprite.s || 16)];
      if (st.o) redrawAll();
    },
  };
}

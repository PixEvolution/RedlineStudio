// Headless test: 🎨 SPRITES — player pixel art as a first-class object type.
// The sprite object (frames, self.frame, self.fps auto-play), crisp pixel
// rendering, box-shaped touching, the gamefile's pixel sanitizer, model
// round-trips, and the editor's pure pixel surgery.
import { Engine, drawFrame, makeObject, SPRITE_PAL, STARTER_SPRITE, blankFrame } from "./js/engine.js";
import { packGame, unpackGame } from "./js/gamefile.js";
import { getPix, setPix, floodFill, flipH, flipV, shiftFrame, resizeFrame } from "./js/sprite-editor.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

// a counting mock context: enough of canvas2d for drawFrame
const mockCtx = () => {
  const calls = { rects: [], fills: [] };
  return {
    calls,
    save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, stroke() {}, fill() {}, fillText() {}, strokeRect() {},
    setLineDash() {},
    fillRect(x, y, w, h) { calls.rects.push([x, y, w, h, this.fillStyle]); },
    set fillStyle(v) { this._f = v; calls.fills.push(v); },
    get fillStyle() { return this._f; },
  };
};
// count only sprite-pixel rects (small squares), not the background/scanlines
const pixelRects = (ctx) => ctx.calls.rects.filter(([, , w, h]) => w < 10 && h < 10 && w === h);

console.log("Sprites:");

// ---- the object
{
  const o = makeObject("sprite", "hero", 100, 100);
  check("makeObject builds a 16×16 one-frame sprite with fps 0",
    o.type === "sprite" && o.sprite.s === 16 && o.sprite.frames.length === 1
    && o.frame === 0 && o.fps === 0 && o.glow === 0);
  check("the starter slime is 256 clean hex characters",
    STARTER_SPRITE.length === 256 && /^[0-9a-f]+$/.test(STARTER_SPRITE));
  check("the palette holds 16 entries, index 0 transparent",
    SPRITE_PAL.length === 16 && SPRITE_PAL[0] === "transparent");
}

// ---- rendering: one rect per lit pixel, transparent skipped
{
  const o = makeObject("sprite", "hero", 100, 100);
  const lit = [...STARTER_SPRITE].filter((c) => c !== "0").length;
  const ctx = mockCtx();
  drawFrame(ctx, [o], {});
  check("drawFrame paints exactly the lit pixels (" + lit + ")", pixelRects(ctx).length === lit);
  const ctx2 = mockCtx();
  o.angle = 45;
  drawFrame(ctx2, [o], {});
  check("…and a rotated sprite still paints them all", pixelRects(ctx2).length === lit);
  o.angle = 0;
  // frame picks the frame
  o.sprite.frames.push(blankFrame(16));
  o.frame = 1;
  const ctx3 = mockCtx();
  drawFrame(ctx3, [o], {});
  check("self.frame picks the frame (a blank one paints nothing)", pixelRects(ctx3).length === 0);
  o.frame = -2;   // wraps, never crashes
  const ctx4 = mockCtx();
  drawFrame(ctx4, [o], {});
  check("out-of-range frames wrap instead of crashing", pixelRects(ctx4).length === lit);
}

// ---- fps auto-play and script control
{
  const o = makeObject("sprite", "hero", 100, 100);
  o.sprite.frames = [blankFrame(16), blankFrame(16), blankFrame(16)];
  o.fps = 6;
  const e = new Engine(null, [o]);
  e.runEvents("start");
  for (let i = 0; i < 10; i++) e.step();   // 10 ticks at 6fps = 1 frame
  const live = e.objects[0];
  check("fps 6 advances one frame per ten ticks", live.frame === 1);
  for (let i = 0; i < 20; i++) e.step();
  check("…and wraps around the loop", live.frame === 0);
  // scripts drive frame and fps like any property
  const o2 = makeObject("sprite", "hero", 100, 100);
  o2.sprite.frames = [blankFrame(16), blankFrame(16)];
  o2.script = [{ event: "code", source: "when tick\nset self.frame to 1\nset self.fps to 0\nend" }];
  const e2 = new Engine(null, [o2]);
  check("sprite scripts compile clean", e2.errors.length === 0);
  e2.step();
  check("set self.frame / self.fps work from RedScript", e2.objects[0].frame === 1 && e2.objects[0].fps === 0);
}

// ---- touching: a sprite is box-shaped
{
  const a = makeObject("sprite", "hero", 100, 100);   // size 32 → half 16
  const b = makeObject("dot", "pel", 118, 100);       // 18 apart: 16 + 4 > 18
  b.size = 4;
  const probe = makeObject("text", "referee", 0, 0);
  probe.script = [{ event: "code", source: "when tick\nset hit to touching(hero, pel)\nend" }];
  const e = new Engine(null, [a, b, probe]);
  e.step();
  check("touching() treats the sprite like a box", e.vars.hit === 1);
  e.objects[1].x = 140;
  e.step();
  check("…and clear daylight is a miss", e.vars.hit === 0);
}

// ---- the gamefile: pixels in, pixels out — and nothing else
{
  const o = makeObject("sprite", "hero", 100, 100);
  o.fps = 8; o.frame = 0;
  o.sprite.frames.push(flipH(STARTER_SPRITE, 16));
  const packed = packGame({ title: "Sprite Game", objects: [o] });
  const back = unpackGame(packed);
  const ro = back.objects[0];
  check("a sprite survives the .rlgame round-trip",
    ro.type === "sprite" && ro.sprite.s === 16 && ro.sprite.frames.length === 2
    && ro.sprite.frames[0] === STARTER_SPRITE && ro.fps === 8);
  // a hostile file: junk characters, oversized frames, too many of them
  const evil = JSON.parse(packed);
  evil.objects[0].sprite = {
    s: 16,
    frames: [
      "<script>alert(1)</script>" + "z".repeat(400),
      ...Array(20).fill(STARTER_SPRITE),
    ],
    pal: ["transparent", "javascript:alert(1)", "#ff0000", ...Array(13).fill("#00ff00")],
  };
  delete evil.sig;
  const canon = JSON.stringify(evil);
  const resealed = JSON.stringify({ ...evil, sig: (await import("./js/gamefile.js")).hashStr(canon) });
  const cleaned = unpackGame(resealed);
  const sp = cleaned.objects[0].sprite;
  check("junk characters become transparent pixels (hex letters survive as colors)",
    /^[0-9a-f]{256}$/.test(sp.frames[0]) && sp.frames[0][0] === "0" && !sp.frames[0].includes("z"));
  check("frames are capped at 8", sp.frames.length === 8);
  check("a poisoned palette color is neutralized", sp.pal[1] === "#ffffff" && sp.pal[0] === "transparent" && sp.pal[2] === "#ff0000");
  // non-sprite objects never grow sprite fields
  const plain = unpackGame(packGame({ title: "t", objects: [makeObject("box", "b", 0, 0)] }));
  check("plain objects stay plain", !("sprite" in plain.objects[0]) && !("fps" in plain.objects[0]));
}

// ---- models carry sprites (deep copy, like everything else)
{
  const o = makeObject("sprite", "hero", 100, 100);
  const copy = JSON.parse(JSON.stringify([o]));
  copy[0].sprite.frames[0] = blankFrame(16);
  check("model copies are deep — editing the copy never touches the original",
    o.sprite.frames[0] === STARTER_SPRITE);
}

// ---- the editor's pure pixel surgery
{
  const s = 16;
  let f = blankFrame(s);
  f = setPix(f, s, 3, 2, 8);
  check("setPix lights one pixel", getPix(f, s, 3, 2) === 8 && [...f].filter(c => c !== "0").length === 1);
  check("setPix off the grid is a no-op", setPix(f, s, -1, 0, 5) === f && setPix(f, s, 16, 0, 5) === f);
  // flood fill: a box outline, fill the inside
  let g = blankFrame(s);
  for (let i = 2; i <= 8; i++) { g = setPix(g, s, i, 2, 1); g = setPix(g, s, i, 8, 1); g = setPix(g, s, 2, i, 1); g = setPix(g, s, 8, i, 1); }
  const filled = floodFill(g, s, 5, 5, 7);
  check("floodFill fills the inside of a shape and stops at its edge",
    getPix(filled, s, 5, 5) === 7 && getPix(filled, s, 3, 3) === 7
    && getPix(filled, s, 0, 0) === 0 && getPix(filled, s, 2, 2) === 1);
  // flips are involutions
  check("flipH twice is the identity", flipH(flipH(STARTER_SPRITE, s), s) === STARTER_SPRITE);
  check("flipV twice is the identity", flipV(flipV(STARTER_SPRITE, s), s) === STARTER_SPRITE);
  check("flipH turns the googly slime's gaze the other way", flipH(STARTER_SPRITE, s) !== STARTER_SPRITE);
  // shifts wrap and undo
  const sh = shiftFrame(STARTER_SPRITE, s, 3, -2);
  check("shiftFrame wraps and reverses cleanly", shiftFrame(sh, s, -3, 2) === STARTER_SPRITE && sh !== STARTER_SPRITE);
  // resize round numbers
  const up = resizeFrame(STARTER_SPRITE, 16, 24);
  const down = resizeFrame(up, 24, 8);
  check("resizeFrame produces the right pixel counts", up.length === 576 && down.length === 64);
  check("an upscaled sprite keeps its lit share",
    Math.abs([...up].filter(c => c !== "0").length / 576 - [...STARTER_SPRITE].filter(c => c !== "0").length / 256) < 0.1);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// Headless test: Pitfall! (1982) — 255 screens from one 8-bit counter.
// The polynomial counter (maximal period, invertible, 32 treasure bytes),
// jumping, tar pits, holes to the tunnel, croc jaws, the vine, logs,
// cobras, ladders, scorpions, walls, the 3-screen tunnel skip, the clock,
// and the perfect run.
import { Engine } from "./js/engine.js";
import { buildPitfallExample } from "./studio/example-pitfall.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fwd = (r) => ((r * 2) % 256) + (((r >> 7) ^ (r >> 5) ^ (r >> 4) ^ (r >> 3)) & 1);
const bwd = (r) => (r >> 1) + 128 * (((r & 1) ^ (r >> 6) ^ (r >> 5) ^ (r >> 4)) & 1);
const fresh = () => {
  const e = new Engine(null, buildPitfallExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 210); e.step(); };
const toScene = (e, scr) => { e.vars.scr = scr; e.vars.dealflag = 1; e.vars.px = 40; e.vars.py = 258; e.vars.pvy = 0; e.vars.under = 0; e.vars.swinging = 0; e.vars.itim = 0; e.step(); };
// find a byte with the wanted p (low 3 bits) and q (bits 3-5)
const findByte = (p, q, u = null) => {
  for (let v = 1; v < 256; v++) {
    if (v % 8 === p && Math.floor(v / 8) % 8 === q && (u === null || Math.floor(v / 64) === u)) return v;
  }
  return null;
};

console.log("Pitfall! (1982):");

// ---- the cabinet
{
  const ex = buildPitfallExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("titled Pitfall! (1982)", ex.title === "Pitfall! (1982)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to RUN", JSON.stringify(eng.usedSticks()) === "[1]");
  check("subline states the 4KB miracle as plain fact",
    ex.objects.find(o => o.name === "subline").text === "ACTIVISION 1982 · 255 SCREENS, 1 BYTE");
}

// ---- the counter IS the world
{
  let r = 6; const seen = new Set();
  for (let i = 0; i < 255; i++) { seen.add(r); r = fwd(r); }
  check("the register walks all 255 screens and comes home", r === 6 && seen.size === 255 && !seen.has(0));
  let inv = true;
  for (let v = 1; v < 256; v++) if (bwd(fwd(v)) !== v) inv = false;
  check("one step left undoes one step right — for every byte", inv);
  let tcount = 0;
  for (const v of seen) if (Math.floor(v / 8) % 8 === 4) tcount++;
  check("the bits hide exactly 32 treasures, like the cartridge", tcount === 32);
  // the engine runs the same register
  const e = fresh(); play(e);
  let exp = 6, okF = true;
  for (let i = 0; i < 8; i++) {
    e.vars.px = 467; e.vars.py = 258; e.vars.pvy = 0; e.vars.swinging = 0; e.step();
    exp = fwd(exp);
    if (e.vars.scr !== exp) okF = false;
  }
  check("running right steps the engine's register forward", okF);
  let okB = true;
  for (let i = 0; i < 8; i++) {
    e.vars.px = 13; e.vars.py = 258; e.vars.pvy = 0; e.step();
    exp = bwd(exp);
    if (e.vars.scr !== exp) okB = false;
  }
  check("running left runs the world BACKWARD to the start", okB && e.vars.scr === 6);
}

// ---- the tunnel passes three screens a flip
{
  const e = fresh(); play(e);
  toScene(e, findByte(2, 0, 1));     // holes screen, tunnel open on the right
  e.vars.under = 1; e.vars.py = 328;
  const s0 = e.vars.scr;
  e.vars.px = 467; e.step();
  check("one tunnel flip = three register steps", e.vars.scr === fwd(fwd(fwd(s0))));
  check("…and you stay in the tunnel", e.vars.under === 1);
  e.vars.px = 13; e.vars.py = 328; e.step();
  check("three steps back the other way", e.vars.scr === s0);
}

// ---- running and jumping
{
  const e = fresh(); play(e);
  const x0 = e.vars.px;
  e.keys["d"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["d"] = false;
  check("the runner runs", e.vars.px > x0 + 30);
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  let apex = 258;
  for (let i = 0; i < 40; i++) { e.step(); apex = Math.min(apex, e.vars.py); }
  check("a jump clears ~45px and lands again", apex < 225 && e.vars.py === 258);
}

// ---- the tar pit swallows; the holes only drop you
{
  const e = fresh(); play(e);
  toScene(e, findByte(0, 5));        // tar pit, no logs
  e.vars.px = 240; e.vars.py = 258;  // standing over the pit
  const lives0 = e.vars.lives;
  for (let i = 0; i < 60; i++) e.step();
  check("stand over the tar and it takes you", e.vars.lives === lives0 - 1);
  const e2 = fresh(); play(e2);
  toScene(e2, findByte(2, 5, 3));    // holes screen, wall-left tunnel (no scorpion)
  e2.vars.px = 175; e2.vars.py = 258; // over the left hole
  const lives2 = e2.vars.lives;
  for (let i = 0; i < 120; i++) e2.step();
  check("a hole is a door, not a death: down to the tunnel",
    e2.vars.under === 1 && Math.abs(e2.vars.py - 328) < 2 && e2.vars.lives === lives2);
  // the ladder brings you home
  e2.vars.px = 240;
  e2.keys["w"] = true;
  for (let i = 0; i < 6; i++) e2.step();
  e2.keys["w"] = false;
  check("W on the ladder climbs back to daylight", e2.vars.under === 0 && e2.vars.py === 258);
}

// ---- crocodiles: closed jaws hold, open jaws end you
{
  const e = fresh(); play(e);
  toScene(e, findByte(4, 5));        // croc pond, no logs
  // force jaws: all closed
  e.vars.tik = 0;                     // co_k computed from tik each tick
  // stand on the middle croc with jaws closed: find a tik where co1 == 0
  let t = 0;
  while (((t + 45) % 140) < 55) t++;  // co1 closed at this tik
  e.vars.tik = t - 1;
  e.vars.px = 240; e.vars.py = 252; e.vars.pvy = 0;
  const lives0 = e.vars.lives;
  e.step();
  check("closed jaws are a platform", e.vars.lives === lives0 && Math.abs(e.vars.py - 252) < 2);
  // open jaws: find tik where co1 == 1 and stand there falling into it
  let t2 = 0;
  while (((t2 + 45) % 140) >= 55) t2++;
  const e3 = fresh(); play(e3);
  toScene(e3, findByte(4, 5));
  e3.vars.tik = t2 - 1;
  e3.vars.px = 240; e3.vars.py = 258; e3.vars.pvy = 0.5;
  const lives3 = e3.vars.lives;
  for (let i = 0; i < 30; i++) e3.step();
  check("open jaws — or the water — eat you", e3.vars.lives === lives3 - 1);
}

// ---- the vine: grab mid-air, let go, fly
{
  const e = fresh(); play(e);
  const v = findByte(0, 5, 1);       // tar pit + bit6 set → vine on
  toScene(e, v);
  check("the vine hangs over the pit", e.vars.vineon === 1);
  e.step();
  e.vars.px = e.vars.vtx; e.vars.py = e.vars.vty + 8; e.vars.pvy = 0.2;
  e.step();
  check("jump into the vine and you swing", e.vars.swinging === 1);
  const sx0 = e.vars.px;
  for (let i = 0; i < 25; i++) e.step();
  check("…and the vine carries you", Math.abs(e.vars.px - sx0) > 8);
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  check("jump again to let go, flung onward", e.vars.swinging === 0 && Math.abs(e.vars.pvx) > 2);
}

// ---- logs cost points, not lives
{
  const e = fresh(); play(e);
  toScene(e, findByte(6, 0));        // flat ground, one log
  e.vars.itim = 0;
  e.lists.lgx[0] = e.vars.px + 5;
  const sc0 = e.vars.score, lives0 = e.vars.lives;
  e.step();
  check("a rolling log takes 100 points", e.vars.score === sc0 - 100 && e.vars.lives === lives0);
  e.lists.lgx[0] = e.vars.px + 5;
  e.step();
  check("…but not twice in one tumble (brief grace)", e.vars.score === sc0 - 100);
}

// ---- cobra and campfire
{
  const e = fresh(); play(e);
  toScene(e, findByte(6, 3));        // flat + cobra
  e.vars.px = 340; e.vars.py = 258; e.vars.itim = 0;
  const l0 = e.vars.lives;
  e.step();
  check("the cobra bites", e.vars.lives === l0 - 1);
  const e2 = fresh(); play(e2);
  toScene(e2, findByte(6, 2));       // flat + fire
  e2.vars.px = 340; e2.vars.py = 258; e2.vars.itim = 0;
  const l2 = e2.vars.lives;
  e2.step();
  check("the campfire burns", e2.vars.lives === l2 - 1);
}

// ---- treasure: taken once, remembered by the byte
{
  const e = fresh(); play(e);
  const tb = findByte(6, 4);         // flat treasure screen
  toScene(e, tb);
  check("the treasure gleams on its screen", e.vars.treon === 1);
  e.vars.px = 420; e.vars.py = 258;
  const sc0 = e.vars.score, kind = e.vars.tkind;
  e.step();
  check("grabbing pays its tier", e.vars.score === sc0 + 2000 + kind * 1000 && e.vars.got === 1);
  toScene(e, fwd(tb));
  toScene(e, tb);
  check("walk away and back: the byte remembers it is taken", e.vars.treon === 0);
}

// ---- scorpion and walls keep the tunnel honest
{
  const e = fresh(); play(e);
  const sb = findByte(2, 5, 1);      // holes + scorpion tunnel
  toScene(e, sb);
  check("a scorpion keeps this tunnel", e.vars.scorpon === 1);
  e.vars.under = 1; e.vars.py = 328; e.vars.px = 200; e.vars.sx = 205; e.vars.itim = 0;
  const l0 = e.vars.lives;
  e.step();
  check("its sting is fatal", e.vars.lives === l0 - 1);
  const e2 = fresh(); play(e2);
  toScene(e2, findByte(2, 5, 0));    // wall on the tunnel's right
  e2.vars.under = 1; e2.vars.py = 328; e2.vars.px = 440;
  e2.step();
  check("the brick wall stops you underground", e2.vars.px <= 410);
}

// ---- the clock, the last life, the perfect run
{
  const e = fresh(); play(e);
  e.vars.tleft = 2;
  e.step(); e.step();
  check("3:00 runs out: the jungle closes", e.vars.game === 2 && e.vars.endplay === 1);
  const e2 = fresh(); play(e2);
  e2.vars.lives = 1;
  toScene(e2, findByte(6, 3));
  e2.vars.px = 340; e2.vars.itim = 0;
  e2.step(); e2.step();
  check("the last life ends the run", e2.vars.game === 2 && e2.vars.endplay === 1);
  const e3 = fresh(); play(e3);
  toScene(e3, findByte(6, 4));
  e3.vars.got = 31;
  e3.vars.px = 420; e3.vars.py = 258;
  const sc0 = e3.vars.score, kind = e3.vars.tkind;
  e3.step();
  check("the 32nd treasure: perfect run, +10000, done",
    e3.vars.game === 2 && e3.vars.endplay === 1
    && e3.vars.score === sc0 + 2000 + kind * 1000 + 10000);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

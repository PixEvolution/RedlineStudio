// Headless test: Pole Position (1982) — qualify, then race.
// The circuit tables, gears, cornering push, offroad and crashes, the
// qualifying cut and the grid, traffic passes and rear-endings, lap
// checkpoints, the checkered flag, and the clock running out.
import { Engine } from "./js/engine.js";
import { buildPolePositionExample } from "./studio/example-poleposition.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const LAPLEN = 2494;
const fresh = () => {
  const e = new Engine(null, buildPolePositionExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 206); e.step(); };
const qualify = (e, gridWanted = 1) => {   // skip qualifying by driving the lap perfectly
  e.keys["w"] = true;
  let shifted = false, t = 0;
  while (e.vars.phase === 0 && e.vars.game === 0 && t < 4000) {
    if (!shifted && e.vars.v >= 125) { e.keys["Space"] = true; e.step(); e.keys["Space"] = false; shifted = true; t++; continue; }
    e.vars.playerx = 0;
    if (e.vars.curseg === 1 && e.vars.v > 128) e.keys["s"] = true; else e.keys["s"] = false;
    e.step(); t++;
  }
  e.keys["w"] = false; e.keys["s"] = false;
  if (gridWanted > 1) { /* grid comes from the lap; tests that need a worse grid set vars directly */ }
};
const L = (eng, n) => eng.lists[n] || (eng.lists[n] = {});
const noTraffic = (e) => { for (let c = 0; c < 6; c++) L(e, "con")[c] = 0; };

console.log("Pole Position (1982):");

// ---- the cabinet
{
  const ex = buildPolePositionExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("titled Pole Position (1982)", ex.title === "Pole Position (1982)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to DRIVE", JSON.stringify(eng.usedSticks()) === "[1]");
  check("fourteen road strips project the circuit", ex.objects.filter(o => o.name.startsWith("roadstrip")).length === 14);
  check("the circuit is a real lap: eleven segments and the hairpin",
    (() => { const e = fresh(); return e.lists.segc[1] === 4.5 && e.lists.segs[1] === 600; })());
}

// ---- gears: LO launches, HI flies
{
  const e = fresh(); play(e);
  e.keys["w"] = true;
  for (let i = 0; i < 200; i++) { e.vars.playerx = 0; e.step(); }
  check("LO tops out around 132", e.vars.v <= 132 && e.vars.v > 125);
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  for (let i = 0; i < 400; i++) { e.vars.playerx = 0; e.step(); }
  e.keys["w"] = false;
  check("HI pulls to 240 — 306 km/h on the dial", e.vars.v === 240);
  const e2 = fresh(); play(e2);
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  e2.keys["w"] = true;
  for (let i = 0; i < 60; i++) { e2.vars.playerx = 0; e2.step(); }
  e2.keys["w"] = false;
  check("launching in HI lugs the engine", e2.vars.v < 25);
}

// ---- the corner pushes; the grass grabs; speed offroad wrecks you
{
  const e = fresh(); play(e);
  e.vars.v = 220; e.vars.pos = 620;        // mid-hairpin
  e.keys["w"] = true;
  for (let i = 0; i < 30; i++) e.step();
  e.keys["w"] = false;
  check("the hairpin at 220 throws you outward", Math.abs(e.vars.playerx) > 0.5);
  const e2 = fresh(); play(e2);
  e2.vars.v = 100; e2.vars.playerx = 1.2;  // on the grass, slow
  const v0 = e2.vars.v;
  for (let i = 0; i < 30; i++) e2.step();
  check("slow on the grass just drags", e2.vars.crash === 0 && e2.vars.v < v0);
  const e3 = fresh(); play(e3);
  e3.vars.v = 200; e3.vars.playerx = 1.2;  // on the grass, fast
  e3.step(); e3.step();
  check("fast on the grass is a WRECK", e3.vars.crash > 0 && e3.vars.v === 0);
  for (let i = 0; i < 110; i++) e3.step();
  check("…and the wreck clears after a hundred ticks", e3.vars.crash === 0);
}

// ---- qualifying: the cut and the grid
{
  const e = fresh(); play(e);
  check("you start in qualifying, alone", e.vars.phase === 0 && [0, 1, 2, 3, 4, 5].every(c => !e.lists.con || !e.lists.con[c]));
  qualify(e);
  check("a perfect lap takes POLE (grid 1, +2000 total grid pay)",
    e.vars.phase === 1 && e.vars.grid === 1 && e.vars.score === 1600 + 1800);
  check("the race deals six rivals and 60 seconds", [0, 1, 2, 3, 4, 5].every(c => e.lists.con[c] === 1) && e.vars.rtime >= 3590);
  // a too-slow lap goes home
  const e2 = fresh(); play(e2);
  e2.vars.qt = 2800;                        // over the cut already
  e2.vars.pos = LAPLEN - 1; e2.vars.v = 100;
  for (let i = 0; i < 10; i++) e2.step();
  check("over 45.0 and the machine sends you home", e2.vars.game === 2 && e2.vars.endplay === 1);
  // a mid lap seeds a mid grid
  const e3 = fresh(); play(e3);
  e3.vars.qt = 2300;                        // 38.3s
  e3.vars.pos = LAPLEN - 1; e3.vars.v = 100;
  for (let i = 0; i < 10; i++) e3.step();
  check("38.3s seats you mid-grid", e3.vars.phase === 1 && e3.vars.grid === 3);
}

// ---- traffic: passes pay, rear-endings wreck
{
  const e = fresh(); play(e); qualify(e);
  noTraffic(e);
  L(e, "con")[0] = 1; L(e, "cpos")[0] = e.vars.pos + 30; L(e, "clx")[0] = 0.45;
  L(e, "cv")[0] = 0.2; L(e, "prel")[0] = 30;
  e.vars.playerx = -0.45; e.vars.v = 200;  // clean other lane
  const sc0 = e.vars.score, p0 = e.vars.passes;
  e.keys["w"] = true;
  for (let i = 0; i < 60; i++) { e.vars.playerx = -0.45; e.step(); }
  e.keys["w"] = false;
  check("a clean pass in the other lane pays 50", e.vars.passes === p0 + 1 && e.vars.score === sc0 + 50 && e.vars.crash === 0);
  const e2 = fresh(); play(e2); qualify(e2);
  noTraffic(e2);
  L(e2, "con")[0] = 1; L(e2, "cpos")[0] = e2.vars.pos + 8; L(e2, "clx")[0] = 0;
  L(e2, "cv")[0] = 0.2; L(e2, "prel")[0] = 8;
  e2.vars.playerx = 0; e2.vars.v = 220; e2.vars.crash = 0;
  e2.step();
  check("the back of a slower car is a WRECK", e2.vars.crash > 0);
}

// ---- laps, the flag, and the clock
{
  const e = fresh(); play(e); qualify(e);
  noTraffic(e);
  const sc0 = e.vars.score, rt0 = e.vars.rtime;
  e.vars.pos = LAPLEN - 1; e.vars.v = 150;
  for (let i = 0; i < 5; i++) { e.vars.playerx = 0; e.step(); }
  check("a lap pays 1000 and +35 seconds", e.vars.laps === 1 && e.vars.score >= sc0 + 1000 && e.vars.rtime > rt0 + 2000);
  e.vars.laps = 3;
  e.vars.pos = LAPLEN - 1;
  const sc1 = e.vars.score;
  for (let i = 0; i < 5; i++) { e.vars.playerx = 0; e.step(); }
  check("the CHECKERED FLAG: +2000 and the clock pays out",
    e.vars.game === 2 && e.vars.endplay === 1 && e.vars.score >= sc1 + 2000);
  const e2 = fresh(); play(e2); qualify(e2);
  noTraffic(e2);
  e2.vars.rtime = 2;
  e2.step(); e2.step();
  check("out of time: the race is over where you stand", e2.vars.game === 2 && e2.vars.endplay === 1);
}

// ---- the road projects — and WARNS
{
  // the Night Driver lesson: a corner must bend the horizon before it
  // bends under the wheels. 100 units out, the hairpin is already drawn.
  const ew = fresh(); play(ew);
  ew.vars.pos = 500; ew.vars.playerx = 0; ew.vars.v = 0;
  ew.step();
  check("the hairpin bends the horizon 100 units before it arrives",
    ew.lists.rsx[13] - 240 > 60 && Math.abs(ew.lists.rsx[1] - 240) < 5);
  ew.vars.pos = 300; ew.step();
  check("…and a genuinely straight road draws straight", Math.abs(ew.lists.rsx[13] - 240) < 5);
  ew.vars.pos = 560; ew.step();
  check("…sweeping lower down the road as it gets closer", ew.lists.rsx[11] - 240 > 4 && ew.lists.rsx[13] - 240 > 120);
  const e = fresh(); play(e);
  e.vars.v = 150; e.vars.pos = 660;         // deep in the hairpin
  for (let i = 0; i < 40; i++) { e.vars.playerx = 0; e.keys["w"] = true; e.step(); }
  e.keys["w"] = false;
  check("in the hairpin the far road bends away harder than the near road",
    (e.lists.rsx[13] - 240) > (e.lists.rsx[2] - 240) + 40);
  e.vars.playerx = 0.8;
  e.step();
  check("your lane position shifts the whole road the other way", e.lists.rsx[0] < 240 - 100);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

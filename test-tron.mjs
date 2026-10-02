// Headless test: Tron (1982) — four duels on one credit.
// Light cycles (walls forever, no reverse, AI avoidance), banked tank
// shells, the tower siege, the descending cone, the stage chain, shared
// lives, and the grid winning.
import { Engine } from "./js/engine.js";
import { buildTronExample } from "./studio/example-tron.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const CC = 38, CR = 24;
const fresh = () => {
  const e = new Engine(null, buildTronExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 204); e.step(); };
const L = (eng, n) => eng.lists[n] || (eng.lists[n] = {});
// advance by actually winning the current stage
const advance = (e) => {
  if (e.vars.stg === 1) {
    for (let k = 1; k < 4; k++) L(e, "calive")[k] = 0;
    e.step();
  } else if (e.vars.stg === 2) {
    for (let k = 0; k < 3; k++) L(e, "ton")[k] = 0;
    e.vars.pdie = 0;
    e.step();
  } else if (e.vars.stg === 3) {
    e.vars.ttm = 1;
    for (let b = 0; b < 8; b++) L(e, "bgon")[b] = 0;
    e.vars.bspawn = 9999;
    e.step();
    e.vars.px = 240; e.vars.py = 90;
    e.step();
  }
};
const DK = ["d", "s", "a", "w"];
const releaseAll = (e) => { for (const k of [...DK, "Space"]) e.keys[k] = false; };

console.log("Tron (1982):");

// ---- the cabinet
{
  const ex = buildTronExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("titled Tron (1982)", ex.title === "Tron (1982)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to MOVE", JSON.stringify(eng.usedSticks()) === "[1]");
  check("72 trail segments stand ready for the cycles",
    ex.objects.filter(o => o.name.startsWith("trail")).length === 72);
  check("56 blocks build the cone", ex.objects.filter(o => o.name.startsWith("coneblock")).length === 56);
}

// ---- stage 1: light cycles
{
  const e = fresh(); play(e);
  check("one credit opens on LIGHT CYCLES, round 1, one rival", e.vars.stg === 1 && e.lists.calive[1] === 1 && e.lists.calive[2] === 0);
  // walls are forever: ride straight into your rival's trail
  const e2 = fresh(); play(e2);
  // build a wall dead ahead of the player
  const r = e2.lists.ccy[0], c = e2.lists.ccx[0];
  for (let i = 1; i <= 3; i++) e2.lists.trail[r * CC + (c + 2)] = 2;
  for (let i = 0; i < 20; i++) e2.step();
  check("a trail in your path deresolves you", e2.vars.lives === 2);
  // no reverse: pressing left while riding right does nothing
  const e3 = fresh(); play(e3);
  e3.keys["a"] = true;
  for (let i = 0; i < 12; i++) e3.step();
  releaseAll(e3);
  check("a cycle never reverses", e3.lists.cdir[0] === 0);
  // turns claim fresh wall segments
  const nt0 = e3.lists.nt[0];
  e3.keys["s"] = true;
  for (let i = 0; i < 8; i++) e3.step();
  releaseAll(e3);
  check("a turn starts a new wall segment", e3.lists.cdir[0] === 1 && e3.lists.nt[0] === nt0 + 1);
  // box the rival in and it crashes for 400
  const e4 = fresh(); play(e4);
  const sc0 = e4.vars.score;
  const kc = e4.lists.ccx[1], kr = e4.lists.ccy[1];
  for (let rr = 0; rr < CR; rr++) for (let cc2 = 0; cc2 < CC; cc2++) {
    if (Math.abs(cc2 - kc) + Math.abs(rr - kr) === 2) e4.lists.trail[rr * CC + cc2] = 1;
  }
  for (let i = 0; i < 40 && e4.vars.stg === 1; i++) e4.step();
  check("a boxed-in rival eats the wall: +400 and the grid is yours",
    e4.vars.score >= sc0 + 400 && e4.vars.stg === 2);
}

// ---- stage 2: battle tanks
{
  const e = fresh(); play(e); advance(e);
  check("stage 2 deals the maze and three hunters", e.vars.stg === 2 && [0, 1, 2].every(k => e.lists.ton[k] === 1));
  // the banked shot: fire at a wall, it reflects once
  const e2 = fresh(); play(e2); advance(e2);
  // keep one far, slow tank alive so the stage doesn't clear mid-flight
  e2.lists.ton[1] = 0; e2.lists.ton[2] = 0;
  e2.lists.tx[0] = 430; e2.lists.ty[0] = 70; e2.lists.tcool[0] = 99999;
  e2.vars.px = 60; e2.vars.py = 300; e2.vars.fdir = 3;   // firing up at the border
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  let banked = false, gone = false;
  for (let i = 0; i < 150; i++) {
    e2.step();
    if (e2.vars.sb === 1 && e2.lists.son[0] === 1) banked = true;
    if (e2.lists.son[0] === 0) { gone = true; break; }
  }
  check("your shell BANKS off the first wall and dies on the second", banked && gone);
  // kill all three → next stage
  const e3 = fresh(); play(e3); advance(e3);
  const sc3 = e3.vars.score;
  e3.lists.ton[1] = 0; e3.lists.ton[2] = 0;
  e3.lists.tx[0] = e3.vars.px + 50; e3.lists.ty[0] = e3.vars.py;
  e3.vars.fdir = 0; e3.vars.grace = 0;
  e3.keys["Space"] = true; e3.step(); e3.keys["Space"] = false;
  for (let i = 0; i < 30 && e3.vars.stg === 2; i++) { e3.lists.tx[0] = e3.vars.px + 50 - i * 4; e3.lists.ty[0] = e3.vars.py; e3.step(); }
  check("the last tank down pays 500 and opens THE TOWER", e3.vars.score >= sc3 + 500 && e3.vars.stg === 3);
  // a hunter's shell ends you
  const e4 = fresh(); play(e4); advance(e4);
  e4.vars.grace = 0;
  L(e4, "eson")[0] = 1; L(e4, "esx")[0] = e4.vars.px; L(e4, "esy")[0] = e4.vars.py;
  L(e4, "esvx")[0] = 0; L(e4, "esvy")[0] = 0;
  e4.step();
  check("a hunter's shell costs a program (and the stage restarts)", e4.vars.lives === 2 && e4.vars.stg === 2);
}

// ---- stage 3: the tower
{
  const e = fresh(); play(e); advance(e); advance(e);
  check("stage 3 raises the tower with 6 integrity and a timer", e.vars.stg === 3 && e.vars.integ === 6 && e.vars.ttm === 720);
  // a bug that reaches the tower chews it
  L(e, "bgon")[0] = 1; L(e, "bgx")[0] = 244; L(e, "bgy")[0] = 92;
  e.vars.bspawn = 9999;
  e.step();
  check("a bug at the tower chews its integrity", e.vars.integ === 5 && L(e, "bgon")[0] === 0);
  // shoot one
  L(e, "bgon")[0] = 1; L(e, "bgx")[0] = e.vars.px + 40; L(e, "bgy")[0] = e.vars.py;
  e.vars.fdx = 1; e.vars.fdy = 0;
  const sc0 = e.vars.score;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  for (let i = 0; i < 20; i++) { L(e, "bgx")[0] = L(e, "bgon")[0] ? e.vars.px + 40 : L(e, "bgx")[0]; e.step(); }
  check("a bug shot pays 100", e.vars.score >= sc0 + 100);
  // the window opens; walking in clears with an integrity bonus
  e.vars.ttm = 1;
  for (let b = 0; b < 8; b++) L(e, "bgon")[b] = 0;
  e.vars.bspawn = 9999;
  e.step();
  e.vars.px = 240; e.vars.py = 90;
  const sc1 = e.vars.score, integ = e.vars.integ;
  e.step();
  check("the open window pays 1000 + 100 an integrity point, on to THE CONE",
    e.vars.stg === 4 && e.vars.score === sc1 + 1000 + integ * 100);
  // the tower falling is fatal
  const e2 = fresh(); play(e2); advance(e2); advance(e2);
  e2.vars.integ = 1; e2.vars.grace = 60;
  L(e2, "bgon")[0] = 1; L(e2, "bgx")[0] = 244; L(e2, "bgy")[0] = 92;
  e2.vars.bspawn = 9999;
  e2.step();
  check("the tower falling costs the program", e2.vars.lives === 2);
}

// ---- stage 4: the cone
{
  const e = fresh(); play(e); advance(e); advance(e); advance(e);
  check("stage 4 hangs all 56 blocks of the cone", e.vars.stg === 4
    && [...Array(56).keys()].every(i => e.lists.con2[i] === 1));
  // shoot a block out of the wall
  const sc0 = e.vars.score;
  e.vars.px = 240; e.vars.py = 320; e.vars.grace = 0;
  let hit = false;
  for (let tr = 0; tr < 12 && !hit; tr++) {
    e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
    for (let i = 0; i < 40; i++) { e.step(); if (e.vars.score > sc0) { hit = true; break; } }
  }
  check("a shot carves a block from the wall (+50)", hit);
  // the gap is a door: clear a full column line and fly through
  const e2 = fresh(); play(e2); advance(e2); advance(e2); advance(e2);
  for (let i = 0; i < 56; i++) e2.lists.con2[i] = 0;    // the wall is gone entirely
  e2.vars.grace = 0;
  const sc2 = e2.vars.score;
  e2.keys["w"] = true;
  for (let i = 0; i < 130 && e2.vars.level === 1; i++) e2.step();
  releaseAll(e2);
  check("through the gap to the CORE: +2000 and round 2 begins",
    e2.vars.level === 2 && e2.vars.stg === 1 && e2.vars.score >= sc2 + 2000);
  // flying into a block is fatal
  const e3 = fresh(); play(e3); advance(e3); advance(e3); advance(e3);
  e3.vars.grace = 0;
  e3.vars.px = 48 + (0 * 27 + e3.vars.bofs) % 378; e3.vars.py = 96 + e3.vars.bdy;
  e3.step();
  check("flying into the wall of the cone is fatal", e3.vars.lives === 2);
  // the cone coming down is fatal too
  const e4 = fresh(); play(e4); advance(e4); advance(e4); advance(e4);
  e4.vars.bdy = 180; e4.vars.grace = 0;
  e4.vars.px = 60; e4.vars.py = 330;
  e4.step();
  check("…and so is letting it descend on you", e4.vars.lives === 2);
}

// ---- round 2 is meaner; the last program ends it
{
  const e = fresh(); play(e);
  e.vars.level = 2; e.vars.stgdone = 1;
  e.vars.stg = 4;                       // completing stage 4 rolls the round
  e.step();
  check("round 2 fields two rival cycles", e.vars.stg === 1 && e.lists.calive[1] === 1 && e.lists.calive[2] === 1);
  const e2 = fresh(); play(e2);
  e2.vars.lives = 1;
  const r = e2.lists.ccy[0], c = e2.lists.ccx[0];
  e2.lists.trail[r * CC + (c + 2)] = 2;
  for (let i = 0; i < 20; i++) e2.step();
  check("the last program down: the grid wins", e2.vars.game === 2 && e2.vars.endplay === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

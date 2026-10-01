// Headless test: Defender (1980) — the wrapping planet, momentum flight,
// the abduction loop (grab → haul → mutant), the falling catch, smart
// bombs, the scanner, the lost planet, and wave economics.
import { Engine } from "./js/engine.js";
import { buildDefenderExample } from "./studio/example-defender.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const W2 = 1920, GROUND = 332;
const fresh = () => {
  const e = new Engine(null, buildDefenderExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 214); e.step(); };
const noSpawns = (e) => { e.vars.landleft = 99; e.vars.spawnt = 99999; };   // 99 owed = the wave never 'clears'
const benchFoes = (e) => { for (let k = 0; k < 8; k++) e.lists.lst[k] = 0; };
const wrapd = (a, b) => { let d = (a - b + W2 * 2) % W2; if (d > W2 / 2) d -= W2; return d; };
// place lander k in a state at world (x, y)
const putLander = (e, k, st, x, y) => {
  const L = (n) => e.lists[n] || (e.lists[n] = {});   // lists are born on first write
  L("lst")[k] = st; L("lx2")[k] = x; L("ly2")[k] = y;
  L("ltg")[k] = -1; L("hgrab")[k] = -1;
};

console.log("Defender (1980):");
{
  const ex = buildDefenderExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick on the THRUST", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "THRUST"));
  check("ten humanoids, eight lander slots, a ridge line, a SCANNER",
    ex.objects.filter(o => /^humanoid\d/.test(o.name)).length === 10
    && ex.objects.filter(o => /^lander\d/.test(o.name)).length === 8
    && ex.objects.filter(o => /^ridge\d/.test(o.name)).length >= 20
    && ex.objects.filter(o => /^scanhum\d/.test(o.name)).length === 10);
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin starts wave 1: 3 ships, 2 smart bombs, all ten alive",
    e.vars.game === 0 && e.vars.lives === 3 && e.vars.sbombs === 2 && e.vars.humleft === 10);
}

console.log("Momentum flight over a wrapping planet:");
{
  const e = fresh();
  play(e);
  benchFoes(e); noSpawns(e);
  e.vars.px = 240; e.vars.pvx = 0;
  e.keys["d"] = true;
  for (let i = 0; i < 30; i++) e.step();
  e.keys["d"] = false;
  const v = e.vars.pvx;
  check("thrust builds speed, and facing follows", v > 2 && e.vars.facing === 1);
  for (let i = 0; i < 20; i++) e.step();
  check("…and momentum carries after the burn", e.vars.pvx > v * 0.5);
  check("the ship sits off-centre, looking ahead", e.byName.defship.x === 160);
  e.keys["a"] = true;
  for (let i = 0; i < 8; i++) e.step();
  e.keys["a"] = false;
  check("reversing flips the facing before the speed", e.vars.facing === -1 && e.vars.pvx > 0);
  // the wrap
  e.vars.px = 30; e.vars.pvx = -6;
  for (let i = 0; i < 10; i++) e.step();
  check("the planet wraps end to end", e.vars.px > W2 - 200);
}

console.log("The abduction loop:");
{
  const e = fresh();
  play(e);
  benchFoes(e); noSpawns(e);
  e.vars.px = 1200; e.vars.pvx = 0;        // far from the scene
  e.lists.hon[0] = 1; e.lists.hx[0] = 300; e.lists.hy[0] = GROUND; e.lists.htk[0] = 0;
  putLander(e, 0, 1, 360, 90);
  for (let i = 0; i < 120 && e.lists.lst[0] === 1; i++) { e.step(); e.vars.px = 1200; }
  check("a lander seeks its humanoid and begins the drop", e.lists.lst[0] === 2
    && Math.abs(wrapd(e.lists.lx2[0], e.lists.hx[0])) < 20);
  for (let i = 0; i < 250 && e.lists.lst[0] === 2; i++) { e.step(); e.vars.px = 1200; }
  check("…grabs it at the ground", e.lists.lst[0] === 3 && e.lists.hon[0] === 2);
  const hy0 = e.lists.hy[0];
  for (let i = 0; i < 20; i++) { e.step(); e.vars.px = 1200; }
  check("…and hauls it skyward", e.lists.hy[0] < hy0 - 10);
  for (let i = 0; i < 400 && e.lists.lst[0] === 3; i++) { e.step(); e.vars.px = 1200; }
  check("reaching the top: the humanoid is LOST, the lander is a MUTANT",
    e.lists.lst[0] === 4 && e.lists.hon[0] === 0 && e.vars.humleft === 9);
  // a mutant hunts
  const d0 = Math.abs(wrapd(e.lists.lx2[0], e.vars.px));
  for (let i = 0; i < 60; i++) { e.step(); e.vars.px = 1200; e.vars.py = 180; }
  check("…and the mutant CLOSES on you", Math.abs(wrapd(e.lists.lx2[0], e.vars.px)) < d0 - 60);
}

console.log("The catch:");
{
  const e = fresh();
  play(e);
  benchFoes(e); noSpawns(e);
  // a hauler at altitude with a captive
  e.lists.hon[0] = 2; e.lists.hx[0] = 600; e.lists.hy[0] = 254; e.lists.htk[0] = 1;
  putLander(e, 0, 3, 600, 240);
  e.lists.hgrab[0] = 0;
  // shoot it: park the ship level with it, close by, facing right
  e.vars.px = 520; e.vars.py = 240; e.vars.pvx = 0; e.vars.facing = 1;
  const sc0 = e.vars.score;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  for (let i = 0; i < 20 && e.lists.lst[0] === 3; i++) { e.step(); e.vars.px = 520; e.vars.py = 240; }
  check("shooting the hauler pays 150 — and the humanoid FALLS",
    e.lists.lst[0] === 0 && e.vars.score === sc0 + 150 && e.lists.hon[0] === 3);
  // fly into it
  for (let i = 0; i < 40 && e.lists.hon[0] === 3; i++) {
    e.vars.px = e.lists.hx[0]; e.vars.py = e.lists.hy[0];
    e.step();
  }
  check("caught mid-air: +500, set down safe on the ground",
    e.lists.hon[0] === 1 && e.lists.hy[0] === GROUND && e.vars.score === sc0 + 150 + 500);
  // dropped from high with no catch: it does not survive
  const e2 = fresh();
  play(e2);
  benchFoes(e2); noSpawns(e2);
  e2.vars.px = 1500;
  e2.lists.hon[1] = 3; e2.lists.hx[1] = 300; e2.lists.hy[1] = 100;
  (e2.lists.hfs || (e2.lists.hfs = {}))[1] = 240;
  const hl = e2.vars.humleft;
  for (let i = 0; i < 160 && e2.lists.hon[1] === 3; i++) { e2.step(); e2.vars.px = 1500; }
  check("a long fall uncaught is a humanoid lost", e2.lists.hon[1] === 0 && e2.vars.humleft === hl - 1);
}

console.log("Smart bombs and the scanner:");
{
  const e = fresh();
  play(e);
  noSpawns(e);
  benchFoes(e);
  e.vars.px = 900; e.vars.py = 180;
  putLander(e, 0, 4, 1000, 150);           // on screen
  putLander(e, 1, 4, 1040, 200);           // on screen
  putLander(e, 2, 4, 200, 150);            // far away — out of the blast
  const sc0 = e.vars.score;
  e.keys["b"] = true; e.step(); e.keys["b"] = false; e.step();
  check("B clears the GLASS, not the planet: two die, the far one lives",
    e.lists.lst[0] === 0 && e.lists.lst[1] === 0 && e.lists.lst[2] === 4
    && e.vars.score === sc0 + 300 && e.vars.sbombs === 1);
  e.keys["b"] = true; e.step(); e.keys["b"] = false; e.step();
  e.keys["b"] = true; e.step(); e.keys["b"] = false; e.step();
  check("…and two a wave is the whole allowance", e.vars.sbombs === 0);
  // the scanner tells the truth
  e.vars.px = 400;
  e.step();
  check("the scanner tracks the ship across the whole planet",
    Math.abs(e.byName.scanship.x - (8 + 400 * 0.242)) < 3);
  check("…and the far mutant's dot burns red on it",
    e.byName.scanfoe3.visible === 1
    && Math.abs(e.byName.scanfoe3.x - (8 + e.lists.lx2[2] * 0.242)) < 4);
}

console.log("The lost planet, the wave, the end:");
{
  const e = fresh();
  play(e);
  noSpawns(e);
  benchFoes(e);
  putLander(e, 0, 1, 600, 90);
  for (let i = 0; i < 10; i++) e.lists.hon[i] = 0;
  e.vars.humleft = 0;
  e.step();
  check("all ten gone: the planet is LOST — every lander turns mutant",
    e.vars.planetlost === 1 && e.lists.lst[0] === 4);
  // wave clear pays the survivors
  const e2 = fresh();
  play(e2);
  benchFoes(e2);
  e2.vars.landleft = 0; e2.vars.humleft = 7;
  const sc = e2.vars.score;
  e2.step();
  check("a held wave pays 100 a survivor and re-arms the bombs",
    e2.vars.score === sc + 700 && e2.vars.wave === 2 && e2.vars.sbombs === 2);
  // the end
  const e3 = fresh();
  play(e3);
  noSpawns(e3); benchFoes(e3);
  e3.vars.lives = 1; e3.vars.grace = 0;
  putLander(e3, 0, 4, e3.vars.px, 180);
  e3.vars.py = 180;
  e3.step(); e3.step();
  check("the last ship ends the defense (endplay + ★ table)",
    e3.vars.game === 2 && Number(e3.vars.endplay) === 1);
  e3.fireClick(10, 10); e3.step();
  check("a click after the end returns to attract", e3.vars.game === 9);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Headless test: Star Raiders (1979) — the cockpit, the galactic chart,
// hyperwarp and its price, Zylons that shoot back AND advance on the
// starbases, docking, and the rank at the end of a career.
import { Engine } from "./js/engine.js";
import { buildStarraidersExample } from "./studio/example-starraiders.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildStarraidersExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 220); e.step(); };
const tap = (e, key) => { e.keys[key] = true; e.step(); e.keys[key] = false; e.step(); };
const zTotal = (e) => { let t = 0; for (let s = 0; s < 16; s++) t += e.lists.zs[s] || 0; return t; };
// open the chart, aim the cursor at a sector, press ENTER, fly the warp out
const warpTo = (e, sec) => {
  if (e.vars.mode !== 1) tap(e, "m");
  while ((e.vars.cx | 0) < sec % 4) tap(e, "d");
  while ((e.vars.cx | 0) > sec % 4) tap(e, "a");
  while ((e.vars.cyy | 0) < Math.floor(sec / 4)) tap(e, "s");
  while ((e.vars.cyy | 0) > Math.floor(sec / 4)) tap(e, "w");
  tap(e, "Enter");
  for (let i = 0; i < 60 && e.vars.warpt > 0; i++) e.step();
  e.step();
};

console.log("Star Raiders (1979):");
{
  const ex = buildStarraidersExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick at the HELM", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "HELM"));
  check("a 4×4 galactic chart of 16 cells", ex.objects.filter(o => o.name.startsWith("cell")).length === 16);
  check("a streaming starfield out the window", ex.objects.filter(o => o.name.startsWith("star")).length === 14);
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("launch: full energy, 8 Zylons out there, sector 2-2, cockpit view",
    e.vars.game === 0 && e.vars.energy === 9999 && e.vars.zleft === 8
    && e.vars.psec === 5 && e.vars.mode === 0);
  check("home sector is quiet — CONDITION GREEN", String(e.byName.condtx.text).includes("GREEN"));
}

console.log("The galactic chart:");
{
  const e = fresh();
  play(e);
  tap(e, "m");
  check("M opens the chart over the cockpit", e.vars.mode === 1
    && e.byName.cell0.visible === 1 && e.byName.crosshair.visible === 0);
  check("the chart tells the truth: Z for Zylons, ◊ for bases",
    e.byName.cell0.text === "ZZ" && e.byName.cell3.text === "◊" && e.byName.cell7.text === "Z");
  check("…and you glow green where you are", e.byName.cell5.text === "▲");
  tap(e, "d");
  check("WASD walks the warp cursor", e.vars.cx === 2 && e.vars.cyy === 1);
  check("the warp line quotes the price", String(e.byName.warpline.text).includes("WARP COST 80"));
  tap(e, "m");
  check("M again returns to the cockpit", e.vars.mode === 0);
}

console.log("Hyperwarp has a price:");
{
  const e = fresh();
  play(e);
  warpTo(e, 7);                           // two sectors east: 160 energy
  check("ENTER engages: two sectors cost 160 energy", e.vars.psec === 7
    && e.vars.mode === 0 && e.vars.energy <= 9999 - 160 && e.vars.energy > 9999 - 200);
  // refused when the tank can't pay
  const e2 = fresh();
  play(e2);
  e2.vars.energy = 100;
  tap(e2, "m");
  tap(e2, "d"); tap(e2, "d");
  tap(e2, "Enter"); e2.step();
  check("…and refuses a warp the tank can't pay for", e2.vars.psec === 5
    && String(e2.byName.status.text).includes("NOT ENOUGH ENERGY"));
}

console.log("Condition red:");
{
  const e = fresh();
  play(e);
  warpTo(e, 7);                           // one Zylon lives here
  check("arriving in a hot sector deals its fighters", e.vars.z1on === 1 && e.vars.z2on === 0
    && String(e.byName.condtx.text).includes("RED"));
  // steering pans the whole view — the fighter slides against the helm
  const z = e.byName.zylon1;
  z.x = 300; e.vars.z1z = 60;
  e.keys["d"] = true;
  for (let i = 0; i < 10; i++) e.step();
  e.keys["d"] = false;
  check("steering pans the view — the fighter slides opposite", z.x < 295);
  // a torpedo needs AIM
  z.x = 60; z.y = 60;
  const en0 = e.vars.energy, sc0 = e.vars.score;
  tap(e, "Space");
  for (let i = 0; i < 14; i++) e.step();
  check("a wild shot misses — and still cost 10 energy", e.vars.z1on === 1
    && e.vars.score === sc0 && e.vars.energy <= en0 - 10);
  // dead centre
  z.x = 240; z.y = 180; e.vars.z1z = 20;
  tap(e, "Space");
  for (let i = 0; i < 14; i++) e.step();
  check("a centred shot kills (+100) and clears the sector", e.vars.z1on === 0
    && e.vars.score === sc0 + 100 && e.vars.zleft === 7
    && String(e.byName.status.text).includes("SECTOR CLEARED"));
  // they shoot back
  const e2 = fresh();
  play(e2);
  warpTo(e2, 0);                          // two Zylons here
  check("a ZZ sector deals two fighters", e2.vars.z1on === 1 && e2.vars.z2on === 1 && e2.vars.z3on === 0);
  const en1 = e2.vars.energy;
  e2.vars.z1f = 1;
  e2.step(); e2.step();
  check("Zylon fire costs 150 energy and flashes the shields",
    e2.vars.energy <= en1 - 150 && e2.byName.hitflash.visible === 1);
}

console.log("The fleet does not wait:");
{
  const e = fresh();
  play(e);
  const before = JSON.stringify(Array.from({ length: 16 }, (_, s) => e.lists.zs[s] || 0));
  e.vars.movet = 599;
  e.step();
  const after = JSON.stringify(Array.from({ length: 16 }, (_, s) => e.lists.zs[s] || 0));
  check("every few seconds a squadron crawls toward a base", before !== after);
  check("…without losing a single ship in the move", zTotal(e) === e.vars.zleft);
  // a base falls when they reach it
  const e2 = fresh();
  play(e2);
  for (let s = 0; s < 16; s++) e2.lists.zs[s] = 0;
  e2.lists.zs[2] = 2;                     // next door to the base at sector 3
  e2.vars.zleft = 2;
  e2.vars.movet = 599;
  e2.step();
  check("a squadron reaching a starbase DESTROYS it", e2.lists.bs[3] === 0
    && e2.lists.zs[3] === 2 && String(e2.byName.status.text).includes("STARBASE HAS FALLEN"));
}

console.log("Docking and the two ends of a career:");
{
  const e = fresh();
  play(e);
  e.vars.energy = 3000;
  warpTo(e, 3);                           // the safe starbase
  check("docking at a safe base refills to 9999", e.vars.energy === 9999
    && String(e.byName.status.text).includes("DOCKED"));
  // victory: the last Zylon
  for (let s = 0; s < 16; s++) e.lists.zs[s] = 0;
  e.lists.zs[7] = 1;
  e.vars.zleft = 1;
  warpTo(e, 7);
  const z = e.byName.zylon1;
  z.x = 240; z.y = 180; e.vars.z1z = 20;
  const sc = e.vars.score, en = e.vars.energy;
  tap(e, "Space");
  for (let i = 0; i < 14; i++) e.step();
  check("the last kill ends the war (endplay + ★ table)", Number(e.vars.endplay) === 1
    && e.vars.game === 2);
  check("victory pays 500 + an energy bonus", e.vars.score >= sc + 100 + 500
    && String(e.byName.status.text).includes("ZYLON FLEET IS DESTROYED"));
  check("…and the computer hands you a RANK", String(e.byName.status.text).includes("RANK:"));
  e.fireClick(10, 10); e.step();
  check("a click after the war returns to attract", e.vars.game === 9);
  // the other ending: a dry reactor
  const e2 = fresh();
  play(e2);
  e2.vars.energy = 1;
  for (let i = 0; i < 10 && e2.vars.game === 0; i++) e2.step();
  check("running dry loses the ship — rank: GALACTIC COOK", e2.vars.game === 2
    && Number(e2.vars.endplay) === 1
    && String(e2.byName.status.text).includes("SHIP LOST")
    && String(e2.byName.status.text).includes("GALACTIC COOK"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

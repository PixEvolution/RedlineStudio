// Headless test: Zaxxon (1982) — the axonometric fortress run.
// Altitude and the shadow, walls cleared and windows threaded, force
// field bands, turrets that lead you, the shoot-to-refuel paradox, fuel
// starvation, open-space drones, and the Guardian's frozen-scroll duel.
import { Engine } from "./js/engine.js";
import { buildZaxxonExample } from "./studio/example-zaxxon.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildZaxxonExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 206); e.step(); };
const L = (eng, n) => eng.lists[n] || (eng.lists[n] = {});
// find the first event of a type, from the generator's own tables
const findEv = (e, type) => {
  for (let i = 0; i < 200; i++) {
    if (e.lists.et0 && e.lists.et0[i] === type) return i;
    if (e.lists.et0 === undefined) break;
  }
  return -1;
};
const hold = (e, h, v, ticks) => { for (let i = 0; i < ticks; i++) { e.vars.sh = h; e.vars.sv = v; e.step(); } };

console.log("Zaxxon (1982):");

// ---- the cabinet
{
  const ex = buildZaxxonExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("titled Zaxxon (1982)", ex.title === "Zaxxon (1982)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to FLY", JSON.stringify(eng.usedSticks()) === "[1]");
  check("the ship casts a SHADOW with an altitude pole",
    ex.objects.some(o => o.name === "shadow") && ex.objects.some(o => o.name === "altpole")
    && ex.objects.some(o => o.name === "altimeter"));
}

// ---- altitude: the third axis
{
  const e = fresh(); play(e);
  e.keys["w"] = true;
  for (let i = 0; i < 60; i++) e.step();
  e.keys["w"] = false;
  check("W climbs to the ceiling (5.2)", e.vars.sh > 5.1);
  e.keys["s"] = true;
  for (let i = 0; i < 120; i++) e.step();
  e.keys["s"] = false;
  check("S dives to the deck (0.25 floor — you cannot auger in)", Math.abs(e.vars.sh - 0.25) < 0.01);
  e.step();
  const shipObj = e.objects.find(o => o.name === "fighter");
  const shadObj = e.objects.find(o => o.name === "shadow");
  const yLow = shipObj.y;
  e.keys["w"] = true;
  for (let i = 0; i < 60; i++) e.step();
  e.keys["w"] = false;
  e.step();
  check("climbing lifts the ship but never its shadow",
    shipObj.y < yLow - 40 && Math.abs(shadObj.y - (e.vars.sgy)) < 2);
}

// ---- the low wall: clear it or wear it
{
  const e = fresh(); play(e);
  const wi = findEv(e, 0);
  const wu = e.lists.eu[wi];
  e.vars.u = wu - 30; e.vars.grace = 0; e.vars.fuel = 99;
  hold(e, 4.5, 2, 40);
  check("over the low wall at altitude: clean", e.vars.lives === 3 && e.vars.u > wu);
  const e2 = fresh(); play(e2);
  e2.vars.u = wu - 30; e2.vars.grace = 0;
  hold(e2, 1.0, 2, 40);
  check("into the low wall at deck height: a crash", e2.vars.lives === 2);
}

// ---- the window wall: the lit ring is the only way
{
  const e = fresh(); play(e);
  const wi = findEv(e, 1);
  const wu = e.lists.eu[wi], wv = e.lists.ev[wi], wh = e.lists.eh[wi];
  e.vars.u = wu - 30; e.vars.grace = 0; e.vars.fuel = 99;
  hold(e, wh, wv, 40);
  check("threading the window: clean through", e.vars.lives === 3 && e.vars.u > wu);
  const e2 = fresh(); play(e2);
  e2.vars.u = wu - 30; e2.vars.grace = 0;
  hold(e2, 5.2, (wv + 2) % 5, 40);
  check("anywhere else on a high wall: a crash (even at the ceiling)", e2.vars.lives === 2);
}

// ---- the force field: between the beams
{
  const e = fresh(); play(e);
  const fi = findEv(e, 2);
  const fu = e.lists.eu[fi], flo = e.lists.eh[fi];
  e.vars.u = fu - 30; e.vars.grace = 0; e.vars.fuel = 99;
  hold(e, flo + 1.1, 2, 40);
  check("between the beams: clean", e.vars.lives === 3);
  const e2 = fresh(); play(e2);
  e2.vars.u = fu - 30; e2.vars.grace = 0;
  hold(e2, Math.max(0.3, flo - 0.6), 2, 40);
  check("under the low beam: a crash", e2.vars.lives === 2);
}

// ---- turrets lead your altitude; their fire can be dodged
{
  const e = fresh(); play(e);
  const ti = findEv(e, 3);
  const tu = e.lists.eu[ti];
  e.vars.u = tu - 80; e.vars.grace = 0; e.vars.fuel = 99;
  e.lists.tcool[ti] = 1;
  hold(e, 3, e.lists.ev[ti], 4);
  check("a turret in range opens fire", [0, 1].some(s => L(e, "tson")[s] === 1));
  // the shot was aimed at h=3; climb away
  hold(e, 5.0, e.lists.ev[ti], 60);
  check("…and a change of altitude beats it", e.vars.lives === 3);
  const e2 = fresh(); play(e2);
  e2.vars.u = tu - 80; e2.vars.grace = 0; e2.vars.fuel = 99;
  e2.lists.tcool[ti] = 1;
  hold(e2, 3, e2.lists.ev[ti], 4);
  hold(e2, 3, e2.lists.ev[ti], 60);        // hold course into it
  check("holding course eats the shell", e2.vars.lives === 2);
}

// ---- the paradox: shoot your own fuel to live
{
  const e = fresh(); play(e);
  const ui = findEv(e, 4);
  const uu = e.lists.eu[ui], uv = e.lists.ev[ui];
  e.vars.u = uu - 60; e.vars.grace = 0; e.vars.fuel = 40;
  e.vars.sh = 1.0; e.vars.sv = uv;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  const sc0 = e.vars.score;
  for (let i = 0; i < 40; i++) { e.vars.sh = 1.0; e.vars.sv = uv; e.step(); }
  check("a fuel dump shot pays 100 and +15 fuel",
    e.vars.fuel >= 54 && e.vars.score >= sc0 + 100 && e.lists.et[ui] === 9);
  // fuel starvation
  const e2 = fresh(); play(e2);
  e2.vars.fuel = 1; e2.vars.grace = 0;
  for (let i = 0; i < 80; i++) { e2.vars.sh = 4.5; e2.step(); }
  check("an empty tank is a crash all by itself", e2.vars.lives === 2 && e2.vars.fuel >= 60);
}

// ---- walls stop your shots; windows pass them
{
  const e = fresh(); play(e);
  const wi = findEv(e, 0);
  e.vars.u = e.lists.eu[wi] - 40; e.vars.grace = 0; e.vars.fuel = 99;
  e.vars.sh = 1.0; e.vars.sv = 2;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  let died = false;
  for (let i = 0; i < 20; i++) { e.vars.u = e.lists.eu[wi] - 40; e.step(); if (![0, 1].some(s => e.lists.son[s] === 1)) died = true; }
  check("a low shot dies on the low wall", died);
}

// ---- open space: the drone wing
{
  const e = fresh(); play(e);
  e.vars.u = 2405; e.vars.grace = 0; e.vars.fuel = 99;
  for (let i = 0; i < 160; i++) { e.vars.sh = 4.8; e.vars.sv = 0; e.step(); }
  check("open space launches the drone wing", e.vars.drspawn >= 3);
  // shoot one head-on
  const e2 = fresh(); play(e2);
  e2.vars.u = 2500; e2.vars.grace = 0; e2.vars.fuel = 99;
  L(e2, "dron")[0] = 1; L(e2, "drd")[0] = 40; L(e2, "drv")[0] = 2; L(e2, "drh")[0] = 2.5;
  e2.vars.sh = 2.5; e2.vars.sv = 2;
  const sc2 = e2.vars.score;
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  for (let i = 0; i < 30; i++) { e2.vars.sh = 2.5; e2.vars.sv = 2; e2.step(); }
  check("a drone downed head-on pays 300", e2.vars.score >= sc2 + 300);
}

// ---- THE GUARDIAN: frozen scroll, homing missiles, six to the core
{
  const e = fresh(); play(e);
  e.vars.u = 3000; e.vars.grace = 0; e.vars.fuel = 99;
  e.step(); e.step();
  check("the scroll freezes for the duel", e.vars.phase === 2 && e.vars.bosson === 1 && e.vars.u === 3000);
  // a missile homes
  L(e, "mon")[0] = 1; L(e, "md")[0] = 50; L(e, "mv")[0] = 0; L(e, "mh")[0] = 1;
  e.vars.sv = 4; e.vars.sh = 4;
  for (let i = 0; i < 30; i++) { e.vars.sv = 4; e.vars.sh = 4; e.step(); }
  check("its missiles HOME on you", L(e, "mv")[0] > 1.2 && L(e, "mh")[0] > 1.8);
  // six to the core
  const e2 = fresh(); play(e2);
  e2.vars.u = 3000; e2.vars.grace = 0; e2.vars.fuel = 99;
  e2.step();
  const sc0 = e2.vars.score;
  let fired = 0;
  for (let i = 0; i < 1600 && e2.vars.level === 1; i++) {
    e2.vars.sv = 2; e2.vars.sh = 2.5; e2.vars.grace = 2;   // stay on the line, immune for the test
    if (i % 25 === 0) { e2.keys["Space"] = true; fired++; } else { e2.keys["Space"] = false; }
    e2.step();
  }
  check("six core hits end the Guardian: +500 each +3000, fortress 2",
    e2.vars.level === 2 && e2.vars.score >= sc0 + 6 * 500 + 3000);
  check("fortress 2 starts refueled from the beginning", e2.vars.u < 50 && e2.vars.fuel === 99);
}

// ---- the last ship
{
  const e = fresh(); play(e);
  e.vars.lives = 1; e.vars.grace = 0; e.vars.fuel = 1;
  for (let i = 0; i < 80; i++) { e.vars.sh = 4.5; e.step(); }
  check("the last ship down: the fortress holds", e.vars.game === 2 && e.vars.endplay === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

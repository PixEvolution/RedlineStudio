// Headless test: Lunar Lander (1979) — gravity, the analog lever, the fuel
// economy, pads and their prices, crashes, and the dry tank.
import { Engine } from "./js/engine.js";
import { buildLunarlanderExample } from "./studio/example-lunarlander.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildLunarlanderExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 218); e.step(); };
const ship = (e) => e.byName.lander;
// park the lander hovering still over a spot
const hover = (e, x, y, angle = -90) => {
  e.vars.flying = 1;
  ship(e).x = x; ship(e).y = y; ship(e).angle = angle;
  e.vars.vx = 0; e.vars.vy = 0;
};

console.log("Lunar Lander (1979):");
{
  const ex = buildLunarlanderExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a vector mountain range of Line objects", ex.objects.filter(o => o.name.startsWith("terrain")).length === 15);
  check("the pads glow green and wear their prices 2X 3X 5X",
    ex.objects.filter(o => o.name.startsWith("padtag")).length === 4
    && ex.objects.some(o => o.text === "5X"));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("the stick is the LEVER", ex.objects.some(o => o.name === "stick1tag" && o.text === "LEVER"));
}

console.log("Gravity and the lever:");
{
  const e = fresh();
  play(e);
  hover(e, 240, 100);
  for (let i = 0; i < 30; i++) e.step();
  check("gravity never blinks — a still ship falls", e.vars.vy > 0.5 && ship(e).y > 100);
  // full burn upright fights it
  hover(e, 240, 120);
  const f0 = e.vars.fuel;
  e.keys["w"] = true;
  for (let i = 0; i < 30; i++) e.step();
  e.keys["w"] = false;
  check("a full upright burn climbs", e.vars.vy < 0);
  check("…and burns fuel", e.vars.fuel < f0 - 20);
  // the ANALOG lever: half a push, half a burn
  const e2 = fresh();
  play(e2);
  hover(e2, 240, 120);
  const f1 = e2.vars.fuel;
  e2.setStick(1, 0, -0.5);
  for (let i = 0; i < 30; i++) e2.step();
  e2.clearStick(1);
  const halfBurn = f1 - e2.vars.fuel;
  const e3 = fresh();
  play(e3);
  hover(e3, 240, 120);
  const f2 = e3.vars.fuel;
  e3.setStick(1, 0, -1);
  for (let i = 0; i < 30; i++) e3.step();
  e3.clearStick(1);
  const fullBurn = f2 - e3.vars.fuel;
  check("the lever is ANALOG — half a push burns about half the fuel",
    halfBurn > fullBurn * 0.4 && halfBurn < fullBurn * 0.6);
  // rotation + nose stays above the horizon
  const e4 = fresh();
  play(e4);
  hover(e4, 240, 100);
  e4.keys["a"] = true;
  for (let i = 0; i < 120; i++) e4.step();
  e4.keys["a"] = false;
  check("A rotates — and the nose never dives below the horizon", ship(e4).angle === -180);
  check("an empty tank gives no thrust", (() => {
    const e5 = fresh(); play(e5); hover(e5, 240, 100);
    e5.vars.fuel = 0;
    e5.keys["w"] = true;
    for (let i = 0; i < 20; i++) e5.step();
    e5.keys["w"] = false;
    return e5.vars.vy > 0.3;
  })());
}

console.log("Landings, priced by the pad:");
{
  // gentle, upright, on the 2X pad (65..115 at y 318)
  const e = fresh();
  play(e);
  hover(e, 90, 300);
  e.vars.vy = 0.8;
  for (let i = 0; i < 30 && e.vars.flying === 1; i++) e.step();
  check("a good landing on the 2X pad pays 100", e.vars.flying === 0 && e.vars.score === 100);
  check("…plus the fuel bonus", e.vars.fuel > 1000);
  check("…and says so like the cabinet", String(e.byName.status.text).includes("A GOOD LANDING"));
  // the 5X mesa pays 250
  const e2 = fresh();
  play(e2);
  hover(e2, 275, 195);
  e2.vars.vy = 0.8;
  for (let i = 0; i < 30 && e2.vars.flying === 1; i++) e2.step();
  check("the high mesa pays 5X — 250", e2.vars.score === 250);
  // after a landing, a fresh approach deals itself
  for (let i = 0; i < 80; i++) e2.step();
  check("a fresh approach follows (same tank)", e2.vars.flying === 1 && ship(e2).y < 60);
}

console.log("The mountains do not negotiate:");
{
  // gentle but on a SLOPE = crash
  const e = fresh();
  play(e);
  hover(e, 45, 250);
  e.vars.vy = 0.8;
  for (let i = 0; i < 40 && e.vars.flying === 1; i++) e.step();
  check("a gentle touch on the rocks is still a crash", e.vars.flying === 0 && e.vars.score === 0
    && String(e.byName.status.text).includes("CRATER"));
  // fast onto a pad = crash
  const e2 = fresh();
  play(e2);
  hover(e2, 90, 290);
  e2.vars.vy = 3.5;
  for (let i = 0; i < 20 && e2.vars.flying === 1; i++) e2.step();
  check("slamming the pad is a crash, not a landing", e2.vars.score === 0);
  // tilted onto a pad = crash
  const e3 = fresh();
  play(e3);
  hover(e3, 90, 300, -140);
  e3.vars.vy = 0.8;
  for (let i = 0; i < 30 && e3.vars.flying === 1; i++) e3.step();
  check("landing sideways is a crash, whatever the speed", e3.vars.score === 0);
}

console.log("The tank is the coin:");
{
  const e = fresh();
  play(e);
  hover(e, 90, 300);
  e.vars.vy = 3.5;          // crash it…
  e.vars.fuel = 30;         // …with a nearly dry tank
  for (let i = 0; i < 20 && e.vars.flying === 1; i++) e.step();
  for (let i = 0; i < 90; i++) e.step();
  check("a dry tank ends the play", e.vars.game === 2 && Number(e.vars.endplay) === 1
    && String(e.byName.status.text).includes("TANK DRY"));
  e.fireClick(10, 10); e.step();
  check("a click after the dry tank returns to attract", e.vars.game === 9);
  const probe = new Engine(null, buildLunarlanderExample().objects);
  check("one on-screen lever", JSON.stringify(probe.usedSticks()) === "[1]");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Headless test: Night Driver (1976) — the projection, the pedal, the wheel,
// the shoving curves, crashes, the timed coin, and the arcade contract.
import { Engine } from "./js/engine.js";
import { buildNightdriverExample } from "./studio/example-nightdriver.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildNightdriverExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const drive = (e) => { e.fireClick(240, 195); e.step(); };
const straighten = (e) => { e.vars.kurv = 0; for (let i = 0; i < 16; i++) e.lists.trk[i] = 0; };

console.log("Night Driver (1976):");
{
  const ex = buildNightdriverExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("sixteen posts and nothing else in the world",
    ex.objects.filter(o => o.name.startsWith("post")).length === 16);
  check("the car is a DECAL — no script, like the 1976 plastic overlay",
    ex.objects.filter(o => o.name.startsWith("decal")).every(o => o.script.length === 0));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("the wheel wears its name", ex.objects.some(o => o.name === "stick1tag" && o.text === "WHEEL"));
}

console.log("The projection (the whole 3D trick):");
{
  const e = fresh();
  drive(e);
  straighten(e);
  e.step();
  const y = e.lists.py, s = e.lists.ps, lx = e.lists.plx, rx = e.lists.prx;
  check("nearer gates sit LOWER on the glass", y[0] > y[3] && y[3] > y[7]);
  check("nearer posts are BIGGER", s[0] > s[3] && s[3] > s[7]);
  check("the road NARROWS into the distance", (rx[0] - lx[0]) > (rx[3] - lx[3]) && (rx[3] - lx[3]) > (rx[7] - lx[7]));
  check("everything stays above the horizon line", y[7] > 150 && y[7] < 200);
  // drive a bit: the gates stream toward the glass
  const y0 = y[0];
  e.keys["w"] = true;
  for (let i = 0; i < 12; i++) e.step();
  e.keys["w"] = false;
  check("gas makes the posts stream at you", e.vars.speed > 0 && e.vars.dist > 0);
  // a curve bends the FAR road more than the near road (the track table
  // is the source of truth — the brain re-reads it every tick)
  e.vars.px = 0;
  for (let i = 0; i < 16; i++) e.lists.trk[i] = 2;
  e.step();
  const mid = (i) => (e.lists.plx[i] + e.lists.prx[i]) / 2;
  check("a curve bends the DISTANCE, not your bumper", Math.abs(mid(7) - 240) > Math.abs(mid(0) - 240) + 20);
}

console.log("The wheel and the pedal:");
{
  const e = fresh();
  drive(e);
  straighten(e);
  e.keys["w"] = true;
  for (let i = 0; i < 170; i++) { straighten(e); e.step(); }
  check("flat out approaches top speed", e.vars.speed > 3.5);
  e.keys["w"] = false;
  for (let i = 0; i < 320; i++) { straighten(e); e.step(); }
  check("no gas = drag wins (it coasts to a stop)", e.vars.speed === 0);
  const px0 = e.vars.px;
  e.keys["d"] = true;
  for (let i = 0; i < 10; i++) { straighten(e); e.step(); }
  e.keys["d"] = false;
  check("D steers right", e.vars.px > px0 + 20);
  // the stick is the wheel
  const e2 = fresh();
  drive(e2);
  straighten(e2);
  e2.setStick(1, -1, -1);   // full left, full gas
  for (let i = 0; i < 12; i++) { straighten(e2); e2.step(); }
  e2.clearStick(1);
  check("the stick steers AND feeds the pedal", e2.vars.px < -20 && e2.vars.speed > 0.3);
  const probe = new Engine(null, buildNightdriverExample().objects);
  check("the game summons exactly one on-screen wheel", JSON.stringify(probe.usedSticks()) === "[1]");
}

console.log("Curves shove, the dark bites:");
{
  const e = fresh();
  drive(e);
  // hold a hard curve with no countersteer: the shove drifts you off the road
  e.keys["w"] = true;
  let crashed = false;
  for (let i = 0; i < 600 && !crashed; i++) {
    e.vars.kurv = 2;   // pin the sweeper
    e.step();
    if (e.vars.crashes > 0) crashed = true;
  }
  e.keys["w"] = false;
  check("hands-off in a sweeper = CRASH", crashed);
  check("a crash stops the car and recenters it", e.vars.speed === 0 && Math.abs(e.vars.px) < 1);
  check("…with the thump on the soundtrack", e.beeps.some(b => b.freq === 82));
}

console.log("The coin buys time, distance is glory:");
{
  const e = fresh();
  drive(e);
  check("DRIVE starts the clock at 75", Math.floor(e.vars.tleft / 60) >= 74);
  straighten(e);
  e.keys["w"] = true;
  for (let i = 0; i < 120; i++) { straighten(e); e.step(); }
  e.keys["w"] = false;
  check("the ★ score is distance down the road", e.vars.score > 0 && e.vars.score === Math.floor(e.vars.dist / 20));
  e.vars.tleft = 1;
  e.step(); e.step();
  check("time up ends the play", e.vars.game === 2 && Number(e.vars.endplay) === 1);
  e.fireClick(10, 10); e.step();
  check("a click after time-up returns to the night", e.vars.game === 9);
}

console.log("Attract:");
{
  const e = fresh();
  check("opens in attract, title up", e.vars.game === 9 && Number(e.byName.bigtitle.visible) === 1);
  const d0 = e.vars.dist;
  for (let i = 0; i < 90; i++) e.step();
  check("the attract car drives itself into the night", e.vars.dist > d0 + 100);
  check("…and stays on the road while doing it", Math.abs(e.vars.px) < 140);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Headless test: Death Race (1976) — fleeing gremlins, screaming kills,
// solid graves, the timed coin, two wheels, and the arcade contract.
import { readFileSync } from "fs";
import { Engine } from "./js/engine.js";
import { buildDeathraceExample } from "./studio/example-deathrace.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildDeathraceExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const start1P = (e) => { e.fireClick(168, 262); e.step(); };
const start2P = (e) => { e.fireClick(315, 262); e.step(); };
const car = (e, n = 1) => e.byName["car" + n];
const grem = (e, n = 1) => e.byName["gremlin" + n];
// park every gremlin far from the action so a test controls its own kills
const parkGremlins = (e) => { for (let g = 1; g <= 6; g++) { grem(e, g).x = 460; grem(e, g).y = 340; } };

console.log("Death Race (1976):");
{
  const ex = buildDeathraceExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("6 gremlins, 16 graves, 2 cars, a fence",
    ex.objects.filter(o => o.name.startsWith("gremlin")).length === 6 &&
    ex.objects.filter(o => o.name.startsWith("cross")).length === 16 &&
    ex.objects.filter(o => o.type === "tri").length === 2 &&
    ex.objects.filter(o => o.name.startsWith("fence")).length === 4);
  check("speaks the arcade contract (score + endplay → ★ HIGH SCORES)", eng.usesScoreboard());
  check("two wheels wear their names", ex.objects.some(o => o.name === "stick1tag" && o.text === "WHEEL P1")
    && ex.objects.some(o => o.name === "stick2tag" && o.text === "WHEEL P2"));
  const studio = readFileSync("studio/studio.html", "utf8");
  check("the example loads RATED 13+ — the panic, filed correctly", /deathrace:.*rating: "T13"/.test(studio));
  check("…and the loader applies example ratings", studio.includes('EXAMPLES[pick].rating ||'));
}

console.log("Attract mode:");
{
  const e = fresh();
  check("opens in attract: title up, cars hidden, no graves", e.vars.game === 9
    && Number(e.byName.bigtitle.visible) === 1 && Number(car(e).visible) === 0);
  const gx = grem(e).x, gy = grem(e).y;
  for (let i = 0; i < 90; i++) e.step();
  check("the gremlins mill around like nothing ever happens here", Math.abs(grem(e).x - gx) > 0.5 || Math.abs(grem(e).y - gy) > 0.5);
}

console.log("A coin buys TIME:");
{
  const e = fresh();
  start1P(e);
  check("1 PLAYER starts the clock at 60", e.vars.game === 0 && e.vars.mode === 1 && Math.floor(e.vars.tleft / 60) >= 59);
  check("car 1 on the arena, car 2 parked out back", Number(car(e, 1).visible) === 1 && Number(car(e, 2).visible) === 0 && car(e, 2).x < 0);
  e.vars.tleft = 2;
  e.step(); e.step(); e.step();
  check("time up = play over: endplay fires", e.vars.game === 2 && Number(e.vars.endplay) === 1);
  e.fireClick(10, 10); e.step();
  check("a click after time-up returns to attract", e.vars.game === 9);
}

console.log("Driving:");
{
  const e = fresh();
  start1P(e);
  parkGremlins(e);
  const x0 = car(e).x;
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();
  check("W is the pedal — the car drives where it points", car(e).x > x0 + 30);
  e.keys["d"] = true;
  const a0 = car(e).angle;
  for (let i = 0; i < 10; i++) e.step();
  e.keys["w"] = e.keys["d"] = false;
  check("D is the wheel", car(e).angle > a0);
  // the stick is the other wheel: up = gas
  const e2 = fresh();
  start1P(e2);
  parkGremlins(e2);
  const x2 = car(e2).x;
  e2.setStick(1, 0, -1);
  for (let i = 0; i < 20; i++) e2.step();
  e2.clearStick(1);
  check("stick 1 pushed up is the same pedal", car(e2).x > x2 + 30);
  const e3 = fresh();
  start1P(e3);
  parkGremlins(e3);
  car(e3).x = 455; car(e3).angle = 0;
  e3.keys["w"] = true;
  for (let i = 0; i < 30; i++) e3.step();
  e3.keys["w"] = false;
  check("the fence holds", car(e3).x <= 456);
}

console.log("The scandal itself:");
{
  const e = fresh();
  start1P(e);
  parkGremlins(e);
  const g = grem(e, 1);
  g.x = 240; g.y = 180;
  car(e).x = 240; car(e).y = 180;   // right on top of it
  e.step();
  check("a caught gremlin scores", e.vars.score1 === 1);
  check("…screams on the way out", e.beeps.some(b => b.freq === 880) && e.beeps.some(b => b.freq === 131));
  check("…and leaves a grave where it died", e.lists.crosson[0] === 1
    && Math.abs(e.lists.crossx[0] - 240) < 15 && Math.abs(e.lists.crossy[0] - 180) < 15);
  check("the gremlin respawns somewhere else", Math.abs(g.x - 240) > 10 || Math.abs(g.y - 180) > 10);
  e.step();
  check("a FRESH grave hasn't surfaced yet (the kill is the explosion)", Number(e.byName.cross1.visible) === 0);
  check("the ★ score follows the wheel", e.vars.score === 1);

  // the grave matures ~0.6s later — the killer is long gone by then
  car(e).x = e.lists.crossx[0]; car(e).y = e.lists.crossy[0]; car(e).angle = 0;
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();   // drive straight through the fresh kill
  e.keys["w"] = false;
  check("running one over NEVER stops the car", car(e).x > e.lists.crossx[0] + 30);
  car(e).x = 60; car(e).y = 60;            // park away while it matures
  for (let i = 0; i < 40; i++) e.step();
  check("…then the cross surfaces", Number(e.byName.cross1.visible) === 1);
  // and NOW it's solid: drive at it and go nowhere
  car(e).x = e.lists.crossx[0] - 20; car(e).y = e.lists.crossy[0]; car(e).angle = 0;
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["w"] = false;
  check("a matured grave is solid — the car can't drive through it", car(e).x < e.lists.crossx[0] - 8);
}

console.log("Gremlins flee:");
{
  const e = fresh();
  start1P(e);
  parkGremlins(e);
  const g = grem(e, 1);
  g.x = 240; g.y = 180;
  car(e).x = 200; car(e).y = 180;   // closing from the left
  const d0 = Math.hypot(g.x - car(e).x, g.y - car(e).y);
  for (let i = 0; i < 12; i++) { car(e).x = 200; car(e).y = 180; e.step(); }
  check("a gremlin runs FROM the car", Math.hypot(g.x - 200, g.y - 180) > d0);
}

console.log("Two wheels:");
{
  const e = fresh();
  start2P(e);
  check("2 PLAYERS puts both cars on the arena", e.vars.mode === 2 && Number(car(e, 2).visible) === 1 && car(e, 2).x > 0);
  parkGremlins(e);
  const g = grem(e, 2);
  g.x = 300; g.y = 200;
  car(e, 2).x = 300; car(e, 2).y = 200;
  car(e, 1).x = 60; car(e, 1).y = 60;
  e.step();
  check("player 2's kills score for player 2", e.vars.score2 === 1 && e.vars.score1 === 0);
  e.vars.score1 = 3; e.vars.score2 = 5;
  e.step();
  check("the ★ table takes the day's best wheel", e.vars.score === 5);
  e.vars.tleft = 1;
  e.step(); e.step();
  check("time up names the winner", String(e.byName.status.text).includes("PLAYER 2"));
  const probe = new Engine(null, buildDeathraceExample().objects);
  check("the game summons exactly two on-screen wheels", JSON.stringify(probe.usedSticks()) === "[1,2]");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

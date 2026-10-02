// Headless test: Frogger (1981) — grid hops and their pay, the road that
// kills, the river that carries, diving turtles, the five bays and their
// walls, the fly, the clock, and the level that speeds up.
import { Engine } from "./js/engine.js";
import { buildFroggerExample } from "./studio/example-frogger.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildFroggerExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 258); e.step(); };
const tap = (e, k) => { e.keys[k] = true; e.step(); e.keys[k] = false; e.step(); };
// park every vehicle far off the playfield (world x -58, display hidden)
const clearTraffic = (e) => { for (let i = 0; i < 24; i++) e.lists.vx[i] = 9999; };
const put = (e, x, y) => { e.vars.px = x; e.vars.py = y; };
// vehicle index helpers: lanes flattened in declaration order
const VEH_LANE1 = 0;        // first car, y 408, dir +1

console.log("Frogger (1981):");
{
  const ex = buildFroggerExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a portrait cabinet with the arcade contract", ex.w === 360 && eng.usesScoreboard());
  check("one stick to HOP", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "HOP"));
  check("24 moving things, five bays, a fly, a clock",
    ex.objects.filter(o => /^veh\d/.test(o.name)).length === 24
    && ex.objects.filter(o => /^bay\d/.test(o.name)).length === 5
    && ex.objects.some(o => o.name === "fly") && ex.objects.some(o => o.name === "timebar"));
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin starts the crossing: 3 hoppers, 30 seconds, bays empty",
    e.vars.game === 0 && e.vars.lives === 3 && e.vars.btimer > 1700
    && e.lists.homes[0] === 0);
}

console.log("Grid hops:");
{
  const e = fresh();
  play(e);
  clearTraffic(e);
  const sc0 = e.vars.score;
  tap(e, "w");
  check("a hop is one square", e.vars.py === 432);
  check("…and the first step forward pays 10", e.vars.score === sc0 + 10);
  tap(e, "s");
  tap(e, "w");
  check("re-crossing old ground pays nothing", e.vars.py === 432 && e.vars.score === sc0 + 10);
  tap(e, "a"); tap(e, "a");
  check("sideways hops slide the column", e.vars.px === 180 - 48);
  put(e, 12, 456);
  tap(e, "a");
  check("the kerbs hold", e.vars.px === 12);
}

console.log("The road kills:");
{
  const e = fresh();
  play(e);
  clearTraffic(e);
  put(e, 180, 408);                          // lane 1
  e.lists.vx[0] = 180;
  e.step();
  check("traffic is traffic", e.vars.lives === 2 && e.vars.py === 456);
  // you can only die to what you can SEE (hitbox ≤ paint)
  const e15 = fresh();
  play(e15);
  clearTraffic(e15);
  put(e15, 180, 408);
  e15.lists.vx[0] = 180 + 20;                // visibly clear of the car
  e15.step();
  check("a near miss is a MISS — no invisible bumpers", e15.vars.lives === 3);
  e15.lists.vx[0] = 180 + 10;                // visibly overlapping
  e15.step();
  check("…and a visible overlap kills", e15.vars.lives === 2);
  // the median is sanctuary
  const e2 = fresh();
  play(e2);
  clearTraffic(e2);
  put(e2, 180, 288);
  for (let i = 0; i < 30; i++) e2.step();
  check("the median asks nothing of you", e2.vars.lives === 3);
}

console.log("The river carries:");
{
  const e = fresh();
  play(e);
  clearTraffic(e);
  put(e, 180, 216);                          // long-log lane, dir +1 spd 1.9
  e.lists.vx[17] = 180;                      // the first y-216 log under our feet
  const x0 = e.vars.px;
  for (let i = 0; i < 20; i++) e.step();
  check("standing on a log, the river carries you", e.vars.lives === 3 && e.vars.px > x0 + 20);
  // bare water is death
  const e2 = fresh();
  play(e2);
  clearTraffic(e2);
  put(e2, 180, 240);
  e2.step();
  check("bare water is not a floor", e2.vars.lives === 2);
  // carried off the edge
  const e3 = fresh();
  play(e3);
  clearTraffic(e3);
  put(e3, 340, 216);
  e3.lists.vx[17] = 340;
  for (let i = 0; i < 30 && e3.vars.lives === 3; i++) e3.step();
  check("the edge of the world counts as carried away", e3.vars.lives === 2);
}

console.log("The diving turtles:");
{
  // find a diver on the y-264 raft lane (declaration: slot 11 = lane-6 diver)
  const e = fresh();
  play(e);
  clearTraffic(e);
  // diver phase: (tik + ph) % 420 >= 320 means UNDER. Force tik so it's surfaced.
  const ph = 5 * 97 + 1 * 173;               // lane index 5, slot 1 → flat slot 13
  e.vars.tik = (420 - (ph % 420)) % 420;     // cyc == 0: freshly surfaced
  put(e, 180, 264);
  e.lists.vx[13] = 180;
  for (let i = 0; i < 5; i++) { e.lists.vx[13] = 180; e.vars.px = 180; e.step(); }
  check("a surfaced turtle raft is a ride", e.vars.lives === 3);
  // now force it under
  e.vars.tik = ((320 - (ph % 420)) % 420 + 420) % 420 + 2;   // cyc just past 320
  e.lists.vx[13] = 180; e.vars.px = 180; e.vars.py = 264;
  e.step();
  check("…but a DIVED turtle is just water", e.vars.lives === 2);
}

console.log("The bays:");
{
  const e = fresh();
  play(e);
  clearTraffic(e);
  const sc0 = e.vars.score;
  put(e, 36, 168);                            // over bay 1, riding row — teleport, then hop up
  e.lists.vx[22] = 36;                        // a y-168 log underfoot (slots 22,23)
  tap(e, "w");
  check("a clean arrival fills the bay and pays 50 + time", e.lists.homes[0] === 1
    && e.vars.score > sc0 + 50 && e.vars.py === 456);
  // the wall between bays
  const e2 = fresh();
  play(e2);
  clearTraffic(e2);
  put(e2, 72, 144);                           // squarely between bays 1 and 2
  e2.step();
  check("the wall between bays is real", e2.vars.lives === 2);
  // a full bay is a wall too
  const e3 = fresh();
  play(e3);
  clearTraffic(e3);
  e3.lists.homes[2] = 1;
  put(e3, 180, 144);
  e3.step();
  check("a full bay is a wall too", e3.vars.lives === 2);
  // the fly pays
  const e4 = fresh();
  play(e4);
  clearTraffic(e4);
  e4.vars.flybay = 4; e4.vars.flyt = 500;
  const sc1 = e4.vars.score;
  put(e4, 324, 144);
  e4.step();
  check("the fly is worth 200 on top", e4.lists.homes[4] === 1 && e4.vars.score >= sc1 + 250);
  // all five
  const e5 = fresh();
  play(e5);
  clearTraffic(e5);
  for (let b = 0; b < 4; b++) e5.lists.homes[b] = 1;
  const sc2 = e5.vars.score;
  put(e5, 324, 144);
  e5.step();
  check("all five home: +1000 and a faster level, bays reset",
    e5.vars.score >= sc2 + 1050 && e5.vars.level === 2 && e5.lists.homes[0] === 0);
}

console.log("The clock and the end:");
{
  const e = fresh();
  play(e);
  clearTraffic(e);
  e.vars.btimer = 1;
  e.step(); e.step();
  check("the clock is a sixth lane of traffic", e.vars.lives === 2
    && e.vars.btimer > 1700);
  const e2 = fresh();
  play(e2);
  clearTraffic(e2);
  e2.vars.lives = 1;
  e2.vars.btimer = 1;
  e2.step(); e2.step();
  check("the last hopper ends it (endplay + ★ table)", e2.vars.game === 2
    && Number(e2.vars.endplay) === 1);
  e2.fireClick(10, 10); e2.step();
  check("a click after the end returns to attract", e2.vars.game === 9);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

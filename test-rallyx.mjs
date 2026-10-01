// Headless test: Rally-X (1980) — the scrolling world and its camera, the
// radar, a car that never stops, flags and the special double, smoke vs the
// red cars, the falling fuel gauge, and the CHALLENGING STAGE.
import { Engine } from "./js/engine.js";
import { buildRallyxExample } from "./studio/example-rallyx.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildRallyxExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 220); e.step(); };
const tap = (e, key) => { e.keys[key] = true; e.step(); e.keys[key] = false; e.step(); };
// park the rivals in far corners so a test can drive in peace
const bench = (e) => {
  e.vars.rx1 = 30; e.vars.ry1 = 30;
  e.vars.rx2 = 930; e.vars.ry2 = 30;
  e.vars.rx3 = 30; e.vars.ry3 = 690;
};
// no flags underfoot
const clearFlags = (e) => { for (let i = 0; i < 10; i++) e.lists.fon[i] = 0; e.vars.flagsleft = 99; };

console.log("Rally-X (1980):");
{
  const ex = buildRallyxExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick on the WHEEL", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "WHEEL"));
  check("a walled world of 18 blocks", ex.objects.filter(o => o.name.startsWith("wall")).length === 18);
  check("ten flags on the map, ten echoes on the radar",
    ex.objects.filter(o => /^flag\d+$/.test(o.name)).length === 10
    && ex.objects.filter(o => /^rflag\d+$/.test(o.name)).length === 10);
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin starts ROUND 1: three cars, a full tank, ten flags",
    e.vars.game === 0 && e.vars.lives === 3 && e.vars.stage === 1
    && e.vars.fuel === 100 && e.vars.flagsleft === 10 && e.vars.bonus === 0);
}

console.log("A car that never stops:");
{
  const e = fresh();
  play(e);
  bench(e); clearFlags(e);
  e.vars.px = 480; e.vars.py = 400; e.vars.pang = -90;
  const y0 = e.vars.py;
  for (let i = 0; i < 20; i++) e.step();
  check("hands off the wheel, the car still drives", e.vars.py < y0 - 30);
  e.vars.px = 380; e.vars.py = 260;        // clear road to the east
  e.keys["d"] = true;
  for (let i = 0; i < 10; i++) e.step();
  e.keys["d"] = false;
  check("the wheel only POINTS it — D snaps the nose east", e.vars.pang === 0);
  const x0 = e.vars.px;
  for (let i = 0; i < 10; i++) e.step();
  check("…and east it goes", e.vars.px > x0 + 15);
  // a wall is a wall
  e.vars.px = 160; e.vars.py = 240; e.vars.pang = -90;   // wall block at (160,160)
  for (let i = 0; i < 40; i++) e.step();
  check("the maze blocks: the car noses up against a wall and stops", e.vars.py > 188);
}

console.log("The camera and the radar:");
{
  const e = fresh();
  play(e);
  bench(e); clearFlags(e);
  e.vars.px = 480; e.vars.py = 400; e.vars.pang = 0;
  e.step();
  check("mid-world, the camera centres you", Math.abs(e.byName.playercar.x - 240) < 6
    && e.vars.camx > 200 && e.vars.camx < 280);
  e.vars.px = 60; e.vars.py = 60;
  e.step(); e.step();
  check("at the world's corner the camera stops scrolling", e.vars.camx === 0 && e.vars.camy === 0
    && Math.abs(e.byName.playercar.x - 60) < 6);
  check("the radar tracks you across the WHOLE map",
    Math.abs(e.byName.rplayer.x - (386 + 60 * 0.09)) < 2);
  e.vars.px = 900; e.step();
  check("…wherever you drive", e.byName.rplayer.x > 386 + 870 * 0.09);
}

console.log("Flags, and the special one:");
{
  const e = fresh();
  play(e);
  bench(e);
  e.vars.px = 480; e.vars.py = 400; e.vars.pang = -90;
  // make flag 0 the special, put it underfoot
  e.vars.sflag = 0;
  e.lists.fx[0] = 480; e.lists.fy[0] = 398;
  const sc0 = e.vars.score;
  e.step(); e.step();
  check("the first flag pays 100", e.vars.score === sc0 + 100 && e.vars.flagsleft === 9);
  check("…and it was the SPECIAL: the doubler is armed", e.vars.mult === 2
    && String(e.byName.status.text).includes("DOUBLE"));
  e.lists.fx[1] = e.vars.px; e.lists.fy[1] = e.vars.py - 4;
  e.step(); e.step();
  check("the second flag now pays 400 (100 × 2 × double)", e.vars.score === sc0 + 100 + 400);
}

console.log("Smoke and the red cars:");
{
  const e = fresh();
  play(e);
  clearFlags(e);
  e.vars.px = 480; e.vars.py = 400; e.vars.pang = -90;
  const f0 = e.vars.fuel;
  tap(e, "Space");
  check("SPACE lays smoke behind the car — and burns 6 fuel",
    e.vars.smlife1 > 200 && e.vars.fuel === f0 - 6);
  // a rival drives into it
  e.vars.rx1 = e.vars.smx1 + 2; e.vars.ry1 = e.vars.smy1;
  e.step();
  check("a red car in the smoke is STUNNED", e.vars.stun1 > 90);
  const d0 = Math.abs(e.vars.rx1 - e.vars.px) + Math.abs(e.vars.ry1 - e.vars.py);
  for (let i = 0; i < 20; i++) e.step();
  check("…and spins in place instead of chasing",
    Math.abs(e.vars.rx1 - e.vars.px) + Math.abs(e.vars.ry1 - e.vars.py) > d0 - 60);
  // the chase is real
  const e2 = fresh();
  play(e2);
  clearFlags(e2);
  e2.vars.px = 480; e2.vars.py = 400;
  e2.vars.rx2 = 700; e2.vars.ry2 = 400;
  const gap0 = e2.vars.rx2 - e2.vars.px;
  e2.vars.pang = -90;
  for (let i = 0; i < 15; i++) e2.step();
  check("an unstunned rival CLOSES on you", Math.abs(e2.vars.rx2 - e2.vars.px) < gap0);
  // contact
  e2.vars.rx1 = e2.vars.px; e2.vars.ry1 = e2.vars.py;
  e2.step();
  check("contact wrecks the car: a life gone, back to the start",
    e2.vars.lives === 2 && e2.vars.px === 480 && e2.vars.py === 520);
}

console.log("Rivals hold their lanes:");
{
  // every spawn point must sit clear of every wall block (the top-right
  // rival once spawned INSIDE one and could never move)
  const WALLS = [[160,160],[320,120],[480,200],[640,120],[800,180],[120,360],[320,340],[520,380],[720,340],[860,400],[200,560],[400,580],[560,520],[700,600],[840,560],[480,60],[80,600],[880,80]];
  const e = fresh();
  play(e);
  const spots = [[e.vars.rx1, e.vars.ry1], [e.vars.rx2, e.vars.ry2], [e.vars.rx3, e.vars.ry3], [e.vars.px, e.vars.py]];
  check("no car spawns trapped inside a wall block",
    spots.every(([x, y]) => WALLS.every(([wx, wy]) => Math.abs(x - wx) >= 30 || Math.abs(y - wy) >= 30)));
  // the once-stuck top-right rival drives
  clearFlags(e);
  e.vars.px = 480; e.vars.py = 400; e.vars.pang = -90;
  const r2 = [e.vars.rx2, e.vars.ry2];
  for (let i = 0; i < 40; i++) { e.step(); e.vars.px = 480; e.vars.py = 400; }
  check("the top-right rival is free — it moves and hunts",
    Math.abs(e.vars.rx2 - r2[0]) + Math.abs(e.vars.ry2 - r2[1]) > 40);
  // two rivals on the same spot push apart instead of merging
  const e2 = fresh();
  play(e2);
  clearFlags(e2);
  e2.vars.px = 480; e2.vars.py = 650;
  e2.vars.rx1 = 480; e2.vars.ry1 = 300;
  e2.vars.rx2 = 480; e2.vars.ry2 = 300;
  e2.vars.rx3 = 60; e2.vars.ry3 = 60;
  for (let i = 0; i < 25; i++) { e2.step(); e2.vars.px = 480; e2.vars.py = 650; }
  check("two rivals never melt into one car",
    Math.abs(e2.vars.rx2 - e2.vars.rx1) > 16 || Math.abs(e2.vars.ry2 - e2.vars.ry1) > 16);
}

console.log("Fuel is the clock:");
{
  const e = fresh();
  play(e);
  bench(e); clearFlags(e);
  e.vars.px = 100; e.vars.py = 650; e.vars.pang = 0;
  for (let i = 0; i < 20; i++) e.step();
  const fullRun = e.vars.px - 100;
  e.vars.fuel = 0;
  e.vars.px = 100;
  for (let i = 0; i < 20; i++) e.step();
  const dryRun = e.vars.px - 100;
  check("a dry tank doesn't stop you — it makes you SLOW", dryRun < fullRun * 0.6 && dryRun > 5);
}

console.log("Rounds and the CHALLENGING STAGE:");
{
  const e = fresh();
  play(e);
  bench(e);
  e.vars.stage = 2;                        // clearing this one lands on stage 3 = challenge
  e.vars.px = 480; e.vars.py = 400; e.vars.pang = -90;
  for (let i = 0; i < 10; i++) e.lists.fon[i] = 0;
  e.lists.fon[3] = 1; e.lists.fx[3] = 480; e.lists.fy[3] = 398;
  e.vars.flagsleft = 1; e.vars.flagn = 9; e.vars.sflag = 7; e.vars.mult = 1;
  const sc0 = e.vars.score;
  e.step(); e.step();
  check("the last flag pays 1000 × flag bonus and ends the round",
    e.vars.score === sc0 + 1000 + 1000 && e.vars.stage === 3);
  check("round 3 is the CHALLENGING STAGE — rivals parked, tank refilled",
    e.vars.bonus === 1 && e.vars.fuel === 100 && e.vars.flagsleft === 10
    && e.byName.redcar1.visible === 0
    && String(e.byName.status.text).includes("CHALLENGING STAGE"));
  // double pay in the challenge
  bench(e);
  e.vars.sflag = 9;
  e.lists.fx[0] = e.vars.px; e.lists.fy[0] = e.vars.py - 4;
  const sc1 = e.vars.score;
  e.step(); e.step();
  check("every challenge flag pays double", e.vars.score === sc1 + 200);
  // the challenge ends gently when the tank runs dry
  const livesBefore = e.vars.lives;
  e.vars.fuel = 0;
  e.step();
  check("an empty challenge tank just starts round 4 — no harm done",
    e.vars.stage === 4 && e.vars.bonus === 0 && e.vars.fuel === 100
    && e.vars.lives === livesBefore);
}

console.log("The last car:");
{
  const e = fresh();
  play(e);
  clearFlags(e);
  e.vars.lives = 1;
  e.vars.rx1 = e.vars.px; e.vars.ry1 = e.vars.py;
  e.step();
  check("wrecking the last car ends the race (endplay + ★ table)",
    e.vars.game === 2 && Number(e.vars.endplay) === 1
    && String(e.byName.status.text).includes("OUT OF CARS"));
  e.fireClick(10, 10); e.step();
  check("a click after the race returns to attract", e.vars.game === 9);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

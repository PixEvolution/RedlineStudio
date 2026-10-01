// Headless test: Asteroids (1979) — inertia, wrap, the 1→2→4 splitting chain
// with its 20/50/100 prices, the four-shot ceiling, both saucers, hyperspace,
// the quickening heartbeat, and the extra ship at 10,000.
import { Engine } from "./js/engine.js";
import { buildAsteroidsExample } from "./studio/example-asteroids.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildAsteroidsExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 228); e.step(); };
const ship = (e) => e.byName.ship;
// clear the sky except one rock we control, parked away from the ship
const oneRock = (e, sz, x, y) => {
  for (let i = 0; i < 28; i++) e.lists.rsz[i] = 0;
  e.lists.rsz[0] = sz; e.lists.rx[0] = x; e.lists.ry[0] = y;
  e.lists.rvx[0] = 0; e.lists.rvy[0] = 0;
  e.vars.rocks = 1;
};
// park the ship still at a spot, facing right
const park = (e, x, y, angle = 0) => {
  ship(e).x = x; ship(e).y = y; ship(e).angle = angle;
  e.vars.vx = 0; e.vars.vy = 0;
};
const tapFire = (e) => {
  e.keys["Space"] = true; e.step();
  e.keys["Space"] = false; e.step();
};
const liveShots = (e) => [1, 2, 3, 4].filter(j => e.byName["shot" + j].live === 1).length;
// lists are {index: value} objects — snapshot them as arrays
const sizes = (e) => Array.from({ length: 28 }, (_, i) => e.lists.rsz[i] || 0);
const xs = (e, n) => Array.from({ length: n }, (_, i) => e.lists.rx[i]).join(",");

console.log("Asteroids (1979):");
{
  const ex = buildAsteroidsExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a pool of 28 rocks waits in the wings", ex.objects.filter(o => o.name.startsWith("rock")).length === 28);
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick, and it flies the SHIP", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "SHIP"));
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  const x0 = xs(e, 4);
  for (let i = 0; i < 20; i++) e.step();
  check("the rocks drift through the attract screen", xs(e, 4) !== x0);
  play(e);
  check("a coin deals wave 1: four big rocks, three ships", e.vars.game === 0 && e.vars.rocks === 4
    && e.vars.lives === 3 && sizes(e).filter(v => v === 3).length === 4);
}

console.log("Spacewar physics, coin-op wrapper:");
{
  const e = fresh();
  play(e);
  oneRock(e, 3, 400, 300);
  park(e, 100, 100, -90);
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["w"] = false;
  const vyAfterBurn = e.vars.vy;
  check("thrust builds velocity along the nose", vyAfterBurn < -1);
  for (let i = 0; i < 20; i++) e.step();
  check("…and momentum is the law: the ship coasts after the burn",
    e.vars.vy < vyAfterBurn * 0.8 && ship(e).y < 60);
  // rotation
  const e2 = fresh();
  play(e2);
  oneRock(e2, 3, 400, 300);
  park(e2, 100, 100, 0);
  e2.keys["a"] = true;
  for (let i = 0; i < 10; i++) e2.step();
  e2.keys["a"] = false;
  check("A rotates the ship", ship(e2).angle < -20);
  // wrap on every edge
  park(e2, 5, 100, 0);
  e2.vars.vx = -3;
  for (let i = 0; i < 5; i++) e2.step();
  check("the left edge is the right edge — the screen wraps", ship(e2).x > 400);
}

console.log("The splitting chain — every shot makes the room meaner:");
{
  const e = fresh();
  play(e);
  oneRock(e, 3, 160, 100);
  park(e, 100, 100, 0);
  tapFire(e);
  for (let i = 0; i < 12; i++) e.step();
  check("a big rock pays 20 — and becomes TWO mediums", e.vars.score === 20
    && e.vars.rocks === 2 && sizes(e).filter(v => v === 2).length === 2);
  // mediums → smalls
  const e2 = fresh();
  play(e2);
  oneRock(e2, 2, 160, 100);
  park(e2, 100, 100, 0);
  tapFire(e2);
  for (let i = 0; i < 12; i++) e2.step();
  check("a medium pays 50 — and becomes two smalls", e2.vars.score === 50
    && sizes(e2).filter(v => v === 1).length === 2);
  // the last small clears the wave, and the next wave deals BIGGER
  const e3 = fresh();
  play(e3);
  oneRock(e3, 1, 160, 100);
  park(e3, 100, 100, 0);
  tapFire(e3);
  for (let i = 0; i < 12; i++) e3.step();
  check("a small pays 100 and dies clean", e3.vars.score === 100);
  check("clearing the sky deals wave 2 — with five big rocks",
    e3.vars.wave === 2 && sizes(e3).filter(v => v === 3).length === 5);
}

console.log("Four shots, no more:");
{
  const e = fresh();
  play(e);
  oneRock(e, 3, 400, 300);
  park(e, 100, 300, 0);
  for (let k = 0; k < 6; k++) tapFire(e);
  check("the air holds FOUR shots, never a fifth", liveShots(e) === 4);
  for (let i = 0; i < 50; i++) e.step();
  check("shots age out instead of crossing forever", liveShots(e) === 0);
  // inheritance: a drifting ship throws drifting shots
  const e2 = fresh();
  play(e2);
  oneRock(e2, 3, 400, 300);
  park(e2, 100, 200, -90);
  e2.vars.vx = 2;
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  const s = e2.byName.shot1;
  check("shots inherit the ship's velocity, like the cabinet", s.live === 1
    && Math.abs(s.vx - 2) < 0.01 && s.vy < -6);
}

console.log("The saucers:");
{
  const e = fresh();
  play(e);
  oneRock(e, 3, 400, 40);
  park(e, 240, 300, 0);
  e.vars.saucert = 1;
  e.step();
  for (let i = 0; i < 40; i++) e.step();   // let it fly on-screen
  check("the big saucer answers the bell", e.vars.sauceron === 1
    && e.byName.saucer.visible === 1 && e.byName.saucer.x > 20);
  // shoot it
  const sau = e.byName.saucer;
  const sh = e.byName.shot1;
  sh.live = 1; sh.age = 10; sh.x = sau.x; sh.y = sau.y; sh.vx = 0; sh.vy = 0;
  const sc0 = e.vars.score;
  e.step();
  check("…and pays 200", e.vars.score === sc0 + 200 && e.vars.sauceron === 0);
  // the small one shows up once you look dangerous — and it AIMS
  e.vars.score = 6000;
  let got2 = false;
  for (let t = 0; t < 60 && !got2; t++) {
    e.vars.sauceron = 0; e.vars.saucert = 1;
    e.step();
    if (e.vars.sauceron === 2) got2 = true;
  }
  check("past 5000 the SMALL saucer starts hunting", got2);
  for (let i = 0; i < 40; i++) e.step();   // on-screen again
  park(e, 400, 200, 0);                        // ship to the saucer's right, clear of the test rock
  e.vars.shipdead = 0;
  e.vars.sshot = 0; e.vars.sfiret = 1;
  e.step();
  check("…and its shot is AIMED at you", e.vars.sshot === 1 && e.vars.ssvx > 0);
  // killing the small one pays 1000
  const sau2 = e.byName.saucer;
  const sh2 = e.byName.shot2;
  sh2.live = 1; sh2.age = 10; sh2.x = sau2.x; sh2.y = sau2.y; sh2.vx = 0; sh2.vy = 0;
  const sc1 = e.vars.score;
  e.step();
  check("the small saucer pays 1000", e.vars.score === sc1 + 1000);
  // the saucer's shot kills
  const e2 = fresh();
  play(e2);
  oneRock(e2, 3, 400, 40);
  park(e2, 240, 300, 0);
  e2.vars.sauceron = 1; e2.vars.sshot = 1; e2.vars.sshotl = 50;
  e2.byName.sshot1.x = 240; e2.byName.sshot1.y = 300;
  e2.vars.ssvx = 0; e2.vars.ssvy = 0;
  e2.step(); e2.step();
  check("the saucer shoots back — and it counts", e2.vars.lives === 2 && e2.vars.shipdead > 0);
}

console.log("Hyperspace, rocks, and the last ship:");
{
  const e = fresh();
  play(e);
  oneRock(e, 3, 400, 40);
  park(e, 240, 180, 0);
  e.vars.vx = 2; e.vars.vy = 1;
  e.keys["s"] = true; e.step(); e.keys["s"] = false; e.step();
  const moved = ship(e).x !== 240 + 2 + 2 || e.vars.shipdead > 0;
  check("hyperspace jumps somewhere else — momentum does not follow",
    moved && e.vars.vx === 0 && e.vars.vy === 0);
  // a rock is the law
  const e2 = fresh();
  play(e2);
  oneRock(e2, 3, 240, 180);
  park(e2, 240, 180, 0);
  e2.step();
  check("flying into a rock costs a ship", e2.vars.lives === 2 && e2.vars.shipdead > 0);
  e2.lists.rsz[0] = 3; e2.lists.rx[0] = 400; e2.lists.ry[0] = 40;   // move it away
  for (let i = 0; i < 95; i++) e2.step();
  check("…then a fresh ship appears centre-screen", e2.vars.shipdead === 0
    && ship(e2).x === 240 && ship(e2).y === 180 && e2.vars.vx === 0);
  // burn the last two ships
  for (let k = 0; k < 2; k++) {
    e2.lists.rx[0] = ship(e2).x; e2.lists.ry[0] = ship(e2).y;
    e2.lists.rvx[0] = 0; e2.lists.rvy[0] = 0;
    e2.step();
    e2.lists.rx[0] = 400; e2.lists.ry[0] = 40;
    for (let i = 0; i < 95; i++) e2.step();
  }
  check("the last ship ends the play (endplay + ★ table)", e2.vars.game === 2
    && Number(e2.vars.endplay) === 1 && String(e2.byName.status.text).includes("GAME OVER"));
  e2.fireClick(10, 10); e2.step();
  check("a click after game over returns to attract", e2.vars.game === 9);
}

console.log("The cabinet's pulse:");
{
  const e = fresh();
  play(e);
  oneRock(e, 3, 400, 40);
  park(e, 100, 300, 0);
  for (let i = 0; i < 120; i++) e.step();
  check("the two-tone heartbeat thumps under everything",
    e.beeps.some(b => b.freq === 92) && e.beeps.some(b => b.freq === 78));
  // extra ship at 10,000
  e.vars.score = 10010;
  e.step();
  check("10,000 points buys an extra ship", e.vars.lives === 4 && e.vars.nextlife === 20000);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

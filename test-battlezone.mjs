// Headless test: Battlezone (1980) — the first-person projection, treads,
// solid cover, the hunter tank and its dodgeable shell, the missile round,
// the radar, and the last hull.
import { Engine } from "./js/engine.js";
import { buildBattlezoneExample } from "./studio/example-battlezone.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildBattlezoneExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 214); e.step(); };
// park the hunter far away and quiet
const bench = (e) => {
  e.vars.ex = e.vars.px + 5000; e.vars.ez = e.vars.pz + 5000;
  e.vars.emiss = 0; e.vars.eshell = 0; e.vars.efire = 99999;
};
const tapFire = (e) => { e.keys["Space"] = true; e.step(); e.keys["Space"] = false; e.step(); };

console.log("Battlezone (1980):");
{
  const ex = buildBattlezoneExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick on the TREADS", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "TREADS"));
  check("a battlefield of six solid shapes, a radar, a volcano",
    ex.objects.filter(o => /^(pyramid|block)\d/.test(o.name)).length === 6
    && ex.objects.some(o => o.name === "radarsweep")
    && ex.objects.some(o => o.name === "volcano"));
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin rolls you out: 3 hulls, an enemy already in the zone",
    e.vars.game === 0 && e.vars.lives === 3
    && Math.abs(e.vars.ex) + Math.abs(e.vars.ez) > 200);
}

console.log("Treads and the periscope:");
{
  const e = fresh();
  play(e);
  bench(e);
  e.vars.px = 0; e.vars.pz = 0; e.vars.hdg = 0;
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["w"] = false;
  check("W drives forward along the heading", e.vars.pz > 25 && Math.abs(e.vars.px) < 2);
  e.keys["d"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["d"] = false;
  check("D turns the hull", e.vars.hdg > 20);
  // the projection: something dead ahead sits on the crosshair
  e.vars.px = 0; e.vars.pz = 0; e.vars.hdg = 0;
  bench(e);
  e.vars.ex = 0; e.vars.ez = 200;
  e.step();
  check("dead ahead projects to screen centre", Math.abs(e.vars.escx - 240) < 2 && e.vars.eson === 1);
  const far = e.vars.escs;
  e.vars.ez = 60; e.step();
  check("…and GROWS as it closes — that's the 3D", e.vars.escs > far * 2);
  e.vars.ex = 0; e.vars.ez = -100; e.step();
  check("behind you is behind you — not drawn", e.vars.eson === 0);
  // turning swings the world, not the enemy
  e.vars.ex = 0; e.vars.ez = 200;
  e.vars.hdg = 30; e.step();
  check("turning right swings the world LEFT past the periscope", e.vars.escx < 200);
  // solid geometry
  e.vars.hdg = 0;
  e.vars.px = 120; e.vars.pz = 120;        // pyramid at (120,160)
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["w"] = false;
  check("you can hide behind the pyramid — not drive through it", e.vars.pz <= 135);
}

console.log("The gun and the hunt:");
{
  const e = fresh();
  play(e);
  bench(e);
  e.vars.px = -200; e.vars.pz = -300; e.vars.hdg = 0;   // clear lane north
  e.vars.ex = -200; e.vars.ez = -160;
  const sc0 = e.vars.score, k0 = e.vars.kills;
  tapFire(e);
  for (let i = 0; i < 30 && e.vars.kills === k0; i++) e.step();
  check("a shell down the barrel kills the tank (+1000)", e.vars.kills === k0 + 1
    && e.vars.score === sc0 + 1000);
  check("…and a fresh hunter takes the field at distance",
    Math.abs(e.vars.ex - e.vars.px) + Math.abs(e.vars.ez - e.vars.pz) > 250);
  // cover stops shells
  const e2 = fresh();
  play(e2);
  bench(e2);
  e2.vars.px = 120; e2.vars.pz = 80; e2.vars.hdg = 0;    // pyramid at (120,160) dead ahead
  e2.vars.ex = 120; e2.vars.ez = 300;                     // enemy beyond it
  tapFire(e2);
  for (let i = 0; i < 40; i++) e2.step();
  check("your shell dies on the cover between you", e2.vars.kills === 0 && e2.vars.pshot === 0);
  // the chase closes
  const e3 = fresh();
  play(e3);
  e3.vars.emiss = 0; e3.vars.eshell = 0; e3.vars.efire = 99999;
  e3.vars.px = 0; e3.vars.pz = 0;
  e3.vars.ex = 400; e3.vars.ez = 400;
  const d0 = 800;
  for (let i = 0; i < 100; i++) { e3.step(); e3.vars.px = 0; e3.vars.pz = 0; }
  check("the tank stalks you", Math.abs(e3.vars.ex) + Math.abs(e3.vars.ez) < d0 - 80);
  check("…but keeps a gunner's distance, not a rammer's",
    Math.abs(e3.vars.ex) + Math.abs(e3.vars.ez) > 100);
}

console.log("Their shell is honest:");
{
  const e = fresh();
  play(e);
  e.vars.emiss = 0;
  e.vars.px = 0; e.vars.pz = 0; e.vars.hdg = 0;
  e.vars.ex = 0; e.vars.ez = 200;
  e.vars.efire = 1; e.vars.eshell = 0;
  e.step();
  check("in range, the tank fires", e.vars.eshell === 1);
  // stand still: it lands
  for (let i = 0; i < 120 && e.vars.lives === 3; i++) { e.step(); e.vars.px = 0; e.vars.pz = 0; }
  check("stand still and it costs a hull", e.vars.lives === 2 && e.vars.hitt > 0);
  // dodge: step aside and it whistles past
  const e2 = fresh();
  play(e2);
  e2.vars.emiss = 0;
  e2.vars.px = 0; e2.vars.pz = 0; e2.vars.hdg = 0;
  e2.vars.ex = 0; e2.vars.ez = 240;
  e2.vars.efire = 1; e2.vars.eshell = 0;
  e2.step();
  e2.vars.px = 60;                          // seen early, stepped aside
  for (let i = 0; i < 150 && e2.vars.lives === 3; i++) { e2.step(); e2.vars.px = 60; e2.vars.pz = 0; }
  check("seen early, it can be DODGED", e2.vars.lives === 3);
}

console.log("The missile round and the last hull:");
{
  const e = fresh();
  play(e);
  bench(e);
  e.vars.kills = 2;                         // the third kill summons the missile
  e.vars.px = -200; e.vars.pz = -300; e.vars.hdg = 0;
  e.vars.ex = -200; e.vars.ez = -170;
  tapFire(e);
  for (let i = 0; i < 30 && e.vars.kills === 2; i++) e.step();
  check("every third kill sends the MISSILE", e.vars.kills === 3 && e.vars.emiss === 1
    && String(e.byName.status.text).includes("MISSILE"));
  // it rams
  e.vars.ex = e.vars.px; e.vars.ez = e.vars.pz - 10;
  for (let i = 0; i < 20 && e.vars.lives === 3; i++) { e.vars.px = -200; e.vars.pz = -300; e.step(); }
  check("…and it does not shoot — it RAMS", e.vars.lives === 2);
  // the end
  const e2 = fresh();
  play(e2);
  e2.vars.lives = 1;
  e2.vars.emiss = 1;
  e2.vars.ex = e2.vars.px; e2.vars.ez = e2.vars.pz;
  e2.step(); e2.step();
  check("the last hull ends it (endplay + ★ table)", e2.vars.game === 2
    && Number(e2.vars.endplay) === 1);
  e2.fireClick(10, 10); e2.step();
  check("a click after the end returns to attract", e2.vars.game === 9);
}

// ---- the wreck lives in the WORLD, not on the glass
{
  const e = fresh(); play(e);
  e.vars.pshot = 1; e.vars.psage = 30;
  e.vars.psvx = 0; e.vars.psvz = 0;
  e.vars.psx = e.vars.ex; e.vars.psz = e.vars.ez;
  e.step();
  check("a kill lights a wreck with a world position and a timer",
    e.vars.wrecon === 1 && e.vars.wrect > 40 && Number.isFinite(e.vars.wrecx));
  const wx0 = e.vars.wrecx, wz0 = e.vars.wrecz, sx1 = e.vars.wkx;
  e.vars.hdg = (e.vars.hdg + 40) % 360;
  e.step();
  check("turning the periscope sweeps the wreck across the glass",
    Math.abs(e.vars.wkx - sx1) > 30);
  check("…while its WORLD position never moves", e.vars.wrecx === wx0 && e.vars.wrecz === wz0);
  for (let i = 0; i < 60; i++) e.step();
  check("the fire burns out after its time", e.vars.wrecon === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

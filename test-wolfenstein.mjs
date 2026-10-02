// Headless test: Castle Wolfenstein (1981) — the stealth ancestor.
// The castle grid, patrol lanes, the vision CONE (front yes, behind no),
// hold-ups and frisking, slow chest searches, the uniform and who it
// fools, loud gunfire, armored sentries, the barred great door, and the
// escape with the war plans.
import { Engine } from "./js/engine.js";
import { buildWolfensteinExample } from "./studio/example-wolfenstein.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildWolfensteinExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 210); e.step(); };
const putP = (e, x, y) => { e.vars.px = x; e.vars.py = y; };
const calm = (e) => { for (let k = 0; k < 3; k++) { e.lists.gon[k] = 0; } };           // empty the room
const oneGuard = (e, x, y, axis, mn, mx, type = 0) => {
  calm(e);
  e.lists.gon[0] = 1; e.lists.gx[0] = x; e.lists.gy[0] = y;
  e.lists.gax[0] = axis; e.lists.gmn[0] = mn; e.lists.gmx[0] = mx;
  e.lists.gtp[0] = type; e.lists.ghp[0] = 1 + type; e.lists.gst[0] = 0;
  e.lists.gdir[0] = 1; e.lists.gfrisk[0] = 0; e.lists.gft[0] = 9999;
  e.vars.grace = 0;
};
const key = (e, k, downSteps = 1) => { e.keys[k] = true; for (let i = 0; i < downSteps; i++) e.step(); e.keys[k] = false; e.step(); };

console.log("Castle Wolfenstein (1981):");

// ---- the cabinet
{
  const ex = buildWolfensteinExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("titled with the real name — the mechanics are history", ex.title === "Castle Wolfenstein (1981)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to SNEAK", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "SNEAK"));
  const keys = eng.usedKeys();
  check("E and SPACE on the panel", keys.includes("e") && keys.includes("Space"));
  check("subline states plain facts only",
    ex.objects.find(o => o.name === "subline").text === "MUSE SOFTWARE 1981 · APPLE II · ANCESTOR OF THE STEALTH GENRE");
}

// ---- the castle and the stocking
{
  const e = fresh(); play(e);
  check("you break in at the GATE CELLS with 3 spies and 8 rounds",
    e.vars.roomn === 7 && e.vars.lives === 3 && e.vars.bullets === 8 && e.vars.game === 0);
  const cw = e.lists.cwhat;
  const planAt = [], uniAt = [];
  for (let i = 0; i < 18; i++) { if (cw[i] === 3) planAt.push(i); if (cw[i] === 2) uniAt.push(i); }
  check("ONE war plans, hidden in a tower or cellar", planAt.length === 1 && [0, 4, 12, 16].includes(planAt[0]));
  check("ONE uniform, hanging in a wing", uniAt.length === 1 && [7, 11].includes(uniAt[0]));
  let open = 0;
  for (let i = 0; i < 18; i++) if (e.lists.copen[i]) open++;
  check("every chest starts shut", open === 0);
}

// ---- patrol: lanes, and the flip at the ends
{
  const e = fresh(); play(e);
  oneGuard(e, 240, 130, 0, 80, 400);
  putP(e, 240, 320);                     // far below, out of the cone
  let minX = 999, maxX = -999, left = false, right = false;
  for (let i = 0; i < 1400; i++) {
    e.step();
    const x = e.lists.gx[0];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    if (e.lists.gdir[0] === -1) left = true;
    if (e.lists.gdir[0] === 1) right = true;
  }
  check("a guard walks his whole lane and turns at the ends",
    left && right && minX < 110 && maxX > 370 && minX > 60 && maxX < 420);
  check("…and a spy parked behind the lane is never seen", e.lists.gst[0] === 0 && e.vars.lives === 3);
}

// ---- the cone: in front you're seen; behind him you're a ghost
{
  const e = fresh(); play(e);
  oneGuard(e, 240, 200, 0, 100, 380);    // walking right
  e.lists.gdir[0] = 1;
  putP(e, 330, 200);                     // dead ahead, 90 away
  e.step();
  check("step into his facing and it's HALT", e.lists.gst[0] === 1);
  const e2 = fresh(); play(e2);
  oneGuard(e2, 240, 200, 0, 100, 380);
  e2.lists.gdir[0] = 1;
  putP(e2, 150, 200);                    // the same distance BEHIND him
  e2.step();
  check("the same distance behind his back: unseen", e2.lists.gst[0] === 0);
  const e3 = fresh(); play(e3);
  oneGuard(e3, 100, 200, 0, 60, 420);
  e3.lists.gdir[0] = 1;
  putP(e3, 420, 200);                    // in front but 320 away
  e3.step();
  check("his eyes stop at 150 — far down the hall is safe", e3.lists.gst[0] === 0);
}

// ---- the uniform fools the rank and file, never the armor
{
  const e = fresh(); play(e);
  e.vars.uniform = 1;
  oneGuard(e, 240, 200, 0, 100, 380, 0); // regular
  putP(e, 330, 200);
  e.step();
  check("in uniform, a regular guard looks right through you", e.lists.gst[0] === 0);
  oneGuard(e, 240, 200, 0, 100, 380, 1); // armored sentry
  putP(e, 330, 200);
  e.step();
  check("an ARMORED sentry sees through the uniform", e.lists.gst[0] === 1);
}

// ---- hold up and frisk
{
  const e = fresh(); play(e);
  oneGuard(e, 270, 300, 0, 100, 380);    // close, facing right; spy beside him
  e.lists.gdir[0] = -1;                   // looking away
  putP(e, 240, 300);
  const sc = e.vars.score;
  key(e, "e");
  check("E beside an unsuspecting guard: hands up, +100", e.lists.gst[0] === 2 && e.vars.score === sc + 100);
  const gx = e.lists.gx[0];
  for (let i = 0; i < 40; i++) e.step();
  check("a held-up guard stands where he froze and never fires", e.lists.gx[0] === gx && e.vars.lives === 3);
  const b = e.vars.bullets;
  key(e, "e");
  check("E again frisks him: +2 rounds, +50", e.vars.bullets === b + 2 && e.vars.score === sc + 150);
  key(e, "e");
  check("his pockets only empty once", e.vars.bullets === b + 2);
}

// ---- the chest search: slow, frozen, and worth it
{
  const e = fresh(); play(e); calm(e);
  e.vars.grace = 0;
  const ci = e.vars.c0i;
  e.lists.cwhat[ci] = 1;                  // rounds inside
  putP(e, e.vars.c0x + 10, e.vars.c0y);
  e.keys["e"] = true; e.step(); e.keys["e"] = false;
  check("E at a chest starts the dig", e.vars.srch === ci + 1);
  const px = e.vars.px;
  e.keys["d"] = true;
  for (let i = 0; i < 30; i++) e.step();
  e.keys["d"] = false;
  check("you stand frozen while you search — running is not digging", e.vars.px === px && e.vars.srch > 0);
  const b = e.vars.bullets, sc = e.vars.score;
  for (let i = 0; i < 120; i++) e.step();
  check("the chest opens: +3 rounds, +50, and stays open",
    e.vars.srch === 0 && e.lists.copen[ci] === 1 && e.vars.bullets === b + 3 && e.vars.score === sc + 50);
  // the uniform and the plans come out of chests too
  const e2 = fresh(); play(e2); calm(e2); e2.vars.grace = 0;
  const c2 = e2.vars.c1i;
  e2.lists.cwhat[c2] = 3;
  putP(e2, e2.vars.c1x, e2.vars.c1y);
  e2.keys["e"] = true; e2.step(); e2.keys["e"] = false;
  for (let i = 0; i < 125; i++) e2.step();
  check("the WAR PLANS come out of a chest (+500)", e2.vars.plans === 1);
}

// ---- the pistol is loud
{
  const e = fresh(); play(e);
  oneGuard(e, 100, 100, 0, 60, 420);      // far away, facing away from us
  e.lists.gdir[0] = -1;
  putP(e, 400, 320);
  e.vars.fdx = -1; e.vars.fdy = 0;
  const b = e.vars.bullets;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false; e.step();
  check("a shot spends a round", e.vars.bullets === b - 1);
  check("…and EVERY patroller in the room comes alert", e.lists.gst[0] === 1);
  // no rounds, no bang
  const e2 = fresh(); play(e2); calm(e2);
  e2.vars.bullets = 0;
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false; e2.step();
  check("an empty gun just clicks", e2.vars.pbon === 0 && e2.vars.bullets === 0);
}

// ---- shooting guards: one round for cloth, two for armor
{
  const e = fresh(); play(e);
  oneGuard(e, 300, 300, 0, 100, 380, 0);
  putP(e, 240, 300);
  e.vars.fdx = 1; e.vars.fdy = 0;
  const sc = e.vars.score;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  for (let i = 0; i < 20; i++) e.step();
  check("a regular guard falls to one round (+25)", e.lists.gon[0] === 0 && e.vars.score === sc + 25 && e.vars.kills === 1);
  const e2 = fresh(); play(e2);
  oneGuard(e2, 300, 300, 0, 100, 380, 1);
  e2.lists.gft[0] = 9999;
  putP(e2, 240, 300);
  e2.vars.fdx = 1; e2.vars.fdy = 0;
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  for (let i = 0; i < 20; i++) e2.step();
  const afterOne = e2.lists.gon[0];
  e2.lists.gft[0] = 9999;
  putP(e2, 240, 300);
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  for (let i = 0; i < 20; i++) e2.step();
  check("an armored sentry takes TWO", afterOne === 1 && e2.lists.gon[0] === 0);
}

// ---- getting caught
{
  const e = fresh(); play(e);
  oneGuard(e, 240, 300, 0, 100, 380);
  putP(e, 240, 300);                       // standing on him
  e.step();
  check("a guard's hands on you costs a spy", e.vars.lives === 2);
  check("…and the room resets around the survivor", e.vars.grace > 0 && e.vars.srch === 0);
  const e2 = fresh(); play(e2); calm(e2); e2.vars.grace = 0;
  const LL = (n) => e2.lists[n] || (e2.lists[n] = {});
  LL("sson")[0] = 1; LL("ssx")[0] = e2.vars.px; LL("ssy")[0] = e2.vars.py;
  LL("ssvx")[0] = 0; LL("ssvy")[0] = 0;
  e2.step();
  check("a guard's round costs a spy too", e2.vars.lives === 2);
  const e3 = fresh(); play(e3);
  e3.vars.lives = 1;
  oneGuard(e3, 240, 300, 0, 100, 380);
  putP(e3, 240, 300);
  e3.step();
  check("the last spy caught: CAPTURED, scoreboard time", e3.vars.game === 2 && e3.vars.endplay === 1);
}

// ---- the castle grid: doors, sealed edges, and walls that block
{
  const e = fresh(); play(e); calm(e);
  putP(e, 14, 180);                        // west doorway of the gate cells
  e.keys["a"] = true; for (let i = 0; i < 6; i++) e.step(); e.keys["a"] = false;
  check("the west doorway leads to the SW CELLAR", e.vars.roomn === 6 && e.vars.px > 400);
  calm(e);
  putP(e, 20, 180);
  e.keys["a"] = true; for (let i = 0; i < 20; i++) e.step(); e.keys["a"] = false;
  check("the castle's outer edge is sealed — no doorway out the west wall", e.vars.roomn === 6 && e.vars.px >= 10);
  // interior stone blocks the spy
  const e2 = fresh(); play(e2); calm(e2); e2.vars.grace = 0;
  putP(e2, 240, 250);                      // below the gate cells' wall at y=230 (x 150–330)
  e2.keys["w"] = true; for (let i = 0; i < 20; i++) e2.step(); e2.keys["w"] = false;
  check("interior stone stops you (no walking through walls)", e2.vars.py > 230);
}

// ---- the great door: barred without the plans, open with them
{
  const e = fresh(); play(e); calm(e);
  e.vars.roomc = 1; e.vars.roomr = 0; e.vars.roomn = 1;
  e.vars.plans = 0; e.vars.grace = 0;
  putP(e, 240, 46);
  e.keys["w"] = true; for (let i = 0; i < 8; i++) e.step(); e.keys["w"] = false; e.step();
  check("without the plans the great door is BARRED", e.vars.game === 0 && e.vars.py >= 42 && e.vars.roomn === 1);
  const e2 = fresh(); play(e2); calm(e2);
  e2.vars.roomc = 1; e2.vars.roomr = 0; e2.vars.roomn = 1;
  e2.vars.plans = 1; e2.vars.grace = 0; e2.vars.kills = 0;
  const sc = e2.vars.score;
  putP(e2, 240, 46);
  e2.keys["w"] = true; for (let i = 0; i < 8; i++) e2.step(); e2.keys["w"] = false; e2.step();
  check("with the plans: OUT — 1500 + 300 a spy, +500 for no shots",
    e2.vars.game === 2 && e2.vars.endplay === 1 && e2.vars.score === sc + 1500 + 3 * 300 + 500);
  const e3 = fresh(); play(e3); calm(e3);
  e3.vars.roomc = 1; e3.vars.roomr = 0; e3.vars.roomn = 1;
  e3.vars.plans = 1; e3.vars.grace = 0; e3.vars.kills = 2;
  const sc3 = e3.vars.score;
  putP(e3, 240, 46);
  e3.keys["w"] = true; for (let i = 0; i < 8; i++) e3.step(); e3.keys["w"] = false; e3.step();
  check("a bloodier escape forfeits the no-shots bonus", e3.vars.game === 2 && e3.vars.score === sc3 + 1500 + 3 * 300);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

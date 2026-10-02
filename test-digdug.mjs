// Headless test: Dig Dug (1982) — dig, inflate, drop rocks.
// Carving tunnels for points, the pump (dirt stops it, four stages pop),
// deflation, stratum pay, ghosting through dirt, wyrm fire, undermined
// rocks (crush pay, prize at two drops), touch deaths, and the clear.
import { Engine } from "./js/engine.js";
import { buildDigDugExample } from "./studio/example-digdug.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const CS = 26, X0 = 24, Y0 = 67, COLS = 13;
const X = (c) => X0 + c * CS, Y = (r) => Y0 + r * CS;
const fresh = () => {
  const e = new Engine(null, buildDigDugExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 276); e.step(); };
const calm = (e) => { for (let k = 0; k < 6; k++) e.lists.eon[k] = 0; };
const putP = (e, c, r) => {
  e.vars.px = X(c); e.vars.py = Y(r); e.vars.pc = c; e.vars.pr = r;
  e.vars.grace = 0;
};
const oneEnemy = (e, k, c, r) => {
  calm(e);
  e.lists.eon[k] = 1; e.lists.ex[k] = X(c); e.lists.ey[k] = Y(r);
  e.lists.ec[k] = c; e.lists.er[k] = r; e.lists.est[k] = 0;
  e.lists.einf[k] = 0; e.lists.egt[k] = 99999; e.lists.eft[k] = 99999; e.lists.efl[k] = 0;
};
const dig = (e, c, r) => { e.lists.dug[r * COLS + c] = 1; };

console.log("Dig Dug (1982):");

// ---- the cabinet
{
  const ex = buildDigDugExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a portrait cabinet", ex.w === 360 && ex.h === 480);
  check("titled Dig Dug (1982)", ex.title === "Dig Dug (1982)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to DIG", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "DIG"));
}

// ---- the field
{
  const e = fresh(); play(e);
  check("level 1 fields 4 burrowers, 3 diggers", e.vars.ecount === 4 && e.vars.eleft === 4 && e.vars.lives === 3);
  check("the sky row is open", [...Array(13).keys()].every(c => e.lists.dug[c] === 1));
  check("the center shaft is pre-dug", e.lists.dug[7 * COLS + 6] === 1 && e.lists.dug[1 * COLS + 6] === 1);
  check("no rock falls before anyone digs", e.vars.rockdrops === 0);
  let rocks = 0;
  for (let i = 0; i < 4; i++) if (e.lists.ron[i]) rocks++;
  check("four rocks sleep in the dirt", rocks === 4);
}

// ---- digging pays and carves
{
  const e = fresh(); play(e); calm(e);
  const sc0 = e.vars.score;
  const idx = 7 * COLS + 5;
  check("the cell west of the shaft is dirt", e.lists.dug[idx] === 0);
  e.keys["a"] = true;
  for (let i = 0; i < 25; i++) e.step();
  e.keys["a"] = false;
  check("digging west carves the cell for 10 points", e.lists.dug[idx] === 1 && e.vars.score >= sc0 + 10 && e.vars.pc <= 5);
  // dirt slows the dig
  const e2 = fresh(); play(e2); calm(e2);
  e2.keys["w"] = true;                    // up the pre-dug shaft
  for (let i = 0; i < 13; i++) e2.step();
  e2.keys["w"] = false;
  const openRows = 7 - e2.vars.pr;
  const e3 = fresh(); play(e3); calm(e3);
  e3.keys["a"] = true;                    // west into solid dirt
  for (let i = 0; i < 13; i++) e3.step();
  e3.keys["a"] = false;
  check("tunnels are faster than dirt", openRows >= 1 && (e3.vars.px >= X(6) - 20));
}

// ---- the pump: dirt stops it, four stages pop, release deflates
{
  const e = fresh(); play(e);
  oneEnemy(e, 0, 8, 7);                   // in the row-7 pocket, east of a dirt wall at (7,7)
  putP(e, 6, 7);
  e.vars.pdir = 0; e.vars.want = 0;
  e.keys["Space"] = true;
  for (let i = 0; i < 12; i++) e.step();
  check("dirt stops the pump line — no hit through the wall", e.vars.hstate === 0 && e.lists.einf[0] === 0);
  e.keys["Space"] = false; e.step();
  // open the wall, try again
  dig(e, 7, 7);
  oneEnemy(e, 0, 8, 7);
  putP(e, 6, 7); e.vars.pdir = 0;
  e.keys["Space"] = true;
  for (let i = 0; i < 10; i++) e.step();
  check("down the tunnel it bites", e.vars.hstate === 2 && e.vars.hk === 0);
  const px0 = e.vars.px;
  for (let i = 0; i < 20; i++) e.step();
  check("pumping roots you to the spot", e.vars.px === px0);
  check("…and the burrower inflates", e.lists.einf[0] >= 1);
  e.keys["Space"] = false; e.step();
  const inf = e.lists.einf[0];
  check("let go and it starts to deflate (and you are free)", e.vars.hstate === 0 && inf >= 1);
  for (let i = 0; i < 45 * inf + 10; i++) e.step();
  check("…all the way back down", e.lists.einf[0] === 0);
  // pop it: hold until stage 4
  oneEnemy(e, 0, 8, 7);
  putP(e, 6, 7); e.vars.pdir = 0;
  const sc0 = e.vars.score, left0 = e.vars.eleft;
  e.keys["Space"] = true;
  for (let i = 0; i < 90; i++) e.step();
  e.keys["Space"] = false;
  check("four stages and it POPS — stratum 1 pays 300 (wyrm row... rounder 200+)",
    e.lists.eon[0] === 0 && e.vars.eleft === left0 - 1 && e.vars.score >= sc0 + 200);
}

// ---- deeper strata pay more
{
  const e = fresh(); play(e);
  oneEnemy(e, 0, 8, 12);                  // deepest stratum
  dig(e, 7, 12); dig(e, 6, 12);
  putP(e, 6, 12); e.vars.pdir = 0;
  const sc0 = e.vars.score;
  e.keys["Space"] = true;
  for (let i = 0; i < 90; i++) e.step();
  e.keys["Space"] = false;
  check("a pop in the deepest stratum pays 500", e.vars.score === sc0 + 500);
}

// ---- ghosting: through the dirt, then solid again in a tunnel
{
  const e = fresh(); play(e);
  oneEnemy(e, 0, 1, 3);
  e.lists.egt[0] = 2;                     // about to ghost
  putP(e, 6, 7);
  e.step(); e.step();
  check("the timer sends it GHOST", e.lists.est[0] === 1);
  const d0 = Math.abs(e.lists.ex[0] - e.vars.px) + Math.abs(e.lists.ey[0] - e.vars.py);
  for (let i = 0; i < 60; i++) e.step();
  const d1 = Math.abs(e.lists.ex[0] - e.vars.px) + Math.abs(e.lists.ey[0] - e.vars.py);
  check("a ghost drifts straight at you, dirt be damned", d1 < d0 - 25);
  for (let i = 0; i < 400 && e.lists.est[0] === 1; i++) e.step();
  check("it turns solid again in a dug cell",
    e.lists.est[0] === 0 && e.lists.dug[e.lists.er[0] * COLS + e.lists.ec[0]] === 1);
}

// ---- the wyrm breathes fire down the row
{
  const e = fresh(); play(e);
  oneEnemy(e, 1, 8, 2);                   // slot 1 is a wyrm (its pocket row)
  putP(e, 10, 2);
  e.lists.eft[1] = 1;                     // ready to breathe
  const lives0 = e.vars.lives;
  for (let i = 0; i < 60; i++) e.step();
  check("stand in the fire and burn", e.vars.lives === lives0 - 1);
}

// ---- touch kills; inflated burrowers are harmless
{
  const e = fresh(); play(e);
  oneEnemy(e, 0, 6, 7);
  putP(e, 6, 7);
  const l0 = e.vars.lives;
  e.step();
  check("a burrower's touch costs a digger", e.vars.lives === l0 - 1);
  const e2 = fresh(); play(e2);
  oneEnemy(e2, 0, 6, 7);
  e2.lists.einf[0] = 2;
  putP(e2, 6, 7);
  const l2 = e2.vars.lives;
  e2.step();
  check("an inflated one is just a balloon", e2.vars.lives === l2);
}

// ---- rocks: undermine, wobble, fall, crush, prize
{
  const e = fresh(); play(e); calm(e);
  // rock 1 sits at (10,4); open the cell beneath it
  dig(e, 10, 5);
  putP(e, 3, 13);                          // far away
  e.step();
  check("dig out its floor and the rock wobbles", e.lists.rst[1] === 1);
  oneEnemy(e, 0, 10, 6);                   // a burrower under the fall line
  e.lists.egt[0] = 99999;
  e.lists.einf[0] = 3;                     // ballooned in place — it can't flee the shadow
  dig(e, 10, 6);
  const sc0 = e.vars.score, left0 = e.vars.eleft;
  for (let i = 0; i < 120; i++) e.step();
  check("…then falls and crushes for 1000",
    e.lists.ron[1] === 0 && e.vars.score >= sc0 + 1000 && e.vars.eleft === left0 - 1);
  check("one rock down", e.vars.rockdrops === 1);
  // drop a second: the prize appears
  dig(e, 5, 9);
  for (let i = 0; i < 200; i++) e.step();
  check("two rocks down: the PRIZE appears at the surface", e.vars.rockdrops === 2 && e.vars.prizeon === 1);
  putP(e, 6, 0);
  const sc1 = e.vars.score;
  e.step();
  check("grab it for 1000", e.vars.score === sc1 + 1000 && e.vars.prizeon === 0);
  // a rock crushes the digger too
  const e2 = fresh(); play(e2); calm(e2);
  dig(e2, 10, 5); dig(e2, 10, 6);
  putP(e2, 10, 6);
  const l2 = e2.vars.lives;
  for (let i = 0; i < 120; i++) e2.step();
  check("stand under one and it crushes you too", e2.vars.lives === l2 - 1);
}

// ---- the clear and the end
{
  const e = fresh(); play(e); calm(e);
  e.vars.eleft = 0;
  const sc0 = e.vars.score;
  e.step();
  check("field clear: +500, level 2, fresh dirt",
    e.vars.level === 2 && e.vars.score === sc0 + 500 && e.vars.eleft === 5);
  check("level 2 fields five burrowers", e.vars.ecount === 5);
  const e2 = fresh(); play(e2);
  e2.vars.lives = 1;
  oneEnemy(e2, 0, 6, 7);
  putP(e2, 6, 7);
  e2.step();
  check("the last digger buried: scoreboard time", e2.vars.game === 2 && e2.vars.endplay === 1);
}

// ---- death keeps the tunnels
{
  const e = fresh(); play(e); calm(e);
  dig(e, 5, 7); dig(e, 4, 7);
  oneEnemy(e, 0, 6, 7);
  putP(e, 6, 7);
  e.step();
  check("a death resets the field's people, not its tunnels",
    e.vars.lives === 2 && e.lists.dug[7 * COLS + 5] === 1 && e.lists.dug[7 * COLS + 4] === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

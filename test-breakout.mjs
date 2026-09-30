// Headless test: Breakout (1976) — the wall, the bands, the speed ladder,
// the shrinking paddle, two walls per coin, and the arcade contract.
import { Engine } from "./js/engine.js";
import { buildBreakoutExample } from "./studio/example-breakout.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const build = () => buildBreakoutExample();
const fresh = () => {
  const e = new Engine(null, build().objects, { w: 360, h: 480 });
  e.runEvents("start"); e.step();
  return e;
};
const startGame = (e) => { e.fireClick(180, 250); e.step(); };
const serve = (e) => { e.keys["Space"] = true; e.step(); e.keys["Space"] = false; };
const ball = (e) => e.byName.ball;
// park the ball dead-center in brick (row, col), aimed up
const aimAt = (e, row, col, vy = -3) => {
  ball(e).x = 12 + col * 24 + 12;
  ball(e).y = 83 + row * 14 + 7;
  e.vars.vx = 0; e.vars.vy = vy;
};

console.log("Breakout (1976):");
{
  const ex = build();
  check("the cabinet is PORTRAIT — the 1976 monitor stood vertical", ex.w === 360 && ex.h === 480);
  const bricks = ex.objects.filter(o => o.name.startsWith("brick"));
  check("8 rows × 14 bricks = 112 slabs", bricks.length === 112);
  const colorOf = (k) => bricks[k].color;
  check("the cellophane bands: red / orange / green / yellow, top down",
    colorOf(0) === "#e5322d" && colorOf(2 * 14) === "#ff9d4a" && colorOf(4 * 14) === "#39ff5e" && colorOf(6 * 14) === "#ffe14a");
  check("the stick wears the knob's name", ex.objects.some(o => o.name === "stick1tag" && o.text === "KNOB"));
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay → ★ HIGH SCORES)", eng.usesScoreboard());
  check("…and is NOT a casino machine", !eng.usesCasino());
}

console.log("Attract mode:");
{
  const e = fresh();
  check("opens in attract with the full wall lit", e.vars.game === 9 && e.vars.left === 112);
  check("title up, paddle hidden", Number(e.byName.bigtitle.visible) === 1 && Number(e.byName.pad.visible) === 0);
  const bx = ball(e).x, by = ball(e).y;
  for (let i = 0; i < 90; i++) e.step();
  check("the attract ball wanders", Math.abs(ball(e).x - bx) > 1 || Math.abs(ball(e).y - by) > 1);
  check("bricks are honest display objects watching b[]", Number(e.byName.brick1.visible) === 1);
}

console.log("A coin drops:");
{
  const e = fresh();
  startGame(e);
  check("click starts a match: 3 balls, wall 1, score 0", e.vars.game === 0 && e.vars.balls === 3 && e.vars.scr === 1 && e.vars.score === 0);
  check("serving: the ball rides the paddle", e.vars.serving === 1 && Math.abs(ball(e).x - e.byName.pad.x) < 1);
  serve(e);
  check("SPACE serves — upward, at base speed", e.vars.serving === 0 && e.vars.vy < 0);
  const e2 = fresh();
  startGame(e2);
  for (let i = 0; i < 95 && e2.vars.serving === 1; i++) e2.step();
  check("…or the timer serves it for you", e2.vars.serving === 0);
}

console.log("The wall pays by the band:");
{
  for (const [row, pts, name] of [[0, 7, "red"], [2, 5, "orange"], [4, 3, "green"], [6, 1, "yellow"]]) {
    const e = fresh();
    startGame(e); serve(e);
    const s0 = e.vars.score;
    aimAt(e, row, 5);
    e.step();
    check(`a ${name}-band brick pays ${pts}`, e.vars.score - s0 === pts);
  }
  const e = fresh();
  startGame(e); serve(e);
  aimAt(e, 6, 3, -3);
  const before = e.vars.left;
  e.step();
  check("the brick dies (b[] slot zeroed, wall count down one)", e.vars.left === before - 1 && e.lists.b[6 * 14 + 3] === 0);
  check("…and the ball bounced off it", e.vars.vy > 0);
  e.step(); e.step();
  check("its display slab went dark", Number(e.byName["brick" + (6 * 14 + 3 + 1)].visible) === 0);
}

console.log("The speed ladder:");
{
  const e = fresh();
  startGame(e); serve(e);
  const s0 = e.vars.speed;
  // 4 yellow bricks: the 4th hit bumps the speed
  for (let c = 0; c < 4; c++) { aimAt(e, 7, c); e.step(); }
  check("the 4th hit is faster", e.vars.hits === 4 && e.vars.speed > s0);
  const s4 = e.vars.speed;
  aimAt(e, 2, 8); e.step();   // first taste of orange
  check("first ORANGE hit bumps again", e.vars.oflag === 1 && e.vars.speed > s4);
  const so = e.vars.speed;
  aimAt(e, 0, 8); e.step();   // first taste of red
  check("first RED hit bumps again", e.vars.rflag === 1 && e.vars.speed > so);
  check("speed is capped", e.vars.speed <= 7);
}

console.log("The 1976 cruelties:");
{
  const e = fresh();
  startGame(e); serve(e);
  ball(e).x = 180; ball(e).y = 46; e.vars.vx = 0; e.vars.vy = -4;
  e.step();
  check("reaching the TOP WALL shrinks the paddle", e.vars.shrunk === 1 && e.vars.vy > 0);
  e.step();
  check("the outer paddle thirds vanish", Number(e.byName.padl.visible) === 0 && Number(e.byName.pad.visible) === 1);
  // paddle still returns the ball at its shrunken width
  ball(e).x = e.byName.pad.x; ball(e).y = 436; e.vars.vx = 0; e.vars.vy = 4;
  e.step();
  check("the half paddle still plays", e.vars.vy < 0);

  const e3 = fresh();
  startGame(e3); serve(e3);
  ball(e3).x = 40; ball(e3).y = 436; e3.vars.vx = 0; e3.vars.vy = 4;
  e3.byName.pad.x = 40;
  e3.step();
  check("a full paddle returns the ball (center = flat)", e3.vars.vy < 0 && Math.abs(e3.vars.vx) < 1.5);
  ball(e3).x = 60; ball(e3).y = 436; e3.vars.vx = 0; e3.vars.vy = 4;
  e3.byName.pad.x = 40;   // catch it on the edge
  e3.step();
  check("an edge catch throws a sharp angle", e3.vars.vy < 0 && e3.vars.vx > 2);
}

console.log("Losing balls, ending plays:");
{
  const e = fresh();
  startGame(e); serve(e);
  ball(e).x = 180; ball(e).y = 476; e.vars.vx = 0; e.vars.vy = 4;
  e.step();
  check("the drain takes a ball and re-serves", e.vars.balls === 2 && e.vars.serving === 1);
  serve(e);
  for (let i = 0; i < 2; i++) {
    ball(e).x = 180; ball(e).y = 476; e.vars.vx = 0; e.vars.vy = 4;
    e.step();
    if (e.vars.serving === 1) serve(e);
  }
  check("three balls = one coin: endplay fires", e.vars.balls === 0 && e.vars.game === 2 && Number(e.vars.endplay) === 1);
  e.fireClick(180, 250); e.step();
  check("after game over, a click returns to attract", e.vars.game === 9);
}

console.log("Two walls per coin:");
{
  const e = fresh();
  startGame(e); serve(e);
  // eat wall 1 down to a single brick, then take it
  for (let k = 0; k < 111; k++) e.lists.b[k] = 0;
  e.vars.left = 1;
  aimAt(e, 7, 13);
  e.step();
  check("clearing wall 1 drops in wall 2, fully lit", e.vars.scr === 2 && e.vars.left === 112 && e.vars.serving === 1);
  serve(e);
  for (let k = 0; k < 111; k++) e.lists.b[k] = 0;
  e.vars.left = 1;
  aimAt(e, 7, 13);
  e.step();
  check("clearing wall 2 ends the play — the machine surrenders", e.vars.game === 2 && Number(e.vars.endplay) === 1);
  check("a perfect-ish run kept its score", e.vars.score > 0);
}

console.log("The knob (keys AND stick, one paddle):");
{
  const e = fresh();
  startGame(e);
  const x0 = e.byName.pad.x;
  e.keys["d"] = true;
  for (let i = 0; i < 5; i++) e.step();
  e.keys["d"] = false;
  check("D slides the paddle right", e.byName.pad.x > x0);
  check("the outer thirds ride along", e.byName.padl.x === e.byName.pad.x - 16 && e.byName.padr.x === e.byName.pad.x + 16);
  e.setStick(1, -1, 0);
  for (let i = 0; i < 45; i++) e.step();
  e.clearStick(1);
  check("the stick is the 1976 knob — full left walks it to the wall", e.byName.pad.x <= 36);
  const probe = new Engine(null, build().objects);
  check("the game summons exactly one on-screen stick", JSON.stringify(probe.usedSticks()) === "[1]");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Headless test: Space Invaders (1978) — the march, the acceleration, the
// edge-drop, row scores, one-shot rule, eroding bunkers, bombs, lives,
// waves, the saucer, and the invasion ending.
import { Engine } from "./js/engine.js";
import { buildInvadersExample } from "./studio/example-invaders.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildInvadersExample().objects, { w: 360, h: 480 });
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 350); e.step(); };
const disarmBombs = (e) => { e.vars.bt1 = 99999; e.vars.bt2 = 99999; e.vars.bombon1 = 0; e.vars.bombon2 = 0; };
const fire = (e) => { e.keys["Space"] = true; e.step(); e.keys["Space"] = false; e.step(); };
// park the shot ONTO invader (r, c) and let one tick bite
const shootAt = (e, r, c) => {
  e.vars.shoton = 1;
  e.byName.shot.x = e.vars.fx + c * 26;
  e.byName.shot.y = e.vars.fy + r * 22 + 7;   // one 8px step above the slot
  e.step();
};

console.log("Space Invaders (1978):");
{
  const ex = buildInvadersExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a vertical cabinet — portrait 360×480", ex.w === 360 && ex.h === 480);
  const inv = ex.objects.filter(o => o.name.startsWith("inv"));
  check("fifty-five invaders, five rows of eleven", inv.length === 55);
  check("our own typography: Ф up top, Ж in the middle, Ψ below",
    inv[0].text === "Ф" && inv[11].text === "Ж" && inv[44].text === "Ψ");
  check("four bunkers of three blocks", ex.objects.filter(o => o.name.startsWith("bk")).length === 12);
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
}

console.log("The march:");
{
  const e = fresh();
  play(e);
  disarmBombs(e);
  const fx0 = e.vars.fx;
  for (let i = 0; i < 120; i++) e.step();
  check("the formation marches as one body", e.vars.fx !== fx0);
  check("…to the two-tone heartbeat", e.beeps.some(b => b.freq === 110) && e.beeps.some(b => b.freq === 98));
  // acceleration: the cadence with 55 alive vs 5 alive
  const full = e.vars.stepn;
  for (let k = 0; k < 50; k++) e.lists.a[k] = 0;
  e.vars.alive = 5;
  for (let i = 0; i < 45; i++) e.step();
  check("five survivors march MUCH faster than fifty-five", e.vars.stepn < full - 15);
  // the edge: hit the wall, drop a row, reverse
  const e2 = fresh();
  play(e2);
  disarmBombs(e2);
  const fy0 = e2.vars.fy;
  let flipped = false;
  for (let i = 0; i < 1800 && !flipped; i++) { e2.step(); if (e2.vars.dirx < 0) flipped = true; }
  check("the wall flips the march and DROPS the formation a row", flipped && e2.vars.fy === fy0 + 12);
}

console.log("One shot, paid by the row:");
{
  const e = fresh();
  play(e);
  disarmBombs(e);
  fire(e);
  check("SPACE fires", e.vars.shoton === 1);
  const y0 = e.byName.shot.y;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  check("one shot on screen — 1978's whole skill ceiling", e.vars.shoton === 1 && e.byName.shot.y < y0);
  // row pay: bottom 10, middle 20, top 30
  for (const [row, pts] of [[4, 10], [1, 20], [0, 30]]) {
    const s0 = e.vars.score;
    shootAt(e, row, 5 + row);   // different columns so slots are alive
    check(`row ${row} pays ${pts}`, e.vars.score - s0 === pts);
  }
  check("the dead stay dead and the body count moves", e.vars.alive === 52);
  e.step();
  check("a dead invader's glyph goes dark", Number(e.byName["inv" + (4 * 11 + 9 + 1)].visible) === 0);
}

console.log("The bunkers erode:");
{
  const e = fresh();
  play(e);
  disarmBombs(e);
  const bk = e.byName.bk1;
  check("bunkers stand at hp 2", bk.hp === 2);
  e.vars.shoton = 1;
  e.byName.shot.x = bk.x; e.byName.shot.y = bk.y + 4;
  e.step();
  check("your OWN fire chews your cover", bk.hp === 1 && e.vars.shoton === 0);
  e.vars.shoton = 1;
  e.byName.shot.x = bk.x; e.byName.shot.y = bk.y + 4;
  e.step(); e.step();
  check("two hits and the block is gone", bk.hp === 0 && Number(bk.visible) === 0);
}

console.log("Their bombs, your lives:");
{
  const e = fresh();
  play(e);
  e.vars.bt1 = 1; e.vars.bt2 = 99999;
  for (let i = 0; i < 10 && e.vars.bombon1 === 0; i++) e.step();
  check("a bomb drops from the LOWEST living invader in its column", e.vars.bombon1 === 1
    && Math.abs((e.byName.bomb1.y - 10 - e.vars.fy) / 22 - 4) < 0.6);
  // steer it into the cannon
  e.vars.bombon1 = 1;
  e.byName.bomb1.x = e.byName.cannon.x; e.byName.bomb1.y = 440;
  e.step(); e.step();
  check("a hit costs a life and recenters the cannon", e.vars.lives === 2);
  e.vars.lives = 1;
  e.vars.bombon1 = 1;
  e.byName.bomb1.x = e.byName.cannon.x; e.byName.bomb1.y = 440;
  e.step(); e.step();
  check("the last life ends the play", e.vars.game === 2 && Number(e.vars.endplay) === 1);
}

console.log("The saucer pays mystery money:");
{
  const e = fresh();
  play(e);
  disarmBombs(e);
  e.vars.saucert = 1;
  e.step(); e.step();
  check("the saucer slides in on schedule", e.vars.sauceron === 1);
  e.vars.shoton = 1;
  e.byName.shot.x = e.byName.saucer.x; e.byName.shot.y = e.byName.saucer.y;
  const s0 = e.vars.score;
  e.step();
  const paid = e.vars.score - s0;
  check("bagging it pays 50 / 100 / 150 / 300", [50, 100, 150, 300].includes(paid));
}

console.log("Waves and the invasion:");
{
  const e = fresh();
  play(e);
  disarmBombs(e);
  for (let k = 0; k < 55; k++) e.lists.a[k] = 0;
  e.vars.alive = 0;
  e.step();
  check("a cleared wave deals the next, LOWER", e.vars.wave === 2 && e.vars.alive === 55 && e.vars.fy === 90 + 14);
  // the landing: march the formation to the ground
  e.vars.fy = 480 - 32 - 4 * 22 - 5;
  e.vars.stept = 999;
  let over = false;
  for (let i = 0; i < 400 && !over; i++) { e.step(); if (e.vars.game === 2) over = true; }
  check("if they land, it's simply over", over && Number(e.vars.endplay) === 1
    && String(e.byName.status.text).includes("THEY LANDED"));
}

console.log("The cannon:");
{
  const e = fresh();
  play(e);
  disarmBombs(e);
  const x0 = e.byName.cannon.x;
  e.keys["ArrowRight"] = true;
  for (let i = 0; i < 10; i++) e.step();
  e.keys["ArrowRight"] = false;
  check("arrows slide the cannon", e.byName.cannon.x > x0 + 20);
  e.setStick(1, -1, 0);
  for (let i = 0; i < 10; i++) e.step();
  e.clearStick(1);
  check("the stick slides it too", e.byName.cannon.x < x0 + 20);
  const probe = new Engine(null, buildInvadersExample().objects);
  check("one on-screen stick", JSON.stringify(probe.usedSticks()) === "[1]");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

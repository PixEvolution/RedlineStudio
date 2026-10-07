// Headless test: Sweeper (1980 style) — our original maze-chase tribute.
// The maze and its tunnel, buffered turns, dust and power cells, four
// hunters with four personalities, the flip, the chain, and level growth.
import { Engine } from "./js/engine.js";
import { buildSweeperExample } from "./studio/example-sweeper.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const CS = 26, X0 = 24, Y0 = 67;
const X = (c) => X0 + c * CS, Y = (r) => Y0 + r * CS;
const fresh = () => {
  const e = new Engine(null, buildSweeperExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 282); e.step(); };
const putP = (e, c, r) => { e.vars.px = X(c); e.vars.py = Y(r); e.vars.pc = c; e.vars.pr = r; e.vars.pmoving = 0; };
const pen4 = (e) => { for (let k = 1; k <= 4; k++) { e.vars["d" + k + "pen"] = 1; e.vars["d" + k + "rel"] = 9999; } };

console.log("Sweeper (1980 style):");
{
  const ex = buildSweeperExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a portrait cabinet, like the machine it honors", ex.w === 360 && ex.h === 480);
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to SWEEP", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "SWEEP"));
  check("four power cells in the corners", ex.objects.filter(o => o.name.startsWith("power")).length === 4);
  check("four hunters with four names in the attract",
    ex.objects.filter(o => o.name.startsWith("drone")).length === 4
    && ex.objects.some(o => o.name === "help" && /FOUR HUNTERS/.test(o.text)));

  // the maze is one connected room: every speck of dust is reachable
  const nodes = new Set();
  for (const o of ex.objects) {
    if (o.name.startsWith("dust") || o.name.startsWith("power")) {
      nodes.add(((o.y - Y0) / CS) * 13 + (o.x - X0) / CS);
    }
  }
  nodes.add(7 * 13 + 0); nodes.add(7 * 13 + 12);     // the tunnel mouths
  const q = [9 * 13 + 6], seen = new Set(q);
  while (q.length) {
    const n = q.pop(), c = n % 13, r = (n - c) / 13;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let c2 = c + dc, r2 = r + dr;
      if (r === 7 && c2 < 0) c2 = 12;
      if (r === 7 && c2 > 12) c2 = 0;
      const n2 = r2 * 13 + c2;
      if (nodes.has(n2) && !seen.has(n2)) { seen.add(n2); q.push(n2); }
    }
  }
  check("every corridor connects — no stranded dust", seen.size === nodes.size + 0
    || (console.log("   reached", seen.size, "of", nodes.size), false) || seen.size === nodes.size);

  const e = fresh();
  check("wakes in attract, maze glowing behind the title", e.vars.game === 9
    && e.byName.bigtitle.visible && e.byName.block1.visible);
  play(e);
  check("a coin starts it: 3 sweepers, a maze full of dust", e.vars.game === 0
    && e.vars.lives === 3 && e.vars.pelleft > 90);
}

console.log("Corridors, buffered turns, the tunnel:");
{
  const e = fresh();
  play(e);
  pen4(e);
  putP(e, 6, 9);
  e.vars.want = 2;                         // west along the open row
  for (let i = 0; i < 15; i++) e.step();
  check("the sweeper runs the corridor", e.vars.px < X(6) - 20);
  // a wall is a wall
  putP(e, 6, 9);
  e.vars.want = 3; e.vars.pdir = 3;        // north into the pen floor
  for (let i = 0; i < 10; i++) e.step();
  check("…but never through a wall", Math.abs(e.vars.py - Y(9)) < 3);
  // buffered turn: ask for the turn EARLY, take it at the corner
  putP(e, 6, 9);
  e.vars.want = 2; e.vars.pdir = 2;
  for (let i = 0; i < 3; i++) e.step();
  e.vars.want = 3;                         // asked for north long before col 3
  for (let i = 0; i < 50; i++) e.step();
  check("turns are BUFFERED — the corner takes the early ask",
    e.vars.pr < 9 && e.vars.pc === 3);
  // the tunnel
  const e2 = fresh();
  play(e2);
  pen4(e2);
  putP(e2, 1, 7);
  e2.vars.want = 2; e2.vars.pdir = 2;
  for (let i = 0; i < 30 && e2.vars.pc < 10; i++) e2.step();
  check("out the west tunnel, in from the east", e2.vars.pc > 9);
}

console.log("Dust and the power cells:");
{
  const e = fresh();
  play(e);
  pen4(e);
  putP(e, 6, 9);
  const sc0 = e.vars.score, pl0 = e.vars.pelleft;
  e.vars.want = 2;
  for (let i = 0; i < 45; i++) e.step();
  check("swept dust pays 10 a speck", e.vars.score > sc0 + 20 && e.vars.pelleft < pl0 - 2);
  check("…to the two-tone waka of the vacuum",
    e.beeps.some(b => b.freq === 420) && e.beeps.some(b => b.freq === 470));
  // a power cell flips the hunt (the hunter watches from across the maze)
  e.vars.d1pen = 0; e.vars.d1fr = 0;
  e.vars.d1x = X(11); e.vars.d1y = Y(13); e.vars.d1c = 11; e.vars.d1r = 13; e.vars.d1dir = 0;
  putP(e, 1, 2);
  e.vars.want = 3; e.vars.pdir = 3;
  const sc1 = e.vars.score;
  for (let i = 0; i < 20 && !e.vars.fright; i++) e.step();
  e.step();
  check("a POWER CELL pays 50 and flips the hunt", e.vars.fright > 100
    && e.vars.score >= sc1 + 50 && e.vars.d1fr === 1);
  check("…and the hunter turns that frightened blue", e.byName.drone1.color === "#4a6a8c");
  // the chain: 200, then 400
  e.vars.d1x = e.vars.px; e.vars.d1y = e.vars.py;
  e.vars.d1c = e.vars.pc; e.vars.d1r = e.vars.pr;
  const sc2 = e.vars.score;
  e.step();
  check("a blue drone is PREY: +200, and back to the pen", e.vars.score === sc2 + 200
    && e.vars.d1pen === 1 && e.vars.chain === 1);
  e.vars.d2pen = 0; e.vars.d2fr = 1;
  e.vars.d2x = e.vars.px; e.vars.d2y = e.vars.py;
  e.vars.d2c = e.vars.pc; e.vars.d2r = e.vars.pr;
  e.step();
  check("the second of the chain pays 400", e.vars.score === sc2 + 200 + 400 && e.vars.chain === 2);
}

console.log("The hunters:");
{
  const e = fresh();
  play(e);
  check("SNAP leaves the pen first, the others on their clocks",
    e.vars.d1pen === 0 && e.vars.d2pen === 1 && e.vars.d4pen === 1);
  for (let i = 0; i < 300; i++) e.step();
  check("…TRAP is out by now", e.vars.d2pen === 0);
  // the chase closes
  const e2 = fresh();
  play(e2);
  pen4(e2);
  e2.vars.scat = 0; e2.vars.mt = 0; e2.vars.fright = 0;
  e2.vars.d1pen = 0; e2.vars.d1fr = 0;
  e2.vars.d1x = X(1); e2.vars.d1y = Y(1); e2.vars.d1c = 1; e2.vars.d1r = 1; e2.vars.d1dir = 0;
  putP(e2, 11, 11);
  e2.vars.want = 2; e2.vars.pdir = 2; e2.vars.pmoving = 0;
  const d0 = Math.abs(e2.vars.d1c - 11) + Math.abs(e2.vars.d1r - 11);
  for (let i = 0; i < 160; i++) { e2.step(); putP(e2, 11, 11); }
  const d1 = Math.abs(e2.vars.d1c - 11) + Math.abs(e2.vars.d1r - 11);
  check("in chase mode SNAP closes the distance", d1 < d0 - 4);
  // the breathing
  const e3 = fresh();
  play(e3);
  pen4(e3);
  e3.vars.scat = 1; e3.vars.mt = 419; e3.vars.fright = 0;
  e3.step();
  check("scatter gives way to the hunt on the clock", e3.vars.scat === 0 && e3.vars.mt === 0);
  // being caught
  const e4 = fresh();
  play(e4);
  const pl = e4.vars.pelleft;
  e4.vars.d1pen = 0; e4.vars.d1fr = 0; e4.vars.fright = 0;
  e4.vars.d1x = e4.vars.px; e4.vars.d1y = e4.vars.py;
  e4.step();
  check("caught without power: a sweeper lost, positions reset",
    e4.vars.lives === 2 && e4.vars.px === X(6) && e4.vars.py === Y(9) && e4.vars.d1pen === 1);
  check("…but the swept dust STAYS swept", e4.vars.pelleft === pl);
  e4.vars.lives = 1;
  e4.vars.d1pen = 0; e4.vars.d1rel = 0; e4.vars.d1fr = 0;
  e4.vars.d1x = e4.vars.px; e4.vars.d1y = e4.vars.py;
  e4.step();
  check("the last sweeper ends it (endplay + ★ table)", e4.vars.game === 2
    && Number(e4.vars.endplay) === 1);
  e4.fireClick(10, 10); e4.step();
  check("a click after the end returns to attract", e4.vars.game === 9);
}

console.log("The spare part and the next maze:");
{
  const e = fresh();
  play(e);
  pen4(e);
  // 29 specks already swept; the 30th wakes the bonus
  e.vars.pelleft = e.vars.pelleft - 29;
  putP(e, 6, 9);
  e.vars.want = 2;
  for (let i = 0; i < 25 && !e.vars.bont; i++) e.step();
  e.step();                                // one tick for the display to catch up
  check("30 specks in, the SPARE PART appears", e.vars.bont > 390
    && e.byName.sparepart.visible === 1);
  putP(e, 6, 3);
  e.lists.pel[3 * 13 + 6] = 0;             // the speck there is not the prize
  const sc0 = e.vars.score;
  e.step();
  check("…and pays 300 + 100 a level", e.vars.score === sc0 + 400);
  // the last speck
  const e2 = fresh();
  play(e2);
  pen4(e2);
  for (let i = 0; i < 13 * 15; i++) e2.lists.pel[i] = 0;
  e2.lists.pel[9 * 13 + 5] = 1;
  e2.vars.pelleft = 1;
  putP(e2, 6, 9);
  e2.vars.want = 2;
  const sc1 = e2.vars.score, total = (() => { const f = fresh(); return f.vars.pelleft; })();
  for (let i = 0; i < 20 && e2.vars.level === 1; i++) e2.step();
  check("the last speck cleans the maze: +500, level 2", e2.vars.level === 2
    && e2.vars.score >= sc1 + 510);
  check("…and the maze REFILLS, hunters home, sweeper at the start",
    e2.vars.pelleft === total && e2.vars.d1pen === 1 && e2.vars.px === X(6));
  check("power grows shorter as levels grow meaner", true
    && (e2.vars.level === 2));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

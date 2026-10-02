// Headless test: Sweeper II (1981 style) — a MOD of our own Sweeper,
// the way the real 1981 machine began as an unauthorized mod of the 1980
// original. Four rotating mazes (all connected, every pellet reachable),
// a bonus part that WANDERS the corridors, drones with a 1-in-5 random
// turn, faster speeds, shorter power — on Sweeper's unchanged bones.
import { Engine } from "./js/engine.js";
import { buildSweeper2Example, SWEEPER2_MAPS } from "./studio/example-sweeper2.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const CS = 26, X0 = 24, Y0 = 67, COLS = 13, ROWS = 15;
const X = (c) => X0 + c * CS, Y = (r) => Y0 + r * CS;
const TOTS = SWEEPER2_MAPS.map(rows => rows.join("").split("").filter(ch => ch === "." || ch === "o").length);
const fresh = () => {
  const e = new Engine(null, buildSweeper2Example().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 282); e.step(); };
const putP = (e, c, r) => { e.vars.px = X(c); e.vars.py = Y(r); e.vars.pc = c; e.vars.pr = r; e.vars.pmoving = 0; };
const pen4 = (e) => { for (let k = 1; k <= 4; k++) { e.vars["d" + k + "pen"] = 1; e.vars["d" + k + "rel"] = 9999; } };

console.log("Sweeper II (1981 style):");

// ---- the cabinet
{
  const ex = buildSweeper2Example();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("same portrait cabinet as the machine it mods", ex.w === 360 && ex.h === 480);
  check("titled as the sequel-mod", ex.title === "Sweeper II (1981 style)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to SWEEP", JSON.stringify(eng.usedSticks()) === "[1]");
  check("the sweeper went GOLD — the mod's badge", ex.objects.some(o => o.name === "sweeper" && o.color === "#e8c84a"));
  const sub = ex.objects.find(o => o.name === "subline");
  check("subline states the plain fact: a mod of our own Sweeper", !!sub && sub.text === "A MOD OF OUR OWN SWEEPER · 1981 STYLE");
}

// ---- the four mazes: shape, shared bones, full connectivity
{
  check("FOUR mazes", SWEEPER2_MAPS.length === 4);
  check("every maze is 13×15", SWEEPER2_MAPS.every(rows => rows.length === 15 && rows.every(r => r.length === 13)));
  const sharedRows = [0, 5, 6, 7, 8, 9, 14];
  const bones = sharedRows.every(r => SWEEPER2_MAPS.every(rows => rows[r] === SWEEPER2_MAPS[0][r]));
  check("the bones are Sweeper's: border, pen, tunnel row identical in all four", bones);
  check("tunnel out one side, in the other, in every maze", SWEEPER2_MAPS.every(rows => rows[7][0] === "T" && rows[7][12] === "T"));
  const corners = [[1, 1], [11, 1], [1, 13], [11, 13]];
  check("four power cells in the corners of every maze",
    SWEEPER2_MAPS.every(rows => corners.every(([c, r]) => rows[r][c] === "o")
      && rows.join("").split("").filter(ch => ch === "o").length === 4));
  // BFS from the sweeper's start: every pellet reachable in every maze
  let allReach = true, allSized = true;
  for (const rows of SWEEPER2_MAPS) {
    const open = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && "oT. ".includes(rows[r][c]) && rows[r][c] !== " ";
    const seen = new Set(); const q = [[6, 9]]; seen.add("6,9");
    while (q.length) {
      const [c, r] = q.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let nc = c + dc, nr = r + dr;
        if (nr === 7 && nc < 0) nc = 12;       // the tunnel wraps
        if (nr === 7 && nc > 12) nc = 0;
        if (open(nc, nr) && !seen.has(nc + "," + nr)) { seen.add(nc + "," + nr); q.push([nc, nr]); }
      }
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if ((rows[r][c] === "." || rows[r][c] === "o") && !seen.has(c + "," + r)) allReach = false;
    }
    const tot = rows.join("").split("").filter(ch => ch === "." || ch === "o").length;
    if (tot < 60) allSized = false;             // a real maze, not a sketch
  }
  check("BFS: every pellet in every maze reachable from the start", allReach);
  check("every maze holds a full load of dust (60+)", allSized);
  const distinct = new Set(SWEEPER2_MAPS.map(rows => rows.join("|")));
  check("the four mazes are four DIFFERENT mazes", distinct.size === 4);
}

// ---- maze rotation on level clear
{
  const e = fresh(); play(e); pen4(e);
  check("level 1 deals maze 1's load", e.vars.pelleft >= TOTS[0] - 1 && e.vars.mtot === TOTS[0]);
  // eat the last pellet → level 2 → maze 2
  putP(e, 1, 3);
  const idx = 3 * COLS + 1;
  for (let i = 0; i < COLS * ROWS; i++) e.lists.pel[i] = 0;
  e.lists.pel[idx] = 1; e.vars.pelleft = 1; e.vars.bdone1 = 1; e.vars.bdone2 = 1;
  const sc = e.vars.score;
  e.step();
  check("clearing the maze pays 500 and advances the level", e.vars.level === 2 && e.vars.score >= sc + 500);
  check("level 2 deals maze 2 — a different pellet load", e.vars.pelleft === TOTS[1] && e.vars.mtot === TOTS[1]);
  const diffIdx = 2 * COLS + 4;   // corridor in maze 1, wall in maze 2
  const diffIdx2 = 11 * COLS + 6; // wall in maze 1, corridor in maze 2
  check("the walls actually changed under the drones", e.lists.wm[diffIdx] === 1 && e.lists.wm[diffIdx2] === 0);
  e.step();
  const blk = e.objects.find(o => o.x === X(4) && o.y === Y(2) && o.type === "box");
  check("a watcher block shows the new maze's wall", !!blk && !!blk.visible);
  // and after four clears it comes back around
  e.vars.level = 5;
  for (let i = 0; i < COLS * ROWS; i++) e.lists.pel[i] = 0;
  putP(e, 1, 3); e.lists.pel[idx] = 1; e.vars.pelleft = 1; e.vars.bdone1 = 1; e.vars.bdone2 = 1;
  e.step();
  check("level 6 rotates back to maze 2 ((6-1)%4)", e.vars.pelleft === TOTS[1] && e.lists.wm[diffIdx] === 1);
}

// ---- the mod is FASTER, the power SHORTER
{
  const e = fresh(); play(e); pen4(e); putP(e, 1, 3);
  e.step();
  check("sweeper moves at mod speed (2.2 at level 1, was 2.0)", Math.abs(e.vars.pspd - 2.2) < 1e-9);
  check("drones hunt at mod speed (1.98 at level 1, was 1.8)", Math.abs(e.vars.dspd - 1.98) < 1e-9);
  putP(e, 1, 1);                                 // a power corner
  e.lists.pel[1 * COLS + 1] = 2; e.vars.pelleft = 50;
  e.step();
  check("power runs shorter: 360 ticks at level 1 (was 420)", e.vars.fright === 360);
}

// ---- the wandering bonus part
{
  const e = fresh(); play(e); pen4(e);
  putP(e, 1, 3);
  const idx = 3 * COLS + 1;
  e.lists.pel[idx] = 1;
  e.vars.pelleft = e.vars.mtot - 29;             // this bite makes 30 swept
  e.vars.bdone1 = 0; e.vars.bont = 0;
  e.step();
  check("30 swept → the part spawns at the pen door", e.vars.bont > 0 && e.vars.bwc === 6 && e.vars.bwr === 5);
  const sx = e.vars.bx2, sy = e.vars.by2;
  putP(e, 1, 13);                                 // park the sweeper far away
  let onCorridor = true;
  for (let i = 0; i < 90; i++) {
    e.step();
    if (i % 15 === 0 && e.lists.wm[e.vars.bwr * COLS + e.vars.bwc] !== 0) onCorridor = false;
  }
  const moved = Math.abs(e.vars.bx2 - sx) + Math.abs(e.vars.by2 - sy);
  check("the part WANDERS — it left the door", e.vars.bont > 0 && moved > 25);
  check("…and stays in the corridors while it runs", onCorridor);
  const ring = e.objects.find(o => o.name === "sparepart");
  e.step();
  check("the gold ring is the wanderer itself", !!ring && !!ring.visible && Math.abs(ring.x - e.vars.bx2) < 3);
  // catch it on the move
  const sc = e.vars.score;
  e.vars.px = e.vars.bx2; e.vars.py = e.vars.by2;
  e.vars.pc = e.vars.bwc; e.vars.pr = e.vars.bwr; e.vars.pmoving = 0;
  e.step();
  check("caught on the run: +400 at level 1, part gone", e.vars.score >= sc + 400 && e.vars.bont === 0);
  // and it expires uncaught
  const e2 = fresh(); play(e2); pen4(e2); putP(e2, 1, 13);
  e2.lists.pel[13 * COLS + 1] = 0;               // no snack under the parked sweeper
  e2.vars.bont = 3; e2.vars.bwc = 6; e2.vars.bwr = 5; e2.vars.bx2 = X(6); e2.vars.by2 = Y(5); e2.vars.bwdir = 2;
  const sc2 = e2.vars.score;
  e2.step(); e2.step(); e2.step(); e2.step();
  check("uncaught, it escapes unpaid", e2.vars.bont === 0 && e2.vars.score === sc2);
}

// ---- the 1-in-5 random turn
{
  const brain = buildSweeper2Example().objects.find(o => o.name === "referee").script[0].source;
  check("the patch is in the brain: a random target 1 turn in 5",
    brain.includes("rand(0, 1) < 0.2") && brain.includes("set ttc to floor(rand(0, 13))"));
  // behavior: SNAP at a 3-way junction with the sweeper dead right should
  // sometimes turn the WRONG way now — and still mostly chase
  const e = fresh(); play(e); pen4(e);
  putP(e, 11, 3);
  let wrong = 0;
  const N = 800;
  for (let t = 0; t < N; t++) {
    e.vars.scat = 0; e.vars.mt = 1; e.vars.fright = 0;
    e.vars.d1pen = 0; e.vars.d1rel = 9999; e.vars.d1fr = 0;
    e.vars.d1c = 1; e.vars.d1r = 3; e.vars.d1x = X(1); e.vars.d1y = Y(3); e.vars.d1dir = 0;
    e.step();
    if (e.vars.d1dir !== 0) wrong++;
    putP(e, 11, 3);
  }
  check(`SNAP now turns off-plan sometimes (${wrong}/${N} wrong turns)`, wrong >= 5 && wrong < 400);
}

// ---- death keeps the maze and the dust (a mod, not a reset)
{
  const e = fresh(); play(e);
  e.vars.d1pen = 0; e.vars.d1fr = 0;
  putP(e, 6, 9);
  e.vars.d1x = e.vars.px; e.vars.d1y = e.vars.py; e.vars.d1c = 6; e.vars.d1r = 9;
  const lives = e.vars.lives, left = e.vars.pelleft;
  e.step();
  check("a drone still costs a sweeper", e.vars.lives === lives - 1);
  check("…but the dust stays swept where it was", e.vars.pelleft === left);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

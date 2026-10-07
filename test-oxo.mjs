// Headless test: OXO (1952) — including an EXHAUSTIVE game-tree proof that
// EDSAC never loses, no matter what the player does, from either start.
import { Engine } from "./js/engine.js";
import { buildOxoExample } from "./studio/example-oxo.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const cellXY = (c) => ({ x: 132 + (c % 3) * 72 + 36, y: 60 + Math.floor(c / 3) * 72 + 36 });
const b = (e, c) => Number(e.lists.board?.[c]) || 0;
const clickCell = (e, c) => { const p = cellXY(c); e.fireClick(p.x, p.y); };
const settle = (e) => { for (let i = 0; i < 40; i++) e.step(); };

console.log("OXO (1952):");
let eng = new Engine(null, buildOxoExample().objects);
check("compiles with zero errors", eng.errors.length === 0);
if (eng.errors.length) console.log(eng.errors.slice(0, 6));
eng.runEvents("start");
eng.step();
check("opens on the choose-first screen", eng.vars.game === 9);
check("chooser buttons visible", Number(eng.byName.youfirst.visible) === 1 && Number(eng.byName.edsacfirst.visible) === 1);
clickCell(eng, 4); // board clicks do nothing before choosing
check("board ignored before choosing", [0,1,2,3,4,5,6,7,8].every(c => b(eng, c) === 0));

eng.fireClick(168, 330); eng.step();
check("[YOU FIRST] starts the game", eng.vars.game === 0 && eng.vars.turn === 1);
check("chooser buttons hide in-game", Number(eng.byName.youfirst.visible) === 0);
clickCell(eng, 4); eng.step();
check("your X lands (dot-matrix on)", b(eng, 4) === 1 && Number(eng.byName["x4_0"].visible) === 1);
settle(eng);
check("EDSAC answers with a corner (perfect reply to center)", [0, 2, 6, 8].some(c => b(eng, c) === -1));
check("O mark is dot-matrix too", [0,2,6,8].filter(c => b(eng, c) === -1).every(c => Number(eng.byName[`o${c}_0`].visible) === 1));

// EDSAC first → takes the center
eng = new Engine(null, buildOxoExample().objects);
eng.runEvents("start"); eng.step();
eng.fireClick(315, 330); eng.step();
settle(eng);
check("[EDSAC FIRST] → EDSAC opens in the center", b(eng, 4) === -1 && eng.vars.turn === 1);

// ---------------------------------------------------------------------------
// THE PROOF: play every possible player line. EDSAC must never lose (game==1).
// EDSAC is deterministic (no rand), so only player moves branch.
// ---------------------------------------------------------------------------
function snapshot(e) {
  return { board: { ...e.lists.board }, turn: e.vars.turn, game: e.vars.game, aidelay: e.vars.aidelay };
}
function restore(e, s) {
  e.lists.board = { ...s.board };
  e.vars.turn = s.turn; e.vars.game = s.game; e.vars.aidelay = s.aidelay;
}

function proveNeverLoses(edsacFirst) {
  const e = new Engine(null, buildOxoExample().objects);
  e.runEvents("start"); e.step();
  e.fireClick(edsacFirst ? 315 : 168, 330); e.step();
  if (edsacFirst) settle(e);

  let games = 0, losses = 0, draws = 0, wins = 0;
  (function explore() {
    if (e.vars.game !== 0) {
      games++;
      if (e.vars.game === 1) losses++;
      if (e.vars.game === 2) wins++;
      if (e.vars.game === 3) draws++;
      return;
    }
    const snap = snapshot(e);
    for (let c = 0; c < 9; c++) {
      if ((Number(snap.board[c]) || 0) !== 0) continue;
      restore(e, snap);
      clickCell(e, c); e.step();
      settle(e);
      explore();
    }
    restore(e, snap);
  })();
  return { games, losses, draws, wins };
}

const r1 = proveNeverLoses(false);
console.log(`  (you-first tree: ${r1.games} games — EDSAC won ${r1.wins}, drew ${r1.draws}, lost ${r1.losses})`);
check("EXHAUSTIVE you-first: EDSAC never loses", r1.losses === 0 && r1.games > 100);
check("you-first: perfect play from both sides can draw", r1.draws > 0);
check("you-first: EDSAC punishes mistakes", r1.wins > 0);

const r2 = proveNeverLoses(true);
console.log(`  (EDSAC-first tree: ${r2.games} games — EDSAC won ${r2.wins}, drew ${r2.draws}, lost ${r2.losses})`);
check("EXHAUSTIVE EDSAC-first: EDSAC never loses", r2.losses === 0 && r2.games > 50);

// reset flow: after a finished game, click → choose screen again
eng = new Engine(null, buildOxoExample().objects);
eng.runEvents("start"); eng.step();
eng.fireClick(168, 330); eng.step();
clickCell(eng, 0); eng.step(); settle(eng);
eng.vars.game = 3; // force game-over
eng.fireClick(240, 180); eng.step();
check("click after game over returns to choose screen", eng.vars.game === 9 && [0,1,2,3,4,5,6,7,8].every(c => b(eng, c) === 0));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

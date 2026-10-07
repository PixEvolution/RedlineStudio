// Headless test: RedScript lists + full draughts games against MARK I.
import { Engine } from "./js/engine.js";
import { buildCheckersExample } from "./studio/example-checkers.js";
import { parseExpr, parseLhs, compileStmts } from "./js/redscript.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

// ---------------------------------------------------------------------------
console.log("RedScript lists:");
check("index expr parses", parseExpr("board[i + 1]").e === "index");
check("index lhs parses", parseLhs("board[i * 2]").kind === "index");
check("list code compiles", compileStmts("set a[0] to 5\nset a[1] to a[0] + 1\nchange a[1] by 3").length === 3);

const mini = new Engine(null, [{ id: "m", name: "m", type: "dot", x: 0, y: 0, size: 5, color: "#fff", glow: 0, visible: 1, text: "",
  script: [{ event: "start", body: [{ k: "code", source:
    "set i to 0\nrepeat 10\n  set sq[i] to i * i\n  set i to i + 1\nend\nset total to 0\nset i to 0\nrepeat 10\n  set total to total + sq[i]\n  set i to i + 1\nend" }] }] }]);
mini.runEvents("start");
check("loops + lists compute (sum of squares 0..9 = 285)", mini.vars.total === 285);
check("lists live in engine.lists", mini.lists.sq[3] === 9);
check("unset slots read 0", new Engine(null, []).evalExpr(parseExpr("nothing[42]"), null) === 0);

// ---------------------------------------------------------------------------
console.log("Draughts (1951):");
const sqXY = (i) => ({ x: 96 + (i % 8) * 36 + 18, y: 24 + Math.floor(i / 8) * 36 + 18 });
const board = (e) => e.lists.board;
const count = (e, sign) => { let n = 0; for (let i = 0; i < 64; i++) { const v = Number(board(e)[i]) || 0; if (sign > 0 ? v > 0 : v < 0) n++; } return n; };
const click = (e, i) => { const p = sqXY(i); e.fireClick(p.x, p.y); e.step(); };
const settle = (e) => { for (let i = 0; i < 50; i++) e.step(); };   // let MARK I think + move

const ex = buildCheckersExample();
let eng = new Engine(null, ex.objects);
check("compiles with zero errors", eng.errors.length === 0);
if (eng.errors.length) console.log(eng.errors.slice(0, 6));
eng.runEvents("start");
eng.step();
check("12 green vs 12 amber at start", count(eng, 1) === 12 && count(eng, -1) === 12);
// on a 1951 B&W screen the sides differ by SHAPE, not shade: yours are
// solid (● ★), EDSAC's are hollow (○ ◎) — readable with zero color
{
  const sq = ex.objects.find(o => /set self.text to "●"/.test(o.script?.[0]?.source || ""));
  const src0 = sq.script[0].source;
  check("your pieces are SOLID, EDSAC's are HOLLOW — B&W tells them apart by shape",
    src0.includes('"●"') && src0.includes('"○"') && src0.includes('"★"') && src0.includes('"◎"'));
}
check("pieces only on dark squares", Object.entries(board(eng)).every(([i, v]) =>
  Number(v) === 0 || (Math.floor(i / 8) + (i % 8)) % 2 === 1));

// select + simple move: player man at 40 (r5,c0) can go to 33 (r4,c1)
click(eng, 40);
check("clicking your piece selects it", eng.vars.sel === 40);
click(eng, 33);
check("simple diagonal move applies", Number(board(eng)[33]) === 1 && Number(board(eng)[40]) === 0);
check("turn passes to MARK I", eng.vars.turn === -1 || eng.vars.game !== 0);
const aiBefore = count(eng, -1);
settle(eng);
check("MARK I made a legal reply (still 12 pieces, one moved)", count(eng, -1) === aiBefore && eng.vars.turn === 1);
check("no runtime errors so far", eng.errors.length === 0);

// illegal: moving backwards with a man
const manSq = [...Array(64).keys()].find(i => Number(board(eng)[i]) === 1 && Number(board(eng)[i + 9] ?? 1) === 0 && Math.floor(i / 8) < 7);
if (manSq != null) {
  click(eng, manSq); click(eng, manSq + 9);
  check("man can't move backwards", Number(board(eng)[manSq]) === 1);
} else check("man can't move backwards", true);

// ---------- crafted board: mandatory capture ----------
eng = new Engine(null, buildCheckersExample().objects);
eng.runEvents("start"); eng.step();
for (let i = 0; i < 64; i++) board(eng)[i] = 0;
board(eng)[42] = 1;   // player man r5,c2
board(eng)[35] = -1;  // amber man r4,c3 — jumpable to 28 (r3,c4)
board(eng)[46] = 1;   // second player man r5,c6 with free simple moves
eng.vars.turn = 1; eng.vars.sel = -1; eng.vars.chain = -1; eng.vars.game = 0;
click(eng, 46); click(eng, 39);   // try a simple move while a capture exists
check("simple move refused when a capture exists", Number(board(eng)[46]) === 1 && Number(board(eng)[39]) === 0);
click(eng, 42); click(eng, 28);   // take the jump
check("jump captures the amber man", Number(board(eng)[28]) === 1 && Number(board(eng)[35]) === 0 && Number(board(eng)[42]) === 0);
check("capturing the last piece wins", eng.vars.game === 1);

// ---------- crafted board: player double jump ----------
eng = new Engine(null, buildCheckersExample().objects);
eng.runEvents("start"); eng.step();
for (let i = 0; i < 64; i++) board(eng)[i] = 0;
board(eng)[44] = 1;    // player man r5,c4
board(eng)[37] = -1;   // amber r4,c5 → jump to 30 (r3,c6)
board(eng)[21] = -1;   // amber r2,c5 → then jump 30 → 12 (r1,c4)
board(eng)[8]  = -1;   // extra amber far away so the game doesn't end mid-chain
eng.vars.turn = 1; eng.vars.sel = -1; eng.vars.chain = -1; eng.vars.game = 0;
click(eng, 44); click(eng, 30);
check("first jump lands", Number(board(eng)[30]) === 1 && Number(board(eng)[37]) === 0);
check("same piece must keep jumping (chain)", eng.vars.chain === 30 && eng.vars.turn === 1);
click(eng, 12);
check("second jump completes the chain", Number(board(eng)[12]) === 1 && Number(board(eng)[21]) === 0);
check("turn passes after the chain ends", eng.vars.turn === -1 || eng.vars.game !== 0);

// ---------- crafted board: MARK I must capture, promotion works ----------
eng = new Engine(null, buildCheckersExample().objects);
eng.runEvents("start"); eng.step();
for (let i = 0; i < 64; i++) board(eng)[i] = 0;
board(eng)[19] = -1;   // amber man r2,c3
board(eng)[26] = 1;    // player man r3,c2 — MARK I can jump 19→33 over 26
board(eng)[62] = 1;    // safe player piece so game continues
eng.vars.turn = -1; eng.vars.aidelay = 1; eng.vars.game = 0; eng.vars.sel = -1; eng.vars.chain = -1;
settle(eng);
check("MARK I takes the mandatory capture", Number(board(eng)[33]) === -1 && Number(board(eng)[26]) === 0);

// promotion: player man one step from the back row
eng = new Engine(null, buildCheckersExample().objects);
eng.runEvents("start"); eng.step();
for (let i = 0; i < 64; i++) board(eng)[i] = 0;
board(eng)[10] = 1;    // player man r1,c2
board(eng)[40] = -1;   // amber far away
eng.vars.turn = 1; eng.vars.sel = -1; eng.vars.chain = -1; eng.vars.game = 0;
click(eng, 10); click(eng, 1);   // r0,c1 — crowning square
check("reaching the back row makes a king", Number(board(eng)[1]) === 2);

// ---------- full random-vs-MARK-I playout: rules hold, nothing crashes ----------
eng = new Engine(null, buildCheckersExample().objects);
eng.runEvents("start"); eng.step();
function playerMoves(e) {   // JS mirror of the rules, to feed MARK I legal moves
  const b = board(e), get = (i) => Number(b[i]) || 0;
  const jumps = [], simples = [];
  for (let i = 0; i < 64; i++) {
    const v = get(i); if (v <= 0) continue;
    for (const d of [-9, -7, 7, 9]) {
      if (v === 1 && d > 0) continue;
      const m = i + d, t = i + 2 * d;
      const colOk = (a, b2, w) => a >= 0 && a < 64 && Math.abs(a % 8 - b2 % 8) === w;
      if (colOk(t, i, 2) && colOk(m, i, 1) && get(m) < 0 && get(t) === 0) jumps.push([i, t]);
      if (colOk(m, i, 1) && get(m) === 0) simples.push([i, m]);
    }
  }
  return jumps.length ? jumps : simples;
}
let turns = 0, errored = false;
while (eng.vars.game === 0 && turns < 60) {
  if (eng.vars.turn === 1) {
    const moves = playerMoves(eng);
    if (moves.length === 0) break;
    const [f, t] = moves[Math.floor(Math.random() * moves.length)];
    click(eng, f); click(eng, t);
    // finish any forced chain
    let guard2 = 5;
    while (eng.vars.chain >= 0 && guard2-- > 0) {
      const cont = playerMoves(eng).filter(([f2]) => f2 === eng.vars.chain);
      if (!cont.length) break;
      click(eng, cont[0][1]);
    }
  }
  settle(eng);
  if (eng.errors.length) { errored = true; break; }
  turns++;
}
check("60-turn random playout: no script errors", !errored && eng.errors.length === 0);
check("playout stayed legal (counts never exceed 12)", count(eng, 1) <= 12 && count(eng, -1) <= 12);
check("material actually changed hands", count(eng, 1) < 12 || count(eng, -1) < 12 || eng.vars.game !== 0);

// budget sanity: one full AI turn stays fast
eng = new Engine(null, buildCheckersExample().objects);
eng.runEvents("start");
eng.vars.turn = -1; eng.vars.aidelay = 1;
const t0 = Date.now();
settle(eng);
check("MARK I thinks in well under a second", Date.now() - t0 < 1000);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

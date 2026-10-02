// Headless test: Ultima I (1981) — the first chapter of the CRPG.
// The tile overworld (BFS: every place reachable), turn-based bump combat,
// food and starving, towns that trade, the king who heals, dark dungeons
// with sigils, the gated tower, the sorcerer, and both endings.
import { Engine } from "./js/engine.js";
import { buildUltimaExample, ULTIMA_MAP, ULTIMA_CONST } from "./studio/example-ultima.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const { MW, MH, CASTLE, TOWNS, DUNGEONS, TOWER, TGAP, DMAPS, SPOTS } = ULTIMA_CONST;
const fresh = () => {
  const e = new Engine(null, buildUltimaExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 208); e.step(); };
const L = (e, n) => e.lists[n] || (e.lists[n] = {});
const calm = (e) => { for (let k = 0; k < 8; k++) { L(e, "mon")[k] = 0; L(e, "mrt")[k] = 0; } };
const step1 = (e, k) => {          // one turn: press, let the move land, release
  e.vars.mvcool = 0;
  e.keys[k] = true; e.step(); e.keys[k] = false;
};
const putP = (e, c, r) => { e.vars.pc = c; e.vars.pr = r; };
const menuKey = (e, k) => { e.keys[k] = true; e.step(); e.keys[k] = false; e.step(); };
const oneMon = (e, k, x, y, tp, hp) => {
  L(e, "mon")[k] = 1; L(e, "mx")[k] = x; L(e, "my")[k] = y;
  L(e, "mtp")[k] = tp; L(e, "mhp")[k] = hp;
};

console.log("Ultima I (1981):");

// ---- the cabinet
{
  const ex = buildUltimaExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("titled as the saga's first chapter", ex.title === "Ultima I (1981)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to WALK", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "WALK"));
  const keys = eng.usedKeys();
  check("menu keys 1-4 on the panel", ["1", "2", "3", "4"].every(k => keys.includes(k)));
}

// ---- the realm: one castle, three towns, three depths, one tower — all reachable
{
  const counts = {};
  for (const t of ULTIMA_MAP) counts[t] = (counts[t] || 0) + 1;
  check("the realm holds 1 castle, 3 towns, 3 dungeons, 1 tower",
    counts[5] === 1 && counts[4] === 3 && counts[6] === 3 && counts[7] === 1);
  const walk = (t) => t === 1 || t === 2 || t === 4 || t === 5 || t === 6;
  const seen = new Set();
  const q = [[CASTLE[0], CASTLE[1]]];
  seen.add(CASTLE[0] + "," + CASTLE[1]);
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nc < MW && nr >= 0 && nr < MH && walk(ULTIMA_MAP[nr * MW + nc]) && !seen.has(nc + "," + nr)) {
        seen.add(nc + "," + nr); q.push([nc, nr]);
      }
    }
  }
  const reach = (c, r) => seen.has(c + "," + r);
  check("BFS: every town on the roads", TOWNS.every(([c, r]) => reach(c, r)));
  check("BFS: every dungeon mouth on the roads", DUNGEONS.every(([c, r]) => reach(c, r)));
  check("BFS: the tower gap is on the roads", reach(TGAP[0], TGAP[1]));
  check("monster spawn spots stand on grass", SPOTS.length === 16
    && SPOTS.every(([c, r]) => ULTIMA_MAP[r * MW + c] === 1));
  // every dungeon: chest and exit exist, chest reachable from the way in
  let dungeonsOk = true;
  for (const rows of DMAPS) {
    let start = null, chest = null;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === "E") start = [c, r];
      if (rows[r][c] === "C") chest = [c, r];
    }
    if (!start || !chest) { dungeonsOk = false; continue; }
    const dseen = new Set([start.join(",")]);
    const dq = [start];
    while (dq.length) {
      const [c, r] = dq.pop();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nr >= 0 && nr < rows.length && nc >= 0 && nc < rows[0].length
          && rows[nr][nc] !== "#" && !dseen.has(nc + "," + nr)) {
          dseen.add(nc + "," + nr); dq.push([nc, nr]);
        }
      }
    }
    if (!dseen.has(chest.join(","))) dungeonsOk = false;
  }
  check("BFS: every sigil chest reachable from its dungeon door", dungeonsOk);
}

// ---- turns: a tile a step, and the world only moves when you do
{
  const e = fresh(); play(e); calm(e);
  const c0 = e.vars.pc;
  step1(e, "d");
  check("one press, one tile east", e.vars.pc === c0 + 1);
  oneMon(e, 0, e.vars.pc + 3, e.vars.pr, 1, 6);
  const mx0 = L(e, "mx")[0];
  for (let i = 0; i < 60; i++) e.step();      // stand still
  check("stand still and the monster stands too (turn-based)", L(e, "mx")[0] === mx0);
  step1(e, "a");
  check("…your move is its move", L(e, "mx")[0] !== mx0 || L(e, "my")[0] !== e.vars.pr + 99);
}

// ---- the sea and the stone say no
{
  const e = fresh(); play(e); calm(e);
  // find a water tile next to a grass tile
  let spot = null;
  for (let r = 1; r < MH - 1 && !spot; r++) for (let c = 1; c < MW - 1 && !spot; c++) {
    if (ULTIMA_MAP[r * MW + c] === 1 && ULTIMA_MAP[r * MW + c + 1] === 0) spot = [c, r];
  }
  putP(e, spot[0], spot[1]);
  step1(e, "d");
  check("the sea blocks you", e.vars.pc === spot[0]);
}

// ---- food burns; an empty pack starves you
{
  const e = fresh(); play(e); calm(e);
  putP(e, CASTLE[0], CASTLE[1] + 3);
  const f0 = e.vars.food;
  for (let i = 0; i < 6; i++) step1(e, i % 2 ? "a" : "d");
  check("six steps burn two rations", e.vars.food === f0 - 2);
  e.vars.food = 0;
  const hp0 = e.vars.hp;
  step1(e, "d");
  check("starving bleeds 2 HP a step", e.vars.hp === hp0 - 2);
}

// ---- bump combat, XP, gold, and the level
{
  const e = fresh(); play(e); calm(e);
  putP(e, CASTLE[0], CASTLE[1] + 3);
  oneMon(e, 0, e.vars.pc + 1, e.vars.pr, 1, 1);     // a dying rat
  const g0 = e.vars.gold, x0 = e.vars.xp;
  step1(e, "d");
  check("bump a rat and it dies: gold and XP flow", L(e, "mon")[0] === 0 && e.vars.gold > g0 && e.vars.xp === x0 + 5);
  check("you do not step onto the corpse mid-swing", e.vars.pc === CASTLE[0]);
  const e2 = fresh(); play(e2); calm(e2);
  putP(e2, CASTLE[0], CASTLE[1] + 3);
  oneMon(e2, 0, e2.vars.pc + 1, e2.vars.pr, 3, 999);  // a skeleton that will hit back
  const hp0 = e2.vars.hp;
  step1(e2, "d");
  check("an adjacent monster answers with its own blow", e2.vars.hp < hp0);
  const e3 = fresh(); play(e3); calm(e3);
  e3.vars.xp = 39;
  putP(e3, CASTLE[0], CASTLE[1] + 3);
  oneMon(e3, 0, e3.vars.pc + 1, e3.vars.pr, 1, 1);
  const mh0 = e3.vars.maxhp;
  step1(e3, "d"); e3.step();
  check("40 XP: LEVEL 2, +8 max HP, healed whole",
    e3.vars.level === 2 && e3.vars.maxhp === mh0 + 8 && e3.vars.hp === e3.vars.maxhp);
}

// ---- towns: food, the sword, the armor, and the door
{
  const e = fresh(); play(e); calm(e);
  const [tc, tr] = TOWNS[0];
  putP(e, tc, tr - 1); e.vars.camr = 0;
  step1(e, "s");
  check("step into a town and the trader opens shop", e.vars.mode === 1 && e.vars.townname === "WESTON");
  const g0 = e.vars.gold, f0 = e.vars.food;
  menuKey(e, "1");
  check("1 buys food: −10 gold, +20 food", e.vars.gold === g0 - 10 && e.vars.food === f0 + 20);
  e.vars.gold = 500;
  menuKey(e, "2");
  check("2 buys the next blade", e.vars.wtier === 1 && e.vars.gold === 500 - 60);
  menuKey(e, "3");
  check("3 buys the next armor", e.vars.atier === 1);
  menuKey(e, "4");
  check("4 leaves the shop", e.vars.mode === 0);
  e.vars.gold = 0;
  step1(e, "w"); step1(e, "s");
  menuKey(e, "2");
  check("an empty purse buys nothing", e.vars.wtier === 1);
}

// ---- the king heals for gold
{
  const e = fresh(); play(e); calm(e);
  putP(e, CASTLE[0], CASTLE[1] + 1);
  e.vars.hp = 3; e.vars.gold = 50;
  step1(e, "w");
  check("the castle opens the court", e.vars.mode === 3);
  menuKey(e, "1");
  check("20 gold mends you whole", e.vars.hp === e.vars.maxhp && e.vars.gold === 30);
  menuKey(e, "2");
  check("2 takes your leave", e.vars.mode === 0);
}

// ---- the depths: darkness, the sigil, the way out
{
  const e = fresh(); play(e); calm(e);
  const [dc, dr] = DUNGEONS[0];
  putP(e, dc, dr - 1);
  step1(e, "s");
  check("the dungeon mouth swallows you", e.vars.mode === 2 && e.vars.dgn === 0);
  check("dungeon walls fill the window", e.lists.wmap[0] === 8);
  check("the camera pins to the depths", e.vars.camc === 0 && e.vars.camr === 0);
  // teleport beside the chest and take the sigil
  let chest = null, rows = DMAPS[0];
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (rows[r][c] === "C") chest = [c, r];
  calm(e);
  putP(e, chest[0] - 1, chest[1]);
  const g0 = e.vars.gold;
  step1(e, "d");
  check("the SIGIL: 1 of 3, and 100 gold", e.vars.sigils === 1 && e.vars.gold === g0 + 100);
  putP(e, chest[0] - 1, chest[1]);
  step1(e, "d");
  check("a sigil only comes once from one depth", e.vars.sigils === 1);
  // walk out
  let ex = null;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (rows[r][c] === "E") ex = [c, r];
  calm(e);
  putP(e, ex[0] + 1, ex[1]);
  step1(e, "a");
  check("the way out returns you to the mouth, world restored",
    e.vars.mode === 0 && e.vars.pc === dc && e.vars.pr === dr && e.lists.wmap[dr * MW + dc] === 6);
}

// ---- the tower: barred at two sigils, answered at three
{
  const e = fresh(); play(e); calm(e);
  e.vars.sigils = 2;
  putP(e, TOWER[0], TOWER[1] + 1);
  step1(e, "w");
  check("two sigils: the gate holds", e.vars.bosson === 0 && e.vars.pr === TOWER[1] + 1);
  e.vars.sigils = 3;
  e.vars.mvcool = 0;
  step1(e, "w");
  check("three sigils: THE SORCERER comes down", e.vars.bosson === 1 && L(e, "mon")[7] === 1 && L(e, "mtp")[7] === 6);
  // cut him down
  calm(e);
  oneMon(e, 7, e.vars.pc + 1, e.vars.pr, 6, 1);
  const sc0 = e.vars.xp + e.vars.gold;
  step1(e, "d"); e.step();
  check("the sorcerer falls: the realm is free (+2000)",
    e.vars.game === 2 && e.vars.endplay === 1 && e.vars.score >= sc0 + 2000);
}

// ---- slain
{
  const e = fresh(); play(e); calm(e);
  putP(e, CASTLE[0], CASTLE[1] + 3);
  oneMon(e, 0, e.vars.pc + 1, e.vars.pr, 5, 999);
  e.vars.hp = 1;
  step1(e, "d"); e.step();
  check("slain in the wild: the ledger closes on gold + XP",
    e.vars.game === 2 && e.vars.endplay === 1 && e.vars.score === e.vars.xp + e.vars.gold);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

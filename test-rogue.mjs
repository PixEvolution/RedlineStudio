// Headless test: Rogue (1980) — procedural floors (connected, every deal),
// turn-based bump combat, gold, potions, stairs, the amulet, permadeath.
import { Engine } from "./js/engine.js";
import { buildRogueExample } from "./studio/example-rogue.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const GW = 30, GH = 14;
const fresh = () => {
  const e = new Engine(null, buildRogueExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 180); e.step(); };
const tap = (e, k) => { e.keys[k] = true; e.step(); e.keys[k] = false; e.step(); };
const benchMobs = (e) => { for (let m = 0; m < 4; m++) e.lists.ma[m] = 0; };
const clearLoot = (e) => {
  for (let g = 0; g < 4; g++) e.lists.gon[g] = 0;
  for (let p = 0; p < 2; p++) e.lists.pon[p] = 0;
};
// find an open neighbor direction of (x, y)
const openDir = (e, x, y) => {
  for (const [k, dx, dy] of [["d", 1, 0], ["a", -1, 0], ["s", 0, 1], ["w", 0, -1]]) {
    if ((e.lists.tl[(y + dy) * GW + (x + dx)] || 0) > 0) return [k, dx, dy];
  }
  return null;
};

console.log("Rogue (1980):");
{
  const ex = buildRogueExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("lives on the TELETYPE, not the canvas", eng.usesTerminal()
    && ex.objects.length === 2);
  check("keyboard turns, no stick", eng.usedSticks().length === 0
    && eng.usedKeys().includes("w") && eng.usedKeys().includes("ArrowUp"));
  const e = fresh();
  check("the attract screen names the rules: permadeath, the letters, the amulet",
    e.termLines.some(l => l.includes("ROGUE")) && e.termLines.some(l => l.includes("death is FOREVER"))
    && e.termLines.some(l => l.includes("AMULET")));
  play(e);
  check("a coin deals floor 1: 20 hp, an @ standing on real floor",
    e.vars.game === 0 && e.vars.dfloor === 1 && e.vars.hp === 20
    && (e.lists.tl[e.vars.py * GW + e.vars.px] || 0) > 0);
  check("…and the teletype shows the dungeon, @ and all",
    e.termLines[0].includes("FLOOR 1") && e.termLines.some(l => l.includes("@")));
}

console.log("Every deal is one connected dungeon:");
{
  let allConnected = true, deals = 0;
  for (let trial = 0; trial < 5; trial++) {
    const e = fresh();
    play(e);
    deals++;
    const open = new Set();
    for (let i = 0; i < GW * GH; i++) if ((e.lists.tl[i] || 0) > 0) open.add(i);
    const start = e.vars.py * GW + e.vars.px;
    const q = [start], seen = new Set(q);
    while (q.length) {
      const n = q.pop();
      for (const d of [1, -1, GW, -GW]) {
        const n2 = n + d;
        if (open.has(n2) && !seen.has(n2)) { seen.add(n2); q.push(n2); }
      }
    }
    if (seen.size !== open.size) allConnected = false;
    if (open.size < 100) allConnected = false;
  }
  check("five fresh deals: every floor cell reachable from the @, every time",
    allConnected && deals === 5);
  // and the deals differ — that's the whole idea
  const a = fresh(); play(a);
  const b = fresh(); play(b);
  const sig = (e) => Array.from({ length: GW * GH }, (_, i) => e.lists.tl[i] || 0).join("");
  check("…and no two dungeons are the same", sig(a) !== sig(b) || a.vars.px !== b.vars.px);
}

console.log("Turns, walls, loot:");
{
  const e = fresh();
  play(e);
  benchMobs(e); clearLoot(e);
  const [k, dx] = openDir(e, e.vars.px, e.vars.py);
  const x0 = e.vars.px, y0 = e.vars.py;
  tap(e, k);
  check("a key is a TURN: the @ steps once", Math.abs(e.vars.px - x0) + Math.abs(e.vars.py - y0) === 1);
  // rock blocks: march to a rock edge
  e.vars.px = x0; e.vars.py = y0;
  let guard = 0;
  while (openDir(e, e.vars.px, e.vars.py)?.[0] === "w" && guard++ < 20) tap(e, "w");
  const yr = e.vars.py;
  tap(e, "w");
  check("rock is rock — no step into the void",
    (e.lists.tl[(yr - 1) * GW + e.vars.px] || 0) > 0 || e.vars.py === yr);
  // gold
  e.lists.gon[0] = 1; e.lists.gpx[0] = e.vars.px + 1; e.lists.gpy[0] = e.vars.py;
  e.lists.tl[e.vars.py * GW + e.vars.px + 1] = 1;
  e.lists.gpv[0] = 25;
  const sc0 = e.vars.score;
  tap(e, "d");
  check("gold on the floor is gold in the score", e.vars.gold >= 25 && e.vars.score >= sc0 + 25
    && e.lists.gon[0] === 0);
  // potion
  e.vars.hp = 5;
  e.lists.pon[0] = 1; e.lists.ppx[0] = e.vars.px + 1; e.lists.ppy[0] = e.vars.py;
  e.lists.tl[e.vars.py * GW + e.vars.px + 1] = 1;
  tap(e, "d");
  check("a potion quaffs on contact: +8 hp", e.vars.hp === 13 && e.lists.pon[0] === 0);
}

console.log("Bump to fight:");
{
  const e = fresh();
  play(e);
  benchMobs(e); clearLoot(e);
  e.lists.tl[e.vars.py * GW + e.vars.px + 1] = 1;
  e.lists.ma[0] = 1; e.lists.mtp[0] = 2; e.lists.mhp[0] = 4;
  e.lists.mx[0] = e.vars.px + 1; e.lists.my[0] = e.vars.py;
  const sc0 = e.vars.score, x0 = e.vars.px;
  tap(e, "d");
  check("bumping a letter swings — you do not trade places", e.vars.px === x0
    && (e.lists.mhp[0] < 4 || e.lists.ma[0] === 0));
  for (let i = 0; i < 6 && e.lists.ma[0] === 1; i++) tap(e, "d");
  check("the rat dies for 20 (type × 10)", e.lists.ma[0] === 0 && e.vars.score >= sc0 + 20);
  // the letters bite back
  const e2 = fresh();
  play(e2);
  benchMobs(e2); clearLoot(e2);
  e2.lists.tl[e2.vars.py * GW + e2.vars.px + 1] = 1;
  e2.lists.ma[0] = 1; e2.lists.mtp[0] = 5; e2.lists.mhp[0] = 99;
  e2.lists.mx[0] = e2.vars.px + 1; e2.lists.my[0] = e2.vars.py;
  const hp0 = e2.vars.hp;
  tap(e2, " ") ?? tap(e2, "Space");
  tap(e2, "Space");
  check("an adjacent troll bites on ITS turn", e2.vars.hp < hp0);
  // and they advance
  const e3 = fresh();
  play(e3);
  clearLoot(e3);
  benchMobs(e3);
  e3.lists.ma[0] = 1; e3.lists.mtp[0] = 3; e3.lists.mhp[0] = 99;
  // park the orc 4 open cells away along the player's row if possible
  e3.lists.mx[0] = e3.vars.px + 4; e3.lists.my[0] = e3.vars.py;
  for (let i = 0; i < 4; i++) e3.lists.tl[e3.vars.py * GW + e3.vars.px + 1 + i] = 1;
  const d0 = 4;
  tap(e3, "Space"); tap(e3, "Space");
  const d1 = Math.abs(e3.lists.mx[0] - e3.vars.px) + Math.abs(e3.lists.my[0] - e3.vars.py);
  check("letters ADVANCE while you stand still", d1 < d0);
}

console.log("Stairs, the amulet, permadeath:");
{
  const e = fresh();
  play(e);
  benchMobs(e); clearLoot(e);
  // teleport onto the stairs cell's neighbor and step on
  e.vars.px = e.vars.stx - 1; e.vars.py = e.vars.sty;
  e.lists.tl[e.vars.sty * GW + e.vars.stx - 1] = 1;
  tap(e, "d");
  check("the > deals floor 2 — tougher, and a bigger hp pool",
    e.vars.dfloor === 2 && e.vars.maxhp === 22);
  check("…whole new dungeon on the teletype", e.termLines[0].includes("FLOOR 2"));
  // the amulet
  const e2 = fresh();
  play(e2);
  benchMobs(e2); clearLoot(e2);
  e2.vars.dfloor = 5;
  e2.vars.px = e2.vars.stx - 1; e2.vars.py = e2.vars.sty;
  e2.lists.tl[e2.vars.sty * GW + e2.vars.stx - 1] = 1;
  const sc = e2.vars.score;
  tap(e2, "d");
  check("floor 5: the & WINS the run (+1000, endplay + ★ table)",
    e2.vars.game === 2 && Number(e2.vars.endplay) === 1 && e2.vars.score === sc + 1000
    && e2.termLines.some(l => l.includes("AMULET")));
  // permadeath
  const e3 = fresh();
  play(e3);
  clearLoot(e3);
  benchMobs(e3);
  e3.lists.ma[0] = 1; e3.lists.mtp[0] = 6; e3.lists.mhp[0] = 99;
  e3.lists.mx[0] = e3.vars.px + 1; e3.lists.my[0] = e3.vars.py;
  e3.lists.tl[e3.vars.py * GW + e3.vars.px + 1] = 1;
  e3.vars.hp = 1;
  tap(e3, "Space"); tap(e3, "Space");
  check("hp 0 is FOREVER (endplay + ★ table)", e3.vars.game === 2
    && Number(e3.vars.endplay) === 1
    && e3.termLines.some(l => l.includes("YOU DIED ON FLOOR")));
  e3.fireClick(10, 10); e3.step();
  check("a click after death deals the attract screen again", e3.vars.game === 9
    && e3.termLines.some(l => l.includes("ROGUE")));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

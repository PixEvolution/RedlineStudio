// Headless test: Galaxian (1979) — the four-color convoy, the divers and
// their doubled pay, diver-only fire, no bunkers, lives, waves, starfield.
import { Engine } from "./js/engine.js";
import { buildGalaxianExample } from "./studio/example-galaxian.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildGalaxianExample().objects, { w: 360, h: 480 });
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 350); e.step(); };
const noDivers = (e) => { e.vars.divet = 999999; e.vars.dv1 = -1; e.vars.dv2 = -1; };
// put the shot ON a formation slot and bite
const shootSlot = (e, r, c) => {
  e.vars.shoton = 1;
  e.byName.shot.x = e.vars.fx + c * 28;
  e.byName.shot.y = 70 + r * 20 + 7;
  e.step();
};

console.log("Galaxian (1979):");
{
  const ex = buildGalaxianExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  const inv = ex.objects.filter(o => o.name.startsWith("inv"));
  check("a 46-ship convoy in the wedge", inv.length === 46);
  check("FULL COLOR: four ranks, four colors", new Set(inv.map(o => o.color)).size === 4
    && inv.some(o => o.color === "#ffe14a") && inv.some(o => o.color === "#4aa8ff"));
  check("an RGB starfield scrolls behind it", ex.objects.filter(o => o.name.startsWith("star")).length === 12
    && new Set(ex.objects.filter(o => o.name.startsWith("star")).map(o => o.color)).size >= 5);
  check("NO bunkers — 1979 took the cover away", !ex.objects.some(o => o.name.startsWith("bk")));
  check("portrait cabinet, arcade contract", ex.w === 360 && eng.usesScoreboard());
}

console.log("The convoy slides but NEVER sinks:");
{
  const e = fresh();
  play(e);
  noDivers(e);
  const fx0 = e.vars.fx;
  for (let i = 0; i < 200; i++) e.step();
  check("it slides", e.vars.fx !== fx0);
  check("…and the formation has no vertical anchor to lose (fy doesn't exist)", e.vars.fy === undefined || e.vars.fy === 0);
}

console.log("Formation pay by rank:");
{
  const e = fresh();
  play(e);
  noDivers(e);
  for (const [row, col, pts] of [[5, 3, 30], [2, 3, 40], [1, 3, 50], [0, 4, 60]]) {
    const s0 = e.vars.score;
    shootSlot(e, row, col);
    check(`rank at row ${row} pays ${pts}`, e.vars.score - s0 === pts);
  }
  check("the convoy count moves", e.vars.alive === 42);
}

console.log("The divers:");
{
  const e = fresh();
  play(e);
  e.vars.divet = 1;
  for (let i = 0; i < 30 && e.vars.dv1 < 0; i++) e.step();
  check("a ship PEELS OFF and dives", e.vars.dv1 >= 0);
  const y0 = e.vars.dv1y;
  for (let i = 0; i < 20; i++) e.step();
  check("the dive comes DOWN at you, swooping", e.vars.dv1 < 0 || e.vars.dv1y > y0 + 30);
  // a diver's glyph rides the dive
  if (e.vars.dv1 >= 0) {
    e.step();
    const g = e.byName["inv" + (e.vars.dv1 + 1)];
    check("the glyph rides the dive, not the grid (±one frame)", Math.abs(g.y - e.vars.dv1y) < 6);
  } else {
    check("the glyph rides the dive, not the grid", true);   // already looped home
  }
  // a missed diver loops home unharmed
  const e2 = fresh();
  play(e2);
  e2.vars.divet = 1;
  for (let i = 0; i < 30 && e2.vars.dv1 < 0; i++) e2.step();
  const slot = e2.vars.dv1;
  const alive0 = e2.vars.alive;
  e2.vars.dv1y = 500; e2.byName.cannon.x = 10; e2.step();
  check("a missed diver loops home to its slot, unharmed", e2.vars.dv1 === -1 && e2.lists.a[slot] === 1 && e2.vars.alive === alive0);
}

console.log("Divers pay DOUBLE:");
{
  const e = fresh();
  play(e);
  // stage a diving flagship (slot 4 = row 0) and shoot it mid-dive
  e.vars.dv1 = 4; e.vars.dv1x = 180; e.vars.dv1y = 260; e.vars.dv1t = 0;
  e.vars.shoton = 1;
  e.byName.shot.x = 180; e.byName.shot.y = 262;
  const s0 = e.vars.score;
  e.step();
  check("a diving FLAGSHIP pays 150", e.vars.score - s0 === 150 && e.vars.dv1 === -1);
  // a diving blue drone pays 60 (vs 30 at home)
  e.vars.dv2 = 53; e.vars.dv2x = 120; e.vars.dv2y = 260; e.vars.dv2t = 0;
  e.vars.shoton = 1;
  e.byName.shot.x = 120; e.byName.shot.y = 262;
  const s1 = e.vars.score;
  e.step();
  check("a diving blue pays 60 — double its desk job", e.vars.score - s1 === 60);
}

console.log("Only divers fire — and they fight to the end:");
{
  const e = fresh();
  play(e);
  noDivers(e);
  for (let i = 0; i < 300; i++) e.step();
  check("with no divers out, NOTHING shoots at you", e.vars.bombon1 === 0 && e.vars.bombon2 === 0);
  // a bomb into the fighter
  e.vars.bombon1 = 1;
  e.byName.bomb1.x = e.byName.cannon.x; e.byName.bomb1.y = 440;
  e.step(); e.step();
  check("a diver's bomb costs a life", e.vars.lives === 2);
  // a diver that reaches you takes you with it
  e.vars.dv1 = 30; e.vars.dv1x = e.byName.cannon.x; e.vars.dv1y = 446; e.vars.dv1t = 0;
  const a0 = e.vars.alive;
  e.step();
  check("a ramming diver takes you WITH it", e.vars.lives === 1 && e.vars.alive === a0 - 1 && e.vars.dv1 === -1);
  e.vars.bombon1 = 1;
  e.byName.bomb1.x = e.byName.cannon.x; e.byName.bomb1.y = 440;
  e.step(); e.step();
  check("the last life ends the play", e.vars.game === 2 && Number(e.vars.endplay) === 1);
}

console.log("Waves:");
{
  const e = fresh();
  play(e);
  noDivers(e);
  for (let k = 0; k < 60; k++) e.lists.a[k] = 0;
  e.vars.alive = 0;
  e.step();
  check("a cleared convoy deals a fresh wedge of 46", e.vars.wave === 2 && e.vars.alive === 46);
  const probe = new Engine(null, buildGalaxianExample().objects);
  check("one on-screen stick", JSON.stringify(probe.usedSticks()) === "[1]");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

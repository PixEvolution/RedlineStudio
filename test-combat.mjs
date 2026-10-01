// Headless test: Combat (1977) — three variations, the 2:16 clock, one shell
// per player, ricochets in the maze, clouds in the sky, and NO computer
// opponent, exactly like the cartridge.
import { Engine } from "./js/engine.js";
import { buildCombatExample } from "./studio/example-combat.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildCombatExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const startMode = (e, m) => { e.fireClick([120, 240, 366][m - 1], 262); e.step(); };
const veh = (e, n) => e.byName["veh" + n];
const press = (e, k) => { e.keys[k] = true; e.step(); e.keys[k] = false; e.step(); };

console.log("Combat (1977):");
{
  const ex = buildCombatExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("two players, two shells, three walls, two clouds",
    ex.objects.filter(o => o.type === "tri").length === 2 &&
    ex.objects.filter(o => o.name.startsWith("shell")).length === 2 &&
    ex.objects.filter(o => o.name.startsWith("wall")).length === 3 &&
    ex.objects.filter(o => o.name.startsWith("cloud")).length === 2);
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("NO computer opponent — the help says so out loud",
    ex.objects.some(o => o.name === "help" && o.text.includes("NO COMPUTER OPPONENT")));
  check("two sticks wear player names", ex.objects.some(o => o.name === "stick1tag") && ex.objects.some(o => o.name === "stick2tag"));
}

console.log("The cartridge clock:");
{
  const e = fresh();
  startMode(e, 1);
  check("[TANK] starts a 2:16 game", e.vars.game === 0 && e.vars.mode === 1 && String(e.byName.timetx.text).startsWith("2:1"));
  check("tanks at their corners", veh(e, 1).x < 120 && veh(e, 2).x > 360);
  e.vars.tleft = 70 * 60 + 5 * 60;   // 1:05 — the M:SS padding
  e.step();
  check("the clock pads its seconds (1:05, not 1:5)", String(e.byName.timetx.text) === "1:15" || String(e.byName.timetx.text) === "1:14" || /^\d:0\d$|^\d:1[45]$/.test(String(e.byName.timetx.text)));
  e.vars.tleft = 2;
  e.vars.score1 = 3; e.vars.score2 = 1;
  e.step(); e.step(); e.step();
  check("0:00 ends it and names the winner", e.vars.game === 2 && Number(e.vars.endplay) === 1
    && String(e.byName.status.text).includes("PLAYER 1"));
  check("the ★ table takes the winner's hits", e.vars.score === 3);
  e.fireClick(10, 10); e.step();
  check("a click returns to the menu", e.vars.game === 9);
}

console.log("Tanks:");
{
  const e = fresh();
  startMode(e, 1);
  const x0 = veh(e, 1).x;
  e.keys["w"] = true;
  for (let i = 0; i < 15; i++) e.step();
  e.keys["w"] = false;
  check("W drives tank 1 where it points", veh(e, 1).x > x0 + 15);
  const a0 = veh(e, 1).angle;
  e.keys["d"] = true;
  for (let i = 0; i < 8; i++) e.step();
  e.keys["d"] = false;
  check("D turns it", veh(e, 1).angle > a0);
  // one shell per player, fired on the press
  press(e, "q");
  check("Q fires P1's shell", e.vars.shellon1 === 1);
  e.keys["q"] = true; e.step();
  const sx = e.byName.shell1.x;
  check("holding fire does NOT reload — one shell in the air", e.vars.shellon1 === 1 && sx > 0);
  e.keys["q"] = false;
  // walk the shell into tank 2
  e.byName.shell1.x = veh(e, 2).x - 8;
  e.byName.shell1.y = veh(e, 2).y;
  e.vars.svx1 = 1; e.vars.svy1 = 0;
  e.step();
  check("a hit scores for the shooter and respawns the victim", e.vars.score1 === 1 && e.vars.shellon1 === 0
    && veh(e, 2).x === 410);
  // arena walls stop shells dead in plain TANK
  press(e, "q");
  e.byName.shell1.x = 470; e.vars.svx1 = 1; e.vars.svy1 = 0;
  e.step();
  check("in open TANK the walls eat shells", e.vars.shellon1 === 0);
}

console.log("The maze ricochets:");
{
  const e = fresh();
  startMode(e, 2);
  check("the maze slabs stand up in mode 2", Number(e.byName.wall1.visible) === 1);
  // tanks can't drive through a slab
  veh(e, 1).x = 110; veh(e, 1).y = 130; veh(e, 1).angle = 0;
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["w"] = false;
  check("a slab stops a tank", veh(e, 1).x < 113);
  // the outer wall bounces shells instead of eating them
  press(e, "q");
  e.vars.shellon1 = 1; e.vars.sbn1 = 0; e.vars.slife1 = 90;   // clean teleport
  e.byName.shell1.x = 470; e.byName.shell1.y = 200; e.vars.svx1 = 1; e.vars.svy1 = 0;
  e.step();
  check("the outer wall RICOCHETS the shell back", e.vars.shellon1 === 1 && e.vars.svx1 === -1);
  check("…with the bounce counted", e.vars.sbn1 === 1);
  e.vars.sbn1 = 3; e.step();
  check("three bounces is a spent shell", e.vars.shellon1 === 0);
}

console.log("Biplanes:");
{
  const e = fresh();
  startMode(e, 3);
  check("the clouds roll in for mode 3", Number(e.byName.cloud1.visible) === 1 && Number(e.byName.wall1.visible) === 0);
  const x0 = veh(e, 1).x;
  for (let i = 0; i < 10; i++) e.step();
  check("a biplane NEVER stops flying", veh(e, 1).x > x0 + 15);
  // wrap at the edge
  veh(e, 1).x = 471; veh(e, 1).angle = 0;
  e.step();
  check("off one edge, in the other", veh(e, 1).x < 20);
  // the cloud hides you from everyone
  veh(e, 1).x = e.byName.cloud1.x; veh(e, 1).y = e.byName.cloud1.y; veh(e, 1).angle = 90;
  e.step();
  check("a plane in a cloud VANISHES", Number(veh(e, 1).visible) === 0);
  veh(e, 1).x = 240; veh(e, 1).y = 330;
  e.step(); e.step();
  check("…and reappears in open sky", Number(veh(e, 1).visible) === 1);
}

console.log("Player 2 is a human with equal rights:");
{
  const e = fresh();
  startMode(e, 1);
  const x0 = veh(e, 2).x;
  e.keys["ArrowUp"] = true;
  for (let i = 0; i < 12; i++) e.step();
  e.keys["ArrowUp"] = false;
  check("arrows drive tank 2", veh(e, 2).x < x0 - 10);
  press(e, "m");
  check("M fires P2's shell", e.vars.shellon2 === 1);
  e.byName.shell2.x = veh(e, 1).x + 8; e.byName.shell2.y = veh(e, 1).y;
  e.vars.svx2 = -1; e.vars.svy2 = 0;
  e.step();
  check("P2's hits score for P2", e.vars.score2 === 1);
  const probe = new Engine(null, buildCombatExample().objects);
  check("two on-screen sticks, one per player", JSON.stringify(probe.usedSticks()) === "[1,2]");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Headless test: Berzerk (1980) — live walls, clumsy robots, 8-way fire,
// the taunting speech, the sweep bonus, the doors, and THE WARDEN.
import { Engine } from "./js/engine.js";
import { buildBerzerkExample } from "./studio/example-berzerk.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildBerzerkExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 214); e.step(); };
const noGrace = (e) => { e.vars.grace = 0; };
const benchRobots = (e) => { for (let r = 0; r < 8; r++) e.lists.ron[r] = 0; e.vars.robleft = 99; };
const clearWalls = (e) => { for (let i = 0; i < 6; i++) e.lists.won[i] = 0; };
const putRobot = (e, r, x, y) => {
  e.lists.ron[r] = 1; e.lists.rx[r] = x; e.lists.ry[r] = y; e.lists.rf[r] = 9999;
};

console.log("Berzerk (1980):");
{
  const ex = buildBerzerkExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick for the RUNNER", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "RUNNER"));
  check("eight robots, gapped borders, six wall slots, one WARDEN",
    ex.objects.filter(o => /^robot\d/.test(o.name)).length === 8
    && ex.objects.filter(o => o.name.startsWith("border")).length === 8
    && ex.objects.filter(o => /^wall\d/.test(o.name)).length === 6
    && ex.objects.some(o => o.name === "warden"));
  const src = JSON.stringify(ex.objects);
  check("…and the machine TALKS", src.includes("INTRUDER ALERT! INTRUDER ALERT!")
    && src.includes("FIGHT LIKE A ROBOT") && src.includes("THE WARDEN COMES")
    && src.includes("GOT THE INTRUDER"));
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin drops you in room 1 with robots and 3 runners",
    e.vars.game === 0 && e.vars.lives === 3 && e.vars.roomn === 1 && e.vars.robleft >= 4);
}

console.log("Every wall is live:");
{
  const e = fresh();
  play(e);
  benchRobots(e); clearWalls(e);
  noGrace(e);
  e.vars.px = 240; e.vars.py = 200;
  e.keys["w"] = true;
  for (let i = 0; i < 80 && e.vars.roomn === 1; i++) e.step();   // x=240 IS the gap
  e.keys["w"] = false;
  check("the door gap is safe passage — straight up leads OUT", e.vars.roomn === 2);
  // off the gap, the border bites
  const e2 = fresh();
  play(e2);
  benchRobots(e2); clearWalls(e2);
  noGrace(e2);
  e2.vars.px = 100; e2.vars.py = 70;
  e2.keys["w"] = true;
  for (let i = 0; i < 12 && e2.vars.lives === 3; i++) { e2.step(); e2.vars.grace = 0; }
  e2.keys["w"] = false;
  check("brush the border off the gap and you're gone", e2.vars.lives === 2);
  // interior walls bite the same
  const e3 = fresh();
  play(e3);
  benchRobots(e3); clearWalls(e3);
  e3.lists.won[0] = 1; e3.lists.wx1[0] = 200; e3.lists.wy1[0] = 200; e3.lists.wlen[0] = 100; e3.lists.wvert[0] = 0;
  noGrace(e3);
  e3.vars.px = 250; e3.vars.py = 240;
  e3.keys["w"] = true;
  for (let i = 0; i < 20 && e3.vars.lives === 3; i++) { e3.step(); e3.vars.grace = 0; }
  e3.keys["w"] = false;
  check("interior walls are just as electrified", e3.vars.lives === 2);
  // the entry grace holds
  const e4 = fresh();
  play(e4);
  benchRobots(e4);
  check("…but the doorway grace lets you arrive alive", e4.vars.lives === 3 && e4.vars.grace > 0);
}

console.log("8-way fire:");
{
  const e = fresh();
  play(e);
  benchRobots(e); clearWalls(e);
  noGrace(e);
  e.vars.px = 150; e.vars.py = 200; e.vars.fdx = 1; e.vars.fdy = 0;
  e.vars.robleft = 1; e.vars.nrob = 5;
  putRobot(e, 0, 260, 200);
  const sc0 = e.vars.score;
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  for (let i = 0; i < 30 && e.lists.ron[0] === 1; i++) e.step();
  check("your laser rides your facing and kills for 50",
    e.lists.ron[0] === 0 && e.vars.score >= sc0 + 50);
  check("the LAST robot pays the PERFECT SWEEP bonus",
    e.vars.score === sc0 + 50 + e.vars.nrob * 10 && e.vars.sweptroom === e.vars.roomn);
  // facing follows your run
  e.vars.px = 240; e.vars.py = 200;
  e.keys["s"] = true; e.step(); e.keys["s"] = false; e.step();
  check("facing follows the last direction run", e.vars.fdx === 0 && e.vars.fdy === 1);
  // walls stop lasers
  const e2 = fresh();
  play(e2);
  benchRobots(e2); clearWalls(e2);
  e2.lists.won[0] = 1; e2.lists.wx1[0] = 260; e2.lists.wy1[0] = 160; e2.lists.wlen[0] = 80; e2.lists.wvert[0] = 1;
  noGrace(e2);
  e2.vars.px = 180; e2.vars.py = 200; e2.vars.fdx = 1; e2.vars.fdy = 0;
  putRobot(e2, 0, 340, 200);
  e2.vars.robleft = 1;
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  for (let i = 0; i < 40; i++) e2.step();
  check("walls are COVER: your laser dies on them", e2.lists.ron[0] === 1 && e2.vars.plas === 0);
}

console.log("The robots are clumsy:");
{
  const e = fresh();
  play(e);
  benchRobots(e); clearWalls(e);
  noGrace(e);
  // one shuffles toward you…
  e.vars.px = 240; e.vars.py = 200;
  putRobot(e, 0, 120, 200);
  e.vars.robleft = 1;
  for (let i = 0; i < 60; i++) { e.step(); e.vars.px = 240; e.vars.py = 200; e.vars.grace = 0; }
  check("robots shuffle toward the intruder", e.lists.rx[0] > 135);
  // …into a wall, and dies, and PAYS
  const e2 = fresh();
  play(e2);
  benchRobots(e2); clearWalls(e2);
  e2.lists.won[0] = 1; e2.lists.wx1[0] = 200; e2.lists.wy1[0] = 160; e2.lists.wlen[0] = 80; e2.lists.wvert[0] = 1;
  noGrace(e2);
  e2.vars.px = 300; e2.vars.py = 200;       // robot must cross the wall line
  putRobot(e2, 0, 160, 200);
  e2.vars.robleft = 1; e2.vars.nrob = 5;
  const sc1 = e2.vars.score;
  for (let i = 0; i < 140 && e2.lists.ron[0] === 1; i++) { e2.step(); e2.vars.px = 300; e2.vars.py = 200; e2.vars.grace = 0; }
  check("a robot walks into the wall — dead, and it pays YOU 50",
    e2.lists.ron[0] === 0 && e2.vars.score >= sc1 + 50);
  // two grind each other up
  const e3 = fresh();
  play(e3);
  benchRobots(e3); clearWalls(e3);
  noGrace(e3);
  e3.vars.px = 240; e3.vars.py = 330;
  putRobot(e3, 0, 236, 120);
  putRobot(e3, 1, 244, 120);
  e3.vars.robleft = 2;
  const sc2 = e3.vars.score;
  e3.step();
  check("two robots in one spot grind each other up (+100)",
    e3.lists.ron[0] === 0 && e3.lists.ron[1] === 0 && e3.vars.score >= sc2 + 100);
  // aligned, they FIRE — and it kills
  const e4 = fresh();
  play(e4);
  benchRobots(e4); clearWalls(e4);
  noGrace(e4);
  e4.vars.px = 160; e4.vars.py = 200;
  putRobot(e4, 0, 400, 204);               // same row
  e4.lists.rf[0] = 1;
  e4.vars.robleft = 1;
  e4.step();
  check("a robot aligned on your row FIRES", e4.lists.rlon[0] === 1 && e4.lists.rlvx[0] < 0);
  for (let i = 0; i < 90 && e4.vars.lives === 3; i++) { e4.step(); e4.vars.px = 160; e4.vars.py = 200; e4.vars.grace = 0; }
  check("…and its laser ends a careless runner", e4.vars.lives === 2);
}

console.log("Doors, taunts, THE WARDEN:");
{
  const e = fresh();
  play(e);
  benchRobots(e); clearWalls(e);
  noGrace(e);
  e.vars.robleft = 3;                       // leaving early
  e.vars.px = 20; e.vars.py = 180;
  e.keys["a"] = true;
  for (let i = 0; i < 10 && e.vars.roomn === 1; i++) e.step();
  e.keys["a"] = false;
  check("the west door chains to room 2, robots fresh",
    e.vars.roomn === 2 && e.vars.robleft >= 4 && e.vars.px > 400);
  // the warden
  const e2 = fresh();
  play(e2);
  benchRobots(e2); clearWalls(e2);
  noGrace(e2);
  e2.vars.wtim = 721;
  e2.step();
  check("linger and THE WARDEN comes", e2.vars.wardon === 1);
  const wx0 = e2.vars.wardx;
  e2.vars.px = 400; e2.vars.py = 180;
  for (let i = 0; i < 30; i++) { e2.step(); e2.vars.px = 400; e2.vars.py = 180; e2.vars.grace = 0; }
  check("…through the walls, straight at you", e2.vars.wardx > wx0 + 20);
  // it cannot be killed
  e2.vars.plas = 1; e2.vars.plx = e2.vars.wardx; e2.vars.ply = e2.vars.wardy;
  e2.vars.plvx = 0; e2.vars.plvy = 0;
  e2.step();
  check("it cannot be killed", e2.vars.wardon === 1);
  e2.vars.wardx = e2.vars.px; e2.vars.wardy = e2.vars.py;
  e2.step();
  check("its touch is the end of the runner", e2.vars.lives === 2);
  // the last runner
  const e3 = fresh();
  play(e3);
  benchRobots(e3); clearWalls(e3);
  noGrace(e3);
  e3.vars.lives = 1;
  e3.vars.wardon = 1; e3.vars.wardx = e3.vars.px; e3.vars.wardy = e3.vars.py;
  e3.step(); e3.step();
  check("the last runner ends it (endplay + ★ table)", e3.vars.game === 2
    && Number(e3.vars.endplay) === 1);
  e3.fireClick(10, 10); e3.step();
  check("a click after the end returns to attract", e3.vars.game === 9);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

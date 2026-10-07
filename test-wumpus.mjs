// Headless test: Hunt the Wumpus (1973) — the cave, the warnings, the walk,
// the arrow, the bats, the pits, and hunting by ear.
import { Engine } from "./js/engine.js";
import { buildWumpusExample } from "./studio/example-wumpus.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const ADJ = [
  [2, 5, 8],   [1, 3, 10],  [2, 4, 12],  [3, 5, 14],  [1, 4, 6],
  [5, 7, 15],  [6, 8, 17],  [1, 7, 9],   [8, 10, 18], [2, 9, 11],
  [10, 12, 19],[3, 11, 13], [12, 14, 20],[4, 13, 15], [6, 14, 16],
  [15, 17, 20],[7, 16, 18], [9, 17, 19], [11, 18, 20],[13, 16, 19]
];
const room = (e, n) => e.byName["r" + n];
const clickRoom = (e, n) => { e.fireClick(room(e, n).x, room(e, n).y); e.step(); e.step(); };
const noHazards = (e) => { e.vars.wumpus = 0; e.vars.pit1 = 0; e.vars.pit2 = 0; e.vars.bat1 = 0; e.vars.bat2 = 0; };
const fresh = () => {
  const e = new Engine(null, buildWumpusExample().objects);
  e.runEvents("start"); e.step();
  return e;
};

console.log("Hunt the Wumpus (1973):");
let eng = fresh();
check("compiles with zero errors", eng.errors.length === 0);
if (eng.errors.length) console.log(eng.errors.slice(0, 6));
check("you wake in room 1 with 5 arrows", eng.vars.pos === 1 && eng.vars.arrows === 5 && eng.vars.game === 0);
const hz = [eng.vars.wumpus, eng.vars.pit1, eng.vars.pit2, eng.vars.bat1, eng.vars.bat2];
check("hazards placed in the dark (2–20)", hz.every(h => h >= 2 && h <= 20));
check("hazards in distinct rooms", new Set(hz).size === 5);
check("cave list matches the dodecahedron", ADJ.every((t, i) =>
  t.every((n, k) => eng.lists.adj[(i) * 3 + k] === n)));
check("printout reads the room", String(eng.byName.roomline.text) === "RM 1 · ARROWS 5");
check("tunnels listed", String(eng.byName.tunnels.text) === "TUNNELS: 2 5 8");
check("your room lit white, tunnels lit green", room(eng, 1).color === "#ffffff" && room(eng, 2).color === "#7dff9e");
check("far rooms stay dark", room(eng, 13).color === "#39734a");

// hunting by ear: warnings come from the NEIGHBORS, never the room names
noHazards(eng);
eng.vars.wumpus = 2; eng.step();
check("wumpus one tunnel over → I SMELL A WUMPUS", Number(eng.byName.warn1.visible) === 1);
eng.vars.wumpus = 13; eng.step();
check("wumpus far away → silence", Number(eng.byName.warn1.visible) === 0);
eng.vars.pit1 = 5; eng.step();
check("pit next door → I FEEL A DRAFT", Number(eng.byName.warn2.visible) === 1);
eng.vars.bat2 = 8; eng.step();
check("bats next door → BATS NEARBY", Number(eng.byName.warn3.visible) === 1);

// walking
noHazards(eng);
clickRoom(eng, 2);
check("clicking a tunnel walks you there", eng.vars.pos === 2);
check("printout follows", String(eng.byName.tunnels.text) === "TUNNELS: 1 3 10");
clickRoom(eng, 13);
check("you can't walk through rock", eng.vars.pos === 2);

// the pit
eng = fresh(); noHazards(eng);
eng.vars.pit1 = 5; eng.step();
clickRoom(eng, 5);
check("walking into a pit ends the hunt", eng.vars.game === 2);
check("the cave says why", String(eng.byName.statusline.text).includes("PIT"));
check("CLICK FOR A NEW HUNT shows", Number(eng.byName.againline.visible) === 1);
eng.fireClick(240, 180); eng.step(); eng.step();
check("click starts a fresh hunt", eng.vars.game === 0 && eng.vars.pos === 1 && eng.vars.arrows === 5);

// the wumpus reveal
eng = fresh(); noHazards(eng);
eng.vars.wumpus = 8; eng.step();
clickRoom(eng, 8);
check("walking onto the wumpus = eaten", eng.vars.game === 2 && String(eng.byName.statusline.text).includes("EATEN"));
eng.step();
check("its lair glows red in defeat", room(eng, 8).color === "#e5322d");

// the bats
eng = fresh(); noHazards(eng);
eng.vars.bat1 = 5; eng.step();
clickRoom(eng, 5);
check("super bats snatch you somewhere random", eng.vars.game === 0 && eng.vars.pos >= 1 && eng.vars.pos <= 20);

// the arrow: hit
eng = fresh(); noHazards(eng);
eng.vars.wumpus = 8; eng.step();
eng.fireClick(386, 254); eng.step();                 // toggle SHOOT
check("mode button arms the bow", eng.vars.shootmode === 1);
check("tunnels glow amber in shoot mode", room(eng, 2).color === "#ff9d4a");
clickRoom(eng, 8);
check("AHA! arrow into the lair wins", eng.vars.game === 1 && String(eng.byName.statusline.text) === "YOU WIN!");

// the arrow: miss wakes the beast
eng = fresh(); noHazards(eng);
eng.vars.wumpus = 13; eng.step();                    // far from room 1
eng.fireClick(386, 254); eng.step();
clickRoom(eng, 2);                                   // fire into an empty tunnel
check("a miss costs an arrow and disarms", eng.vars.arrows === 4 && eng.vars.shootmode === 0);
check("startled wumpus stays put or moves one room",
  eng.vars.wumpus === 13 || ADJ[12].includes(eng.vars.wumpus));
check("you're still hunting", eng.vars.game === 0);

// out of arrows
eng = fresh(); noHazards(eng);
eng.vars.wumpus = 13; eng.vars.arrows = 1; eng.step();
eng.fireClick(386, 254); eng.step();
clickRoom(eng, 5);
check("last arrow gone = the hunt is lost", eng.vars.game === 2 && String(eng.byName.statusline.text).includes("ARROWS"));

// wumpus never wakes onto you across the cave: 100 misses from room 1 at a
// wumpus in 13 (adj 12,14,20 — none is room 1) can never eat you
let eaten = 0;
for (let t = 0; t < 100; t++) {
  const e = fresh(); noHazards(e);
  e.vars.wumpus = 13; e.step();
  e.fireClick(386, 254); e.step();
  clickRoom(e, 2);
  if (e.vars.game === 2) eaten++;
  if (![13, 12, 14, 20].includes(e.vars.wumpus)) { eaten = 999; break; }
}
check("100 misses: wumpus always moves along real tunnels", eaten === 0);

// soak: random full hunts — click random rooms + the mode button
let errs = 0, finished = 0;
for (let g = 0; g < 40; g++) {
  const e = fresh();
  for (let i = 0; i < 400 && e.vars.game === 0; i++) {
    if (i % 7 === 3) e.fireClick(386, 254);
    const n = 1 + Math.floor(Math.random() * 20);
    e.fireClick(room(e, n).x, room(e, n).y);
    e.step();
  }
  if (e.errors.length) errs++;
  if (e.vars.game !== 0) finished++;
}
check("40 random hunts: no script errors", errs === 0);
check("hunts actually end (pits, bats, wumpus or arrows)", finished > 25);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

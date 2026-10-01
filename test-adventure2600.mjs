// Headless test: Adventure (1979) — rooms that flip like cards, one pair of
// hands, two gates, three dragons, the sword, the chalice coming home, and
// the invisible dot that opens a wall.
import { Engine } from "./js/engine.js";
import { buildAdventure2600Example } from "./studio/example-adventure2600.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildAdventure2600Example().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 222); e.step(); };
const hero = (e) => e.byName.hero;
const put = (e, room, x, y) => { e.vars.room = room; hero(e).x = x; hero(e).y = y; };
// park every dragon far from the action
const benchDragons = (e) => { for (let d = 1; d <= 3; d++) e.vars["d" + d + "room"] = 99; };
const walk = (e, key, n) => { e.keys[key] = true; for (let i = 0; i < n; i++) e.step(); e.keys[key] = false; };
const drop = (e) => { e.keys["Space"] = true; e.step(); e.keys["Space"] = false; e.step(); };

console.log("Adventure (1979):");
{
  const ex = buildAdventure2600Example();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick, and it walks the HERO", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "HERO"));
  check("the hero is a SQUARE — the most famous square in games",
    ex.objects.some(o => o.name === "hero" && o.type === "box"));
  check("the dot is in the world… and all but invisible",
    ex.objects.some(o => o.name === "thedot" && o.size === 2));
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin starts the quest at the gold castle, three lives",
    e.vars.game === 0 && e.vars.room === 0 && e.vars.lives === 3 && e.vars.carry === 0);
}

console.log("Rooms flip like cards:");
{
  const e = fresh();
  play(e);
  benchDragons(e);
  const c0 = e.vars.roomc;
  walk(e, "d", 95);                        // east out of the gold castle yard
  check("walking off the east edge lands in the meadow", e.vars.room === 1 && hero(e).x < 60);
  check("…and the walls change color with the room", e.vars.roomc !== c0
    && String(e.byName.roomtx.text).includes("MEADOW"));
  // a wall is a wall
  put(e, 1, 240, 40);
  walk(e, "w", 30);                        // north has no exit here
  check("a wall is a wall — the hero cannot leave through it", e.vars.room === 1 && hero(e).y >= 26);
  // exits are GAPS, not open edges
  put(e, 1, 440, 60);
  walk(e, "d", 20);                        // east exit exists, but the gap is at mid-wall
  check("…and an exit is a GAP: the wall holds outside it", e.vars.room === 1 && hero(e).x <= 454);
}

console.log("One pair of hands:");
{
  const e = fresh();
  play(e);
  benchDragons(e);
  put(e, 1, 120, 230);                     // the sword lies at (120, 260)
  walk(e, "s", 14);
  check("touching the sword picks it up", e.vars.carry === 3
    && String(e.byName.carrytx.text).includes("SWORD"));
  put(e, 4, 360, 250);                     // gold key at (360, 280)
  walk(e, "s", 14);
  check("hands full — a second item will NOT come along", e.vars.carry === 3);
  walk(e, "w", 8);                         // step off the key first
  drop(e);
  check("SPACE drops the sword where you stand", e.vars.carry === 0 && e.lists.ir[3] === 4);
  walk(e, "s", 10);
  check("…freeing the hands for the key", e.vars.carry === 1);
}

console.log("Keys, gates, castles:");
{
  const e = fresh();
  play(e);
  benchDragons(e);
  e.vars.carry = 1;                        // gold key in hand
  put(e, 0, 240, 80);
  const sc0 = e.vars.score;
  walk(e, "w", 12);
  check("the gold key raises the gold gate (+50)", e.vars.ggate === 1 && e.vars.score === sc0 + 50
    && e.byName.goldgate.visible === 0);
  walk(e, "w", 30);
  check("…and the doorway now leads INSIDE", e.vars.room === 9
    && String(e.byName.roomtx.text).includes("INSIDE THE GOLD"));
  walk(e, "s", 40);
  check("south brings you back out", e.vars.room === 0);
  // wrong key does nothing
  const e2 = fresh();
  play(e2);
  benchDragons(e2);
  e2.vars.carry = 1;                       // GOLD key at the BLACK gate
  put(e2, 2, 240, 80);
  walk(e2, "w", 12);
  check("the gold key does NOT move the black gate", e2.vars.bgate === 0);
}

console.log("Three dragons, one sword:");
{
  const e = fresh();
  play(e);
  put(e, 1, 240, 120);                     // yellow dragon's meadow, no sword
  e.byName.dragon1.x = 300; e.byName.dragon1.y = 120;
  const d0 = Math.abs(e.byName.dragon1.x - hero(e).x);
  for (let i = 0; i < 10; i++) e.step();
  check("a dragon CHASES", Math.abs(e.byName.dragon1.x - hero(e).x) < d0);
  for (let i = 0; i < 60 && e.vars.lives === 3; i++) e.step();
  check("…and swallows the unarmed (a life, and back to the castle)",
    e.vars.lives === 2 && e.vars.room === 0);
  // the sword settles it
  const e2 = fresh();
  play(e2);
  e2.vars.carry = 3;                       // sword in hand
  put(e2, 1, 240, 120);
  e2.byName.dragon1.x = 320; e2.byName.dragon1.y = 120;
  const sc = e2.vars.score;
  for (let i = 0; i < 60 && !e2.vars.d1dead; i++) e2.step();
  check("a dragon that charges the SWORD dies (+100)", e2.vars.d1dead === 1
    && e2.vars.score === sc + 100 && e2.vars.lives === 3);
  e2.step();
  check("…and floats belly-up, out of the game", e2.byName.dragon1.text === "~");
  // a DROPPED sword guards its room too
  const e3 = fresh();
  play(e3);
  put(e3, 1, 100, 300);
  e3.lists.ir[3] = 1; e3.lists.ixx[3] = 320; e3.lists.iyy[3] = 120;   // sword lying in the room
  e3.byName.dragon1.x = 330; e3.byName.dragon1.y = 128;
  e3.step(); e3.step(); e3.step();
  check("even a sword lying on the ground bites", e3.vars.d1dead === 1);
  // three lives, then the belly is forever
  const e4 = fresh();
  play(e4);
  for (let k = 0; k < 3; k++) {
    put(e4, 1, 240, 120);
    e4.byName.dragon1.x = 244; e4.byName.dragon1.y = 120;
    for (let i = 0; i < 30 && e4.vars.game === 0 && e4.vars.room === 1; i++) e4.step();
  }
  check("the third swallow ends the quest (endplay + ★ table)", e4.vars.game === 2
    && Number(e4.vars.endplay) === 1 && String(e4.byName.status.text).includes("GAME OVER"));
  e4.fireClick(10, 10); e4.step();
  check("a click after game over returns to attract", e4.vars.game === 9);
}

console.log("The chalice comes home:");
{
  const e = fresh();
  play(e);
  benchDragons(e);
  // black key opens the black castle
  e.vars.carry = 2;
  put(e, 2, 240, 80);
  walk(e, "w", 12);
  check("the black key raises the black gate", e.vars.bgate === 1);
  walk(e, "w", 30);
  check("inside the black castle — where the chalice waits", e.vars.room === 10);
  drop(e);                                 // free the hands
  put(e, 10, 240, 100);                    // chalice at (240, 120)
  const sc0 = e.vars.score;
  walk(e, "s", 10);
  check("the chalice! (+200, once — no pick-and-drop farming)", e.vars.carry === 4 && e.vars.score === sc0 + 200);
  const scKeep = e.vars.score;
  drop(e); walk(e, "d", 7); e.step();
  check("…drop and re-take pays nothing extra", e.vars.carry === 4 && e.vars.score === scKeep);
  // carry it home: into the gold castle
  e.vars.ggate = 1;
  put(e, 0, 240, 60);
  const scBefore = e.vars.score, livesLeft = e.vars.lives;
  walk(e, "w", 25);
  check("the chalice inside the gold castle WINS the quest",
    e.vars.game === 2 && Number(e.vars.endplay) === 1
    && String(e.byName.status.text).includes("CHALICE IS HOME"));
  check("victory pays 1000 plus 200 a life", e.vars.score === scBefore + 1000 + livesLeft * 200);
}

console.log("The egg:");
{
  const e = fresh();
  play(e);
  benchDragons(e);
  // the catacombs' east wall is a WALL…
  put(e, 5, 440, 180);
  walk(e, "d", 20);
  check("the catacombs' east wall holds — empty-handed", e.vars.room === 5 && hero(e).x <= 454);
  // …until you carry the dot
  put(e, 10, 452, 60);                     // the dot hides at (452, 40)
  walk(e, "w", 10);
  check("the invisible dot CAN be found by touch", e.vars.carry === 5
    && String(e.byName.carrytx.text).includes("SOMETHING"));
  put(e, 5, 440, 180);
  const sc0 = e.vars.score;
  walk(e, "d", 20);
  check("with the dot, the wall is a DOOR", e.vars.room === 11);
  check("the secret room pays +500 and tells its story", e.vars.score === sc0 + 500
    && e.vars.eggfound === 1 && e.byName.eggtext1.visible === 1);
  put(e, 11, 440, 180);
  walk(e, "d", 20);
  const sc1 = e.vars.score;
  check("…but only pays once", e.vars.score === sc1);
  walk(e, "a", 200);
  check("west leads back out of the secret", e.vars.room === 5);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

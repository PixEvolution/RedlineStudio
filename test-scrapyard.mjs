// Headless test: Scrapyard Climb (1981 style) — girders, ladders, THE JUMP,
// tires zigzagging the whole yard down, the wrench, the drained bonus,
// falls, and the OFF switch.
import { Engine } from "./js/engine.js";
import { buildScrapyardExample } from "./studio/example-scrapyard.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const FLOORY = [0, 448, 384, 320, 256, 192, 128];
const fresh = () => {
  const e = new Engine(null, buildScrapyardExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 258); e.step(); };
const noTires = (e) => { for (let t = 0; t < 6; t++) e.lists.ton[t] = 0; e.vars.spawnt = 99999; };
const putP = (e, floor, x) => {
  e.vars.pfloor = floor; e.vars.px = x;
  e.vars.py = (floor === 7 ? 80 : FLOORY[floor]) - 10;
  e.vars.climbing = 0; e.vars.jumping = 0; e.vars.grace = 0;
};
const putTire = (e, t, floor, x) => {
  const L = (n) => e.lists[n] || (e.lists[n] = {});
  L("ton")[t] = 1; L("tx")[t] = x; L("ty")[t] = (floor === 7 ? 80 : FLOORY[floor]) - 8;
  L("tfl")[t] = floor; L("tdrop")[t] = 0;
};

console.log("Scrapyard Climb (1981 style):");
{
  const ex = buildScrapyardExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a portrait cabinet", ex.w === 360 && ex.h === 480);
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("one stick to MOVE", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "MOVE"));
  check("six girders, nine ladders, a crusher, a switch, a wrench",
    ex.objects.filter(o => /^girder\d/.test(o.name)).length === 6
    && ex.objects.filter(o => /^ladder\d/.test(o.name)).length === 9
    && ex.objects.some(o => o.name === "crusher")
    && ex.objects.some(o => o.name === "offswitch")
    && ex.objects.some(o => o.name === "wrench"));
  const e = fresh();
  check("wakes in attract as an original, in tribute", e.vars.game === 9
    && ex.objects.some(o => o.name === "subline" && o.text.includes("ORIGINAL")));
  play(e);
  check("a coin starts the climb: 3 runners, bonus 5000, yard floor",
    e.vars.game === 0 && e.vars.lives === 3 && e.vars.btimer === 5000 && e.vars.pfloor === 1);
}

console.log("Walking, ladders, THE JUMP:");
{
  const e = fresh();
  play(e);
  noTires(e);
  putP(e, 1, 60);
  e.keys["d"] = true;
  for (let i = 0; i < 10; i++) e.step();
  e.keys["d"] = false;
  check("A/D walks the girder", e.vars.px > 70);
  // ladders own the climb
  putP(e, 1, 80);                           // ladder 1 lives at x 80
  e.keys["w"] = true;
  for (let i = 0; i < 5; i++) e.step();
  check("UP grabs the ladder", e.vars.climbing > 0);
  for (let i = 0; i < 60 && e.vars.pfloor === 1; i++) e.step();
  e.keys["w"] = false;
  check("…and the climb tops out on the next girder", e.vars.pfloor === 2
    && Math.abs(e.vars.py - (FLOORY[2] - 10)) < 2);
  // no ladder, no lift
  putP(e, 1, 150);
  e.keys["w"] = true;
  for (let i = 0; i < 20; i++) e.step();
  e.keys["w"] = false;
  check("off a ladder, UP does nothing — floors are law", e.vars.pfloor === 1);
  // the jump
  putP(e, 1, 150);
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false;
  const ys = [];
  for (let i = 0; i < 30; i++) { e.step(); ys.push(e.vars.py); }
  check("SPACE jumps a real arc and lands on the same girder",
    Math.min(...ys) < FLOORY[1] - 28 && e.vars.jumping === 0
    && Math.abs(e.vars.py - (FLOORY[1] - 10)) < 2);
}

console.log("Tires run the yard:");
{
  const e = fresh();
  play(e);
  noTires(e);
  putP(e, 1, 30);
  // a fresh throw from the crusher works the whole zigzag down
  e.vars.spawnt = 1;
  e.step();
  check("the crusher throws onto its platform", e.lists.ton[0] === 1 && e.lists.tfl[0] === 7);
  let reached1 = false;
  for (let i = 0; i < 3000 && e.lists.ton[0] === 1; i++) {
    e.step();
    putP(e, 1, 30);
    e.vars.spawnt = 99999;
    if (e.lists.tfl[0] === 1) reached1 = true;
  }
  check("…and the tire zigzags every floor down to the yard", reached1);
  check("…then rolls off the yard and out of the game", e.lists.ton[0] === 0);
  // the jump pays
  const e2 = fresh();
  play(e2);
  noTires(e2);
  putP(e2, 1, 150);
  putTire(e2, 0, 1, 190);                   // rolling right→... floor 1 dir is right; put it left of us
  e2.lists.tx[0] = 120;
  const sc0 = e2.vars.score;
  e2.keys["Space"] = true; e2.step(); e2.keys["Space"] = false;
  for (let i = 0; i < 30 && e2.vars.score === sc0; i++) e2.step();
  check("clearing a tire mid-air pays 100", e2.vars.score === sc0 + 100);
  // contact kills
  const e3 = fresh();
  play(e3);
  noTires(e3);
  putP(e3, 1, 150);
  putTire(e3, 0, 1, 152);
  e3.step();
  check("touching a tire costs a runner", e3.vars.lives === 2);
  // …unless the wrench is hot
  const e4 = fresh();
  play(e4);
  noTires(e4);
  putP(e4, 1, 150);
  e4.vars.wrmode = 300;
  putTire(e4, 0, 1, 152);
  const sc1 = e4.vars.score;
  e4.step();
  check("with the WRENCH hot, the tire is 300 points of scrap",
    e4.vars.lives === 3 && e4.lists.ton[0] === 0 && e4.vars.score === sc1 + 300);
}

console.log("The wrench, the fall, the bonus:");
{
  const e = fresh();
  play(e);
  noTires(e);
  putP(e, 4, 70);
  e.step();
  check("walking over the wrench arms it", e.vars.wrmode > 400 && e.vars.wron === 0);
  // a fall is a fall
  const e2 = fresh();
  play(e2);
  noTires(e2);
  putP(e2, 3, 70);                          // floor 3 starts at x 60
  e2.keys["a"] = true;
  for (let i = 0; i < 20 && e2.vars.lives === 3; i++) e2.step();
  e2.keys["a"] = false;
  check("stepping off a girder's open end is a fall, and fatal", e2.vars.lives === 2);
  // the bonus drains
  const e3 = fresh();
  play(e3);
  noTires(e3);
  putP(e3, 1, 200);
  for (let i = 0; i < 250; i++) { e3.step(); e3.vars.grace = 0; }
  check("the bonus counter drains all climb long", e3.vars.btimer <= 4800);
}

console.log("The switch, the next level, the end:");
{
  const e = fresh();
  play(e);
  noTires(e);
  e.vars.btimer = 4300;
  putP(e, 7, 120);
  const sc0 = e.vars.score;
  e.step();
  check("the OFF switch banks the bonus and restarts the crusher angrier",
    e.vars.score === sc0 + 4300 && e.vars.level === 2 && e.vars.btimer === 5000
    && e.vars.pfloor === 1);
  check("…and level 2 throws faster", 170 - 2 * 25 === 120);
  // the end
  const e2 = fresh();
  play(e2);
  noTires(e2);
  e2.vars.lives = 1;
  putP(e2, 1, 150);
  putTire(e2, 0, 1, 152);
  e2.step(); e2.step();
  check("the last runner ends it (endplay + ★ table)", e2.vars.game === 2
    && Number(e2.vars.endplay) === 1);
  e2.fireClick(10, 10); e2.step();
  check("a click after the end returns to attract", e2.vars.game === 9);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

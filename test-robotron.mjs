// Headless test: Robotron: 2084 (1982) — the twin-stick template.
// Two independent sticks, grunt tides, electrodes (and grunts blundering
// into them), unkillable hulks that push and crush, spheroids hatching
// enforcers, the escalating family rescue, wave deals, and both endings.
import { Engine } from "./js/engine.js";
import { buildRobotronExample } from "./studio/example-robotron.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildRobotronExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 208); e.step(); };
const L = (eng, n) => eng.lists[n] || (eng.lists[n] = {});
const calm = (e) => {
  for (let i = 0; i < 24; i++) L(e, "gon")[i] = 0;
  for (let i = 0; i < 8; i++) L(e, "elon")[i] = 0;
  for (let k = 0; k < 4; k++) L(e, "hon")[k] = 0;
  for (let k = 0; k < 2; k++) L(e, "spon")[k] = 0;
  for (let f = 0; f < 3; f++) L(e, "efon")[f] = 0;
  for (let h = 0; h < 3; h++) L(e, "huon")[h] = 0;
  e.vars.gleft = 99; e.vars.grace = 0;      // keep the wave from "clearing"
};

console.log("Robotron: 2084 (1982):");

// ---- the cabinet: a TRUE twin-stick
{
  const ex = buildRobotronExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("titled Robotron: 2084 (1982)", ex.title === "Robotron: 2084 (1982)");
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("TWO sticks on the panel — run and fire", JSON.stringify(eng.usedSticks()) === "[1,2]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "RUN")
    && ex.objects.some(o => o.name === "stick2tag" && o.text === "FIRE"));
  const keys = eng.usedKeys();
  check("WASD runs, arrows fire", ["w", "a", "s", "d", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].every(k => keys.includes(k)));
}

// ---- the sticks never have to agree
{
  const e = fresh(); play(e); calm(e);
  e.keys["d"] = true; e.keys["ArrowLeft"] = true;   // run east, fire west
  e.step(); e.step();
  const shot = [0, 1, 2, 3].find(s => L(e, "son")[s] === 1);
  check("run east while firing west", e.vars.px > 240 && shot !== undefined && L(e, "svx")[shot] < 0);
  e.keys["d"] = false; e.keys["ArrowLeft"] = false;
  // 8-way: diagonal fire
  e.vars.cool = 0;
  for (let s = 0; s < 4; s++) L(e, "son")[s] = 0;
  e.keys["ArrowDown"] = true; e.keys["ArrowRight"] = true;
  e.step();
  e.keys["ArrowDown"] = false; e.keys["ArrowRight"] = false;
  const d = [0, 1, 2, 3].find(s => L(e, "son")[s] === 1);
  check("diagonals fire diagonally", d !== undefined && L(e, "svx")[d] > 0 && L(e, "svy")[d] > 0);
}

// ---- grunts: the tide, 100 a head, and the electrode blunder
{
  const e = fresh(); play(e);
  check("wave 1 pours in 11 grunts (minus any instant electrode blunders)", e.vars.gcount === 11 && e.vars.gleft >= 8 && e.vars.gleft <= 11);
  calm(e);
  e.vars.gleft = 2;
  L(e, "gon")[0] = 1; L(e, "gx")[0] = 400; L(e, "gy")[0] = 194;
  const d0 = Math.abs(L(e, "gx")[0] - e.vars.px);
  for (let i = 0; i < 80; i++) e.step();
  check("grunts converge on the last man", Math.abs(L(e, "gx")[0] - e.vars.px) < d0 - 25);
  // shoot it
  L(e, "gx")[0] = e.vars.px + 60; L(e, "gy")[0] = e.vars.py;
  const sc0 = e.vars.score;
  e.keys["ArrowRight"] = true;
  for (let i = 0; i < 14; i++) e.step();
  e.keys["ArrowRight"] = false;
  check("a grunt falls for 100", L(e, "gon")[0] === 0 && e.vars.score >= sc0 + 100 && e.vars.gleft === 1);
  // the blunder: a grunt walks into an electrode — both die, you get paid
  e.vars.gleft = 50;                       // keep the wave from clearing mid-test
  L(e, "gon")[1] = 1; L(e, "gx")[1] = 100; L(e, "gy")[1] = 100;
  L(e, "elon")[0] = 1; L(e, "elx")[0] = 108; L(e, "ely")[0] = 100;
  e.vars.px = 300; e.vars.py = 100;
  const sc1 = e.vars.score;
  for (let i = 0; i < 30; i++) e.step();
  check("a grunt blunders into an electrode — both die, you get the 100",
    L(e, "gon")[1] === 0 && L(e, "elon")[0] === 0 && e.vars.score === sc1 + 100);
}

// ---- electrodes: shootable, lethal
{
  const e = fresh(); play(e); calm(e);
  L(e, "elon")[0] = 1; L(e, "elx")[0] = e.vars.px + 50; L(e, "ely")[0] = e.vars.py;
  e.keys["ArrowRight"] = true;
  for (let i = 0; i < 12; i++) e.step();
  e.keys["ArrowRight"] = false;
  check("your shot clears an electrode (for nothing)", L(e, "elon")[0] === 0);
  const e2 = fresh(); play(e2); calm(e2);
  L(e2, "elon")[0] = 1; L(e2, "elx")[0] = e2.vars.px; L(e2, "ely")[0] = e2.vars.py;
  const l0 = e2.vars.lives;
  e2.step();
  check("touching one costs a last man", e2.vars.lives === l0 - 1);
}

// ---- hulks: unkillable, pushable, murderous
{
  const e = fresh(); play(e); calm(e);
  L(e, "hon")[0] = 1; L(e, "hx")[0] = e.vars.px + 60; L(e, "hy")[0] = e.vars.py;
  const hx0 = L(e, "hx")[0];
  e.keys["ArrowRight"] = true;
  for (let i = 0; i < 30; i++) e.step();
  e.keys["ArrowRight"] = false;
  check("shots cannot kill a hulk", L(e, "hon")[0] === 1);
  check("…but they PUSH it back", L(e, "hx")[0] > hx0 + 4);
  // it walks to the nearest human and crushes them
  const e2 = fresh(); play(e2); calm(e2);
  e2.vars.px = 60; e2.vars.py = 60;
  L(e2, "hon")[0] = 1; L(e2, "hx")[0] = 300; L(e2, "hy")[0] = 200;
  L(e2, "huon")[0] = 1; L(e2, "hux")[0] = 330; L(e2, "huy")[0] = 200;
  L(e2, "hut")[0] = 99999; L(e2, "huvx")[0] = 0; L(e2, "huvy")[0] = 0;
  for (let i = 0; i < 160; i++) e2.step();
  check("a hulk walks down the family and crushes them", L(e2, "huon")[0] === 0);
  const e3 = fresh(); play(e3); calm(e3);
  L(e3, "hon")[0] = 1; L(e3, "hx")[0] = e3.vars.px; L(e3, "hy")[0] = e3.vars.py;
  const l3 = e3.vars.lives;
  e3.step();
  check("…and crushes you the same", e3.vars.lives === l3 - 1);
}

// ---- spheroids hatch enforcers; both pay
{
  const e = fresh(); play(e); calm(e);
  L(e, "spon")[0] = 1; L(e, "spx")[0] = 100; L(e, "spy")[0] = 100;
  L(e, "spt")[0] = 2; L(e, "spk")[0] = 0;
  L(e, "spvx")[0] = 0; L(e, "spvy")[0] = 0;
  e.vars.px = 400; e.vars.py = 300;
  for (let i = 0; i < 10; i++) e.step();
  check("a spheroid hatches an ENFORCER", [0, 1, 2].some(f => L(e, "efon")[f] === 1));
  const sc0 = e.vars.score;
  L(e, "spx")[0] = e.vars.px + 50; L(e, "spy")[0] = e.vars.py;
  L(e, "spvx")[0] = 0; L(e, "spvy")[0] = 0;
  e.keys["ArrowRight"] = true;
  for (let i = 0; i < 12; i++) e.step();
  e.keys["ArrowRight"] = false;
  check("bursting the spheroid pays 1000", L(e, "spon")[0] === 0 && e.vars.score >= sc0 + 1000);
  // enforcer shoots back
  const e2 = fresh(); play(e2); calm(e2);
  L(e2, "efon")[0] = 1; L(e2, "efx")[0] = 150; L(e2, "efy")[0] = 150;
  L(e2, "eft2")[0] = 1;
  e2.vars.px = 350; e2.vars.py = 250;
  e2.step(); e2.step();
  check("enforcers fire aimed shots", [0, 1, 2].some(s => L(e2, "eson")[s] === 1));
  const l2 = e2.vars.lives;
  L(e2, "eson")[0] = 1; L(e2, "esx")[0] = e2.vars.px; L(e2, "esy")[0] = e2.vars.py;
  L(e2, "esvx")[0] = 0; L(e2, "esvy")[0] = 0;
  e2.step();
  check("a robot shot costs a last man", e2.vars.lives === l2 - 1);
}

// ---- the family: 1000, 2000, 3000... and the chain dies with you
{
  const e = fresh(); play(e); calm(e);
  const sc0 = e.vars.score;
  for (let h = 0; h < 3; h++) {
    L(e, "huon")[h] = 1; L(e, "hux")[h] = e.vars.px; L(e, "huy")[h] = e.vars.py;
    L(e, "hut")[h] = 99999; L(e, "huvx")[h] = 0; L(e, "huvy")[h] = 0;
    e.step();
  }
  check("three rescues pay 1000 + 2000 + 3000", e.vars.score === sc0 + 6000 && e.vars.chain === 3);
  // death resets the chain
  L(e, "elon")[0] = 1; L(e, "elx")[0] = e.vars.px; L(e, "ely")[0] = e.vars.py;
  e.vars.grace = 0;
  e.step();
  check("the chain dies with you", e.vars.chain === 0 && e.vars.lives === 2);
}

// ---- waves and endings
{
  const e = fresh(); play(e); calm(e);
  e.vars.gleft = 0;
  e.step();
  check("all killable robots down: wave 2 pours in", e.vars.wave === 2 && e.vars.gleft === 14);
  check("wave 2 brings the first HULKS", [0, 1, 2, 3].filter(k => e.lists.hon[k] === 1).length === 2);
  // death repositions the living, keeps the dead dead
  const alive0 = [...Array(24).keys()].filter(i => e.lists.gon[i] === 1).length;
  e.lists.gon[0] = 0; e.vars.gleft = e.vars.gleft - 1;
  L(e, "elon")[0] = 1; L(e, "elx")[0] = e.vars.px; L(e, "ely")[0] = e.vars.py;
  e.vars.grace = 0;
  e.step();
  const alive1 = [...Array(24).keys()].filter(i => e.lists.gon[i] === 1).length;
  // regrouped grunts can land on electrodes and blunder — allow a few casualties
  check("a death regroups the living — the dead stay dead", alive1 <= alive0 - 1 && alive1 >= alive0 - 5 && e.vars.px === 240);
  const e2 = fresh(); play(e2); calm(e2);
  e2.vars.lives = 1;
  L(e2, "elon")[0] = 1; L(e2, "elx")[0] = e2.vars.px; L(e2, "ely")[0] = e2.vars.py;
  e2.step();
  check("the last last man: 2084 belongs to the robots", e2.vars.game === 2 && e2.vars.endplay === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// Headless test: Gotcha (1973) — the moving maze, the chase, the catch,
// the timed quarter, the arcade contract — plus the new deaf attract mode.
import { Engine } from "./js/engine.js";
import { buildGotchaExample } from "./studio/example-gotcha.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const start1P = (e) => { e.fireClick(168, 262); e.step(); };
const start2P = (e) => { e.fireClick(315, 262); e.step(); };
const ch = (e) => e.byName.chaser;
const rn = (e) => e.byName.runner;
const parkWalls = (e) => { for (let i = 1; i <= 30; i++) e.byName["w" + i].y = -100; };

console.log("Gotcha (1973):");
let eng = new Engine(null, buildGotchaExample().objects);
check("compiles with zero errors", eng.errors.length === 0);
if (eng.errors.length) console.log(eng.errors.slice(0, 6));
eng.runEvents("start"); eng.step();
check("opens in attract mode", eng.vars.game === 9 && Number(eng.byName.bigtitle.visible) === 1);
check("players hidden in attract", Number(ch(eng).visible) === 0 && Number(rn(eng).visible) === 0);
const wx = eng.byName.w1.x;
for (let i = 0; i < 30; i++) eng.step();
check("the maze moves in attract (live reel)", eng.byName.w1.x !== wx);

// mode select
start2P(eng);
check("[2 PLAYERS] starts the chase", eng.vars.game === 0 && eng.vars.mode === 2 && eng.vars.timeleft > 0);
check("HUD shows, attract hides", Number(eng.byName.scoretx.visible) === 1 && Number(eng.byName.bigtitle.visible) === 0);
eng.step();
check("clock reads in seconds", String(eng.byName.timetx.text).startsWith("TIME 59") || String(eng.byName.timetx.text).startsWith("TIME 60"));

// chaser WASD, runner arrows
parkWalls(eng);
const cx = ch(eng).x, cy = ch(eng).y;
eng.keys["d"] = true; eng.keys["w"] = true;
for (let i = 0; i < 10; i++) { parkWalls(eng); eng.step(); }
eng.keys["d"] = false; eng.keys["w"] = false;
check("WASD drives the chaser", ch(eng).x > cx && ch(eng).y < cy);
const rx = rn(eng).x;
eng.keys["ArrowLeft"] = true;
for (let i = 0; i < 10; i++) { parkWalls(eng); eng.step(); }
eng.keys["ArrowLeft"] = false;
check("arrows drive the runner", rn(eng).x < rx);

// the moving maze blocks you
parkWalls(eng);
ch(eng).x = 200; ch(eng).y = 185;
eng.byName.w1.x = 216; eng.byName.w1.y = 185;      // wall dead ahead
eng.byName.w1.script = [];                          // (park this one for the test)
eng.keys["d"] = true;
for (let i = 0; i < 15; i++) {
  for (let j = 2; j <= 30; j++) eng.byName["w" + j].y = -100;
  eng.byName.w1.x = 216; eng.byName.w1.y = 185;
  eng.step();
}
eng.keys["d"] = false;
check("a wall stops the chaser cold", ch(eng).x < 205);

// THE CATCH
parkWalls(eng);
ch(eng).x = 240; ch(eng).y = 200; rn(eng).x = 250; rn(eng).y = 200;
eng.step();
check("GOTCHA — catch scores a point", eng.vars.catches === 1);
check("the catch plays the two-tone GOTCHA", eng.beeps.some(b => b.freq === 523) && eng.beeps.some(b => b.freq === 784));
check("both reset to their corners", ch(eng).x === 60 && rn(eng).x === 420);
check("scoreboard updates", String(eng.byName.scoretx.text) === "CATCHES 1");

// time up → arcade contract
eng.vars.catches = 4; eng.vars.timeleft = 2;
for (let i = 0; i < 4; i++) { parkWalls(eng); eng.step(); }
check("time up ends the game", eng.vars.game === 2);
check("time up announced (the HUD already shows the catches)",
  String(eng.byName.status.text).includes("TIME UP") && String(eng.byName.scoretx.text).includes("CATCHES 4"));
check("endplay fires — the next chase costs a coin", eng.vars.endplay === 1);
eng.fireClick(240, 180); eng.step();
check("click returns to attract", eng.vars.game === 9 && Number(eng.byName.bigtitle.visible) === 1);

// 1P: the machine flees
eng = new Engine(null, buildGotchaExample().objects);
eng.runEvents("start"); eng.step(); start1P(eng);
check("[1 PLAYER] sets machine mode", eng.vars.mode === 1);
parkWalls(eng);
rn(eng).x = 240; rn(eng).y = 190; ch(eng).x = 200; ch(eng).y = 190;   // chaser closing from the left
let fled = 0;
for (let i = 0; i < 20; i++) { parkWalls(eng); ch(eng).x = rn(eng).x - 40; ch(eng).y = rn(eng).y; eng.step(); }
check("the machine runs away from the chaser", rn(eng).x > 260);
ch(eng).x = 60; ch(eng).y = 310;                    // chaser far away
rn(eng).x = 430; rn(eng).y = 70;
for (let i = 0; i < 60; i++) { parkWalls(eng); ch(eng).x = 60; ch(eng).y = 310; eng.step(); }
check("when safe, it drifts back toward open ground", rn(eng).x < 420 && rn(eng).y > 80);

// arcade marquee
eng = new Engine(null, buildGotchaExample().objects);
eng.vars.arcade = 1;
eng.runEvents("start"); eng.step();
check("arcade marquee says COIN ACCEPTED", String(eng.byName.coinline.text).includes("COIN ACCEPTED"));
start2P(eng);
check("fresh play clears endplay", eng.vars.endplay === 0);

// ATTRACT MODE IS DEAF: an { input: false } engine binds nothing —
// headless proof: keys forced in still can't matter because a live card in
// the browser never receives them. Here we verify the option exists and
// the engine runs normally with it.
eng = new Engine(null, buildGotchaExample().objects, { input: false });
check("attract engines flag input disabled", eng.inputEnabled === false);
eng.runEvents("start");
for (let i = 0; i < 30; i++) eng.step();
check("deaf engine still runs the live reel", eng.errors.length === 0 && eng.vars.game === 9);
eng = new Engine(null, buildGotchaExample().objects);
check("normal engines keep input on", eng.inputEnabled === true);

// soak: a full 1P timed chase, walls live, random chaser input
eng = new Engine(null, buildGotchaExample().objects);
eng.runEvents("start"); eng.step(); start1P(eng);
const keys = ["w", "a", "s", "d"];
let ticks = 0;
while (eng.vars.game === 0 && ticks < 4500) {
  if (ticks % 9 === 0) { const k = keys[Math.floor(Math.random() * keys.length)]; eng.keys[k] = !eng.keys[k]; }
  eng.step(); ticks++;
}
check("full chase runs to time with no script errors", eng.errors.length === 0 && eng.vars.game === 2);
check("chase length matches the timer (~3600 ticks)", ticks >= 3590 && ticks <= 3610);
check("players stayed inside the field", ch(eng).x >= 14 && ch(eng).x <= 466 && rn(eng).y >= 56 && rn(eng).y <= 332);
check("all 8 movement keys detected for touch/gamepad",
  ["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].every(k => eng.usedKeys().includes(k)));

console.log("Joysticks — Gotcha was a joystick game:");
{
  const e = new Engine(null, buildGotchaExample().objects);
  e.runEvents("start"); e.step(); start1P(e); parkWalls(e);
  rn(e).x = 420; rn(e).y = 320;   // keep the catch out of the measurement
  const x0 = ch(e).x;
  e.keys["d"] = true; e.step(); e.keys["d"] = false;
  const keyMove = ch(e).x - x0;
  const x1 = ch(e).x;
  parkWalls(e);
  e.setStick(1, 1, 0); e.step(); e.clearStick(1);
  check("full stick = the D key, exactly",
    Math.abs((ch(e).x - x1) - keyMove) < 1e-9 && keyMove > 0);
  const x2 = ch(e).x;
  parkWalls(e);
  e.setStick(1, 0.5, 0); e.step(); e.clearStick(1);
  check("half a push creeps at half speed",
    Math.abs((ch(e).x - x2) - keyMove / 2) < 1e-9);
}
{
  const e = new Engine(null, buildGotchaExample().objects);
  e.runEvents("start"); e.step(); start2P(e); parkWalls(e);
  const x0 = rn(e).x;
  e.setStick(2, 1, 0); e.step(); e.clearStick(2);
  check("the runner answers stick 2", rn(e).x > x0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

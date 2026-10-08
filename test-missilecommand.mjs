// Headless test: Missile Command (1980) — click-to-blossom interception,
// warhead threads, the MIRV fork, silo economics, wave bonuses, the bonus
// city, and THE END.
import { Engine } from "./js/engine.js";
import { buildMissilecommandExample } from "./studio/example-missilecommand.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildMissilecommandExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(240, 214); e.step(); };
const clearSky = (e) => { for (let i = 0; i < 8; i++) e.lists.eon[i] = 0; };
// drop one warhead by hand: slot 0, straight down onto target tg
const drop = (e, x, tg, prog = 50) => {
  const L = (n) => e.lists[n] || (e.lists[n] = {});   // lists are born on first spawn
  L("eon")[0] = 1; L("esx")[0] = x; L("esy")[0] = 0;
  L("etx")[0] = x; L("etg")[0] = tg;
  L("eang")[0] = 90; L("ep")[0] = prog;
  L("espd")[0] = 1; L("esplit")[0] = 0;
};

console.log("Missile Command (1980):");
{
  const ex = buildMissilecommandExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("no keys, no stick — the CLICK is the whole language", eng.usedKeys().length === 0
    && eng.usedSticks().length === 0);
  check("six cities, three silos, eight threads in the sky",
    ex.objects.filter(o => o.name.startsWith("city")).length === 6
    && ex.objects.filter(o => o.name.startsWith("silo")).length === 3
    && ex.objects.filter(o => o.name.startsWith("thread")).length === 8);
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin arms the defense: wave 1, ×1, 10 rounds a silo",
    e.vars.game === 0 && e.vars.wave === 1 && e.vars.mult === 1
    && e.lists.ammo[0] === 10 && e.lists.ammo[1] === 10 && e.lists.ammo[2] === 10);
}

console.log("The sky fills:");
{
  const e = fresh();
  play(e);
  for (let i = 0; i < 120 && !e.lists.eon.some?.(Boolean); i++) e.step();
  let any = 0; for (let i = 0; i < 8; i++) any += e.lists.eon[i] || 0;
  check("warheads start their crawl", any > 0);
  const i0 = [...Array(8).keys()].find(i => e.lists.eon[i] === 1);
  const y0 = e.lists.eyy[i0];
  for (let i = 0; i < 30; i++) e.step();
  check("…downward, on a glowing thread", e.lists.eon[i0] === 0 || e.lists.eyy[i0] > y0);
  check("the thread leans toward its target",
    Math.abs(e.lists.eang[i0] - 90) < 55);
}

console.log("Click to intercept — the blast does the work:");
{
  const e = fresh();
  play(e);
  clearSky(e); e.vars.tospawn = 99;        // keep the wave from ending mid-test
  e.fireClick(240, 150);
  e.step();
  check("the nearest silo answers: centre silo spends a round",
    e.lists.son[0] === 1 && e.lists.ammo[1] === 9 && e.lists.ammo[0] === 10);
  for (let i = 0; i < 40 && !e.lists.xon[0]; i++) e.step();
  check("the interceptor reaches the click and BLOSSOMS there",
    e.lists.xon[0] === 1 && e.lists.xx[0] === 240 && e.lists.xy[0] === 150);
  // a warhead wanders into the blossom
  drop(e, 238, 0, 140);                    // spark around y 140, near the blossom
  const sc0 = e.vars.score;
  for (let i = 0; i < 12 && e.lists.eon[0] === 1; i++) e.step();
  check("a warhead in the blossom dies for 25 × multiplier",
    e.lists.eon[0] === 0 && e.vars.score === sc0 + 25);
  // silo choice: a click on the left flank
  const e2 = fresh();
  play(e2);
  clearSky(e2); e2.vars.tospawn = 99;
  e2.fireClick(60, 120); e2.step();
  check("a flank click is answered by the flank silo", e2.lists.ammo[0] === 9 && e2.lists.ammo[1] === 10);
  // dry silos stay silent
  const e3 = fresh();
  play(e3);
  clearSky(e3); e3.vars.tospawn = 99;
  for (let b = 0; b < 3; b++) e3.lists.ammo[b] = 0;
  e3.fireClick(240, 150); e3.step();
  check("no rounds anywhere — the click goes unanswered",
    e3.lists.son[0] === 0 && String(e3.byName.status.text).includes("NO SHOTS"));
}

console.log("Impacts:");
{
  const e = fresh();
  play(e);
  clearSky(e); e.vars.tospawn = 99;
  drop(e, 210, 2, 320);                    // nearly down, aimed at city 3
  for (let i = 0; i < 20 && e.lists.cal[2] === 1; i++) e.step();
  check("a warhead through the defense takes its city", e.lists.cal[2] === 0
    && String(e.byName.status.text).includes("A CITY IS GONE"));
  e.step();
  check("…the ruin dims on the skyline", e.byName.city3.text === "::");
  for (let x = 0; x < 4; x++) e.lists.xon[x] = 0;   // the city's ground flash would intercept it
  drop(e, 240, 7, 320);                    // aimed at the centre silo
  for (let i = 0; i < 20 && e.lists.bal[1] === 1; i++) e.step();
  check("a hit silo is silent for the wave", e.lists.bal[1] === 0 && e.lists.ammo[1] === 0);
}

console.log("Waves, the bonus city, THE END:");
{
  const e = fresh();
  play(e);
  clearSky(e);
  e.vars.tospawn = 0;
  e.lists.ammo[0] = 4; e.lists.ammo[1] = 0; e.lists.ammo[2] = 0;
  const sc0 = e.vars.score;
  e.step();
  check("a held wave pays 100 a city and 5 a round, times the multiplier",
    e.vars.score === sc0 + 6 * 100 + 4 * 5 && e.vars.wave === 2);
  check("…and the next wave re-arms every silo", e.lists.ammo[1] === 10 && e.lists.bal[1] === 1);
  // the multiplier ladder
  const e2 = fresh();
  play(e2);
  e2.vars.wave = 5;
  clearSky(e2); e2.vars.tospawn = 0;
  e2.step();
  check("wave 6 fights at ×3", e2.vars.wave === 6 && e2.vars.mult === 3);
  // the MIRV forks
  const e3 = fresh();
  play(e3);
  e3.vars.wave = 2; e3.vars.msplits = 0;
  clearSky(e3); e3.vars.tospawn = 99; e3.vars.spawnt = 9999;
  drop(e3, 240, 2, 100);
  e3.lists.esplit[0] = 1;
  let forked = false;
  for (let i = 0; i < 120 && !forked; i++) {
    e3.step();
    for (let k = 1; k < 8; k++) if (e3.lists.eon[k] === 1) forked = true;
  }
  check("from wave 2, a marked warhead FORKS mid-sky", forked && e3.lists.esplit[0] === 0);
  // the bonus city
  const e4 = fresh();
  play(e4);
  clearSky(e4); e4.vars.tospawn = 99;
  e4.lists.cal[4] = 0;
  e4.vars.score = 10005;
  e4.step();
  check("10,000 points rebuild one ruin", e4.lists.cal[4] === 1 && e4.vars.nextcity === 20000
    && String(e4.byName.status.text).includes("BONUS CITY"));
  // THE END
  const e5 = fresh();
  play(e5);
  clearSky(e5); e5.vars.tospawn = 99;
  for (let c = 0; c < 6; c++) e5.lists.cal[c] = 0;
  e5.step(); e5.step();
  check("the sixth city falls: THE END (endplay + ★ table)", e5.vars.game === 2
    && Number(e5.vars.endplay) === 1 && e5.byName.theend.visible === 1
    && e5.byName.theend.text === "THE END");
  e5.fireClick(10, 10); e5.step();
  check("a click after THE END returns to attract", e5.vars.game === 9);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

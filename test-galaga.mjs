// Headless test: Galaga (1981) — entrance flights, the three ranks and their
// prices, two-hit bosses, THE TRACTOR BEAM (capture, carry, rescue, dual
// fighter), the challenging stage, and the two ways a fleet dies.
import { Engine } from "./js/engine.js";
import { buildGalagaExample } from "./studio/example-galaga.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const PY = 430;
const fresh = () => {
  const e = new Engine(null, buildGalagaExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const play = (e) => { e.fireClick(180, 260); e.step(); };
const settleAll = (e) => {
  for (let i = 0; i < 24; i++) {
    e.lists.es[i] = 2; e.lists.pt[i] = 1;
    e.lists.ex[i] = e.lists.sx[i]; e.lists.ey[i] = e.lists.sy[i];
  }
  e.vars.divet = 99999;
};
const clearAll = (e) => { for (let i = 0; i < 24; i++) e.lists.es[i] = 0; e.vars.divet = 99999; };
// one controlled enemy in a known spot (slot set too — settled foes snap to it)
const oneFoe = (e, i, st, x, y) => {
  clearAll(e);
  e.lists.es[i] = st; e.lists.pt[i] = 1;
  e.lists.sx[i] = x; e.lists.sy[i] = y;
  e.lists.ex[i] = x; e.lists.ey[i] = y;
};
// let the foe take its position this tick, then lay a shot right on it
const shootFoe = (e, i) => {
  e.step();
  const L = (n) => e.lists[n] || (e.lists[n] = {});
  L("son")[0] = 1; L("sxx")[0] = e.lists.ex[i]; L("syy")[0] = e.lists.ey[i] + 5;
  e.step();
};

console.log("Galaga (1981):");
{
  const ex = buildGalagaExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("a portrait cabinet with the arcade contract", ex.w === 360 && eng.usesScoreboard());
  check("one stick on the FIGHTER", JSON.stringify(eng.usedSticks()) === "[1]"
    && ex.objects.some(o => o.name === "stick1tag" && o.text === "FIGHTER"));
  check("24 in the convoy: 4 bosses, 8 butterflies, 12 bees — plus beam and captive",
    ex.objects.filter(o => /^foe\d/.test(o.name)).length === 24
    && ex.objects.some(o => o.name === "beam") && ex.objects.some(o => o.name === "captive"));
  const e = fresh();
  check("wakes in attract with the title up", e.vars.game === 9 && e.byName.bigtitle.visible);
  play(e);
  check("a coin launches wave 1: 3 fighters, single ship, no captive",
    e.vars.game === 0 && e.vars.lives === 3 && e.vars.dual === 0 && e.vars.capboss === -1);
}

console.log("Nothing just appears — they FLY IN:");
{
  const e = fresh();
  play(e);
  check("the wave starts as entrance flights, staggered", e.lists.es[0] === 1
    && e.lists.pt[23] < 0);
  let settled = 0;
  for (let i = 0; i < 1400 && settled < 24; i++) {
    e.vars.divet = 999999;                 // hold the dives so the whole convoy can seat
    e.step();
    settled = 0;
    for (let k = 0; k < 24; k++) if (e.lists.es[k] === 2) settled++;
  }
  check("…and every one of the 24 loops in and settles into its slot", settled === 24);
  const x0 = e.lists.ex[10];
  for (let i = 0; i < 90; i++) { e.vars.divet = 999999; e.step(); }
  check("the settled convoy breathes side to side", e.lists.ex[10] !== x0);
}

console.log("The ranks and their prices:");
{
  const e = fresh();
  play(e);
  oneFoe(e, 23, 2, 180, 150);               // a bee, settled
  const sc0 = e.vars.score;
  shootFoe(e, 23);
  check("a settled bee pays 50", e.lists.es[23] === 0 && e.vars.score === sc0 + 50);
  oneFoe(e, 23, 3, 180, 250);               // a DIVING bee
  shootFoe(e, 23);
  check("a diving bee pays double — 100", e.vars.score === sc0 + 150);
  oneFoe(e, 4, 2, 180, 150);                // a butterfly
  shootFoe(e, 4);
  check("a butterfly pays 80", e.vars.score === sc0 + 230);
  // the boss takes two
  oneFoe(e, 0, 2, 180, 150);
  shootFoe(e, 0);
  check("a BOSS shrugs off the first hit", e.lists.es[0] === 2 && e.lists.ehp[0] === 1);
  e.step();
  check("…and wears its wound in purple", e.byName.foe1.color === "#b48cff");
  shootFoe(e, 0);
  check("the second hit lands: 150 in formation", e.lists.es[0] === 0
    && e.vars.score === sc0 + 230 + 150);
}

console.log("THE TRACTOR BEAM:");
{
  const e = fresh();
  play(e);
  settleAll(e);
  // force boss 1 into a beam dive
  e.lists.es[1] = 4; (e.lists.bt || (e.lists.bt = {}))[1] = 0;
  e.vars.beamon = 1;
  e.vars.px = 24; e.vars.grace = 0;          // stand clear while it descends
  for (let i = 0; i < 76; i++) { e.step(); e.vars.px = 24; e.vars.grace = 0; }
  check("the boss descends and opens the cone", e.lists.bt[1] >= 70
    && e.byName.beam.visible === 1);
  for (let i = 0; i < 10 && e.vars.capboss < 0; i++) { e.vars.px = e.lists.ex[1]; e.vars.grace = 0; e.step(); }
  check("caught in the light: the fighter is THEIRS", e.vars.capboss === 1
    && e.vars.lives === 2 && String(e.byName.status.text).includes("CAPTURED"));
  for (let i = 0; i < 3; i++) e.step();
  check("…and rides its carrier, white and wrong", e.byName.captive.visible === 1);
  // THE RESCUE: kill the carrier
  e.vars.grace = 0;
  e.lists.es[1] = 2; e.lists.sx[1] = 180; e.lists.sy[1] = 150; e.lists.ehp[1] = 1;
  const sc0 = e.vars.score;
  shootFoe(e, 1);
  check("kill the carrier and the fighter comes HOME: dual, +1000",
    e.vars.dual === 1 && e.vars.capboss === -1 && e.vars.score >= sc0 + 1000);
  // dual fires two
  e.keys["Space"] = true; e.step(); e.keys["Space"] = false; e.step();
  const liveShots = [0, 1, 2, 3].filter(j => e.lists.son[j] === 1).length;
  check("the dual fighter fires TWO shots a press", liveShots === 2);
  // a hit costs the partner, not a life (fresh fleet, dual granted)
  const eD = fresh();
  play(eD);
  clearAll(eD);
  eD.vars.dual = 1; eD.vars.grace = 0;
  const LD = (n) => eD.lists[n] || (eD.lists[n] = {});
  LD("bon")[0] = 1; LD("bx")[0] = eD.vars.px; LD("by")[0] = PY - 2; LD("bvx")[0] = 0;
  eD.step();
  check("a hit on the dual costs the PARTNER, not a life", eD.vars.dual === 0 && eD.vars.lives === 3);
  // captured on the last life = over
  const e2 = fresh();
  play(e2);
  settleAll(e2);
  e2.vars.lives = 1;
  e2.lists.es[2] = 4; (e2.lists.bt || (e2.lists.bt = {}))[2] = 80;
  e2.vars.beamon = 1;
  e2.lists.ey[2] = 280;
  e2.vars.px = e2.lists.ex[2]; e2.vars.grace = 0;
  e2.step();
  check("captured on the LAST life: over, on the spot", e2.vars.game === 2
    && Number(e2.vars.endplay) === 1 && String(e2.byName.status.text).includes("LAST FIGHTER"));
}

console.log("The challenging stage:");
{
  const e = fresh();
  play(e);
  clearAll(e);                               // wave 1 ends empty
  e.step();
  check("wave 2 deals normally", e.vars.wave === 2 && e.vars.chstage === 0);
  clearAll(e);
  e.step();
  check("every third wave is the CHALLENGING STAGE", e.vars.wave === 3 && e.vars.chstage === 1
    && String(e.byName.status.text).includes("CHALLENGING"));
  // they fly through and LEAVE
  let gone = false;
  for (let i = 0; i < 1600 && !gone; i++) {
    e.step();
    gone = true;
    for (let k = 0; k < 24; k++) if (e.lists.es[k] > 0) gone = false;
  }
  e.step();                                  // the empty sky ends the stage
  check("untouched challengers fly through and ESCAPE — no perfect bonus",
    e.vars.wave === 4 && e.vars.score < 10000);
  // the perfect
  const e2 = fresh();
  play(e2);
  e2.vars.wave = 3; e2.vars.chstage = 1; e2.vars.chkills = 23;
  oneFoe(e2, 5, 1, 180, 150); e2.lists.pt[5] = 0.5;
  e2.lists.psx[5] = 180; e2.lists.psy[5] = 150;   // a flat path: it stays shootable
  const sc = e2.vars.score;
  shootFoe(e2, 5);
  e2.step();
  check("all 24 hit = PERFECT, 10000", e2.vars.score >= sc + 100 + 10000
    && String(e2.byName.status.text).includes("PERFECT"));
}

console.log("The end:");
{
  const e = fresh();
  play(e);
  clearAll(e); e.vars.divet = 99999;
  e.vars.lives = 1; e.vars.dual = 0; e.vars.grace = 0;
  const L3 = (n) => e.lists[n] || (e.lists[n] = {});
  L3("bon")[0] = 1; L3("bx")[0] = e.vars.px; L3("by")[0] = PY - 2; L3("bvx")[0] = 0;
  e.step(); e.step();
  check("the last fighter falls (endplay + ★ table)", e.vars.game === 2
    && Number(e.vars.endplay) === 1);
  e.fireClick(10, 10); e.step();
  check("a click after the end returns to attract", e.vars.game === 9);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

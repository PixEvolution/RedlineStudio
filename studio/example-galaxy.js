// example-galaxy.js — Galaxy Game / Computer Space (1971), rebuilt in our studio.
// The year video games left the lab. At Stanford, Galaxy Game put Spacewar!
// behind a coin slot. Weeks later, Nolan Bushnell and Ted Dabney shipped
// COMPUTER SPACE — the first mass-produced arcade cabinet (they founded Atari
// next). One rocket, two flying saucers, a timer running on your quarter, and
// the hook that built an industry: outscore the saucers before time runs out
// and the machine gives you a FREE GAME.
//
// This one is single-player — the first example you don't need a friend for.
//   A / D rotate · W thrust · S fire · 90 seconds per coin · beat the saucers!
//
// PUBLISH IT LIKE IT'S 1971: set a price (say 🪙 1) and a Live arcade screen —
// this example is the platform's flagship coin game. The click that starts a
// round IS the coin drop.

const ROT = 4.5, THRUST = 0.09, VMAX = 3.5;
const TORP_SPD = 5.2, TORP_LIFE = 95, MISSILE_SPD = 2.6;
const ROUND_TICKS = 5400;   // ~90 seconds
const HIT_R = 12, CRASH_R = 15;

// ------------------------------------------------------------- player rocket
function rocketCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when start");
  push("set self.velx to 0");
  push("set self.vely to 0");
  push("set self.cool to 0");
  push("set ralive to 0");           // hidden until a coin drops
  push("set self.visible to 0");
  push("end");
  push("when tick");
  push("set fire1 to 0");
  push("if game == 0 and ralive == 1 then");
  push("  set self.visible to 1");
  push('  if keydown("a") then');
  push(`    set self.angle to self.angle - ${ROT}`);
  push("  end");
  push('  if keydown("d") then');
  push(`    set self.angle to self.angle + ${ROT}`);
  push("  end");
  push('  if keydown("w") then');
  push(`    set self.velx to min(${VMAX}, max(-${VMAX}, self.velx + cos(self.angle) * ${THRUST}))`);
  push(`    set self.vely to min(${VMAX}, max(-${VMAX}, self.vely + sin(self.angle) * ${THRUST}))`);
  push("    set rflame.visible to 1");
  push("  else");
  push("    set rflame.visible to 0");
  push("  end");
  push("  set rflame.x to self.x - cos(self.angle) * 13");
  push("  set rflame.y to self.y - sin(self.angle) * 13");
  push("  change self.x by self.velx");
  push("  change self.y by self.vely");
  push("  if self.x < 0 then");
  push("    set self.x to 480");
  push("  end");
  push("  if self.x > 480 then");
  push("    set self.x to 0");
  push("  end");
  push("  if self.y < 0 then");
  push("    set self.y to 360");
  push("  end");
  push("  if self.y > 360 then");
  push("    set self.y to 0");
  push("  end");
  push("  set self.cool to self.cool - 1");
  push('  if keydown("s") and self.cool <= 0 then');
  push("    set fire1 to 1");
  push("    set taken1 to 0");
  push("    set self.cool to 15");
  push("  end");
  push("else");
  push("  set self.visible to 0");
  push("  set rflame.visible to 0");
  push("end");
  push("end");
  return L.join("\n");
}

// ------------------------------------------------------------- saucer + dome
function saucerCode(n) {   // n = 1 or 2
  const L = [];
  const push = (s) => L.push(s);
  push("when start");
  push(`set s${n}alive to 1`);
  push("set self.wander to 0");
  push("set self.wvx to 0");
  push("set self.wvy to 0");
  push("end");
  push("when tick");
  push(`if s${n}alive == 1 and game != 2 then`);
  push("  set self.visible to 1");
  // the famous zigzag: pick a new drift every so often
  push("  set self.wander to self.wander - 1");
  push("  if self.wander <= 0 then");
  push("    set self.wander to rand(70, 150)");
  push("    set self.wvx to rand(-1.3, 1.3)");
  push("    set self.wvy to rand(-1, 1)");
  push("  end");
  push("  change self.x by self.wvx");
  push("  change self.y by self.wvy");
  push("  if self.x < 0 then");
  push("    set self.x to 480");
  push("  end");
  push("  if self.x > 480 then");
  push("    set self.x to 0");
  push("  end");
  push("  if self.y < 0 then");
  push("    set self.y to 360");
  push("  end");
  push("  if self.y > 360 then");
  push("    set self.y to 0");
  push("  end");
  push(`  set dome${n}.visible to 1`);
  push("else");
  push("  set self.visible to 0");
  push(`  set dome${n}.visible to 0`);
  push("end");
  push(`set dome${n}.x to self.x`);
  push(`set dome${n}.y to self.y - 7`);
  push("end");
  return L.join("\n");
}

// ------------------------------------------------------------- player torpedo
function torpCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("if game != 0 then");
  push("  set self.life to 0");
  push("end");
  push("if self.life > 0 then");
  push("  set self.life to self.life - 1");
  push("  change self.x by self.tvx");
  push("  change self.y by self.tvy");
  push("  set self.visible to 1");
  push(`  if s1alive == 1 and dist(self, saucer1) < ${HIT_R} then`);
  push("    set killsaucer1 to 1");
  push("    set self.life to 0");
  push("  end");
  push(`  if s2alive == 1 and dist(self, saucer2) < ${HIT_R} then`);
  push("    set killsaucer2 to 1");
  push("    set self.life to 0");
  push("  end");
  push("  if self.x < -10 or self.x > 490 or self.y < -10 or self.y > 370 then");
  push("    set self.life to 0");
  push("  end");
  push("else");
  push("  set self.visible to 0");
  push("  if fire1 == 1 and taken1 == 0 then");
  push("    set taken1 to 1");
  push(`    set self.life to ${TORP_LIFE}`);
  push("    set self.x to rocket.x + cos(rocket.angle) * 15");
  push("    set self.y to rocket.y + sin(rocket.angle) * 15");
  push(`    set self.tvx to rocket.velx + cos(rocket.angle) * ${TORP_SPD}`);
  push(`    set self.tvy to rocket.vely + sin(rocket.angle) * ${TORP_SPD}`);
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

// ------------------------------------------------------------- saucer missile
function missileCode(n) {   // fires from saucer n, on its own clock
  const L = [];
  const push = (s) => L.push(s);
  push("when start");
  push(`set self.cool to rand(60, ${60 + n * 60})`);
  push("end");
  push("when tick");
  push("if game != 0 then");
  push("  set self.life to 0");
  push("end");
  push("if self.life > 0 then");
  push("  set self.life to self.life - 1");
  push("  change self.x by self.tvx");
  push("  change self.y by self.tvy");
  push("  set self.visible to 1");
  push(`  if ralive == 1 and dist(self, rocket) < ${HIT_R} then`);
  push("    set killrocket to 1");
  push("    set self.life to 0");
  push("  end");
  push("  if self.x < -10 or self.x > 490 or self.y < -10 or self.y > 370 then");
  push("    set self.life to 0");
  push("  end");
  push("else");
  push("  set self.visible to 0");
  push("  set self.cool to self.cool - 1");
  push(`  if game == 0 and ralive == 1 and s${n}alive == 1 and self.cool <= 0 then`);
  push("    set self.cool to rand(90, 170)");
  push("    set self.life to 100");
  push(`    set self.x to saucer${n}.x`);
  push(`    set self.y to saucer${n}.y`);
  // aim at the rocket (normalized by distance), with 1971-grade accuracy
  push(`    set r to max(20, dist(saucer${n}, rocket))`);
  push(`    set self.tvx to (rocket.x - saucer${n}.x) / r * ${MISSILE_SPD} + rand(-0.5, 0.5)`);
  push(`    set self.tvy to (rocket.y - saucer${n}.y) / r * ${MISSILE_SPD} + rand(-0.5, 0.5)`);
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

// ------------------------------------------------------------- the cabinet
function brainCode() {
  const L = [];
  const push = (s) => L.push(s);
  const startRound = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set pscore to 0`);
    push(`${pad}set sscore to 0`);
    push(`${pad}set basep to 0`);
    push(`${pad}set bases to 0`);
    push(`${pad}set ticksleft to ${ROUND_TICKS}`);
    push(`${pad}set ralive to 1`);
    push(`${pad}set rocket.x to 240`);
    push(`${pad}set rocket.y to 300`);
    push(`${pad}set rocket.angle to -90`);
    push(`${pad}set rocket.velx to 0`);
    push(`${pad}set rocket.vely to 0`);
    push(`${pad}set s1alive to 1`);
    push(`${pad}set saucer1.x to rand(60, 200)`);
    push(`${pad}set saucer1.y to rand(50, 140)`);
    push(`${pad}set s2alive to 1`);
    push(`${pad}set saucer2.x to rand(280, 420)`);
    push(`${pad}set saucer2.y to rand(50, 140)`);
    push(`${pad}set killrocket to 0`);
    push(`${pad}set killsaucer1 to 0`);
    push(`${pad}set killsaucer2 to 0`);
    push(`${pad}set rresp to 0`);
    push(`${pad}set s1resp to 0`);
    push(`${pad}set s2resp to 0`);
    push(`${pad}say "GO!" for 1`);
  };

  push("when start");
  push("set game to 9");   // attract mode: saucers roam, waiting for a coin
  push("set pscore to 0");
  push("set sscore to 0");
  push("set killrocket to 0");
  push("set killsaucer1 to 0");
  push("set killsaucer2 to 0");
  push('set self.text to "◉ INSERT COIN — CLICK TO PLAY ◉"');
  push("end");

  push("when tick");
  push("if game == 0 then");
  // rocket ramming a saucer: both go up (and both score)
  push(`  if ralive == 1 and s1alive == 1 and dist(rocket, saucer1) < ${CRASH_R} then`);
  push("    set killrocket to 1");
  push("    set killsaucer1 to 1");
  push("  end");
  push(`  if ralive == 1 and s2alive == 1 and dist(rocket, saucer2) < ${CRASH_R} then`);
  push("    set killrocket to 1");
  push("    set killsaucer2 to 1");
  push("  end");
  // resolve kills
  push("  if killrocket == 1 then");
  push("    set killrocket to 0");
  push("    if ralive == 1 then");
  push("      explode rocket");
  push("      set ralive to 0");
  push("      set sscore to sscore + 1");
  push("      set rresp to 55");
  push("    end");
  push("  end");
  push("  if killsaucer1 == 1 then");
  push("    set killsaucer1 to 0");
  push("    if s1alive == 1 then");
  push("      explode saucer1");
  push("      set s1alive to 0");
  push("      set pscore to pscore + 1");
  push("      set s1resp to 65");
  push("    end");
  push("  end");
  push("  if killsaucer2 == 1 then");
  push("    set killsaucer2 to 0");
  push("    if s2alive == 1 then");
  push("      explode saucer2");
  push("      set s2alive to 0");
  push("      set pscore to pscore + 1");
  push("      set s2resp to 65");
  push("    end");
  push("  end");
  // respawns
  push("  if rresp > 0 then");
  push("    set rresp to rresp - 1");
  push("    if rresp == 0 then");
  push("      set ralive to 1");
  push("      set rocket.x to 240");
  push("      set rocket.y to 300");
  push("      set rocket.angle to -90");
  push("      set rocket.velx to 0");
  push("      set rocket.vely to 0");
  push("    end");
  push("  end");
  push("  if s1resp > 0 then");
  push("    set s1resp to s1resp - 1");
  push("    if s1resp == 0 then");
  push("      set s1alive to 1");
  push("      set saucer1.x to rand(40, 440)");
  push("      set saucer1.y to rand(40, 150)");
  push("    end");
  push("  end");
  push("  if s2resp > 0 then");
  push("    set s2resp to s2resp - 1");
  push("    if s2resp == 0 then");
  push("      set s2alive to 1");
  push("      set saucer2.x to rand(40, 440)");
  push("      set saucer2.y to rand(40, 150)");
  push("    end");
  push("  end");
  // the coin timer
  push("  set ticksleft to ticksleft - 1");
  push('  set self.text to "YOU " + pscore + " — " + sscore + " SAUCERS     TIME " + floor(ticksleft / 60)');
  push("  if ticksleft <= 0 then");
  // 1971's masterstroke: beat the machine, get a free game
  push("    if pscore - basep > sscore - bases then");
  push('      say "HIGH SCORE — FREE GAME!" for 3');
  push(`      set ticksleft to ${ROUND_TICKS}`);
  push("      set basep to pscore");
  push("      set bases to sscore");
  push("    else");
  push("      set game to 2");
  push('      set self.text to "GAME OVER · YOU " + pscore + " — " + sscore + " · INSERT COIN (CLICK)"');
  push("    end");
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 or game == 2 then");
  startRound("  ");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildGalaxyExample() {
  const objects = [];

  // starfield backdrop
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) {
    objects.push({
      id: "cs_s" + i, name: "st" + i, type: "dot",
      x: Math.round(10 + rnd() * 460), y: Math.round(10 + rnd() * 340),
      size: 2, color: "#1f8f3c", glow: 3, visible: 1, text: "", script: []
    });
  }

  // the rocket (order: rocket → torps → saucers → missiles → brain last)
  objects.push({
    id: "cs_rocket", name: "rocket", type: "tri",
    x: 240, y: 300, size: 14, angle: -90,
    color: "#7dff9e", glow: 12, visible: 0, text: "",
    script: [{ event: "code", source: rocketCode() }]
  });
  objects.push({
    id: "cs_rf", name: "rflame", type: "dot",
    x: 0, y: 0, size: 5, color: "#d8ffe2", glow: 14, visible: 0, text: "", script: []
  });

  for (let i = 0; i < 2; i++) {
    objects.push({
      id: "cs_t" + i, name: "torp" + i, type: "dot",
      x: 0, y: 0, size: 4, color: "#b9ffcb", glow: 12, visible: 0, text: "",
      script: [{ event: "code", source: torpCode() }]
    });
  }

  for (const n of [1, 2]) {
    objects.push({
      id: "cs_sa" + n, name: "saucer" + n, type: "ring",
      x: n === 1 ? 120 : 360, y: 90, size: 11,
      color: "#ff9d4a", glow: 12, visible: 1, text: "",
      script: [{ event: "code", source: saucerCode(n) }]
    });
    objects.push({
      id: "cs_d" + n, name: "dome" + n, type: "dot",
      x: 0, y: 0, size: 5, color: "#ffd75e", glow: 10, visible: 1, text: "", script: []
    });
    objects.push({
      id: "cs_m" + n, name: "missile" + n, type: "dot",
      x: 0, y: 0, size: 4, color: "#ffe2b9", glow: 12, visible: 0, text: "",
      script: [{ event: "code", source: missileCode(n) }]
    });
  }

  objects.push({
    id: "cs_brain", name: "brain", type: "text",
    x: 240, y: 20, size: 14, color: "#b9ffcb", glow: 10, visible: 1,
    text: "◉ INSERT COIN — CLICK TO PLAY ◉",
    script: [{ event: "code", source: brainCode() }]
  });

  objects.push({
    id: "cs_help", name: "help", type: "text",
    x: 240, y: 348, size: 10, color: "#1f8f3c", glow: 4, visible: 1,
    text: "COMPUTER SPACE · 1971 · THE FIRST ARCADE GAME · A/D TURN · W THRUST · S FIRE · OUTSCORE THE SAUCERS = FREE GAME",
    script: []
  });

  return { title: "Computer Space (1971)", objects };
}

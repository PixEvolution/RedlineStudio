// example-spacewar.js — Spacewar! (1962), rebuilt in our studio.
// Steve Russell and the MIT hackers wrote it on the PDP-1, and it escaped —
// copied from lab to lab until practically every university computer in
// America had it. The first widely influential digital game. Two ships — the
// NEEDLE and the WEDGE — duel around a star whose gravity bends every move
// and kills on contact. Torpedoes, screen wraparound, and the famous panic
// button: HYPERSPACE, which teleports you somewhere random… and sometimes
// just kills you.
//
// This example debuts ROTATION: the new ship (tri) object points along its
// `angle` property, and thrust is sin/cos of that heading — the full
// Spacewar! control scheme. First to 5 kills wins.
//
//   NEEDLE (green):  A/D rotate · W thrust · S fire · Q hyperspace
//   WEDGE  (amber):  ←/→ rotate · ↑ thrust · ↓ fire · ENTER hyperspace

const CX = 240, CY = 180;
const G = 1200, STAR_KILL = 16, SHIP_HIT = 16, TORP_HIT = 12;
const ROT = 3.2, THRUST = 0.09, VMAX = 3.5, TORP_SPD = 5, TORP_LIFE = 110;
// spawn in ORBIT: tangential velocity at circular-orbit speed, so untouched
// ships circle the star instead of falling straight into it
const NEEDLE_SPAWN = { x: 110, y: 270, a: 55, vx: 1.57, vy: 2.26 };
const WEDGE_SPAWN = { x: 370, y: 90, a: 235, vx: -1.57, vy: -2.26 };

// -------------------------------------------------------------- ship script
function shipCode(p) {
  // p: { spawn, left, right, thrust, fire, hyper, fireFlag, takenFlag,
  //      aliveVar, enemyName, killSelf, flame }
  const L = [];
  const push = (s) => L.push(s);

  push("when start");
  push(`set self.x to ${p.spawn.x}`);
  push(`set self.y to ${p.spawn.y}`);
  push(`set self.angle to ${p.spawn.a}`);
  push(`set self.velx to ${p.spawn.vx}`);
  push(`set self.vely to ${p.spawn.vy}`);
  push("set self.cool to 0");
  push("set self.hcool to 0");
  push(`set ${p.aliveVar} to 1`);
  push("end");

  push("when tick");
  // round respawn (the brain raises roundreset for one tick)
  push("if roundreset == 1 then");
  push(`  set self.x to ${p.spawn.x}`);
  push(`  set self.y to ${p.spawn.y}`);
  push(`  set self.angle to ${p.spawn.a}`);
  push(`  set self.velx to ${p.spawn.vx}`);
  push(`  set self.vely to ${p.spawn.vy}`);
  push("  set self.cool to 0");
  push("  set self.hcool to 0");
  push(`  set ${p.aliveVar} to 1`);
  push("  set self.visible to 1");
  push("end");

  push(`set ${p.fireFlag} to 0`);
  push(`if game == 0 and ${p.aliveVar} == 1 then`);
  // rotation: keys and JOYSTICK ${p.stick} side by side (stick is analog —
  // a half-push turns half as fast); push UP on the stick to thrust
  push(`  set self.trn to max(-1, min(1, keydown("${p.right}") - keydown("${p.left}") + stickx(${p.stick})))`);
  push(`  set self.angle to self.angle + self.trn * ${ROT}`);
  // thrust along the heading (+ exhaust flame)
  push(`  if keydown("${p.thrust}") or sticky(${p.stick}) < -0.35 then`);
  push(`    set self.velx to min(${VMAX}, max(-${VMAX}, self.velx + cos(self.angle) * ${THRUST}))`);
  push(`    set self.vely to min(${VMAX}, max(-${VMAX}, self.vely + sin(self.angle) * ${THRUST}))`);
  push(`    set ${p.flame}.visible to 1`);
  push("  else");
  push(`    set ${p.flame}.visible to 0`);
  push("  end");
  push(`  set ${p.flame}.x to self.x - cos(self.angle) * 14`);
  push(`  set ${p.flame}.y to self.y - sin(self.angle) * 14`);
  // the star's gravity well
  push('  set r to max(20, dist(self, star))');
  push(`  set self.velx to self.velx + ${G} * (${CX} - self.x) / (r * r * r)`);
  push(`  set self.vely to self.vely + ${G} * (${CY} - self.y) / (r * r * r)`);
  push('  if dist(self, star) < ' + STAR_KILL + " then");
  push(`    set ${p.killSelf} to 1`);
  push('    say "THE STAR CLAIMS A SHIP" for 1.5');
  push("  end");
  // move + wraparound
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
  // fire (torpedo objects claim the flag)
  push("  set self.cool to self.cool - 1");
  push(`  if keydown("${p.fire}") and self.cool <= 0 then`);
  push(`    set ${p.fireFlag} to 1`);
  push(`    set ${p.takenFlag} to 0`);
  push("    set self.cool to 16");
  push("  end");
  // hyperspace: the panic button — random jump, real chance of dying
  push("  set self.hcool to self.hcool - 1");
  push(`  if keydown("${p.hyper}") and self.hcool <= 0 then`);
  push("    set self.hcool to 110");
  push("    set self.x to rand(30, 450)");
  push("    set self.y to rand(30, 330)");
  push("    set self.velx to self.velx * 0.2");
  push("    set self.vely to self.vely * 0.2");
  push("    explode self");
  push("    if rand(0, 1) < 0.2 then");
  push(`      set ${p.killSelf} to 1`);
  push('      say "HYPERSPACE MISHAP!" for 2');
  push("    end");
  push("  end");
  push("else");
  push(`  set ${p.flame}.visible to 0`);
  push("end");
  push("end");

  return L.join("\n");
}

// -------------------------------------------------------------- torpedo script
function torpCode(p) {
  // p: { fireFlag, takenFlag, ownerName, enemyName, enemyAlive, killEnemy }
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("if roundreset == 1 then");
  push("  set self.life to 0");
  push("end");
  push("if self.life > 0 then");
  push("  set self.life to self.life - 1");
  push("  change self.x by self.tvx");
  push("  change self.y by self.tvy");
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
  push("  set self.visible to 1");
  push(`  if ${p.enemyAlive} == 1 and dist(self, ${p.enemyName}) < ${TORP_HIT} then`);
  push(`    set ${p.killEnemy} to 1`);
  push("    set self.life to 0");
  push("  end");
  push("else");
  push("  set self.visible to 0");
  // an idle torpedo claims this tick's fire request (first free one wins)
  push(`  if ${p.fireFlag} == 1 and ${p.takenFlag} == 0 and game == 0 then`);
  push(`    set ${p.takenFlag} to 1`);
  push(`    set self.life to ${TORP_LIFE}`);
  push(`    set self.x to ${p.ownerName}.x + cos(${p.ownerName}.angle) * 16`);
  push(`    set self.y to ${p.ownerName}.y + sin(${p.ownerName}.angle) * 16`);
  push(`    set self.tvx to ${p.ownerName}.velx + cos(${p.ownerName}.angle) * ${TORP_SPD}`);
  push(`    set self.tvy to ${p.ownerName}.vely + sin(${p.ownerName}.angle) * ${TORP_SPD}`);
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

// -------------------------------------------------------------- referee brain
function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  push("when start");
  push("set nscore to 0");
  push("set wscore to 0");
  push("set kill1 to 0");
  push("set kill2 to 0");
  push("set roundreset to 0");
  push("set resptimer to 0");
  push("set game to 0");
  push('set self.text to "NEEDLE 0 — 0 WEDGE"');
  push("end");

  push("when tick");
  push("set star.size to 10 + sin(time() * 250) * 3");   // the star breathes
  push("set roundreset to 0");
  push("if game == 0 then");
  // ships colliding with each other: mutual destruction
  push(`  if nalive == 1 and walive == 1 and dist(needle, wedge) < ${SHIP_HIT} then`);
  push("    set kill1 to 1");
  push("    set kill2 to 1");
  push('    say "MUTUAL DESTRUCTION" for 2');
  push("  end");
  // resolve this tick's kills
  push("  if kill1 == 1 or kill2 == 1 then");
  push("    if kill1 == 1 and nalive == 1 then");
  push("      explode needle");
  push("      set nalive to 0");
  push("      set needle.visible to 0");
  push("    end");
  push("    if kill2 == 1 and walive == 1 then");
  push("      explode wedge");
  push("      set walive to 0");
  push("      set wedge.visible to 0");
  push("    end");
  push("    if kill1 == 1 and kill2 == 0 then");
  push("      set wscore to wscore + 1");
  push('      say "WEDGE SCORES" for 1.5');
  push("    end");
  push("    if kill2 == 1 and kill1 == 0 then");
  push("      set nscore to nscore + 1");
  push('      say "NEEDLE SCORES" for 1.5');
  push("    end");
  push("    set kill1 to 0");
  push("    set kill2 to 0");
  push("    if nscore >= 5 then");
  push("      set game to 1");
  push('      set self.text to "THE NEEDLE WINS " + nscore + "–" + wscore + " — CLICK TO RESET"');
  push("    end");
  push("    if wscore >= 5 then");
  push("      set game to 2");
  push('      set self.text to "THE WEDGE WINS " + wscore + "–" + nscore + " — CLICK TO RESET"');
  push("    end");
  push("    if game == 0 then");
  push("      set resptimer to 50");
  push('      set self.text to "NEEDLE " + nscore + " — " + wscore + " WEDGE"');
  push("    end");
  push("  end");
  // respawn countdown
  push("  if resptimer > 0 then");
  push("    set resptimer to resptimer - 1");
  push("    if resptimer == 0 then");
  push("      set roundreset to 1");
  push("    end");
  push("  end");
  push("  if game == 0 and kill1 == 0 and kill2 == 0 and resptimer == 0 then");
  push('    set self.text to "NEEDLE " + nscore + " — " + wscore + " WEDGE"');
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game != 0 then");
  push("  set nscore to 0");
  push("  set wscore to 0");
  push("  set game to 0");
  push("  set kill1 to 0");
  push("  set kill2 to 0");
  push("  set roundreset to 1");
  push('  set self.text to "NEEDLE 0 — 0 WEDGE"');
  push("end");
  push("end");

  return L.join("\n");
}

export function buildSpacewarExample() {
  const objects = [];

  // starfield (fixed pseudo-random sprinkle — the PDP-1 had "Expensive Planetarium")
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 42; i++) {
    objects.push({
      id: "sw_s" + i, name: "bg" + i, type: "dot",
      x: Math.round(10 + rnd() * 460), y: Math.round(10 + rnd() * 340),
      size: 2, color: "#1f8f3c", glow: 3, visible: 1, text: "", script: []
    });
  }

  // the star (deadly)
  objects.push({
    id: "sw_star", name: "star", type: "dot",
    x: CX, y: CY, size: 10, color: "#fff7ae", glow: 26, visible: 1, text: "", script: []
  });

  // ships (ORDER MATTERS: ships set fire flags, torpedoes after them claim, brain last referees)
  objects.push({
    id: "sw_needle", name: "needle", type: "tri",
    x: NEEDLE_SPAWN.x, y: NEEDLE_SPAWN.y, size: 15, angle: NEEDLE_SPAWN.a,
    color: "#7dff9e", glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: shipCode({
      spawn: NEEDLE_SPAWN, left: "a", right: "d", thrust: "w", fire: "s", hyper: "q", stick: 1,
      fireFlag: "fire1", takenFlag: "taken1", aliveVar: "nalive",
      killSelf: "kill1", flame: "nflame"
    }) }]
  });
  objects.push({
    id: "sw_wedge", name: "wedge", type: "tri",
    x: WEDGE_SPAWN.x, y: WEDGE_SPAWN.y, size: 15, angle: WEDGE_SPAWN.a,
    color: "#ff9d4a", glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: shipCode({
      spawn: WEDGE_SPAWN, left: "ArrowLeft", right: "ArrowRight", thrust: "ArrowUp",
      fire: "ArrowDown", hyper: "Enter", stick: 2,
      fireFlag: "fire2", takenFlag: "taken2", aliveVar: "walive",
      killSelf: "kill2", flame: "wflame"
    }) }]
  });

  // exhaust flames
  objects.push({
    id: "sw_nf", name: "nflame", type: "dot",
    x: 0, y: 0, size: 5, color: "#d8ffe2", glow: 14, visible: 0, text: "", script: []
  });
  objects.push({
    id: "sw_wf", name: "wflame", type: "dot",
    x: 0, y: 0, size: 5, color: "#ffd75e", glow: 14, visible: 0, text: "", script: []
  });

  // torpedoes: four per ship
  for (let i = 0; i < 4; i++) {
    objects.push({
      id: "sw_t1" + i, name: "nt" + i, type: "dot",
      x: 0, y: 0, size: 4, color: "#b9ffcb", glow: 12, visible: 0, text: "",
      script: [{ event: "code", source: torpCode({
        fireFlag: "fire1", takenFlag: "taken1", ownerName: "needle",
        enemyName: "wedge", enemyAlive: "walive", killEnemy: "kill2"
      }) }]
    });
  }
  for (let i = 0; i < 4; i++) {
    objects.push({
      id: "sw_t2" + i, name: "wt" + i, type: "dot",
      x: 0, y: 0, size: 4, color: "#ffe2b9", glow: 12, visible: 0, text: "",
      script: [{ event: "code", source: torpCode({
        fireFlag: "fire2", takenFlag: "taken2", ownerName: "wedge",
        enemyName: "needle", enemyAlive: "nalive", killEnemy: "kill1"
      }) }]
    });
  }

  // referee LAST so kills resolve after everything moved
  objects.push({
    id: "sw_brain", name: "brain", type: "text",
    x: 240, y: 20, size: 14, color: "#b9ffcb", glow: 10, visible: 1,
    text: "NEEDLE 0 — 0 WEDGE",
    script: [{ event: "code", source: brainCode() }]
  });

  objects.push({
    id: "sw_help", name: "help", type: "text",
    x: 240, y: 348, size: 10, color: "#1f8f3c", glow: 4, visible: 1,
    text: "SPACEWAR 1962 · NEEDLE: A/D W S, Q=HYPER · WEDGE: ←→ ↑ ↓, ENTER=HYPER",
    script: []
  });

  // name the on-screen joysticks — the harness reads stickNtag objects
  // so every stick says WHOSE it is (hidden: they're labels, not scenery)
  objects.push({ id: "sw_st1", name: "stick1tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "NEEDLE", script: [] });
  objects.push({ id: "sw_st2", name: "stick2tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "WEDGE", script: [] });

  return { title: "Spacewar! (1962)", objects };
}

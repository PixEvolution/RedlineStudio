// example-combat.js — COMBAT (1977), rebuilt in our studio.
//
// The cartridge that came IN THE BOX with the Atari 2600 at launch — for
// millions of kids, the first home video game they ever touched. One cart,
// 27 numbered variations of the same beautiful idea: two players, two
// joysticks, one screen. And the famous part: THERE IS NO COMPUTER OPPONENT.
// Combat shipped with no AI at all — if you had no friend on the couch, you
// had no game. 1977 did not apologize.
//
// Faithful here, three variations off the cart's menu:
//   · TANK — open field, slow shells, turn-and-thrust dueling
//   · TANK MAZE — walls to hide behind, and shells that RICOCHET off
//     everything (the cart's beloved bounce-shot variations)
//   · BIPLANE — constant-speed flying, wrap at the edges, and CLOUDS that
//     hide whoever's inside from everyone
//   · one game lasts exactly 2:16, like the real cartridge's timer
//   · strictly TWO PLAYERS: P1 W/A/D + Q (or stick 1) · P2 arrows + M
//     (or stick 2) — bring a friend, it's 1977
//
// Most hits when the clock runs out takes the day. score feeds the ★ table.

const W = 480, H = 360;
const T = 36, B = 352, L = 8, R = 472;         // the field inside the HUD
const PLAYTICKS = 136 * 60;                     // 2:16, the cartridge's clock
const TSPD = 1.7, TTURN = 3, SHELL = 3.6, PSPD = 2.4, PTURN = 3.4, GUN = 6;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", ORANGE = "#ff9d4a";
// the maze, mode 2 only: three slabs to duck behind
const WALLS = [[140, 130, 54], [340, 250, 54], [240, 190, 44]];

// one player's vehicle: tank physics in modes 1-2, biplane physics in mode 3
function vehicleCode(n, left, right, fwd, fire, stick) {
  const Lx = [];
  const push = (s) => Lx.push(s);
  const foe = n === 1 ? 2 : 1;
  push("when tick");
  push("set self.visible to (game != 9)");
  push("if game == 0 then");
  push(`  set st to max(-1, min(1, keydown("${right}") - keydown("${left}") + stickx(${stick})))`);
  push("  if mode == 3 then");
  // BIPLANE: you never stop flying — you only choose where
  push(`    change self.angle by st * ${PTURN}`);
  push(`    change self.x by cos(self.angle) * ${PSPD}`);
  push(`    change self.y by sin(self.angle) * ${PSPD}`);
  // wrap at the edges, like the cartridge
  push(`    if self.x < ${L} then`);
  push(`      set self.x to ${R}`);
  push("    end");
  push(`    if self.x > ${R} then`);
  push(`      set self.x to ${L}`);
  push("    end");
  push(`    if self.y < ${T} then`);
  push(`      set self.y to ${B}`);
  push("    end");
  push(`    if self.y > ${B} then`);
  push(`      set self.y to ${T}`);
  push("    end");
  // clouds hide whoever's inside — from EVERYONE
  push("    if touching(self, cloud1) or touching(self, cloud2) then");
  push("      set self.visible to 0");
  push("    end");
  push("  else");
  // TANK: turn and thrust, walls are walls
  push(`    change self.angle by st * ${TTURN}`);
  push(`    set gas to max(0, min(1, keydown("${fwd}") + (0 - sticky(${stick}))))`);
  push(`    set nx to self.x + cos(self.angle) * gas * ${TSPD}`);
  push(`    set ny to self.y + sin(self.angle) * gas * ${TSPD}`);
  push("    set blocked to 0");
  push("    if mode == 2 then");
  for (const [wx, wy, ws] of WALLS) {
    push(`      if abs(nx - ${wx}) < ${ws / 2 + 9} and abs(ny - ${wy}) < ${ws / 2 + 9} then`);
    push("        set blocked to 1");
    push("      end");
  }
  push("    end");
  push("    if blocked == 0 then");
  push("      set self.x to nx");
  push("      set self.y to ny");
  push("    end");
  push(`    set self.x to max(${L + 9}, min(${R - 9}, self.x))`);
  push(`    set self.y to max(${T + 9}, min(${B - 9}, self.y))`);
  push("  end");
  // ONE shell in the air per player, fired on the PRESS, not the hold
  push(`  set pf to keydown("${fire}")`);
  push(`  if pf == 1 and pf${n} == 0 and shellon${n} == 0 then`);
  push(`    set shellon${n} to 1`);
  push(`    set sbn${n} to 0`);
  push(`    set slife${n} to ${Math.round(90)}`);
  push(`    set shell${n}.x to self.x + cos(self.angle) * 14`);
  push(`    set shell${n}.y to self.y + sin(self.angle) * 14`);
  push(`    set svx${n} to cos(self.angle)`);
  push(`    set svy${n} to sin(self.angle)`);
  push("    if mode == 3 then");
  push("      beep 740 for 0.03");
  push("    else");
  push("      beep 180 for 0.08");
  push("    end");
  push("  end");
  push(`  set pf${n} to pf`);
  push("end");
  push("end");
  return Lx.join("\n");
}

// one player's shell: flies, bounces (maze mode), bites the other player
function shellCode(n) {
  const Lx = [];
  const push = (s) => Lx.push(s);
  const foe = n === 1 ? 2 : 1;
  push("when tick");
  push(`set self.visible to (game == 0 and shellon${n} == 1)`);
  push(`if game == 0 and shellon${n} == 1 then`);
  push(`  set spd to ${SHELL}`);
  push("  if mode == 3 then");
  push(`    set spd to ${GUN}`);
  push("  end");
  push(`  change self.x by svx${n} * spd`);
  push(`  change self.y by svy${n} * spd`);
  push(`  set slife${n} to slife${n} - 1`);
  push(`  if slife${n} <= 0 then`);
  push(`    set shellon${n} to 0`);
  push("  end");
  // the outer walls: dead stop in TANK and BIPLANE, RICOCHET in the maze
  push(`  if self.x < ${L} or self.x > ${R} then`);
  push("    if mode == 2 then");
  push(`      set svx${n} to 0 - svx${n}`);
  push(`      set sbn${n} to sbn${n} + 1`);
  push("      beep 320 for 0.03");
  push("    else");
  push(`      set shellon${n} to 0`);
  push("    end");
  push("  end");
  push(`  if self.y < ${T} or self.y > ${B} then`);
  push("    if mode == 2 then");
  push(`      set svy${n} to 0 - svy${n}`);
  push(`      set sbn${n} to sbn${n} + 1`);
  push("      beep 320 for 0.03");
  push("    else");
  push(`      set shellon${n} to 0`);
  push("    end");
  push("  end");
  // the maze slabs bounce shells too — the cart's billiard shots
  push("  if mode == 2 then");
  for (let wi = 0; wi < WALLS.length; wi++) {
    const [wx, wy, ws] = WALLS[wi];
    push(`    if abs(self.x - ${wx}) < ${ws / 2 + 3} and abs(self.y - ${wy}) < ${ws / 2 + 3} then`);
    push(`      if abs(self.x - ${wx}) > abs(self.y - ${wy}) then`);
    push(`        set svx${n} to 0 - svx${n}`);
    push("      else");
    push(`        set svy${n} to 0 - svy${n}`);
    push("      end");
    push(`      set sbn${n} to sbn${n} + 1`);
    push("      beep 320 for 0.03");
    push("    end");
  }
  push(`    if sbn${n} > 2 then`);
  push(`      set shellon${n} to 0`);
  push("    end");
  push("  end");
  // the bite
  push(`  if touching(self, veh${foe}) then`);
  push(`    set shellon${n} to 0`);
  push(`    set score${n} to score${n} + 1`);
  push(`    explode veh${foe}`);
  push("    beep 110 for 0.25");
  push(`    set veh${foe}.x to ${foe === 1 ? 70 : 410}`);
  push(`    set veh${foe}.y to ${H / 2}`);
  push(`    set veh${foe}.angle to ${foe === 1 ? 0 : 180}`);
  push('    set status.text to "HIT!"');
  push("  end");
  push("end");
  push("end");
  return Lx.join("\n");
}

function brainCode() {
  const Lx = [];
  const push = (s) => Lx.push(s);

  const startMatch = (pad, mode) => {
    push(`${pad}set mode to ${mode}`);
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score1 to 0`);
    push(`${pad}set score2 to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set shellon1 to 0`);
    push(`${pad}set shellon2 to 0`);
    push(`${pad}set pf1 to 1`);
    push(`${pad}set pf2 to 1`);
    push(`${pad}set tleft to ${PLAYTICKS}`);
    push(`${pad}set veh1.x to 70`);
    push(`${pad}set veh1.y to ${H / 2}`);
    push(`${pad}set veh1.angle to 0`);
    push(`${pad}set veh2.x to 410`);
    push(`${pad}set veh2.y to ${H / 2}`);
    push(`${pad}set veh2.angle to 180`);
    push(`${pad}set status.text to "${mode === 3 ? "DOGFIGHT — THE CLOUDS HIDE YOU" : mode === 2 ? "SHELLS RICOCHET — BANK THEM AROUND" : "TWO TANKS — MOST HITS BY 0:00 WINS"}"`);
  };

  push("when start");
  push("set game to 9");
  push("set mode to 1");
  push("set score1 to 0");
  push("set score2 to 0");
  push("set score to 0");
  push("set endplay to 0");
  push("set shellon1 to 0");
  push("set shellon2 to 0");
  push('set status.text to ""');
  push("end");

  push("when tick");
  push('set s1tx.text to "P1 " + score1');
  push('set s2tx.text to "P2 " + score2');
  // the cartridge clock, M:SS
  push("set tm to floor(tleft / 3600)");
  push("set ts to floor(tleft / 60) % 60");
  push("if ts < 10 then");
  push('  set timetx.text to tm + ":0" + ts');
  push("else");
  push('  set timetx.text to tm + ":" + ts');
  push("end");
  push("set s1tx.visible to (game != 9)");
  push("set s2tx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set m1btn.visible to (game == 9)");
  push("set m2btn.visible to (game == 9)");
  push("set m3btn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PICK A VARIATION ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — PICK A VARIATION ◎"');
  push("end");
  // furniture by mode
  for (let wi = 1; wi <= WALLS.length; wi++) push(`set wall${wi}.visible to (game == 0 and mode == 2)`);
  push("set cloud1.visible to (game == 0 and mode == 3)");
  push("set cloud2.visible to (game == 0 and mode == 3)");
  push("if game == 0 then");
  push("  set score to max(score1, score2)");
  push("  set tleft to tleft - 1");
  push("  if tleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    if score1 > score2 then");
  push('      set status.text to "0:00 — PLAYER 1 WINS. CLICK AGAIN"');
  push("    else");
  push("      if score2 > score1 then");
  push('        set status.text to "0:00 — PLAYER 2 WINS. CLICK AGAIN"');
  push("      else");
  push('        set status.text to "0:00 — A DRAW. CLICK TO SETTLE IT"');
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 120) < 52 and abs(mousey() - 262) < 16 then");
  startMatch("    ", 1);
  push("  end");
  push("  if abs(mousex() - 240) < 62 and abs(mousey() - 262) < 16 then");
  startMatch("    ", 2);
  push("  end");
  push("  if abs(mousex() - 366) < 56 and abs(mousey() - 262) < 16 then");
  startMatch("    ", 3);
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  return Lx.join("\n");
}

export function buildCombatExample() {
  const objects = [];

  // the maze slabs (mode 2) and the clouds (mode 3)
  WALLS.forEach(([wx, wy, ws], i) => {
    objects.push({ id: "cb_w" + i, name: "wall" + (i + 1), type: "box", x: wx, y: wy, size: ws, angle: 0, color: "#3a4150", glow: 4, visible: 0, text: "", script: [] });
  });
  objects.push({ id: "cb_cl1", name: "cloud1", type: "box", x: 150, y: 110, size: 56, angle: 0, color: "#1d222c", glow: 6, visible: 0, text: "", script: [] });
  objects.push({ id: "cb_cl2", name: "cloud2", type: "box", x: 330, y: 260, size: 62, angle: 0, color: "#1d222c", glow: 6, visible: 0, text: "", script: [] });

  // the two players — tanks in modes 1-2, biplanes in mode 3, same metal
  objects.push({
    id: "cb_v1", name: "veh1", type: "tri",
    x: 70, y: H / 2, size: 13, angle: 0, color: WHITE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: vehicleCode(1, "a", "d", "w", "q", 1) }]
  });
  objects.push({
    id: "cb_v2", name: "veh2", type: "tri",
    x: 410, y: H / 2, size: 13, angle: 180, color: ORANGE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: vehicleCode(2, "ArrowLeft", "ArrowRight", "ArrowUp", "m", 2) }]
  });
  objects.push({
    id: "cb_s1", name: "shell1", type: "dot",
    x: -40, y: -40, size: 4, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{ event: "code", source: shellCode(1) }]
  });
  objects.push({
    id: "cb_s2", name: "shell2", type: "dot",
    x: -40, y: -40, size: 4, color: ORANGE, glow: 10, visible: 0, text: "",
    script: [{ event: "code", source: shellCode(2) }]
  });

  // HUD
  objects.push({ id: "cb_h1", name: "s1tx", type: "text", x: 70, y: 20, size: 16, color: WHITE, glow: 8, visible: 0, text: "P1 0", script: [] });
  objects.push({ id: "cb_h2", name: "s2tx", type: "text", x: 410, y: 20, size: 16, color: ORANGE, glow: 8, visible: 0, text: "P2 0", script: [] });
  objects.push({ id: "cb_tm", name: "timetx", type: "text", x: 240, y: 20, size: 18, color: DIM, glow: 6, visible: 0, text: "2:16", script: [] });
  objects.push({ id: "cb_st", name: "status", type: "text", x: 240, y: 345, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "cb_big", name: "bigtitle", type: "text", x: 240, y: 130, size: 52, color: WHITE, glow: 18, visible: 1, text: "COMBAT", script: [] });
  objects.push({ id: "cb_sub", name: "subline", type: "text", x: 240, y: 165, size: 11, color: DIM, glow: 4, visible: 1, text: "ATARI 2600 · 1977 · THE PACK-IN CART", script: [] });
  objects.push({ id: "cb_coin", name: "coinline", type: "text", x: 240, y: 200, size: 13, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — PICK A VARIATION ◎", script: [] });
  objects.push({ id: "cb_m1", name: "m1btn", type: "text", x: 85, y: 268, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ TANK ]", script: [] });
  objects.push({ id: "cb_m2", name: "m2btn", type: "text", x: 240, y: 268, size: 15, color: ORANGE, glow: 12, visible: 1, text: "[ MAZE ]", script: [] });
  objects.push({ id: "cb_m3", name: "m3btn", type: "text", x: 390, y: 268, size: 15, color: "#2dd2ff", glow: 12, visible: 1, text: "[ BIPLANE ]", script: [] });
  objects.push({
    id: "cb_help", name: "help", type: "text",
    x: 240, y: 315, size: 9, color: DIM, glow: 3, visible: 1,
    text: "TWO PLAYERS · P1 WAD+Q · P2 ←→↑+M",
    script: []
  });

  // the referee
  objects.push({
    id: "cb_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({ id: "cb_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "P1", script: [] });
  objects.push({ id: "cb_t2", name: "stick2tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "P2", script: [] });

  return { title: "Combat (1977)",
    display: "tv2600", hardware: "tv2600",   // the real machine's era
    objects };
}

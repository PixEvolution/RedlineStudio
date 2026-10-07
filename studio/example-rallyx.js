// example-rallyx.js — RALLY-X (1980), rebuilt in our studio.
//
// Namco's maze racer — the game the industry bet on over Pac-Man at the
// 1980 trade shows (they were wrong, but not by much). Three inventions in
// one cabinet: a world BIGGER than the screen that scrolls under a camera,
// a RADAR that shows the whole map at once, and the CHALLENGING STAGE —
// one of the first bonus rounds in any game. Your blue car never stops
// driving; you only choose where it points. Red cars hunt you, the smoke
// screen is your only weapon, and the fuel gauge is always, always falling.
//
// The 1980 machine, faithfully:
//   · a 960×720 world under a 480×360 window — the camera follows you
//   · 10 flags a round, paying 100 × flag number; find the SPECIAL flag
//     and every flag after it pays DOUBLE
//   · red cars are faster than you — SPACE lays smoke that stuns them,
//     and costs fuel
//   · an empty tank doesn't stop you, it makes you SLOW. They catch slow.
//   · every third round is a CHALLENGING STAGE: no rivals, double pay,
//     fuel draining fast — pure bonus round, 1980's gift to the future
//
//   WASD / arrows / stick points the car (it drives itself) · SPACE smoke

const W = 480, H = 360;
const W2 = 960, H2 = 720;
const NWALL = 18, NFLAG = 10, NCAR = 3, NSMOKE = 3;
const PSPD = 2.2, CARF = 0.74;
const PSTART = [480, 520];
const WALLS = [
  [160, 160], [320, 120], [480, 200], [640, 120], [800, 180],
  [120, 360], [320, 340], [520, 380], [720, 340], [860, 400],
  [200, 560], [400, 580], [560, 520], [700, 600], [840, 560],
  [480, 60], [80, 600], [880, 80],
];
const FLAGSLOTS = [
  [80, 80], [560, 80], [880, 240], [240, 240], [720, 240],
  [80, 440], [400, 460], [640, 440], [880, 660], [240, 660],
];
const CARSTART = [[60, 60], [920, 140], [60, 660]];   // all three verified clear of wall blocks
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  RED = "#ff6666", CYAN = "#7ddfff", STEEL = "#3a5a74", ORANGE = "#ff9d4a";

// 8-way facing from a rounded input pair (only runs when there IS input)
function dirChain(ix, iy, out, pad) {
  return `${pad}if ${ix} != 0 or ${iy} != 0 then
${pad}  if ${ix} == 1 then
${pad}    set ${out} to 0
${pad}    if ${iy} == 1 then
${pad}      set ${out} to 45
${pad}    end
${pad}    if ${iy} == -1 then
${pad}      set ${out} to -45
${pad}    end
${pad}  else
${pad}    if ${ix} == -1 then
${pad}      set ${out} to 180
${pad}      if ${iy} == 1 then
${pad}        set ${out} to 135
${pad}      end
${pad}      if ${iy} == -1 then
${pad}        set ${out} to -135
${pad}      end
${pad}    else
${pad}      if ${iy} == 1 then
${pad}        set ${out} to 90
${pad}      end
${pad}      if ${iy} == -1 then
${pad}        set ${out} to -90
${pad}      end
${pad}    end
${pad}  end
${pad}end`;
}

// one axis of wall-blocked movement for a world-space mover
function axisMove(pad, pxv, pyv, nxExpr, axis, lo, hi) {
  const L = [];
  L.push(`${pad}set nmov to max(${lo}, min(${hi}, ${nxExpr}))`);
  L.push(`${pad}set blocked to 0`);
  L.push(`${pad}set i to 0`);
  L.push(`${pad}repeat ${NWALL}`);
  if (axis === "x") {
    L.push(`${pad}  if abs(nmov - wx[i]) < 30 and abs(${pyv} - wy[i]) < 30 then`);
  } else {
    L.push(`${pad}  if abs(${pxv} - wx[i]) < 30 and abs(nmov - wy[i]) < 30 then`);
  }
  L.push(`${pad}    set blocked to 1`);
  L.push(`${pad}  end`);
  L.push(`${pad}  set i to i + 1`);
  L.push(`${pad}end`);
  L.push(`${pad}if blocked == 0 then`);
  L.push(`${pad}  set ${axis === "x" ? pxv : pyv} to nmov`);
  L.push(`${pad}end`);
  return L.join("\n");
}

export function buildRallyxExample() {
  const L = [];
  const push = (s) => L.push(s);

  const dealStage = (pad) => {
    push(`${pad}set bonus to 0`);
    push(`${pad}if stage % 3 == 0 then`);
    push(`${pad}  set bonus to 1`);
    push(`${pad}end`);
    push(`${pad}set flagsleft to ${NFLAG}`);
    push(`${pad}set flagn to 0`);
    push(`${pad}set mult to 1`);
    push(`${pad}set sflag to floor(rand(0, ${NFLAG}))`);
    for (let i = 0; i < NFLAG; i++) {
      push(`${pad}set fon[${i}] to 1`);
      push(`${pad}set fx[${i}] to ${FLAGSLOTS[i][0]} + rand(-18, 18)`);
      push(`${pad}set fy[${i}] to ${FLAGSLOTS[i][1]} + rand(-18, 18)`);
    }
    push(`${pad}set px to ${PSTART[0]}`);
    push(`${pad}set py to ${PSTART[1]}`);
    push(`${pad}set pang to -90`);
    for (let k = 1; k <= NCAR; k++) {
      push(`${pad}set rx${k} to ${CARSTART[k - 1][0]}`);
      push(`${pad}set ry${k} to ${CARSTART[k - 1][1]}`);
      push(`${pad}set stun${k} to 0`);
    }
    for (let m = 1; m <= NSMOKE; m++) push(`${pad}set smlife${m} to 0`);
    push(`${pad}set fuel to 100`);
    push(`${pad}set dript to 0`);
    push(`${pad}if bonus == 1 then`);
    push(`${pad}  set status.text to "CHALLENGING STAGE — NO RIVALS, EVERY FLAG PAYS DOUBLE"`);
    push(`${pad}  beep 659 for 0.08`);
    push(`${pad}  beep 784 for 0.08`);
    push(`${pad}  beep 988 for 0.12`);
    push(`${pad}else`);
    push(`${pad}  set status.text to "ROUND " + stage + " — 10 FLAGS. THE RED CARS ARE FASTER."`);
    push(`${pad}end`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set endplay to 0");
  push("set lives to 0");
  push("set stage to 1");
  for (let i = 0; i < NWALL; i++) {
    push(`set wx[${i}] to ${WALLS[i][0]}`);
    push(`set wy[${i}] to ${WALLS[i][1]}`);
  }
  dealStage("");
  push('set status.text to ""');
  push("end");

  // ======== click: coin in / back to attract
  push("when click");
  push("if game == 9 then");
  push("  set game to 0");
  push("  set endplay to 0");
  push("  set score to 0");
  push("  set lives to 3");
  push("  set stage to 1");
  dealStage("  ");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  // ======== tick
  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO RACE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO RACE ◎"');
  push("end");

  push("if game == 0 then");
  // ---- the wheel: 8-way pointing, the car never stops
  push(`  set rawx to keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)`);
  push(`  set rawy to keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)`);
  push("  set ix2 to 0");
  push("  if rawx > 0.35 then");
  push("    set ix2 to 1");
  push("  end");
  push("  if rawx < -0.35 then");
  push("    set ix2 to -1");
  push("  end");
  push("  set iy2 to 0");
  push("  if rawy > 0.35 then");
  push("    set iy2 to 1");
  push("  end");
  push("  if rawy < -0.35 then");
  push("    set iy2 to -1");
  push("  end");
  push(dirChain("ix2", "iy2", "pang", "  "));
  // ---- fuel: always falling
  push("  set dript to dript + 1");
  push("  set dripmax to 30");
  push("  if bonus == 1 then");
  push("    set dripmax to 7");
  push("  end");
  push("  if dript >= dripmax then");
  push("    set dript to 0");
  push("    set fuel to max(0, fuel - 1)");
  push("  end");
  // an empty tank in the challenge just ends it, no harm done
  push("  if bonus == 1 and fuel <= 0 then");
  push("    set stage to stage + 1");
  dealStage("    ");
  push("  end");
  // ---- drive (slow when dry)
  push("  set spd to " + PSPD);
  push("  if fuel <= 0 then");
  push("    set spd to 1.1");
  push("  end");
  push(axisMove("  ", "px", "py", "px + cos(pang) * spd", "x", 20, W2 - 20));
  push(axisMove("  ", "px", "py", "py + sin(pang) * spd", "y", 20, H2 - 20));
  // ---- smoke screen (SPACE, costs fuel)
  push('  set pk to keydown("Space")');
  push("  if pk == 1 and pk0 == 0 and fuel > 6 then");
  push("    set fuel to fuel - 6");
  push("    set smn to smn % " + NSMOKE + " + 1");
  for (let m = 1; m <= NSMOKE; m++) {
    push(`    if smn == ${m} then`);
    push(`      set smx${m} to px - cos(pang) * 20`);
    push(`      set smy${m} to py - sin(pang) * 20`);
    push(`      set smlife${m} to 240`);
    push("    end");
  }
  push("    beep 180 for 0.06");
  push("  end");
  push("  set pk0 to pk");
  for (let m = 1; m <= NSMOKE; m++) {
    push(`  if smlife${m} > 0 then`);
    push(`    set smlife${m} to smlife${m} - 1`);
    push("  end");
  }
  // ---- the red cars (parked during the challenge)
  push("  set crash to 0");
  push("  if bonus == 0 then");
  push("    set cs to min(2.6, 1.8 + stage * 0.1)");
  push("    if fuel <= 0 then");
  push("      set cs to cs + 0.3");
  push("    end");
  for (let k = 1; k <= NCAR; k++) {
    push(`    if stun${k} > 0 then`);
    push(`      set stun${k} to stun${k} - 1`);
    push("    else");
    // smoke stuns
    for (let m = 1; m <= NSMOKE; m++) {
      push(`      if smlife${m} > 0 and abs(rx${k} - smx${m}) < 20 and abs(ry${k} - smy${m}) < 20 then`);
      push(`        set stun${k} to 110`);
      push(`        set smlife${m} to 0`);
      push("        beep 90 for 0.1");
      push("      end");
    }
    // seek, axis by axis, sliding along walls
    push(`      set svx${k} to 0`);
    push(`      if px - rx${k} > 3 then`);
    push(`        set svx${k} to 1`);
    push("      end");
    push(`      if px - rx${k} < -3 then`);
    push(`        set svx${k} to -1`);
    push("      end");
    push(`      set svy${k} to 0`);
    push(`      if py - ry${k} > 3 then`);
    push(`        set svy${k} to 1`);
    push("      end");
    push(`      if py - ry${k} < -3 then`);
    push(`        set svy${k} to -1`);
    push("      end");
    const kf = (CARF * (1 - (k - 1) * 0.07)).toFixed(3);   // 1st hungriest, 3rd laziest
    push(axisMove("      ", `rx${k}`, `ry${k}`, `rx${k} + svx${k} * cs * ${kf}`, "x", 20, W2 - 20));
    push(axisMove("      ", `rx${k}`, `ry${k}`, `ry${k} + svy${k} * cs * ${kf}`, "y", 20, H2 - 20));
    push(dirChain(`svx${k}`, `svy${k}`, `rang${k}`, "      "));
    push(`      if abs(rx${k} - px) < 13 and abs(ry${k} - py) < 13 then`);
    push("        set crash to 1");
    push("      end");
    push("    end");
  }
  // rivals hold their own lane: overlapping pairs get pushed apart
  for (const [a, b] of [[1, 2], [1, 3], [2, 3]]) {
    push(`    if abs(rx${b} - rx${a}) < 20 and abs(ry${b} - ry${a}) < 20 then`);
    push(`      set oldbx to rx${b}`);
    push(`      set oldby to ry${b}`);
    push(`      if rx${b} >= rx${a} then`);
    push(`        set rx${b} to min(${W2 - 20}, rx${b} + 3.5)`);
    push("      else");
    push(`        set rx${b} to max(20, rx${b} - 3.5)`);
    push("      end");
    push(`      if ry${b} >= ry${a} then`);
    push(`        set ry${b} to min(${H2 - 20}, ry${b} + 3.5)`);
    push("      else");
    push(`        set ry${b} to max(20, ry${b} - 3.5)`);
    push("      end");
    push("      set i to 0");
    push("      set blocked to 0");
    push(`      repeat ${NWALL}`);
    push(`        if abs(rx${b} - wx[i]) < 30 and abs(ry${b} - wy[i]) < 30 then`);
    push("          set blocked to 1");
    push("        end");
    push("        set i to i + 1");
    push("      end");
    push("      if blocked == 1 then");
    push(`        set rx${b} to oldbx`);
    push(`        set ry${b} to oldby`);
    push("      end");
    push("    end");
  }
  push("  end");
  // ---- a crash
  push("  if crash == 1 then");
  push("    set lives to lives - 1");
  push("    explode playercar");
  push("    beep 80 for 0.35");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "OUT OF CARS — CLICK TO RACE AGAIN"');
  push("    else");
  push(`      set px to ${PSTART[0]}`);
  push(`      set py to ${PSTART[1]}`);
  push("      set pang to -90");
  for (let k = 1; k <= NCAR; k++) {
    push(`      set rx${k} to ${CARSTART[k - 1][0]}`);
    push(`      set ry${k} to ${CARSTART[k - 1][1]}`);
    push(`      set stun${k} to 0`);
  }
  push('      set status.text to "WRECKED — " + lives + " CARS LEFT"');
  push("    end");
  push("  end");
  // ---- flags
  push("  set i to 0");
  push(`  repeat ${NFLAG}`);
  push("    if fon[i] == 1 and abs(px - fx[i]) < 14 and abs(py - fy[i]) < 14 then");
  push("      set fon[i] to 0");
  push("      set flagn to flagn + 1");
  push("      set flagsleft to flagsleft - 1");
  push("      set pay to 100 * flagn * mult");
  push("      if bonus == 1 then");
  push("        set pay to pay * 2");
  push("      end");
  push("      change score by pay");
  push("      beep 520 + flagn * 40 for 0.06");
  push("      if i == sflag then");
  push("        set mult to 2");
  push("        beep 988 for 0.12");
  push('        set status.text to "SPECIAL FLAG — EVERY FLAG NOW PAYS DOUBLE"');
  push("      end");
  push("      if flagsleft == 0 then");
  push("        if bonus == 0 then");
  push("          change score by 1000");
  push("        end");
  push("        set stage to stage + 1");
  dealStage("        ");
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");
  // ---- camera
  push(`  set camx to max(0, min(${W2 - W}, px - ${W / 2}))`);
  push(`  set camy to max(0, min(${H2 - H}, py - ${H / 2}))`);
  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "CARS " + lives');
  push("  if bonus == 1 then");
  push('    set stagetx.text to "CHALLENGE"');
  push("  else");
  push('    set stagetx.text to "ROUND " + stage');
  push("  end");
  push("  set fuelbar.size to max(1, fuel * 1.7)");
  push("  if fuel < 25 then");
  push(`    set fuelbar.color to "${RED}"`);
  push("  else");
  push(`    set fuelbar.color to "${GOLD}"`);
  push("  end");
  push("end");

  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set stagetx.visible to (game != 9)");
  push("set fueltx.visible to (game != 9)");
  push("set fuelbar.visible to (game != 9)");
  push("set radarbg.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const seen = `(game == 0)`;

  // the world's walls, drawn through the camera
  for (let i = 0; i < NWALL; i++) {
    objects.push({
      id: "rx_w" + i, name: "wall" + (i + 1), type: "box",
      x: -100, y: -100, size: 36, color: STEEL, glow: 4, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.x to wx[${i}] - camx
set self.y to wy[${i}] - camy
set self.visible to (${seen} and self.x > -30 and self.x < 510 and self.y > -30 and self.y < 390)
end` }]
    });
  }

  // the ten flags (the special one wears S and shines cyan)
  for (let i = 0; i < NFLAG; i++) {
    objects.push({
      id: "rx_f" + i, name: "flag" + (i + 1), type: "text",
      x: -100, y: -100, size: 15, color: GOLD, glow: 10, visible: 0, text: "F",
      script: [{
        event: "code", source: `when tick
set self.x to fx[${i}] - camx
set self.y to fy[${i}] - camy
set self.visible to (${seen} and fon[${i}] == 1 and self.x > -20 and self.x < 500 and self.y > -20 and self.y < 380)
if ${i} == sflag then
  set self.text to "S"
  set self.color to "${CYAN}"
else
  set self.text to "F"
  set self.color to "${GOLD}"
end
end` }]
    });
  }

  // smoke puffs
  for (let m = 1; m <= NSMOKE; m++) {
    objects.push({
      id: "rx_sm" + m, name: "smoke" + m, type: "ring",
      x: -100, y: -100, size: 14, color: DIM, glow: 8, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.x to smx${m} - camx
set self.y to smy${m} - camy
set self.size to 10 + (240 - smlife${m}) / 24
set self.visible to (${seen} and smlife${m} > 0)
end` }]
    });
  }

  // the red cars
  for (let k = 1; k <= NCAR; k++) {
    objects.push({
      id: "rx_c" + k, name: "redcar" + k, type: "tri",
      x: -100, y: -100, size: 11, color: RED, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.x to rx${k} - camx
set self.y to ry${k} - camy
set self.visible to (${seen} and bonus == 0)
if stun${k} > 0 then
  change self.angle by 24
else
  set self.angle to rang${k}
end
end` }]
    });
  }

  // your car — it never stops driving
  objects.push({
    id: "rx_pc", name: "playercar", type: "tri",
    x: W / 2, y: H / 2, size: 11, color: GREEN, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.x to px - camx
set self.y to py - camy
set self.angle to pang
set self.visible to ${seen}
end` }]
  });

  // the RADAR — the whole war on one glass
  objects.push({
    id: "rx_rb", name: "radarbg", type: "box",
    x: 428, y: 60, size: 92, color: "#0a1512", glow: 2, visible: 0, text: "", script: []
  });
  for (let i = 0; i < NFLAG; i++) {
    objects.push({
      id: "rx_rf" + i, name: "rflag" + (i + 1), type: "dot",
      x: -10, y: -10, size: 2, color: GOLD, glow: 4, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.x to 386 + fx[${i}] * 0.09
set self.y to 18 + fy[${i}] * 0.09
set self.visible to (${seen} and fon[${i}] == 1)
end` }]
    });
  }
  for (let k = 1; k <= NCAR; k++) {
    objects.push({
      id: "rx_rc" + k, name: "rcar" + k, type: "dot",
      x: -10, y: -10, size: 2, color: RED, glow: 5, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.x to 386 + rx${k} * 0.09
set self.y to 18 + ry${k} * 0.09
set self.visible to (${seen} and bonus == 0)
end` }]
    });
  }
  objects.push({
    id: "rx_rp", name: "rplayer", type: "dot",
    x: -10, y: -10, size: 3, color: GREEN, glow: 6, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.x to 386 + px * 0.09
set self.y to 18 + py * 0.09
set self.visible to ${seen}
end` }]
  });

  // HUD
  objects.push({ id: "rx_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "rx_lv", name: "livestx", type: "text", x: 58, y: 44, size: 11, color: DIM, glow: 4, visible: 0, text: "CARS 3", script: [] });
  objects.push({ id: "rx_sg", name: "stagetx", type: "text", x: 240, y: 24, size: 12, color: ORANGE, glow: 6, visible: 0, text: "ROUND 1", script: [] });
  objects.push({ id: "rx_ft", name: "fueltx", type: "text", x: 40, y: 346, size: 10, color: DIM, glow: 4, visible: 0, text: "FUEL", script: [] });
  objects.push({ id: "rx_fb", name: "fuelbar", type: "line", x: 64, y: 346, size: 170, angle: 0, color: GOLD, glow: 8, visible: 0, text: "", script: [] });
  objects.push({ id: "rx_st", name: "status", type: "text", x: W / 2, y: 326, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "rx_big", name: "bigtitle", type: "text", x: W / 2, y: 118, size: 44, color: ORANGE, glow: 18, visible: 1, text: "RALLY-X", script: [] });
  objects.push({ id: "rx_sub", name: "subline", type: "text", x: W / 2, y: 150, size: 10, color: DIM, glow: 4, visible: 1, text: "NAMCO 1980 · SCROLLING MAP · RADAR · EARLY BONUS ROUND", script: [] });
  objects.push({ id: "rx_coin", name: "coinline", type: "text", x: W / 2, y: 182, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO RACE ◎", script: [] });
  objects.push({ id: "rx_play", name: "playbtn", type: "text", x: W / 2, y: 220, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ RACE ]", script: [] });
  objects.push({
    id: "rx_help", name: "help", type: "text",
    x: W / 2, y: 254, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD/STICK POINTS THE CAR · SPACE LAYS SMOKE · 10 FLAGS · WATCH THE RADAR",
    script: []
  });

  objects.push({
    id: "rx_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "rx_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "WHEEL", script: [] });

  return { title: "Rally-X (1980)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

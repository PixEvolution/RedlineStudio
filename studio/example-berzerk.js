// example-berzerk.js — BERZERK (1980), rebuilt in our studio.
//
// Stern Electronics' maze of electrified walls — and one of the first
// games that TALKED. A 30-dollar speech chip (half the cabinet's budget
// per word, the legend goes) barked "INTRUDER ALERT! INTRUDER ALERT!"
// across arcades, and nobody who heard it forgot it. The robots are
// deadly but CLUMSY: they shoot at you, hit each other, and walk into
// the walls — and every robot that dies stupidly still pays YOU. Linger
// too long and the game sends something through the walls to end the
// discussion. Ours calls it THE WARDEN. It cannot be killed. Run.
//
// The 1980 machine, faithfully:
//   · EVERY wall is electrified — brush one and you're gone
//   · 8-way run, 8-way fire (you shoot the way you're facing)
//   · robots aim down rows, columns and diagonals; their lasers and
//     yours both die on the walls — walls are cover AND executioner
//   · robots that collide, or walk into walls, die — and pay you 50
//   · clear every robot for a PERFECT SWEEP bonus; flee early and the
//     machine taunts you on your way out
//   · rooms chain forever through the door gaps; each is meaner
//   · and the machine SPEAKS — watch the screen
//
//   WASD / arrows / stick run · SPACE fires your facing · 3 RUNNERS

const W = 480, H = 360;
const NROB = 8, NRLAS = 2;
const TOP = 48, BOT = 340, LFT = 16, RGT = 464;
const GAPX0 = 212, GAPX1 = 268, GAPY0 = 152, GAPY1 = 208;   // door gaps
const LAYOUTS = [
  [[100, 130, 120, 0], [260, 230, 120, 0], [240, 90, 70, 1], [120, 230, 80, 1]],
  [[140, 100, 100, 1], [340, 160, 100, 1], [180, 200, 140, 0], [60, 280, 100, 0]],
  [[80, 160, 100, 0], [300, 160, 100, 0], [190, 250, 110, 0], [240, 100, 60, 1]],
  [[120, 120, 90, 1], [360, 120, 90, 1], [240, 200, 100, 1], [170, 140, 140, 0]],
  [[120, 110, 240, 0], [120, 270, 240, 0], [90, 160, 70, 1], [390, 160, 70, 1]],
];
const SPOTS = [[60, 70], [420, 70], [60, 320], [420, 320], [300, 300], [180, 310], [330, 90], [150, 70]];
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", RED = "#ff6666",
  CYAN = "#7ddfff", ELEC = "#9fe8ff", GOLD = "#e8c84a";

export function buildBerzerkExample() {
  const L = [];
  const push = (s) => L.push(s);

  // ---- emit: is point (xv, yv) touching any electrified wall? → hitw
  const wallTouch = (pad, xv, yv) => {
    push(`${pad}set hitw to 0`);
    // borders, door gaps excepted
    push(`${pad}if ${yv} < ${TOP + 6} and (${xv} < ${GAPX0} or ${xv} > ${GAPX1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    push(`${pad}if ${yv} > ${BOT - 6} and (${xv} < ${GAPX0} or ${xv} > ${GAPX1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    push(`${pad}if ${xv} < ${LFT + 6} and (${yv} < ${GAPY0} or ${yv} > ${GAPY1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    push(`${pad}if ${xv} > ${RGT - 6} and (${yv} < ${GAPY0} or ${yv} > ${GAPY1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    // interior segments
    push(`${pad}set wi to 0`);
    push(`${pad}repeat 6`);
    push(`${pad}  if won[wi] == 1 then`);
    push(`${pad}    if wvert[wi] == 0 then`);
    push(`${pad}      if abs(${yv} - wy1[wi]) < 7 and ${xv} > wx1[wi] - 4 and ${xv} < wx1[wi] + wlen[wi] + 4 then`);
    push(`${pad}        set hitw to 1`);
    push(`${pad}      end`);
    push(`${pad}    else`);
    push(`${pad}      if abs(${xv} - wx1[wi]) < 7 and ${yv} > wy1[wi] - 4 and ${yv} < wy1[wi] + wlen[wi] + 4 then`);
    push(`${pad}        set hitw to 1`);
    push(`${pad}      end`);
    push(`${pad}    end`);
    push(`${pad}  end`);
    push(`${pad}  set wi to wi + 1`);
    push(`${pad}end`);
  };

  const regenRoom = (pad, enterX, enterY) => {
    push(`${pad}set layout to floor(rand(0, ${LAYOUTS.length}))`);
    for (let l = 0; l < LAYOUTS.length; l++) {
      push(`${pad}if layout == ${l} then`);
      for (let i = 0; i < 6; i++) {
        const seg = LAYOUTS[l][i];
        if (seg) {
          push(`${pad}  set won[${i}] to 1`);
          push(`${pad}  set wx1[${i}] to ${seg[0]}`);
          push(`${pad}  set wy1[${i}] to ${seg[1]}`);
          push(`${pad}  set wlen[${i}] to ${seg[2]}`);
          push(`${pad}  set wvert[${i}] to ${seg[3]}`);
        } else {
          push(`${pad}  set won[${i}] to 0`);
        }
      }
      push(`${pad}end`);
    }
    push(`${pad}set nrob to min(${NROB}, 4 + floor(roomn / 2))`);
    push(`${pad}set robleft to nrob`);
    for (let r = 0; r < NROB; r++) {
      push(`${pad}set ron[${r}] to 0`);
      push(`${pad}if ${r} < nrob then`);
      push(`${pad}  set ron[${r}] to 1`);
      push(`${pad}  set rx[${r}] to ${SPOTS[r][0]} + rand(-8, 8)`);
      push(`${pad}  set ry[${r}] to ${SPOTS[r][1]} + rand(-6, 6)`);
      push(`${pad}  set rf[${r}] to 90 + rand(0, 90)`);
      push(`${pad}end`);
    }
    for (let k = 0; k < NRLAS; k++) push(`${pad}set rlon[${k}] to 0`);
    push(`${pad}set plas to 0`);
    push(`${pad}set wardon to 0`);
    push(`${pad}set wtim to 0`);
    push(`${pad}set px to ${enterX}`);
    push(`${pad}set py to ${enterY}`);
    push(`${pad}set grace to 40`);
    push(`${pad}say "INTRUDER ALERT! INTRUDER ALERT!" for 1.4`);
    push(`${pad}beep 220 for 0.07`);
    push(`${pad}beep 165 for 0.07`);
    push(`${pad}beep 220 for 0.07`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set roomn to 1`);
    push(`${pad}set fdx to 1`);
    push(`${pad}set fdy to 0`);
    regenRoom(pad, 40, 180);
    push(`${pad}set status.text to "EVERY WALL IS LIVE. THE ROBOTS ARE CLUMSY."`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set roomn to 1");
  push("set fdx to 1");
  push("set fdy to 0");
  regenRoom("", 40, 180);
  push('set status.text to ""');
  push("end");

  // ======== click
  push("when click");
  push("if game == 9 then");
  startMatch("  ");
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO INTRUDE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO INTRUDE ◎"');
  push("end");

  push("if game == 0 then");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  // ---- 8-way run; your facing is where you last ran
  push(`  set mvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  set mvy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push("  set ix2 to 0");
  push("  if mvx > 0.35 then");
  push("    set ix2 to 1");
  push("  end");
  push("  if mvx < -0.35 then");
  push("    set ix2 to -1");
  push("  end");
  push("  set iy2 to 0");
  push("  if mvy > 0.35 then");
  push("    set iy2 to 1");
  push("  end");
  push("  if mvy < -0.35 then");
  push("    set iy2 to -1");
  push("  end");
  push("  if ix2 != 0 or iy2 != 0 then");
  push("    set fdx to ix2");
  push("    set fdy to iy2");
  push("  end");
  push("  change px by ix2 * 2.4");
  push("  change py by iy2 * 2.4");

  // ---- the doors (checked before the walls bite)
  push("  set wentout to 0");
  push(`  if px < 10 and py > ${GAPY0} and py < ${GAPY1} then`);
  push("    set wentout to 1");
  push("    set nx to 446");
  push("    set ny to 180");
  push("  end");
  push(`  if px > ${W - 10} and py > ${GAPY0} and py < ${GAPY1} then`);
  push("    set wentout to 1");
  push("    set nx to 34");
  push("    set ny to 180");
  push("  end");
  push(`  if py < 42 and px > ${GAPX0} and px < ${GAPX1} then`);
  push("    set wentout to 1");
  push("    set nx to 240");
  push("    set ny to 326");
  push("  end");
  push(`  if py > ${H - 8} and px > ${GAPX0} and px < ${GAPX1} then`);
  push("    set wentout to 1");
  push("    set nx to 240");
  push("    set ny to 62");
  push("  end");
  push("  if wentout == 1 then");
  push("    if robleft > 0 then");
  push('      say "FLEEING? FIGHT LIKE A ROBOT!" for 1.4');
  push("      beep 147 for 0.1");
  push("      beep 110 for 0.14");
  push("    else");
  push('      say "THE INTRUDER ESCAPES... FOR NOW" for 1.2');
  push("    end");
  push("    set roomn to roomn + 1");
  regenRoom("    ", "nx", "ny");
  push("  end");

  // ---- the walls bite (after your grace runs out)
  push("  set pdie to 0");
  wallTouch("  ", "px", "py");
  push("  if hitw == 1 and grace <= 0 then");
  push("    set pdie to 1");
  push("    beep 90 for 0.4");
  push('    say "ZZZT." for 0.8');
  push("  end");

  // ---- your laser (one, down your facing)
  push('  set pf to keydown("Space")');
  push("  if pf == 1 and pf0 == 0 and plas == 0 then");
  push("    set plas to 1");
  push("    set plx to px + fdx * 10");
  push("    set ply to py + fdy * 10");
  push("    set plvx to fdx * 5.5");
  push("    set plvy to fdy * 5.5");
  push("    beep 760 for 0.04");
  push("  end");
  push("  set pf0 to pf");
  push("  if plas == 1 then");
  push("    change plx by plvx");
  push("    change ply by plvy");
  wallTouch("    ", "plx", "ply");
  push("    if hitw == 1 then");
  push("      set plas to 0");
  push("    end");
  push("  end");

  // ---- the robots: deadly, slow, and CLUMSY
  push("  set rtick to rtick + 1");
  push("  set rcad to max(2, 4 - floor(roomn / 3))");
  for (let r = 0; r < NROB; r++) {
    push(`  if ron[${r}] == 1 then`);
    // shuffle toward the intruder on the cadence
    push(`    if rtick % rcad == 0 then`);
    push(`      if px - rx[${r}] > 6 then`);
    push(`        change rx[${r}] by 1.6`);
    push("      end");
    push(`      if px - rx[${r}] < -6 then`);
    push(`        change rx[${r}] by -1.6`);
    push("      end");
    push(`      if py - ry[${r}] > 6 then`);
    push(`        change ry[${r}] by 1.6`);
    push("      end");
    push(`      if py - ry[${r}] < -6 then`);
    push(`        change ry[${r}] by -1.6`);
    push("      end");
    push("    end");
    // clumsy: the walls kill robots too — and pay you
    wallTouch("    ", `rx[${r}]`, `ry[${r}]`);
    push("    if hitw == 1 then");
    push(`      set ron[${r}] to 0`);
    push(`      explode robot${r + 1}`);
    push("      set robleft to robleft - 1");
    push("      change score by 50");
    push("      beep 140 for 0.12");
    push("    end");
    // your laser
    push(`    if ron[${r}] == 1 and plas == 1 and abs(plx - rx[${r}]) < 12 and abs(ply - ry[${r}]) < 12 then`);
    push("      set plas to 0");
    push(`      set ron[${r}] to 0`);
    push(`      explode robot${r + 1}`);
    push("      set robleft to robleft - 1");
    push("      change score by 50");
    push("      beep 140 for 0.12");
    push("    end");
    // aligned on a row, column or diagonal → it fires (if a slot is free)
    push(`    if ron[${r}] == 1 then`);
    push(`      set rf[${r}] to rf[${r}] - 1`);
    push(`      if rf[${r}] <= 0 then`);
    push(`        set rf[${r}] to max(70, 150 - roomn * 8) + rand(0, 60)`);
    push(`        set adx to px - rx[${r}]`);
    push(`        set ady to py - ry[${r}]`);
    push("        set sdx to 0");
    push("        set sdy to 0");
    push("        if abs(adx) < 14 then");
    push("          set sdy to 1");
    push("          if ady < 0 then");
    push("            set sdy to -1");
    push("          end");
    push("        else");
    push("          if abs(ady) < 14 then");
    push("            set sdx to 1");
    push("            if adx < 0 then");
    push("              set sdx to -1");
    push("            end");
    push("          else");
    push("            if abs(abs(adx) - abs(ady)) < 14 then");
    push("              set sdx to 1");
    push("              if adx < 0 then");
    push("                set sdx to -1");
    push("              end");
    push("              set sdy to 1");
    push("              if ady < 0 then");
    push("                set sdy to -1");
    push("              end");
    push("            end");
    push("          end");
    push("        end");
    push("        if sdx != 0 or sdy != 0 then");
    for (let k = 0; k < NRLAS; k++) {
      push(`          if rlon[${k}] == 0 and sdx + sdy != 9 then`);
      push(`            set rlon[${k}] to 1`);
      push(`            set rlx[${k}] to rx[${r}]`);
      push(`            set rly[${k}] to ry[${r}]`);
      push(`            set rlvx[${k}] to sdx * 4.2`);
      push(`            set rlvy[${k}] to sdy * 4.2`);
      push("            set sdx to 9");
      push("            set sdy to 0");
      push("            beep 620 for 0.05");
      push("          end");
    }
    push("        end");
    push("      end");
    push("    end");
    // a robot that reaches you takes you with it
    push(`    if ron[${r}] == 1 and grace <= 0 and abs(rx[${r}] - px) < 11 and abs(ry[${r}] - py) < 11 then`);
    push(`      set ron[${r}] to 0`);
    push(`      explode robot${r + 1}`);
    push("      set robleft to robleft - 1");
    push("      change score by 50");
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }
  // clumsier still: robots grind each other up
  for (let a = 0; a < NROB; a++) {
    for (let b = a + 1; b < NROB; b++) {
      push(`  if ron[${a}] == 1 and ron[${b}] == 1 and abs(rx[${a}] - rx[${b}]) < 10 and abs(ry[${a}] - ry[${b}]) < 10 then`);
      push(`    set ron[${a}] to 0`);
      push(`    set ron[${b}] to 0`);
      push(`    explode robot${a + 1}`);
      push(`    explode robot${b + 1}`);
      push("    set robleft to robleft - 2");
      push("    change score by 100");
      push("    beep 140 for 0.12");
      push("  end");
    }
  }
  // the sweep bonus
  push("  if robleft <= 0 and sweptroom != roomn then");
  push("    set sweptroom to roomn");
  push("    change score by nrob * 10");
  push('    say "PERFECT SWEEP +" + nrob * 10 for 1.2');
  push("    beep 659 for 0.08");
  push("    beep 988 for 0.12");
  push("  end");

  // ---- robot lasers
  for (let k = 0; k < NRLAS; k++) {
    push(`  if rlon[${k}] == 1 then`);
    push(`    change rlx[${k}] by rlvx[${k}]`);
    push(`    change rly[${k}] by rlvy[${k}]`);
    wallTouch("    ", `rlx[${k}]`, `rly[${k}]`);
    push("    if hitw == 1 then");
    push(`      set rlon[${k}] to 0`);
    push("    end");
    push(`    if rlon[${k}] == 1 and grace <= 0 and abs(rlx[${k}] - px) < 10 and abs(rly[${k}] - py) < 10 then`);
    push(`      set rlon[${k}] to 0`);
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }

  // ---- THE WARDEN: it waits, then it comes through the walls
  push("  set wtim to wtim + 1");
  push("  if wardon == 0 and wtim > 720 then");
  push("    set wardon to 1");
  push("    set wardx to 0");
  push("    set wardy to 180");
  push('    say "THE WARDEN COMES." for 1.4');
  push("    beep 98 for 0.2");
  push("    beep 98 for 0.2");
  push("  end");
  push("  if wardon == 1 then");
  push("    set wspd to 1.2");
  push("    if robleft <= 0 then");
  push("      set wspd to 2.1");
  push("    end");
  push("    if px > wardx then");
  push("      change wardx by wspd");
  push("    else");
  push("      change wardx by 0 - wspd");
  push("    end");
  push("    if py > wardy then");
  push("      change wardy by wspd * 0.8");
  push("    else");
  push("      change wardy by 0 - wspd * 0.8");
  push("    end");
  push("    if wtim % 30 == 0 then");
  push("      beep 196 for 0.06");
  push("    end");
  push("    if grace <= 0 and abs(wardx - px) < 13 and abs(wardy - py) < 13 then");
  push("      set pdie to 1");
  push("    end");
  push("  end");

  // ---- death and the end
  push("  if pdie == 1 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode runner");
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      say "GOT THE INTRUDER." for 1.5');
  push('      set status.text to "GOT THE INTRUDER — CLICK TO INTRUDE AGAIN"');
  push("    else");
  push("      set roomn to roomn + 1");
  regenRoom("      ", 40, 180);
  push('      set status.text to lives + " RUNNERS LEFT"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "RUNNERS " + lives');
  push('  set roomtx.text to "ROOM " + roomn');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set roomtx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";
  const elec = (extra = "") => `when tick
set self.visible to ${inGame}${extra}
set self.glow to 5 + sin(time() * 240 + self.x + self.y) * 3
end`;

  // the electrified borders, doors gapped
  const borders = [
    ["borderTa", LFT, TOP, GAPX0 - LFT, 0], ["borderTb", GAPX1, TOP, RGT - GAPX1, 0],
    ["borderBa", LFT, BOT, GAPX0 - LFT, 0], ["borderBb", GAPX1, BOT, RGT - GAPX1, 0],
    ["borderLa", LFT, TOP, GAPY0 - TOP, 1], ["borderLb", LFT, GAPY1, BOT - GAPY1, 1],
    ["borderRa", RGT, TOP, GAPY0 - TOP, 1], ["borderRb", RGT, GAPY1, BOT - GAPY1, 1],
  ];
  borders.forEach(([name, x, y, len, vert], i) => {
    objects.push({
      id: "bk_b" + i, name, type: "line",
      x, y, size: len, angle: vert ? 90 : 0, color: ELEC, glow: 5, visible: 0, text: "",
      script: [{ event: "code", source: elec() }]
    });
  });
  // the interior walls (configured each room)
  for (let i = 0; i < 6; i++) {
    objects.push({
      id: "bk_w" + i, name: "wall" + (i + 1), type: "line",
      x: -50, y: -50, size: 10, angle: 0, color: ELEC, glow: 5, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and won[${i}] == 1)
set self.x to wx1[${i}]
set self.y to wy1[${i}]
set self.size to wlen[${i}]
set self.angle to wvert[${i}] * 90
set self.glow to 5 + sin(time() * 240 + ${i * 50}) * 3
end` }]
    });
  }

  // the robots
  for (let r = 0; r < NROB; r++) {
    objects.push({
      id: "bk_r" + r, name: "robot" + (r + 1), type: "text",
      x: -50, y: -50, size: 15, color: GREEN, glow: 9, visible: 0, text: "[∩]",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and ron[${r}] == 1)
set self.x to rx[${r}]
set self.y to ry[${r}]
end` }]
    });
  }
  // their lasers, your laser
  for (let k = 0; k < NRLAS; k++) {
    objects.push({
      id: "bk_rl" + k, name: "robolaser" + (k + 1), type: "dot",
      x: -50, y: -50, size: 3, color: RED, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and rlon[${k}] == 1)
set self.x to rlx[${k}]
set self.y to rly[${k}]
end` }]
    });
  }
  objects.push({
    id: "bk_pl", name: "yourlaser", type: "dot",
    x: -50, y: -50, size: 3, color: CYAN, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and plas == 1)
set self.x to plx
set self.y to ply
end` }]
  });

  // the runner (flickers while the entry grace holds)
  objects.push({
    id: "bk_p", name: "runner", type: "box",
    x: 40, y: 180, size: 11, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4))
set self.x to px
set self.y to py
end` }]
  });

  // THE WARDEN — it does not use the doors
  objects.push({
    id: "bk_wd", name: "warden", type: "ring",
    x: -60, y: -60, size: 13, color: RED, glow: 16, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and wardon == 1)
set self.x to wardx
set self.y to wardy
set self.size to 12 + sin(time() * 500) * 3
end` }]
  });

  // HUD
  objects.push({ id: "bk_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "bk_lv", name: "livestx", type: "text", x: 414, y: 22, size: 12, color: DIM, glow: 4, visible: 0, text: "RUNNERS 3", script: [] });
  objects.push({ id: "bk_rm", name: "roomtx", type: "text", x: 240, y: 24, size: 12, color: GOLD, glow: 6, visible: 0, text: "ROOM 1", script: [] });
  objects.push({ id: "bk_st", name: "status", type: "text", x: W / 2, y: 352, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "bk_big", name: "bigtitle", type: "text", x: W / 2, y: 112, size: 42, color: RED, glow: 18, visible: 1, text: "BERZERK", script: [] });
  objects.push({ id: "bk_sub", name: "subline", type: "text", x: W / 2, y: 144, size: 10, color: DIM, glow: 4, visible: 1, text: "STERN 1980 · AMONG THE FIRST TALKING GAMES", script: [] });
  objects.push({ id: "bk_coin", name: "coinline", type: "text", x: W / 2, y: 176, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO INTRUDE ◎", script: [] });
  objects.push({ id: "bk_play", name: "playbtn", type: "text", x: W / 2, y: 214, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ INTRUDE ]", script: [] });
  objects.push({
    id: "bk_help", name: "help", type: "text",
    x: W / 2, y: 248, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD RUNS · SPACE FIRES YOUR FACING · WALLS KILL",
    script: []
  });

  objects.push({
    id: "bk_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "bk_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "RUNNER", script: [] });

  return { title: "Berzerk (1980)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

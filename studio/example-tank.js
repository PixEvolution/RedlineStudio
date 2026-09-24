// example-tank.js — TANK (1974), rebuilt in our studio.
// The smash hit from Kee Games (Atari's "competitor" that was secretly Atari
// itself), and the first arcade game to store its graphics on ROM chips —
// which is why its walls are solid white chunks instead of dots. Two tanks
// in a blocky battlefield: turn, drive, and shell each other. Walls block
// tanks AND shells, and the strip of mines down the middle kills anyone who
// drives over one — a point for the enemy. Most kills when the coin runs out.
//
//   YOU (green): A/D turn · W/S drive · SPACE fire
//   Pick 1 PLAYER to fight the drone, or 2 PLAYERS for the real thing:
//   P2 (amber): arrow keys turn/drive · ENTER fire
//   One shell in the air per tank, just like the cabinet. Getting killed
//   respawns you at your corner (briefly stunned). The coin buys ~60 seconds.

const T = 3600;                                    // ~60 seconds per coin
const P1 = { x: 60, y: 300, a: -90 };              // spawns: opposite corners
const P2 = { x: 420, y: 70, a: 90 };

// the battlefield: solid blocks (cx, cy, w, h), 180°-symmetric like the original
const RECTS = [
  [130, 110, 40, 40], [350, 260, 40, 40],
  [130, 260, 40, 20], [350, 110, 40, 20],
  [70, 185, 20, 60],  [410, 185, 20, 60],
  [200, 70, 60, 20],  [280, 300, 60, 20],
  [190, 220, 20, 40], [290, 150, 20, 40]
];
const MINES = [[240, 90], [240, 150], [240, 220], [240, 280]];

const TURN = 2.6, FWD = 1.5, REV = 0.6;            // REV is a fraction of FWD
const SHELL = 5.5, AI_TURN = 2.2, AI_FWD = 1.3;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a", WALLC = "#dfe9ee";

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const respawn = (nm, p, pad) => {
    push(`${pad}set ${nm}.x to ${p.x}`);
    push(`${pad}set ${nm}.y to ${p.y}`);
    push(`${pad}set ${nm}.angle to ${p.a}`);
  };

  // walls for a tank: revert an illegal move (the gotcha pattern)
  const tankWalls = (nm, other, pad) => {
    const rev = () => {
      push(`${pad}  set ${nm}.x to oldx`);
      push(`${pad}  set ${nm}.y to oldy`);
    };
    push(`${pad}if ${nm}.x < 44 or ${nm}.x > 436 or ${nm}.y < 60 or ${nm}.y > 310 then`);
    rev();
    push(`${pad}end`);
    for (const [cx, cy, w, h] of RECTS) {
      push(`${pad}if abs(${nm}.x - ${cx}) < ${w / 2 + 8} and abs(${nm}.y - ${cy}) < ${h / 2 + 8} then`);
      rev();
      push(`${pad}end`);
    }
    push(`${pad}if dist(${nm}, ${other}) < 18 then`);
    rev();
    push(`${pad}end`);
  };

  // the drone brain: turn toward the target, drive when it's ahead,
  // fire when lined up. No trig tables — just the cross product.
  const aiDrive = (me, tgt, go, slive, sa, shot, cool, pad) => {
    push(`${pad}set dx to ${tgt}.x - ${me}.x`);
    push(`${pad}set dy to ${tgt}.y - ${me}.y`);
    push(`${pad}set hx to cos(${me}.angle)`);
    push(`${pad}set hy to sin(${me}.angle)`);
    push(`${pad}set cr to hx * dy - hy * dx`);
    push(`${pad}set dt to hx * dx + hy * dy`);
    push(`${pad}if cr > 0 then`);
    push(`${pad}  change ${me}.angle by ${AI_TURN}`);
    push(`${pad}else`);
    push(`${pad}  change ${me}.angle by -${AI_TURN}`);
    push(`${pad}end`);
    push(`${pad}if dt > 30 then`);
    push(`${pad}  set ${go} to ${AI_FWD / FWD}`);
    push(`${pad}end`);
    push(`${pad}if dt > 0 and abs(cr) < 0.22 * (abs(dx) + abs(dy)) and ${cool} <= 0 and ${slive} == 0 then`);
    push(`${pad}  set ${slive} to 1`);
    push(`${pad}  set ${sa} to ${me}.angle`);
    push(`${pad}  set ${shot}.x to ${me}.x + cos(${me}.angle) * 14`);
    push(`${pad}  set ${shot}.y to ${me}.y + sin(${me}.angle) * 14`);
    push(`${pad}  set ${shot}.visible to 1`);
    push(`${pad}  set ${cool} to 55`);
    push(`${pad}  beep 240 for 0.05`);
    push(`${pad}end`);
  };

  // a shell in flight: walls kill it, the enemy tank ends the story
  const shellFly = (slive, sa, shot, victim, killerScore, victimSpawn, victimStun, pad) => {
    push(`${pad}if ${slive} == 1 then`);
    push(`${pad}  change ${shot}.x by cos(${sa}) * ${SHELL}`);
    push(`${pad}  change ${shot}.y by sin(${sa}) * ${SHELL}`);
    push(`${pad}  set sdead to 0`);
    push(`${pad}  if ${shot}.x < 38 or ${shot}.x > 442 or ${shot}.y < 54 or ${shot}.y > 316 then`);
    push(`${pad}    set sdead to 1`);
    push(`${pad}  end`);
    for (const [cx, cy, w, h] of RECTS) {
      push(`${pad}  if abs(${shot}.x - ${cx}) < ${w / 2 + 3} and abs(${shot}.y - ${cy}) < ${h / 2 + 3} then`);
      push(`${pad}    set sdead to 1`);
      push(`${pad}  end`);
    }
    push(`${pad}  if dist(${shot}, ${victim}) < 13 then`);
    push(`${pad}    explode ${victim}`);
    push(`${pad}    beep 80 for 0.35`);
    push(`${pad}    change ${killerScore} by 1`);
    respawn(victim, victimSpawn, pad + "    ");
    push(`${pad}    set ${victimStun} to 40`);
    push(`${pad}    set sdead to 1`);
    push(`${pad}  end`);
    push(`${pad}  if sdead == 1 then`);
    push(`${pad}    set ${slive} to 0`);
    push(`${pad}    set ${shot}.visible to 0`);
    push(`${pad}  end`);
    push(`${pad}end`);
  };

  push("when start");
  push("set game to 9");
  push("set mode to 1");
  push("set endplay to 0");
  push("set p1s to 0");
  push("set p2s to 0");
  push("set s1live to 0");
  push("set s2live to 0");
  push("set cool1 to 0");
  push("set cool2 to 0");
  push("set stun1 to 0");
  push("set stun2 to 0");
  respawn("tank1", P1, "");
  respawn("tank2", P2, "");
  push("end");

  push("when tick");
  // marquee & HUD visibility
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set onep.visible to (game == 9)");
  push("set twop.visible to (game == 9)");
  push("set p1tx.visible to (game != 9)");
  push("set p2tx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set statusline.visible to (game == 2)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PICK A MODE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — PICK A MODE ◎"');
  push("end");
  push('set p1tx.text to "YOU " + p1s');
  push("if mode == 1 then");
  push('  set p2tx.text to "DRONE " + p2s');
  push("else");
  push('  set p2tx.text to "P2 " + p2s');
  push("end");
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60))');
  push("set score to p1s");   // the reserved var → the HIGH SCORES table

  push("if game != 2 then");
  push("  set stun1 to max(0, stun1 - 1)");
  push("  set stun2 to max(0, stun2 - 1)");
  push("  set cool1 to max(0, cool1 - 1)");
  push("  set cool2 to max(0, cool2 - 1)");
  push("  set go1 to 0");
  push("  set go2 to 0");
  push("  set ai1 to (game == 9)");
  push("  set ai2 to (game == 9 or mode == 1)");

  // YOUR treads (the drone drives tank1 on the attract reel)
  push("  if game == 0 and stun1 == 0 then");
  push('    if keydown("a") then');
  push(`      change tank1.angle by -${TURN}`);
  push("    end");
  push('    if keydown("d") then');
  push(`      change tank1.angle by ${TURN}`);
  push("    end");
  push('    if keydown("w") then');
  push("      set go1 to 1");
  push("    end");
  push('    if keydown("s") then');
  push(`      set go1 to -${REV}`);
  push("    end");
  push("  end");
  push("  if ai1 == 1 and stun1 == 0 then");
  aiDrive("tank1", "tank2", "go1", "s1live", "s1a", "shot1", "cool1", "    ");
  push("  end");

  // THEIR treads: the drone, or player 2 on the arrows
  push("  if game == 0 and mode == 2 and stun2 == 0 then");
  push('    if keydown("ArrowLeft") then');
  push(`      change tank2.angle by -${TURN}`);
  push("    end");
  push('    if keydown("ArrowRight") then');
  push(`      change tank2.angle by ${TURN}`);
  push("    end");
  push('    if keydown("ArrowUp") then');
  push("      set go2 to 1");
  push("    end");
  push('    if keydown("ArrowDown") then');
  push(`      set go2 to -${REV}`);
  push("    end");
  push("  end");
  push("  if ai2 == 1 and stun2 == 0 then");
  aiDrive("tank2", "tank1", "go2", "s2live", "s2a", "shot2", "cool2", "    ");
  push("  end");

  // tank 1 moves — walls say no
  push("  set oldx to tank1.x");
  push("  set oldy to tank1.y");
  push(`  change tank1.x by cos(tank1.angle) * go1 * ${FWD}`);
  push(`  change tank1.y by sin(tank1.angle) * go1 * ${FWD}`);
  tankWalls("tank1", "tank2", "  ");
  push("  if ai1 == 1 and go1 != 0 and tank1.x == oldx and tank1.y == oldy then");
  push("    change tank1.angle by 17");   // the drone noses along a wall
  push("  end");

  // tank 2 moves
  push("  set oldx to tank2.x");
  push("  set oldy to tank2.y");
  push(`  change tank2.x by cos(tank2.angle) * go2 * ${FWD}`);
  push(`  change tank2.y by sin(tank2.angle) * go2 * ${FWD}`);
  tankWalls("tank2", "tank1", "  ");
  push("  if ai2 == 1 and go2 != 0 and tank2.x == oldx and tank2.y == oldy then");
  push("    change tank2.angle by 17");
  push("  end");

  // the MOTOR: a live rumble — deeper at idle, harder under way
  push("  if game == 0 and timeleft % 4 == 0 then");
  push("    beep 44 + abs(go1) * 22 for 0.05");
  push("  end");

  // shells in flight
  shellFly("s1live", "s1a", "shot1", "tank2", "p1s", P2, "stun2", "  ");
  shellFly("s2live", "s2a", "shot2", "tank1", "p2s", P1, "stun1", "  ");

  // the minefield: drive over one and the ENEMY takes the point
  MINES.forEach((m, i) => {
    push(`  if stun1 == 0 and dist(tank1, mine${i + 1}) < 12 then`);
    push("    explode tank1");
    push("    beep 80 for 0.35");
    push("    change p2s by 1");
    respawn("tank1", P1, "    ");
    push("    set stun1 to 40");
    push("  end");
    push(`  if stun2 == 0 and dist(tank2, mine${i + 1}) < 12 then`);
    push("    explode tank2");
    push("    beep 80 for 0.35");
    push("    change p1s by 1");
    respawn("tank2", P2, "    ");
    push("    set stun2 to 40");
    push("  end");
  });
  push("end");

  // the quarter runs out
  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 150 for 0.5");
  push("    if mode == 1 then");
  push('      set statusline.text to "YOU " + p1s + " — DRONE " + p2s + " · CLICK"');
  push("    else");
  push('      set statusline.text to "P1 " + p1s + " — P2 " + p2s + " · CLICK"');
  push("    end");
  push("  end");
  push("end");
  push("end");

  // your trigger (one shell in the air, like the cabinet)
  push('when key "Space"');
  push("if game == 0 and stun1 == 0 and s1live == 0 then");
  push("  set s1live to 1");
  push("  set s1a to tank1.angle");
  push("  set shot1.x to tank1.x + cos(tank1.angle) * 14");
  push("  set shot1.y to tank1.y + sin(tank1.angle) * 14");
  push("  set shot1.visible to 1");
  push("  beep 240 for 0.05");
  push("end");
  push("end");

  // player 2's trigger
  push('when key "Enter"');
  push("if game == 0 and mode == 2 and stun2 == 0 and s2live == 0 then");
  push("  set s2live to 1");
  push("  set s2a to tank2.angle");
  push("  set shot2.x to tank2.x + cos(tank2.angle) * 14");
  push("  set shot2.y to tank2.y + sin(tank2.angle) * 14");
  push("  set shot2.visible to 1");
  push("  beep 240 for 0.05");
  push("end");
  push("end");

  const startRace = (pad, m) => {
    push(`${pad}set game to 0`);
    push(`${pad}set mode to ${m}`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set p1s to 0`);
    push(`${pad}set p2s to 0`);
    push(`${pad}set s1live to 0`);
    push(`${pad}set s2live to 0`);
    push(`${pad}set shot1.visible to 0`);
    push(`${pad}set shot2.visible to 0`);
    push(`${pad}set stun1 to 0`);
    push(`${pad}set stun2 to 0`);
    push(`${pad}set timeleft to ${T}`);
    respawn("tank1", P1, pad);
    respawn("tank2", P2, pad);
  };

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 170) < 65 and abs(mousey() - 232) < 16 then");
  startRace("    ", 1);
  push("  end");
  push("  if abs(mousex() - 310) < 65 and abs(mousey() - 232) < 16 then");
  startRace("    ", 2);
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  respawn("tank1", P1, "    ");
  respawn("tank2", P2, "    ");
  push("    set s1live to 0");
  push("    set s2live to 0");
  push("    set shot1.visible to 0");
  push("    set shot2.visible to 0");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildTankExample() {
  const objects = [];
  let w = 0;
  const block = (x, y, size) => {
    w++;
    objects.push({
      id: "tk_w" + w, name: "wall" + w, type: "box",
      x, y, size, color: WALLC, glow: 2, visible: 1, text: "", script: []
    });
  };

  // the mines, down the middle — drawn as the original's little crosses
  MINES.forEach(([x, y], i) => {
    objects.push({
      id: "tk_m" + (i + 1), name: "mine" + (i + 1), type: "text",
      x, y, size: 11, color: "#aab6c0", glow: 2, visible: 1, text: "✕", script: []
    });
  });

  // the tanks — the brain rides on yours
  objects.push({
    id: "tk_t1", name: "tank1", type: "tri",
    x: P1.x, y: P1.y, size: 13, angle: P1.a, color: GREEN, glow: 10, visible: 1, text: "",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({
    id: "tk_t2", name: "tank2", type: "tri",
    x: P2.x, y: P2.y, size: 13, angle: P2.a, color: AMBER, glow: 10, visible: 1, text: "",
    script: []
  });

  // the shells
  objects.push({
    id: "tk_s1", name: "shot1", type: "dot",
    x: -20, y: -20, size: 4, color: WHITE, glow: 8, visible: 0, text: "", script: []
  });
  objects.push({
    id: "tk_s2", name: "shot2", type: "dot",
    x: -20, y: -20, size: 4, color: WHITE, glow: 8, visible: 0, text: "", script: []
  });

  // HUD
  objects.push({
    id: "tk_p1", name: "p1tx", type: "text",
    x: 100, y: 22, size: 12, color: GREEN, glow: 8, visible: 0, text: "YOU 0", script: []
  });
  objects.push({
    id: "tk_tm", name: "timetx", type: "text",
    x: 240, y: 22, size: 12, color: WHITE, glow: 8, visible: 0, text: "TIME 60", script: []
  });
  objects.push({
    id: "tk_p2", name: "p2tx", type: "text",
    x: 380, y: 22, size: 12, color: AMBER, glow: 8, visible: 0, text: "DRONE 0", script: []
  });

  // the marquee
  objects.push({
    id: "tk_big", name: "bigtitle", type: "text",
    x: 240, y: 150, size: 30, color: WHITE, glow: 16, visible: 1, text: "TANK", script: []
  });
  objects.push({
    id: "tk_coin", name: "coinline", type: "text",
    x: 240, y: 180, size: 10, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — PICK A MODE ◎", script: []
  });
  objects.push({
    id: "tk_1p", name: "onep", type: "text",
    x: 170, y: 232, size: 13, color: GREEN, glow: 12, visible: 1, text: "[ 1 PLAYER ]", script: []
  });
  objects.push({
    id: "tk_2p", name: "twop", type: "text",
    x: 310, y: 232, size: 13, color: AMBER, glow: 12, visible: 1, text: "[ 2 PLAYERS ]", script: []
  });
  objects.push({
    id: "tk_status", name: "statusline", type: "text",
    x: 240, y: 180, size: 11, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });

  objects.push({
    id: "tk_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "KEE GAMES 1974 · A/D TURN · W/S DRIVE · SPACE FIRE · P2: ARROWS + ENTER",
    script: []
  });

  // the battlefield, in solid ROM-chip chunks: the border...
  for (let x = 24; x <= 456; x += 24) { block(x, 40, 24); block(x, 330, 24); }
  for (let y = 64; y <= 306; y += 24) { block(24, y, 24); block(456, y, 24); }
  // ...and the blocks, each rectangle laid from squares
  for (const [cx, cy, rw, rh] of RECTS) {
    const s = Math.min(rw, rh);
    for (let i = 0; i < rw / s; i++) {
      for (let j = 0; j < rh / s; j++) {
        block(cx - rw / 2 + s / 2 + i * s, cy - rh / 2 + s / 2 + j * s, s);
      }
    }
  }

  return { title: "Tank (1974)", objects };
}

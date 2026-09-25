// example-westerngun.js — WESTERN GUN (1975), rebuilt in our studio.
// Tomohiro Nishikado's ORIGINAL at Taito — the game Midway licensed and
// rebuilt on a microprocessor as Gun Fight. This one is the hardwired
// version: transistor-transistor logic, no CPU anywhere — and it plays
// meaner than its famous American cousin:
//
//   · FREE ROAMING — no halves. Either cowboy can walk the whole desert,
//     rush the other man, or circle behind the cover.
//   · ROCKS that RICOCHET — bullets bounce off the rocks, and a bounced
//     bullet is nobody's friend: it will drop the man who FIRED it.
//   · CACTI that shoot APART — one hit shrinks a cactus, the next one
//     clears it. Cover is a budget you spend.
//   · The aim stick is vertical-only, and your gun points the way you're
//     FACING — walk left and you shoot left. (Midway widened the aim and
//     fenced the players into their own sides; Taito trusted the chaos.)
//
//   P1: WASD move · Q/E tilt · SPACE fire   (sticks 1 + 2)
//   P2: arrows move · , / . tilt · ENTER fire  (sticks 3 + 4)
//
// Same big 800×600 world as Gun Fight — a desert, not a corridor.

const W = 800, H = 600;
const T = 5400;
const SPD = 2.6, BSPD = 9;
const TILT = 2.5, TMAX = 35;
const AMMO = 6, RELOAD = 110, STUN = 70;
const Y_TOP = 70, Y_BOT = 530, X_MIN = 40, X_MAX = 760;
const CACTI = [[300, 170], [500, 430]];
const ROCKS = [[400, 300], [250, 460], [560, 150]];

const WHITE = "#e8e8ec", AMBER = "#ff9d4a", GREEN = "#7dff9e", DIM = "#7a8894", GRAY = "#9aa7b0";

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  push("when start");
  push("set game to 9");
  push("set endplay to 0");
  push("set score to 0");
  push("set mode to 1");
  push(`set m1 to ${AMMO}`);
  push(`set m2 to ${AMMO}`);
  push("set t1 to 0");
  push("set t2 to 0");
  push("set fc1 to 1");
  push("set fc2 to -1");
  push("set k1 to 0");
  push("set k2 to 0");
  push("set st to 0");
  push("set c1hp to 2");
  push("set c2hp to 2");
  push("end");

  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set btn1p.visible to (game == 9)");
  push("set btn2p.visible to (game == 9)");
  push("set killtx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set ammo1tx.visible to (game != 9)");
  push("set ammo2tx.visible to (game != 9)");
  push("set statusline.visible to (game == 2)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PICK A MODE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN ◎"');
  push("end");
  push('set killtx.text to "P1 " + k1 + " · P2 " + k2');
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60))');
  push('set ammo1tx.text to "P1 SHOTS " + m1');
  push('set ammo2tx.text to "P2 SHOTS " + m2');

  push("if game != 2 then");
  push("  set ai1 to (game == 9)");
  push("  set ai2 to (game == 9 or mode == 1)");

  // ---- the kill pause, then a fresh round: marks, guns, and NEW cover ----
  push("  if st > 0 then");
  push("    set st to st - 1");
  push("    if st == 1 then");
  push("      set cow1.x to 100");
  push("      set cow1.y to 300");
  push("      set cow2.x to 700");
  push("      set cow2.y to 300");
  push("      set fc1 to 1");
  push("      set fc2 to -1");
  push("      set t1 to 0");
  push("      set t2 to 0");
  push(`      set m1 to ${AMMO}`);
  push(`      set m2 to ${AMMO}`);
  push("      set r1 to 0");
  push("      set r2 to 0");
  push("      set b1v to 0");
  push("      set b2v to 0");
  push("      set cow1.visible to 1");
  push("      set cow2.visible to 1");
  push("      set c1hp to 2");
  push("      set c2hp to 2");
  push("      set cact1.size to 22");
  push("      set cact2.size to 22");
  push("      set cact1.visible to 1");
  push("      set cact2.visible to 1");
  push("    end");
  push("  else");

  // ---- P1: the WHOLE desert is walkable, and walking sets your facing ----
  push("    if ai1 == 0 then");
  push('      set a1x to max(-1, min(1, keydown("d") - keydown("a") + stickx(1)))');
  push('      set a1y to max(-1, min(1, keydown("s") - keydown("w") + sticky(1)))');
  push(`      change cow1.x by a1x * ${SPD}`);
  push(`      change cow1.y by a1y * ${SPD}`);
  push(`      change t1 by max(-1, min(1, keydown("e") - keydown("q") + sticky(2))) * ${TILT}`);
  push("    else");
  push("      change cow1.y by max(-1.6, min(1.6, cow2.y - cow1.y)) * 0.6 + sin(time() * 90) * 1.2");
  push("      set a1x to max(-1, min(1, (cow2.x - cow1.x - 260) * 0.02))");
  push(`      change cow1.x by a1x * ${SPD} * 0.6`);
  push("      set t1 to sin(time() * 40) * 12");
  push("      if abs(cow2.y - cow1.y) < 22 and rand(0, 100) < 6 and b1v == 0 and m1 > 0 then");
  push("        set fire1 to 1");
  push("      end");
  push("    end");
  push("    if a1x > 0.3 then");
  push("      set fc1 to 1");
  push("    end");
  push("    if a1x < -0.3 then");
  push("      set fc1 to -1");
  push("    end");
  push(`    set t1 to max(-${TMAX}, min(${TMAX}, t1))`);
  push(`    set cow1.x to max(${X_MIN}, min(${X_MAX}, cow1.x))`);
  push(`    set cow1.y to max(${Y_TOP}, min(${Y_BOT}, cow1.y))`);

  push("    if ai2 == 0 then");
  push('      set a2x to max(-1, min(1, keydown("ArrowRight") - keydown("ArrowLeft") + stickx(3)))');
  push('      set a2y to max(-1, min(1, keydown("ArrowDown") - keydown("ArrowUp") + sticky(3)))');
  push(`      change cow2.x by a2x * ${SPD}`);
  push(`      change cow2.y by a2y * ${SPD}`);
  push(`      change t2 by max(-1, min(1, keydown(".") - keydown(",") + sticky(4))) * ${TILT}`);
  push("    else");
  push("      change cow2.y by max(-1.6, min(1.6, cow1.y - cow2.y)) * 0.6 + sin(time() * 70 + 120) * 1.2");
  push("      set a2x to max(-1, min(1, (cow1.x - cow2.x + 260) * 0.02))");
  push(`      change cow2.x by a2x * ${SPD} * 0.6`);
  push("      set t2 to sin(time() * 35 + 60) * 12");
  push("      if abs(cow1.y - cow2.y) < 22 and rand(0, 100) < 6 and b2v == 0 and m2 > 0 then");
  push("        set fire2 to 1");
  push("      end");
  push("    end");
  push("    if a2x > 0.3 then");
  push("      set fc2 to 1");
  push("    end");
  push("    if a2x < -0.3 then");
  push("      set fc2 to -1");
  push("    end");
  push(`    set t2 to max(-${TMAX}, min(${TMAX}, t2))`);
  push(`    set cow2.x to max(${X_MIN}, min(${X_MAX}, cow2.x))`);
  push(`    set cow2.y to max(${Y_TOP}, min(${Y_BOT}, cow2.y))`);
  push("  end");

  // guns point the way each man FACES, tilted by his aim stick
  const face = (cow, gun, t, fc) => {
    push(`  if ${fc} == 1 then`);
    push(`    set ${cow}.angle to ${t}`);
    push(`    set ${gun}.angle to ${t}`);
    push("  else");
    push(`    set ${cow}.angle to 180 - ${t}`);
    push(`    set ${gun}.angle to 180 - ${t}`);
    push("  end");
    push(`  set ${gun}.x to ${cow}.x`);
    push(`  set ${gun}.y to ${cow}.y`);
  };
  face("cow1", "gun1", "t1", "fc1");
  face("cow2", "gun2", "t2", "fc2");

  // ---- triggers ----
  const trigger = (fire, v, m, cow, t, fc, dx, dy, bull, bn) => {
    push(`  if ${fire} == 1 then`);
    push(`    set ${fire} to 0`);
    push(`    if game != 2 and st == 0 and ${v} == 0 and ${m} > 0 then`);
    push(`      set ${v} to 1`);
    push(`      set ${bn} to 0`);
    push(`      set ${m} to ${m} - 1`);
    push(`      set ${bull}.x to ${cow}.x + cos(${t}) * 24 * ${fc}`);
    push(`      set ${bull}.y to ${cow}.y + sin(${t}) * 24`);
    push(`      set ${dx} to cos(${t}) * ${BSPD} * ${fc}`);
    push(`      set ${dy} to sin(${t}) * ${BSPD}`);
    push("      beep 220 for 0.06");
    push("    end");
    push("  end");
  };
  trigger("fire1", "b1v", "m1", "cow1", "t1", "fc1", "b1dx", "b1dy", "bullet1", "b1n");
  trigger("fire2", "b2v", "m2", "cow2", "t2", "fc2", "b2dx", "b2dy", "bullet2", "b2n");

  // ---- bullets: rocks RICOCHET them, cacti shoot apart, cowboys fall ----
  const flyBullet = (b, v, dx, dy, bn, shooter, myKills, foeCow, foeKills) => {
    push(`  set ${b}.visible to ${v}`);
    push(`  if ${v} == 1 then`);
    push(`    change ${b}.x by ${dx}`);
    push(`    change ${b}.y by ${dy}`);
    push(`    if ${b}.x < 0 or ${b}.x > ${W} or ${b}.y < 0 or ${b}.y > ${H} then`);
    push(`      set ${v} to 0`);
    push("    end");
    // the rocks: a bounce, a beep, and now the bullet answers to nobody
    for (let r = 1; r <= ROCKS.length; r++) {
      push(`    if touching(${b}, rock${r}) then`);
      push(`      if abs(${b}.x - rock${r}.x) > abs(${b}.y - rock${r}.y) then`);
      push(`        set ${dx} to 0 - ${dx}`);
      push("      else");
      push(`        set ${dy} to 0 - ${dy}`);
      push("      end");
      push(`      set ${bn} to ${bn} + 1`);
      push(`      change ${b}.x by ${dx}`);
      push(`      change ${b}.y by ${dy}`);
      push("      beep 350 for 0.04");
      push("    end");
    }
    // the cacti: two hits and the cover is gone for the round
    for (let c = 1; c <= CACTI.length; c++) {
      push(`    if c${c}hp > 0 and touching(${b}, cact${c}) then`);
      push(`      set ${v} to 0`);
      push(`      set c${c}hp to c${c}hp - 1`);
      push(`      if c${c}hp == 1 then`);
      push(`        set cact${c}.size to 12`);
      push("        beep 90 for 0.05");
      push("      else");
      push(`        explode cact${c}`);
      push(`        set cact${c}.visible to 0`);
      push("        beep 70 for 0.08");
      push("      end");
      push("    end");
    }
    push(`    if st == 0 and touching(${b}, ${foeCow}) then`);
    push(`      set ${v} to 0`);
    push(`      change ${myKills} by 1`);
    push(`      explode ${foeCow}`);
    push(`      set ${foeCow}.visible to 0`);
    push('      say "GOT ME!" for 1.5');
    push("      beep 120 for 0.35");
    push(`      set st to ${STUN}`);
    push("    end");
    // a RICOCHETED bullet will happily kill its own gunman
    push(`    if st == 0 and ${bn} > 0 and touching(${b}, ${shooter}) then`);
    push(`      set ${v} to 0`);
    push(`      change ${foeKills} by 1`);
    push(`      explode ${shooter}`);
    push(`      set ${shooter}.visible to 0`);
    push('      say "SHOT MYSELF!" for 1.5');
    push("      beep 120 for 0.35");
    push(`      set st to ${STUN}`);
    push("    end");
    push("  end");
  };
  flyBullet("bullet1", "b1v", "b1dx", "b1dy", "b1n", "cow1", "k1", "cow2", "k2");
  flyBullet("bullet2", "b2v", "b2dx", "b2dy", "b2n", "cow2", "k2", "cow1", "k1");
  push("  set score to k1");

  // dry gun → the long reload
  push("  if m1 == 0 and b1v == 0 and st == 0 then");
  push("    set r1 to r1 + 1");
  push(`    if r1 > ${RELOAD} then`);
  push(`      set m1 to ${AMMO}`);
  push("      set r1 to 0");
  push("      beep 500 for 0.08");
  push("    end");
  push("  end");
  push("  if m2 == 0 and b2v == 0 and st == 0 then");
  push("    set r2 to r2 + 1");
  push(`    if r2 > ${RELOAD} then`);
  push(`      set m2 to ${AMMO}`);
  push("      set r2 to 0");
  push("      beep 500 for 0.08");
  push("    end");
  push("  end");
  push("end");

  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 150 for 0.5");
  push('    set statusline.text to "KILLS " + k1 + " · CLICK"');
  push("  end");
  push("end");
  push("end");

  push('when key "Space"');
  push("if game == 0 and ai1 == 0 then");
  push("  set fire1 to 1");
  push("end");
  push("end");
  push('when key "Enter"');
  push("if game == 0 and mode == 2 then");
  push("  set fire2 to 1");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  set picked to 0");
  push("  if abs(mousex() - 300) < 90 and abs(mousey() - 430) < 18 then");
  push("    set mode to 1");
  push("    set picked to 1");
  push("  end");
  push("  if abs(mousex() - 500) < 90 and abs(mousey() - 430) < 18 then");
  push("    set mode to 2");
  push("    set picked to 1");
  push("  end");
  push("  if picked == 1 then");
  push("    set game to 0");
  push("    set endplay to 0");
  push("    set score to 0");
  push("    set k1 to 0");
  push("    set k2 to 0");
  push(`    set timeleft to ${T}`);
  push("    set st to 2");
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildWesterngunExample() {
  const objects = [];

  // the desert: two cacti (destructible) and three rocks (bullets bounce)
  CACTI.forEach(([x, y], i) => {
    objects.push({
      id: "wg_c" + (i + 1), name: "cact" + (i + 1), type: "box",
      x, y, size: 22, angle: 0, color: GREEN, glow: 5, visible: 1, text: "", script: []
    });
  });
  ROCKS.forEach(([x, y], i) => {
    objects.push({
      id: "wg_r" + (i + 1), name: "rock" + (i + 1), type: "box",
      x, y, size: 18, angle: 45, color: GRAY, glow: 4, visible: 1, text: "", script: []
    });
  });

  objects.push({
    id: "wg_c1", name: "cow1", type: "tri",
    x: 100, y: 300, size: 15, angle: 0, color: WHITE, glow: 10, visible: 1, text: "", script: []
  });
  objects.push({
    id: "wg_g1", name: "gun1", type: "line",
    x: 100, y: 300, size: 24, angle: 0, color: WHITE, glow: 8, visible: 1, text: "", script: []
  });
  objects.push({
    id: "wg_c2", name: "cow2", type: "tri",
    x: 700, y: 300, size: 15, angle: 180, color: AMBER, glow: 10, visible: 1, text: "", script: []
  });
  objects.push({
    id: "wg_g2", name: "gun2", type: "line",
    x: 700, y: 300, size: 24, angle: 180, color: AMBER, glow: 8, visible: 1, text: "", script: []
  });
  objects.push({
    id: "wg_b1", name: "bullet1", type: "dot",
    x: -20, y: -20, size: 4, color: WHITE, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "wg_b2", name: "bullet2", type: "dot",
    x: -20, y: -20, size: 4, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });

  objects.push({
    id: "wg_k", name: "killtx", type: "text",
    x: 400, y: 30, size: 14, color: GREEN, glow: 8, visible: 0, text: "P1 0 · P2 0",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({
    id: "wg_t", name: "timetx", type: "text",
    x: 400, y: 52, size: 11, color: WHITE, glow: 6, visible: 0, text: "TIME 90", script: []
  });
  objects.push({
    id: "wg_a1", name: "ammo1tx", type: "text",
    x: 90, y: 30, size: 11, color: WHITE, glow: 6, visible: 0, text: "P1 SHOTS 6", script: []
  });
  objects.push({
    id: "wg_a2", name: "ammo2tx", type: "text",
    x: 710, y: 30, size: 11, color: AMBER, glow: 6, visible: 0, text: "P2 SHOTS 6", script: []
  });

  objects.push({
    id: "wg_big", name: "bigtitle", type: "text",
    x: 400, y: 200, size: 30, color: WHITE, glow: 16, visible: 1, text: "WESTERN GUN", script: []
  });
  objects.push({
    id: "wg_sub", name: "subline", type: "text",
    x: 400, y: 236, size: 11, color: AMBER, glow: 8, visible: 1,
    text: "TAITO 1975 · NISHIKADO'S ORIGINAL — HARDWIRED, NO CPU", script: []
  });
  objects.push({
    id: "wg_coin", name: "coinline", type: "text",
    x: 400, y: 268, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "wg_1p", name: "btn1p", type: "text",
    x: 300, y: 430, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ 1 PLAYER ]", script: []
  });
  objects.push({
    id: "wg_2p", name: "btn2p", type: "text",
    x: 500, y: 430, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ 2 PLAYERS ]", script: []
  });
  objects.push({
    id: "wg_status", name: "statusline", type: "text",
    x: 400, y: 268, size: 13, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "wg_help", name: "help", type: "text",
    x: 400, y: 580, size: 10, color: DIM, glow: 3, visible: 1,
    text: "1975 · ROAM ANYWHERE · ROCKS RICOCHET (EVEN AT YOU) · CACTI SHOOT APART · YOU FIRE THE WAY YOU FACE",
    script: []
  });

  // name the on-screen joysticks
  objects.push({ id: "wg_st1", name: "stick1tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P1 WALK", script: [] });
  objects.push({ id: "wg_st2", name: "stick2tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P1 AIM ↕", script: [] });
  objects.push({ id: "wg_st3", name: "stick3tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P2 WALK", script: [] });
  objects.push({ id: "wg_st4", name: "stick4tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P2 AIM ↕", script: [] });

  return { title: "Western Gun (1975)", w: W, h: H, objects };
}

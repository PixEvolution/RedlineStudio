// example-gunfight.js — GUN FIGHT (1975), rebuilt in our studio.
// Midway's first big hit, and the FIRST video game to run on a microprocessor
// (an Intel 8080) — Dave Nutting Associates' rework of Taito's Western Gun,
// Tomohiro Nishikado's original. Two cowboys, six shots a round, cacti and a
// drifting covered wagon soaking up bullets between them.
//
// The real cabinet was a DUAL-STICK machine per player: one joystick walked
// your cowboy, the other tilted his gun. Ours is too — on a gamepad the left
// stick moves and the right stick aims, exactly like 1975 — and every control
// also lives on the keyboard:
//
//   P1: WASD move · Q/E tilt the gun up/down · SPACE fire  (sticks 1 + 2)
//   P2: arrows move · , / . tilt · ENTER fire              (sticks 3 + 4)
//
// This example also uses the Studio's WORLD SIZE: it plays on an 800×600
// screen — same 4:3 shape as the real monitor, but roomy enough that a
// gunfight feels like a gunfight, not a knife fight.

const W = 800, H = 600;
const T = 5400;                     // ~90 seconds per coin
const SPD = 2.6, BSPD = 9;          // walk speed, bullet speed
const TILT = 2.5, TMAX = 35;        // gun tilt per tick, max tilt (degrees)
const AMMO = 6;                     // six shots, like the real round
const RELOAD = 110;                 // dry-gun wait before the reload
const STUN = 70;                    // the pause after a kill
const Y_TOP = 70, Y_BOT = 530;
const P1_MIN = 40, P1_MAX = 320, P2_MIN = 480, P2_MAX = 760;
const CACTI = [[390, 140], [410, 300], [390, 460]];

const WHITE = "#e8e8ec", AMBER = "#ff9d4a", GREEN = "#7dff9e", DIM = "#7a8894", TAN = "#c9924a";

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
  push("set k1 to 0");
  push("set k2 to 0");
  push("set st to 0");
  push("set wy to 200");
  push("set wd to 1.2");
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
  // who's a drone this frame? (the attract reel is a shootout between two)
  push("  set ai1 to (game == 9)");
  push("  set ai2 to (game == 9 or mode == 1)");

  // the covered wagon never stops drifting — the round's moving cover
  push("  change wy by wd");
  push("  if wy < 110 then");
  push("    set wd to 1.2");
  push("  end");
  push("  if wy > 490 then");
  push("    set wd to -1.2");
  push("  end");
  push("  set wagon.y to wy");

  // ---- the kill pause: everyone freezes, then the round resets ----
  push("  if st > 0 then");
  push("    set st to st - 1");
  push("    if st == 1 then");
  push(`      set cow1.x to 80`);
  push("      set cow1.y to 300");
  push(`      set cow2.x to 720`);
  push("      set cow2.y to 300");
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
  push("    end");
  push("  else");

  // ---- P1: walk (WASD or stick 1) + tilt the gun (Q/E or stick 2) ----
  push("    if ai1 == 0 then");
  push('      set a1x to max(-1, min(1, keydown("d") - keydown("a") + stickx(1)))');
  push('      set a1y to max(-1, min(1, keydown("s") - keydown("w") + sticky(1)))');
  push(`      change cow1.x by a1x * ${SPD}`);
  push(`      change cow1.y by a1y * ${SPD}`);
  push(`      change t1 by max(-1, min(1, keydown("e") - keydown("q") + sticky(2))) * ${TILT}`);
  push("    else");
  // drone 1 (attract only): drift toward level with his foe, wander a little
  push("      change cow1.y by max(-1.6, min(1.6, cow2.y - cow1.y)) * 0.6 + sin(time() * 90) * 1.2");
  push("      set t1 to sin(time() * 40) * 12");
  push("      if abs(cow2.y - cow1.y) < 22 and rand(0, 100) < 6 and b1v == 0 and m1 > 0 then");
  push("        set fire1 to 1");
  push("      end");
  push("    end");
  push(`    set t1 to max(-${TMAX}, min(${TMAX}, t1))`);
  push(`    set cow1.x to max(${P1_MIN}, min(${P1_MAX}, cow1.x))`);
  push(`    set cow1.y to max(${Y_TOP}, min(${Y_BOT}, cow1.y))`);

  // ---- P2: walk (arrows or stick 3) + tilt (,/. or stick 4) — or the drone
  push("    if ai2 == 0 then");
  push('      set a2x to max(-1, min(1, keydown("ArrowRight") - keydown("ArrowLeft") + stickx(3)))');
  push('      set a2y to max(-1, min(1, keydown("ArrowDown") - keydown("ArrowUp") + sticky(3)))');
  push(`      change cow2.x by a2x * ${SPD}`);
  push(`      change cow2.y by a2y * ${SPD}`);
  push(`      change t2 by max(-1, min(1, keydown(".") - keydown(",") + sticky(4))) * ${TILT}`);
  push("    else");
  push("      change cow2.y by max(-1.6, min(1.6, cow1.y - cow2.y)) * 0.6 + sin(time() * 70 + 120) * 1.2");
  push("      set t2 to sin(time() * 35 + 60) * 12");
  push("      if abs(cow1.y - cow2.y) < 22 and rand(0, 100) < 6 and b2v == 0 and m2 > 0 then");
  push("        set fire2 to 1");
  push("      end");
  push("    end");
  push(`    set t2 to max(-${TMAX}, min(${TMAX}, t2))`);
  push(`    set cow2.x to max(${P2_MIN}, min(${P2_MAX}, cow2.x))`);
  push(`    set cow2.y to max(${Y_TOP}, min(${Y_BOT}, cow2.y))`);
  push("  end");

  // guns point along their tilt (P2's mirrored to face west)
  push("  set cow1.angle to t1");
  push("  set gun1.x to cow1.x");
  push("  set gun1.y to cow1.y");
  push("  set gun1.angle to t1");
  push("  set cow2.angle to 180 - t2");
  push("  set gun2.x to cow2.x");
  push("  set gun2.y to cow2.y");
  push("  set gun2.angle to 180 - t2");

  // ---- pulling the trigger (set by the key events or the drones) ----
  push("  if fire1 == 1 then");
  push("    set fire1 to 0");
  push("    if game != 2 and st == 0 and b1v == 0 and m1 > 0 then");
  push("      set b1v to 1");
  push("      set m1 to m1 - 1");
  push("      set bullet1.x to cow1.x + cos(t1) * 24");
  push("      set bullet1.y to cow1.y + sin(t1) * 24");
  push(`      set b1dx to cos(t1) * ${BSPD}`);
  push(`      set b1dy to sin(t1) * ${BSPD}`);
  push("      beep 220 for 0.06");
  push("    end");
  push("  end");
  push("  if fire2 == 1 then");
  push("    set fire2 to 0");
  push("    if game != 2 and st == 0 and b2v == 0 and m2 > 0 then");
  push("      set b2v to 1");
  push("      set m2 to m2 - 1");
  push("      set bullet2.x to cow2.x - cos(t2) * 24");
  push("      set bullet2.y to cow2.y + sin(t2) * 24");
  push(`      set b2dx to 0 - cos(t2) * ${BSPD}`);
  push(`      set b2dy to sin(t2) * ${BSPD}`);
  push("      beep 180 for 0.06");
  push("    end");
  push("  end");

  // ---- bullets fly, cover soaks them up, cowboys fall ----
  const flyBullet = (b, v, dx, dy, foe, myKills, foeCow) => {
    push(`  set ${b}.visible to ${v}`);
    push(`  if ${v} == 1 then`);
    push(`    change ${b}.x by ${dx}`);
    push(`    change ${b}.y by ${dy}`);
    push(`    if ${b}.x < 0 or ${b}.x > ${W} or ${b}.y < 0 or ${b}.y > ${H} then`);
    push(`      set ${v} to 0`);
    push("    end");
    for (let c = 1; c <= CACTI.length; c++) {
      push(`    if touching(${b}, cact${c}) then`);
      push(`      set ${v} to 0`);
      push("      beep 90 for 0.05");
      push("    end");
    }
    push(`    if touching(${b}, wagon) then`);
    push(`      set ${v} to 0`);
    push("      beep 90 for 0.05");
    push("    end");
    push(`    if st == 0 and touching(${b}, ${foeCow}) then`);
    push(`      set ${v} to 0`);
    push(`      change ${myKills} by 1`);
    push(`      explode ${foeCow}`);
    push(`      set ${foeCow}.visible to 0`);
    push('      say "GOT ME!" for 1.5');
    push("      beep 120 for 0.35");
    push(`      set st to ${STUN}`);
    push("    end");
    push("  end");
  };
  flyBullet("bullet1", "b1v", "b1dx", "b1dy", "cow1", "k1", "cow2");
  flyBullet("bullet2", "b2v", "b2dx", "b2dy", "cow2", "k2", "cow1");
  push("  set score to k1");

  // ---- six shots, then the long fumbling reload — just like the cabinet
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

  // the coin's clock
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

  // triggers: SPACE is P1's, ENTER is P2's
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

  // the mode buttons start the fight
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
  push("    set st to 2");   // the round-reset block deals everyone in cleanly
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildGunfightExample() {
  const objects = [];

  // the cover: three cacti and the drifting covered wagon
  CACTI.forEach(([x, y], i) => {
    objects.push({
      id: "gf_c" + (i + 1), name: "cact" + (i + 1), type: "box",
      x, y, size: 22, angle: 0, color: GREEN, glow: 5, visible: 1, text: "", script: []
    });
  });
  objects.push({
    id: "gf_w", name: "wagon", type: "box",
    x: 400, y: 200, size: 34, angle: 0, color: TAN, glow: 5, visible: 1, text: "", script: []
  });

  // the gunfighters and their guns
  objects.push({
    id: "gf_c1", name: "cow1", type: "tri",
    x: 80, y: 300, size: 15, angle: 0, color: WHITE, glow: 10, visible: 1, text: "", script: []
  });
  objects.push({
    id: "gf_g1", name: "gun1", type: "line",
    x: 80, y: 300, size: 24, angle: 0, color: WHITE, glow: 8, visible: 1, text: "", script: []
  });
  objects.push({
    id: "gf_c2", name: "cow2", type: "tri",
    x: 720, y: 300, size: 15, angle: 180, color: AMBER, glow: 10, visible: 1, text: "", script: []
  });
  objects.push({
    id: "gf_g2", name: "gun2", type: "line",
    x: 720, y: 300, size: 24, angle: 180, color: AMBER, glow: 8, visible: 1, text: "", script: []
  });
  objects.push({
    id: "gf_b1", name: "bullet1", type: "dot",
    x: -20, y: -20, size: 4, color: WHITE, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "gf_b2", name: "bullet2", type: "dot",
    x: -20, y: -20, size: 4, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });

  // HUD (the brain rides on killtx)
  objects.push({
    id: "gf_k", name: "killtx", type: "text",
    x: 400, y: 30, size: 14, color: GREEN, glow: 8, visible: 0, text: "P1 0 · P2 0",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({
    id: "gf_t", name: "timetx", type: "text",
    x: 400, y: 52, size: 11, color: WHITE, glow: 6, visible: 0, text: "TIME 90", script: []
  });
  objects.push({
    id: "gf_a1", name: "ammo1tx", type: "text",
    x: 90, y: 30, size: 11, color: WHITE, glow: 6, visible: 0, text: "P1 SHOTS 6", script: []
  });
  objects.push({
    id: "gf_a2", name: "ammo2tx", type: "text",
    x: 710, y: 30, size: 11, color: AMBER, glow: 6, visible: 0, text: "P2 SHOTS 6", script: []
  });

  // the marquee
  objects.push({
    id: "gf_big", name: "bigtitle", type: "text",
    x: 400, y: 200, size: 30, color: WHITE, glow: 16, visible: 1, text: "GUN FIGHT", script: []
  });
  objects.push({
    id: "gf_sub", name: "subline", type: "text",
    x: 400, y: 236, size: 11, color: AMBER, glow: 8, visible: 1,
    text: "MIDWAY 1975 · THE FIRST MICROPROCESSOR GAME", script: []
  });
  objects.push({
    id: "gf_coin", name: "coinline", type: "text",
    x: 400, y: 268, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "gf_1p", name: "btn1p", type: "text",
    x: 300, y: 430, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ 1 PLAYER ]", script: []
  });
  objects.push({
    id: "gf_2p", name: "btn2p", type: "text",
    x: 500, y: 430, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ 2 PLAYERS ]", script: []
  });
  objects.push({
    id: "gf_status", name: "statusline", type: "text",
    x: 400, y: 268, size: 13, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "gf_help", name: "help", type: "text",
    x: 400, y: 580, size: 10, color: DIM, glow: 3, visible: 1,
    text: "1975 · P1 WASD + Q/E TILT + SPACE · P2 ARROWS + ,/. TILT + ENTER · OR TWO STICKS EACH, LIKE THE REAL CABINET",
    script: []
  });

  // name the on-screen joysticks — the harness reads stickNtag objects
  // so every stick says WHOSE it is (hidden: they're labels, not scenery)
  objects.push({ id: "gf_st1", name: "stick1tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P1 WALK", script: [] });
  objects.push({ id: "gf_st2", name: "stick2tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P1 AIM ↕", script: [] });
  objects.push({ id: "gf_st3", name: "stick3tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P2 WALK", script: [] });
  objects.push({ id: "gf_st4", name: "stick4tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "P2 AIM ↕", script: [] });

  return { title: "Gun Fight (1975)", w: W, h: H, objects };
}

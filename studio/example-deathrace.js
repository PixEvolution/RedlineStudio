// example-deathrace.js — DEATH RACE (1976), rebuilt in our studio.
//
// Exidy took their driving game Destruction Derby, swapped the cars you
// chased for little running "gremlins", and invented the VIDEO GAME MORAL
// PANIC: run one down and it screams, dies, and leaves a CROSS in the road —
// a grave you then have to steer around. The National Safety Council called
// it "insidious", 60 Minutes ran a segment, pulpits thundered — and the
// controversy tripled sales. (Exidy swore the gremlins weren't pedestrians.
// The cabinet art was skeletons. Nobody was fooled; the working title had
// been "Pedestrian".) Every "do games cause violence" argument you've ever
// heard started at this cabinet in 1976.
//
// The real machine, faithfully:
//   · a steering wheel and pedal → A/D + W, or 🕹 stick 1 (the WHEEL:
//     push up for gas, lean left/right to steer)
//   · gremlins FLEE your car; catching one screams, scores, and plants a
//     cross exactly where it died — the arena slowly fills with graves
//   · graves are OBSTACLES: hit one and the car bounces off dead
//   · the coin buys TIME (60 seconds), 1 or 2 players — two wheels, one
//     arena, most gremlins wins
//
// In the Studio this example loads rated 13+ — the 1976 panic, filed
// correctly by 2026 rules. History has a sense of humor.

const W = 480, H = 360;
const L = 16, R = 464, T = 40, B = 344;       // the fence
const CARSPD = 2.6, TURN = 4, GSPD = 1.25, PLAYSECS = 60;
const NCROSS = 16, NGREM = 6;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", ORANGE = "#ff9d4a";

// one car's driving code — keys + its own stick, fenced in, graves are solid
function carCode(n, left, right, gas, stick) {
  const Lx = [];
  const push = (s) => Lx.push(s);
  push("when tick");
  push(`set self.visible to (game != 9${n === 2 ? " and mode == 2" : ""})`);
  push(`if game == 0${n === 2 ? " and mode == 2" : ""} then`);
  push(`  set st to max(-1, min(1, keydown("${right}") - keydown("${left}") + stickx(${stick})))`);
  push(`  change self.angle by st * ${TURN}`);
  push(`  set gas to max(0, min(1, keydown("${gas}") + (0 - sticky(${stick}))))`);
  push(`  set nx to self.x + cos(self.angle) * gas * ${CARSPD}`);
  push(`  set ny to self.y + sin(self.angle) * gas * ${CARSPD}`);
  // graves are solid — but like the 1976 board, only from the OUTSIDE:
  // the cross that appears under your own car never pins you (drive off it,
  // then it's a wall like the rest). No getting stuck on your fresh kill.
  push("  set blocked to 0");
  push("  set i to 0");
  push(`  repeat ${NCROSS}`);
  push("    if crosson[i] == 1 and abs(nx - crossx[i]) < 12 and abs(ny - crossy[i]) < 12 then");
  push("      if abs(self.x - crossx[i]) >= 12 or abs(self.y - crossy[i]) >= 12 then");
  push("        set blocked to 1");
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push("  if blocked == 1 then");
  push("    beep 120 for 0.06");
  push("  else");
  push("    set self.x to nx");
  push("    set self.y to ny");
  push("  end");
  push(`  set self.x to max(${L + 8}, min(${R - 8}, self.x))`);
  push(`  set self.y to max(${T + 8}, min(${B - 8}, self.y))`);
  push("end");
  push("end");
  return Lx.join("\n");
}

// one gremlin: flees the nearest car, screams and leaves a grave when caught
function gremlinCode() {
  const Lx = [];
  const push = (s) => Lx.push(s);
  push("when tick");
  push("set self.visible to 1");
  push("if game == 9 then");
  // attract: the gremlins mill around like nothing bad ever happens here
  push("  change self.x by rand(-0.8, 0.8)");
  push("  change self.y by rand(-0.8, 0.8)");
  push("end");
  push("if game == 0 then");
  // who's the nearest danger?
  push("  set d1 to dist(self, car1)");
  push("  set hx to car1.x");
  push("  set hy to car1.y");
  push("  if mode == 2 and dist(self, car2) < d1 then");
  push("    set d1 to dist(self, car2)");
  push("    set hx to car2.x");
  push("    set hy to car2.y");
  push("  end");
  push("  if d1 < 110 then");
  // scurry AWAY — no trig needed, gremlins zig-zag like the 1976 originals
  push("    set dx to self.x - hx");
  push("    set dy to self.y - hy");
  push(`    change self.x by dx / max(1, abs(dx)) * ${GSPD} + rand(-0.5, 0.5)`);
  push(`    change self.y by dy / max(1, abs(dy)) * ${GSPD} + rand(-0.5, 0.5)`);
  push("  else");
  push("    change self.x by rand(-0.7, 0.7)");
  push("    change self.y by rand(-0.7, 0.7)");
  push("  end");
  push(`  set self.x to max(${L + 6}, min(${R - 6}, self.x))`);
  push(`  set self.y to max(${T + 6}, min(${B - 6}, self.y))`);
  // caught: the scream, the score, the cross — the whole 1976 scandal
  const caught = (car, sc) => {
    push(`  if touching(self, ${car}) then`);
    push(`    set ${sc} to ${sc} + 1`);
    push("    beep 880 for 0.05");
    push("    beep 392 for 0.07");
    push("    beep 131 for 0.12");
    push("    explode self");
    push("    set ci to ci + 1");
    push(`    if ci > ${NCROSS - 1} then`);
    push("      set ci to 0");
    push("    end");
    push("    set crossx[ci] to self.x");
    push("    set crossy[ci] to self.y");
    push("    set crosson[ci] to 1");
    push('    set status.text to "† GOT ONE — THE CROSS STAYS"');
    push(`    set self.x to rand(${L + 20}, ${R - 20})`);
    push(`    set self.y to rand(${T + 20}, ${B - 20})`);
    push("  end");
  };
  caught("car1", "score1");
  push("  if mode == 2 then");
  caught("car2", "score2");
  push("  end");
  push("end");
  push("end");
  return Lx.join("\n");
}

function brainCode() {
  const Lx = [];
  const push = (s) => Lx.push(s);

  const clearGraves = (pad) => {
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${NCROSS}`);
    push(`${pad}  set crosson[i] to 0`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set ci to ${NCROSS - 1}`);
  };
  const startMatch = (pad, mode) => {
    push(`${pad}set mode to ${mode}`);
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score1 to 0`);
    push(`${pad}set score2 to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set tleft to ${PLAYSECS * 60}`);
    clearGraves(pad);
    push(`${pad}set car1.x to ${W / 2 - 100}`);
    push(`${pad}set car1.y to ${H / 2}`);
    push(`${pad}set car1.angle to 0`);
    push(`${pad}set car2.x to ${mode === 2 ? W / 2 + 100 : -300}`);
    push(`${pad}set car2.y to ${H / 2}`);
    push(`${pad}set car2.angle to 180`);
    // scatter the gremlins to the edges — nobody dies at the starting gun
    const spots = [[60, 70], [420, 70], [60, 310], [420, 310], [240, 70], [240, 310]];
    for (let g = 0; g < NGREM; g++) {
      push(`${pad}set gremlin${g + 1}.x to ${spots[g][0]}`);
      push(`${pad}set gremlin${g + 1}.y to ${spots[g][1]}`);
    }
    push(`${pad}set status.text to "RUN THEM DOWN — THE CLOCK IS THE ONLY JUDGE"`);
  };

  push("when start");
  push("set game to 9");
  push("set mode to 1");
  push("set score1 to 0");
  push("set score2 to 0");
  push("set score to 0");
  push("set endplay to 0");
  clearGraves("");
  push('set status.text to ""');
  push("end");

  push("when tick");
  push('set s1tx.text to "P1 " + score1');
  push('set s2tx.text to "P2 " + score2');
  push('set timetx.text to "TIME " + floor(tleft / 60)');
  push("set s1tx.visible to (game != 9)");
  push("set s2tx.visible to (game != 9 and mode == 2)");
  push("set timetx.visible to (game != 9)");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set p1btn.visible to (game == 9)");
  push("set p2btn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PICK A MODE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — PICK A MODE ◎"');
  push("end");
  push("if game == 0 then");
  push("  set score to max(score1, score2)");   // the ★ table takes the day's best wheel
  push("  set tleft to tleft - 1");
  push("  if tleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    if mode == 2 and score2 > score1 then");
  push('      set status.text to "TIME — PLAYER 2 TAKES THE ARENA. CLICK FOR A NEW GAME"');
  push("    else");
  push("      if mode == 2 and score1 > score2 then");
  push('        set status.text to "TIME — PLAYER 1 TAKES THE ARENA. CLICK FOR A NEW GAME"');
  push("      else");
  push('        set status.text to "TIME UP — CLICK FOR A NEW GAME"');
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 168) < 62 and abs(mousey() - 262) < 16 then");
  startMatch("    ", 1);
  push("  end");
  push("  if abs(mousex() - 315) < 66 and abs(mousey() - 262) < 16 then");
  startMatch("    ", 2);
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  clearGraves("    ");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  return Lx.join("\n");
}

export function buildDeathraceExample() {
  const objects = [];

  // the fence — the arena the panic happened in
  objects.push({ id: "dr_ft", name: "fencetop", type: "line", x: L - 2, y: T - 2, size: (R - L) + 4, angle: 0, color: DIM, glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "dr_fb", name: "fencebot", type: "line", x: L - 2, y: B + 2, size: (R - L) + 4, angle: 0, color: DIM, glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "dr_fl", name: "fenceleft", type: "line", x: L - 2, y: T - 2, size: (B - T) + 4, angle: 90, color: DIM, glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "dr_fr", name: "fenceright", type: "line", x: R + 2, y: T - 2, size: (B - T) + 4, angle: 90, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // the graves: sixteen crosses, waiting. Display-only — the brains write
  // crossx/crossy/crosson lists and each cross watches its own slot.
  for (let k = 0; k < NCROSS; k++) {
    objects.push({
      id: "dr_c" + k, name: "cross" + (k + 1), type: "text",
      x: -50, y: -50, size: 14, color: DIM, glow: 8, visible: 0, text: "†",
      script: [{ event: "code", source: `when tick\nset self.x to crossx[${k}]\nset self.y to crossy[${k}]\nset self.visible to crosson[${k}] * (game != 9)\nend` }]
    });
  }

  // the gremlins — Exidy swore they weren't pedestrians
  for (let g = 0; g < NGREM; g++) {
    objects.push({
      id: "dr_g" + g, name: "gremlin" + (g + 1), type: "text",
      x: 80 + g * 65, y: 90 + (g % 3) * 80, size: 12, color: GREEN, glow: 10, visible: 1, text: "Ψ",
      script: [{ event: "code", source: gremlinCode() }]
    });
  }

  // the cars — two wheels on the real cabinet
  objects.push({
    id: "dr_car1", name: "car1", type: "tri",
    x: W / 2 - 100, y: H / 2, size: 12, angle: 0, color: WHITE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: carCode(1, "a", "d", "w", 1) }]
  });
  objects.push({
    id: "dr_car2", name: "car2", type: "tri",
    x: W / 2 + 100, y: H / 2, size: 12, angle: 180, color: ORANGE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: carCode(2, "ArrowLeft", "ArrowRight", "ArrowUp", 2) }]
  });

  // HUD
  objects.push({ id: "dr_s1", name: "s1tx", type: "text", x: 70, y: 22, size: 16, color: WHITE, glow: 8, visible: 0, text: "P1 0", script: [] });
  objects.push({ id: "dr_s2", name: "s2tx", type: "text", x: 410, y: 22, size: 16, color: ORANGE, glow: 8, visible: 0, text: "P2 0", script: [] });
  objects.push({ id: "dr_tm", name: "timetx", type: "text", x: W / 2, y: 22, size: 16, color: DIM, glow: 6, visible: 0, text: "TIME 60", script: [] });
  objects.push({ id: "dr_st", name: "status", type: "text", x: W / 2, y: 356, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "dr_big", name: "bigtitle", type: "text", x: W / 2, y: 140, size: 52, color: WHITE, glow: 18, visible: 1, text: "DEATH RACE", script: [] });
  objects.push({ id: "dr_sub", name: "subline", type: "text", x: W / 2, y: 172, size: 11, color: DIM, glow: 4, visible: 1, text: "EXIDY 1976 · THE ONE THEY PROTESTED", script: [] });
  objects.push({ id: "dr_coin", name: "coinline", type: "text", x: W / 2, y: 205, size: 13, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — PICK A MODE ◎", script: [] });
  objects.push({ id: "dr_p1", name: "p1btn", type: "text", x: 168, y: 268, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ 1 PLAYER ]", script: [] });
  objects.push({ id: "dr_p2", name: "p2btn", type: "text", x: 315, y: 268, size: 16, color: ORANGE, glow: 12, visible: 1, text: "[ 2 PLAYERS ]", script: [] });
  objects.push({
    id: "dr_help", name: "help", type: "text",
    x: W / 2, y: 336, size: 9, color: DIM, glow: 3, visible: 1,
    text: "P1 A/D + W OR WHEEL 1 · P2 ARROWS OR WHEEL 2 · GRAVES ARE SOLID",
    script: []
  });

  // the brain rides an invisible marker
  objects.push({
    id: "dr_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brainCode() }]
  });

  // the wheels wear their names
  objects.push({ id: "dr_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "WHEEL P1", script: [] });
  objects.push({ id: "dr_t2", name: "stick2tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "WHEEL P2", script: [] });

  return { title: "Death Race (1976)", objects };
}

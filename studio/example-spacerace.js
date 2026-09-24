// example-spacerace.js — SPACE RACE (1973), rebuilt in our studio.
// Atari's SECOND game, eight months after Pong. Nolan Bushnell's own design:
// two rockets launch from the bottom of the screen and race to the top
// through a field of asteroids streaming sideways. Reach the top = 1 point
// and your rocket returns to the pad. Get hit = back to the pad with nothing.
// A quarter bought TIME, not lives — the white bar in the center of the
// screen shrinks, and when it's gone, most crossings wins. First video game
// with a coin-buys-a-timed-session design, faithfully wired to the platform's
// arcade contract here (endplay fires when the bar runs out).
//
//   LEFT (green): W up · S down — RIGHT (amber): ↑ up · ↓ down
//   1 PLAYER mode: the machine rocket climbs steadily but never dodges.
//   Down is slower than up — retreating to dodge costs you.

const T = 4200;                      // the coin buys ~70 seconds
const LX = 130, RX = 350;            // launch lanes
const PAD = 326, GOAL = 40;          // launch pad · finish line
const UP = 2.6, DOWN = 1.8;          // dodging backwards is slower
const AI_UP = 2.3;
const NDEB = 14, HIT = 13;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a";

// debris field: deterministic bands so the game is fair and the attract
// screen always looks alive
function debrisSpec(i) {
  return {
    y: 62 + i * 19,
    vx: (i % 2 === 0 ? 1 : -1) * (1.2 + ((i * 7) % 9) * 0.18),
    x: (i * 137) % 480,
    size: 4 + (i % 3)
  };
}

function rocketCode(isRight) {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game != 9)");
  push("if game == 0 then");
  if (isRight) {
    // 1P: the machine rocket climbs with random hesitations — steady, blind,
    // and it plows straight into rocks. Beat it by dodging.
    push("  if mode == 1 then");
    push("    if aiwait > 0 then");
    push("      set aiwait to aiwait - 1");
    push("    else");
    push(`      change self.y by -${AI_UP}`);
    push("      if rand(0, 100) < 2 then");
    push("        set aiwait to rand(10, 30)");
    push("      end");
    push("    end");
    push("  else");
    push(`    if keydown("ArrowUp") then`);
    push(`      change self.y by -${UP}`);
    push("    end");
    push(`    if keydown("ArrowDown") then`);
    push(`      change self.y by ${DOWN}`);
    push("    end");
    push("  end");
  } else {
    push(`  if keydown("w") then`);
    push(`    change self.y by -${UP}`);
    push("  end");
    push(`  if keydown("s") then`);
    push(`    change self.y by ${DOWN}`);
    push("  end");
  }
  push(`  set self.y to max(26, min(${PAD + 4}, self.y))`);
  // the finish line: score and fall back to the pad
  push(`  if self.y <= ${GOAL} then`);
  push(`    change ${isRight ? "rscore" : "lscore"} by 1`);
  push("    beep 660 for 0.12");   // crossing chime
  push(`    set self.y to ${PAD}`);
  push("  end");
  // the asteroid field
  for (let i = 1; i <= NDEB; i++) {
    push(`  if dist(self, d${i}) < ${HIT} then`);
    push("    explode self");
    push("    beep 85 for 0.3");   // the crash
    push(`    set self.y to ${PAD}`);
    push("  end");
  }
  push("end");
  push("end");
  return L.join("\n");
}

function debrisCode(vx) {
  // debris never stops — it's the live attract reel too
  const L = ["when tick", `change self.x by ${vx}`];
  if (vx > 0) {
    L.push("if self.x > 496 then", "  set self.x to -16", "end");
  } else {
    L.push("if self.x < -16 then", "  set self.x to 496", "end");
  }
  L.push("end");
  return L.join("\n");
}

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const startMatch = (pad, mode) => {
    push(`${pad}set mode to ${mode}`);
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set lscore to 0`);
    push(`${pad}set rscore to 0`);
    push(`${pad}set timeleft to ${T}`);
    push(`${pad}set aiwait to 0`);
    push(`${pad}set lrocket.y to ${PAD}`);
    push(`${pad}set rrocket.y to ${PAD}`);
    push(`${pad}set self.text to "DODGE THE ROCKS — MOST CROSSINGS WINS"`);
  };

  push("when start");
  push("set game to 9");            // attract mode
  push("set mode to 2");
  push("set lscore to 0");
  push("set rscore to 0");
  push(`set timeleft to ${T}`);
  push("set endplay to 0");
  push('set self.text to ""');
  push("end");

  push("when tick");
  // attract-only vs game-only elements
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set p1btn.visible to (game == 9)");
  push("set p2btn.visible to (game == 9)");
  push("set ltx.visible to (game != 9)");
  push("set rtx.visible to (game != 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PICK A MODE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — PICK A MODE ◎"');
  push("end");

  push('set ltx.text to "" + lscore');
  push('set rtx.text to "" + rscore');
  push("set score to lscore");   // the reserved var → the HIGH SCORES table (left seat)

  // THE SPACE RACE MECHANIC: the coin bought time — the center bar IS the
  // quarter draining away, from the top down
  for (let i = 0; i < 12; i++) {
    push(`set tb${i}.visible to (game != 9 and timeleft > ${Math.round(T * (11 - i) / 12)})`);
  }

  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");        // the quarter is spent — arcade contract
  push("    beep 150 for 0.5");        // time-up buzzer
  push("    if lscore > rscore then");
  push('      set self.text to "GREEN ROCKET WINS — CLICK FOR ATTRACT"');
  push("    else");
  push("      if rscore > lscore then");
  push('        set self.text to "AMBER ROCKET WINS — CLICK FOR ATTRACT"');
  push("      else");
  push('        set self.text to "DEAD HEAT — CLICK FOR ATTRACT"');
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
  push('    set self.text to ""');
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildSpaceraceExample() {
  const objects = [];

  // the asteroid field (also the live attract reel)
  for (let i = 1; i <= NDEB; i++) {
    const d = debrisSpec(i - 1);
    objects.push({
      id: "sr_d" + i, name: "d" + i, type: "dot",
      x: d.x, y: d.y, size: d.size, color: WHITE, glow: 6, visible: 1, text: "",
      script: [{ event: "code", source: debrisCode(d.vx) }]
    });
  }

  // the time bar: 12 segments down the center, draining top-first
  for (let i = 0; i < 12; i++) {
    objects.push({
      id: "sr_tb" + i, name: "tb" + i, type: "box",
      x: 240, y: 92 + i * 20, size: 6, color: WHITE, glow: 5, visible: 0, text: "",
      script: []
    });
  }

  // the rockets — ships pointing up, parked on the pad
  objects.push({
    id: "sr_lr", name: "lrocket", type: "tri",
    x: LX, y: PAD, size: 12, angle: -90, color: GREEN, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: rocketCode(false) }]
  });
  objects.push({
    id: "sr_rr", name: "rrocket", type: "tri",
    x: RX, y: PAD, size: 12, angle: -90, color: AMBER, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: rocketCode(true) }]
  });

  // scoreboard flanking the time bar
  objects.push({
    id: "sr_ls", name: "ltx", type: "text",
    x: 205, y: 26, size: 20, color: GREEN, glow: 8, visible: 0, text: "0", script: []
  });
  objects.push({
    id: "sr_rs", name: "rtx", type: "text",
    x: 275, y: 26, size: 20, color: AMBER, glow: 8, visible: 0, text: "0", script: []
  });

  // the brain doubles as the status line
  objects.push({
    id: "sr_status", name: "status", type: "text",
    x: 240, y: 50, size: 11, color: DIM, glow: 4, visible: 1, text: "",
    script: [{ event: "code", source: brainCode() }]
  });

  // attract screen
  objects.push({
    id: "sr_big", name: "bigtitle", type: "text",
    x: 240, y: 130, size: 46, color: WHITE, glow: 18, visible: 1, text: "SPACE RACE", script: []
  });
  objects.push({
    id: "sr_coin", name: "coinline", type: "text",
    x: 240, y: 185, size: 14, color: WHITE, glow: 8, visible: 1,
    text: "◎ INSERT COIN — PICK A MODE ◎", script: []
  });
  objects.push({
    id: "sr_p1", name: "p1btn", type: "text",
    x: 168, y: 268, size: 16, color: GREEN, glow: 12, visible: 1,
    text: "[ 1 PLAYER ]", script: []
  });
  objects.push({
    id: "sr_p2", name: "p2btn", type: "text",
    x: 315, y: 268, size: 16, color: AMBER, glow: 12, visible: 1,
    text: "[ 2 PLAYERS ]", script: []
  });

  objects.push({
    id: "sr_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "ATARI 1973 · LEFT W/S · RIGHT ↑/↓ · REACH THE TOP · DODGE THE ROCKS",
    script: []
  });

  return { title: "Space Race (1973)", objects };
}

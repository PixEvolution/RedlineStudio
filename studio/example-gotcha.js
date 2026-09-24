// example-gotcha.js — GOTCHA (1973), rebuilt in our studio.
// Atari's fourth game and arguably the FIRST MAZE GAME — seven years before
// Pac-Man. Two players in a maze: the PURSUER (a square) hunts the PURSUED
// (in the original, a plus sign — here, a ring). Catch them and the machine
// shouts GOTCHA, you score, and the chase resets. The twist that made it
// special: the maze itself MOVED — walls drifted sideways the whole game,
// so no hiding spot stayed safe. Like Space Race, the quarter bought TIME.
//
//   CHASER (amber square): W A S D — RUNNER (green ring): arrow keys
//   1 PLAYER mode: you are the chaser; the machine runs for its life.
//   The runner is a hair slower — corner it with the moving walls.

const T = 3600;                        // the coin buys ~60 seconds
const CH_SPD = 2.4, RN_SPD = 2.2, AI_SPD = 2.1;
const NROWS = 5, PERROW = 6, WALL = 20, GAP = 80;
const ROWY = [85, 135, 185, 235, 285];
const X0 = 14, X1 = 466, Y0 = 56, Y1 = 332;    // player bounds
const CHX = 60, CHY = 310, RNX = 420, RNY = 64; // spawn corners (clear of wall rows)
const NWALL = NROWS * PERROW;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a", WALLC = "#1f8f3c";

function wallSpec(i) {
  const row = Math.floor(i / PERROW), k = i % PERROW;
  return {
    y: ROWY[row],
    x: ((row * 37 + k * GAP) % 480),
    vx: (row % 2 === 0 ? 1 : -1) * (0.35 + row * 0.05)
  };
}

function wallCode(vx) {
  // the maze never stops moving — it's the live attract reel too
  const L = ["when tick", `change self.x by ${vx}`];
  if (vx > 0) {
    L.push("if self.x > 492 then", "  set self.x to -12", "end");
  } else {
    L.push("if self.x < -12 then", "  set self.x to 492", "end");
  }
  L.push("end");
  return L.join("\n");
}

// shared movement tail: clamp to the field, then the moving walls push back
function moveTail(push) {
  push(`  set self.x to max(${X0}, min(${X1}, self.x))`);
  push(`  set self.y to max(${Y0}, min(${Y1}, self.y))`);
  for (let i = 1; i <= NWALL; i++) {
    push(`  if abs(self.x - w${i}.x) < 16 and abs(self.y - w${i}.y) < 16 then`);
    push("    set self.x to oldx");
    push("    set self.y to oldy");
    push("  end");
  }
}

function chaserCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game != 9)");
  push("if game == 0 then");
  push("  set oldx to self.x");
  push("  set oldy to self.y");
  push(`  if keydown("w") then`);
  push(`    change self.y by -${CH_SPD}`);
  push("  end");
  push(`  if keydown("s") then`);
  push(`    change self.y by ${CH_SPD}`);
  push("  end");
  push(`  if keydown("a") then`);
  push(`    change self.x by -${CH_SPD}`);
  push("  end");
  push(`  if keydown("d") then`);
  push(`    change self.x by ${CH_SPD}`);
  push("  end");
  moveTail(push);
  // THE CATCH — the whole point of the machine
  push("  if dist(self, runner) < 15 then");
  push("    change catches by 1");
  push("    explode runner");
  push("    beep 523 for 0.08");
  push("    beep 784 for 0.18");   // the two-tone GOTCHA
  push('    say "GOTCHA!" for 1');
  push(`    set self.x to ${CHX}`);
  push(`    set self.y to ${CHY}`);
  push(`    set runner.x to ${RNX}`);
  push(`    set runner.y to ${RNY}`);
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

function runnerCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game != 9)");
  push("if game == 0 then");
  push("  set oldx to self.x");
  push("  set oldy to self.y");
  push("  if mode == 1 then");
  // 1P: the machine flees — straight away from the chaser when close,
  // drifting back toward open ground when safe (so it can't camp a corner)
  push("    if dist(self, chaser) < 140 then");
  push("      if chaser.x > self.x then");
  push(`        change self.x by -${AI_SPD}`);
  push("      else");
  push(`        change self.x by ${AI_SPD}`);
  push("      end");
  push("      if chaser.y > self.y then");
  push(`        change self.y by -${AI_SPD}`);
  push("      else");
  push(`        change self.y by ${AI_SPD}`);
  push("      end");
  push("    else");
  push("      set self.x to self.x + max(-1.2, min(1.2, 240 - self.x))");
  push("      set self.y to self.y + max(-1.2, min(1.2, 190 - self.y))");
  push("    end");
  push("  else");
  push(`    if keydown("ArrowUp") then`);
  push(`      change self.y by -${RN_SPD}`);
  push("    end");
  push(`    if keydown("ArrowDown") then`);
  push(`      change self.y by ${RN_SPD}`);
  push("    end");
  push(`    if keydown("ArrowLeft") then`);
  push(`      change self.x by -${RN_SPD}`);
  push("    end");
  push(`    if keydown("ArrowRight") then`);
  push(`      change self.x by ${RN_SPD}`);
  push("    end");
  push("  end");
  moveTail(push);
  push("end");
  push("end");
  return L.join("\n");
}

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const startMatch = (pad, mode) => {
    push(`${pad}set mode to ${mode}`);
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set catches to 0`);
    push(`${pad}set timeleft to ${T}`);
    push(`${pad}set chaser.x to ${CHX}`);
    push(`${pad}set chaser.y to ${CHY}`);
    push(`${pad}set runner.x to ${RNX}`);
    push(`${pad}set runner.y to ${RNY}`);
    push(`${pad}set self.text to "THE BOX HUNTS THE RING"`);
  };

  push("when start");
  push("set game to 9");              // attract mode
  push("set mode to 2");
  push("set catches to 0");
  push(`set timeleft to ${T}`);
  push("set endplay to 0");
  push('set self.text to ""');
  push("end");

  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set p1btn.visible to (game == 9)");
  push("set p2btn.visible to (game == 9)");
  push("set scoretx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PICK A MODE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — PICK A MODE ◎"');
  push("end");

  push('set scoretx.text to "CATCHES " + catches');
  push("set score to catches");   // the reserved var → the HIGH SCORES table
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60))');

  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");        // the quarter is spent — arcade contract
  push("    beep 150 for 0.5");        // time-up buzzer
  push('    set self.text to "" + catches + " CATCHES — CLICK FOR ATTRACT"');
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

export function buildGotchaExample() {
  const objects = [];

  // the moving maze (also the live attract reel)
  for (let i = 1; i <= NWALL; i++) {
    const w = wallSpec(i - 1);
    objects.push({
      id: "gt_w" + i, name: "w" + i, type: "box",
      x: w.x, y: w.y, size: WALL, color: WALLC, glow: 4, visible: 1, text: "",
      script: [{ event: "code", source: wallCode(w.vx) }]
    });
  }

  // the pursuer — a square, as on the real machine
  objects.push({
    id: "gt_ch", name: "chaser", type: "box",
    x: CHX, y: CHY, size: 12, color: AMBER, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: chaserCode() }]
  });
  // the pursued — the original drew a plus sign; ours is a ring
  objects.push({
    id: "gt_rn", name: "runner", type: "ring",
    x: RNX, y: RNY, size: 7, color: GREEN, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: runnerCode() }]
  });

  // HUD
  objects.push({
    id: "gt_sc", name: "scoretx", type: "text",
    x: 100, y: 28, size: 14, color: AMBER, glow: 8, visible: 0, text: "CATCHES 0", script: []
  });
  objects.push({
    id: "gt_tm", name: "timetx", type: "text",
    x: 385, y: 28, size: 14, color: WHITE, glow: 8, visible: 0, text: "TIME 60", script: []
  });
  // the brain doubles as the status line
  objects.push({
    id: "gt_status", name: "status", type: "text",
    x: 240, y: 28, size: 11, color: DIM, glow: 4, visible: 1, text: "",
    script: [{ event: "code", source: brainCode() }]
  });

  // attract screen
  objects.push({
    id: "gt_big", name: "bigtitle", type: "text",
    x: 240, y: 150, size: 56, color: WHITE, glow: 18, visible: 1, text: "GOTCHA", script: []
  });
  objects.push({
    id: "gt_coin", name: "coinline", type: "text",
    x: 240, y: 200, size: 14, color: WHITE, glow: 8, visible: 1,
    text: "◎ INSERT COIN — PICK A MODE ◎", script: []
  });
  objects.push({
    id: "gt_p1", name: "p1btn", type: "text",
    x: 168, y: 268, size: 16, color: AMBER, glow: 12, visible: 1,
    text: "[ 1 PLAYER ]", script: []
  });
  objects.push({
    id: "gt_p2", name: "p2btn", type: "text",
    x: 315, y: 268, size: 16, color: GREEN, glow: 12, visible: 1,
    text: "[ 2 PLAYERS ]", script: []
  });

  objects.push({
    id: "gt_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "ATARI 1973 · CHASER W A S D · RUNNER ARROWS · THE MAZE NEVER STOPS",
    script: []
  });

  return { title: "Gotcha (1973)", objects };
}

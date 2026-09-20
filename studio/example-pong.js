// example-pong.js — PONG (1972), rebuilt in our studio.
// Allan Alcorn built it as a training exercise; Atari put the prototype in
// Andy Capp's Tavern and it "broke" within days — the milk-carton coin box was
// jammed FULL of quarters. The first commercially successful video game, and
// the cabinet carried exactly one instruction:
//
//                 AVOID MISSING BALL FOR HIGH SCORE
//
// What Pong added over the Odyssey game it was inspired by (and got sued
// over), all faithfully here:
//   · the SEGMENTED PADDLE — where the ball strikes decides its angle,
//     so placement is the skill (edges = sharp angles, center = flat)
//   · rallies SPEED UP with every return
//   · an on-screen score (the Odyssey made you count!)
//   · a coin-op attract cycle — click is the quarter
//
//   LEFT: W / S · RIGHT: ↑ / ↓ · first to 11
//   1 PLAYER mode: the machine returns everything it can reach — beat it
//   with angles. 2 PLAYERS: pure 1972 tavern rules.

const TOP = 30, BOT = 330, LPX = 34, RPX = 446;
const PSPD = 4.4, SERVE_SPD = 4, SPD_UP = 0.35, SPD_MAX = 8, WIN = 11;
const AI_SPD = 3.3, DEFLECT = 0.16;
const WHITE = "#ffffff", DIM = "#7a8894";

function padCode(up, down, isRight) {
  const L = [];
  const push = (s) => L.push(s);
  const t = isRight ? "rpadt" : "lpadt", b = isRight ? "rpadb" : "lpadb";
  push("when tick");
  push("if game == 0 then");
  if (isRight) {
    // 1P: the machine plays the right paddle — tracks the incoming ball,
    // drifts home when the ball is heading away. Beatable with sharp angles.
    push("  if mode == 1 then");
    push("    if vx > 0 then");
    push("      set want to ball.y");
    push("    else");
    push("      set want to 180");
    push("    end");
    push(`    set self.y to self.y + max(-${AI_SPD}, min(${AI_SPD}, want - self.y))`);
    push("  else");
    push(`    if keydown("${up}") then`);
    push(`      change self.y by -${PSPD}`);
    push("    end");
    push(`    if keydown("${down}") then`);
    push(`      change self.y by ${PSPD}`);
    push("    end");
    push("  end");
  } else {
    push(`  if keydown("${up}") then`);
    push(`    change self.y by -${PSPD}`);
    push("  end");
    push(`  if keydown("${down}") then`);
    push(`    change self.y by ${PSPD}`);
    push("  end");
  }
  push(`  set self.y to max(${TOP + 24}, min(${BOT - 24}, self.y))`);
  push("end");
  // the segments ride along (and show the paddle only in a live game)
  push("set self.visible to (game != 9)");
  push(`set ${t}.visible to (game != 9)`);
  push(`set ${b}.visible to (game != 9)`);
  push(`set ${t}.y to self.y - 15`);
  push(`set ${b}.y to self.y + 15`);
  push("end");
  return L.join("\n");
}

function ballCode() {
  const L = [];
  const push = (s) => L.push(s);

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set lscore to 0`);
    push(`${pad}set rscore to 0`);
    push(`${pad}set serving to 1`);
    push(`${pad}set servetimer to 45`);
    push(`${pad}set servedir to 1`);
    push(`${pad}set speed to ${SERVE_SPD}`);
    push(`${pad}set self.x to 240`);
    push(`${pad}set self.y to 180`);
    push(`${pad}set vx to 0`);
    push(`${pad}set vy to 0`);
    push(`${pad}set lpad.y to 180`);
    push(`${pad}set rpad.y to 180`);
    push(`${pad}set status.text to "AVOID MISSING BALL FOR HIGH SCORE"`);
  };
  const scoreBlock = (who, pad) => {
    push(`${pad}set ${who}score to ${who}score + 1`);
    push(`${pad}explode self`);
    push(`${pad}if ${who}score >= ${WIN} then`);
    push(`${pad}  set game to 2`);
    push(`${pad}  set status.text to "${who === "l" ? "LEFT" : "RIGHT"} WINS ${"—"} CLICK FOR A NEW GAME"`);
    push(`${pad}else`);
    push(`${pad}  set serving to 1`);
    push(`${pad}  set servetimer to 45`);
    push(`${pad}  set servedir to ${who === "l" ? 1 : -1}`);
    push(`${pad}  set speed to ${SERVE_SPD}`);
    push(`${pad}  set self.x to 240`);
    push(`${pad}  set self.y to 180`);
    push(`${pad}  set vx to 0`);
    push(`${pad}  set vy to 0`);
    push(`${pad}end`);
  };

  push("when start");
  push("set game to 9");        // attract mode
  push("set mode to 2");
  push("set lscore to 0");
  push("set rscore to 0");
  push("set vx to 3");
  push("set vy to 2");
  push("set speed to 0");
  push('set status.text to ""');
  push("end");

  push("when tick");
  // scoreboard + attract-only elements
  push('set lscoretx.text to "" + lscore');
  push('set rscoretx.text to "" + rscore');
  push("set lscoretx.visible to (game != 9)");
  push("set rscoretx.visible to (game != 9)");
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set p1btn.visible to (game == 9)");
  push("set p2btn.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");   // the marquee blinks

  push("if game == 9 then");
  // attract: the ball plays with itself, corner to corner
  push("  change self.x by vx");
  push("  change self.y by vy");
  push("  if self.x < 8 or self.x > 472 then");
  push("    set vx to 0 - vx");
  push("  end");
  push(`  if self.y < ${TOP} or self.y > ${BOT} then`);
  push("    set vy to 0 - vy");
  push("  end");
  push("end");

  push("if game == 0 then");
  push("  if serving == 1 then");
  push("    set servetimer to servetimer - 1");
  push("    if servetimer <= 0 then");
  push("      set serving to 0");
  push("      set vx to speed * servedir");
  push("      set vy to rand(-2.5, 2.5)");
  push("    end");
  push("  else");
  push("    change self.x by vx");
  push("    change self.y by vy");
  push(`    if self.y < ${TOP} then`);
  push(`      set self.y to ${TOP}`);
  push("      set vy to 0 - vy");
  push("    end");
  push(`    if self.y > ${BOT} then`);
  push(`      set self.y to ${BOT}`);
  push("      set vy to 0 - vy");
  push("    end");
  // THE PONG MECHANIC: where you catch it decides where it goes —
  // and every return is faster than the last
  push(`    if vx < 0 and abs(self.x - lpad.x) < 12 and abs(self.y - lpad.y) < 26 then`);
  push(`      set speed to min(${SPD_MAX}, speed + ${SPD_UP})`);
  push("      set vx to speed");
  push(`      set vy to max(-4.5, min(4.5, (self.y - lpad.y) * ${DEFLECT} + vy * 0.25))`);
  push("    end");
  push(`    if vx > 0 and abs(self.x - rpad.x) < 12 and abs(self.y - rpad.y) < 26 then`);
  push(`      set speed to min(${SPD_MAX}, speed + ${SPD_UP})`);
  push("      set vx to 0 - speed");
  push(`      set vy to max(-4.5, min(4.5, (self.y - rpad.y) * ${DEFLECT} + vy * 0.25))`);
  push("    end");
  push("    if self.x > 486 then");
  scoreBlock("l", "      ");
  push("    end");
  push("    if self.x < -6 then");
  scoreBlock("r", "      ");
  push("    end");
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 168) < 62 and abs(mousey() - 262) < 16 then");
  push("    set mode to 1");
  startMatch("    ");
  push("  end");
  push("  if abs(mousex() - 315) < 66 and abs(mousey() - 262) < 16 then");
  push("    set mode to 2");
  startMatch("    ");
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("    set vx to 3");
  push("    set vy to 2");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildPongExample() {
  const objects = [];

  // the dashed net
  for (let y = TOP; y <= BOT; y += 22) {
    objects.push({
      id: "pg_n" + y, name: "net" + y, type: "box",
      x: 240, y, size: 5, color: DIM, glow: 3, visible: 1, text: "", script: []
    });
  }

  // paddles: three segments each — Pong's angle-control, visible
  const seg = (id, name, x, dy, script) => objects.push({
    id, name, type: "box",
    x, y: 180 + dy, size: 14, color: WHITE, glow: 10, visible: 1, text: "",
    script: script || []
  });
  seg("pg_lt", "lpadt", LPX, -15);
  seg("pg_lm", "lpad", LPX, 0, [{ event: "code", source: padCode("w", "s", false) }]);
  seg("pg_lb", "lpadb", LPX, 15);
  seg("pg_rt", "rpadt", RPX, -15);
  seg("pg_rm", "rpad", RPX, 0, [{ event: "code", source: padCode("ArrowUp", "ArrowDown", true) }]);
  seg("pg_rb", "rpadb", RPX, 15);

  objects.push({
    id: "pg_ball", name: "ball", type: "box",
    x: 240, y: 180, size: 9, color: WHITE, glow: 14, visible: 1, text: "",
    script: [{ event: "code", source: ballCode() }]
  });

  objects.push({
    id: "pg_ls", name: "lscoretx", type: "text",
    x: 170, y: 62, size: 36, color: WHITE, glow: 8, visible: 0, text: "0", script: []
  });
  objects.push({
    id: "pg_rs", name: "rscoretx", type: "text",
    x: 310, y: 62, size: 36, color: WHITE, glow: 8, visible: 0, text: "0", script: []
  });

  // attract screen
  objects.push({
    id: "pg_big", name: "bigtitle", type: "text",
    x: 240, y: 140, size: 64, color: WHITE, glow: 18, visible: 1, text: "PONG", script: []
  });
  objects.push({
    id: "pg_coin", name: "coinline", type: "text",
    x: 240, y: 190, size: 14, color: WHITE, glow: 8, visible: 1,
    text: "◎ INSERT COIN — PICK A MODE ◎", script: []
  });
  objects.push({
    id: "pg_p1", name: "p1btn", type: "text",
    x: 168, y: 268, size: 16, color: "#7dff9e", glow: 12, visible: 1,
    text: "[ 1 PLAYER ]", script: []
  });
  objects.push({
    id: "pg_p2", name: "p2btn", type: "text",
    x: 315, y: 268, size: 16, color: "#ff9d4a", glow: 12, visible: 1,
    text: "[ 2 PLAYERS ]", script: []
  });

  objects.push({
    id: "pg_status", name: "status", type: "text",
    x: 240, y: 20, size: 12, color: DIM, glow: 4, visible: 1, text: "", script: []
  });
  objects.push({
    id: "pg_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "PONG · ATARI 1972 · LEFT W/S · RIGHT ↑/↓ · EDGES OF YOUR PADDLE = SHARP ANGLES · RALLIES SPEED UP · FIRST TO 11",
    script: []
  });

  return { title: "Pong (1972)", objects };
}

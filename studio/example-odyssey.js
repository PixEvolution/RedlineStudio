// example-odyssey.js — Magnavox Odyssey Table Tennis (1972), rebuilt in our studio.
// The Odyssey was the FIRST HOME CONSOLE — video games left the arcade and
// plugged into the living-room TV. No sound, no on-screen score, plastic
// overlays taped to the screen, and square white blobs for players. Its Table
// Tennis game is the one Nolan Bushnell played at a demo in May 1972 — months
// later Atari shipped Pong, and Magnavox sued (and won).
//
// The Odyssey's secret weapon was its third knob: ENGLISH. After you hit the
// ball you could keep steering it mid-flight, curving it away from your
// opponent. That's faithfully here: after your hit, HOLD your up/down keys to
// bend the ball's path until the other player touches it.
//
//   LEFT:  W / S move (and curve after your hit)
//   RIGHT: ↑ / ↓ move (and curve after your hit)
//   Miss = point against you · first to 11 · click to reset
// TV-white blobs on black, square everything — pure 1972 living room.

const TOP = 28, BOT = 332, LPX = 42, RPX = 438;
const PSPD = 4.2, BSPD = 4.2, ENGLISH = 0.09, WIN = 11;
const WHITE = "#e8f6ff", DIM = "#5a6b78";

function paddleCode(up, down) {
  return [
    "when tick",
    "if gameover == 0 then",
    `  if keydown("${up}") then`,
    `    change self.y by -${PSPD}`,
    "  end",
    `  if keydown("${down}") then`,
    `    change self.y by ${PSPD}`,
    "  end",
    `  set self.y to max(${TOP + 20}, min(${BOT - 20}, self.y))`,
    "end",
    "end"
  ].join("\n");
}

function ballCode() {
  const L = [];
  const push = (s) => L.push(s);
  const resetLines = (pad) => {
    push(`${pad}set lscore to 0`);
    push(`${pad}set rscore to 0`);
    push(`${pad}set gameover to 0`);
    push(`${pad}set serving to 1`);
    push(`${pad}set servetimer to 45`);
    push(`${pad}set servedir to 1`);
    push(`${pad}set lasthit to 0`);
    push(`${pad}set self.x to 240`);
    push(`${pad}set self.y to 180`);
    push(`${pad}set vx to 0`);
    push(`${pad}set vy to 0`);
    push(`${pad}set status.text to "FIRST TO ${WIN} — THE ODYSSEY KEEPS SCORE SO YOU DON'T HAVE TO"`);
  };
  const scoreBlock = (who /* "l" or "r" */, pad) => {
    push(`${pad}set ${who}score to ${who}score + 1`);
    push(`${pad}explode self`);
    push(`${pad}if ${who}score >= ${WIN} then`);
    push(`${pad}  set gameover to 1`);
    push(`${pad}  set status.text to "${who === "l" ? "LEFT" : "RIGHT"} WINS THE MATCH — CLICK TO RESET"`);
    push(`${pad}else`);
    push(`${pad}  set serving to 1`);
    push(`${pad}  set servetimer to 45`);
    push(`${pad}  set servedir to ${who === "l" ? 1 : -1}`);   // serve continues toward the loser
    push(`${pad}  set self.x to 240`);
    push(`${pad}  set self.y to 180`);
    push(`${pad}  set vx to 0`);
    push(`${pad}  set vy to 0`);
    push(`${pad}  set lasthit to 0`);
    push(`${pad}  set status.text to ""`);
    push(`${pad}end`);
  };

  push("when start");
  resetLines("");
  push("end");

  push("when tick");
  push('set lscoretx.text to "" + lscore');
  push('set rscoretx.text to "" + rscore');
  push("if gameover == 0 then");
  // serve
  push("  if serving == 1 then");
  push("    set servetimer to servetimer - 1");
  push("    if servetimer <= 0 then");
  push("      set serving to 0");
  push(`      set vx to ${BSPD} * servedir`);
  push("      set vy to rand(-2, 2)");
  push("    end");
  push("  else");
  // ENGLISH: the last hitter steers the ball until the opponent touches it
  push("    if lasthit == 1 and vx > 0 then");
  push('      if keydown("w") then');
  push(`        set vy to vy - ${ENGLISH}`);
  push("      end");
  push('      if keydown("s") then');
  push(`        set vy to vy + ${ENGLISH}`);
  push("      end");
  push("    end");
  push("    if lasthit == -1 and vx < 0 then");
  push('      if keydown("ArrowUp") then');
  push(`        set vy to vy - ${ENGLISH}`);
  push("      end");
  push('      if keydown("ArrowDown") then');
  push(`        set vy to vy + ${ENGLISH}`);
  push("      end");
  push("    end");
  push("    set vy to max(-4, min(4, vy))");
  // move + wall bounces
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
  // paddle hits (square blobs, square ball — very 1972)
  push(`    if vx < 0 and abs(self.x - lpad.x) < 15 and abs(self.y - lpad.y) < 21 then`);
  push("      set vx to 0 - vx");
  push("      set vy to vy + (self.y - lpad.y) * 0.12");
  push("      set lasthit to 1");
  push("    end");
  push(`    if vx > 0 and abs(self.x - rpad.x) < 15 and abs(self.y - rpad.y) < 21 then`);
  push("      set vx to 0 - vx");
  push("      set vy to vy + (self.y - rpad.y) * 0.12");
  push("      set lasthit to -1");
  push("    end");
  // out the sides = point
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
  push("if gameover == 1 then");
  resetLines("  ");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildOdysseyExample() {
  const objects = [];

  // the center line — the plastic overlay, in dots
  for (let y = TOP; y <= BOT; y += 16) {
    objects.push({
      id: "od_c" + y, name: "cl" + y, type: "box",
      x: 240, y, size: 4, color: DIM, glow: 2, visible: 1, text: "", script: []
    });
  }

  objects.push({
    id: "od_lpad", name: "lpad", type: "box",
    x: LPX, y: 180, size: 22, color: WHITE, glow: 10, visible: 1, text: "",
    script: [{ event: "code", source: paddleCode("w", "s") }]
  });
  objects.push({
    id: "od_rpad", name: "rpad", type: "box",
    x: RPX, y: 180, size: 22, color: WHITE, glow: 10, visible: 1, text: "",
    script: [{ event: "code", source: paddleCode("ArrowUp", "ArrowDown") }]
  });

  // the ball owns all the rules
  objects.push({
    id: "od_ball", name: "ball", type: "box",
    x: 240, y: 180, size: 10, color: WHITE, glow: 14, visible: 1, text: "",
    script: [{ event: "code", source: ballCode() }]
  });

  objects.push({
    id: "od_ls", name: "lscoretx", type: "text",
    x: 180, y: 50, size: 28, color: DIM, glow: 4, visible: 1, text: "0", script: []
  });
  objects.push({
    id: "od_rs", name: "rscoretx", type: "text",
    x: 300, y: 50, size: 28, color: DIM, glow: 4, visible: 1, text: "0", script: []
  });
  objects.push({
    id: "od_status", name: "status", type: "text",
    x: 240, y: 22, size: 11, color: DIM, glow: 3, visible: 1,
    text: "FIRST TO 11", script: []
  });
  objects.push({
    id: "od_title", name: "title", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "ODYSSEY 1972 · LEFT W/S · RIGHT ↑/↓ · HOLD KEYS AFTER A HIT = ENGLISH",
    script: []
  });

  return { title: "Odyssey Table Tennis (1972)", objects };
}

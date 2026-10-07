// example-breakout.js — BREAKOUT (1976), rebuilt in our studio.
//
// Nolan Bushnell wanted "Pong you can play alone." Al Alcorn offered a bonus
// for every chip UNDER 50 in the design — and the prototype came back from a
// young Steve Wozniak (roped in by his buddy Steve Jobs, who pocketed most of
// the bonus and told Woz it was $700) at an absurd ~45 chips. Too clever to
// manufacture, Atari rebuilt it conventionally — still ALL hardwired logic,
// no CPU, one year after Gun Fight put the first microprocessor in a cabinet.
// The monitor stood VERTICAL in the cabinet, so our world is portrait 360×480,
// and the "colors" were cellophane strips taped over a black-and-white tube —
// exactly the four bands here.
//
// Everything the 1976 board did, faithfully:
//   · 8 rows × 14 bricks; the rows pay 1 / 3 / 5 / 7 the higher you dig
//   · the ball SPEEDS UP: on its 4th hit, its 12th, and the first time it
//     reaches the orange and red bands
//   · break through to the TOP WALL and your paddle SHRINKS TO HALF
//   · clear the wall and a SECOND one drops in; clear that and the machine
//     surrenders (896 is a perfect game — 448 a wall)
//   · 3 balls per coin, knob control → our stick is the knob
//
//   MOVE: A/D or ←/→ or 🕹 stick 1 (the knob) · SPACE serves · 3 balls

const W = 360, H = 480;
const LEFT = 12, RIGHT = 348, TOPWALL = 44;          // the playfield walls
const BTOP = 90, CELLW = 24, CELLH = 14, COLS = 14, ROWS = 8;
const BAND0 = BTOP - CELLH / 2;                      // top edge of the brick band
const PADY = 440, PSPD = 6, SERVE_SPD = 3.2, SPD_MAX = 7, SPD_UP = 0.9;
const WHITE = "#ffffff", DIM = "#7a8894";
const RED = "#e5322d", ORANGE = "#ff9d4a", GREEN = "#39ff5e", YELLOW = "#ffe14a";

// refill the whole wall — used at boot, at match start, and when wall 2 drops
const fillWall = (pad) => [
  `${pad}set i to 0`,
  `${pad}repeat ${COLS * ROWS}`,
  `${pad}  set b[i] to 1`,
  `${pad}  set i to i + 1`,
  `${pad}end`,
  `${pad}set left to ${COLS * ROWS}`
];

function padCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  // the whole paddle hides in attract; the outer thirds hide when SHRUNK
  push("set self.visible to (game != 9)");
  push("set padl.visible to (game != 9 and shrunk == 0)");
  push("set padr.visible to (game != 9 and shrunk == 0)");
  push("if game == 0 then");
  // keys AND the stick — the stick is 1976's knob, analog all the way
  push(`  set mv to max(-1, min(1, keydown("ArrowRight") + keydown("d") - keydown("ArrowLeft") - keydown("a") + stickx(1)))`);
  push(`  change self.x by mv * ${PSPD}`);
  push("  set hw to 24 - shrunk * 16");
  push(`  set self.x to max(${LEFT} + hw, min(${RIGHT} - hw, self.x))`);
  push("end");
  push("set padl.x to self.x - 16");
  push("set padr.x to self.x + 16");
  push("end");
  return L.join("\n");
}

function ballCode() {
  const L = [];
  const push = (s) => L.push(s);

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set balls to 3`);
    push(`${pad}set scr to 1`);
    push(`${pad}set shrunk to 0`);
    push(`${pad}set hits to 0`);
    push(`${pad}set oflag to 0`);
    push(`${pad}set rflag to 0`);
    push(`${pad}set speed to ${SERVE_SPD}`);
    for (const line of fillWall(pad)) push(line);
    push(`${pad}set pad.x to ${W / 2}`);
    push(`${pad}set serving to 1`);
    push(`${pad}set servetimer to 90`);
    push(`${pad}set status.text to "SPACE SERVES — OR WAIT AND IT SERVES ITSELF"`);
  };

  // the 1976 speed ladder: one bump, scaled onto the current direction
  const speedUp = (pad) => {
    push(`${pad}set ns to min(${SPD_MAX}, speed + ${SPD_UP})`);
    push(`${pad}set kk to ns / speed`);
    push(`${pad}set vx to vx * kk`);
    push(`${pad}set vy to vy * kk`);
    push(`${pad}set speed to ns`);
  };

  push("when start");
  push("set game to 9");            // attract: the full wall + a wandering ball
  push("set score to 0");
  push("set balls to 0");
  push("set shrunk to 0");
  push("set scr to 1");
  push("set endplay to 0");
  push("set vx to 2.4");
  push("set vy to 1.8");
  for (const line of fillWall("")) push(line);
  push('set status.text to ""');
  push("end");

  push("when tick");
  // scoreboard + attract-only furniture
  push('set scoretx.text to "" + score');
  push('set ballstx.text to "BALLS " + balls');
  push('set walltx.text to "WALL " + scr');
  push("set scoretx.visible to (game != 9)");
  push("set ballstx.visible to (game != 9)");
  push("set walltx.visible to (game != 9)");
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO PLAY ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO PLAY ◎"');
  push("end");

  push("if game == 9 then");
  // attract: the ball noodles around the full wall, corner to corner
  push("  change self.x by vx");
  push("  change self.y by vy");
  push(`  if self.x < ${LEFT} or self.x > ${RIGHT} then`);
  push("    set vx to 0 - vx");
  push("  end");
  push(`  if self.y < ${TOPWALL} or self.y > 460 then`);
  push("    set vy to 0 - vy");
  push("  end");
  push("end");

  push("if game == 0 then");
  push("  if serving == 1 then");
  // the ball rides the paddle until SPACE (or the timer) lets it go
  push("    set self.x to pad.x");
  push(`    set self.y to ${PADY - 12}`);
  push("    set servetimer to servetimer - 1");
  push(`    if keydown("Space") or servetimer <= 0 then`);
  push("      set serving to 0");
  push('      set status.text to ""');
  push("      set vy to 0 - speed");
  push("      set vx to rand(-2.2, 2.2)");
  push("      if vx > -0.7 and vx < 0.7 then");
  push("        set vx to 1.4");
  push("      end");
  push("      beep 392 for 0.06");
  push("    end");
  push("  else");
  push("    change self.x by vx");
  push("    change self.y by vy");
  // the three walls
  push(`    if self.x < ${LEFT} then`);
  push(`      set self.x to ${LEFT}`);
  push("      set vx to abs(vx)");
  push("      beep 226 for 0.04");
  push("    end");
  push(`    if self.x > ${RIGHT} then`);
  push(`      set self.x to ${RIGHT}`);
  push("      set vx to 0 - abs(vx)");
  push("      beep 226 for 0.04");
  push("    end");
  push(`    if self.y < ${TOPWALL} then`);
  push(`      set self.y to ${TOPWALL}`);
  push("      set vy to abs(vy)");
  push("      beep 226 for 0.04");
  // 1976's cruelest rule: reach the top wall and the paddle SHRINKS
  push("      if shrunk == 0 then");
  push("        set shrunk to 1");
  push('        set status.text to "TOP WALL — PADDLE SHRUNK!"');
  push("      end");
  push("    end");
  // THE WALL: the ball's position IS the brick index — pure 1976 grid math
  push(`    if self.y >= ${BAND0} and self.y < ${BAND0 + ROWS * CELLH} then`);
  push(`      set row to floor((self.y - ${BAND0}) / ${CELLH})`);
  push(`      set col to floor((self.x - ${LEFT}) / ${CELLW})`);
  push("      if col < 0 then");
  push("        set col to 0");
  push("      end");
  push(`      if col > ${COLS - 1} then`);
  push(`        set col to ${COLS - 1}`);
  push("      end");
  push(`      set idx to row * ${COLS} + col`);
  push("      if b[idx] == 1 then");
  push("        set b[idx] to 0");
  push("        set left to left - 1");
  push("        set vy to 0 - vy");
  push("        set hits to hits + 1");
  // the four bands pay 7 / 5 / 3 / 1 — and each has its own voice
  push("        if row < 2 then");
  push("          change score by 7");
  push("          beep 494 for 0.05");
  push("          if rflag == 0 then");
  push("            set rflag to 1");
  speedUp("            ");
  push("          end");
  push("        else");
  push("          if row < 4 then");
  push("            change score by 5");
  push("            beep 392 for 0.05");
  push("            if oflag == 0 then");
  push("              set oflag to 1");
  speedUp("              ");
  push("            end");
  push("          else");
  push("            if row < 6 then");
  push("              change score by 3");
  push("              beep 330 for 0.05");
  push("            else");
  push("              change score by 1");
  push("              beep 262 for 0.05");
  push("            end");
  push("          end");
  push("        end");
  // the hit-count ladder: faster on the 4th and 12th brick
  push("        if hits == 4 or hits == 12 then");
  speedUp("          ");
  push("        end");
  // wall cleared: drop in wall two — or take the machine's surrender
  push("        if left == 0 then");
  push("          if scr == 1 then");
  push("            set scr to 2");
  for (const line of fillWall("            ")) push(line);
  push("            set serving to 1");
  push("            set servetimer to 90");
  push('            set status.text to "WALL CLEARED — HERE COMES THE SECOND"');
  push("          else");
  push("            set game to 2");
  push("            set endplay to 1");
  push('            set status.text to "BOTH WALLS DOWN — A PERFECT MACHINE. CLICK FOR A NEW GAME"');
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  // the paddle: where you catch it decides the angle — Pong's lesson, kept
  push(`    if vy > 0 and self.y > ${PADY - 8} and self.y < ${PADY + 8} then`);
  push("      set hw to 24 - shrunk * 16");
  push("      if abs(self.x - pad.x) < hw + 4 then");
  push(`        set self.y to ${PADY - 8}`);
  push("        set vy to 0 - abs(vy)");
  push("        set vx to max(-5, min(5, (self.x - pad.x) * 0.22 + vx * 0.3))");
  push("        beep 459 for 0.04");
  push("      end");
  push("    end");
  // the drain
  push("    if self.y > 474 then");
  push("      explode self");
  push("      beep 165 for 0.3");
  push("      set balls to balls - 1");
  push("      if balls <= 0 then");
  push("        set game to 2");
  push("        set endplay to 1");
  push('        set status.text to "GAME OVER — CLICK FOR A NEW GAME"');
  push("      else");
  push("        set serving to 1");
  push("        set servetimer to 90");
  push('        set status.text to "BALL LOST — SPACE SERVES THE NEXT"');
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  startMatch("  ");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("    set shrunk to 0");
  push("    set vx to 2.4");
  push("    set vy to 1.8");
  push(`    set self.x to ${W / 2}`);
  push("    set self.y to 300");
  for (const line of fillWall("    ")) push(line);
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildBreakoutExample() {
  const objects = [];

  // the cabinet's three walls — Maze War's line object, standing guard
  objects.push({ id: "bo_wt", name: "walltop", type: "line", x: LEFT - 4, y: TOPWALL - 6, size: (RIGHT - LEFT) + 8, angle: 0, color: DIM, glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "bo_wl", name: "wallleft", type: "line", x: LEFT - 4, y: TOPWALL - 6, size: 446 - TOPWALL, angle: 90, color: DIM, glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "bo_wr", name: "wallright", type: "line", x: RIGHT + 4, y: TOPWALL - 6, size: 446 - TOPWALL, angle: 90, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // THE WALL: 8 rows × 14 bricks. Cellophane bands on a B&W tube:
  // red pays 7, orange 5, green 3, yellow 1. Each brick is a display-only
  // slab watching its own slot in the b[] list — the ball does grid MATH,
  // it never collides with these objects.
  const bandColor = (row) => row < 2 ? RED : row < 4 ? ORANGE : row < 6 ? GREEN : YELLOW;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c;
      objects.push({
        id: "bo_b" + k, name: "brick" + (k + 1), type: "line",
        x: LEFT + c * CELLW + 2, y: BTOP + r * CELLH, size: CELLW - 4, angle: 0,
        color: bandColor(r), glow: 10, visible: 1, text: "",
        script: [{ event: "code", source: `when tick\nset self.visible to b[${k}]\nend` }]
      });
    }
  }

  // the paddle: three slabs — outer two vanish when the top wall shrinks it
  objects.push({ id: "bo_pl", name: "padl", type: "box", x: W / 2 - 16, y: PADY, size: 16, color: WHITE, glow: 10, visible: 1, text: "", script: [] });
  objects.push({ id: "bo_pm", name: "pad", type: "box", x: W / 2, y: PADY, size: 16, color: WHITE, glow: 10, visible: 1, text: "", script: [{ event: "code", source: padCode() }] });
  objects.push({ id: "bo_pr", name: "padr", type: "box", x: W / 2 + 16, y: PADY, size: 16, color: WHITE, glow: 10, visible: 1, text: "", script: [] });

  objects.push({
    id: "bo_ball", name: "ball", type: "box",
    x: W / 2, y: 300, size: 7, color: WHITE, glow: 14, visible: 1, text: "",
    script: [{ event: "code", source: ballCode() }]
  });

  // HUD
  objects.push({ id: "bo_sc", name: "scoretx", type: "text", x: 60, y: 24, size: 26, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "bo_bl", name: "ballstx", type: "text", x: 292, y: 20, size: 12, color: DIM, glow: 4, visible: 0, text: "BALLS 3", script: [] });
  objects.push({ id: "bo_wn", name: "walltx", type: "text", x: 292, y: 34, size: 12, color: DIM, glow: 4, visible: 0, text: "WALL 1", script: [] });
  objects.push({ id: "bo_st", name: "status", type: "text", x: W / 2, y: 412, size: 11, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "bo_big", name: "bigtitle", type: "text", x: W / 2, y: 250, size: 44, color: WHITE, glow: 18, visible: 1, text: "BREAKOUT", script: [] });
  objects.push({ id: "bo_coin", name: "coinline", type: "text", x: W / 2, y: 290, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO PLAY ◎", script: [] });
  objects.push({ id: "bo_play", name: "playbtn", type: "text", x: W / 2, y: 330, size: 16, color: "#7dff9e", glow: 12, visible: 1, text: "[ PLAY ]", script: [] });
  objects.push({
    id: "bo_help", name: "help", type: "text",
    x: W / 2, y: 470, size: 9, color: DIM, glow: 3, visible: 1,
    text: "ATARI 1976 · A/D OR THE KNOB · SPACE SERVES · 896 IS PERFECT",
    script: []
  });
  // the stick wears the knob's name
  objects.push({ id: "bo_s1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "KNOB", script: [] });

  return { title: "Breakout (1976)",
    display: "bw72", hardware: "logic72",   // the real machine's era
    w: W, h: H, objects };
}

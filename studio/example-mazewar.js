// example-mazewar.js — MAZE WAR (1974), rebuilt in our studio.
// The FIRST first-person shooter, born on Imlac PDS-1 terminals at NASA Ames:
// you are IN the maze, seeing down a wireframe corridor, and the things
// hunting you are giant eyeballs. It was also the first networked multiplayer
// game — machines wired together so the eyeball was another human. Here the
// eyeballs are ROBOT players (MIT's Maze War grew those too); true
// player-vs-player needs realtime plumbing the platform doesn't have yet.
//
// This machine taught the engine a permanent new trick: the LINE object —
// a vector segment (from x/y, along its angle, `size` long). The entire
// first-person view is prebuilt line objects that the script switches on
// and off as you move: one-point perspective, exactly the original's trick.
//
//   A/D turn in place · W forward · S backward · SPACE fire down the corridor
//   The map in the corner sees everything (players argued THAT was cheating
//   in 1974 too). An eyeball's pupil turns RED when it's aiming at you — run.
//   Kills go on the HIGH SCORES table. The coin buys ~60 seconds.

const T = 3600;
const MW = 11, MH = 9;
export const MAZE_ROWS = [
  "###########",
  "#.....#...#",
  "#.###.#.#.#",
  "#.#...#.#.#",
  "#.#.#.#.#.#",
  "#.#.#...#.#",
  "#.#.###.#.#",
  "#...#.....#",
  "###########"
];

// the first-person view: one-point perspective frames, precomputed
const VX = 240, VY = 166;
const FR = [[200, 140], [122, 86], [74, 52], [45, 32], [27, 19], [16, 11]];
const EYER = [0, 46, 28, 17, 10, 6];   // eyeball ring size per depth

// the overhead map (the corner spy)
const MX = 380, MY = 262, MC = 8;

const SPAWN = { x: 1, y: 1, f: 1 };
const DRONE1 = { x: 9, y: 1, f: 3 };
const DRONE2 = { x: 1, y: 7, f: 0 };
const RESPAWNS = [[9, 1], [1, 7], [9, 7], [5, 3]];

const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a";
const WALL = "#dfe9ee", MAPW = "#2e5c3a", PUPIL = "#0b1f14", RED = "#ff5a55";

// frame corners
const fx = (k) => [VX - FR[k][0], VX + FR[k][0], VY - FR[k][1], VY + FR[k][1]]; // [L,R,T,B]

// every possible wall segment of the view, as prebuilt lines
function viewLines() {
  const L = [];
  const seg = (name, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    L.push({
      name, x: x1, y: y1,
      size: Math.round(Math.hypot(dx, dy) * 100) / 100,
      angle: Math.round(Math.atan2(dy, dx) * 180 / Math.PI * 100) / 100
    });
  };
  for (let d = 0; d < 5; d++) {
    const [L0, R0, T0, B0] = fx(d), [L1, R1, T1, B1] = fx(d + 1);
    // side WALL: perspective diagonals
    seg(`v${d}la`, L0, T0, L1, T1);
    seg(`v${d}lb`, L0, B0, L1, B1);
    seg(`v${d}ra`, R0, T0, R1, T1);
    seg(`v${d}rb`, R0, B0, R1, B1);
    // side OPEN: the corridor mouth — far post + ceiling + floor
    seg(`v${d}lc`, L1, T1, L1, B1);
    seg(`v${d}ld`, L0, T1, L1, T1);
    seg(`v${d}le`, L0, B1, L1, B1);
    seg(`v${d}rc`, R1, T1, R1, B1);
    seg(`v${d}rd`, R0, T1, R1, T1);
    seg(`v${d}re`, R0, B1, R1, B1);
  }
  for (let k = 1; k <= 5; k++) {
    const [Lk, Rk, Tk, Bk] = fx(k);
    seg(`fw${k}a`, Lk, Tk, Rk, Tk);
    seg(`fw${k}b`, Lk, Bk, Rk, Bk);
    seg(`fw${k}c`, Lk, Tk, Lk, Bk);
    seg(`fw${k}d`, Rk, Tk, Rk, Bk);
  }
  return L;
}
const VIEW_NAMES = viewLines().map(l => l.name);

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);
  const cell = (xe, ye) => `maze[(${ye}) * ${MW} + (${xe})]`;

  // ---- shared emitters ----

  // a random maze walk for X/Y/F, on a countdown timer
  const walk = (X, Y, F, TIMER, period, whim, pad) => {
    push(`${pad}set ${TIMER} to ${TIMER} - 1`);
    push(`${pad}if ${TIMER} <= 0 then`);
    push(`${pad}  set ${TIMER} to ${period}`);
    push(`${pad}  if ${cell(`${X} + dxs[${F}]`, `${Y} + dys[${F}]`)} == 1 or rand(0, 1) < ${whim} then`);
    push(`${pad}    if rand(0, 1) < 0.5 then`);
    push(`${pad}      set ${F} to (${F} + 1) % 4`);
    push(`${pad}    else`);
    push(`${pad}      set ${F} to (${F} + 3) % 4`);
    push(`${pad}    end`);
    push(`${pad}  else`);
    push(`${pad}    set ${X} to ${X} + dxs[${F}]`);
    push(`${pad}    set ${Y} to ${Y} + dys[${F}]`);
    push(`${pad}  end`);
    push(`${pad}end`);
  };

  // one whole robot eyeball: face the player's row/column, stalk, aim, fire
  const drone = (n, pad) => {
    const X = `e${n}x`, Y = `e${n}y`, F = `e${n}f`, AIM = `e${n}aim`;
    // crossing your row or column snaps its gaze toward you
    push(`${pad}if ${X} == px and ${Y} != py then`);
    push(`${pad}  if py > ${Y} then`);
    push(`${pad}    set ${F} to 2`);
    push(`${pad}  else`);
    push(`${pad}    set ${F} to 0`);
    push(`${pad}  end`);
    push(`${pad}end`);
    push(`${pad}if ${Y} == py and ${X} != px then`);
    push(`${pad}  if px > ${X} then`);
    push(`${pad}    set ${F} to 1`);
    push(`${pad}  else`);
    push(`${pad}    set ${F} to 3`);
    push(`${pad}  end`);
    push(`${pad}end`);
    walk(X, Y, F, `e${n}t`, 26, 0.25, pad);
    // line of sight down its corridor
    push(`${pad}set see to 0`);
    push(`${pad}set sx to ${X}`);
    push(`${pad}set sy to ${Y}`);
    push(`${pad}set sdone to 0`);
    for (let i = 0; i < 5; i++) {
      push(`${pad}if sdone == 0 and see == 0 then`);
      push(`${pad}  if ${cell(`sx + dxs[${F}]`, `sy + dys[${F}]`)} == 1 then`);
      push(`${pad}    set sdone to 1`);
      push(`${pad}  else`);
      push(`${pad}    set sx to sx + dxs[${F}]`);
      push(`${pad}    set sy to sy + dys[${F}]`);
      push(`${pad}    if sx == px and sy == py then`);
      push(`${pad}      set see to 1`);
      push(`${pad}    end`);
      push(`${pad}  end`);
      push(`${pad}end`);
    }
    push(`${pad}if see == 1 then`);
    push(`${pad}  change ${AIM} by 1`);
    push(`${pad}  if game == 0 and ${AIM} % 12 == 0 then`);
    push(`${pad}    beep 500 for 0.03`);   // the it-sees-you tick
    push(`${pad}  end`);
    push(`${pad}  if ${AIM} >= 45 then`);
    push(`${pad}    explode self`);
    push(`${pad}    beep 70 for 0.3`);
    push(`${pad}    set px to ${SPAWN.x}`);
    push(`${pad}    set py to ${SPAWN.y}`);
    push(`${pad}    set face to ${SPAWN.f}`);
    push(`${pad}    set stall to 25`);
    push(`${pad}    set e1aim to 0`);
    push(`${pad}    set e2aim to 0`);
    push(`${pad}  end`);
    push(`${pad}else`);
    push(`${pad}  set ${AIM} to 0`);
    push(`${pad}end`);
  };

  // ---- when start ----
  push("when start");
  push("set game to 9");
  push("set endplay to 0");
  push("set score to 0");
  push("set stall to 0");
  push(`set px to ${SPAWN.x}`);
  push(`set py to ${SPAWN.y}`);
  push(`set face to ${SPAWN.f}`);
  push("set atk to 10");
  // the maze (only walls need setting — unset cells read 0)
  MAZE_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === "#") push(`set maze[${r * MW + c}] to 1`);
    });
  });
  // the compass: facing 0=N 1=E 2=S 3=W
  push("set dxs[0] to 0");
  push("set dys[0] to -1");
  push("set dxs[1] to 1");
  push("set dys[1] to 0");
  push("set dxs[2] to 0");
  push("set dys[2] to 1");
  push("set dxs[3] to -1");
  push("set dys[3] to 0");
  RESPAWNS.forEach(([x, y], i) => {
    push(`set rxs[${i + 1}] to ${x}`);
    push(`set rys[${i + 1}] to ${y}`);
  });
  push("set rk to 1");
  push(`set e1x to ${DRONE1.x}`);
  push(`set e1y to ${DRONE1.y}`);
  push(`set e1f to ${DRONE1.f}`);
  push("set e1t to 20");
  push("set e1aim to 0");
  push(`set e2x to ${DRONE2.x}`);
  push(`set e2y to ${DRONE2.y}`);
  push(`set e2f to ${DRONE2.f}`);
  push("set e2t to 33");
  push("set e2aim to 0");
  push("end");

  // ---- when tick ----
  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set startbtn.visible to (game == 9)");
  push("set killtx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set comptx.visible to (game != 9)");
  push("set statusline.visible to (game == 2)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PRESS START ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN ◎"');
  push("end");
  push('set killtx.text to "KILLS " + score');
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60))');
  push("if face == 0 then");
  push('  set comptx.text to "FACING N"');
  push("end");
  push("if face == 1 then");
  push('  set comptx.text to "FACING E"');
  push("end");
  push("if face == 2 then");
  push('  set comptx.text to "FACING S"');
  push("end");
  push("if face == 3 then");
  push('  set comptx.text to "FACING W"');
  push("end");

  push("if game != 2 then");
  push("  if stall > 0 then");
  push("    set stall to stall - 1");
  push("  end");
  // the attract reel pilots YOU through the maze
  push("  if game == 9 and stall == 0 then");
  walk("px", "py", "face", "atk", 13, 0.2, "    ");
  push("  end");
  // the robot eyeballs
  drone(1, "  ");
  drone(2, "  ");

  // ---- THE FIRST-PERSON VIEW ----
  // everything off, then switch on what this position and facing can see
  for (const n of VIEW_NAMES) push(`  set ${n}.visible to 0`);
  push("  set eye1r.visible to 0");
  push("  set eye1p.visible to 0");
  push("  set eye2r.visible to 0");
  push("  set eye2p.visible to 0");
  push("  set cx to px");
  push("  set cy to py");
  push("  set blocked to 0");
  for (let d = 0; d < 5; d++) {
    push("  if blocked == 0 then");
    push(`    if ${cell("cx + dxs[(face + 3) % 4]", "cy + dys[(face + 3) % 4]")} == 1 then`);
    push(`      set v${d}la.visible to 1`);
    push(`      set v${d}lb.visible to 1`);
    push("    else");
    push(`      set v${d}lc.visible to 1`);
    push(`      set v${d}ld.visible to 1`);
    push(`      set v${d}le.visible to 1`);
    push("    end");
    push(`    if ${cell("cx + dxs[(face + 1) % 4]", "cy + dys[(face + 1) % 4]")} == 1 then`);
    push(`      set v${d}ra.visible to 1`);
    push(`      set v${d}rb.visible to 1`);
    push("    else");
    push(`      set v${d}rc.visible to 1`);
    push(`      set v${d}rd.visible to 1`);
    push(`      set v${d}re.visible to 1`);
    push("    end");
    push(`    if ${cell("cx + dxs[face]", "cy + dys[face]")} == 1 then`);
    push(`      set fw${d + 1}a.visible to 1`);
    push(`      set fw${d + 1}b.visible to 1`);
    push(`      set fw${d + 1}c.visible to 1`);
    push(`      set fw${d + 1}d.visible to 1`);
    push("      set blocked to 1");
    push("    else");
    push("      set cx to cx + dxs[face]");
    push("      set cy to cy + dys[face]");
    push("      if e1x == cx and e1y == cy then");
    push(`        set eye1r.visible to 1`);
    push(`        set eye1r.size to ${EYER[d + 1]}`);
    push(`        set eye1p.visible to 1`);
    push(`        set eye1p.size to ${Math.round(EYER[d + 1] * 0.9)}`);
    push("      end");
    push("      if e2x == cx and e2y == cy then");
    push(`        set eye2r.visible to 1`);
    push(`        set eye2r.size to ${EYER[d + 1]}`);
    push(`        set eye2p.visible to 1`);
    push(`        set eye2p.size to ${Math.round(EYER[d + 1] * 0.9)}`);
    push("      end");
    push("    end");
    push("  end");
  }
  push("  if blocked == 0 then");
  push("    set fw5a.visible to 1");
  push("    set fw5b.visible to 1");
  push("    set fw5c.visible to 1");
  push("    set fw5d.visible to 1");
  push("  end");

  // the pupil goes red when it's aiming at you
  push("  if e1aim > 0 then");
  push(`    set eye1p.color to "${RED}"`);
  push("  else");
  push(`    set eye1p.color to "${PUPIL}"`);
  push("  end");
  push("  if e2aim > 0 then");
  push(`    set eye2p.color to "${RED}"`);
  push("  else");
  push(`    set eye2p.color to "${PUPIL}"`);
  push("  end");

  // the corner map sees all
  push(`  set self.x to ${MX} + px * ${MC}`);
  push(`  set self.y to ${MY} + py * ${MC}`);
  push("  set self.angle to face * 90 - 90");
  push(`  set foe1.x to ${MX} + e1x * ${MC}`);
  push(`  set foe1.y to ${MY} + e1y * ${MC}`);
  push(`  set foe2.x to ${MX} + e2x * ${MC}`);
  push(`  set foe2.y to ${MY} + e2y * ${MC}`);
  push("end");

  // the quarter runs out
  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 150 for 0.5");
  push('    set statusline.text to "KILLS " + score + " · CLICK"');
  push("  end");
  push("end");
  push("end");

  // ---- controls ----
  push('when key "a"');
  push("if game == 0 and stall == 0 then");
  push("  set face to (face + 3) % 4");
  push("end");
  push("end");
  push('when key "d"');
  push("if game == 0 and stall == 0 then");
  push("  set face to (face + 1) % 4");
  push("end");
  push("end");

  const step = (sign) => {
    push("if game == 0 and stall == 0 then");
    push(`  set nx to px ${sign} dxs[face]`);
    push(`  set ny to py ${sign} dys[face]`);
    push(`  if ${cell("nx", "ny")} == 1 then`);
    push("    beep 60 for 0.05");
    push("  else");
    push("    set px to nx");
    push("    set py to ny");
    push("    beep 90 for 0.02");
    push("  end");
    push("end");
    push("end");
  };
  push('when key "w"');
  step("+");
  push('when key "s"');
  step("-");

  // fire down the corridor — hitscan, walls stop it
  push('when key "Space"');
  push("if game == 0 and stall == 0 then");
  push("  beep 260 for 0.06");
  push("  set hx to px");
  push("  set hy to py");
  push("  set hdone to 0");
  for (let i = 0; i < 5; i++) {
    push("  if hdone == 0 then");
    push(`    if ${cell("hx + dxs[face]", "hy + dys[face]")} == 1 then`);
    push("      set hdone to 1");
    push("    else");
    push("      set hx to hx + dxs[face]");
    push("      set hy to hy + dys[face]");
    push("      if e1x == hx and e1y == hy then");
    push("        explode foe1");
    push("        beep 620 for 0.1");
    push("        change score by 1");
    push("        set e1x to rxs[rk]");
    push("        set e1y to rys[rk]");
    push("        set e1aim to 0");
    push("        set rk to rk % 4 + 1");
    push("        set hdone to 1");
    push("      end");
    push("      if hdone == 0 and e2x == hx and e2y == hy then");
    push("        explode foe2");
    push("        beep 620 for 0.1");
    push("        change score by 1");
    push("        set e2x to rxs[rk]");
    push("        set e2y to rys[rk]");
    push("        set e2aim to 0");
    push("        set rk to rk % 4 + 1");
    push("        set hdone to 1");
    push("      end");
    push("    end");
    push("  end");
  }
  push("end");
  push("end");

  // ---- the coin door ----
  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 240) < 60 and abs(mousey() - 210) < 16 then");
  push("    set game to 0");
  push("    set endplay to 0");
  push("    set score to 0");
  push("    set stall to 0");
  push(`    set timeleft to ${T}`);
  push(`    set px to ${SPAWN.x}`);
  push(`    set py to ${SPAWN.y}`);
  push(`    set face to ${SPAWN.f}`);
  push(`    set e1x to ${DRONE1.x}`);
  push(`    set e1y to ${DRONE1.y}`);
  push(`    set e1f to ${DRONE1.f}`);
  push("    set e1aim to 0");
  push(`    set e2x to ${DRONE2.x}`);
  push(`    set e2y to ${DRONE2.y}`);
  push(`    set e2f to ${DRONE2.f}`);
  push("    set e2aim to 0");
  push("    set rk to 1");
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push(`    set px to ${SPAWN.x}`);
  push(`    set py to ${SPAWN.y}`);
  push(`    set face to ${SPAWN.f}`);
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildMazewarExample() {
  const objects = [];

  // THE VIEW — every possible wireframe segment, prebuilt and switched by script
  viewLines().forEach((l, i) => {
    objects.push({
      id: "mz_v" + i, name: l.name, type: "line",
      x: l.x, y: l.y, size: l.size, angle: l.angle,
      color: WALL, glow: 4, visible: 0, text: "", script: []
    });
  });

  // the eyeballs (drawn over the corridor)
  for (const n of [1, 2]) {
    objects.push({
      id: "mz_e" + n + "r", name: "eye" + n + "r", type: "ring",
      x: VX, y: VY, size: 30, color: WHITE, glow: 10, visible: 0, text: "", script: []
    });
    objects.push({
      id: "mz_e" + n + "p", name: "eye" + n + "p", type: "dot",
      x: VX, y: VY, size: 24, color: PUPIL, glow: 4, visible: 0, text: "", script: []
    });
  }

  // the corner map: walls are static dots; you and the eyeballs move on it
  MAZE_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== "#") return;
      objects.push({
        id: `mz_m${r}_${c}`, name: `mw${r}_${c}`, type: "dot",
        x: MX + c * MC, y: MY + r * MC, size: 3, color: MAPW, glow: 1, visible: 1, text: "", script: []
      });
    });
  });
  objects.push({
    id: "mz_f1", name: "foe1", type: "dot",
    x: MX + DRONE1.x * MC, y: MY + DRONE1.y * MC, size: 5, color: AMBER, glow: 6, visible: 1, text: "", script: []
  });
  objects.push({
    id: "mz_f2", name: "foe2", type: "dot",
    x: MX + DRONE2.x * MC, y: MY + DRONE2.y * MC, size: 5, color: AMBER, glow: 6, visible: 1, text: "", script: []
  });
  // you, on the map — the brain rides here
  objects.push({
    id: "mz_me", name: "me", type: "tri",
    x: MX + SPAWN.x * MC, y: MY + SPAWN.y * MC, size: 6, angle: 0,
    color: GREEN, glow: 8, visible: 1, text: "",
    script: [{ event: "code", source: brainCode() }]
  });

  // HUD
  objects.push({
    id: "mz_k", name: "killtx", type: "text",
    x: 100, y: 22, size: 12, color: GREEN, glow: 8, visible: 0, text: "KILLS 0", script: []
  });
  objects.push({
    id: "mz_t", name: "timetx", type: "text",
    x: 240, y: 22, size: 12, color: WHITE, glow: 8, visible: 0, text: "TIME 60", script: []
  });
  objects.push({
    id: "mz_c", name: "comptx", type: "text",
    x: 386, y: 22, size: 12, color: AMBER, glow: 8, visible: 0, text: "FACING E", script: []
  });

  // the marquee
  objects.push({
    id: "mz_big", name: "bigtitle", type: "text",
    x: 240, y: 120, size: 24, color: WHITE, glow: 16, visible: 1, text: "MAZE WAR", script: []
  });
  objects.push({
    id: "mz_coin", name: "coinline", type: "text",
    x: 240, y: 146, size: 10, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "mz_start", name: "startbtn", type: "text",
    x: 240, y: 210, size: 14, color: GREEN, glow: 12, visible: 1, text: "[ START ]", script: []
  });
  objects.push({
    id: "mz_status", name: "statusline", type: "text",
    x: 240, y: 146, size: 11, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });

  objects.push({
    id: "mz_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "1974 · A/D TURN · W/S MOVE · SPACE FIRE · RED PUPIL = IT'S AIMING AT YOU",
    script: []
  });

  return { title: "Maze War (1974)", objects };
}

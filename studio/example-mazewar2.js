// example-mazewar2.js — MAZE WAR ARENA (1974): the MULTIPLAYER one.
// The original Maze War's whole point was other humans — Imlacs wired
// together so every eyeball in the corridor was a real person. This is that,
// on the platform's multi-seat floor: publish it with PLAYERS = 4 and up to
// four people sit at the same cabinet, each in their own browser. No robots
// — every eye is human.
//
// IT PLAYS IN ROUNDS, like a real deathmatch:
//   · a match needs at least TWO players — alone, you wait in the lobby
//   · one life per round: get shot and you're OUT, watching, until the
//     round ends (no spawn camping — there is no respawn to camp)
//   · last eye standing wins the round; a short intermission, then the next
//     round starts everyone fresh from their corners
//   · join mid-round and you spectate until the next round begins — you're
//     never dropped into a dying match
// The round state has no referee: every browser follows the same rules and
// adopts the highest round number it can see, so the seats stay in step.
//
// The net contract it speaks (see the Guide):
//   net1/net2 cell · net3 facing · net4 kills · net5 ALIVE · net6 ROUND
//   fon[s], f1..f6[s], nettgt+netev → their `hits`, pcount, netslot
//
//   A/D turn · W/S move · SPACE fire · dead players can still look around.
//   Kills go on the HIGH SCORES table. The coin buys ~90 seconds.

const T = 5400;                                    // ~90 seconds per coin
const MW = 11;
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

const VX = 240, VY = 166;
const FR = [[200, 140], [122, 86], [74, 52], [45, 32], [27, 19], [16, 11]];
const EYER = [0, 46, 28, 17, 10, 6];
const MX = 380, MY = 262, MC = 8;

const LOBBY_TICKS = 180;    // 3s "match found" countdown
const INTER_TICKS = 240;    // 4s between rounds

// four corners, facing into the maze — seat number picks yours
const SPAWNS = [[1, 1, 1], [9, 7, 3], [9, 1, 2], [1, 7, 0]];
const EYECOLS = ["#ff9d4a", "#7dff9e", "#8fd0ff"];   // opponent 1 / 2 / 3

const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a";
const WALL = "#dfe9ee", PUPIL = "#0b1f14", MAPW = "#2e5c3a";

const fx = (k) => [VX - FR[k][0], VX + FR[k][0], VY - FR[k][1], VY + FR[k][1]];

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
    seg(`v${d}la`, L0, T0, L1, T1);
    seg(`v${d}lb`, L0, B0, L1, B1);
    seg(`v${d}ra`, R0, T0, R1, T1);
    seg(`v${d}rb`, R0, B0, R1, B1);
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
const EYES = ["A", "B", "C"];
// a live opponent IN MY ROUND — the only kind that renders or takes hits
const foeLive = (oi) =>
  `fon[os[${oi}]] == 1 and f5[os[${oi}]] == 1 and f6[os[${oi}]] == round`;

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);
  const cell = (xe, ye) => `maze[(${ye}) * ${MW} + (${xe})]`;

  const respawn = (pad) => {
    push(`${pad}set px to spx`);
    push(`${pad}set py to spy`);
    push(`${pad}set face to spf`);
  };

  push("when start");
  push("set game to 9");
  push("set endplay to 0");
  push("set score to 0");
  push("set wins to 0");
  push("set round to 0");
  push("set alive to 0");
  push("set inter to 0");
  push("set waitjoin to 0");
  push("set seenr to 0");
  push("set lasthits to 0");
  push("set rage to 0");
  push("set seenfoe to 0");
  push("set atk to 12");
  MAZE_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === "#") push(`set maze[${r * MW + c}] to 1`);
    });
  });
  push("set dxs[0] to 0");
  push("set dys[0] to -1");
  push("set dxs[1] to 1");
  push("set dys[1] to 0");
  push("set dxs[2] to 0");
  push("set dys[2] to 1");
  push("set dxs[3] to -1");
  push("set dys[3] to 0");
  SPAWNS.forEach(([x, y, f], i) => {
    push(`set spxs[${i + 1}] to ${x}`);
    push(`set spys[${i + 1}] to ${y}`);
    push(`set spfs[${i + 1}] to ${f}`);
  });
  push("set px to 1");
  push("set py to 1");
  push("set face to 1");
  push("end");

  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set startbtn.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
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
  push('set killtx.text to "KILLS " + score + " · WINS " + wins');
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60)) + " · " + max(0, pcount - 1) + " HUNTERS"');
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
  // my seat number decides my corner
  push("  set ns to max(1, netslot)");
  push("  set spx to spxs[ns]");
  push("  set spy to spys[ns]");
  push("  set spf to spfs[ns]");
  // the other three seats, in a little list: os[1..3]
  push("  set k to 0");
  for (let sSeat = 1; sSeat <= 4; sSeat++) {
    push(`  if ns != ${sSeat} then`);
    push("    set k to k + 1");
    push(`    set os[k] to ${sSeat}`);
    push("  end");
  }
  // what the room looks like: the highest round anyone is in, and how many
  // opponents are still alive in MY round
  push("  set maxr to 0");
  push("  set aliveo to 0");
  for (let oi = 1; oi <= 3; oi++) {
    push(`  if fon[os[${oi}]] == 1 then`);
    push(`    if f6[os[${oi}]] > maxr then`);
    push(`      set maxr to f6[os[${oi}]]`);
    push("    end");
    push(`    if ${foeLive(oi)} then`);
    push("      change aliveo by 1");
    push("    end");
    push("  end");
  }

  // ---- THE ROUNDS (no referee — every browser follows the same rules) ----
  push("  if game == 0 then");
  // dead or waiting players never bank stale hits
  push("    if alive == 0 then");
  push("      set lasthits to hits");
  push("    end");
  // joined mid-match? spectate until a FRESH round begins
  push("    if waitjoin == 1 then");
  push("      set round to maxr");
  push("      set alive to 0");
  push('      set roundtx.text to "ROUND " + maxr + " IN PROGRESS — YOU JOIN THE NEXT ONE"');
  push("      if maxr == 0 then");
  push("        set waitjoin to 0");
  push("        set round to 0");
  push("      end");
  push("      if maxr > seenr then");
  push("        set waitjoin to 0");
  push("        set round to maxr");
  push("        set alive to 1");
  push("        set lasthits to hits");
  push("        set rage to 0");
  push("        set seenfoe to 0");
  respawn("        ");
  push('        say "ROUND " + round for 2');
  push("        beep 440 for 0.12");
  push("      end");
  push("    else");
  // the world moved on without me → adopt the newer round, everyone starts fresh
  push("      if maxr > round then");
  push("        set round to maxr");
  push("        set alive to 1");
  push("        set inter to 0");
  push("        set lasthits to hits");
  push("        set rage to 0");
  push("        set seenfoe to 0");
  respawn("        ");
  push('        say "ROUND " + round for 2');
  push("        beep 440 for 0.12");
  push("      end");
  push("      if round == 0 then");
  // THE LOBBY: a match needs at least two humans
  push("        set alive to 0");
  push("        if pcount >= 2 then");
  push("          change inter by 1");
  push('          set roundtx.text to "MATCH FOUND — ROUND 1 IN " + max(1, floor((' + String(LOBBY_TICKS) + ' - inter) / 60) + 1)');
  push(`          if inter >= ${LOBBY_TICKS} then`);
  push("            set round to 1");
  push("            set alive to 1");
  push("            set inter to 0");
  push("            set lasthits to hits");
  push("            set rage to 0");
  push("            set seenfoe to 0");
  respawn("            ");
  push('            say "ROUND 1 — LAST EYE STANDING" for 2');
  push("            beep 440 for 0.12");
  push("          end");
  push("        else");
  push("          set inter to 0");
  push('          set roundtx.text to "WAITING FOR HUNTERS — A MATCH NEEDS 2+"');
  push("        end");
  push("      else");
  // IN A MATCH
  push("        if pcount < 2 then");
  // everyone else left — back to the lobby
  push("          set round to 0");
  push("          set alive to 0");
  push("          set inter to 0");
  push("        else");
  // getting shot = eliminated for the round (no respawn to camp)
  push("          if alive == 1 and hits != lasthits then");
  push("            set lasthits to hits");
  push("            explode self");
  push("            beep 70 for 0.3");
  push("            set alive to 0");
  push('            say "ELIMINATED" for 2');
  push("          end");
  push("          if inter == 0 then");
  push("            change rage by 1");
  push("            if aliveo >= 1 then");
  push("              set seenfoe to 1");
  push("            end");
  push("            if alive == 0 then");
  push('              set roundtx.text to "ELIMINATED — WATCHING ROUND " + round');
  push("            end");
  // last eye standing ends the round — but never before the round has truly
  // begun (opponents' round packets take a beat to arrive)
  push("            if (seenfoe == 1 or rage >= 300) and alive + aliveo <= 1 then");
  push("              set inter to 1");
  push("              if alive == 1 then");
  push("                change wins by 1");
  push('                say "YOU WIN ROUND " + round for 3');
  push("                beep 700 for 0.2");
  push("              end");
  push("            end");
  push("          else");
  push("            change inter by 1");
  push('            set roundtx.text to "ROUND ' + '" + round + " OVER — NEXT IN " + max(1, floor((' + String(INTER_TICKS) + ' - inter) / 60) + 1)');
  push(`            if inter >= ${INTER_TICKS} then`);
  push("              if maxr > round then");
  push("                set round to maxr");
  push("              else");
  push("                set round to round + 1");
  push("              end");
  push("              set alive to 1");
  push("              set inter to 0");
  push("              set lasthits to hits");
  push("              set rage to 0");
  push("              set seenfoe to 0");
  respawn("              ");
  push('              say "ROUND " + round for 2');
  push("              beep 440 for 0.12");
  push("            end");
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  // the round banner shows whenever there's something to say
  push("  set roundtx.visible to (game == 0 and (alive == 0 or inter > 0))");

  // the attract reel pilots the camera through the maze
  push("  if game == 9 then");
  push("    set atk to atk - 1");
  push("    if atk <= 0 then");
  push("      set atk to 13");
  push(`      if ${cell("px + dxs[face]", "py + dys[face]")} == 1 or rand(0, 1) < 0.2 then`);
  push("        if rand(0, 1) < 0.5 then");
  push("          set face to (face + 1) % 4");
  push("        else");
  push("          set face to (face + 3) % 4");
  push("        end");
  push("      else");
  push("        set px to px + dxs[face]");
  push("        set py to py + dys[face]");
  push("      end");
  push("    end");
  push("  end");

  // ---- THE FIRST-PERSON VIEW ----
  for (const n of VIEW_NAMES) push(`  set ${n}.visible to 0`);
  for (const e of EYES) {
    push(`  set eye${e}r.visible to 0`);
    push(`  set eye${e}p.visible to 0`);
  }
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
    // every ALIVE human in my round appears as their eyeball
    EYES.forEach((e, oi) => {
      push(`      if ${foeLive(oi + 1)} and f1[os[${oi + 1}]] == cx and f2[os[${oi + 1}]] == cy then`);
      push(`        set eye${e}r.visible to 1`);
      push(`        set eye${e}r.size to ${EYER[d + 1]}`);
      push(`        set eye${e}p.visible to 1`);
      push(`        set eye${e}p.size to ${Math.round(EYER[d + 1] * 0.9)}`);
      push("      end");
    });
    push("    end");
    push("  end");
  }
  push("  if blocked == 0 then");
  push("    set fw5a.visible to 1");
  push("    set fw5b.visible to 1");
  push("    set fw5c.visible to 1");
  push("    set fw5d.visible to 1");
  push("  end");

  // the corner map sees every living hunter in my round
  push(`  set self.x to ${MX} + px * ${MC}`);
  push(`  set self.y to ${MY} + py * ${MC}`);
  push("  set self.angle to face * 90 - 90");
  EYES.forEach((e, oi) => {
    push(`  if ${foeLive(oi + 1)} then`);
    push(`    set foe${e}.visible to 1`);
    push("  else");
    push(`    set foe${e}.visible to 0`);
    push("  end");
    push(`  set foe${e}.x to ${MX} + f1[os[${oi + 1}]] * ${MC}`);
    push(`  set foe${e}.y to ${MY} + f2[os[${oi + 1}]] * ${MC}`);
  });

  // the net contract: what everyone else sees of me
  push("  set net1 to px");
  push("  set net2 to py");
  push("  set net3 to face");
  push("  set net4 to score");
  push("  set net5 to alive");
  push("  set net6 to round");
  push("end");

  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 150 for 0.5");
  push('    set statusline.text to "KILLS " + score + " · WINS " + wins + " · CLICK"');
  push("    set roundtx.visible to 0");
  push("  end");
  push("end");
  push("end");

  // dead players may still look around; only the living may walk and shoot
  push('when key "a"');
  push("if game == 0 then");
  push("  set face to (face + 3) % 4");
  push("end");
  push("end");
  push('when key "d"');
  push("if game == 0 then");
  push("  set face to (face + 1) % 4");
  push("end");
  push("end");

  const step = (sign) => {
    push("if game == 0 and alive == 1 then");
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

  // fire down the corridor — first living human in the line takes it
  push('when key "Space"');
  push("if game == 0 and alive == 1 then");
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
    EYES.forEach((e, oi) => {
      push(`      if hdone == 0 and ${foeLive(oi + 1)} and f1[os[${oi + 1}]] == hx and f2[os[${oi + 1}]] == hy then`);
      push(`        explode foe${e}`);
      push("        beep 620 for 0.1");
      push("        change score by 1");
      push(`        set nettgt to os[${oi + 1}]`);   // tell THAT seat they're hit
      push("        change netev by 1");
      push("        set hdone to 1");
      push("      end");
    });
    push("    end");
    push("  end");
  }
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 240) < 60 and abs(mousey() - 210) < 16 then");
  push("    set game to 0");
  push("    set endplay to 0");
  push("    set score to 0");
  push("    set wins to 0");
  push("    set round to 0");
  push("    set alive to 0");
  push("    set inter to 0");
  push(`    set timeleft to ${T}`);
  push("    set lasthits to hits");
  // joining while a match runs? you're in the NEXT round, not this one
  push("    set seenr to maxr");
  push("    if maxr >= 1 then");
  push("      set waitjoin to 1");
  push("    else");
  push("      set waitjoin to 0");
  push("    end");
  respawn("    ");
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  respawn("    ");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildMazewar2Example() {
  const objects = [];

  viewLines().forEach((l, i) => {
    objects.push({
      id: "ma_v" + i, name: l.name, type: "line",
      x: l.x, y: l.y, size: l.size, angle: l.angle,
      color: WALL, glow: 4, visible: 0, text: "", script: []
    });
  });

  // three human opponents, each their own color
  EYES.forEach((e, i) => {
    objects.push({
      id: "ma_e" + e + "r", name: "eye" + e + "r", type: "ring",
      x: VX, y: VY, size: 30, color: EYECOLS[i], glow: 10, visible: 0, text: "", script: []
    });
    objects.push({
      id: "ma_e" + e + "p", name: "eye" + e + "p", type: "dot",
      x: VX, y: VY, size: 24, color: PUPIL, glow: 4, visible: 0, text: "", script: []
    });
  });

  MAZE_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== "#") return;
      objects.push({
        id: `ma_m${r}_${c}`, name: `mw${r}_${c}`, type: "dot",
        x: MX + c * MC, y: MY + r * MC, size: 3, color: MAPW, glow: 1, visible: 1, text: "", script: []
      });
    });
  });
  EYES.forEach((e, i) => {
    objects.push({
      id: "ma_f" + e, name: "foe" + e, type: "dot",
      x: -20, y: -20, size: 5, color: EYECOLS[i], glow: 6, visible: 0, text: "", script: []
    });
  });
  objects.push({
    id: "ma_me", name: "me", type: "tri",
    x: MX + 1 * MC, y: MY + 1 * MC, size: 6, angle: 0,
    color: GREEN, glow: 8, visible: 1, text: "",
    script: [{ event: "code", source: brainCode() }]
  });

  objects.push({
    id: "ma_k", name: "killtx", type: "text",
    x: 100, y: 22, size: 12, color: GREEN, glow: 8, visible: 0, text: "KILLS 0 · WINS 0", script: []
  });
  objects.push({
    id: "ma_t", name: "timetx", type: "text",
    x: 240, y: 22, size: 12, color: WHITE, glow: 8, visible: 0, text: "TIME 90", script: []
  });
  objects.push({
    id: "ma_c", name: "comptx", type: "text",
    x: 386, y: 22, size: 12, color: AMBER, glow: 8, visible: 0, text: "FACING E", script: []
  });
  // the round banner: lobby, countdowns, eliminated, intermission
  objects.push({
    id: "ma_r", name: "roundtx", type: "text",
    x: 240, y: 320, size: 11, color: AMBER, glow: 8, visible: 0,
    text: "WAITING FOR HUNTERS — A MATCH NEEDS 2+", script: []
  });

  objects.push({
    id: "ma_big", name: "bigtitle", type: "text",
    x: 240, y: 112, size: 22, color: WHITE, glow: 16, visible: 1, text: "MAZE WAR ARENA", script: []
  });
  objects.push({
    id: "ma_coin", name: "coinline", type: "text",
    x: 240, y: 140, size: 10, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "ma_sub", name: "subline", type: "text",
    x: 240, y: 162, size: 10, color: AMBER, glow: 8, visible: 1,
    text: "2–4 HUMANS · ROUNDS · LAST EYE STANDING", script: []
  });
  objects.push({
    id: "ma_start", name: "startbtn", type: "text",
    x: 240, y: 210, size: 14, color: GREEN, glow: 12, visible: 1, text: "[ START ]", script: []
  });
  objects.push({
    id: "ma_status", name: "statusline", type: "text",
    x: 240, y: 140, size: 11, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "ma_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "1974 · A/D TURN · W/S MOVE · SPACE FIRE · ONE LIFE PER ROUND",
    script: []
  });

  return { title: "Maze War Arena (1974)", objects };
}

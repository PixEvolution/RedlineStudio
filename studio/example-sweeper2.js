// example-sweeper2.js — SWEEPER II (1981 style): a MOD of our own Sweeper —
// because that is exactly how the real 1981 machine happened. It began as an
// unauthorized speed-up kit for the 1980 original, built by outsiders, that
// grew new mazes and new behavior — and became one of the best-selling
// arcade games in the United States. Its characters are still protected,
// so our tribute mods OUR OWN robot instead, and keeps what the mod added:
//
//   · FOUR mazes, rotating every level — no single route to memorize
//   · the bonus part now WANDERS the corridors like prey instead of
//     sitting still — catch it on the move for 300+
//   · the hunters took the same patch the originals did: one turn in
//     five is RANDOM, so no pattern is ever safe twice
//   · everything is faster, and the power runs shorter
//   · same four personalities, same breathing, same buffered turns
//
//   WASD / arrows / stick to steer · turns are BUFFERED: ask early

const CS = 26, X0 = 24, Y0 = 67;
const SHARED = {
  0: "#############", 5: "#.#.......#.#", 6: "#.#.##=##.#.#",
  7: "T...#PPP#...T", 8: "#.#.#####.#.#", 9: "#.#.......#.#", 14: "#############",
};
const VARIANTS = [
  { 1: "#o....#....o#", 2: "#.##..#..##.#", 3: "#...........#", 4: "#.##.###.##.#",
    10: "#.##.###.##.#", 11: "#.....#.....#", 12: "#.##..#..##.#", 13: "#o....#....o#" },
  { 1: "#o....#....o#", 2: "#.###.#.###.#", 3: "#...........#", 4: "#.###.#.###.#",
    10: "#.###.#.###.#", 11: "#...........#", 12: "#.###.#.###.#", 13: "#o....#....o#" },
  { 1: "#o.........o#", 2: "#.#.#####.#.#", 3: "#.#.......#.#", 4: "#.#.##.##.#.#",
    10: "#.#.##.##.#.#", 11: "#.#.......#.#", 12: "#.#.#####.#.#", 13: "#o.........o#" },
  { 1: "#o....#....o#", 2: "#..##.#.##..#", 3: "#.#.......#.#", 4: "#.#.#####.#.#",
    10: "#.#.#####.#.#", 11: "#.#.......#.#", 12: "#..##.#.##..#", 13: "#o....#....o#" },
];
export const SWEEPER2_MAPS = VARIANTS.map((v) => {
  const rows = [];
  for (let r = 0; r < 15; r++) rows.push(SHARED[r] !== undefined ? SHARED[r] : v[r]);
  return rows;
});
const COLS = 13, ROWS = 15;
const X = (c) => X0 + c * CS;
const Y = (r) => Y0 + r * CS;
const PSTART = [6, 9], DOOR = [6, 5];
const PENS = [[6, 5], [5, 7], [6, 7], [7, 7]];       // drone 1 starts at the door
const REL = [1, 240, 600, 1000];
const CORNERS = [[1, 1], [11, 1], [1, 13], [11, 13]];
const DRONES = [
  null,
  { name: "SNAP", color: "#ff6666" },
  { name: "TRAP", color: "#ff9d4a" },
  { name: "FLANK", color: "#7ddfff" },
  { name: "GLITCH", color: "#b48cff" },
];
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e", STEEL = "#2e4a62", FRIGHT = "#4a6a8c";

// each map → wall list / pellet template (0 none, 1 dust, 2 power cell)
const WMS = [], TMS = [], TOTS = [];
for (const rows of SWEEPER2_MAPS) {
  const w = [], t = [];
  let tot = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = rows[r][c];
      w.push((ch === "#" || ch === "=" || ch === "P") ? 1 : 0);
      let p = 0;
      if (ch === ".") p = 1;
      if (ch === "o") p = 2;
      if (p) tot++;
      t.push(p);
    }
  }
  WMS.push(w);
  TMS.push(t);
  TOTS.push(tot);
}
// which cells draw as wall in EVERY maze vs only SOME (for the watchers)
const drawAll = [], drawSome = [], dustAny = [], powerAll = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const chars = SWEEPER2_MAPS.map((rows) => rows[r][c]);
    const walls = chars.map((ch) => ch === "#" || ch === "=");
    drawAll.push(walls.every(Boolean) ? 1 : 0);
    drawSome.push(walls.some(Boolean) && !walls.every(Boolean) ? 1 : 0);
    dustAny.push(chars.some((ch) => ch === ".") ? 1 : 0);
    powerAll.push(chars.every((ch) => ch === "o") ? 1 : 0);
  }
}

export function buildSweeper2Example() {
  const L = [];
  const push = (s) => L.push(s);

  const resetPositions = (pad) => {
    push(`${pad}set px to ${X(PSTART[0])}`);
    push(`${pad}set py to ${Y(PSTART[1])}`);
    push(`${pad}set pc to ${PSTART[0]}`);
    push(`${pad}set pr to ${PSTART[1]}`);
    push(`${pad}set pdir to 2`);
    push(`${pad}set want to 2`);
    push(`${pad}set pmoving to 0`);
    for (let k = 1; k <= 4; k++) {
      push(`${pad}set d${k}x to ${X(PENS[k - 1][0])}`);
      push(`${pad}set d${k}y to ${Y(PENS[k - 1][1])}`);
      push(`${pad}set d${k}c to ${PENS[k - 1][0]}`);
      push(`${pad}set d${k}r to ${PENS[k - 1][1]}`);
      push(`${pad}set d${k}dir to 2`);
      push(`${pad}set d${k}pen to 1`);
      push(`${pad}set d${k}rel to ${REL[k - 1]}`);
      push(`${pad}set d${k}fr to 0`);
    }
    push(`${pad}set fright to 0`);
    push(`${pad}set chain to 0`);
    push(`${pad}set scat to 1`);
    push(`${pad}set mt to 0`);
    push(`${pad}set bont to 0`);
  };
  const refill = (pad) => {
    push(`${pad}set mz to (level - 1) % 4`);
    for (let m = 0; m < 4; m++) {
      push(`${pad}if mz == ${m} then`);
      push(`${pad}  set i to 0`);
      push(`${pad}  repeat ${COLS * ROWS}`);
      push(`${pad}    set wm[i] to wm${m}[i]`);
      push(`${pad}    set pel[i] to tm${m}[i]`);
      push(`${pad}    set i to i + 1`);
      push(`${pad}  end`);
      push(`${pad}  set pelleft to ${TOTS[m]}`);
      push(`${pad}  set mtot to ${TOTS[m]}`);
      push(`${pad}end`);
    }
    push(`${pad}set bdone1 to 0`);
    push(`${pad}set bdone2 to 0`);
    push(`${pad}set bont to 0`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set endplay to 0");
  push("set lives to 0");
  push("set level to 1");
  push("set i to 0");
  push(`repeat ${COLS * ROWS}`);
  for (let m = 0; m < 4; m++) {
    push(`  set wm${m}[i] to 0`);
    push(`  set tm${m}[i] to 0`);
  }
  push("  set i to i + 1");
  push("end");
  for (let m = 0; m < 4; m++) {
    for (let i = 0; i < WMS[m].length; i++) {
      if (WMS[m][i]) push(`set wm${m}[${i}] to 1`);
      if (TMS[m][i]) push(`set tm${m}[${i}] to ${TMS[m][i]}`);
    }
  }
  refill("");
  resetPositions("");
  push('set status.text to ""');
  push("end");

  // ======== click
  push("when click");
  push("if game == 9 then");
  push("  set game to 0");
  push("  set endplay to 0");
  push("  set score to 0");
  push("  set lives to 3");
  push("  set level to 1");
  refill("  ");
  resetPositions("  ");
  push('  set status.text to "SWEEP THE DUST. MIND THE DRONES."');
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  // ======== tick
  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO SWEEP ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO SWEEP ◎"');
  push("end");

  push("if game == 0 then");
  // ---- buffered steering: the last direction asked for is remembered
  push(`  if keydown("d") + keydown("ArrowRight") >= 1 or stickx(1) > 0.5 then`);
  push("    set want to 0");
  push("  end");
  push(`  if keydown("s") + keydown("ArrowDown") >= 1 or sticky(1) > 0.5 then`);
  push("    set want to 1");
  push("  end");
  push(`  if keydown("a") + keydown("ArrowLeft") >= 1 or stickx(1) < -0.5 then`);
  push("    set want to 2");
  push("  end");
  push(`  if keydown("w") + keydown("ArrowUp") >= 1 or sticky(1) < -0.5 then`);
  push("    set want to 3");
  push("  end");

  // ---- the breathing: hunt, scatter, hunt
  push("  if fright > 0 then");
  push("    set fright to fright - 1");
  push("    if fright == 0 then");
  for (let k = 1; k <= 4; k++) push(`      set d${k}fr to 0`);
  push("      set chain to 0");
  push("    end");
  push("  else");
  push("    set mt to mt + 1");
  push("    set flipnow to 0");
  push("    if scat == 1 and mt >= 420 then");
  push("      set scat to 0");
  push("      set mt to 0");
  push("      set flipnow to 1");
  push("    end");
  push("    if scat == 0 and mt >= 1200 then");
  push("      set scat to 1");
  push("      set mt to 0");
  push("      set flipnow to 1");
  push("    end");
  push("    if flipnow == 1 then");
  for (let k = 1; k <= 4; k++) {
    push(`      if d${k}pen == 0 then`);
    push(`        set d${k}dir to (d${k}dir + 2) % 4`);
    push("      end");
  }
  push("    end");
  push("  end");

  // ---- the pen door
  for (let k = 1; k <= 4; k++) {
    push(`  if d${k}pen == 1 then`);
    push(`    set d${k}rel to d${k}rel - 1`);
    push(`    if d${k}rel <= 0 then`);
    push(`      set d${k}pen to 0`);
    push(`      set d${k}c to ${DOOR[0]}`);
    push(`      set d${k}r to ${DOOR[1]}`);
    push(`      set d${k}x to ${X(DOOR[0])}`);
    push(`      set d${k}y to ${Y(DOOR[1])}`);
    push(`      set d${k}dir to 2`);
    push("    end");
    push("  end");
  }

  // ---- the sweeper moves
  push("  set pspd to min(2.7, 2.1 + level * 0.1)");
  push(`  set ccx to ${X0} + pc * ${CS}`);
  push(`  set ccy to ${Y0} + pr * ${CS}`);
  push("  if abs(px - ccx) < 1.3 and abs(py - ccy) < 1.3 then");
  push("    set px to ccx");
  push("    set py to ccy");
  const openChk = (dirVar, cVar, rVar, outOk, pad) => {
    push(`${pad}set tc2 to ${cVar}`);
    push(`${pad}set tr2 to ${rVar}`);
    push(`${pad}if ${dirVar} == 0 then`);
    push(`${pad}  set tc2 to tc2 + 1`);
    push(`${pad}end`);
    push(`${pad}if ${dirVar} == 2 then`);
    push(`${pad}  set tc2 to tc2 - 1`);
    push(`${pad}end`);
    push(`${pad}if ${dirVar} == 1 then`);
    push(`${pad}  set tr2 to tr2 + 1`);
    push(`${pad}end`);
    push(`${pad}if ${dirVar} == 3 then`);
    push(`${pad}  set tr2 to tr2 - 1`);
    push(`${pad}end`);
    push(`${pad}if tc2 < 0 then`);
    push(`${pad}  set tc2 to ${COLS - 1}`);
    push(`${pad}end`);
    push(`${pad}if tc2 > ${COLS - 1} then`);
    push(`${pad}  set tc2 to 0`);
    push(`${pad}end`);
    push(`${pad}set ${outOk} to 0`);
    push(`${pad}if wm[tr2 * ${COLS} + tc2] == 0 then`);
    push(`${pad}  set ${outOk} to 1`);
    push(`${pad}end`);
  };
  openChk("want", "pc", "pr", "wok", "    ");
  push("    if wok == 1 then");
  push("      set pdir to want");
  push("    end");
  openChk("pdir", "pc", "pr", "aok", "    ");
  push("    set pmoving to aok");
  push("  end");
  push("  if pmoving == 1 then");
  push("    if pdir == 0 then");
  push("      change px by pspd");
  push("    end");
  push("    if pdir == 2 then");
  push("      change px by 0 - pspd");
  push("    end");
  push("    if pdir == 1 then");
  push("      change py by pspd");
  push("    end");
  push("    if pdir == 3 then");
  push("      change py by 0 - pspd");
  push("    end");
  push("  end");
  // the tunnel
  push("  if px < 8 then");
  push(`    set px to ${X(COLS - 1) + 12}`);
  push("  end");
  push(`  if px > ${X(COLS - 1) + 14} then`);
  push("    set px to 10");
  push("  end");
  push(`  set pc to max(0, min(${COLS - 1}, floor((px - ${X0}) / ${CS} + 0.5)))`);
  push(`  set pr to max(0, min(${ROWS - 1}, floor((py - ${Y0}) / ${CS} + 0.5)))`);

  // ---- sweep the dust
  push(`  set idx to pr * ${COLS} + pc`);
  push("  if pel[idx] >= 1 and abs(px - (" + X0 + " + pc * " + CS + ")) < 8 and abs(py - (" + Y0 + " + pr * " + CS + ")) < 8 then");
  push("    if pel[idx] == 2 then");
  push("      change score by 50");
  push(`      set fright to max(150, 420 - level * 60)`);
  push("      set chain to 0");
  for (let k = 1; k <= 4; k++) {
    push(`      if d${k}pen == 0 then`);
    push(`        set d${k}fr to 1`);
    push(`        set d${k}dir to (d${k}dir + 2) % 4`);
    push("      end");
  }
  push("      beep 220 for 0.18");
  push('      set status.text to "POWER CELL — THE HUNT FLIPS"');
  push("    else");
  push("      change score by 10");
  push("      set wak to 1 - wak");
  push("      if wak == 1 then");
  push("        beep 420 for 0.03");
  push("      else");
  push("        beep 470 for 0.03");
  push("      end");
  push("    end");
  push("    set pel[idx] to 0");
  push("    set pelleft to pelleft - 1");
  // the bonus part shows itself twice a maze
  for (const [flag, at] of [["bdone1", 30], ["bdone2", 70]]) {
    push(`    if ${flag} == 0 and mtot - pelleft >= ${at} then`);
    push(`      set ${flag} to 1`);
    push("      set bont to 520");
    push(`      set bwc to ${DOOR[0]}`);
    push(`      set bwr to ${DOOR[1]}`);
    push(`      set bx2 to ${X(DOOR[0])}`);
    push(`      set by2 to ${Y(DOOR[1])}`);
    push("      set bwdir to 2");
    push("    end");
  }
  // maze clear
  push("    if pelleft <= 0 then");
  push("      set level to level + 1");
  push("      change score by 500");
  push("      beep 659 for 0.08");
  push("      beep 784 for 0.08");
  push("      beep 988 for 0.08");
  push("      beep 1319 for 0.15");
  refill("      ");
  resetPositions("      ");
  push('      set status.text to "MAZE CLEAN — NEW MAZE, LEVEL " + level');
  push("    end");
  push("  end");
  // the bonus part wanders the corridors like prey
  push("  if bont > 0 then");
  push("    set bont to bont - 1");
  push(`    set bccx to ${X0} + bwc * ${CS}`);
  push(`    set bccy to ${Y0} + bwr * ${CS}`);
  push("    if abs(bx2 - bccx) < 1 and abs(by2 - bccy) < 1 then");
  push("      set bx2 to bccx");
  push("      set by2 to bccy");
  push("      set gotd to 0 - 1");
  push("      set tryd to floor(rand(0, 4))");
  push("      repeat 6");
  push("        if gotd < 0 then");
  push("          set tc2 to bwc");
  push("          set tr2 to bwr");
  push("          if tryd == 0 then");
  push("            set tc2 to tc2 + 1");
  push("          end");
  push("          if tryd == 2 then");
  push("            set tc2 to tc2 - 1");
  push("          end");
  push("          if tryd == 1 then");
  push("            set tr2 to tr2 + 1");
  push("          end");
  push("          if tryd == 3 then");
  push("            set tr2 to tr2 - 1");
  push("          end");
  push(`          if tc2 >= 0 and tc2 <= ${COLS - 1} and tr2 >= 0 and tr2 <= ${ROWS - 1} then`);
  push(`            if wm[tr2 * ${COLS} + tc2] == 0 and tryd != (bwdir + 2) % 4 then`);
  push("              set gotd to tryd");
  push("            end");
  push("          end");
  push("        end");
  push("        set tryd to (tryd + 1) % 4");
  push("      end");
  push("      if gotd < 0 then");
  push("        set gotd to (bwdir + 2) % 4");
  push("      end");
  push("      set bwdir to gotd");
  push("    end");
  push("    if bwdir == 0 then");
  push("      change bx2 by 1.7");
  push("    end");
  push("    if bwdir == 2 then");
  push("      change bx2 by -1.7");
  push("    end");
  push("    if bwdir == 1 then");
  push("      change by2 by 1.7");
  push("    end");
  push("    if bwdir == 3 then");
  push("      change by2 by -1.7");
  push("    end");
  push(`    set bwc to max(0, min(${COLS - 1}, floor((bx2 - ${X0}) / ${CS} + 0.5)))`);
  push(`    set bwr to max(0, min(${ROWS - 1}, floor((by2 - ${Y0}) / ${CS} + 0.5)))`);
  push("    if abs(px - bx2) < 12 and abs(py - by2) < 12 then");
  push("      change score by 300 + level * 100");
  push("      set bont to 0");
  push("      beep 988 for 0.12");
  push('      set status.text to "CAUGHT THE PART — +" + (300 + level * 100)');
  push("    end");
  push("  end");

  // ---- the four hunters
  push("  set dspd to min(2.5, 1.9 + level * 0.08)");
  push("  set died to 0");
  for (let k = 1; k <= 4; k++) {
    push(`  if d${k}pen == 0 then`);
    push(`    set mspd to dspd`);
    push(`    if d${k}fr == 1 then`);
    push("      set mspd to 1.15");
    push("    end");
    push(`    set dcx to ${X0} + d${k}c * ${CS}`);
    push(`    set dcy to ${Y0} + d${k}r * ${CS}`);
    push(`    if abs(d${k}x - dcx) < mspd * 0.55 and abs(d${k}y - dcy) < mspd * 0.55 then`);
    push(`      set d${k}x to dcx`);
    push(`      set d${k}y to dcy`);
    // pick the target
    push(`      if d${k}fr == 1 then`);
    push(`        set ttc to floor(rand(0, ${COLS}))`);
    push(`        set ttr to floor(rand(0, ${ROWS}))`);
    push("      else");
    push("        if scat == 1 then");
    push(`          set ttc to ${CORNERS[k - 1][0]}`);
    push(`          set ttr to ${CORNERS[k - 1][1]}`);
    push("        else");
    if (k === 1) {
      push("          set ttc to pc");
      push("          set ttr to pr");
    } else if (k === 2) {
      push("          set ttc to pc");
      push("          set ttr to pr");
      push("          if pdir == 0 then");
      push("            set ttc to pc + 3");
      push("          end");
      push("          if pdir == 2 then");
      push("            set ttc to pc - 3");
      push("          end");
      push("          if pdir == 1 then");
      push("            set ttr to pr + 3");
      push("          end");
      push("          if pdir == 3 then");
      push("            set ttr to pr - 3");
      push("          end");
    } else if (k === 3) {
      push("          set ttc to pc * 2 - d1c");
      push("          set ttr to pr * 2 - d1r");
    } else {
      push(`          if abs(d4c - pc) + abs(d4r - pr) > 6 then`);
      push("            set ttc to pc");
      push("            set ttr to pr");
      push("          else");
      push(`            set ttc to ${CORNERS[3][0]}`);
      push(`            set ttr to ${CORNERS[3][1]}`);
      push("          end");
    }
    push("        end");
    push("      end");
    push(`      set ttc to max(0, min(${COLS - 1}, ttc))`);
    push(`      set ttr to max(0, min(${ROWS - 1}, ttr))`);
    // the mod's patch: one decision in five ignores the plan entirely
    push(`      if d${k}fr == 0 and scat == 0 and rand(0, 1) < 0.2 then`);
    push(`        set ttc to floor(rand(0, ${COLS}))`);
    push(`        set ttr to floor(rand(0, ${ROWS}))`);
    push("      end");
    // choose the open, non-reverse direction nearest the target
    push("      set bestsc to 999");
    push("      set bestd to 0 - 1");
    for (let d = 0; d < 4; d++) {
      push(`      if ${d} != (d${k}dir + 2) % 4 then`);
      push(`        set tc2 to d${k}c + ${d === 0 ? 1 : d === 2 ? -1 : 0}`);
      push(`        set tr2 to d${k}r + ${d === 1 ? 1 : d === 3 ? -1 : 0}`);
      push("        if tc2 < 0 then");
      push(`          set tc2 to ${COLS - 1}`);
      push("        end");
      push(`        if tc2 > ${COLS - 1} then`);
      push("          set tc2 to 0");
      push("        end");
      push(`        if tr2 >= 0 and tr2 <= ${ROWS - 1} then`);
      push(`          if wm[tr2 * ${COLS} + tc2] == 0 then`);
      push("            set sc2 to abs(tc2 - ttc) + abs(tr2 - ttr)");
      push("            if sc2 < bestsc then");
      push("              set bestsc to sc2");
      push(`              set bestd to ${d}`);
      push("            end");
      push("          end");
      push("        end");
      push("      end");
    }
    push("      if bestd < 0 then");
    push(`        set bestd to (d${k}dir + 2) % 4`);
    push("      end");
    push(`      set d${k}dir to bestd`);
    push("    end");
    // move
    push(`    if d${k}dir == 0 then`);
    push(`      change d${k}x by mspd`);
    push("    end");
    push(`    if d${k}dir == 2 then`);
    push(`      change d${k}x by 0 - mspd`);
    push("    end");
    push(`    if d${k}dir == 1 then`);
    push(`      change d${k}y by mspd`);
    push("    end");
    push(`    if d${k}dir == 3 then`);
    push(`      change d${k}y by 0 - mspd`);
    push("    end");
    push(`    if d${k}x < 8 then`);
    push(`      set d${k}x to ${X(COLS - 1) + 12}`);
    push("    end");
    push(`    if d${k}x > ${X(COLS - 1) + 14} then`);
    push(`      set d${k}x to 10`);
    push("    end");
    push(`    set d${k}c to max(0, min(${COLS - 1}, floor((d${k}x - ${X0}) / ${CS} + 0.5)))`);
    push(`    set d${k}r to max(0, min(${ROWS - 1}, floor((d${k}y - ${Y0}) / ${CS} + 0.5)))`);
    // contact
    push(`    if abs(d${k}x - px) < 11 and abs(d${k}y - py) < 11 then`);
    push(`      if d${k}fr == 1 then`);
    push("        set chain to chain + 1");
    push("        set pay to 200");
    push("        if chain == 2 then");
    push("          set pay to 400");
    push("        end");
    push("        if chain == 3 then");
    push("          set pay to 800");
    push("        end");
    push("        if chain >= 4 then");
    push("          set pay to 1600");
    push("        end");
    push("        change score by pay");
    push("        beep 880 for 0.08");
    push(`        say "+" + pay for 0.7`);
    push(`        set d${k}pen to 1`);
    push(`        set d${k}rel to 300`);
    push(`        set d${k}fr to 0`);
    push(`        set d${k}x to ${X(PENS[k - 1][0])}`);
    push(`        set d${k}y to ${Y(PENS[k - 1][1])}`);
    push(`        set d${k}c to ${PENS[k - 1][0]}`);
    push(`        set d${k}r to ${PENS[k - 1][1]}`);
    push("      else");
    push("        set died to 1");
    push("      end");
    push("    end");
    push("  end");
  }

  // ---- caught
  push("  if died == 1 then");
  push("    set lives to lives - 1");
  push("    explode sweeper");
  push("    beep 150 for 0.2");
  push("    beep 80 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "THE DRONES WIN — CLICK TO SWEEP AGAIN"');
  push("    else");
  resetPositions("      ");
  push('      set status.text to lives + " SWEEPERS LEFT"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "SWEEPERS " + lives');
  push('  set leveltx.text to "LEVEL " + level');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set leveltx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];

  // the maze: static blocks where every maze has a wall; watcher blocks
  // (visible only when THIS maze has one) where the four mazes differ
  let wi = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (drawAll[idx]) {
        objects.push({
          id: "s2_w" + (wi++), name: "block" + wi, type: "box",
          x: X(c), y: Y(r), size: 22, color: STEEL, glow: 3, visible: 1, text: "", script: []
        });
      } else if (drawSome[idx]) {
        objects.push({
          id: "s2_w" + (wi++), name: "block" + wi, type: "box",
          x: X(c), y: Y(r), size: 22, color: STEEL, glow: 3, visible: 1, text: "",
          script: [{ event: "code", source: `when tick\nset self.visible to (wm[${idx}] == 1)\nend` }]
        });
      }
    }
  }

  // the dust (one watcher per cell that holds dust in ANY maze) + power cells
  let pi = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (dustAny[idx]) {
        objects.push({
          id: "s2_p" + (pi++), name: "dust" + pi, type: "dot",
          x: X(c), y: Y(r), size: 2, color: GOLD, glow: 3, visible: 1, text: "",
          script: [{ event: "code", source: `when tick\nset self.visible to (pel[${idx}] == 1)\nend` }]
        });
      } else if (powerAll[idx]) {
        objects.push({
          id: "s2_o" + (pi++), name: "power" + pi, type: "ring",
          x: X(c), y: Y(r), size: 7, color: GREEN, glow: 10, visible: 1, text: "",
          script: [{
            event: "code", source: `when tick
set self.visible to (pel[${idx}] == 2)
set self.glow to 8 + sin(time() * 400) * 5
end` }]
        });
      }
    }
  }

  // the bonus part — on the move
  objects.push({
    id: "s2_bn", name: "sparepart", type: "ring",
    x: X(DOOR[0]), y: Y(DOOR[1]), size: 9, color: GOLD, glow: 14, visible: 0, text: "",
    script: [{ event: "code", source: "when tick\nset self.visible to (game == 0 and bont > 0)\nset self.x to bx2\nset self.y to by2\nset self.glow to 10 + sin(time() * 500) * 6\nend" }]
  });

  // four hunter drones — triangles with personalities
  for (let k = 1; k <= 4; k++) {
    objects.push({
      id: "s2_d" + k, name: "drone" + k, type: "tri",
      x: X(PENS[k - 1][0]), y: Y(PENS[k - 1][1]), size: 10, color: DRONES[k].color, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game != 9)
set self.x to d${k}x
set self.y to d${k}y
set self.angle to d${k}dir * 90
if d${k}fr == 1 then
  set self.color to "${FRIGHT}"
  set self.glow to 4
  if fright < 120 and fright % 24 < 12 then
    set self.color to "${WHITE}"
  end
else
  set self.color to "${DRONES[k].color}"
  set self.glow to 10
end
end` }]
    });
  }

  // the sweeper
  objects.push({
    id: "s2_pl", name: "sweeper", type: "ring",
    x: X(PSTART[0]), y: Y(PSTART[1]), size: 9, color: GOLD, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0)
set self.x to px
set self.y to py
set self.size to 8 + sin(time() * 600) * 1.5
end` }]
  });

  // HUD
  objects.push({ id: "s2_sc", name: "scoretx", type: "text", x: 50, y: 24, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "s2_lv", name: "livestx", type: "text", x: 290, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "SWEEPERS 3", script: [] });
  objects.push({ id: "s2_le", name: "leveltx", type: "text", x: 180, y: 22, size: 11, color: GOLD, glow: 5, visible: 0, text: "LEVEL 1", script: [] });
  objects.push({ id: "s2_st", name: "status", type: "text", x: 180, y: 464, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract (over the dim maze, like a real cabinet)
  objects.push({ id: "s2_big", name: "bigtitle", type: "text", x: 180, y: 190, size: 40, color: GOLD, glow: 18, visible: 1, text: "SWEEPER II", script: [] });
  objects.push({ id: "s2_sub", name: "subline", type: "text", x: 180, y: 220, size: 9, color: DIM, glow: 4, visible: 1, text: "A MOD OF OUR OWN SWEEPER · 1981 STYLE", script: [] });
  objects.push({ id: "s2_coin", name: "coinline", type: "text", x: 180, y: 248, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO SWEEP ◎", script: [] });
  objects.push({ id: "s2_play", name: "playbtn", type: "text", x: 180, y: 282, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ SWEEP ]", script: [] });
  objects.push({
    id: "s2_help", name: "help", type: "text",
    x: 180, y: 312, size: 8, color: DIM, glow: 3, visible: 1,
    text: "4 MAZES · THE PART WANDERS · DRONES GO RANDOM",
    script: []
  });

  objects.push({
    id: "s2_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "s2_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "SWEEP", script: [] });

  return { title: "Sweeper II (1981 style)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    w: 360, h: 480, objects };
}

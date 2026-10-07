// example-defender.js — DEFENDER (1980), rebuilt in our studio.
//
// Williams Electronics' side-scrolling shooter — notoriously the hardest
// cabinet of its era, and one of the highest-grossing arcade games ever
// built. The screen is a WINDOW onto a planet four screens wide that
// wraps end to end. Landers drop toward the ten humanoids on the ground,
// grab them, and haul them skyward; a lander that reaches the top with
// its captive becomes a MUTANT — faster, meaner, and hunting YOU.
//
// The 1980 machine, faithfully:
//   · a wrapping world under a scrolling camera with facing look-ahead
//   · momentum flight: thrust builds speed, reversing takes a moment
//   · shoot a hauler and its humanoid FALLS — fly into the humanoid to
//     catch it (500) and it is set down safely below
//   · a humanoid dropped from high up does not survive the landing
//   · the SCANNER: the whole planet on one strip at the top of the glass
//   · SMART BOMBS (B): two a wave, everything on screen dies at once
//   · lose all ten humanoids and every lander arrives as a mutant
//   · survivors pay 100 each at the end of every wave
//
//   A/D THRUST (and face) · W/S CLIMB AND DIVE · SPACE FIRES · B SMART BOMB

const W = 480, H = 360;
const W2 = 1920, GROUND = 332, SKYTOP = 56;
const NHUM = 10, NLAND = 8, NLAS = 2, NBOMB = 3;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", RED = "#ff6666",
  CYAN = "#7ddfff", GOLD = "#e8c84a", ORANGE = "#ff9d4a", STEEL = "#3f7a52";

// jagged mountain skyline, generated once (world coords)
const TERR = [];
{
  let x = 0, y = 320;
  while (x < W2) {
    const nx = Math.min(W2, x + 60 + ((x * 37) % 50));
    const ny = 300 + ((x * 53) % 30);
    TERR.push([x, y, nx, ny]);
    x = nx; y = ny;
  }
  // close the wrap seam
  TERR.push([TERR[TERR.length - 1][2], TERR[TERR.length - 1][3], W2, TERR[0][1]]);
}

export function buildDefenderExample() {
  const L = [];
  const push = (s) => L.push(s);

  // wrap-aware offset of (ox) relative to (base), in -960..960
  const wrapRel = (pad, out, ox, base) => {
    push(`${pad}set ${out} to (${ox} - ${base} + ${W2 * 2}) % ${W2}`);
    push(`${pad}if ${out} > ${W2 / 2} then`);
    push(`${pad}  set ${out} to ${out} - ${W2}`);
    push(`${pad}end`);
  };

  const dealWave = (pad) => {
    push(`${pad}set landleft to min(14, 4 + wave * 2)`);
    push(`${pad}set sbombs to 2`);
    for (let k = 0; k < NLAND; k++) {
      push(`${pad}set lst[${k}] to 0`);
      push(`${pad}set hgrab[${k}] to 0 - 1`);
    }
    for (let j = 0; j < NLAS; j++) push(`${pad}set lon[${j}] to 0`);
    for (let b = 0; b < NBOMB; b++) push(`${pad}set bon[${b}] to 0`);
    push(`${pad}set spawnt to 20`);
    push(`${pad}set status.text to "WAVE " + wave + " — " + humleft + " HUMANOIDS TO DEFEND"`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set wave to 1`);
    push(`${pad}set planetlost to 0`);
    push(`${pad}set humleft to ${NHUM}`);
    for (let i = 0; i < NHUM; i++) {
      push(`${pad}set hon[${i}] to 1`);
      push(`${pad}set hx[${i}] to ${Math.round(96 + (i * 177) % (W2 - 150))}`);
      push(`${pad}set hy[${i}] to ${GROUND}`);
      push(`${pad}set htk[${i}] to 0`);
    }
    push(`${pad}set px to 240`);
    push(`${pad}set py to 180`);
    push(`${pad}set pvx to 0`);
    push(`${pad}set facing to 1`);
    push(`${pad}set grace to 60`);
    dealWave(pad);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set wave to 1");
  push("set humleft to " + NHUM);
  for (let i = 0; i < NHUM; i++) push(`set hon[${i}] to 0`);
  for (let k = 0; k < NLAND; k++) push(`set lst[${k}] to 0`);
  for (let j = 0; j < NLAS; j++) push(`set lon[${j}] to 0`);
  for (let b = 0; b < NBOMB; b++) push(`set bon[${b}] to 0`);
  push('set status.text to ""');
  push("end");

  // ======== click
  push("when click");
  push("if game == 9 then");
  startMatch("  ");
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO DEFEND ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO DEFEND ◎"');
  push("end");

  push("if game == 0 then");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  // ---- momentum flight
  push(`  set thr to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push("  if thr > 0.35 then");
  push("    set facing to 1");
  push("  end");
  push("  if thr < -0.35 then");
  push("    set facing to -1");
  push("  end");
  push("  set pvx to max(-6, min(6, pvx + thr * 0.35)) * 0.985");
  push(`  set px to (px + pvx + ${W2}) % ${W2}`);
  push(`  set vmy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push(`  set py to max(${SKYTOP}, min(${GROUND - 10}, py + vmy * 3))`);

  // ---- lasers (they inherit your speed, like the cabinet's)
  push('  set pf to keydown("Space")');
  push("  if pf == 1 and pf0 == 0 then");
  push("    set fired to 0");
  for (let j = 0; j < NLAS; j++) {
    push(`    if fired == 0 and lon[${j}] == 0 then`);
    push("      set fired to 1");
    push(`      set lon[${j}] to 1`);
    push(`      set lx[${j}] to px + facing * 18`);
    push(`      set ly[${j}] to py`);
    push(`      set lvx[${j}] to facing * 13 + pvx`);
    push(`      set llife[${j}] to 34`);
    push("      beep 740 for 0.04");
    push("    end");
  }
  push("  end");
  push("  set pf0 to pf");
  for (let j = 0; j < NLAS; j++) {
    push(`  if lon[${j}] == 1 then`);
    push(`    set lx[${j}] to (lx[${j}] + lvx[${j}] + ${W2}) % ${W2}`);
    push(`    set llife[${j}] to llife[${j}] - 1`);
    push(`    if llife[${j}] <= 0 then`);
    push(`      set lon[${j}] to 0`);
    push("    end");
    push("  end");
  }

  // ---- SMART BOMB: everything on the glass dies at once
  push('  set pb to keydown("b")');
  push("  if pb == 1 and pb0 == 0 and sbombs > 0 then");
  push("    set sbombs to sbombs - 1");
  push("    set sflash to 10");
  push("    beep 60 for 0.3");
  for (let k = 0; k < NLAND; k++) {
    push(`    if lst[${k}] > 0 then`);
    wrapRel("      ", "rel", `lx2[${k}]`, "px");
    push("      if abs(rel) < 265 then");
    push(`        if hgrab[${k}] >= 0 then`);
    push(`          set hdrop to hgrab[${k}]`);
    push("          set hon[hdrop] to 3");
    push("          set hfs[hdrop] to ly2[" + k + "]");
    push("          set htk[hdrop] to 0");
    push(`          set hgrab[${k}] to 0 - 1`);
    push("        end");
    push(`        set lst[${k}] to 0`);
    push(`        explode lander${k + 1}`);
    push("        change score by 150");
    push("      end");
    push("    end");
  }
  push("  end");
  push("  set pb0 to pb");
  push("  if sflash > 0 then");
  push("    set sflash to sflash - 1");
  push("  end");

  // ---- landers spawn while the wave owes them
  push("  set spawnt to spawnt - 1");
  push("  if landleft > 0 and spawnt <= 0 then");
  push("    set spawnt to 90");
  push("    set free to 0 - 1");
  for (let k = 0; k < NLAND; k++) {
    push(`    if free < 0 and lst[${k}] == 0 then`);
    push(`      set free to ${k}`);
    push("    end");
  }
  push("    if free >= 0 then");
  push("      set landleft to landleft - 1");
  push("      set lst[free] to 1");
  push("      if planetlost == 1 then");
  push("        set lst[free] to 4");
  push("      end");
  push(`      set lx2[free] to (px + 500 + rand(0, 900)) % ${W2}`);
  push("      set ly2[free] to 70 + rand(0, 40)");
  push("      set ltg[free] to 0 - 1");
  push("      set hgrab[free] to 0 - 1");
  push("    end");
  push("  end");

  // ---- the landers work; the mutants hunt
  push("  set aliveenemies to 0");
  for (let k = 0; k < NLAND; k++) {
    push(`  if lst[${k}] > 0 then`);
    push("    set aliveenemies to aliveenemies + 1");
    // seek: choose an unclaimed grounded humanoid
    push(`    if lst[${k}] == 1 then`);
    push(`      if ltg[${k}] < 0 then`);
    push("        set i to 0");
    push(`        repeat ${NHUM}`);
    push(`        if ltg[${k}] < 0 and hon[i] == 1 and htk[i] == 0 then`);
    push(`          set ltg[${k}] to i`);
    push("            set htk[i] to 1");
    push("          end");
    push("          set i to i + 1");
    push("        end");
    push(`        if ltg[${k}] < 0 then`);
    push(`          set lst[${k}] to 4`);
    push("        end");
    push("      end");
    push(`      if lst[${k}] == 1 and ltg[${k}] >= 0 then`);
    wrapRel("        ", "rel", `hx[ltg[${k}]]`, `lx2[${k}]`);
    push("        if abs(rel) > 5 then");
    push("          if rel > 0 then");
    push(`            set lx2[${k}] to (lx2[${k}] + 1.1) % ${W2}`);
    push("          else");
    push(`            set lx2[${k}] to (lx2[${k}] - 1.1 + ${W2}) % ${W2}`);
    push("          end");
    push("        else");
    push(`          set lst[${k}] to 2`);
    push("        end");
    push("      end");
    push("    end");
    // drop onto the target
    push(`    if lst[${k}] == 2 then`);
    push(`      change ly2[${k}] by 1.3`);
    push(`      if ltg[${k}] >= 0 then`);
    push(`        if hon[ltg[${k}]] != 1 then`);
    push(`          set lst[${k}] to 1`);
    push(`          set ltg[${k}] to 0 - 1`);
    push("        else");
    push(`          if ly2[${k}] >= ${GROUND} - 16 then`);
    push(`            set lst[${k}] to 3`);
    push(`            set hgrab[${k}] to ltg[${k}]`);
    push(`            set hon[ltg[${k}]] to 2`);
    push("            beep 494 for 0.08");
    push('            set status.text to "ABDUCTION IN PROGRESS — CHECK THE SCANNER"');
    push("          end");
    push("        end");
    push("      end");
    push("    end");
    // haul skyward
    push(`    if lst[${k}] == 3 then`);
    push(`      change ly2[${k}] by -0.9`);
    push(`      if hgrab[${k}] >= 0 then`);
    push(`        set hx[hgrab[${k}]] to lx2[${k}]`);
    push(`        set hy[hgrab[${k}]] to ly2[${k}] + 14`);
    push("      end");
    push(`      if ly2[${k}] < ${SKYTOP} + 8 then`);
    push(`        if hgrab[${k}] >= 0 then`);
    push(`          set hon[hgrab[${k}]] to 0`);
    push(`          set htk[hgrab[${k}]] to 0`);
    push("          set humleft to humleft - 1");
    push(`          set hgrab[${k}] to 0 - 1`);
    push("          beep 98 for 0.25");
    push('          set status.text to "HUMANOID LOST — IT RETURNS AS A MUTANT"');
    push("        end");
    push(`        set lst[${k}] to 4`);
    push(`        set ltg[${k}] to 0 - 1`);
    push("      end");
    push("    end");
    // the mutant hunt
    push(`    if lst[${k}] == 4 then`);
    wrapRel("      ", "rel", "px", `lx2[${k}]`);
    push("      if rel > 0 then");
    push(`        set lx2[${k}] to (lx2[${k}] + 2.3) % ${W2}`);
    push("      else");
    push(`        set lx2[${k}] to (lx2[${k}] - 2.3 + ${W2}) % ${W2}`);
    push("      end");
    push(`      set ly2[${k}] to max(${SKYTOP}, min(${GROUND - 14}, ly2[${k}] + (py - ly2[${k}]) * 0.03 + sin(time() * 400 + ${k * 90}) * 2.4))`);
    push("    end");
    // your lasers
    for (let j = 0; j < NLAS; j++) {
      push(`    if lst[${k}] > 0 and lon[${j}] == 1 then`);
      wrapRel("      ", "rel", `lx[${j}]`, `lx2[${k}]`);
      push(`      if abs(rel) < 22 and abs(ly[${j}] - ly2[${k}]) < 11 then`);
      push(`        set lon[${j}] to 0`);
      push(`        if hgrab[${k}] >= 0 then`);
      push(`          set hdrop to hgrab[${k}]`);
      push("          set hon[hdrop] to 3");
      push(`          set hfs[hdrop] to ly2[${k}]`);
      push(`          set htk[hdrop] to 0`);
      push(`          set hgrab[${k}] to 0 - 1`);
      push("        end");
      push(`        if ltg[${k}] >= 0 then`);
      push(`          set htk[ltg[${k}]] to 0`);
      push("        end");
      push(`        set lst[${k}] to 0`);
      push(`        explode lander${k + 1}`);
      push("        change score by 150");
      push("        beep 180 for 0.08");
      push("      end");
      push("    end");
    }
    // ramming you
    push(`    if lst[${k}] > 0 and grace <= 0 then`);
    wrapRel("      ", "rel", "px", `lx2[${k}]`);
    push(`      if abs(rel) < 13 and abs(py - ly2[${k}]) < 12 then`);
    push("        set pdie to 1");
    push("      end");
    push("    end");
    push("  end");
  }

  // ---- enemy fire
  push("  set bclk to bclk + 1");
  push("  if bclk > 70 and aliveenemies > 0 then");
  push("    set bclk to 0");
  push("    set shooter to 0 - 1");
  for (let k = 0; k < NLAND; k++) {
    push(`    if shooter < 0 and lst[${k}] > 0 and rand(0, 1) < 0.4 then`);
    push(`      set shooter to ${k}`);
    push("    end");
  }
  push("    if shooter >= 0 then");
  push("      set free to 0 - 1");
  for (let b = 0; b < NBOMB; b++) {
    push(`    if free < 0 and bon[${b}] == 0 then`);
    push(`      set free to ${b}`);
    push("    end");
  }
  push("      if free >= 0 then");
  push("        set bon[free] to 1");
  push("        set bx[free] to lx2[shooter]");
  push("        set by[free] to ly2[shooter]");
  wrapRel("        ", "rel", "px", "lx2[shooter]");
  push("        set ddy to py - ly2[shooter]");
  push("        set blen to max(10, max(abs(rel), abs(ddy)) + 0.41 * min(abs(rel), abs(ddy)))");
  push("        set bvx[free] to rel / blen * 3.2");
  push("        set bvy[free] to ddy / blen * 3.2");
  push("        set blife[free] to 170");
  push("        beep 540 for 0.05");
  push("      end");
  push("    end");
  push("  end");
  for (let b = 0; b < NBOMB; b++) {
    push(`  if bon[${b}] == 1 then`);
    push(`    set bx[${b}] to (bx[${b}] + bvx[${b}] + ${W2}) % ${W2}`);
    push(`    change by[${b}] by bvy[${b}]`);
    push(`    set blife[${b}] to blife[${b}] - 1`);
    push(`    if blife[${b}] <= 0 then`);
    push(`      set bon[${b}] to 0`);
    push("    end");
    push(`    if bon[${b}] == 1 and grace <= 0 then`);
    wrapRel("      ", "rel", `bx[${b}]`, "px");
    push(`      if abs(rel) < 10 and abs(by[${b}] - py) < 10 then`);
    push(`        set bon[${b}] to 0`);
    push("        set pdie to 1");
    push("      end");
    push("    end");
    push("  end");
  }

  // ---- falling humanoids: catch them, or count the cost
  push("  set i to 0");
  push(`  repeat ${NHUM}`);
  push("    if hon[i] == 3 then");
  push("      change hy[i] by 2.2");
  wrapRel("      ", "rel", "hx[i]", "px");
  push("      if abs(rel) < 15 and abs(hy[i] - py) < 13 then");
  push("        set hon[i] to 1");
  push(`        set hy[i] to ${GROUND}`);
  push("        change score by 500");
  push("        beep 784 for 0.08");
  push("        beep 1047 for 0.1");
  push('        set status.text to "HUMANOID CAUGHT — SET DOWN SAFE (+500)"');
  push("      end");
  push(`      if hon[i] == 3 and hy[i] >= ${GROUND} then`);
  push("        if hfs[i] < 200 then");
  push("          set hon[i] to 1");
  push(`          set hy[i] to ${GROUND}`);
  push("        else");
  push("          set hon[i] to 0");
  push("          set humleft to humleft - 1");
  push("          beep 98 for 0.2");
  push('          set status.text to "A HUMANOID FELL TOO FAR"');
  push("        end");
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");
  // grounded humanoids drift
  push("  set i to 0");
  push(`  repeat ${NHUM}`);
  push("    if hon[i] == 1 then");
  push(`      set hx[i] to (hx[i] + sin(time() * 40 + i * 70) * 0.3 + ${W2}) % ${W2}`);
  push("    end");
  push("    set i to i + 1");
  push("  end");
  // the planet is lost
  push("  if humleft <= 0 and planetlost == 0 then");
  push("    set planetlost to 1");
  for (let k = 0; k < NLAND; k++) {
    push(`    if lst[${k}] == 1 or lst[${k}] == 2 then`);
    push(`      set lst[${k}] to 4`);
    push("    end");
  }
  push("    beep 70 for 0.5");
  push('    set status.text to "PLANET LOST — EVERYTHING COMES AS MUTANTS"');
  push("  end");

  // ---- a hit on the defender
  push("  if pdie == 1 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode defship");
  push("    beep 90 for 0.4");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "THE DEFENSE FELL — CLICK TO DEFEND AGAIN"');
  push("    else");
  push("      set grace to 90");
  push("      set pvx to 0");
  push('      set status.text to lives + " SHIPS LEFT"');
  push("    end");
  push("  end");

  // ---- wave clear: survivors pay
  push("  if game == 0 and landleft <= 0 and aliveenemies == 0 then");
  push("    change score by humleft * 100");
  push('    set status.text to "WAVE " + wave + " HELD — " + humleft + " SURVIVORS × 100"');
  push("    set wave to wave + 1");
  push("    beep 659 for 0.08");
  push("    beep 988 for 0.12");
  dealWave("    ");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "SHIPS " + lives + " · BOMBS " + sbombs');
  push('  set wavetx.text to "WAVE " + wave + " · HUMANOIDS " + humleft');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set wavetx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";
  // screen x of a world x, through the camera (ship sits off-centre, looking ahead)
  const cam = (ox) => `set relsc to (${ox} - px + ${W2 * 2}) % ${W2}
if relsc > ${W2 / 2} then
  set relsc to relsc - ${W2}
end
set self.x to 240 - facing * 80 + relsc`;

  // the mountain skyline
  TERR.forEach(([x1, y1, x2, y2], i) => {
    const len = Math.round(Math.hypot(x2 - x1, y2 - y1));
    const ang = Math.round(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI);
    objects.push({
      id: "df_t" + i, name: "ridge" + (i + 1), type: "line",
      x: -999, y: y1, size: len, angle: ang, color: STEEL, glow: 3, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
${cam(String(x1))}
set self.visible to (${inGame} and self.x > -140 and self.x < 620)
end` }]
    });
  });

  // the ten humanoids
  for (let i = 0; i < NHUM; i++) {
    objects.push({
      id: "df_h" + i, name: "humanoid" + (i + 1), type: "text",
      x: -99, y: GROUND, size: 10, color: GOLD, glow: 7, visible: 0, text: "i",
      script: [{
        event: "code", source: `when tick
${cam(`hx[${i}]`)}
set self.y to hy[${i}]
set self.visible to (${inGame} and hon[${i}] >= 1 and self.x > -20 and self.x < 500)
end` }]
    });
  }

  // the landers / mutants
  for (let k = 0; k < NLAND; k++) {
    objects.push({
      id: "df_l" + k, name: "lander" + (k + 1), type: "text",
      x: -99, y: -99, size: 15, color: GREEN, glow: 10, visible: 0, text: "∩",
      script: [{
        event: "code", source: `when tick
${cam(`lx2[${k}]`)}
set self.y to ly2[${k}]
set self.visible to (${inGame} and lst[${k}] > 0 and self.x > -20 and self.x < 500)
if lst[${k}] == 4 then
  set self.text to "¤"
  set self.color to "${RED}"
else
  set self.text to "∩"
  set self.color to "${GREEN}"
end
end` }]
    });
  }

  // lasers, bombs, the ship, the smart-bomb flash
  for (let j = 0; j < NLAS; j++) {
    objects.push({
      id: "df_la" + j, name: "laser" + (j + 1), type: "line",
      x: -99, y: -99, size: 44, angle: 0, color: WHITE, glow: 12, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
${cam(`lx[${j}]`)}
set self.y to ly[${j}]
set self.visible to (${inGame} and lon[${j}] == 1 and self.x > -60 and self.x < 540)
end` }]
    });
  }
  for (let b = 0; b < NBOMB; b++) {
    objects.push({
      id: "df_b" + b, name: "bomb" + (b + 1), type: "dot",
      x: -99, y: -99, size: 3, color: RED, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
${cam(`bx[${b}]`)}
set self.y to by[${b}]
set self.visible to (${inGame} and bon[${b}] == 1 and self.x > -20 and self.x < 500)
end` }]
    });
  }
  objects.push({
    id: "df_p", name: "defship", type: "tri",
    x: 160, y: 180, size: 12, color: CYAN, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.x to 240 - facing * 80
set self.y to py
set self.angle to 90 - facing * 90
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4))
end` }]
  });
  objects.push({
    id: "df_sf", name: "bombflash", type: "ring",
    x: 240, y: 190, size: 200, color: WHITE, glow: 18, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and sflash > 0)
set self.size to 240 - sflash * 14
end` }]
  });

  // the SCANNER: the whole planet on one strip
  objects.push({ id: "df_s1", name: "scantop", type: "line", x: 4, y: 34, size: 472, angle: 0, color: DIM, glow: 3, visible: 0, text: "", script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }] });
  objects.push({ id: "df_s2", name: "scanbot", type: "line", x: 4, y: 52, size: 472, angle: 0, color: DIM, glow: 3, visible: 0, text: "", script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }] });
  for (let i = 0; i < NHUM; i++) {
    objects.push({
      id: "df_sh" + i, name: "scanhum" + (i + 1), type: "dot",
      x: -9, y: 48, size: 2, color: GOLD, glow: 4, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.x to 8 + hx[${i}] * 0.242
set self.visible to (${inGame} and hon[${i}] >= 1)
end` }]
    });
  }
  for (let k = 0; k < NLAND; k++) {
    objects.push({
      id: "df_sl" + k, name: "scanfoe" + (k + 1), type: "dot",
      x: -9, y: 42, size: 2, color: RED, glow: 5, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.x to 8 + lx2[${k}] * 0.242
set self.y to 38 + ly2[${k}] * 0.03
set self.visible to (${inGame} and lst[${k}] > 0)
end` }]
    });
  }
  objects.push({
    id: "df_sp", name: "scanship", type: "dot",
    x: -9, y: 44, size: 3, color: CYAN, glow: 6, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.x to 8 + px * 0.242
set self.y to 38 + py * 0.03
set self.visible to ${inGame}
end` }]
  });

  // HUD
  objects.push({ id: "df_sc", name: "scoretx", type: "text", x: 58, y: 20, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "df_lv", name: "livestx", type: "text", x: 390, y: 18, size: 11, color: DIM, glow: 4, visible: 0, text: "SHIPS 3 · BOMBS 2", script: [] });
  objects.push({ id: "df_wv", name: "wavetx", type: "text", x: 225, y: 18, size: 11, color: ORANGE, glow: 5, visible: 0, text: "WAVE 1 · HUMANOIDS 10", script: [] });
  objects.push({ id: "df_st", name: "status", type: "text", x: W / 2, y: 352, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "df_big", name: "bigtitle", type: "text", x: W / 2, y: 112, size: 42, color: CYAN, glow: 18, visible: 1, text: "DEFENDER", script: [] });
  objects.push({ id: "df_sub", name: "subline", type: "text", x: W / 2, y: 144, size: 10, color: DIM, glow: 4, visible: 1, text: "WILLIAMS 1980 · ALL-TIME TOP GROSSER", script: [] });
  objects.push({ id: "df_coin", name: "coinline", type: "text", x: W / 2, y: 176, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO DEFEND ◎", script: [] });
  objects.push({ id: "df_play", name: "playbtn", type: "text", x: W / 2, y: 214, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ DEFEND ]", script: [] });
  objects.push({
    id: "df_help", name: "help", type: "text",
    x: W / 2, y: 248, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A/D THRUST · W/S CLIMB · SPACE · B BOMB",
    script: []
  });

  objects.push({
    id: "df_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "df_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "THRUST", script: [] });

  return { title: "Defender (1980)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

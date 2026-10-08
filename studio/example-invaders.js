// example-invaders.js — SPACE INVADERS (1978), rebuilt in our studio.
//
// Tomohiro Nishikado again — the man who built Western Gun (1975, two rooms
// over in this museum) spent a year building his own microcomputer hardware
// just to run this. Taito shipped it in June 1978 and Japan lost its mind:
// invader-only arcades, leagues, and the legend that the 100-yen coin itself
// ran short. True or not, the Bank of Japan minted a fortune more of them.
//
// The 1978 machine, faithfully:
//   · 55 invaders, 5 rows × 11 columns, MARCHING as one body — step, step,
//     hit the wall, DROP A ROW and come back the other way
//   · the march ACCELERATES as they die — originally an accident (fewer
//     sprites = less for the CPU to draw), kept because it was terrifying.
//     The two-tone heartbeat speeds up with it.
//   · rows pay 10 / 20 / 30 — and the MYSTERY SAUCER pays 50 to 300
//   · ONE player shot on screen at a time, 1978's whole skill ceiling
//   · four bunkers that ERODE under fire — theirs and yours
//   · 3 lives; clear a wave and the next starts LOWER. If they land: over.
//   · vertical monitor → our portrait world, 360×480
//
//   ← → or A/D (or the stick) MOVE · SPACE FIRES · invaders by our own
//   typography: Ψ Ж Ф — the shapes are ours, the terror is 1978's

const W = 360, H = 480;
const COLS = 11, ROWS = 5, NINV = 55;
const SPX = 26, SPY = 22;            // formation spacing
const FX0 = 30, FY0 = 90;            // wave-1 formation anchor
const STEPX = 7, DROP = 12;
const CANY = 448, BUNKY = 408;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", ORANGE = "#ff9d4a";
const BUNX = [58, 140, 222, 304];    // four bunkers, three blocks each

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const fillWave = (pad) => {
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${NINV}`);
    push(`${pad}  set a[i] to 1`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set alive to ${NINV}`);
    push(`${pad}set fx to ${FX0}`);
    push(`${pad}set fy to ${FY0} + min(60, (wave - 1) * 14)`);
    push(`${pad}set dirx to 1`);
    push(`${pad}set stept to 0`);
    push(`${pad}set tone to 0`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set wave to 1`);
    push(`${pad}set shoton to 0`);
    push(`${pad}set bombon1 to 0`);
    push(`${pad}set bombon2 to 0`);
    push(`${pad}set sauceron to 0`);
    push(`${pad}set saucert to 700`);
    push(`${pad}set cannon.x to ${W / 2}`);
    fillWave(pad);
    for (let b = 1; b <= 12; b++) push(`${pad}set bk${b}.hp to 2`);
    push(`${pad}set status.text to "THEY ONLY COME DOWN. MAKE IT EXPENSIVE."`);
  };

  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set wave to 1");
  push("set lives to 0");
  push("set endplay to 0");
  push("set shoton to 0");
  push("set bombon1 to 0");
  push("set bombon2 to 0");
  push("set sauceron to 0");
  fillWave("");
  for (let b = 1; b <= 12; b++) push(`set bk${b}.hp to 0`);
  push('set status.text to ""');
  push("end");

  push("when tick");
  push('set scoretx.text to "" + score');
  push('set livestx.text to "LIVES " + lives');
  push('set wavetx.text to "WAVE " + wave');
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set wavetx.visible to (game != 9)");
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

  // ---- THE MARCH: the whole formation is two numbers (fx, fy) and a list.
  // Step cadence scales with the living — 55 alive crawls, the last one runs.
  push("if game == 0 or game == 9 then");
  push(`  set stepn to max(3, 3 + floor(alive * 34 / ${NINV}) - (wave - 1) * 2)`);
  push("  set stept to stept + 1");
  push("  if stept >= stepn then");
  push("    set stept to 0");
  // the living edges of the formation decide the wall bounce
  push("    set mincol to 10");
  push("    set maxcol to 0");
  push("    set maxrow to 0");
  push("    set i to 0");
  push(`    repeat ${NINV}`);
  push("      if a[i] == 1 then");
  push(`        set c to i % ${COLS}`);
  push(`        set r to floor(i / ${COLS})`);
  push("        set mincol to min(mincol, c)");
  push("        set maxcol to max(maxcol, c)");
  push("        set maxrow to max(maxrow, r)");
  push("      end");
  push("      set i to i + 1");
  push("    end");
  push(`    if (dirx > 0 and fx + maxcol * ${SPX} + ${STEPX} > ${W - 24}) or (dirx < 0 and fx + mincol * ${SPX} - ${STEPX} < 14) then`);
  push("      set dirx to 0 - dirx");
  push(`      set fy to fy + ${DROP}`);
  push("      beep 72 for 0.05");
  push("    else");
  push(`      set fx to fx + dirx * ${STEPX}`);
  // the heartbeat: two alternating bass notes, faster as they die
  push("      set tone to 1 - tone");
  push("      if tone == 1 then");
  push("        beep 110 for 0.05");
  push("      else");
  push("        beep 98 for 0.05");
  push("      end");
  push("    end");
  // INVASION: they reach the ground and it's simply over
  push(`    if game == 0 and fy + maxrow * ${SPY} >= ${CANY - 18} then`);
  push("      set game to 2");
  push("      set endplay to 1");
  push("      explode cannon");
  push('      set status.text to "THEY LANDED — CLICK FOR A NEW STAND"');
  push("    end");
  push("    if game == 9 and fy > 200 then");
  push(`      set fy to ${FY0}`);   // the attract march loops forever
  push("    end");
  push("  end");
  push("end");

  push("if game == 0 then");
  // ---- the MYSTERY SAUCER slides the top at intervals
  push("  if sauceron == 0 then");
  push("    set saucert to saucert - 1");
  push("    if saucert <= 0 then");
  push("      set sauceron to 1");
  push("      set saucer.x to -16");
  push("    end");
  push("  else");
  push("    change saucer.x by 2.1");
  push(`    if saucer.x > ${W + 16} then`);
  push("      set sauceron to 0");
  push("      set saucert to 700 + floor(rand(0, 300))");
  push("    end");
  push("  end");
  // ---- wave cleared: the next starts LOWER
  push("  if alive == 0 then");
  push("    set wave to wave + 1");
  fillWave("    ");
  push("    set shoton to 0");
  push("    set bombon1 to 0");
  push("    set bombon2 to 0");
  push('    set status.text to "WAVE " + wave + " — THEY START CLOSER NOW"');
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  startMatch("  ");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("    set wave to 1");
  fillWave("    ");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

// the cannon: slide and fire — ONE shot on screen, like 1978
function cannonCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game == 0)");
  push("if game == 0 then");
  push(`  set mv to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push("  change self.x by mv * 3.4");
  push(`  set self.x to max(18, min(${W - 18}, self.x))`);
  push('  set pf to keydown("Space")');
  push("  if pf == 1 and pf0 == 0 and shoton == 0 then");
  push("    set shoton to 1");
  push("    set shot.x to self.x");
  push(`    set shot.y to ${CANY - 14}`);
  push("    beep 880 for 0.04");
  push("  end");
  push("  set pf0 to pf");
  push("end");
  push("end");
  return L.join("\n");
}

// the player's shot: up fast, kills by GRID MATH, erodes bunkers, bags saucers
function shotCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game == 0 and shoton == 1)");
  push("if game == 0 and shoton == 1 then");
  push("  change self.y by -8");
  push("  if self.y < 20 then");
  push("    set shoton to 0");
  push("  end");
  // the saucer: mystery money
  push("  if sauceron == 1 and abs(self.x - saucer.x) < 14 and abs(self.y - saucer.y) < 10 then");
  push("    set sauceron to 0");
  push("    set shoton to 0");
  push("    set saucert to 700 + floor(rand(0, 300))");
  push("    set mr to floor(rand(0, 4))");
  push("    set mpay to 50");
  push("    if mr == 1 then");
  push("      set mpay to 100");
  push("    end");
  push("    if mr == 2 then");
  push("      set mpay to 150");
  push("    end");
  push("    if mr == 3 then");
  push("      set mpay to 300");
  push("    end");
  push("    change score by mpay");
  push("    explode saucer");
  push("    beep 1200 for 0.1");
  push('    say "MYSTERY " + mpay for 1');
  push("  end");
  // the formation: position → grid slot, one divide each way (Breakout's trick)
  push(`  set c to round((self.x - fx) / ${SPX})`);
  push(`  set r to round((self.y - fy) / ${SPY})`);
  push(`  if c >= 0 and c <= ${COLS - 1} and r >= 0 and r <= ${ROWS - 1} then`);
  push(`    if abs(self.x - (fx + c * ${SPX})) < 11 and abs(self.y - (fy + r * ${SPY})) < 10 then`);
  push(`      set idx to r * ${COLS} + c`);
  push("      if a[idx] == 1 then");
  push("        set a[idx] to 0");
  push("        set alive to alive - 1");
  push("        set shoton to 0");
  // rows pay like 1978: the farther they are, the more they're worth
  push("        if r == 0 then");
  push("          change score by 30");
  push("        else");
  push("          if r < 3 then");
  push("            change score by 20");
  push("          else");
  push("            change score by 10");
  push("          end");
  push("        end");
  push("        beep 523 for 0.05");
  push("        beep 262 for 0.05");
  push("      end");
  push("    end");
  push("  end");
  // the bunkers stop YOUR fire too — 1978's cruelest honesty
  for (let b = 1; b <= 12; b++) {
    push(`  if shoton == 1 and bk${b}.hp > 0 and abs(self.x - bk${b}.x) < 9 and abs(self.y - bk${b}.y) < 9 then`);
    push(`    set bk${b}.hp to bk${b}.hp - 1`);
    push("    set shoton to 0");
    push("    beep 160 for 0.04");
    push("  end");
  }
  push("end");
  push("end");
  return L.join("\n");
}

// an invader bomb: finds the lowest living invader in a random column, drops
function bombCode(n) {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push(`set self.visible to (game == 0 and bombon${n} == 1)`);
  push("if game == 0 then");
  push(`  if bombon${n} == 0 then`);
  push(`    set bt${n} to bt${n} - 1`);
  push(`    if bt${n} <= 0 then`);
  push(`      set bc to floor(rand(0, ${COLS}))`);
  push("      set br to 0 - 1");
  push("      set i to 0");
  push(`      repeat ${ROWS}`);
  push(`        if a[i * ${COLS} + bc] == 1 then`);
  push("          set br to i");
  push("        end");
  push("        set i to i + 1");
  push("      end");
  push("      if br >= 0 then");
  push(`        set bombon${n} to 1`);
  push(`        set self.x to fx + bc * ${SPX}`);
  push(`        set self.y to fy + br * ${SPY} + 10`);
  push("      end");
  push(`      set bt${n} to ${n === 1 ? 55 : 85} + floor(rand(0, 60))`);
  push("    end");
  push("  else");
  push("    change self.y by 3.1");
  push(`    if self.y > ${H - 8} then`);
  push(`      set bombon${n} to 0`);
  push("    end");
  for (let b = 1; b <= 12; b++) {
    push(`    if bombon${n} == 1 and bk${b}.hp > 0 and abs(self.x - bk${b}.x) < 9 and abs(self.y - bk${b}.y) < 9 then`);
    push(`      set bk${b}.hp to bk${b}.hp - 1`);
    push(`      set bombon${n} to 0`);
    push("      beep 160 for 0.04");
    push("    end");
  }
  push(`    if bombon${n} == 1 and abs(self.x - cannon.x) < 11 and abs(self.y - ${CANY}) < 10 then`);
  push(`      set bombon${n} to 0`);
  push("      set lives to lives - 1");
  push("      explode cannon");
  push("      beep 90 for 0.3");
  push(`      set cannon.x to ${W / 2}`);
  push("      if lives <= 0 then");
  push("        set game to 2");
  push("        set endplay to 1");
  push('        set status.text to "GAME OVER — CLICK FOR A NEW STAND"');
  push("      else");
  push('        set status.text to "CANNON DOWN — " + lives + " LEFT"');
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

export function buildInvadersExample() {
  const objects = [];

  // THE FIFTY-FIVE: display-only glyphs watching their slot in a[] and the
  // two formation numbers. Top row Ф pays 30, middles Ж pay 20, bottoms Ψ 10.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c;
      const glyph = r === 0 ? "Ф" : r < 3 ? "Ж" : "Ψ";
      objects.push({
        id: "si_i" + k, name: "inv" + (k + 1), type: "text",
        x: FX0 + c * SPX, y: FY0 + r * SPY, size: 15, color: r === 0 ? ORANGE : GREEN, glow: 9, visible: 1, text: glyph,
        script: [{
          event: "code", source: `when tick
set self.x to fx + ${c} * ${SPX}
set self.y to fy + ${r} * ${SPY}
set self.visible to a[${k}] * (game != 2)
end` }]
      });
    }
  }

  // the four bunkers, three blocks each — hp 2, dimming as they crumble
  let bkn = 0;
  for (const bx of BUNX) {
    for (const dx of [-14, 0, 14]) {
      bkn++;
      objects.push({
        id: "si_b" + bkn, name: "bk" + bkn, type: "box",
        x: bx + dx, y: BUNKY, size: 13, color: GREEN, glow: 10, visible: 0, text: "",
        script: [{ event: "code", source: `when tick
set self.visible to (self.hp > 0 and game == 0)
set self.glow to self.hp * 6
end` }]
      });
    }
  }

  // the cannon, the shot, two bombs, the saucer
  objects.push({
    id: "si_can", name: "cannon", type: "tri",
    x: W / 2, y: CANY, size: 12, angle: 270, color: WHITE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: cannonCode() }]
  });
  objects.push({
    id: "si_shot", name: "shot", type: "box",
    x: -30, y: -30, size: 4, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{ event: "code", source: shotCode() }]
  });
  objects.push({
    id: "si_bm1", name: "bomb1", type: "box",
    x: -30, y: -30, size: 5, color: ORANGE, glow: 8, visible: 0, text: "",
    script: [{ event: "code", source: bombCode(1) }]
  });
  objects.push({
    id: "si_bm2", name: "bomb2", type: "box",
    x: -30, y: -30, size: 5, color: ORANGE, glow: 8, visible: 0, text: "",
    script: [{ event: "code", source: bombCode(2) }]
  });
  objects.push({
    id: "si_sau", name: "saucer", type: "text",
    x: -30, y: 46, size: 14, color: "#2dd2ff", glow: 12, visible: 0, text: "<◊>",
    script: [{ event: "code", source: "when tick\nset self.visible to (game == 0 and sauceron == 1)\nend" }]
  });

  // HUD
  objects.push({ id: "si_sc", name: "scoretx", type: "text", x: 48, y: 22, size: 22, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "si_lv", name: "livestx", type: "text", x: 300, y: 18, size: 12, color: DIM, glow: 4, visible: 0, text: "LIVES 3", script: [] });
  objects.push({ id: "si_wv", name: "wavetx", type: "text", x: 300, y: 32, size: 12, color: DIM, glow: 4, visible: 0, text: "WAVE 1", script: [] });
  objects.push({ id: "si_st", name: "status", type: "text", x: W / 2, y: 478, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "si_big", name: "bigtitle", type: "text", x: W / 2, y: 250, size: 32, color: WHITE, glow: 18, visible: 1, text: "SPACE INVADERS", script: [] });
  objects.push({ id: "si_sub", name: "subline", type: "text", x: W / 2, y: 282, size: 10, color: DIM, glow: 4, visible: 1, text: "TAITO 1978 · THE COIN EATER", script: [] });
  objects.push({ id: "si_coin", name: "coinline", type: "text", x: W / 2, y: 312, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO DEFEND ◎", script: [] });
  objects.push({ id: "si_play", name: "playbtn", type: "text", x: W / 2, y: 350, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ DEFEND ]", script: [] });
  objects.push({
    id: "si_help", name: "help", type: "text",
    x: W / 2, y: 390, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A/D MOVES · SPACE — ONE SHOT AT A TIME",
    script: []
  });

  objects.push({
    id: "si_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({ id: "si_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "MOVE", script: [] });

  return { title: "Space Invaders (1978)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    w: W, h: H, objects };
}

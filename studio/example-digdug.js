// example-digdug.js — DIG DUG (1982), rebuilt in our studio.
//
// Namco's digging mainstay: the screen is a solid block of strata and the
// TUNNELS ARE YOURS — every game carves a different maze, because you are
// the one carving it. Two ways to kill, both absurd and both perfect: pump
// a burrower full of air until it pops (deeper strata pay more), or dig
// out the ground under a rock and let it fall. Its creatures are Namco's,
// so ours are drawn with our own glyphs: ROUNDERS that hunt through the
// tunnels, and FLAME WYRMS that breathe fire down the corridors. Both
// learned the famous trick — go GHOST and drift straight through the
// dirt at you, then pop back solid in a tunnel.
//
//   · dig anywhere: 10 points a cell, and the maze is your weapon
//   · SPACE fires the pump down your facing (tunnels only — dirt
//     stops it); HOLD to inflate: four stages and they burst.
//     Pumping roots you to the spot. Let go and they deflate.
//   · rocks fall when you dig out their floor — crushing them pays
//     1000, crushing you pays nothing. Drop two rocks and a PRIZE
//     appears at the surface.
//   · deeper kills pay more: 200 / 300 / 400 / 500 by stratum,
//     +100 for a wyrm · clear the field, +500, and it refills faster
//
//   WASD / arrows / stick dig · SPACE pumps · 3 DIGGERS

const W = 360, H = 480;
const CS = 26, X0 = 24, Y0 = 67, COLS = 13, ROWS = 15;    // row 0 is the sky
const X = (c) => X0 + c * CS;
const Y = (r) => Y0 + r * CS;
const PSTART = [6, 7];
const SHAFT = { col: 6, r0: 1, r1: 7 };
// enemy pockets: [tunnel c0, c1, row, start c, type 0 rounder / 1 wyrm]
const DEFS = [
  [1, 4, 3, 2, 0],
  [8, 11, 2, 9, 1],
  [1, 4, 6, 3, 1],
  [8, 11, 7, 10, 0],
  [2, 5, 10, 3, 0],
  [7, 10, 12, 8, 1],
];
const NE = DEFS.length;
const ROCKS = [[1, 9], [10, 4], [5, 8], [11, 11]];
const PRIZECELL = [6, 0];
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", SKY = "#1a2a4a";
const STRATA = ["#9a7a42", "#8a5e34", "#74482c", "#583624"];
const stratum = (r) => (r <= 4 ? 0 : r <= 8 ? 1 : r <= 11 ? 2 : 3);
const ECOLOR = ["#ff8c5a", "#7dff9e"];      // rounder, wyrm
const EGLYPH = ["◎", "ξ"];
const GHOSTC = "#6a8ab0";

export function buildDigDugExample() {
  const L = [];
  const push = (s) => L.push(s);

  // ---- deal a level: fresh dirt, pockets, rocks, enemies
  const dealLevel = (pad) => {
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${COLS * ROWS}`);
    push(`${pad}  set dug[i] to 0`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${COLS}`);
    push(`${pad}  set dug[i] to 1`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    for (let r = SHAFT.r0; r <= SHAFT.r1; r++) push(`${pad}set dug[${r * COLS + SHAFT.col}] to 1`);
    for (const [c0, c1, r] of DEFS) {
      for (let c = c0; c <= c1; c++) push(`${pad}set dug[${r * COLS + c}] to 1`);
    }
    ROCKS.forEach(([c, r], i) => {
      push(`${pad}set ron[${i}] to 1`);
      push(`${pad}set rcc[${i}] to ${c}`);
      push(`${pad}set rcr[${i}] to ${r}`);
      push(`${pad}set rx[${i}] to ${X(c)}`);
      push(`${pad}set ry[${i}] to ${Y(r)}`);
      push(`${pad}set rst[${i}] to 0`);
      push(`${pad}set dug[${r * COLS + c}] to 0`);
    });
    push(`${pad}set ecount to min(${NE}, 3 + level)`);
    push(`${pad}set eleft to ecount`);
    push(`${pad}set rockdrops to 0`);
    push(`${pad}set prizeon to 0`);
  };

  const resetPositions = (pad) => {
    push(`${pad}set px to ${X(PSTART[0])}`);
    push(`${pad}set py to ${Y(PSTART[1])}`);
    push(`${pad}set pc to ${PSTART[0]}`);
    push(`${pad}set pr to ${PSTART[1]}`);
    push(`${pad}set pdir to 1`);
    push(`${pad}set want to 1`);
    push(`${pad}set hstate to 0`);
    push(`${pad}set hlen to 0`);
    push(`${pad}set hk to 0 - 1`);
    DEFS.forEach(([, , row, sc, tp], k) => {
      push(`${pad}set eon[${k}] to 0`);
      push(`${pad}if ${k} < ecount then`);
      push(`${pad}  set eon[${k}] to 1`);
      push(`${pad}end`);
      push(`${pad}set ex[${k}] to ${X(sc)}`);
      push(`${pad}set ey[${k}] to ${Y(row)}`);
      push(`${pad}set ec[${k}] to ${sc}`);
      push(`${pad}set er[${k}] to ${row}`);
      push(`${pad}set edir[${k}] to 0`);
      push(`${pad}set est[${k}] to 0`);
      push(`${pad}set einf[${k}] to 0`);
      push(`${pad}set egt[${k}] to ${300 + k * 160}`);
      push(`${pad}set eft[${k}] to ${120 + k * 60}`);
      push(`${pad}set efl[${k}] to 0`);
      push(`${pad}set ego[${k}] to 0`);
    });
    push(`${pad}set grace to 60`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set level to 1`);
    dealLevel(pad);
    resetPositions(pad);
    push(`${pad}set status.text to "DIG. PUMP. DROP ROCKS. THE DEEP STRATA PAY BEST."`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set level to 1");
  dealLevel("");
  resetPositions("");
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO DIG ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO DIG ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  push("  set pdie to 0");

  // ---- steering (buffered, like every maze we build)
  push(`  if keydown("d") == 1 or keydown("ArrowRight") == 1 or stickx(1) > 0.5 then`);
  push("    set want to 0");
  push("  end");
  push(`  if keydown("s") == 1 or keydown("ArrowDown") == 1 or sticky(1) > 0.5 then`);
  push("    set want to 1");
  push("  end");
  push(`  if keydown("a") == 1 or keydown("ArrowLeft") == 1 or stickx(1) < -0.5 then`);
  push("    set want to 2");
  push("  end");
  push(`  if keydown("w") == 1 or keydown("ArrowUp") == 1 or sticky(1) < -0.5 then`);
  push("    set want to 3");
  push("  end");
  push("  set anykey to 0");
  push(`  if keydown("d") + keydown("s") + keydown("a") + keydown("w") + keydown("ArrowRight") + keydown("ArrowDown") + keydown("ArrowLeft") + keydown("ArrowUp") + abs(stickx(1)) + abs(sticky(1)) > 0.5 then`);
  push("    set anykey to 1");
  push("  end");

  // ---- the pump
  push(`  set pk to keydown("Space")`);
  push("  if pk == 1 and hstate == 0 and pk0 == 0 then");
  push("    set hstate to 1");
  push("    set hlen to 6");
  push("    beep 740 for 0.04");
  push("  end");
  push("  if pk == 0 then");
  push("    if hstate == 2 then");
  push("      set hstate to 0");
  push("      set hk to 0 - 1");
  push("    end");
  push("    if hstate == 1 then");
  push("      set hstate to 0");
  push("    end");
  push("    set hlen to 0");
  push("  end");
  push("  set pk0 to pk");
  push("  set hdx to 0");
  push("  set hdy to 0");
  push("  if pdir == 0 then");
  push("    set hdx to 1");
  push("  end");
  push("  if pdir == 1 then");
  push("    set hdy to 1");
  push("  end");
  push("  if pdir == 2 then");
  push("    set hdx to -1");
  push("  end");
  push("  if pdir == 3 then");
  push("    set hdy to -1");
  push("  end");
  push("  if hstate == 1 then");
  push("    set hlen to min(56, hlen + 7)");
  push("    set htx to px + hdx * hlen");
  push("    set hty to py + hdy * hlen");
  push(`    set hc to floor((htx - ${X0}) / ${CS} + 0.5)`);
  push(`    set hr to floor((hty - ${Y0}) / ${CS} + 0.5)`);
  push(`    if hc < 0 or hc > ${COLS - 1} or hr < 0 or hr > ${ROWS - 1} then`);
  push("      set hstate to 0");
  push("    else");
  push(`      if dug[hr * ${COLS} + hc] == 0 then`);
  push("        set hstate to 0");
  push("      end");
  push("    end");
  for (let k = 0; k < NE; k++) {
    push(`    if hstate == 1 and eon[${k}] == 1 and est[${k}] == 0 and abs(htx - ex[${k}]) < 14 and abs(hty - ey[${k}]) < 14 then`);
    push("      set hstate to 2");
    push(`      set hk to ${k}`);
    push("      set pumptick to 0");
    push("      beep 523 for 0.05");
    push("    end");
    }
  push("    if hstate == 1 and hlen >= 56 then");
  push("      set hstate to 0");
  push("    end");
  push("  end");
  push("  if hstate == 2 then");
  push("    set pumptick to pumptick + 1");
  push("    if pumptick % 16 == 0 then");
  for (let k = 0; k < NE; k++) {
    push(`      if hk == ${k} then`);
    push(`        set einf[${k}] to einf[${k}] + 1`);
    push(`        set edec[${k}] to 0`);
    push("        beep 392 for 0.05");
    push(`        if einf[${k}] >= 4 then`);
    push(`          set eon[${k}] to 0`);
    push(`          explode burrower${k + 1}`);
    push("          set eleft to eleft - 1");
    push(`          set strat to ${stratum(1)}`);
    push(`          if er[${k}] > 4 then`);
    push("            set strat to 1");
    push("          end");
    push(`          if er[${k}] > 8 then`);
    push("            set strat to 2");
    push("          end");
    push(`          if er[${k}] > 11 then`);
    push("            set strat to 3");
    push("          end");
    push("          set pay to 200 + strat * 100");
    push(`          if ${DEFS[k][4]} == 1 then`);
    push("            set pay to pay + 100");
    push("          end");
    push("          change score by pay");
    push("          beep 659 for 0.08");
    push("          beep 988 for 0.1");
    push(`          set status.text to "POPPED — +" + pay`);
    push("          set hstate to 0");
    push("          set hk to 0 - 1");
    push("        end");
    push("      end");
  }
  push("    end");
  push("  end");

  // ---- the digger moves (unless rooted by the pump)
  push("  if hstate == 0 then");
  push(`    set ccx to ${X0} + pc * ${CS}`);
  push(`    set ccy to ${Y0} + pr * ${CS}`);
  push("    set pspd to 2.0");
  push("    if abs(px - ccx) < 1.1 and abs(py - ccy) < 1.1 then");
  push("      set px to ccx");
  push("      set py to ccy");
  // try the buffered turn, then the current direction
  for (const dv of ["want", "pdir"]) {
    push(`      set tc2 to pc`);
    push(`      set tr2 to pr`);
    push(`      if ${dv} == 0 then`);
    push("        set tc2 to tc2 + 1");
    push("      end");
    push(`      if ${dv} == 2 then`);
    push("        set tc2 to tc2 - 1");
    push("      end");
    push(`      if ${dv} == 1 then`);
    push("        set tr2 to tr2 + 1");
    push("      end");
    push(`      if ${dv} == 3 then`);
    push("        set tr2 to tr2 - 1");
    push("      end");
    push("      set okm to 1");
    push(`      if tc2 < 0 or tc2 > ${COLS - 1} or tr2 < 0 or tr2 > ${ROWS - 1} then`);
    push("        set okm to 0");
    push("      end");
    for (let i = 0; i < ROCKS.length; i++) {
      push(`      if ron[${i}] == 1 and rcc[${i}] == tc2 and rcr[${i}] == tr2 then`);
      push("        set okm to 0");
      push("      end");
    }
    if (dv === "want") {
      push("      set moved to 0");
      push("      if okm == 1 and anykey == 1 then");
      push("        set pdir to want");
      push("        set moved to 1");
      push("      end");
    } else {
      push("      if moved == 0 and okm == 1 and anykey == 1 then");
      push("        set moved to 1");
      push("      end");
      push("      if moved == 0 then");
      push("        set pspd to 0");
      push("      end");
    }
  }
  push("    else");
  // between centers: reverse is always allowed
  push("      if want == (pdir + 2) % 4 then");
  push("        set pdir to want");
  push("      end");
  push("      if anykey == 0 then");
  push("        set pspd to 0");
  push("      end");
  push("    end");
  // dig speed through dirt
  push(`    set fc to pc`);
  push(`    set fr to pr`);
  push("    if pdir == 0 then");
  push("      set fc to fc + 1");
  push("    end");
  push("    if pdir == 2 then");
  push("      set fc to fc - 1");
  push("    end");
  push("    if pdir == 1 then");
  push("      set fr to fr + 1");
  push("    end");
  push("    if pdir == 3 then");
  push("      set fr to fr - 1");
  push("    end");
  push(`    if fc >= 0 and fc <= ${COLS - 1} and fr >= 0 and fr <= ${ROWS - 1} then`);
  push(`      if dug[fr * ${COLS} + fc] == 0 then`);
  push("        set pspd to pspd * 0.62");
  push("      end");
  push("    end");
  push("    if pspd > 0 then");
  push("      if pdir == 0 then");
  push("        change px by pspd");
  push("      end");
  push("      if pdir == 2 then");
  push("        change px by 0 - pspd");
  push("      end");
  push("      if pdir == 1 then");
  push("        change py by pspd");
  push("      end");
  push("      if pdir == 3 then");
  push("        change py by 0 - pspd");
  push("      end");
  push("    end");
  push(`    set px to max(${X(0)}, min(${X(COLS - 1)}, px))`);
  push(`    set py to max(${Y(0)}, min(${Y(ROWS - 1)}, py))`);
  push(`    set pc to max(0, min(${COLS - 1}, floor((px - ${X0}) / ${CS} + 0.5)))`);
  push(`    set pr to max(0, min(${ROWS - 1}, floor((py - ${Y0}) / ${CS} + 0.5)))`);
  // carve the cell you stand in
  push(`    set idx to pr * ${COLS} + pc`);
  push("    if dug[idx] == 0 then");
  push("      set dug[idx] to 1");
  push("      change score by 10");
  push("    end");
  push("  end");

  // ---- the rocks
  for (let i = 0; i < ROCKS.length; i++) {
    push(`  if ron[${i}] == 1 then`);
    push(`    if rst[${i}] == 0 then`);
    push(`      if rcr[${i}] < ${ROWS - 1} then`);
    push(`        if dug[(rcr[${i}] + 1) * ${COLS} + rcc[${i}]] == 1 then`);
    push(`          set rst[${i}] to 1`);
    push(`          set rwob[${i}] to 45`);
    push("        end");
    push("      end");
    push("    end");
    push(`    if rst[${i}] == 1 then`);
    push(`      set rwob[${i}] to rwob[${i}] - 1`);
    push(`      if rwob[${i}] <= 0 then`);
    push(`        set rst[${i}] to 2`);
    push(`        set rfell[${i}] to 0`);
    push(`        set dug[rcr[${i}] * ${COLS} + rcc[${i}]] to 1`);
    push("        beep 196 for 0.06");
    push("      end");
    push("    end");
    push(`    if rst[${i}] == 2 then`);
    push(`      change ry[${i}] by 2.6`);
    push(`      set rfell[${i}] to 1`);
    // crushing
    push(`      if grace <= 0 and abs(rx[${i}] - px) < 14 and abs(ry[${i}] - py) < 14 then`);
    push("        set pdie to 1");
    push('        set status.text to "CRUSHED"');
    push("      end");
    for (let k = 0; k < NE; k++) {
      push(`      if eon[${k}] == 1 and abs(rx[${i}] - ex[${k}]) < 15 and abs(ry[${i}] - ey[${k}]) < 15 then`);
      push(`        set eon[${k}] to 0`);
      push(`        explode burrower${k + 1}`);
      push("        set eleft to eleft - 1");
      push("        change score by 1000");
      push("        beep 140 for 0.12");
      push('        set status.text to "UNDER THE ROCK — +1000"');
      push("      end");
    }
    // landing
    push(`      set rcr[${i}] to max(0, min(${ROWS - 1}, floor((ry[${i}] - ${Y0}) / ${CS} + 0.5)))`);
    push("      set landed to 0");
    push(`      if rcr[${i}] >= ${ROWS - 1} and ry[${i}] >= ${Y(ROWS - 1)} then`);
    push("        set landed to 1");
    push("      end");
    push(`      if landed == 0 and dug[(rcr[${i}] + 1) * ${COLS} + rcc[${i}]] == 0 then`);
    push(`        if ry[${i}] >= ${Y0} + rcr[${i}] * ${CS} then`);
    push("          set landed to 1");
    push("        end");
    push("      end");
    push("      if landed == 1 then");
    push(`        set ron[${i}] to 0`);
    push(`        explode rock${i + 1}`);
    push("        set rockdrops to rockdrops + 1");
    push("        beep 110 for 0.15");
    push("        if rockdrops == 2 and prizeon == 0 then");
    push("          set prizeon to 1");
    push("          set ptime to 500");
    push('          set status.text to "A PRIZE AT THE SURFACE — 1000"');
    push("          beep 784 for 0.1");
    push("        end");
    push("      end");
    push("    end");
    push("  end");
  }

  // ---- the prize
  push("  if prizeon == 1 then");
  push("    set ptime to ptime - 1");
  push("    if ptime <= 0 then");
  push("      set prizeon to 0");
  push("    end");
  push(`    if abs(px - ${X(PRIZECELL[0])}) < 14 and abs(py - ${Y(PRIZECELL[1])}) < 14 then`);
  push("      set prizeon to 0");
  push("      change score by 1000");
  push("      beep 659 for 0.06");
  push("      beep 988 for 0.1");
  push('      set status.text to "PRIZE +1000"');
  push("    end");
  push("  end");

  // ---- the burrowers
  push("  set espd to min(1.9, 1.05 + level * 0.1)");
  for (let k = 0; k < NE; k++) {
    const isWyrm = DEFS[k][4] === 1;
    push(`  if eon[${k}] == 1 then`);
    // inflated: frozen, deflating
    push(`    if einf[${k}] > 0 then`);
    push(`      set edec[${k}] to edec[${k}] + 1`);
    push(`      if edec[${k}] >= 40 then`);
    push(`        set edec[${k}] to 0`);
    push(`        set einf[${k}] to einf[${k}] - 1`);
    push("      end");
    push("    else");
    // ghost timer
    push(`    if est[${k}] == 0 then`);
    push(`      set egt[${k}] to egt[${k}] - 1`);
    push(`      if egt[${k}] <= 0 then`);
    push(`        set est[${k}] to 1`);
    push(`        set ego[${k}] to 0`);
    push("        beep 247 for 0.06");
    push("      end");
    push("    end");
    push(`    if est[${k}] == 1 then`);
    // drift through everything, straight at the digger
    push(`      set ego[${k}] to ego[${k}] + 1`);
    push(`      if px > ex[${k}] + 1 then`);
    push(`        change ex[${k}] by 0.75`);
    push("      end");
    push(`      if px < ex[${k}] - 1 then`);
    push(`        change ex[${k}] by -0.75`);
    push("      end");
    push(`      if py > ey[${k}] + 1 then`);
    push(`        change ey[${k}] by 0.75`);
    push("      end");
    push(`      if py < ey[${k}] - 1 then`);
    push(`        change ey[${k}] by -0.75`);
    push("      end");
    push(`      set ec[${k}] to max(0, min(${COLS - 1}, floor((ex[${k}] - ${X0}) / ${CS} + 0.5)))`);
    push(`      set er[${k}] to max(0, min(${ROWS - 1}, floor((ey[${k}] - ${Y0}) / ${CS} + 0.5)))`);
    push(`      if ego[${k}] > 70 and dug[er[${k}] * ${COLS} + ec[${k}]] == 1 then`);
    push(`        set est[${k}] to 0`);
    push(`        set ex[${k}] to ${X0} + ec[${k}] * ${CS}`);
    push(`        set ey[${k}] to ${Y0} + er[${k}] * ${CS}`);
    push(`        set egt[${k}] to max(240, 650 - level * 40) + ${k * 90}`);
    push("      end");
    push("    else");
    // tunnel hunting: 4-way chooser at centers, toward the digger
    push(`      set ecx to ${X0} + ec[${k}] * ${CS}`);
    push(`      set ecy to ${Y0} + er[${k}] * ${CS}`);
    push(`      if abs(ex[${k}] - ecx) < 1.1 and abs(ey[${k}] - ecy) < 1.1 then`);
    push(`        set ex[${k}] to ecx`);
    push(`        set ey[${k}] to ecy`);
    push("        set bestsc to 9999");
    push("        set bestd to 0 - 1");
    for (let d = 0; d < 4; d++) {
      push(`        if ${d} != (edir[${k}] + 2) % 4 then`);
      push(`          set tc2 to ec[${k}]`);
      push(`          set tr2 to er[${k}]`);
      if (d === 0) push("          set tc2 to tc2 + 1");
      if (d === 1) push("          set tr2 to tr2 + 1");
      if (d === 2) push("          set tc2 to tc2 - 1");
      if (d === 3) push("          set tr2 to tr2 - 1");
      push(`          if tc2 >= 0 and tc2 <= ${COLS - 1} and tr2 >= 0 and tr2 <= ${ROWS - 1} then`);
      push(`            if dug[tr2 * ${COLS} + tc2] == 1 then`);
      push("              set okc to 1");
      for (let i = 0; i < ROCKS.length; i++) {
        push(`              if ron[${i}] == 1 and rcc[${i}] == tc2 and rcr[${i}] == tr2 then`);
        push("                set okc to 0");
        push("              end");
      }
      push("              if okc == 1 then");
      push("                set dsc to abs(tc2 - pc) + abs(tr2 - pr)");
      push("                if dsc < bestsc then");
      push("                  set bestsc to dsc");
      push(`                  set bestd to ${d}`);
      push("                end");
      push("              end");
      push("            end");
      push("          end");
      push("        end");
    }
    push("        if bestd < 0 then");
    push(`          set bestd to (edir[${k}] + 2) % 4`);
    push("        end");
    push(`        set edir[${k}] to bestd`);
    push("      end");
    push(`      if edir[${k}] == 0 then`);
    push(`        change ex[${k}] by espd`);
    push("      end");
    push(`      if edir[${k}] == 2 then`);
    push(`        change ex[${k}] by 0 - espd`);
    push("      end");
    push(`      if edir[${k}] == 1 then`);
    push(`        change ey[${k}] by espd`);
    push("      end");
    push(`      if edir[${k}] == 3 then`);
    push(`        change ey[${k}] by 0 - espd`);
    push("      end");
    push(`      set ec[${k}] to max(0, min(${COLS - 1}, floor((ex[${k}] - ${X0}) / ${CS} + 0.5)))`);
    push(`      set er[${k}] to max(0, min(${ROWS - 1}, floor((ey[${k}] - ${Y0}) / ${CS} + 0.5)))`);
    if (isWyrm) {
      // the wyrm breathes fire down the row
      push(`      set eft[${k}] to eft[${k}] - 1`);
      push(`      if efl[${k}] == 0 and eft[${k}] <= 0 and abs(ey[${k}] - py) < 12 and abs(ex[${k}] - px) < ${CS * 4.5} then`);
      push(`        set efl[${k}] to 90`);
      push(`        set efd[${k}] to 1`);
      push(`        if px < ex[${k}] then`);
      push(`          set efd[${k}] to -1`);
      push("        end");
      push(`        set eft[${k}] to 300`);
      push("      end");
    }
    push("    end");
    push("    end");
    if (isWyrm) {
      push(`    if efl[${k}] > 0 then`);
      push(`      set efl[${k}] to efl[${k}] - 1`);
      push(`      if efl[${k}] < 55 and grace <= 0 then`);  // 35 ticks of charge, then flame
      push(`        if abs(ey[${k}] - py) < 13 and (px - ex[${k}]) * efd[${k}] > 6 and abs(px - ex[${k}]) < ${CS * 2 + 14} then`);
      push("          set pdie to 1");
      push('          set status.text to "BURNED IN THE TUNNEL"');
      push("        end");
      push("      end");
      push("    end");
    }
    // touch
    push(`    if eon[${k}] == 1 and einf[${k}] == 0 and grace <= 0 and abs(ex[${k}] - px) < 12 and abs(ey[${k}] - py) < 12 then`);
    push("      set pdie to 1");
    push('      set status.text to "CAUGHT IN THE DARK"');
    push("    end");
    push("  end");
  }

  // ---- level clear
  push("  if eleft <= 0 then");
  push("    change score by 500");
  push("    set level to level + 1");
  push("    beep 659 for 0.08");
  push("    beep 784 for 0.08");
  push("    beep 988 for 0.08");
  push("    beep 1319 for 0.15");
  dealLevel("    ");
  resetPositions("    ");
  push('    set status.text to "FIELD CLEAR +500 — LEVEL " + level + ", FASTER BURROWERS"');
  push("  end");

  // ---- a digger lost
  push("  if pdie == 1 and game == 0 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode digger");
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "BURIED — SCORE " + score + " — CLICK TO DIG AGAIN"');
  push("    else");
  resetPositions("      ");
  push('      set status.text to lives + " DIGGERS LEFT — THE TUNNELS REMAIN"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "DIGGERS " + lives');
  push('  set leveltx.text to "LEVEL " + level');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set leveltx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game != 9)";

  // the sky
  objects.push({
    id: "dd_sky", name: "skyline", type: "line",
    x: X0 - 12, y: Y(0) + 14, size: COLS * CS + 10, angle: 0, color: SKY, glow: 2, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  // the dirt: one box per cell below the sky, visible while undug
  for (let r = 1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      objects.push({
        id: "dd_d" + idx, name: "dirt" + idx, type: "box",
        x: X(c), y: Y(r), size: 24, color: STRATA[stratum(r)], glow: 1, visible: 1, text: "",
        script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and dug[${idx}] == 0)\nend` }]
      });
    }
  }
  // the rocks
  for (let i = 0; i < ROCKS.length; i++) {
    objects.push({
      id: "dd_r" + i, name: "rock" + (i + 1), type: "box",
      x: X(ROCKS[i][0]), y: Y(ROCKS[i][1]), size: 19, color: "#b0b8c4", glow: 4, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and ron[${i}] == 1)
set self.x to rx[${i}]
set self.y to ry[${i}]
if rst[${i}] == 1 then
  set self.x to rx[${i}] + sin(time() * 900) * 2
end
end` }]
    });
  }
  // the burrowers and the wyrms' fire
  for (let k = 0; k < NE; k++) {
    const tp = DEFS[k][4];
    objects.push({
      id: "dd_e" + k, name: "burrower" + (k + 1), type: "text",
      x: -50, y: -50, size: 15, color: ECOLOR[tp], glow: 9, visible: 0, text: EGLYPH[tp],
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and eon[${k}] == 1)
set self.x to ex[${k}]
set self.y to ey[${k}]
set self.size to 15 + einf[${k}] * 4
if est[${k}] == 1 then
  set self.color to "${GHOSTC}"
  set self.glow to 3
else
  set self.color to "${ECOLOR[tp]}"
  set self.glow to 9
end
end` }]
    });
    if (tp === 1) {
      objects.push({
        id: "dd_f" + k, name: "wyrmfire" + (k + 1), type: "text",
        x: -50, y: -50, size: 16, color: "#ff8c3a", glow: 12, visible: 0, text: "≈≈",
        script: [{
          event: "code", source: `when tick
set self.visible to (game == 0 and eon[${k}] == 1 and efl[${k}] > 0 and efl[${k}] < 55)
set self.x to ex[${k}] + efd[${k}] * ${CS + 8}
set self.y to ey[${k}]
set self.glow to 10 + sin(time() * 800) * 5
end` }]
      });
    }
  }
  // the pump line
  objects.push({
    id: "dd_h", name: "pumpline", type: "line",
    x: -50, y: -50, size: 10, angle: 0, color: WHITE, glow: 8, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and hstate >= 1)
set self.x to px
set self.y to py
set self.angle to pdir * 90
if hstate == 2 then
  set self.size to abs(ex[hk] - px) + abs(ey[hk] - py)
else
  set self.size to hlen
end
end` }]
  });
  // the prize
  objects.push({
    id: "dd_pz", name: "prize", type: "text",
    x: X(PRIZECELL[0]), y: Y(PRIZECELL[1]), size: 15, color: GOLD, glow: 12, visible: 0, text: "❖",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and prizeon == 1)
set self.glow to 10 + sin(time() * 400) * 5
end` }]
  });
  // the digger
  objects.push({
    id: "dd_p", name: "digger", type: "box",
    x: X(PSTART[0]), y: Y(PSTART[1]), size: 11, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and (grace <= 0 or grace % 8 < 4))
set self.x to px
set self.y to py
end` }]
  });

  // HUD
  objects.push({ id: "dd_sc", name: "scoretx", type: "text", x: 50, y: 24, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "dd_lv", name: "livestx", type: "text", x: 295, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "DIGGERS 3", script: [] });
  objects.push({ id: "dd_le", name: "leveltx", type: "text", x: 180, y: 22, size: 11, color: GOLD, glow: 5, visible: 0, text: "LEVEL 1", script: [] });
  objects.push({ id: "dd_st", name: "status", type: "text", x: 180, y: 468, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "dd_big", name: "bigtitle", type: "text", x: 180, y: 180, size: 38, color: "#ff8c5a", glow: 18, visible: 1, text: "DIG DUG", script: [] });
  objects.push({ id: "dd_sub", name: "subline", type: "text", x: 180, y: 212, size: 9, color: DIM, glow: 4, visible: 1, text: "NAMCO 1982 · THE DIGGING ARCADE MAINSTAY", script: [] });
  objects.push({ id: "dd_coin", name: "coinline", type: "text", x: 180, y: 242, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO DIG ◎", script: [] });
  objects.push({ id: "dd_play", name: "playbtn", type: "text", x: 180, y: 276, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ DIG ]", script: [] });
  objects.push({
    id: "dd_help", name: "help", type: "text",
    x: 180, y: 308, size: 8, color: DIM, glow: 3, visible: 1,
    text: "WASD DIGS · HOLD SPACE PUMPS · ROCKS FALL WHEN UNDERMINED",
    script: []
  });

  objects.push({
    id: "dd_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "dd_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "DIG", script: [] });

  return { title: "Dig Dug (1982)", w: 360, h: 480, objects };
}

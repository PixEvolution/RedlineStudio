// example-tron.js — TRON (1982), rebuilt in our studio.
//
// Bally Midway's movie tie-in famously OUTEARNED the film it was based on
// — and it did it by being four arcade games in one cabinet. The film and
// its world are Disney's; the four DUELS are arcade mechanics, and ours
// wear our own glyphs. One credit runs you through all four, then does it
// again, faster:
//
//   1 · LIGHT CYCLES — you and the enemy both leave solid walls. Turn,
//       cut them off, make them eat the trail. No reverse. 400 a cycle.
//   2 · BATTLE TANKS — a maze of walls, three hunters, and your shot
//       RICOCHETS once. Bank it around the corner. 500 a tank.
//   3 · THE TOWER — bugs swarm the tower from every edge. Hold them off
//       (100 a bug) until the window opens green, then get inside.
//   4 · THE CONE — a rotating wall of blocks descending on you. Shoot a
//       column clean (50 a block), ride the gap up through the moving
//       wall, and touch the core. 2000.
//
//   WASD / arrows / stick move · SPACE fires (stages 2-4) · 3 PROGRAMS

const W = 480, H = 360;
// -- light cycle grid
const CC = 38, CR = 24, GX0 = 22, GY0 = 56, GCS = 12;
const NCY = 4, NSEG = 18;                       // trail segments per cycle
// -- tanks
const TWALLS = [
  [100, 120, 110, 0], [270, 120, 110, 0], [100, 250, 110, 0],
  [270, 250, 110, 0], [240, 150, 80, 1], [120, 170, 60, 1],
];
// -- cone
const BR = 4, BC = 14;
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", ORANGE = "#ff9d4a", MAGENTA = "#ff6ad5", STEEL = "#8b95a8";
const CYCOL = [CYAN, ORANGE, RED, GREEN];

export function buildTronExample() {
  const L = [];
  const push = (s) => L.push(s);

  // point-vs-wall for the tank maze → hitw, hitv (orientation of what you hit)
  const wallTouch = (pad, xv, yv) => {
    push(`${pad}set hitw to 0`);
    push(`${pad}set hitv to 0`);
    push(`${pad}if ${yv} < 54 or ${yv} > 334 then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}  set hitv to 0`);
    push(`${pad}end`);
    push(`${pad}if ${xv} < 22 or ${xv} > 458 then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}  set hitv to 1`);
    push(`${pad}end`);
    TWALLS.forEach(([wx, wy, wl, wv], i) => {
      if (wv === 0) {
        push(`${pad}if abs(${yv} - ${wy}) < 7 and ${xv} > ${wx - 4} and ${xv} < ${wx + wl + 4} then`);
        push(`${pad}  set hitw to 1`);
        push(`${pad}  set hitv to 0`);
        push(`${pad}end`);
      } else {
        push(`${pad}if abs(${xv} - ${wx}) < 7 and ${yv} > ${wy - 4} and ${yv} < ${wy + wl + 4} then`);
        push(`${pad}  set hitw to 1`);
        push(`${pad}  set hitv to 1`);
        push(`${pad}end`);
      }
    });
  };

  // start a fresh trail segment for cycle k at its current head
  const newSeg = (pad, k) => {
    push(`${pad}set slot to ${k * NSEG} + nt[${k}] % ${NSEG}`);
    push(`${pad}set nt[${k}] to nt[${k}] + 1`);
    push(`${pad}set cs[${k}] to slot`);
    push(`${pad}set tlon[slot] to 1`);
    push(`${pad}set tlx[slot] to ${GX0} + ccx[${k}] * ${GCS}`);
    push(`${pad}set tly[slot] to ${GY0} + ccy[${k}] * ${GCS}`);
    push(`${pad}set tla[slot] to cdir[${k}] * 90`);
    push(`${pad}set tll[slot] to 2`);
  };

  const dealStage = (pad) => {
    for (let s = 0; s < 2; s++) push(`${pad}set son[${s}] to 0`);
    for (let s = 0; s < 3; s++) push(`${pad}set eson[${s}] to 0`);
    push(`${pad}set grace to 60`);
    // ---- stage 1: light cycles
    push(`${pad}if stg == 1 then`);
    push(`${pad}  set i to 0`);
    push(`${pad}  repeat ${CC * CR}`);
    push(`${pad}    set trail[i] to 0`);
    push(`${pad}    set i to i + 1`);
    push(`${pad}  end`);
    push(`${pad}  set i to 0`);
    push(`${pad}  repeat ${NCY * NSEG}`);
    push(`${pad}    set tlon[i] to 0`);
    push(`${pad}    set i to i + 1`);
    push(`${pad}  end`);
    push(`${pad}  set nai to min(3, level)`);
    const starts = [[5, 12, 0], [32, 6, 2], [32, 18, 2], [19, 21, 3]];
    starts.forEach(([c, r, d], k) => {
      push(`${pad}  set calive[${k}] to ${k === 0 ? 1 : 0}`);
      if (k > 0) {
        push(`${pad}  if ${k} <= nai then`);
        push(`${pad}    set calive[${k}] to 1`);
        push(`${pad}  end`);
      }
      push(`${pad}  set ccx[${k}] to ${c}`);
      push(`${pad}  set ccy[${k}] to ${r}`);
      push(`${pad}  set cdir[${k}] to ${d}`);
      push(`${pad}  set nt[${k}] to 0`);
      newSeg(pad + "  ", k);
    });
    push(`${pad}  set want to 0`);
    push(`${pad}  set cad to max(3, 5 - floor(level / 2))`);
    push(`${pad}  set status.text to "LIGHT CYCLES — THE WALLS ARE FOREVER. NO REVERSE."`);
    push(`${pad}end`);
    // ---- stage 2: battle tanks
    push(`${pad}if stg == 2 then`);
    push(`${pad}  set px to 60`);
    push(`${pad}  set py to 300`);
    push(`${pad}  set fdir to 3`);
    const tst = [[420, 90], [420, 300], [240, 90]];
    tst.forEach(([x, y], k) => {
      push(`${pad}  set ton[${k}] to 1`);
      push(`${pad}  set tx[${k}] to ${x}`);
      push(`${pad}  set ty[${k}] to ${y}`);
      push(`${pad}  set tcool[${k}] to ${120 + k * 50}`);
    });
    push(`${pad}  set status.text to "BATTLE TANKS — YOUR SHOT BANKS OFF A WALL, ONCE"`);
    push(`${pad}end`);
    // ---- stage 3: the tower
    push(`${pad}if stg == 3 then`);
    push(`${pad}  set px to 240`);
    push(`${pad}  set py to 280`);
    push(`${pad}  set fdx to 0`);
    push(`${pad}  set fdy to -1`);
    push(`${pad}  set integ to 6`);
    push(`${pad}  set ttm to 720`);
    push(`${pad}  set bspawn to 30`);
    for (let b = 0; b < 8; b++) push(`${pad}  set bgon[${b}] to 0`);
    push(`${pad}  set status.text to "THE TOWER — HOLD OFF THE BUGS TILL IT OPENS"`);
    push(`${pad}end`);
    // ---- stage 4: the cone
    push(`${pad}if stg == 4 then`);
    push(`${pad}  set px to 240`);
    push(`${pad}  set py to 320`);
    push(`${pad}  set i to 0`);
    push(`${pad}  repeat ${BR * BC}`);
    push(`${pad}    set con2[i] to 1`);
    push(`${pad}    set i to i + 1`);
    push(`${pad}  end`);
    push(`${pad}  set bofs to 0`);
    push(`${pad}  set bdy to 0`);
    push(`${pad}  set status.text to "THE CONE — CUT A COLUMN, RIDE THE GAP IN"`);
    push(`${pad}end`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set level to 1`);
    push(`${pad}set stg to 1`);
    push(`${pad}set tik to 0`);
    dealStage(pad);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set level to 1");
  push("set stg to 1");
  push("set tik to 0");
  dealStage("");
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
  push("set help2.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO ENTER ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO ENTER ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  push("  set pdie to 0");
  push("  set stgdone to 0");

  // ---- shared input
  push(`  set mvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  set mvy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push("  set ix2 to 0");
  push("  if mvx > 0.35 then");
  push("    set ix2 to 1");
  push("  end");
  push("  if mvx < -0.35 then");
  push("    set ix2 to -1");
  push("  end");
  push("  set iy2 to 0");
  push("  if mvy > 0.35 then");
  push("    set iy2 to 1");
  push("  end");
  push("  if mvy < -0.35 then");
  push("    set iy2 to -1");
  push("  end");
  push(`  set fk to keydown("Space")`);

  // ============ STAGE 1: LIGHT CYCLES ============
  push("  if stg == 1 then");
  // buffered turn (dirs: 0 right, 1 down, 2 left, 3 up — no reverse)
  push("    if ix2 == 1 and cdir[0] != 2 then");
  push("      set want to 0");
  push("    end");
  push("    if iy2 == 1 and cdir[0] != 3 then");
  push("      set want to 1");
  push("    end");
  push("    if ix2 == -1 and cdir[0] != 0 then");
  push("      set want to 2");
  push("    end");
  push("    if iy2 == -1 and cdir[0] != 1 then");
  push("      set want to 3");
  push("    end");
  push("    if ix2 == 0 and iy2 == 0 then");
  push("      set want to cdir[0]");
  push("    end");
  push("    if tik % cad == 0 then");
  // the player turns at the step
  push("      if want != cdir[0] and want != (cdir[0] + 2) % 4 then");
  push("        set cdir[0] to want");
  newSeg("        ", 0);
  push("      end");
  for (let k = 0; k < NCY; k++) {
    push(`      if calive[${k}] == 1 then`);
    if (k > 0) {
      // the AI reads the road ahead
      push(`        set nc to ccx[${k}]`);
      push(`        set nr to ccy[${k}]`);
      push(`        if cdir[${k}] == 0 then`);
      push("          set nc to nc + 1");
      push("        end");
      push(`        if cdir[${k}] == 2 then`);
      push("          set nc to nc - 1");
      push("        end");
      push(`        if cdir[${k}] == 1 then`);
      push("          set nr to nr + 1");
      push("        end");
      push(`        if cdir[${k}] == 3 then`);
      push("          set nr to nr - 1");
      push("        end");
      push("        set blocked to 0");
      push(`        if nc < 0 or nc > ${CC - 1} or nr < 0 or nr > ${CR - 1} then`);
      push("          set blocked to 1");
      push("        else");
      push(`          if trail[nr * ${CC} + nc] != 0 then`);
      push("            set blocked to 1");
      push("          end");
      push("        end");
      push("        if blocked == 1 or rand(0, 1) < 0.035 then");
      // try the two sides, prefer an open one
      push(`          set d1 to (cdir[${k}] + 1) % 4`);
      push(`          set d2 to (cdir[${k}] + 3) % 4`);
      push("          if rand(0, 1) < 0.5 then");
      push(`            set d1 to (cdir[${k}] + 3) % 4`);
      push(`            set d2 to (cdir[${k}] + 1) % 4`);
      push("          end");
      push("          set turned to 0");
      for (const dv of ["d1", "d2"]) {
        push(`          if turned == 0 then`);
        push(`            set nc to ccx[${k}]`);
        push(`            set nr to ccy[${k}]`);
        push(`            if ${dv} == 0 then`);
        push("              set nc to nc + 1");
        push("            end");
        push(`            if ${dv} == 2 then`);
        push("              set nc to nc - 1");
        push("            end");
        push(`            if ${dv} == 1 then`);
        push("              set nr to nr + 1");
        push("            end");
        push(`            if ${dv} == 3 then`);
        push("              set nr to nr - 1");
        push("            end");
        push(`            if nc >= 0 and nc <= ${CC - 1} and nr >= 0 and nr <= ${CR - 1} then`);
        push(`              if trail[nr * ${CC} + nc] == 0 then`);
        push("                set turned to 1");
        push(`                set cdir[${k}] to ${dv}`);
        newSeg("                ", k);
        push("              end");
        push("            end");
        push("          end");
      }
      // blocked and no side open: it rides into the wall
      push("        end");
    }
    // the step: lay wall, advance, judge
    push(`        set trail[ccy[${k}] * ${CC} + ccx[${k}]] to ${k + 1}`);
    push(`        if cdir[${k}] == 0 then`);
    push(`          set ccx[${k}] to ccx[${k}] + 1`);
    push("        end");
    push(`        if cdir[${k}] == 2 then`);
    push(`          set ccx[${k}] to ccx[${k}] - 1`);
    push("        end");
    push(`        if cdir[${k}] == 1 then`);
    push(`          set ccy[${k}] to ccy[${k}] + 1`);
    push("        end");
    push(`        if cdir[${k}] == 3 then`);
    push(`          set ccy[${k}] to ccy[${k}] - 1`);
    push("        end");
    push("        set crashed to 0");
    push(`        if ccx[${k}] < 0 or ccx[${k}] > ${CC - 1} or ccy[${k}] < 0 or ccy[${k}] > ${CR - 1} then`);
    push("          set crashed to 1");
    push("        else");
    push(`          if trail[ccy[${k}] * ${CC} + ccx[${k}]] != 0 then`);
    push("            set crashed to 1");
    push("          end");
    push("        end");
    push("        if crashed == 1 then");
    push(`          set calive[${k}] to 0`);
    push(`          explode cycle${k + 1}`);
    push("          beep 140 for 0.12");
    if (k === 0) {
      push("          set pdie to 1");
      push('          set status.text to "DERESOLVED INTO A WALL"');
    } else {
      push("          change score by 400");
    }
    push("        end");
    push("      end");
  }
  push("    end");
  // extend the live trail segments to the heads
  for (let k = 0; k < NCY; k++) {
    push(`    if calive[${k}] == 1 then`);
    push(`      set hx to ${GX0} + ccx[${k}] * ${GCS}`);
    push(`      set hy to ${GY0} + ccy[${k}] * ${GCS}`);
    push(`      set tll[cs[${k}]] to abs(hx - tlx[cs[${k}]]) + abs(hy - tly[cs[${k}]]) + 2`);
    push("    end");
  }
  push("    set aialive to 0");
  for (let k = 1; k < NCY; k++) push(`    set aialive to aialive + calive[${k}]`);
  push("    if aialive <= 0 and pdie == 0 then");
  push("      set stgdone to 1");
  push('      set status.text to "THE GRID IS YOURS — NEXT: BATTLE TANKS"');
  push("    end");
  push("  end");

  // ============ STAGE 2: BATTLE TANKS ============
  push("  if stg == 2 then");
  push("    if ix2 != 0 then");
  push("      set fdir to 1 - ix2");          // 0 right, 2 left
  push("    end");
  push("    if iy2 != 0 and ix2 == 0 then");
  push("      set fdir to 2 - iy2");          // 1 down, 3 up
  push("    end");
  push("    set oldx to px");
  push("    set oldy to py");
  push("    change px by ix2 * 1.9");
  wallTouch("    ", "px", "oldy");
  push("    if hitw == 1 then");
  push("      set px to oldx");
  push("    end");
  push("    change py by iy2 * 1.9");
  wallTouch("    ", "px", "py");
  push("    if hitw == 1 then");
  push("      set py to oldy");
  push("    end");
  // your cannon: one shell, one bank
  push("    if fk == 1 and fk0 == 0 and son[0] == 0 then");
  push("      set son[0] to 1");
  push("      set sb to 0");
  push("      set sx2 to px");
  push("      set sy2 to py");
  push("      set svx to 0");
  push("      set svy to 0");
  push("      if fdir == 0 then");
  push("        set svx to 5");
  push("      end");
  push("      if fdir == 2 then");
  push("        set svx to -5");
  push("      end");
  push("      if fdir == 1 then");
  push("        set svy to 5");
  push("      end");
  push("      if fdir == 3 then");
  push("        set svy to -5");
  push("      end");
  push("      beep 740 for 0.04");
  push("    end");
  push("    if son[0] == 1 then");
  push("      change sx2 by svx");
  push("      change sy2 by svy");
  wallTouch("      ", "sx2", "sy2");
  push("      if hitw == 1 then");
  push("        if sb == 0 then");
  push("          set sb to 1");
  push("          if hitv == 1 then");
  push("            set svx to 0 - svx");
  push("          else");
  push("            set svy to 0 - svy");
  push("          end");
  push("          change sx2 by svx * 2");
  push("          change sy2 by svy * 2");
  push("          beep 330 for 0.04");
  push("        else");
  push("          set son[0] to 0");
  push("        end");
  push("      end");
  push("    end");
  // the hunters
  push("    set tleft to 0");
  for (let k = 0; k < 3; k++) {
    push(`    if ton[${k}] == 1 then`);
    push("      set tleft to tleft + 1");
    push(`      set ddx to px - tx[${k}]`);
    push(`      set ddy to py - ty[${k}]`);
    push(`      set ogx to tx[${k}]`);
    push(`      set ogy to ty[${k}]`);
    push("      if abs(ddx) > abs(ddy) then");
    push(`        change tx[${k}] by max(-1, min(1, ddx)) * 0.85`);
    push("      else");
    push(`        change ty[${k}] by max(-1, min(1, ddy)) * 0.85`);
    push("      end");
    wallTouch("      ", `tx[${k}]`, `ty[${k}]`);
    push("      if hitw == 1 then");
    push(`        set tx[${k}] to ogx`);
    push(`        set ty[${k}] to ogy`);
    push("        if abs(ddx) > abs(ddy) then");
    push(`          change ty[${k}] by max(-1, min(1, ddy)) * 0.85`);
    push("        else");
    push(`          change tx[${k}] by max(-1, min(1, ddx)) * 0.85`);
    push("        end");
    push("      end");
    push(`      set tcool[${k}] to tcool[${k}] - 1`);
    push(`      if tcool[${k}] <= 0 and (abs(ddx) < 12 or abs(ddy) < 12) then`);
    push(`        set tcool[${k}] to max(90, 160 - level * 12)`);
    for (let s = 0; s < 3; s++) {
      push(`        if eson[${s}] == 0 and tcool[${k}] > 0 then`);
      push(`          set eson[${s}] to 1`);
      push(`          set esx[${s}] to tx[${k}]`);
      push(`          set esy[${s}] to ty[${k}]`);
      push(`          set esvx[${s}] to max(-1, min(1, ddx)) * 4`);
      push(`          set esvy[${s}] to max(-1, min(1, ddy)) * 4`);
      push("          if abs(ddx) < 12 then");
      push(`            set esvx[${s}] to 0`);
      push("          else");
      push(`            set esvy[${s}] to 0`);
      push("          end");
      push(`          set tcool[${k}] to 0 - tcool[${k}]`);
      push("          beep 620 for 0.04");
      push("        end");
    }
    push(`        set tcool[${k}] to abs(tcool[${k}])`);
    push("      end");
    push(`      if son[0] == 1 and abs(sx2 - tx[${k}]) < 13 and abs(sy2 - ty[${k}]) < 13 then`);
    push("        set son[0] to 0");
    push(`        set ton[${k}] to 0`);
    push(`        explode tank${k + 1}`);
    push("        change score by 500");
    push("        beep 140 for 0.1");
    push("      end");
    push(`      if ton[${k}] == 1 and grace <= 0 and abs(tx[${k}] - px) < 13 and abs(ty[${k}] - py) < 13 then`);
    push("        set pdie to 1");
    push("      end");
    push("    end");
  }
  for (let s = 0; s < 3; s++) {
    push(`    if eson[${s}] == 1 then`);
    push(`      change esx[${s}] by esvx[${s}]`);
    push(`      change esy[${s}] by esvy[${s}]`);
    wallTouch("      ", `esx[${s}]`, `esy[${s}]`);
    push("      if hitw == 1 then");
    push(`        set eson[${s}] to 0`);
    push("      end");
    push(`      if eson[${s}] == 1 and grace <= 0 and abs(esx[${s}] - px) < 10 and abs(esy[${s}] - py) < 10 then`);
    push(`        set eson[${s}] to 0`);
    push("        set pdie to 1");
    push("      end");
    push("    end");
  }
  push("    if tleft <= 0 and pdie == 0 then");
  push("      set stgdone to 1");
  push('      set status.text to "TANKS DOWN — NEXT: THE TOWER"');
  push("    end");
  push("  end");

  // ============ STAGE 3: THE TOWER ============
  push("  if stg == 3 then");
  push("    change px by ix2 * 2.4");
  push("    change py by iy2 * 2.4");
  push("    set px to max(26, min(454, px))");
  push("    set py to max(58, min(330, py))");
  push("    if ix2 != 0 or iy2 != 0 then");
  push("      set fdx to ix2");
  push("      set fdy to iy2");
  push("    end");
  push("    if fk == 1 and fk0 == 0 and son[0] == 0 then");
  push("      set son[0] to 1");
  push("      set sx2 to px");
  push("      set sy2 to py");
  push("      set svx to fdx * 6");
  push("      set svy to fdy * 6");
  push("      beep 760 for 0.03");
  push("    end");
  push("    if son[0] == 1 then");
  push("      change sx2 by svx");
  push("      change sy2 by svy");
  push("      if sx2 < 20 or sx2 > 460 or sy2 < 50 or sy2 > 340 then");
  push("        set son[0] to 0");
  push("      end");
  push("    end");
  push("    set bspawn to bspawn - 1");
  push("    if bspawn <= 0 then");
  push("      set bspawn to max(22, 45 - level * 4)");
  for (let b = 0; b < 8; b++) {
    push(`      if bspawn > 1 and bgon[${b}] == 0 then`);
    push(`        set bgon[${b}] to 1`);
    push("        set edge to floor(rand(0, 3))");
    push("        if edge == 0 then");
    push(`          set bgx[${b}] to 30`);
    push(`          set bgy[${b}] to rand(70, 320)`);
    push("        end");
    push("        if edge == 1 then");
    push(`          set bgx[${b}] to 450`);
    push(`          set bgy[${b}] to rand(70, 320)`);
    push("        end");
    push("        if edge == 2 then");
    push(`          set bgx[${b}] to rand(50, 430)`);
    push(`          set bgy[${b}] to 328`);
    push("        end");
    push("        set bspawn to 1");
    push("      end");
  }
  push("    end");
  for (let b = 0; b < 8; b++) {
    push(`    if bgon[${b}] == 1 then`);
    push(`      set bgs to 0.85 + level * 0.08`);
    push(`      if bgx[${b}] > 240 then`);
    push(`        change bgx[${b}] by 0 - bgs`);
    push("      else");
    push(`        change bgx[${b}] by bgs`);
    push("      end");
    push(`      if bgy[${b}] > 90 then`);
    push(`        change bgy[${b}] by 0 - bgs * 0.8`);
    push("      end");
    push(`      if abs(bgx[${b}] - 240) < 14 and abs(bgy[${b}] - 90) < 14 then`);
    push(`        set bgon[${b}] to 0`);
    push("        set integ to integ - 1");
    push("        beep 196 for 0.1");
    push('        set status.text to "THEY ARE CHEWING THE TOWER — " + integ + " LEFT"');
    push("        if integ <= 0 then");
    push("          set pdie to 1");
    push('          set status.text to "THE TOWER FELL"');
    push("        end");
    push("      end");
    push(`      if son[0] == 1 and abs(sx2 - bgx[${b}]) < 11 and abs(sy2 - bgy[${b}]) < 11 then`);
    push("        set son[0] to 0");
    push(`        set bgon[${b}] to 0`);
    push("        change score by 100");
    push("        beep 140 for 0.05");
    push("      end");
    push(`      if bgon[${b}] == 1 and grace <= 0 and abs(bgx[${b}] - px) < 11 and abs(bgy[${b}] - py) < 11 then`);
    push("        set pdie to 1");
    push('        set status.text to "BUGBITTEN"');
    push("      end");
    push("    end");
  }
  push("    if ttm > 0 then");
  push("      set ttm to ttm - 1");
  push("    else");
  push("      if abs(px - 240) < 16 and abs(py - 90) < 16 and pdie == 0 then");
  push("        set stgdone to 1");
  push("        change score by 1000 + integ * 100");
  push('        set status.text to "INSIDE — +" + (1000 + integ * 100) + " — NEXT: THE CONE"');
  push("      end");
  push("    end");
  push("  end");

  // ============ STAGE 4: THE CONE ============
  push("  if stg == 4 then");
  push("    change px by ix2 * 2.4");
  push("    change py by iy2 * 2.2");
  push("    set px to max(30, min(450, px))");
  push("    set py to max(70, min(334, py))");
  push(`    set bofs to bofs + 0.45 + level * 0.06`);
  push(`    set bdy to bdy + 0.085 + level * 0.012`);
  push("    if fk == 1 and fk0 == 0 and son[0] == 0 then");
  push("      set son[0] to 1");
  push("      set sx2 to px");
  push("      set sy2 to py - 8");
  push("      set svx to 0");
  push("      set svy to -5.5");
  push("      beep 760 for 0.03");
  push("    end");
  push("    if son[0] == 1 then");
  push("      change sy2 by svy");
  push("      if sy2 < 60 then");
  push("        set son[0] to 0");
  push("      end");
  push("    end");
  push("    set i to 0");
  push(`    repeat ${BR * BC}`);
  push("      if con2[i] == 1 then");
  push(`        set bcx to 48 + (floor(i % ${BC}) * 27 + bofs) % 378`);
  push(`        set bcy to 96 + floor(i / ${BC}) * 20 + bdy`);
  push("        if son[0] == 1 and abs(sx2 - bcx) < 13 and abs(sy2 - bcy) < 10 then");
  push("          set son[0] to 0");
  push("          set con2[i] to 0");
  push("          change score by 50");
  push("          beep 523 for 0.03");
  push("        end");
  push("        if grace <= 0 and abs(px - bcx) < 13 and abs(py - bcy) < 10 then");
  push("          set pdie to 1");
  push('          set status.text to "INTO THE WALL OF THE CONE"');
  push("        end");
  push("      end");
  push("      set i to i + 1");
  push("    end");
  push("    if 96 + 60 + bdy > 330 then");
  push("      set pdie to 1");
  push('      set status.text to "THE CONE CAME DOWN ON YOU"');
  push("    end");
  push("    if py < 88 and pdie == 0 then");
  push("      set stgdone to 1");
  push("      change score by 2000");
  push('      say "THE CORE IS YOURS." for 1.3');
  push('      set status.text to "THE CORE — +2000 — THE GRID REBUILDS, FASTER"');
  push("      beep 523 for 0.1");
  push("      beep 659 for 0.1");
  push("      beep 784 for 0.1");
  push("      beep 1047 for 0.2");
  push("    end");
  push("  end");
  push("  set fk0 to fk");

  // ---- stage flow
  push("  if stgdone == 1 and game == 0 then");
  push("    beep 659 for 0.08");
  push("    beep 988 for 0.1");
  push("    set stg to stg + 1");
  push("    if stg > 4 then");
  push("      set stg to 1");
  push("      set level to level + 1");
  push("    end");
  dealStage("    ");
  push("  end");

  // ---- a program lost
  push("  if pdie == 1 and game == 0 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode program");
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "THE GRID WINS — SCORE " + score + " — CLICK TO ENTER AGAIN"');
  push("    else");
  dealStage("      ");
  push('      set status.text to lives + " PROGRAMS LEFT — THE DUEL RESTARTS"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "PROGRAMS " + lives');
  push('  set leveltx.text to "ROUND " + level');
  push("  if stg == 1 then");
  push('    set stagetx.text to "LIGHT CYCLES"');
  push("  end");
  push("  if stg == 2 then");
  push('    set stagetx.text to "BATTLE TANKS"');
  push("  end");
  push("  if stg == 3 then");
  push("    if ttm > 0 then");
  push('      set stagetx.text to "THE TOWER · " + floor(ttm / 60) + "s"');
  push("    else");
  push('      set stagetx.text to "THE TOWER · OPEN"');
  push("    end");
  push("  end");
  push("  if stg == 4 then");
  push('    set stagetx.text to "THE CONE"');
  push("  end");
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set leveltx.visible to (game != 9)");
  push("set stagetx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // the arena frame
  const borders = [
    ["gridT", 22, 52, 436, 0], ["gridB", 22, 336, 436, 0],
    ["gridL", 22, 52, 284, 1], ["gridR", 458, 52, 284, 1],
  ];
  borders.forEach(([name, x, y, len, vert], i) => {
    objects.push({
      id: "tr_b" + i, name, type: "line",
      x, y, size: len, angle: vert ? 90 : 0, color: CYAN, glow: 4, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nset self.glow to 3 + sin(time() * 200 + ${i * 80}) * 2\nend` }]
    });
  });

  // light-cycle trails and heads
  for (let k = 0; k < NCY; k++) {
    for (let s = 0; s < NSEG; s++) {
      const slot = k * NSEG + s;
      objects.push({
        id: "tr_t" + slot, name: "trail" + (slot + 1), type: "line",
        x: -90, y: -90, size: 2, angle: 0, color: CYCOL[k], glow: 4, visible: 0, text: "",
        script: [{
          event: "code", source: `when tick
set self.visible to (${inGame} and stg == 1 and tlon[${slot}] == 1)
set self.x to tlx[${slot}]
set self.y to tly[${slot}]
set self.angle to tla[${slot}]
set self.size to tll[${slot}]
end` }]
      });
    }
  }
  for (let k = 1; k < NCY; k++) {
    objects.push({
      id: "tr_c" + k, name: "cycle" + (k + 1), type: "dot",
      x: -90, y: -90, size: 5, color: CYCOL[k], glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and stg == 1 and calive[${k}] == 1)
set self.x to ${GX0} + ccx[${k}] * ${GCS}
set self.y to ${GY0} + ccy[${k}] * ${GCS}
end` }]
    });
  }
  // (your cycle head is the program itself, below)

  // tank maze walls
  TWALLS.forEach(([wx, wy, wl, wv], i) => {
    objects.push({
      id: "tr_w" + i, name: "mazewall" + (i + 1), type: "line",
      x: wx, y: wy, size: wl, angle: wv ? 90 : 0, color: STEEL, glow: 3, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and stg == 2)\nend` }]
    });
  });
  for (let k = 0; k < 3; k++) {
    objects.push({
      id: "tr_tk" + k, name: "tank" + (k + 1), type: "box",
      x: -90, y: -90, size: 14, color: RED, glow: 8, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and stg == 2 and ton[${k}] == 1)
set self.x to tx[${k}]
set self.y to ty[${k}]
end` }]
    });
  }
  // shells
  objects.push({
    id: "tr_s0", name: "yourshell", type: "dot",
    x: -90, y: -90, size: 3, color: CYAN, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and stg != 1 and son[0] == 1)
set self.x to sx2
set self.y to sy2
end` }]
  });
  for (let s = 0; s < 3; s++) {
    objects.push({
      id: "tr_es" + s, name: "theirshell" + (s + 1), type: "dot",
      x: -90, y: -90, size: 3, color: RED, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and stg == 2 and eson[${s}] == 1)
set self.x to esx[${s}]
set self.y to esy[${s}]
end` }]
    });
  }

  // the tower and its bugs
  objects.push({
    id: "tr_tw", name: "tower", type: "ring",
    x: 240, y: 90, size: 16, color: GOLD, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and stg == 3)
if ttm <= 0 then
  set self.color to "${GREEN}"
  set self.glow to 12 + sin(time() * 400) * 5
else
  set self.color to "${GOLD}"
  set self.glow to 6 + integ
end
end` }]
  });
  for (let b = 0; b < 8; b++) {
    objects.push({
      id: "tr_bg" + b, name: "gridbug" + (b + 1), type: "text",
      x: -90, y: -90, size: 13, color: ORANGE, glow: 8, visible: 0, text: "✕",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and stg == 3 and bgon[${b}] == 1)
set self.x to bgx[${b}]
set self.y to bgy[${b}]
set self.angle to time() * ${40 + b * 9}
end` }]
    });
  }

  // the cone's wall and core
  for (let i = 0; i < BR * BC; i++) {
    objects.push({
      id: "tr_bl" + i, name: "coneblock" + (i + 1), type: "box",
      x: -90, y: -90, size: 16, color: MAGENTA, glow: 4, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and stg == 4 and con2[${i}] == 1)
set self.x to 48 + (${i % BC} * 27 + bofs) % 378
set self.y to 96 + ${Math.floor(i / BC)} * 20 + bdy
end` }]
    });
  }
  objects.push({
    id: "tr_core", name: "thecore", type: "line",
    x: 22, y: 74, size: 436, angle: 0, color: GREEN, glow: 8, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and stg == 4)
set self.glow to 6 + sin(time() * 300) * 4
end` }]
  });

  // the program (you) — cycle head, tank, runner, flier
  objects.push({
    id: "tr_p", name: "program", type: "tri",
    x: -90, y: -90, size: 10, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4) and (stg != 1 or calive[0] == 1))
if stg == 1 then
  set self.x to ${GX0} + ccx[0] * ${GCS}
  set self.y to ${GY0} + ccy[0] * ${GCS}
  set self.angle to cdir[0] * 90
else
  set self.x to px
  set self.y to py
  if stg == 2 then
    set self.angle to fdir * 90
  else
    set self.angle to 270
  end
end
end` }]
  });

  // HUD
  objects.push({ id: "tr_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "tr_sg", name: "stagetx", type: "text", x: 200, y: 22, size: 12, color: CYAN, glow: 6, visible: 0, text: "LIGHT CYCLES", script: [] });
  objects.push({ id: "tr_le", name: "leveltx", type: "text", x: 330, y: 22, size: 11, color: GOLD, glow: 5, visible: 0, text: "ROUND 1", script: [] });
  objects.push({ id: "tr_lv", name: "livestx", type: "text", x: 420, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "PROGRAMS 3", script: [] });
  objects.push({ id: "tr_st", name: "status", type: "text", x: W / 2, y: 352, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "tr_big", name: "bigtitle", type: "text", x: W / 2, y: 100, size: 44, color: CYAN, glow: 20, visible: 1, text: "TRON", script: [] });
  objects.push({ id: "tr_sub", name: "subline", type: "text", x: W / 2, y: 134, size: 10, color: DIM, glow: 4, visible: 1, text: "BALLY MIDWAY 1982 · IT OUTEARNED ITS FILM", script: [] });
  objects.push({ id: "tr_coin", name: "coinline", type: "text", x: W / 2, y: 166, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO ENTER ◎", script: [] });
  objects.push({ id: "tr_play", name: "playbtn", type: "text", x: W / 2, y: 204, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ ENTER ]", script: [] });
  objects.push({
    id: "tr_help", name: "help", type: "text",
    x: W / 2, y: 238, size: 9, color: DIM, glow: 3, visible: 1,
    text: "FOUR DUELS: CYCLES · TANKS · TOWER · CONE",
    script: []
  });
  objects.push({
    id: "tr_help2", name: "help2", type: "text",
    x: W / 2, y: 256, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD MOVES · SPACE FIRES · BANK YOUR TANK SHOT",
    script: []
  });

  objects.push({
    id: "tr_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "tr_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "MOVE", script: [] });

  return { title: "Tron (1982)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

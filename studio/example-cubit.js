// example-cubit.js — CUBIT (1982 style), an original isometric hopper
// built in our studio, in tribute to 1982's pyramid-hopping phenomenon.
//
// Gottlieb's orange hero was named with a pun on "cube", swore in a
// speech balloon of pure punctuation, and became one of the biggest
// merchandising hits an arcade game ever produced — which is exactly why
// he is still a protected character, and why OUR hopper is an original:
// CUBIT, named with the same kind of pun (a cubit is the oldest unit of
// measure — and this one measures cubes). What we keep is the DESIGN:
//
//   · a pyramid of 28 cubes seen in isometric — every hop is DIAGONAL,
//     so the stick feels turned 45° (↑ hops up-right, ← hops up-left,
//     → hops down-right, ↓ hops down-left)
//   · land on a cube and it changes color: make EVERY cube the target
//     color. Level 1: one hop. Level 2: TWO hops. Level 3: hopping a
//     finished cube turns it BACK. Then faster.
//   · balls rain down the pyramid — the purple one becomes THE COIL,
//     which climbs back up after you with real pathfinding
//   · two FLYING DISCS wait off the edges: leap onto one and ride to
//     the summit — the coil leaps after you and falls (+500)
//   · the green ball FREEZES everyone (+100) · a gremlin hops around
//     turning your work back — catch it for +300
//   · finish the pyramid: +1000, +50 an unused disc, and it reloads
//
//   WASD / arrows / stick hop (diagonally) · 3 HOPPERS

const W = 360, H = 480;
const NB = 3;                                    // bouncing ball slots
const xOf = (r, c) => 180 + (c - r / 2) * 44;
const yOf = (r) => 96 + r * 50;
const DISCS = [{ r: 2, c: -1 }, { r: 3, c: 4 }]; // left of row 2, right of row 3
const CSTART = "#3a4a6b", CMID = "#e8c84a", CTARGET = "#ff6ad5", CDARK = "#1c2435";
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", PURPLE = "#b48cff", ORANGE = "#ff8c3a";

export function buildCubitExample() {
  const L = [];
  const push = (s) => L.push(s);

  // screen position of (rv, cv) into (xv, yv)
  const posOf = (pad, rv, cv, xv, yv) => {
    push(`${pad}set ${xv} to 180 + (${cv} - ${rv} / 2) * 44`);
    push(`${pad}set ${yv} to 96 + ${rv} * 50`);
  };

  const dealLevel = (pad) => {
    push(`${pad}set rule to (level - 1) % 3`);
    push(`${pad}set i to 0`);
    push(`${pad}repeat 28`);
    push(`${pad}  set cst[i] to 0`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set don[0] to 1`);
    push(`${pad}set don[1] to 1`);
    push(`${pad}set sptim to 120`);
    push(`${pad}set grtim to 900`);
  };

  const resetPositions = (pad) => {
    push(`${pad}set pr to 0`);
    push(`${pad}set pc to 0`);
    push(`${pad}set px to ${xOf(0, 0)}`);
    push(`${pad}set py to ${yOf(0)}`);
    push(`${pad}set phop to 0`);
    push(`${pad}set pfall to 0`);
    push(`${pad}set dride to 0`);
    for (let b = 0; b < NB; b++) push(`${pad}set bon[${b}] to 0`);
    push(`${pad}set con to 0`);
    push(`${pad}set gron to 0`);
    push(`${pad}set frz to 0`);
    push(`${pad}set grace to 60`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set level to 1`);
    push(`${pad}set tik to 0`);
    dealLevel(pad);
    resetPositions(pad);
    push(`${pad}set status.text to "MAKE EVERY CUBE PINK — ONE HOP DOES IT (FOR NOW)"`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set level to 1");
  push("set tik to 0");
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
  push("set help2.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO HOP ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO HOP ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  push("  if frz > 0 then");
  push("    set frz to frz - 1");
  push("  end");
  push("  set pdie to 0");

  // ---- the stick is turned 45°: read a diagonal
  push("  set hopd to 0 - 1");
  push(`  set kup to keydown("w") + keydown("ArrowUp")`);
  push(`  set kdn to keydown("s") + keydown("ArrowDown")`);
  push(`  set klf to keydown("a") + keydown("ArrowLeft")`);
  push(`  set krt to keydown("d") + keydown("ArrowRight")`);
  push("  if stickx(1) > 0.5 then");
  push("    set krt to 1");
  push("  end");
  push("  if stickx(1) < -0.5 then");
  push("    set klf to 1");
  push("  end");
  push("  if sticky(1) > 0.5 then");
  push("    set kdn to 1");
  push("  end");
  push("  if sticky(1) < -0.5 then");
  push("    set kup to 1");
  push("  end");
  push("  set anyk to min(1, kup + kdn + klf + krt)");
  push("  if anyk == 1 and anyk0 == 0 then");
  push("    if kup >= 1 then");
  push("      set hopd to 0");          // up-right: (r-1, c)
  push("    end");
  push("    if klf >= 1 then");
  push("      set hopd to 1");          // up-left: (r-1, c-1)
  push("    end");
  push("    if krt >= 1 then");
  push("      set hopd to 2");          // down-right: (r+1, c+1)
  push("    end");
  push("    if kdn >= 1 then");
  push("      set hopd to 3");          // down-left: (r+1, c)
  push("    end");
  push("  end");
  push("  set anyk0 to anyk");

  // ---- start a hop
  push("  if hopd >= 0 and phop == 0 and pfall == 0 and dride == 0 then");
  push("    set r2 to pr");
  push("    set c2 to pc");
  push("    if hopd == 0 then");
  push("      set r2 to r2 - 1");
  push("    end");
  push("    if hopd == 1 then");
  push("      set r2 to r2 - 1");
  push("      set c2 to c2 - 1");
  push("    end");
  push("    if hopd == 2 then");
  push("      set r2 to r2 + 1");
  push("      set c2 to c2 + 1");
  push("    end");
  push("    if hopd == 3 then");
  push("      set r2 to r2 + 1");
  push("    end");
  push("    set phop to 1");
  push("    set pht to 0");
  push("    set psx to px");
  push("    set psy to py");
  push("    set pr2 to r2");
  push("    set pc2 to c2");
  posOf("    ", "r2", "c2", "ptx", "pty");
  push("    beep 440 for 0.03");
  push("  end");

  // ---- the hop in flight
  push("  if phop == 1 then");
  push("    set pht to pht + 1");
  push("    set hf to pht / 16");
  push("    set px to psx + (ptx - psx) * hf");
  push("    set py to psy + (pty - psy) * hf - sin(hf * 180) * 20");
  push("    if pht >= 16 then");
  push("      set phop to 0");
  push("      set pr to pr2");
  push("      set pc to pc2");
  push("      set px to ptx");
  push("      set py to pty");
  // on the pyramid?
  push("      if pr < 0 or pc < 0 or pc > pr or pr > 6 then");
  // a disc?
  push("        set caught to 0");
  for (let d = 0; d < DISCS.length; d++) {
    push(`        if don[${d}] == 1 and pr == ${DISCS[d].r} and pc == ${DISCS[d].c} then`);
    push("          set caught to 1");
    push(`          set don[${d}] to 0`);
    push("          set dride to 1");
    push("          beep 523 for 0.06");
    push("          beep 659 for 0.08");
    // the coil leaps after you — and finds only air
    push("          if con == 1 then");
    push("            set con to 0");
    push("            set lure to 40");
    push("            change score by 500");
    push('            set status.text to "THE COIL LEAPS AFTER YOU — +500"');
    push("          else");
    push('            set status.text to "THE DISC CARRIES YOU TO THE SUMMIT"');
    push("          end");
    push("        end");
  }
  push("        if caught == 0 then");
  push("          set pfall to 1");
  push("          set pfv to 1");
  push("        end");
  push("      else");
  // the cube answers the landing
  push("        set idx to pr * (pr + 1) / 2 + pc");
  push("        if rule == 0 then");
  push("          if cst[idx] != 2 then");
  push("            set cst[idx] to 2");
  push("            change score by 25");
  push("            beep 587 for 0.03");
  push("          end");
  push("        end");
  push("        if rule == 1 then");
  push("          if cst[idx] == 0 then");
  push("            set cst[idx] to 1");
  push("            change score by 15");
  push("            beep 523 for 0.03");
  push("          else");
  push("            if cst[idx] == 1 then");
  push("              set cst[idx] to 2");
  push("              change score by 25");
  push("              beep 587 for 0.03");
  push("            end");
  push("          end");
  push("        end");
  push("        if rule == 2 then");
  push("          if cst[idx] == 2 then");
  push("            set cst[idx] to 0");
  push("            beep 196 for 0.04");
  push("          else");
  push("            set cst[idx] to 2");
  push("            change score by 25");
  push("            beep 587 for 0.03");
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("  end");

  // ---- falling off the world
  push("  if pfall == 1 then");
  push("    change py by pfv");
  push("    change pfv by 0.5");
  push("    if py > 520 then");
  push("      set pfall to 0");
  push("      set pdie to 1");
  push("    end");
  push("  end");

  // ---- the disc ride to the summit
  push("  if dride >= 1 then");
  push("    set dride to dride + 1");
  push(`    set px to px + (${xOf(0, 0)} - px) * 0.07`);
  push(`    set py to py + (${yOf(0)} - 30 - py) * 0.07`);
  push("    if dride >= 55 then");
  push("      set dride to 0");
  push("      set pr to 0");
  push("      set pc to 0");
  push(`      set px to ${xOf(0, 0)}`);
  push(`      set py to ${yOf(0)}`);
  push("      set idx to 0");
  push("      if rule == 0 or rule == 2 then");
  push("        if cst[0] != 2 then");
  push("          set cst[0] to 2");
  push("          change score by 25");
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("  if lure > 0 then");
  push("    set lure to lure - 1");
  push("    if lure == 1 then");
  push("      explode thecoil");
  push("      beep 140 for 0.15");
  push("    end");
  push("  end");

  // ---- balls rain down
  push("  set hopgap to max(28, 48 - level * 2)");
  push("  set sptim to sptim - 1");
  push("  if sptim <= 0 then");
  push(`    set sptim to max(130, 250 - level * 15)`);
  for (let b = 0; b < NB; b++) {
    push(`    if sptim > 1 and bon[${b}] == 0 then`);
    push(`      set bon[${b}] to 1`);
    push(`      set br[${b}] to 1`);
    push(`      set bc[${b}] to floor(rand(0, 2))`);
    push(`      set bh[${b}] to 0`);
    push(`      set bt[${b}] to hopgap`);
    // purple becomes the coil later; green is rare; red is the rain
    push(`      set btyp[${b}] to 0`);
    push("      set roll to rand(0, 1)");
    push("      if roll > 0.75 and con == 0 and lure <= 0 then");
    push(`        set btyp[${b}] to 2`);
    push("      end");
    push("      if roll < 0.12 then");
    push(`        set btyp[${b}] to 1`);
    push("      end");
    posOf("      ", `br[${b}]`, `bc[${b}]`, "nx", "ny");
    push(`      set bx[${b}] to nx`);
    push(`      set by[${b}] to ny`);
    push("      set sptim to 1");       // one spawn a cycle
    push("    end");
  }
  push("  end");
  for (let b = 0; b < NB; b++) {
    push(`  if bon[${b}] == 1 then`);
    push(`    if bh[${b}] == 0 then`);
    push("      if frz <= 0 then");
    push(`        set bt[${b}] to bt[${b}] - 1`);
    push("      end");
    push(`      if bt[${b}] <= 0 then`);
    push(`        set bt[${b}] to hopgap`);
    push(`        set bh[${b}] to 1`);
    push(`        set bht[${b}] to 0`);
    push(`        set bsx[${b}] to bx[${b}]`);
    push(`        set bsy[${b}] to by[${b}]`);
    push(`        set br2[${b}] to br[${b}] + 1`);
    push(`        set bc2[${b}] to bc[${b}]`);
    push("        if rand(0, 1) > 0.5 then");
    push(`          set bc2[${b}] to bc[${b}] + 1`);
    push("        end");
    posOf("        ", `br2[${b}]`, `bc2[${b}]`, "nx", "ny");
    push(`        set btx[${b}] to nx`);
    push(`        set bty[${b}] to ny`);
    push("      end");
    push("    else");
    push(`      set bht[${b}] to bht[${b}] + 1`);
    push(`      set hf to bht[${b}] / 16`);
    push(`      set bx[${b}] to bsx[${b}] + (btx[${b}] - bsx[${b}]) * hf`);
    push(`      set by[${b}] to bsy[${b}] + (bty[${b}] - bsy[${b}]) * hf - sin(hf * 180) * 16`);
    push(`      if bht[${b}] >= 16 then`);
    push(`        set bh[${b}] to 0`);
    push(`        set br[${b}] to br2[${b}]`);
    push(`        set bc[${b}] to bc2[${b}]`);
    push(`        if br[${b}] > 6 then`);
    // off the bottom — the purple one coils up instead
    push(`          if btyp[${b}] == 2 and con == 0 then`);
    push("            set con to 1");
    push(`            set cr to 6`);
    push(`            set cc to max(0, min(6, bc[${b}]))`);
    posOf("            ", "cr", "cc", "cx2", "cy2");
    push("            set cx to cx2");
    push("            set cy to cy2");
    push("            set chop to 0");
    push("            set ct to hopgap + 10");
    push('            say "THE COIL RISES" for 1');
    push("            beep 98 for 0.15");
    push("          end");
    push(`          set bon[${b}] to 0`);
    push("        end");
    push("      end");
    push("    end");
    // touching a ball
    push(`    if bon[${b}] == 1 and grace <= 0 and abs(bx[${b}] - px) < 13 and abs(by[${b}] - py) < 13 then`);
    push(`      if btyp[${b}] == 1 then`);
    push(`        set bon[${b}] to 0`);
    push("        set frz to 200");
    push("        change score by 100");
    push("        beep 784 for 0.08");
    push('        set status.text to "FROZEN — +100. GO."');
    push("      else");
    push("        if frz <= 0 then");
    push("          set pdie to 1");
    push("        end");
    push("      end");
    push("    end");
    push("  end");
  }

  // ---- THE COIL: it climbs after you
  push("  if con == 1 then");
  push("    if chop == 0 then");
  push("      if frz <= 0 then");
  push("        set ct to ct - 1");
  push("      end");
  push("      if ct <= 0 then");
  push("        set ct to hopgap + 8");
  push("        set bestsc to 999");
  push("        set bestr to cr");
  push("        set bestc to cc");
  // four hops, graded by distance to the hopper
  for (const [dr, dc] of [[-1, 0], [-1, -1], [1, 1], [1, 0]]) {
    push(`        set r2 to cr + ${dr}`);
    push(`        set c2 to cc + ${dc}`);
    push("        if r2 >= 0 and r2 <= 6 and c2 >= 0 and c2 <= r2 then");
    push("          set dsc to abs(r2 - pr) + abs(c2 - pc)");
    push("          if dsc < bestsc then");
    push("            set bestsc to dsc");
    push("            set bestr to r2");
    push("            set bestc to c2");
    push("          end");
    push("        end");
  }
  push("        set chop to 1");
  push("        set cht to 0");
  push("        set csx to cx");
  push("        set csy to cy");
  push("        set cr2 to bestr");
  push("        set cc2 to bestc");
  posOf("        ", "cr2", "cc2", "ctx", "cty");
  push("      end");
  push("    else");
  push("      set cht to cht + 1");
  push("      set hf to cht / 16");
  push("      set cx to csx + (ctx - csx) * hf");
  push("      set cy to csy + (cty - csy) * hf - sin(hf * 180) * 16");
  push("      if cht >= 16 then");
  push("        set chop to 0");
  push("        set cr to cr2");
  push("        set cc to cc2");
  push("      end");
  push("    end");
  push("    if grace <= 0 and frz <= 0 and abs(cx - px) < 13 and abs(cy - py) < 13 then");
  push("      set pdie to 1");
  push("    end");
  push("  end");

  // ---- the gremlin turns your work back
  push("  if gron == 0 and level >= 2 then");
  push("    set grtim to grtim - 1");
  push("    if grtim <= 0 then");
  push("      set grtim to 900");
  push("      set gron to 1");
  push("      set gr to 0");
  push("      set gc to 0");
  push("      set gh to 0");
  push("      set gt to hopgap + 14");
  posOf("      ", "gr", "gc", "nx", "ny");
  push("      set gx to nx");
  push("      set gy to ny");
  push("    end");
  push("  end");
  push("  if gron == 1 then");
  push("    if gh == 0 then");
  push("      if frz <= 0 then");
  push("        set gt to gt - 1");
  push("      end");
  push("      if gt <= 0 then");
  push("        set gt to hopgap + 14");
  push("        set gh to 1");
  push("        set ght to 0");
  push("        set gsx to gx");
  push("        set gsy to gy");
  push("        set gr2 to gr + 1");
  push("        set gc2 to gc");
  push("        if rand(0, 1) > 0.5 then");
  push("          set gc2 to gc + 1");
  push("        end");
  posOf("        ", "gr2", "gc2", "nx", "ny");
  push("        set gtx to nx");
  push("        set gty to ny");
  push("      end");
  push("    else");
  push("      set ght to ght + 1");
  push("      set hf to ght / 16");
  push("      set gx to gsx + (gtx - gsx) * hf");
  push("      set gy to gsy + (gty - gsy) * hf - sin(hf * 180) * 16");
  push("      if ght >= 16 then");
  push("        set gh to 0");
  push("        set gr to gr2");
  push("        set gc to gc2");
  push("        if gr > 6 then");
  push("          set gron to 0");
  push("        else");
  push("          set idx to gr * (gr + 1) / 2 + gc");
  push("          set cst[idx] to 0");
  push("          beep 220 for 0.03");
  push("        end");
  push("      end");
  push("    end");
  push("    if gron == 1 and abs(gx - px) < 13 and abs(gy - py) < 13 then");
  push("      set gron to 0");
  push("      change score by 300");
  push("      beep 659 for 0.06");
  push("      beep 988 for 0.08");
  push('      set status.text to "CAUGHT THE GREMLIN — +300"');
  push("    end");
  push("  end");

  // ---- the pyramid complete?
  push("  set done to 0");
  push("  set i to 0");
  push("  repeat 28");
  push("    if cst[i] == 2 then");
  push("      set done to done + 1");
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push("  if done >= 28 and pfall == 0 then");
  push("    set bonus to 1000 + (don[0] + don[1]) * 50");
  push("    change score by bonus");
  push("    set level to level + 1");
  push("    beep 659 for 0.08");
  push("    beep 784 for 0.08");
  push("    beep 988 for 0.08");
  push("    beep 1319 for 0.15");
  dealLevel("    ");
  resetPositions("    ");
  push("    if rule == 1 then");
  push('      set status.text to "+" + bonus + " — LEVEL " + level + ": NOW IT TAKES TWO HOPS"');
  push("    else");
  push("      if rule == 2 then");
  push('        set status.text to "+" + bonus + " — LEVEL " + level + ": FINISHED CUBES TURN BACK"');
  push("      else");
  push('        set status.text to "+" + bonus + " — LEVEL " + level + ": ONE HOP AGAIN, BUT FASTER"');
  push("      end");
  push("    end");
  push("  end");

  // ---- a hopper lost
  push("  if pdie == 1 and game == 0 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode hopper");
  push('    say "#!?*%!" for 1');
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "OUT OF HOPPERS — SCORE " + score + " — CLICK TO HOP AGAIN"');
  push("    else");
  resetPositions("      ");
  push('      set status.text to lives + " HOPPERS LEFT — YOUR CUBES KEPT THEIR COLORS"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "HOPPERS " + lives');
  push('  set leveltx.text to "LEVEL " + level');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set leveltx.visible to (game != 9)");
  push("set targtx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game != 9)";

  // the pyramid: a dark under-diamond and a colored top per cube
  for (let r = 0; r <= 6; r++) {
    for (let c = 0; c <= r; c++) {
      const idx = r * (r + 1) / 2 + c;
      objects.push({
        id: "cb_u" + idx, name: "under" + idx, type: "text",
        x: xOf(r, c) + 3, y: yOf(r) + 7, size: 42, color: CDARK, glow: 0, visible: 0, text: "◆",
        script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
      });
      objects.push({
        id: "cb_c" + idx, name: "cube" + idx, type: "text",
        x: xOf(r, c), y: yOf(r), size: 42, color: CSTART, glow: 2, visible: 0, text: "◆",
        script: [{
          event: "code", source: `when tick
set self.visible to ${inGame}
if cst[${idx}] == 0 then
  set self.color to "${CSTART}"
  set self.glow to 2
end
if cst[${idx}] == 1 then
  set self.color to "${CMID}"
  set self.glow to 4
end
if cst[${idx}] == 2 then
  set self.color to "${CTARGET}"
  set self.glow to 6
end
end` }]
      });
    }
  }
  // the flying discs
  DISCS.forEach((d, i) => {
    objects.push({
      id: "cb_di" + i, name: "disc" + (i + 1), type: "text",
      x: xOf(d.r, d.c), y: yOf(d.r), size: 20, color: CYAN, glow: 10, visible: 0, text: "▬",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and don[${i}] == 1)
set self.y to ${yOf(d.r)} + sin(time() * 200 + ${i * 180}) * 3
end` }]
    });
  });
  // the balls
  const BCOL = [RED, GREEN, PURPLE];
  for (let b = 0; b < NB; b++) {
    objects.push({
      id: "cb_b" + b, name: "ball" + (b + 1), type: "dot",
      x: -50, y: -50, size: 7, color: RED, glow: 9, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and bon[${b}] == 1)
set self.x to bx[${b}]
set self.y to by[${b}] - 8
${[0, 1, 2].map(t => `if btyp[${b}] == ${t} then\n  set self.color to "${BCOL[t]}"\nend`).join("\n")}
if frz > 0 then
  set self.glow to 2
else
  set self.glow to 9
end
end` }]
    });
  }
  // the coil
  objects.push({
    id: "cb_co", name: "thecoil", type: "text",
    x: -50, y: -50, size: 17, color: PURPLE, glow: 10, visible: 0, text: "§",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and con == 1)
set self.x to cx
set self.y to cy - 10
if frz > 0 then
  set self.glow to 2
else
  set self.glow to 10
end
end` }]
  });
  // the gremlin
  objects.push({
    id: "cb_gr", name: "gremlin", type: "text",
    x: -50, y: -50, size: 14, color: "#9fdf5a", glow: 9, visible: 0, text: "ø",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and gron == 1)
set self.x to gx
set self.y to gy - 9
if frz > 0 then
  set self.glow to 2
else
  set self.glow to 9
end
end` }]
  });
  // the hopper (an orange ring; no snout, no face — ours)
  objects.push({
    id: "cb_p", name: "hopper", type: "ring",
    x: xOf(0, 0), y: yOf(0), size: 9, color: ORANGE, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and (grace <= 0 or grace % 8 < 4))
set self.x to px
set self.y to py - 11
end` }]
  });

  // HUD
  objects.push({ id: "cb_sc", name: "scoretx", type: "text", x: 50, y: 24, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "cb_lv", name: "livestx", type: "text", x: 292, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "HOPPERS 3", script: [] });
  objects.push({ id: "cb_le", name: "leveltx", type: "text", x: 175, y: 22, size: 11, color: GOLD, glow: 5, visible: 0, text: "LEVEL 1", script: [] });
  objects.push({ id: "cb_tg", name: "targtx", type: "text", x: 180, y: 44, size: 9, color: CTARGET, glow: 6, visible: 0, text: "MAKE EVERY CUBE ◆ THIS COLOR", script: [] });
  objects.push({ id: "cb_st", name: "status", type: "text", x: 180, y: 466, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "cb_big", name: "bigtitle", type: "text", x: 180, y: 170, size: 44, color: ORANGE, glow: 18, visible: 1, text: "CUBIT", script: [] });
  objects.push({ id: "cb_sub", name: "subline", type: "text", x: 180, y: 202, size: 9, color: DIM, glow: 4, visible: 1, text: "AN ORIGINAL ISOMETRIC HOPPER · 1982 STYLE · IN TRIBUTE", script: [] });
  objects.push({ id: "cb_coin", name: "coinline", type: "text", x: 180, y: 232, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO HOP ◎", script: [] });
  objects.push({ id: "cb_play", name: "playbtn", type: "text", x: 180, y: 266, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ HOP ]", script: [] });
  objects.push({
    id: "cb_help", name: "help", type: "text",
    x: 180, y: 298, size: 8, color: DIM, glow: 3, visible: 1,
    text: "THE STICK IS TURNED 45° — EVERY HOP IS DIAGONAL",
    script: []
  });
  objects.push({
    id: "cb_help2", name: "help2", type: "text",
    x: 180, y: 316, size: 8, color: DIM, glow: 3, visible: 1,
    text: "PAINT ALL 28 CUBES · DISCS LURE THE COIL OFF THE EDGE",
    script: []
  });

  objects.push({
    id: "cb_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "cb_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "HOP", script: [] });

  return { title: "Cubit (1982 style)", w: 360, h: 480, objects };
}

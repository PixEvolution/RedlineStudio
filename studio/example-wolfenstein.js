// example-wolfenstein.js — CASTLE WOLFENSTEIN (1981), rebuilt in our studio.
//
// Muse Software's Apple II castle — the ancestor of the whole Wolfenstein
// line, and of the stealth genre itself. Decades before anyone said
// "stealth game", Silas Warner built one: guards who can only see where
// they FACE, a gun you mostly shouldn't fire, chests that take agonizing
// seconds to search, a stolen uniform that fools the rank and file (but
// not the armored sentries), and one goal — find the war plans and walk
// out the great door. It even SPOKE, in digitized German, years before
// speech was common. Ours keeps the design, drawn with our own glyphs:
//
//   · a 3×3 castle of rooms — the GATE CELLS at the bottom, the GREAT
//     DOOR at the top, the plans locked in one of the four towers/cellars
//   · guards patrol fixed lanes and see a CONE in front of them — read
//     their facing, slip behind, and the castle is yours
//   · E near an unsuspecting guard: HOLD HIM UP (+100) — E again to
//     frisk him for rounds. The pistol works too, but a shot is LOUD:
//     every guard in the room comes alert
//   · E at a chest: SEARCH it — you stand frozen while you dig. Rounds,
//     nothing, the UNIFORM (regular guards ignore you), or THE PLANS
//   · armored sentries see through the uniform and take two rounds
//   · the great door is BARRED until the plans are in your hands;
//     escape pays 1500 + 300 a spy — leave without firing for +500
//
//   WASD / arrows / stick sneak · E holds up + searches · SPACE shoots

const W = 480, H = 360;
const NG = 3, NGS = 2;
const TOP = 48, BOT = 340, LFT = 16, RGT = 464;
const GAPX0 = 212, GAPX1 = 268, GAPY0 = 152, GAPY1 = 208;    // doorways
const START_ROOM = 7, EXIT_ROOM = 1;                          // bottom-center in, top-center out
const ROOMNAMES = ["NW TOWER", "GREAT DOOR HALL", "NE TOWER", "WEST WING",
  "THE KEEP", "EAST WING", "SW CELLAR", "GATE CELLS", "SE CELLAR"];
// per room: walls [x,y,len,vert] ×≤4 · chests [x,y] ×2 · guards [x,y,axis,min,max,type] ×≤3
const ROOMS = [
  { w: [[120, 140, 140, 0], [330, 120, 90, 1]], c: [[60, 80], [430, 310]],
    g: [[240, 240, 0, 60, 420, 0], [60, 180, 1, 80, 300, 0], [380, 300, 0, 120, 440, 1]] },
  { w: [[150, 120, 70, 1], [330, 120, 70, 1]], c: [[60, 300], [420, 300]],
    g: [[240, 110, 0, 100, 380, 1], [120, 250, 0, 40, 220, 0], [360, 250, 0, 260, 440, 0]] },
  { w: [[220, 140, 140, 0], [150, 120, 90, 1]], c: [[420, 80], [50, 310]],
    g: [[240, 240, 0, 60, 420, 0], [420, 180, 1, 80, 300, 0], [100, 300, 0, 40, 320, 1]] },
  { w: [[120, 190, 240, 0]], c: [[60, 90], [60, 300]],
    g: [[240, 120, 0, 60, 420, 0], [240, 260, 0, 60, 420, 0]] },
  { w: [[180, 140, 120, 0], [180, 230, 120, 0]], c: [[240, 185], [60, 80]],
    g: [[240, 100, 0, 60, 420, 0], [240, 290, 0, 60, 420, 0], [90, 190, 1, 100, 280, 0]] },
  { w: [[120, 190, 240, 0]], c: [[420, 90], [420, 300]],
    g: [[240, 120, 0, 60, 420, 0], [240, 260, 0, 60, 420, 0]] },
  { w: [[120, 120, 100, 1], [260, 220, 140, 0]], c: [[50, 310], [390, 70]],
    g: [[240, 170, 0, 150, 420, 0], [330, 290, 0, 200, 440, 0], [440, 180, 1, 80, 280, 1]] },
  { w: [[150, 230, 180, 0]], c: [[60, 90], [420, 90]],
    g: [[240, 130, 0, 80, 400, 0]] },
  { w: [[340, 120, 100, 1], [100, 220, 140, 0]], c: [[430, 310], [50, 90]],
    g: [[200, 170, 0, 60, 330, 0], [160, 290, 0, 40, 280, 0], [40, 180, 1, 80, 280, 1]] },
];
const PLANROOMS = [0, 2, 6, 8];    // the plans hide in a tower or cellar (chest 1)
const UNIROOMS = [3, 5];           // the uniform hangs in a wing (chest 2)
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", STONE = "#8b95a8", GUARD = "#9fb46a", ARMOR = "#d87a7a";

export function buildWolfensteinExample() {
  const L = [];
  const push = (s) => L.push(s);

  // ---- emit: does point (xv, yv) touch stone? → hitw (walls BLOCK here, they don't kill)
  const wallTouch = (pad, xv, yv) => {
    push(`${pad}set hitw to 0`);
    push(`${pad}if ${yv} < ${TOP + 6} and (${xv} < ${GAPX0} or ${xv} > ${GAPX1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    push(`${pad}if ${yv} > ${BOT - 6} and (${xv} < ${GAPX0} or ${xv} > ${GAPX1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    push(`${pad}if ${xv} < ${LFT + 6} and (${yv} < ${GAPY0} or ${yv} > ${GAPY1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    push(`${pad}if ${xv} > ${RGT - 6} and (${yv} < ${GAPY0} or ${yv} > ${GAPY1}) then`);
    push(`${pad}  set hitw to 1`);
    push(`${pad}end`);
    push(`${pad}set wi to 0`);
    push(`${pad}repeat 4`);
    push(`${pad}  if won[wi] == 1 then`);
    push(`${pad}    if wvert[wi] == 0 then`);
    push(`${pad}      if abs(${yv} - wy1[wi]) < 7 and ${xv} > wx1[wi] - 4 and ${xv} < wx1[wi] + wlen[wi] + 4 then`);
    push(`${pad}        set hitw to 1`);
    push(`${pad}      end`);
    push(`${pad}    else`);
    push(`${pad}      if abs(${xv} - wx1[wi]) < 7 and ${yv} > wy1[wi] - 4 and ${yv} < wy1[wi] + wlen[wi] + 4 then`);
    push(`${pad}        set hitw to 1`);
    push(`${pad}      end`);
    push(`${pad}    end`);
    push(`${pad}  end`);
    push(`${pad}  set wi to wi + 1`);
    push(`${pad}end`);
  };

  // ---- deal the current room from the castle tables
  const dealRoom = (pad, enterX, enterY) => {
    push(`${pad}set roomn to roomr * 3 + roomc`);
    push(`${pad}set wi to 0`);
    push(`${pad}repeat 4`);
    push(`${pad}  set won[wi] to wson[roomn * 4 + wi]`);
    push(`${pad}  set wx1[wi] to wsx[roomn * 4 + wi]`);
    push(`${pad}  set wy1[wi] to wsy[roomn * 4 + wi]`);
    push(`${pad}  set wlen[wi] to wsl[roomn * 4 + wi]`);
    push(`${pad}  set wvert[wi] to wsv[roomn * 4 + wi]`);
    push(`${pad}  set wi to wi + 1`);
    push(`${pad}end`);
    push(`${pad}set c0i to roomn * 2`);
    push(`${pad}set c1i to roomn * 2 + 1`);
    push(`${pad}set c0x to chx[c0i]`);
    push(`${pad}set c0y to chy[c0i]`);
    push(`${pad}set c1x to chx[c1i]`);
    push(`${pad}set c1y to chy[c1i]`);
    push(`${pad}set gi to 0`);
    push(`${pad}repeat ${NG}`);
    push(`${pad}  set gon[gi] to ggon[roomn * 3 + gi]`);
    push(`${pad}  set gx[gi] to ggx[roomn * 3 + gi]`);
    push(`${pad}  set gy[gi] to ggy[roomn * 3 + gi]`);
    push(`${pad}  set gax[gi] to gga[roomn * 3 + gi]`);
    push(`${pad}  set gmn[gi] to ggmn[roomn * 3 + gi]`);
    push(`${pad}  set gmx[gi] to ggmx[roomn * 3 + gi]`);
    push(`${pad}  set gtp[gi] to ggt[roomn * 3 + gi]`);
    push(`${pad}  set gdir[gi] to 1`);
    push(`${pad}  set gst[gi] to 0`);
    push(`${pad}  set ghp[gi] to 1 + ggt[roomn * 3 + gi]`);
    push(`${pad}  set gfrisk[gi] to 0`);
    push(`${pad}  set gft[gi] to 90 + rand(0, 90)`);
    push(`${pad}  set gi to gi + 1`);
    push(`${pad}end`);
    for (let k = 0; k < NGS; k++) push(`${pad}set sson[${k}] to 0`);
    push(`${pad}set pbon to 0`);
    push(`${pad}set srch to 0`);
    push(`${pad}set barmsg to 0`);
    push(`${pad}set px to ${enterX}`);
    push(`${pad}set py to ${enterY}`);
    push(`${pad}set grace to 40`);
    for (let n = 0; n < 9; n++) {
      push(`${pad}if roomn == ${n} then`);
      push(`${pad}  set roomtx.text to "${ROOMNAMES[n]}"`);
      push(`${pad}end`);
    }
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set bullets to 8`);
    push(`${pad}set kills to 0`);
    push(`${pad}set plans to 0`);
    push(`${pad}set uniform to 0`);
    push(`${pad}set roomc to 1`);
    push(`${pad}set roomr to 2`);
    push(`${pad}set fdx to 0`);
    push(`${pad}set fdy to -1`);
    // stock the chests: mostly rounds or dust — the PLANS in one random
    // tower/cellar, the UNIFORM in one random wing
    push(`${pad}set ci to 0`);
    push(`${pad}repeat 18`);
    push(`${pad}  set copen[ci] to 0`);
    push(`${pad}  set cwhat[ci] to 0`);
    push(`${pad}  if rand(0, 1) < 0.45 then`);
    push(`${pad}    set cwhat[ci] to 1`);
    push(`${pad}  end`);
    push(`${pad}  set ci to ci + 1`);
    push(`${pad}end`);
    push(`${pad}set prr to floor(rand(0, ${PLANROOMS.length}))`);
    for (let i = 0; i < PLANROOMS.length; i++) {
      push(`${pad}if prr == ${i} then`);
      push(`${pad}  set cwhat[${PLANROOMS[i] * 2}] to 3`);
      push(`${pad}end`);
    }
    push(`${pad}set urr to floor(rand(0, ${UNIROOMS.length}))`);
    for (let i = 0; i < UNIROOMS.length; i++) {
      push(`${pad}if urr == ${i} then`);
      push(`${pad}  set cwhat[${UNIROOMS[i] * 2 + 1}] to 2`);
      push(`${pad}end`);
    }
    dealRoom(pad, 240, 300);
    push(`${pad}set status.text to "READ THEIR FACING. THE PLANS ARE IN A TOWER OR A CELLAR."`);
  };

  // ======== start: carve the castle into the tables once
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set i to 0");
  push("repeat 36");
  push("  set wson[i] to 0");
  push("  set wsx[i] to 0");
  push("  set wsy[i] to 0");
  push("  set wsl[i] to 10");
  push("  set wsv[i] to 0");
  push("  set i to i + 1");
  push("end");
  push("set i to 0");
  push("repeat 27");
  push("  set ggon[i] to 0");
  push("  set ggx[i] to 0");
  push("  set ggy[i] to 0");
  push("  set gga[i] to 0");
  push("  set ggmn[i] to 0");
  push("  set ggmx[i] to 0");
  push("  set ggt[i] to 0");
  push("  set i to i + 1");
  push("end");
  for (let n = 0; n < 9; n++) {
    const rm = ROOMS[n];
    rm.w.forEach((sg, i) => {
      push(`set wson[${n * 4 + i}] to 1`);
      push(`set wsx[${n * 4 + i}] to ${sg[0]}`);
      push(`set wsy[${n * 4 + i}] to ${sg[1]}`);
      push(`set wsl[${n * 4 + i}] to ${sg[2]}`);
      push(`set wsv[${n * 4 + i}] to ${sg[3]}`);
    });
    rm.c.forEach(([cx, cy], j) => {
      push(`set chx[${n * 2 + j}] to ${cx}`);
      push(`set chy[${n * 2 + j}] to ${cy}`);
    });
    rm.g.forEach((gd, k) => {
      push(`set ggon[${n * 3 + k}] to 1`);
      push(`set ggx[${n * 3 + k}] to ${gd[0]}`);
      push(`set ggy[${n * 3 + k}] to ${gd[1]}`);
      push(`set gga[${n * 3 + k}] to ${gd[2]}`);
      push(`set ggmn[${n * 3 + k}] to ${gd[3]}`);
      push(`set ggmx[${n * 3 + k}] to ${gd[4]}`);
      push(`set ggt[${n * 3 + k}] to ${gd[5]}`);
    });
  }
  push("set roomc to 1");
  push("set roomr to 2");
  push("set plans to 0");
  push("set uniform to 0");
  push("set bullets to 0");
  dealRoom("", 240, 300);
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO BREAK IN ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO BREAK IN ◎"');
  push("end");

  push("if game == 0 then");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  push("  if barmsg > 0 then");
  push("    set barmsg to barmsg - 1");
  push("  end");

  // ---- E: search a chest, hold up a guard, frisk a prisoner
  push('  set ek to keydown("e")');
  push("  if ek == 1 and ek0 == 0 and srch == 0 then");
  push("    set acted to 0");
  push("    if copen[c0i] == 0 and abs(px - c0x) < 26 and abs(py - c0y) < 26 then");
  push("      set srch to c0i + 1");
  push("      set stim to 120");
  push("      set acted to 1");
  push('      set status.text to "SEARCHING THE CHEST — STAND STILL..."');
  push("    end");
  push("    if acted == 0 and copen[c1i] == 0 and abs(px - c1x) < 26 and abs(py - c1y) < 26 then");
  push("      set srch to c1i + 1");
  push("      set stim to 120");
  push("      set acted to 1");
  push('      set status.text to "SEARCHING THE CHEST — STAND STILL..."');
  push("    end");
  for (let k = 0; k < NG; k++) {
    push(`    if acted == 0 and gon[${k}] == 1 and gst[${k}] == 0 and abs(px - gx[${k}]) < 42 and abs(py - gy[${k}]) < 42 then`);
    push(`      set gst[${k}] to 2`);
    push("      set acted to 1");
    push("      change score by 100");
    push('      say "KAMERAD!" for 0.9');
    push("      beep 494 for 0.08");
    push('      set status.text to "HANDS UP — +100. PRESS E AGAIN TO FRISK HIM."');
    push("    end");
    push(`    if acted == 0 and gon[${k}] == 1 and gst[${k}] == 2 and gfrisk[${k}] == 0 and abs(px - gx[${k}]) < 42 and abs(py - gy[${k}]) < 42 then`);
    push(`      set gfrisk[${k}] to 1`);
    push("      set acted to 1");
    push("      change bullets by 2");
    push("      change score by 50");
    push("      beep 659 for 0.06");
    push('      set status.text to "FRISKED HIM — +2 ROUNDS"');
    push("    end");
  }
  push("  end");
  push("  set ek0 to ek");

  // ---- searching: frozen hands in the chest
  push("  if srch > 0 then");
  push("    set stim to stim - 1");
  push("    if stim % 30 == 0 then");
  push("      beep 330 for 0.04");
  push("    end");
  push("    if stim <= 0 then");
  push("      set fci to srch - 1");
  push("      set srch to 0");
  push("      set copen[fci] to 1");
  push("      set loot to cwhat[fci]");
  push("      if loot == 0 then");
  push('        set status.text to "EMPTY."');
  push("        beep 196 for 0.08");
  push("      end");
  push("      if loot == 1 then");
  push("        change bullets by 3");
  push("        change score by 50");
  push('        set status.text to "+3 ROUNDS"');
  push("        beep 659 for 0.08");
  push("      end");
  push("      if loot == 2 then");
  push("        set uniform to 1");
  push("        change score by 200");
  push('        set status.text to "A GUARD\'S UNIFORM — THE RANK AND FILE IGNORE YOU NOW"');
  push("        beep 523 for 0.08");
  push("        beep 659 for 0.08");
  push("        beep 784 for 0.12");
  push("      end");
  push("      if loot == 3 then");
  push("        set plans to 1");
  push("        change score by 500");
  push('        say "THE WAR PLANS!" for 1.2');
  push('        set status.text to "THE WAR PLANS — NOW OUT THE GREAT DOOR, NORTH"');
  push("        beep 659 for 0.08");
  push("        beep 784 for 0.08");
  push("        beep 988 for 0.15");
  push("      end");
  push("    end");
  push("  else");

  // ---- sneak (walls block, axis by axis)
  push(`    set mvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`    set mvy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push("    set ix2 to 0");
  push("    if mvx > 0.35 then");
  push("      set ix2 to 1");
  push("    end");
  push("    if mvx < -0.35 then");
  push("      set ix2 to -1");
  push("    end");
  push("    set iy2 to 0");
  push("    if mvy > 0.35 then");
  push("      set iy2 to 1");
  push("    end");
  push("    if mvy < -0.35 then");
  push("      set iy2 to -1");
  push("    end");
  push("    if ix2 != 0 or iy2 != 0 then");
  push("      set fdx to ix2");
  push("      set fdy to iy2");
  push("    end");
  push("    set oldx to px");
  push("    set oldy to py");
  push("    change px by ix2 * 2.2");
  wallTouch("    ", "px", "oldy");
  push("    if hitw == 1 then");
  push("      set px to oldx");
  push("    end");
  push("    change py by iy2 * 2.2");
  wallTouch("    ", "px", "py");
  push("    if hitw == 1 then");
  push("      set py to oldy");
  push("    end");

  // ---- the doorways
  push("    set wentout to 0");
  push(`    if px < 10 and py > ${GAPY0} and py < ${GAPY1} then`);
  push("      if roomc > 0 then");
  push("        set roomc to roomc - 1");
  push("        set wentout to 1");
  push("        set nx to 446");
  push("        set ny to 180");
  push("      else");
  push("        set px to 10");
  push("      end");
  push("    end");
  push(`    if px > ${W - 10} and py > ${GAPY0} and py < ${GAPY1} then`);
  push("      if roomc < 2 then");
  push("        set roomc to roomc + 1");
  push("        set wentout to 1");
  push("        set nx to 34");
  push("        set ny to 180");
  push("      else");
  push("        set px to " + (W - 10));
  push("      end");
  push("    end");
  push(`    if py > ${H - 8} and px > ${GAPX0} and px < ${GAPX1} then`);
  push("      if roomr < 2 then");
  push("        set roomr to roomr + 1");
  push("        set wentout to 1");
  push("        set nx to 240");
  push("        set ny to 62");
  push("      else");
  push("        set py to " + (H - 8));
  push("      end");
  push("    end");
  push(`    if py < 42 and px > ${GAPX0} and px < ${GAPX1} then`);
  push("      if roomr > 0 then");
  push("        set roomr to roomr - 1");
  push("        set wentout to 1");
  push("        set nx to 240");
  push("        set ny to 326");
  push("      else");
  push(`        if roomn == ${EXIT_ROOM} and plans == 1 then`);
  // ---------- THE ESCAPE ----------
  push("          set game to 2");
  push("          set endplay to 1");
  push("          change score by 1500 + lives * 300");
  push("          if kills == 0 then");
  push("            change score by 500");
  push('            set status.text to "OUT WITH THE PLANS, NOT ONE SHOT FIRED — +500. CLICK FOR MORE."');
  push("          else");
  push('            set status.text to "OUT THE GREAT DOOR WITH THE PLANS — CLICK TO BREAK IN AGAIN"');
  push("          end");
  push('          say "THE PLANS LEAVE WITH YOU." for 1.5');
  push("          beep 523 for 0.1");
  push("          beep 659 for 0.1");
  push("          beep 784 for 0.1");
  push("          beep 1047 for 0.2");
  push("        else");
  push("          set py to 42");
  push("          if barmsg <= 0 then");
  push("            set barmsg to 120");
  push(`            if roomn == ${EXIT_ROOM} then`);
  push('              set status.text to "THE GREAT DOOR IS BARRED — FIND THE WAR PLANS"');
  push("              beep 147 for 0.1");
  push("            end");
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("    if wentout == 1 then");
  dealRoom("      ", "nx", "ny");
  push("    end");

  // ---- the pistol (loud: every patroller in the room comes alert)
  push('    set pf to keydown("Space")');
  push("    if pf == 1 and pf0 == 0 and pbon == 0 then");
  push("      if bullets > 0 then");
  push("        set bullets to bullets - 1");
  push("        set pbon to 1");
  push("        set pbx to px + fdx * 10");
  push("        set pby to py + fdy * 10");
  push("        set pbvx to fdx * 5.5");
  push("        set pbvy to fdy * 5.5");
  push("        beep 740 for 0.05");
  for (let k = 0; k < NG; k++) {
    push(`        if gon[${k}] == 1 and gst[${k}] == 0 then`);
    push(`          set gst[${k}] to 1`);
    push("        end");
  }
  push("      else");
  push("        beep 165 for 0.05");
  push('        set status.text to "CLICK. NO ROUNDS — SEARCH THE CHESTS, FRISK THE GUARDS."');
  push("      end");
  push("    end");
  push("    set pf0 to pf");
  push("  end");

  // ---- your round in flight
  push("  if pbon == 1 then");
  push("    change pbx by pbvx");
  push("    change pby by pbvy");
  wallTouch("    ", "pbx", "pby");
  push("    if hitw == 1 then");
  push("      set pbon to 0");
  push("    end");
  push(`    if pbx < ${LFT} or pbx > ${RGT} or pby < ${TOP} or pby > ${BOT} then`);
  push("      set pbon to 0");
  push("    end");
  for (let k = 0; k < NG; k++) {
    push(`    if pbon == 1 and gon[${k}] == 1 and abs(pbx - gx[${k}]) < 11 and abs(pby - gy[${k}]) < 11 then`);
    push("      set pbon to 0");
    push(`      set ghp[${k}] to ghp[${k}] - 1`);
    push(`      if ghp[${k}] <= 0 then`);
    push(`        set gon[${k}] to 0`);
    push(`        explode guard${k + 1}`);
    push("        set kills to kills + 1");
    push("        change score by 25");
    push("        beep 140 for 0.12");
    push("      else");
    push("        beep 208 for 0.08");
    push("      end");
    push("    end");
  }
  push("  end");

  // ---- the guards: they see only where they FACE
  push("  set pdie to 0");
  for (let k = 0; k < NG; k++) {
    push(`  if gon[${k}] == 1 then`);
    // facing vector
    push(`    if gst[${k}] == 0 then`);
    push(`      if gax[${k}] == 0 then`);
    push(`        set gvx[${k}] to gdir[${k}]`);
    push(`        set gvy[${k}] to 0`);
    push("      else");
    push(`        set gvx[${k}] to 0`);
    push(`        set gvy[${k}] to gdir[${k}]`);
    push("      end");
    // patrol the lane
    push(`      if gax[${k}] == 0 then`);
    push(`        change gx[${k}] by gdir[${k}] * 0.7`);
    push(`        if gx[${k}] > gmx[${k}] or gx[${k}] < gmn[${k}] then`);
    push(`          set gdir[${k}] to 0 - gdir[${k}]`);
    push("        end");
    push("      else");
    push(`        change gy[${k}] by gdir[${k}] * 0.7`);
    push(`        if gy[${k}] > gmx[${k}] or gy[${k}] < gmn[${k}] then`);
    push(`          set gdir[${k}] to 0 - gdir[${k}]`);
    push("        end");
    push("      end");
    // the cone: within 150, in front, and not fooled by the uniform
    push("      if grace <= 0 then");
    push(`        if uniform == 0 or gtp[${k}] == 1 then`);
    push(`          set ddx to px - gx[${k}]`);
    push(`          set ddy to py - gy[${k}]`);
    push("          set dd to abs(ddx) + abs(ddy)");
    push("          if dd < 150 then");
    push(`            if ddx * gvx[${k}] + ddy * gvy[${k}] > dd * 0.45 then`);
    push(`              set gst[${k}] to 1`);
    push('              say "HALT!" for 0.7');
    push("              beep 880 for 0.1");
    push("              beep 880 for 0.1");
    push("            end");
    push("          end");
    push("        end");
    push("      end");
    push("    end");
    // alerted: close in (walls still block him), and shoot
    push(`    if gst[${k}] == 1 then`);
    push(`      set ddx to px - gx[${k}]`);
    push(`      set ddy to py - gy[${k}]`);
    push(`      set gvx[${k}] to 0`);
    push(`      set gvy[${k}] to 0`);
    push("      if abs(ddx) > abs(ddy) then");
    push(`        set gvx[${k}] to 1`);
    push("        if ddx < 0 then");
    push(`          set gvx[${k}] to -1`);
    push("        end");
    push("      else");
    push(`        set gvy[${k}] to 1`);
    push("        if ddy < 0 then");
    push(`          set gvy[${k}] to -1`);
    push("        end");
    push("      end");
    push(`      set ogx to gx[${k}]`);
    push(`      set ogy to gy[${k}]`);
    push("      if abs(ddx) > 4 then");
    push(`        change gx[${k}] by gvx[${k}] * 1.0`);
    push("      end");
    push("      if abs(ddy) > 4 then");
    push(`        change gy[${k}] by gvy[${k}] * 1.0`);
    push("      end");
    wallTouch("      ", `gx[${k}]`, `gy[${k}]`);
    push("      if hitw == 1 then");
    push(`        set gx[${k}] to ogx`);
    push(`        set gy[${k}] to ogy`);
    push("      end");
    push(`      set gft[${k}] to gft[${k}] - 1`);
    push(`      if gft[${k}] <= 0 and grace <= 0 then`);
    push(`        set gft[${k}] to 110 + rand(0, 50)`);
    push("        set dd to max(1, abs(ddx) + abs(ddy))");
    for (let s = 0; s < NGS; s++) {
      push(`        if sson[${s}] == 0 and dd < 9000 then`);
      push(`          set sson[${s}] to 1`);
      push(`          set ssx[${s}] to gx[${k}]`);
      push(`          set ssy[${s}] to gy[${k}]`);
      push(`          set ssvx[${s}] to ddx / dd * 3.6`);
      push(`          set ssvy[${s}] to ddy / dd * 3.6`);
      push("          set dd to 9999");
      push("          beep 620 for 0.05");
      push("        end");
    }
    push("      end");
    push("    end");
    // a guard with free hands who reaches you, takes you
    push(`    if gst[${k}] <= 1 and grace <= 0 and abs(gx[${k}] - px) < 11 and abs(gy[${k}] - py) < 11 then`);
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }

  // ---- their rounds
  for (let s = 0; s < NGS; s++) {
    push(`  if sson[${s}] == 1 then`);
    push(`    change ssx[${s}] by ssvx[${s}]`);
    push(`    change ssy[${s}] by ssvy[${s}]`);
    wallTouch("    ", `ssx[${s}]`, `ssy[${s}]`);
    push("    if hitw == 1 then");
    push(`      set sson[${s}] to 0`);
    push("    end");
    push(`    if sson[${s}] == 1 and grace <= 0 and abs(ssx[${s}] - px) < 10 and abs(ssy[${s}] - py) < 10 then`);
    push(`      set sson[${s}] to 0`);
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }

  // ---- caught
  push("  if pdie == 1 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode spy");
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      say "HALT! HALT!" for 1.2');
  push('      set status.text to "CAPTURED — CLICK TO BREAK IN AGAIN"');
  push("    else");
  dealRoom("      ", 240, 300);
  push('      set status.text to lives + " SPIES LEFT — THEY KNOW SOMEONE IS INSIDE"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set ammotx.text to "ROUNDS " + bullets');
  push('  set livestx.text to "SPIES " + lives');
  push('  set itemtx.text to ""');
  push("  if uniform == 1 then");
  push('    set itemtx.text to "UNIFORM"');
  push("  end");
  push("  if plans == 1 then");
  push('    set itemtx.text to itemtx.text + " ✦ PLANS"');
  push("  end");
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set ammotx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set roomtx.visible to (game != 9)");
  push("set itemtx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // the stone borders, doorways gapped
  const borders = [
    ["borderTa", LFT, TOP, GAPX0 - LFT, 0], ["borderTb", GAPX1, TOP, RGT - GAPX1, 0],
    ["borderBa", LFT, BOT, GAPX0 - LFT, 0], ["borderBb", GAPX1, BOT, RGT - GAPX1, 0],
    ["borderLa", LFT, TOP, GAPY0 - TOP, 1], ["borderLb", LFT, GAPY1, BOT - GAPY1, 1],
    ["borderRa", RGT, TOP, GAPY0 - TOP, 1], ["borderRb", RGT, GAPY1, BOT - GAPY1, 1],
  ];
  borders.forEach(([name, x, y, len, vert], i) => {
    objects.push({
      id: "cw_b" + i, name, type: "line",
      x, y, size: len, angle: vert ? 90 : 0, color: STONE, glow: 2, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
    });
  });
  // sealed doorways on the castle's outer edges (and the GREAT DOOR, gold)
  const seals = [
    ["sealL", LFT, GAPY0, GAPY1 - GAPY0, 1, "roomc == 0"],
    ["sealR", RGT, GAPY0, GAPY1 - GAPY0, 1, "roomc == 2"],
    ["sealB", GAPX0, BOT, GAPX1 - GAPX0, 0, "roomr == 2"],
    ["sealT", GAPX0, TOP, GAPX1 - GAPX0, 0, `roomr == 0 and roomn != ${EXIT_ROOM}`],
  ];
  seals.forEach(([name, x, y, len, vert, cond], i) => {
    objects.push({
      id: "cw_s" + i, name, type: "line",
      x, y, size: len, angle: vert ? 90 : 0, color: STONE, glow: 2, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and ${cond})\nend` }]
    });
  });
  objects.push({
    id: "cw_gd", name: "greatdoor", type: "line",
    x: GAPX0, y: TOP, size: GAPX1 - GAPX0, angle: 0, color: GOLD, glow: 8, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and roomn == ${EXIT_ROOM})
set self.glow to 6 + sin(time() * 240) * 4
if plans == 1 then
  set self.color to "${GREEN}"
else
  set self.color to "${GOLD}"
end
end` }]
  });
  // the interior stone (configured each room)
  for (let i = 0; i < 4; i++) {
    objects.push({
      id: "cw_w" + i, name: "wall" + (i + 1), type: "line",
      x: -50, y: -50, size: 10, angle: 0, color: STONE, glow: 2, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and won[${i}] == 1)
set self.x to wx1[${i}]
set self.y to wy1[${i}]
set self.size to wlen[${i}]
set self.angle to wvert[${i}] * 90
end` }]
    });
  }

  // the chests
  for (let j = 0; j < 2; j++) {
    objects.push({
      id: "cw_c" + j, name: "chest" + (j + 1), type: "box",
      x: -50, y: -50, size: 13, color: GOLD, glow: 6, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to ${inGame}
set self.x to c${j}x
set self.y to c${j}y
if copen[c${j}i] == 1 then
  set self.color to "${DIM}"
  set self.glow to 1
else
  set self.color to "${GOLD}"
  set self.glow to 6
end
end` }]
    });
  }

  // the guards — triangles that point where they LOOK — and their gaze
  for (let k = 0; k < NG; k++) {
    objects.push({
      id: "cw_g" + k, name: "guard" + (k + 1), type: "tri",
      x: -50, y: -50, size: 11, color: GUARD, glow: 8, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and gon[${k}] == 1)
set self.x to gx[${k}]
set self.y to gy[${k}]
if gvx[${k}] > 0 then
  set self.angle to 0
end
if gvx[${k}] < 0 then
  set self.angle to 180
end
if gvy[${k}] > 0 then
  set self.angle to 90
end
if gvy[${k}] < 0 then
  set self.angle to 270
end
if gst[${k}] == 2 then
  set self.color to "${WHITE}"
  set self.glow to 3
else
  if gtp[${k}] == 1 then
    set self.color to "${ARMOR}"
  else
    set self.color to "${GUARD}"
  end
  set self.glow to 8
end
end` }]
    });
    objects.push({
      id: "cw_gz" + k, name: "gaze" + (k + 1), type: "line",
      x: -50, y: -50, size: 26, angle: 0, color: RED, glow: 2, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and gon[${k}] == 1 and gst[${k}] != 2)
set self.x to gx[${k}] + gvx[${k}] * 8
set self.y to gy[${k}] + gvy[${k}] * 8
if gvx[${k}] > 0 then
  set self.angle to 0
end
if gvx[${k}] < 0 then
  set self.angle to 180
end
if gvy[${k}] > 0 then
  set self.angle to 90
end
if gvy[${k}] < 0 then
  set self.angle to 270
end
if gst[${k}] == 1 then
  set self.glow to 8
  set self.size to 34
else
  set self.glow to 2
  set self.size to 26
end
end` }]
    });
  }

  // rounds in flight
  objects.push({
    id: "cw_pb", name: "yourround", type: "dot",
    x: -50, y: -50, size: 3, color: CYAN, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and pbon == 1)
set self.x to pbx
set self.y to pby
end` }]
  });
  for (let s = 0; s < NGS; s++) {
    objects.push({
      id: "cw_gs" + s, name: "guardround" + (s + 1), type: "dot",
      x: -50, y: -50, size: 3, color: RED, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and sson[${s}] == 1)
set self.x to ssx[${s}]
set self.y to ssy[${s}]
end` }]
    });
  }

  // the spy (flickers through the entry grace; pulses while searching)
  objects.push({
    id: "cw_p", name: "spy", type: "box",
    x: 240, y: 300, size: 11, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4))
set self.x to px
set self.y to py
if srch > 0 then
  set self.glow to 6 + sin(time() * 600) * 5
else
  set self.glow to 10
end
if uniform == 1 then
  set self.color to "${GUARD}"
else
  set self.color to "${WHITE}"
end
end` }]
  });

  // HUD
  objects.push({ id: "cw_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "cw_am", name: "ammotx", type: "text", x: 160, y: 22, size: 11, color: CYAN, glow: 5, visible: 0, text: "ROUNDS 8", script: [] });
  objects.push({ id: "cw_rm", name: "roomtx", type: "text", x: 285, y: 22, size: 11, color: GOLD, glow: 6, visible: 0, text: "GATE CELLS", script: [] });
  objects.push({ id: "cw_lv", name: "livestx", type: "text", x: 414, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "SPIES 3", script: [] });
  objects.push({ id: "cw_it", name: "itemtx", type: "text", x: 240, y: 40, size: 9, color: GREEN, glow: 5, visible: 0, text: "", script: [] });
  objects.push({ id: "cw_st", name: "status", type: "text", x: W / 2, y: 352, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "cw_big", name: "bigtitle", type: "text", x: W / 2, y: 108, size: 36, color: STONE, glow: 16, visible: 1, text: "CASTLE WOLFENSTEIN", script: [] });
  objects.push({ id: "cw_sub", name: "subline", type: "text", x: W / 2, y: 140, size: 10, color: DIM, glow: 4, visible: 1, text: "MUSE SOFTWARE 1981 · APPLE II · ANCESTOR OF THE STEALTH GENRE", script: [] });
  objects.push({ id: "cw_coin", name: "coinline", type: "text", x: W / 2, y: 172, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO BREAK IN ◎", script: [] });
  objects.push({ id: "cw_play", name: "playbtn", type: "text", x: W / 2, y: 210, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ BREAK IN ]", script: [] });
  objects.push({
    id: "cw_help", name: "help", type: "text",
    x: W / 2, y: 244, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD SNEAKS · E HOLDS UP GUARDS + SEARCHES CHESTS · SPACE IS LOUD",
    script: []
  });
  objects.push({
    id: "cw_help2", name: "help2", type: "text",
    x: W / 2, y: 262, size: 9, color: DIM, glow: 3, visible: 1,
    text: "GUARDS SEE ONLY WHERE THEY FACE — FIND THE PLANS, GO NORTH",
    script: []
  });

  objects.push({
    id: "cw_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "cw_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "SNEAK", script: [] });

  return { title: "Castle Wolfenstein (1981)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

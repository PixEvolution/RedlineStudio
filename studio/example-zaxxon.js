// example-zaxxon.js — ZAXXON (1982), rebuilt in our studio.
//
// Sega's fortress run was the first arcade game drawn in AXONOMETRIC
// projection — the world at a diagonal, with a third axis no shooter had
// ever used: ALTITUDE. The genius wasn't the angle, it was making height
// READABLE: your shadow on the deck and an altimeter told you exactly how
// high you flew, because walls, force fields and gun turrets all cared.
// And the famous paradox: you refuel by SHOOTING your own fuel dumps.
// The fortress robot at the end is Sega's; ours is THE GUARDIAN.
//
// The 1982 design, faithfully:
//   · fly the diagonal: W/S climb and dive, A/D slide across the deck —
//     watch the SHADOW, it never lies
//   · low walls to clear, high walls with one lit WINDOW to thread,
//     force fields to slip between the beams
//   · turrets lead your altitude · fuel dumps pay 100 AND +15 fuel —
//     the tank drains as you fly, and empty is a crash
//   · past the wall: open space and a wing of drones
//   · then THE GUARDIAN: scroll stops, missiles home, its core takes
//     six hits — 500 a hit, 3000 for the kill, then a faster fortress
//
//   WASD / arrows / stick fly · SPACE fires · 3 SHIPS

const W = 480, H = 360;
// iso basis: U (flight, up-right), V (lateral, down-right), H (altitude, up)
const BX = 176, BY = 234;                 // ship's ground anchor (v = 2)
const UX = 2.6, UY = -1.3, VX = 34, VY = 17, HZ = 13;
const VANG = 26.6;                         // screen angle of the V axis
const SPACE_AT = 2400, BOSS_AT = 3000;    // fortress → space → the Guardian
const NSH = 2, NTS = 2, NDR = 6, NMS = 2;
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", STEEL = "#8b95a8", MAGENTA = "#ff6ad5";

// ---- the fortress strip (deterministic layout)
// type: 0 low wall · 1 window wall · 2 force field · 3 turret · 4 fuel · 5 plane
const EVENTS = [];
{
  let seed = 1982;
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  let u = 160;
  const kinds = [3, 4, 0, 3, 5, 4, 2, 3, 4, 1, 5, 3, 4, 0, 3, 4, 2, 5, 3, 4, 1, 3, 4, 0, 2, 4, 3, 5, 4, 1, 3, 4];
  for (const t of kinds) {
    if (u > 2260) break;
    if (t === 0) EVENTS.push([u, 0, 2, 2.4]);                                  // clear at h > 2.4
    else if (t === 1) EVENTS.push([u, 1, Math.floor(rnd() * 5), 1.6 + rnd() * 2.4]); // the window
    else if (t === 2) EVENTS.push([u, 2, 2, 1.1 + rnd() * 1.6]);               // beams: lo at h
    else EVENTS.push([u, t, Math.floor(rnd() * 5), 0]);                        // deck items
    u += 58 + Math.floor(rnd() * 32);
  }
}
const NEV = EVENTS.length;

export function buildZaxxonExample() {
  const L = [];
  const push = (s) => L.push(s);

  const resetShip = (pad) => {
    push(`${pad}set sv to 2`);
    push(`${pad}set sh to 2.5`);
    push(`${pad}set grace to 90`);
    for (let s = 0; s < NSH; s++) push(`${pad}set son[${s}] to 0`);
    for (let s = 0; s < NTS; s++) push(`${pad}set tson[${s}] to 0`);
    for (let m = 0; m < NMS; m++) push(`${pad}set mon[${m}] to 0`);
  };

  const dealLap = (pad) => {
    push(`${pad}set u to 0`);
    push(`${pad}set bosson to 0`);
    push(`${pad}set bosshp to 6`);
    push(`${pad}set drspawn to 0`);
    for (let d = 0; d < NDR; d++) push(`${pad}set dron[${d}] to 0`);
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${NEV}`);
    push(`${pad}  set et[i] to et0[i]`);
    push(`${pad}  set tcool[i] to 60`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set level to 1`);
    push(`${pad}set fuel to 99`);
    push(`${pad}set tik to 0`);
    dealLap(pad);
    resetShip(pad);
    push(`${pad}set status.text to "WATCH THE SHADOW. SHOOT THE FUEL DUMPS."`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set level to 1");
  push("set tik to 0");
  EVENTS.forEach(([eu, et, ev, eh], i) => {
    push(`set eu[${i}] to ${eu}`);
    push(`set et0[${i}] to ${et}`);
    push(`set ev[${i}] to ${ev}`);
    push(`set eh[${i}] to ${eh.toFixed(2)}`);
  });
  dealLap("");
  resetShip("");
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO LAUNCH ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO LAUNCH ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  push("  set pdie to 0");

  // ---- phase from distance flown
  push("  set phase to 0");
  push(`  if u >= ${SPACE_AT} then`);
  push("    set phase to 1");
  push("  end");
  push(`  if u >= ${BOSS_AT} then`);
  push("    set phase to 2");
  push("  end");

  // ---- fly
  push(`  set lvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  set lvy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push("  set sv to max(0, min(4, sv + lvx * 0.05))");
  push("  set sh to max(0.25, min(5.2, sh - lvy * 0.06))");
  push("  if phase <= 1 then");
  push("    change u by 1.1 + level * 0.08");
  push("  end");
  // ship + shadow on screen
  push(`  set ssx to ${BX} + (sv - 2) * ${VX}`);
  push(`  set sgy to ${BY} + (sv - 2) * ${VY}`);
  push(`  set ssy to sgy - sh * ${HZ}`);

  // ---- fuel burns
  push(`  if tik % max(24, 36 - level * 2) == 0 and grace <= 0 then`);
  push("    set fuel to fuel - 1");
  push("    if fuel <= 0 then");
  push("      set pdie to 1");
  push('      set status.text to "FLAMEOUT — THE TANK RAN DRY"');
  push("    end");
  push("  end");

  // ---- your cannon
  push(`  set fk to keydown("Space")`);
  push("  if fk == 1 and fk0 == 0 then");
  for (let s = 0; s < NSH; s++) {
    push(`    if fk == 1 and son[${s}] == 0 then`);
    push(`      set son[${s}] to 1`);
    push(`      set sd[${s}] to 4`);
    push(`      set ssv[${s}] to sv`);
    push(`      set ssh[${s}] to sh`);
    push("      set fk to 2");
    push("      beep 760 for 0.04");
    push("    end");
  }
  push("  end");
  push("  set fk0 to min(1, fk)");
  for (let s = 0; s < NSH; s++) {
    push(`  if son[${s}] == 1 then`);
    push(`    change sd[${s}] by 3.4`);
    push(`    if sd[${s}] > 120 then`);
    push(`      set son[${s}] to 0`);
    push("    end");
    push("  end");
  }

  // ---- the fortress: one pass over every event
  push("  set wsl to 0");
  push("  set rsl to 0");
  push("  set fsl to 0");
  push("  set tsl to 0");
  push("  set usl to 0");
  push("  set psl to 0");
  push("  set i to 0");
  push(`  repeat ${NEV}`);
  push("    if et[i] != 9 then");
  push("      set d to eu[i] - u");
  push("      if d > -4 and d < 112 then");
  push(`        set gx to ${BX} + d * ${UX}`);
  push(`        set gy to ${BY} + d * ${UY}`);
  // --- hand the nearest of each kind to its display pool
  push("      if et[i] <= 1 and wsl < 3 then");
  push("        set wallx[wsl] to gx");
  push("        set wally[wsl] to gy");
  push("        set wallh[wsl] to eh[i]");
  push("        if et[i] == 1 then");
  push("          set wallh[wsl] to 5.5");
  push("          if rsl < 3 then");
  push(`            set ringx[rsl] to gx + (ev[i] - 2) * ${VX}`);
  push(`            set ringy[rsl] to gy + (ev[i] - 2) * ${VY} - eh[i] * ${HZ}`);
  push("            set rsl to rsl + 1");
  push("          end");
  push("        end");
  push("        set wsl to wsl + 1");
  push("      end");
  push("      if et[i] == 2 and fsl < 2 then");
  push("        set fldx[fsl] to gx");
  push("        set fldy[fsl] to gy");
  push("        set fldl[fsl] to eh[i]");
  push("        set fsl to fsl + 1");
  push("      end");
  push("      if et[i] == 3 and tsl < 3 then");
  push(`        set turx[tsl] to gx + (ev[i] - 2) * ${VX}`);
  push(`        set tury[tsl] to gy + (ev[i] - 2) * ${VY}`);
  push("        set tsl to tsl + 1");
  push("      end");
  push("      if et[i] == 4 and usl < 3 then");
  push(`        set fux[usl] to gx + (ev[i] - 2) * ${VX}`);
  push(`        set fuy[usl] to gy + (ev[i] - 2) * ${VY}`);
  push("        set usl to usl + 1");
  push("      end");
  push("      if et[i] == 5 and psl < 2 then");
  push(`        set plx[psl] to gx + (ev[i] - 2) * ${VX}`);
  push(`        set ply[psl] to gy + (ev[i] - 2) * ${VY}`);
  push("        set psl to psl + 1");
  push("      end");
  // --- turrets lead your altitude
  push("      if et[i] == 3 and d > 25 and d < 95 then");
  push("        set tcool[i] to tcool[i] - 1");
  push("        if tcool[i] <= 0 then");
  push(`          set tcool[i] to max(90, 150 - level * 10)`);
  for (let s = 0; s < NTS; s++) {
    push(`          if tson[${s}] == 0 and tcool[i] > 0 then`);
    push(`            set tson[${s}] to 1`);
    push(`            set tsd[${s}] to d`);
    push(`            set tsv[${s}] to ev[i]`);
    push(`            set tsh[${s}] to sh`);
    push("            set tcool[i] to 0 - tcool[i]");
    push("            beep 620 for 0.04");
    push("          end");
  }
  push("          set tcool[i] to abs(tcool[i])");
  push("        end");
  push("      end");
  // --- your shots strike the deck and the walls
  for (let s = 0; s < NSH; s++) {
    push(`      if son[${s}] == 1 and abs(sd[${s}] - d) < 3.2 then`);
    push("        if et[i] >= 3 then");
    push(`          if abs(ssv[${s}] - ev[i]) < 0.8 and ssh[${s}] < 1.7 then`);
    push(`            set son[${s}] to 0`);
    push("            if et[i] == 3 then");
    push("              change score by 200");
    push("            end");
    push("            if et[i] == 4 then");
    push("              change score by 100");
    push("              set fuel to min(99, fuel + 15)");
    push('              set status.text to "FUEL DUMP — +100 AND +15 FUEL"');
    push("            end");
    push("            if et[i] == 5 then");
    push("              change score by 150");
    push("            end");
    push("            set et[i] to 9");
    push("            beep 140 for 0.08");
    push("          end");
    push("        else");
    push("          if et[i] == 0 then");
    push(`            if ssh[${s}] < eh[i] then`);
    push(`              set son[${s}] to 0`);
    push("            end");
    push("          end");
    push("          if et[i] == 1 then");
    push(`            if abs(ssv[${s}] - ev[i]) > 0.7 or abs(ssh[${s}] - eh[i]) > 0.9 then`);
    push(`              set son[${s}] to 0`);
    push("            end");
    push("          end");
    push("        end");
    push("      end");
  }
  // --- the moment of truth at the wall
  push("      if d > -2.4 and d < 2.4 and grace <= 0 then");
  push("        if et[i] == 0 and sh < eh[i] then");
  push("          set pdie to 1");
  push('          set status.text to "INTO THE WALL — CLIMB NEXT TIME"');
  push("        end");
  push("        if et[i] == 1 then");
  push("          if abs(sv - ev[i]) > 0.7 or abs(sh - eh[i]) > 0.9 then");
  push("            set pdie to 1");
  push('            set status.text to "THE WINDOW IS THE ONLY WAY THROUGH"');
  push("          end");
  push("        end");
  push("        if et[i] == 2 then");
  push("          if sh < eh[i] or sh > eh[i] + 2.2 then");
  push("            set pdie to 1");
  push('            set status.text to "BETWEEN THE BEAMS — NOT THROUGH THEM"');
  push("          end");
  push("        end");
  push("      end");
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // ---- turret fire inbound
  for (let s = 0; s < NTS; s++) {
    push(`  if tson[${s}] == 1 then`);
    push(`    change tsd[${s}] by -2.6`);
    push(`    if tsd[${s}] < -6 then`);
    push(`      set tson[${s}] to 0`);
    push("    end");
    push(`    if grace <= 0 and abs(tsd[${s}]) < 2.4 and abs(tsv[${s}] - sv) < 0.6 and abs(tsh[${s}] - sh) < 0.8 then`);
    push(`      set tson[${s}] to 0`);
    push("      set pdie to 1");
    push('      set status.text to "TURRET FIRE — CHANGE ALTITUDE, THEY LEAD"');
    push("    end");
    push("  end");
  }

  // ---- open space: the drone wing
  push("  if phase == 1 then");
  push(`    if drspawn < ${NDR} and tik % 50 == 0 then`);
  for (let d = 0; d < NDR; d++) {
    push(`      if dron[${d}] == 0 and drspawn < ${NDR} and drdead[${d}] != level then`);
    push(`        set dron[${d}] to 1`);
    push(`        set drd[${d}] to 125`);
    push(`        set drv[${d}] to floor(rand(0, 5))`);
    push(`        set drh[${d}] to 0.8 + rand(0, 3.6)`);
    push("        set drspawn to drspawn + 1");
    push("      end");
  }
  push("    end");
  push("  end");
  for (let d = 0; d < NDR; d++) {
    push(`  if dron[${d}] == 1 then`);
    push(`    change drd[${d}] by -1.9`);
    push(`    if drd[${d}] < -8 then`);
    push(`      set dron[${d}] to 0`);
    push("    end");
    for (let s = 0; s < NSH; s++) {
      push(`    if dron[${d}] == 1 and son[${s}] == 1 and abs(sd[${s}] - drd[${d}]) < 4 and abs(ssv[${s}] - drv[${d}]) < 0.8 and abs(ssh[${s}] - drh[${d}]) < 1 then`);
      push(`      set son[${s}] to 0`);
      push(`      set dron[${d}] to 0`);
      push(`      set drdead[${d}] to level`);
      push(`      explode drone${d + 1}`);
      push("      change score by 300");
      push("      beep 140 for 0.08");
      push("    end");
    }
    push(`    if dron[${d}] == 1 and grace <= 0 and abs(drd[${d}]) < 2.6 and abs(drv[${d}] - sv) < 0.6 and abs(drh[${d}] - sh) < 0.9 then`);
    push(`      set dron[${d}] to 0`);
    push("      set pdie to 1");
    push('      set status.text to "RAMMED IN OPEN SPACE"');
    push("    end");
    push("  end");
  }

  // ---- THE GUARDIAN
  push("  if phase == 2 then");
  push("    if bosson == 0 then");
  push("      set bosson to 1");
  push('      say "THE GUARDIAN WAKES." for 1.4');
  push("      beep 98 for 0.2");
  push("      beep 98 for 0.2");
  push('      set status.text to "SIX HITS ON THE CORE — DODGE WHAT IT SENDS"');
  push("    end");
  push("    if tik % max(120, 200 - level * 15) == 0 then");
  for (let m = 0; m < NMS; m++) {
    push(`      if mon[${m}] == 0 and tik % 2 == ${m % 2} or (mon[${m}] == 0 and ${m} == 0) then`);
    push(`      if mon[${m}] == 0 then`);
    push(`        set mon[${m}] to 1`);
    push(`        set md[${m}] to 62`);
    push(`        set mv[${m}] to 2`);
    push(`        set mh[${m}] to 2.5`);
    push("        beep 494 for 0.08");
    push("      end");
    push("      end");
  }
  push("    end");
  for (let m = 0; m < NMS; m++) {
    push(`    if mon[${m}] == 1 then`);
    push(`      change md[${m}] by -0.9`);
    push(`      set mv[${m}] to mv[${m}] + (sv - mv[${m}]) * 0.035`);
    push(`      set mh[${m}] to mh[${m}] + (sh - mh[${m}]) * 0.035`);
    push(`      if md[${m}] < -6 then`);
    push(`        set mon[${m}] to 0`);
    push("      end");
    for (let s = 0; s < NSH; s++) {
      push(`      if mon[${m}] == 1 and son[${s}] == 1 and abs(sd[${s}] - md[${m}]) < 4 and abs(ssv[${s}] - mv[${m}]) < 0.8 and abs(ssh[${s}] - mh[${m}]) < 1 then`);
      push(`        set son[${s}] to 0`);
      push(`        set mon[${m}] to 0`);
      push("        change score by 150");
      push("        beep 140 for 0.06");
      push("      end");
    }
    push(`      if mon[${m}] == 1 and grace <= 0 and abs(md[${m}]) < 2.4 and abs(mv[${m}] - sv) < 0.6 and abs(mh[${m}] - sh) < 0.8 then`);
    push(`        set mon[${m}] to 0`);
    push("        set pdie to 1");
    push('        set status.text to "THE MISSILE FOUND YOU"');
    push("      end");
    push("    end");
  }
  // your shots on the core
  for (let s = 0; s < NSH; s++) {
    push(`    if son[${s}] == 1 and bosshp > 0 and abs(sd[${s}] - 62) < 4 and abs(ssv[${s}] - 2) < 0.9 and abs(ssh[${s}] - 2.5) < 1.1 then`);
    push(`      set son[${s}] to 0`);
    push("      set bosshp to bosshp - 1");
    push("      change score by 500");
    push("      beep 330 for 0.08");
    push('      set status.text to "CORE HIT — " + bosshp + " TO GO"');
    push("      if bosshp <= 0 then");
    push("        change score by 3000");
    push("        explode guardiancore");
    push('        say "THE FORTRESS FALLS." for 1.4');
    push("        beep 523 for 0.1");
    push("        beep 659 for 0.1");
    push("        beep 784 for 0.1");
    push("        beep 1047 for 0.2");
    push("        set level to level + 1");
    push("        set fuel to 99");
    dealLap("        ");
    resetShip("        ");
    push('        set status.text to "+3000 — FORTRESS " + level + ": FASTER, THIRSTIER, MEANER"');
    push("      end");
    push("    end");
  }
  push("  end");

  // ---- a ship lost
  push("  if pdie == 1 and game == 0 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode fighter");
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "THE FORTRESS HOLDS — SCORE " + score + " — CLICK TO LAUNCH AGAIN"');
  push("    else");
  resetShip("      ");
  push("      set fuel to max(fuel, 60)");
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "SHIPS " + lives');
  push('  set leveltx.text to "FORTRESS " + level');
  push('  set fueltx.text to "FUEL " + fuel');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set leveltx.visible to (game != 9)");
  push("set fueltx.visible to (game != 9)");
  push("set alttag.visible to (game == 0)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // the deck: scrolling iso floor lines (fortress only)
  for (let i = 0; i < 8; i++) {
    objects.push({
      id: "zx_f" + i, name: "deckline" + (i + 1), type: "line",
      x: 0, y: 0, size: 196, angle: VANG, color: "#26303d", glow: 1, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set dd to ${i} * 14 - u % 14
set self.visible to (${inGame} and phase == 0)
set self.x to ${BX} + dd * ${UX} - 98
set self.y to ${BY} + dd * ${UY} - 49
end` }]
    });
  }
  // stars for open space
  for (let i = 0; i < 6; i++) {
    objects.push({
      id: "zx_st" + i, name: "star" + (i + 1), type: "dot",
      x: 60 + i * 70, y: 60 + (i % 3) * 90, size: 2, color: DIM, glow: 3, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and phase >= 1)\nend` }]
    });
  }
  // wall pool: base + top line each
  for (let k = 0; k < 3; k++) {
    for (const part of ["base", "top"]) {
      objects.push({
        id: "zx_w" + k + part, name: "wall" + (k + 1) + part, type: "line",
        x: -90, y: -90, size: 180, angle: VANG, color: STEEL, glow: 3, visible: 0, text: "",
        script: [{
          event: "code", source: `when tick
set self.visible to (${inGame} and wsl > ${k})
set self.x to wallx[${k}] - 90
set self.y to wally[${k}] - 45${part === "top" ? ` - wallh[${k}] * ${HZ}` : ""}
end` }]
      });
    }
  }
  // the lit windows
  for (let k = 0; k < 3; k++) {
    objects.push({
      id: "zx_r" + k, name: "window" + (k + 1), type: "ring",
      x: -90, y: -90, size: 13, color: CYAN, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and rsl > ${k})
set self.x to ringx[${k}]
set self.y to ringy[${k}]
set self.glow to 8 + sin(time() * 400) * 4
end` }]
    });
  }
  // force fields: two beams
  for (let k = 0; k < 2; k++) {
    for (const part of [0, 1]) {
      objects.push({
        id: "zx_ff" + k + part, name: "beam" + (k + 1) + (part ? "hi" : "lo"), type: "line",
        x: -90, y: -90, size: 180, angle: VANG, color: MAGENTA, glow: 6, visible: 0, text: "",
        script: [{
          event: "code", source: `when tick
set self.visible to (${inGame} and fsl > ${k})
set self.x to fldx[${k}] - 90
set self.y to fldy[${k}] - 45 - (fldl[${k}]${part ? " + 2.2" : ""}) * ${HZ}
set self.glow to 5 + sin(time() * 500 + ${part * 90}) * 3
end` }]
      });
    }
  }
  // turrets, fuel dumps, parked planes
  for (let k = 0; k < 3; k++) {
    objects.push({
      id: "zx_t" + k, name: "turret" + (k + 1), type: "tri",
      x: -90, y: -90, size: 9, color: RED, glow: 8, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and tsl > ${k})
set self.x to turx[${k}]
set self.y to tury[${k}] - 5
set self.angle to 196
end` }]
    });
    objects.push({
      id: "zx_u" + k, name: "fueldump" + (k + 1), type: "box",
      x: -90, y: -90, size: 10, color: GOLD, glow: 9, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and usl > ${k})
set self.x to fux[${k}]
set self.y to fuy[${k}] - 6
set self.glow to 7 + sin(time() * 300 + ${k * 70}) * 3
end` }]
    });
  }
  for (let k = 0; k < 2; k++) {
    objects.push({
      id: "zx_pl" + k, name: "parkedplane" + (k + 1), type: "text",
      x: -90, y: -90, size: 13, color: DIM, glow: 4, visible: 0, text: "➤",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and psl > ${k})
set self.x to plx[${k}]
set self.y to ply[${k}] - 6
end` }]
    });
  }
  // turret fire and your fire
  for (let s = 0; s < NTS; s++) {
    objects.push({
      id: "zx_ts" + s, name: "turretfire" + (s + 1), type: "dot",
      x: -90, y: -90, size: 3, color: RED, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and tson[${s}] == 1)
set self.x to ${BX} + tsd[${s}] * ${UX} + (tsv[${s}] - 2) * ${VX}
set self.y to ${BY} + tsd[${s}] * ${UY} + (tsv[${s}] - 2) * ${VY} - tsh[${s}] * ${HZ}
end` }]
    });
  }
  for (let s = 0; s < NSH; s++) {
    objects.push({
      id: "zx_s" + s, name: "yourshot" + (s + 1), type: "dot",
      x: -90, y: -90, size: 3, color: CYAN, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and son[${s}] == 1)
set self.x to ${BX} + sd[${s}] * ${UX} + (ssv[${s}] - 2) * ${VX}
set self.y to ${BY} + sd[${s}] * ${UY} + (ssv[${s}] - 2) * ${VY} - ssh[${s}] * ${HZ}
end` }]
    });
  }
  // drones and missiles
  for (let d = 0; d < NDR; d++) {
    objects.push({
      id: "zx_d" + d, name: "drone" + (d + 1), type: "text",
      x: -90, y: -90, size: 14, color: MAGENTA, glow: 9, visible: 0, text: "◄",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and dron[${d}] == 1)
set self.x to ${BX} + drd[${d}] * ${UX} + (drv[${d}] - 2) * ${VX}
set self.y to ${BY} + drd[${d}] * ${UY} + (drv[${d}] - 2) * ${VY} - drh[${d}] * ${HZ}
end` }]
    });
  }
  for (let m = 0; m < NMS; m++) {
    objects.push({
      id: "zx_m" + m, name: "missile" + (m + 1), type: "dot",
      x: -90, y: -90, size: 4, color: RED, glow: 12, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and mon[${m}] == 1)
set self.x to ${BX} + md[${m}] * ${UX} + (mv[${m}] - 2) * ${VX}
set self.y to ${BY} + md[${m}] * ${UY} + (mv[${m}] - 2) * ${VY} - mh[${m}] * ${HZ}
set self.size to 3 + sin(time() * 700) * 1.5
end` }]
    });
  }
  // THE GUARDIAN: torso and core
  objects.push({
    id: "zx_bt", name: "guardianbody", type: "box",
    x: BX + 62 * UX, y: BY + 62 * UY - 2.5 * HZ, size: 34, color: STEEL, glow: 4, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and phase == 2 and bosshp > 0)\nend` }]
  });
  objects.push({
    id: "zx_bc", name: "guardiancore", type: "ring",
    x: BX + 62 * UX, y: BY + 62 * UY - 2.5 * HZ, size: 9, color: RED, glow: 14, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and phase == 2 and bosshp > 0)
set self.size to 8 + sin(time() * 500) * 3
end` }]
  });
  // the ship, its shadow, and the altitude pole between them
  objects.push({
    id: "zx_sh", name: "shadow", type: "dot",
    x: BX, y: BY, size: 5, color: "#223044", glow: 0, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and phase != 1)
set self.x to ssx
set self.y to sgy
end` }]
  });
  objects.push({
    id: "zx_pole", name: "altpole", type: "line",
    x: BX, y: BY, size: 30, angle: 270, color: "#2a3850", glow: 0, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and phase != 1)
set self.x to ssx
set self.y to sgy
set self.size to sh * ${HZ}
end` }]
  });
  objects.push({
    id: "zx_p", name: "fighter", type: "tri",
    x: BX, y: BY - 32, size: 12, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4))
set self.x to ssx
set self.y to ssy
set self.angle to 333
end` }]
  });
  // the altimeter
  objects.push({
    id: "zx_alt", name: "altimeter", type: "line",
    x: 24, y: 330, size: 30, angle: 270, color: GREEN, glow: 6, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to ${inGame}
set self.size to sh * ${HZ}
end` }]
  });
  objects.push({ id: "zx_at", name: "alttag", type: "text", x: 26, y: 344, size: 8, color: DIM, glow: 3, visible: 0, text: "ALT", script: [] });

  // HUD
  objects.push({ id: "zx_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "zx_fu", name: "fueltx", type: "text", x: 180, y: 22, size: 12, color: GOLD, glow: 6, visible: 0, text: "FUEL 99", script: [] });
  objects.push({ id: "zx_le", name: "leveltx", type: "text", x: 300, y: 22, size: 11, color: CYAN, glow: 5, visible: 0, text: "FORTRESS 1", script: [] });
  objects.push({ id: "zx_lv", name: "livestx", type: "text", x: 420, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "SHIPS 3", script: [] });
  objects.push({ id: "zx_stx", name: "status", type: "text", x: W / 2, y: 358, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "zx_big", name: "bigtitle", type: "text", x: W / 2, y: 104, size: 42, color: CYAN, glow: 18, visible: 1, text: "ZAXXON", script: [] });
  objects.push({ id: "zx_sub", name: "subline", type: "text", x: W / 2, y: 136, size: 10, color: DIM, glow: 4, visible: 1, text: "SEGA 1982 · FIRST AXONOMETRIC 3D ARCADE", script: [] });
  objects.push({ id: "zx_coin", name: "coinline", type: "text", x: W / 2, y: 168, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO LAUNCH ◎", script: [] });
  objects.push({ id: "zx_play", name: "playbtn", type: "text", x: W / 2, y: 206, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ LAUNCH ]", script: [] });
  objects.push({
    id: "zx_help", name: "help", type: "text",
    x: W / 2, y: 240, size: 9, color: DIM, glow: 3, visible: 1,
    text: "W/S CLIMB · A/D SLIDE · WATCH YOUR SHADOW",
    script: []
  });
  objects.push({
    id: "zx_help2", name: "help2", type: "text",
    x: W / 2, y: 258, size: 9, color: DIM, glow: 3, visible: 1,
    text: "THREAD LIT WINDOWS · FUEL DUMPS REFUEL YOU",
    script: []
  });

  objects.push({
    id: "zx_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "zx_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "FLY", script: [] });

  return { title: "Zaxxon (1982)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

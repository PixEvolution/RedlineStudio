// example-galaga.js — GALAGA (1981), rebuilt in our studio.
//
// Namco's sequel to Galaxian, and the one everybody remembers for a single
// terrifying invention: the TRACTOR BEAM. A boss descends, opens a cone of
// light, and STEALS YOUR SHIP — it flies for the enemy until you shoot the
// boss that carries it, and the freed fighter docks beside you as a DUAL
// FIGHTER with twice the guns. Risking a ship to get two is the whole game.
//
// The 1981 machine, faithfully:
//   · waves FLY IN along looping entrance paths before settling into the
//     convoy — nothing just appears
//   · three ranks: bees (50, 100 diving) · butterflies (80, 160 diving)
//     · BOSSES that take TWO hits (150, 400 diving)
//   · the TRACTOR BEAM: get caught and that fighter is THEIRS — captured
//     on your last life, the game is over on the spot
//   · the RESCUE: kill the carrying boss and the fighter docks — DUAL
//     fighter, double shots, double width (+1000)
//   · a hit on the dual costs the partner, not a life
//   · every third wave is a CHALLENGING STAGE: they fly through without
//     firing — 100 a kill, all 24 for a PERFECT 10000
//
//   A/D / stick slides the fighter · SPACE fires (two shots a fighter)

const W = 360, H = 480;
const NEN = 24, NSHOT = 4, NBOMB = 3;
const PY = 430;
// formation: 4 bosses, 8 butterflies, 12 bees
const SLOT = [];
for (let c = 0; c < 4; c++) SLOT.push([108 + c * 48, 70, 3]);              // bosses
for (let c = 0; c < 8; c++) SLOT.push([76 + c * 30, 102, 2]);              // butterflies
for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) SLOT.push([60 + c * 48, 134 + r * 30, 1]);   // bees
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  RED = "#ff6666", CYAN = "#7ddfff", PURPLE = "#b48cff";

export function buildGalagaExample() {
  const L = [];
  const push = (s) => L.push(s);

  const dealWave = (pad, challenge) => {
    push(`${pad}set chstage to ${challenge}`);
    push(`${pad}set chkills to 0`);
    push(`${pad}set divet to 160`);
    push(`${pad}set beamon to 0`);
    for (let i = 0; i < NEN; i++) {
      const [sx, sy, tp] = SLOT[i];
      push(`${pad}set es[${i}] to 1`);
      push(`${pad}set etp[${i}] to ${tp}`);
      push(`${pad}set ehp[${i}] to ${tp === 3 ? 2 : 1}`);
      push(`${pad}set sx[${i}] to ${sx}`);
      push(`${pad}set sy[${i}] to ${sy}`);
      push(`${pad}set psx[${i}] to ${i % 2 === 0 ? -30 : 390}`);
      push(`${pad}set psy[${i}] to ${160 + (i % 5) * 40}`);
      push(`${pad}set pt[${i}] to 0 - ${(i % 8) * 14} * 0.012`);
      // challengers fly THROUGH: their target is the far exit, not a slot
      push(`${pad}if chstage == 1 then`);
      push(`${pad}  set sx[${i}] to ${i % 2 === 0 ? 400 : -40}`);
      push(`${pad}  set sy[${i}] to ${40 + (i % 6) * 30}`);
      push(`${pad}end`);
      push(`${pad}set ex[${i}] to psx[${i}]`);
      push(`${pad}set ey[${i}] to psy[${i}]`);
    }
    // the carried fighter survives wave changes aboard boss 0
    push(`${pad}if capboss >= 0 then`);
    push(`${pad}  set capboss to 0`);
    push(`${pad}end`);
    for (let j = 0; j < NSHOT; j++) push(`${pad}set son[${j}] to 0`);
    for (let b = 0; b < NBOMB; b++) push(`${pad}set bon[${b}] to 0`);
    push(`${pad}if chstage == 1 then`);
    push(`${pad}  set status.text to "CHALLENGING STAGE — NO FIRE. ALL 24 = 10000"`);
    push(`${pad}else`);
    push(`${pad}  set status.text to "WAVE " + wave`);
    push(`${pad}end`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set wave to 1`);
    push(`${pad}set dual to 0`);
    push(`${pad}set capboss to 0 - 1`);
    push(`${pad}set px to 180`);
    push(`${pad}set grace to 60`);
    dealWave(pad, 0);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set wave to 1");
  push("set dual to 0");
  push("set capboss to 0 - 1");
  push("set px to 180");
  dealWave("", 0);
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO LAUNCH ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO LAUNCH ◎"');
  push("end");

  push("if game == 0 then");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  // ---- the fighter
  push(`  set mvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push("  set px to max(24, min(336, px + mvx * 2.6))");
  push("  set fox to sin(time() * 40) * 20");
  // ---- fire: two live shots per fighter
  push('  set pf to keydown("Space")');
  push("  if pf == 1 and pf0 == 0 then");
  push("    set livecnt to 0");
  for (let j = 0; j < NSHOT; j++) push(`    set livecnt to livecnt + son[${j}]`);
  push("    set allowed to 2 + dual * 2");
  push("    set fired to 0");
  for (let j = 0; j < NSHOT; j++) {
    push(`    if son[${j}] == 0 and livecnt < allowed and fired < 1 + dual then`);
    push(`      set son[${j}] to 1`);
    push(`      set sxx[${j}] to px + fired * 14 - dual * 7`);
    push(`      set syy[${j}] to ${PY - 12}`);
    push("      set fired to fired + 1");
    push("      set livecnt to livecnt + 1");
    push("    end");
  }
  push("    if fired > 0 then");
  push("      beep 740 for 0.04");
  push("    end");
  push("  end");
  push("  set pf0 to pf");
  for (let j = 0; j < NSHOT; j++) {
    push(`  if son[${j}] == 1 then`);
    push(`    change syy[${j}] by -7`);
    push(`    if syy[${j}] < -6 then`);
    push(`      set son[${j}] to 0`);
    push("    end");
    push("  end");
  }

  // ---- the convoy lives
  push("  set alive to 0");
  push("  set settled to 0");
  push("  set i to 0");
  push(`  repeat ${NEN}`);
  push("    if es[i] > 0 then");
  push("      set alive to alive + 1");
  push("    end");
  push("    if es[i] == 2 then");
  push("      set settled to settled + 1");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // entrance flights (and challenge fly-throughs)
  push("  set i to 0");
  push(`  repeat ${NEN}`);
  push("    if es[i] == 1 then");
  push("      set pt[i] to pt[i] + 0.011");
  push("      if pt[i] >= 0 then");
  push("        set tt to min(1, pt[i])");
  push("        set ex[i] to psx[i] + (sx[i] - psx[i]) * tt + sin(tt * 540 + i * 40) * 70 * (1 - tt)");
  push("        set ey[i] to psy[i] + (sy[i] - psy[i]) * tt + sin(tt * 720) * 30 * (1 - tt)");
  push("        if pt[i] >= 1 then");
  push("          if chstage == 1 then");
  push("            set es[i] to 0");   // flown through, and gone
  push("          else");
  push("            set es[i] to 2");
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("    if es[i] == 2 then");
  push("      set ex[i] to sx[i] + fox");
  push("      set ey[i] to sy[i]");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // ---- dives and THE BEAM (never in a challenging stage)
  push("  if chstage == 0 then");
  push("    set divet to divet - 1");
  push("    if divet <= 0 and settled > 0 then");
  push("      set divet to max(70, 170 - wave * 10)");
  push("      set pick to floor(rand(0, " + NEN + "))");
  push("      set tries to 0");
  push("      repeat " + NEN);
  push("        if es[pick] != 2 and tries < " + NEN + " then");
  push(`          set pick to (pick + 1) % ${NEN}`);
  push("          set tries to tries + 1");
  push("        end");
  push("      end");
  push("      if es[pick] == 2 then");
  push("        if etp[pick] == 3 and beamon == 0 and capboss != pick and dual == 0 and rand(0, 1) < 0.5 then");
  push("          set es[pick] to 4");
  push("          set bt[pick] to 0");
  push("          set beamon to 1");
  push("          beep 196 for 0.15");
  push("        else");
  push("          set es[pick] to 3");
  push("          beep 330 for 0.06");
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("  set i to 0");
  push(`  repeat ${NEN}`);
  // the dive
  push("    if es[i] == 3 then");
  push("      change ey[i] by 2 + wave * 0.1");
  push("      set ex[i] to ex[i] + sin(ey[i] * 0.05 + i) * 2.4 + (px - ex[i]) * 0.012");
  push("      if ey[i] > 470 then");
  push("        set es[i] to 1");
  push("        set psx[i] to ex[i]");
  push("        set psy[i] to -20");
  push("        set pt[i] to 0");
  push("      end");
  // a diver drops a bomb now and then
  push("      if rand(0, 1) < 0.02 and ey[i] < 330 then");
  push("        set free to 0 - 1");
  for (let b = 0; b < NBOMB; b++) {
    push(`        if free < 0 and bon[${b}] == 0 then`);
    push(`          set free to ${b}`);
    push("        end");
  }
  push("        if free >= 0 then");
  push("          set bon[free] to 1");
  push("          set bx[free] to ex[i]");
  push("          set by[free] to ey[i] + 10");
  push("          set bvx[free] to max(-1.4, min(1.4, (px - ex[i]) * 0.012))");
  push("        end");
  push("      end");
  push("    end");
  // THE TRACTOR BEAM
  push("    if es[i] == 4 then");
  push("      set bt[i] to bt[i] + 1");
  push("      if bt[i] < 70 then");
  push("        change ey[i] by 3");
  push("      end");
  push("      if bt[i] >= 70 and bt[i] < 170 then");
  // the cone is open
  push("        if grace <= 0 and dual == 0 and capboss < 0 and abs(px - ex[i]) < 26 then");
  push("          set capboss to i");
  push("          set lives to lives - 1");
  push("          beep 98 for 0.3");
  push("          beep 131 for 0.3");
  push("          if lives <= 0 then");
  push("            set game to 2");
  push("            set endplay to 1");
  push('            set status.text to "LAST FIGHTER CAPTURED — CLICK TO LAUNCH AGAIN"');
  push("          else");
  push('            set status.text to "FIGHTER CAPTURED — SHOOT THE CARRIER"');
  push("            set grace to 90");
  push("            set px to 180");
  push("          end");
  push("          set bt[i] to 170");
  push("        end");
  push("      end");
  push("      if bt[i] >= 170 then");
  push("        set beamon to 0");
  push("        set es[i] to 1");
  push("        set psx[i] to ex[i]");
  push("        set psy[i] to ey[i]");
  push("        set pt[i] to 0");
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // ---- enemy bombs
  for (let b = 0; b < NBOMB; b++) {
    push(`  if bon[${b}] == 1 then`);
    push(`    change by[${b}] by 3.4`);
    push(`    change bx[${b}] by bvx[${b}]`);
    push(`    if by[${b}] > ${H} then`);
    push(`      set bon[${b}] to 0`);
    push("    end");
    push(`    if bon[${b}] == 1 and grace <= 0 and abs(bx[${b}] - px) < 10 + dual * 8 and abs(by[${b}] - ${PY}) < 12 then`);
    push(`      set bon[${b}] to 0`);
    push("      set phit to 1");
    push("    end");
    push("  end");
  }

  // ---- your shots vs the convoy
  for (let j = 0; j < NSHOT; j++) {
    push(`  if son[${j}] == 1 then`);
    push("    set i to 0");
    push(`    repeat ${NEN}`);
    push(`    if son[${j}] == 1 and es[i] > 0 and pt[i] >= 0 and abs(sxx[${j}] - ex[i]) < 11 and abs(syy[${j}] - ey[i]) < 10 then`);
    push(`      set son[${j}] to 0`);
    push("      set ehp[i] to ehp[i] - 1");
    push("      if ehp[i] <= 0 then");
    push("        set wasdive to 0");
    push("        if es[i] == 3 or es[i] == 4 then");
    push("          set wasdive to 1");
    push("        end");
    push("        if es[i] == 4 then");
    push("          set beamon to 0");
    push("        end");
    push("        set es[i] to 0");
    push("        if chstage == 1 then");
    push("          change score by 100");
    push("          set chkills to chkills + 1");
    push("        else");
    push("          if etp[i] == 1 then");
    push("            change score by 50 + wasdive * 50");
    push("          end");
    push("          if etp[i] == 2 then");
    push("            change score by 80 + wasdive * 80");
    push("          end");
    push("          if etp[i] == 3 then");
    push("            change score by 150 + wasdive * 250");
    push("          end");
    push("        end");
    push("        beep 220 for 0.06");
    // THE RESCUE
    push("        if capboss == i then");
    push("          set capboss to 0 - 1");
    push("          set dual to 1");
    push("          change score by 1000");
    push("          beep 659 for 0.08");
    push("          beep 784 for 0.08");
    push("          beep 1047 for 0.15");
    push('          set status.text to "FIGHTER RESCUED — DUAL FIGHTER, DOUBLE GUNS"');
    push("        end");
    push("      else");
    push("        beep 392 for 0.04");
    push("      end");
    push("    end");
    push("    set i to i + 1");
    push("    end");
    push("  end");
  }

  // ---- divers ram
  push("  set i to 0");
  push(`  repeat ${NEN}`);
  push(`    if (es[i] == 3 or es[i] == 4) and grace <= 0 and abs(ex[i] - px) < 11 + dual * 8 and abs(ey[i] - ${PY}) < 13 then`);
  push("      if es[i] == 4 then");
  push("        set beamon to 0");
  push("      end");
  push("      set es[i] to 1");
  push("      set psx[i] to ex[i]");
  push("      set psy[i] to -20");
  push("      set pt[i] to 0");
  push("      set phit to 1");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // ---- a hit: the dual gives its partner first
  push("  if phit == 1 then");
  push("    set phit to 0");
  push("    if dual == 1 then");
  push("      set dual to 0");
  push("      explode partner");
  push("      beep 140 for 0.15");
  push('      set status.text to "PARTNER LOST — SINGLE FIGHTER"');
  push("      set grace to 60");
  push("    else");
  push("      set lives to lives - 1");
  push("      explode fighter");
  push("      beep 90 for 0.35");
  push("      if lives <= 0 then");
  push("        set game to 2");
  push("        set endplay to 1");
  push('        set status.text to "FLEET DESTROYED — CLICK TO LAUNCH AGAIN"');
  push("      else");
  push("        set grace to 90");
  push("        set px to 180");
  push('        set status.text to lives + " FIGHTERS LEFT"');
  push("      end");
  push("    end");
  push("  end");

  // ---- wave end
  push("  if game == 0 and alive == 0 then");
  push("    set wasch to chstage");
  push("    set waskills to chkills");
  push("    set wave to wave + 1");
  push("    set nextch to 0");
  push("    if wave % 3 == 0 then");
  push("      set nextch to 1");
  push("    end");
  dealWave("    ", "nextch");
  // the stage's verdict lands AFTER the redeal, so the player reads it
  push("    if wasch == 1 then");
  push(`      if waskills == ${NEN} then`);
  push("        change score by 10000");
  push('        set status.text to "PERFECT — 10000"');
  push("        beep 784 for 0.1");
  push("        beep 1047 for 0.1");
  push("        beep 1319 for 0.2");
  push("      else");
  push('        set status.text to "HITS " + waskills + " OF 24"');
  push("      end");
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "FIGHTERS " + lives');
  push('  set wavetx.text to "WAVE " + wave');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set wavetx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  for (let i = 0; i < NEN; i++) {
    const tp = SLOT[i][2];
    const glyph = tp === 3 ? "[Ж]" : tp === 2 ? "Ж" : "ж";
    const col = tp === 3 ? GREEN : tp === 2 ? RED : GOLD;
    objects.push({
      id: "gg_e" + i, name: "foe" + (i + 1), type: "text",
      x: -40, y: -40, size: tp === 3 ? 16 : 13, color: col, glow: 9, visible: 0, text: glyph,
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and es[${i}] > 0 and pt[${i}] >= 0)
set self.x to ex[${i}]
set self.y to ey[${i}]
${tp === 3 ? `if ehp[${i}] == 1 then
  set self.color to "${PURPLE}"
else
  set self.color to "${GREEN}"
end` : ""}
end` }]
    });
  }

  // the beam cone, the stolen fighter riding its carrier
  objects.push({
    id: "gg_bm", name: "beam", type: "tri",
    x: -60, y: -60, size: 44, angle: 90, color: CYAN, glow: 14, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to 0
set i to 0
repeat ${NEN}
  if es[i] == 4 and bt[i] >= 70 and bt[i] < 170 then
    set self.visible to ${inGame}
    set self.x to ex[i]
    set self.y to ey[i] + 38
    set self.glow to 10 + sin(time() * 600) * 6
  end
  set i to i + 1
end
end` }]
  });
  objects.push({
    id: "gg_cap", name: "captive", type: "tri",
    x: -60, y: -60, size: 9, angle: -90, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and capboss >= 0)
if capboss >= 0 then
  set self.x to ex[capboss]
  set self.y to ey[capboss] - 15
end
end` }]
  });

  // shots and bombs
  for (let j = 0; j < NSHOT; j++) {
    objects.push({
      id: "gg_s" + j, name: "shot" + (j + 1), type: "dot",
      x: -40, y: -40, size: 2, color: WHITE, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and son[${j}] == 1)
set self.x to sxx[${j}]
set self.y to syy[${j}]
end` }]
    });
  }
  for (let b = 0; b < NBOMB; b++) {
    objects.push({
      id: "gg_b" + b, name: "bomb" + (b + 1), type: "dot",
      x: -40, y: -40, size: 3, color: RED, glow: 9, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and bon[${b}] == 1)
set self.x to bx[${b}]
set self.y to by[${b}]
end` }]
    });
  }

  // the fighter and its rescued partner
  objects.push({
    id: "gg_p", name: "fighter", type: "tri",
    x: 180, y: PY, size: 11, angle: -90, color: CYAN, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4))
set self.x to px - dual * 7
set self.y to ${PY}
end` }]
  });
  objects.push({
    id: "gg_p2", name: "partner", type: "tri",
    x: -60, y: PY, size: 11, angle: -90, color: WHITE, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and dual == 1)
set self.x to px + 11
set self.y to ${PY}
end` }]
  });

  // HUD
  objects.push({ id: "gg_sc", name: "scoretx", type: "text", x: 48, y: 22, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "gg_lv", name: "livestx", type: "text", x: 290, y: 20, size: 11, color: DIM, glow: 4, visible: 0, text: "FIGHTERS 3", script: [] });
  objects.push({ id: "gg_wv", name: "wavetx", type: "text", x: 172, y: 20, size: 11, color: GOLD, glow: 5, visible: 0, text: "WAVE 1", script: [] });
  objects.push({ id: "gg_st", name: "status", type: "text", x: W / 2, y: 468, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "gg_big", name: "bigtitle", type: "text", x: W / 2, y: 170, size: 42, color: RED, glow: 18, visible: 1, text: "GALAGA", script: [] });
  objects.push({ id: "gg_sub", name: "subline", type: "text", x: W / 2, y: 200, size: 9, color: DIM, glow: 4, visible: 1, text: "NAMCO 1981 · GALAXIAN SEQUEL · THE TRACTOR BEAM", script: [] });
  objects.push({ id: "gg_coin", name: "coinline", type: "text", x: W / 2, y: 228, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO LAUNCH ◎", script: [] });
  objects.push({ id: "gg_play", name: "playbtn", type: "text", x: W / 2, y: 260, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ LAUNCH ]", script: [] });
  objects.push({
    id: "gg_help", name: "help", type: "text",
    x: W / 2, y: 290, size: 8, color: DIM, glow: 3, visible: 1,
    text: "A/D SLIDES · SPACE FIRES · THE BEAM CAPTURES",
    script: []
  });

  objects.push({
    id: "gg_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "gg_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "FIGHTER", script: [] });

  return { title: "Galaga (1981)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    w: W, h: H, objects };
}

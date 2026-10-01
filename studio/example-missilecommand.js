// example-missilecommand.js — MISSILE COMMAND (1980), rebuilt in our studio.
//
// Atari, 1980, the Cold War on a trackball. Six cities. Three silos. ICBMs
// crawling down the sky on glowing threads, and nothing you can do about
// the ones you miss. Its designer, Dave Theurer, reportedly had nightmares
// about real missiles over real coastlines for years — because the game he
// built CANNOT be won. There is no victory screen. There is only THE END.
//
// The 1980 machine, faithfully:
//   · you don't shoot missiles — you detonate a BLAST where they will be,
//     and the blossom does the work. Lead your targets.
//   · three silos, ten rounds each; the nearest one answers your click
//   · warheads that FORK mid-sky (the MIRV) from wave 2 on
//   · a hit city is gone. A hit silo is silent until the next wave.
//   · wave bonus: 100 × multiplier a city, 5 × multiplier a round —
//     the multiplier climbs every two waves, ×1 up to ×6
//   · every 10,000 points, one ruined city is rebuilt
//   · when the sixth city falls: THE END. Not game over. THE END.
//
//   CLICK (or tap) where the missile is GOING to be.

const W = 480, H = 360;
const GROUND = 332;
const NEN = 8, NSHOT = 3, NBOOM = 4;
const CITYX = [80, 145, 210, 270, 335, 400];
const BASEX = [40, 240, 440];
const AMMO = 10;
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  RED = "#ff6666", CYAN = "#7ddfff", ORANGE = "#ff9d4a";

export function buildMissilecommandExample() {
  const L = [];
  const push = (s) => L.push(s);

  const dealWave = (pad) => {
    push(`${pad}set tospawn to min(16, 5 + wave * 2)`);
    push(`${pad}set spawnt to 30`);
    push(`${pad}set msplits to 0`);
    push(`${pad}set mult to min(6, floor((wave - 1) / 2) + 1)`);
    for (let b = 0; b < 3; b++) {
      push(`${pad}set ammo[${b}] to ${AMMO}`);
      push(`${pad}set bal[${b}] to 1`);
    }
    for (let i = 0; i < NEN; i++) push(`${pad}set eon[${i}] to 0`);
    for (let j = 0; j < NSHOT; j++) push(`${pad}set son[${j}] to 0`);
    for (let x = 0; x < NBOOM; x++) push(`${pad}set xon[${x}] to 0`);
    push(`${pad}beep 220 for 0.09`);
    push(`${pad}beep 277 for 0.09`);
    push(`${pad}beep 330 for 0.14`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set wave to 1`);
    push(`${pad}set nextcity to 10000`);
    for (let c = 0; c < 6; c++) push(`${pad}set cal[${c}] to 1`);
    dealWave(pad);
    push(`${pad}set status.text to "THE BLAST DOES THE WORK. LEAD THEM."`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set endplay to 0");
  push("set wave to 1");
  push("set mult to 1");
  for (let c = 0; c < 6; c++) push(`set cal[${c}] to 1`);
  for (let b = 0; b < 3; b++) {
    push(`set ammo[${b}] to ${AMMO}`);
    push(`set bal[${b}] to 1`);
  }
  for (let i = 0; i < NEN; i++) push(`set eon[${i}] to 0`);
  for (let j = 0; j < NSHOT; j++) push(`set son[${j}] to 0`);
  for (let x = 0; x < NBOOM; x++) push(`set xon[${x}] to 0`);
  push("set tospawn to 0");
  push('set status.text to ""');
  push("end");

  // ======== click: coin in · fire · back to attract
  push("when click");
  push("if game == 9 then");
  startMatch("  ");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push('    set status.text to ""');
  push("  else");
  // ---- FIRE: the nearest silo that still has rounds answers
  push("    set tx to mousex()");
  push("    set ty to min(mousey(), 290)");
  push("    set bpick to 0 - 1");
  push("    set bd to 9999");
  for (let b = 0; b < 3; b++) {
    push(`    if bal[${b}] == 1 and ammo[${b}] > 0 and abs(tx - ${BASEX[b]}) < bd then`);
    push(`      set bd to abs(tx - ${BASEX[b]})`);
    push(`      set bpick to ${b}`);
    push("    end");
  }
  push("    if bpick < 0 then");
  push("      beep 100 for 0.1");
  push('      set status.text to "OUT OF INTERCEPTORS — HOLD ON"');
  push("    else");
  push("      set fired to 0");
  for (let j = 0; j < NSHOT; j++) {
    push(`      if fired == 0 and son[${j}] == 0 then`);
    push("        set fired to 1");
    push("        set ammo[bpick] to ammo[bpick] - 1");
    push(`        set son[${j}] to 1`);
    push(`        set stx[${j}] to tx`);
    push(`        set sty[${j}] to ty`);
    push("        set bx to 40");
    push("        if bpick == 1 then");
    push("          set bx to 240");
    push("        end");
    push("        if bpick == 2 then");
    push("          set bx to 440");
    push("        end");
    push(`        set sx[${j}] to bx`);
    push(`        set sy[${j}] to ${GROUND - 8}`);
    // octagonal length estimate paces the shot evenly
    push(`        set ddx to abs(tx - bx)`);
    push(`        set ddy to abs(ty - ${GROUND - 8})`);
    push(`        set slen[${j}] to max(ddx, ddy) + 0.41 * min(ddx, ddy)`);
    push(`        set sp[${j}] to 0`);
    push("        beep 740 for 0.05");
    push("      end");
  }
  push("    end");
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
  // ---- the sky fills
  push("  set spawnt to spawnt - 1");
  push("  if tospawn > 0 and spawnt <= 0 then");
  push("    set spawnt to max(25, 60 - wave * 4)");
  push("    set free to 0 - 1");
  for (let i = 0; i < NEN; i++) {
    push(`    if free < 0 and eon[${i}] == 0 then`);
    push(`      set free to ${i}`);
    push("    end");
  }
  push("    if free >= 0 then");
  push("      set tospawn to tospawn - 1");
  push("      set eon[free] to 1");
  push("      set esx[free] to rand(30, 450)");
  push("      set esy[free] to 0");
  // aim at a random city or silo (0-5 city, 6-8 silo)
  push("      set etg[free] to floor(rand(0, 9))");
  const tgx = "      set etx[free] to 40\n" +
    [0, 1, 2, 3, 4, 5].map(c => `      if etg[free] == ${c} then\n        set etx[free] to ${CITYX[c]}\n      end`).join("\n") +
    `\n      if etg[free] == 6 then\n        set etx[free] to 40\n      end` +
    `\n      if etg[free] == 7 then\n        set etx[free] to 240\n      end` +
    `\n      if etg[free] == 8 then\n        set etx[free] to 440\n      end`;
  push(tgx);
  // trail angle: a polynomial atan, good to a degree out to r ≈ 1.2
  push(`      set rr to (etx[free] - esx[free]) / ${GROUND}`);
  push("      set eang[free] to 90 - (rr * (0.9724 - 0.1919 * rr * rr)) * 57.296");
  push("      set ep[free] to 0");
  push("      set espd[free] to 0.55 + wave * 0.12 + rand(0, 0.15)");
  push("      set esplit[free] to 0");
  push("      if wave >= 2 and rand(0, 1) < 0.4 then");
  push("        set esplit[free] to 1");
  push("      end");
  push("    end");
  push("  end");

  // ---- warheads crawl, fork, and land
  push("  set i to 0");
  push(`  repeat ${NEN}`);
  push("    if eon[i] == 1 then");
  push("      set ep[i] to ep[i] + espd[i]");
  push("      set exx[i] to esx[i] + cos(eang[i]) * ep[i]");
  push("      set eyy[i] to esy[i] + sin(eang[i]) * ep[i]");
  // the MIRV: one fork each, crossing y 150, if the sky has room
  push("      if esplit[i] == 1 and eyy[i] > 150 and msplits < 3 then");
  push("        set esplit[i] to 0");
  push("        set free to 0 - 1");
  for (let k = 0; k < NEN; k++) {
    push(`        if free < 0 and eon[${k}] == 0 then`);
    push(`          set free to ${k}`);
    push("        end");
  }
  push("        if free >= 0 then");
  push("          set msplits to msplits + 1");
  push("          set eon[free] to 1");
  push("          set esx[free] to exx[i]");
  push("          set esy[free] to eyy[i]");
  push("          set etg[free] to floor(rand(0, 6))");
  push("          set etx[free] to 80 + etg[free] * 64");
  push("          set etx[free] to max(exx[i] - 150, min(exx[i] + 150, etx[free]))");
  push(`          set rr to (etx[free] - esx[free]) / (${GROUND} - esy[free])`);
  push("          set eang[free] to 90 - (rr * (0.9724 - 0.1919 * rr * rr)) * 57.296");
  push("          set ep[free] to 0");
  push("          set espd[free] to espd[i] * 1.1");
  push("          set esplit[free] to 0");
  push("          beep 494 for 0.06");
  push("        end");
  push("      end");
  // impact
  push(`      if eyy[i] >= ${GROUND} then`);
  push("        set eon[i] to 0");
  push("        set hitx to etx[i]");
  push("        set boomq to 1");
  push("        beep 60 for 0.35");
  for (let c = 0; c < 6; c++) {
    push(`        if etg[i] == ${c} and cal[${c}] == 1 then`);
    push(`          set cal[${c}] to 0`);
    push(`          set status.text to "A CITY IS GONE"`);
    push("        end");
  }
  for (let b = 0; b < 3; b++) {
    push(`        if etg[i] == ${6 + b} and bal[${b}] == 1 then`);
    push(`          set bal[${b}] to 0`);
    push(`          set ammo[${b}] to 0`);
    push(`          set status.text to "SILO DOWN — BACK NEXT WAVE"`);
    push("        end");
  }
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // ---- interceptors fly
  for (let j = 0; j < NSHOT; j++) {
    push(`  if son[${j}] == 1 then`);
    push(`    set sp[${j}] to sp[${j}] + 6 / max(1, slen[${j}])`);
    push(`    set shot${j}x to sx[${j}] + (stx[${j}] - sx[${j}]) * min(1, sp[${j}])`);
    push(`    set shot${j}y to sy[${j}] + (sty[${j}] - sy[${j}]) * min(1, sp[${j}])`);
    push(`    if sp[${j}] >= 1 then`);
    push(`      set son[${j}] to 0`);
    push(`      set boomx to stx[${j}]`);
    push(`      set boomy to sty[${j}]`);
    push("      set boomq to 2");
    push("    end");
    push("  end");
  }

  // ---- blossoms open where asked (and where warheads land)
  push("  if boomq > 0 then");
  push("    set free to 0 - 1");
  for (let x = 0; x < NBOOM; x++) {
    push(`    if free < 0 and xon[${x}] == 0 then`);
    push(`      set free to ${x}`);
    push("    end");
  }
  push("    if free >= 0 then");
  push("      set xon[free] to 1");
  push("      if boomq == 2 then");
  push("        set xx[free] to boomx");
  push("        set xy[free] to boomy");
  push("      else");
  push("        set xx[free] to hitx");
  push(`        set xy[free] to ${GROUND - 6}`);
  push("      end");
  push("      set xr[free] to 3");
  push("      set xgrow[free] to 1");
  push("      beep 90 for 0.15");
  push("    end");
  push("    set boomq to 0");
  push("  end");
  push("  set x to 0");
  push(`  repeat ${NBOOM}`);
  push("    if xon[x] == 1 then");
  push("      if xgrow[x] == 1 then");
  push("        set xr[x] to xr[x] + 2.1");
  push("        if xr[x] >= 42 then");
  push("          set xgrow[x] to 0");
  push("        end");
  push("      else");
  push("        set xr[x] to xr[x] - 1.6");
  push("        if xr[x] <= 2 then");
  push("          set xon[x] to 0");
  push("        end");
  push("      end");
  // the blossom does the work
  push("      set i to 0");
  push(`      repeat ${NEN}`);
  push("        if eon[i] == 1 and xon[x] == 1 and abs(exx[i] - xx[x]) < xr[x] and abs(eyy[i] - xy[x]) < xr[x] * 0.9 then");
  push("          set eon[i] to 0");
  push("          change score by 25 * mult");
  push("          beep 330 for 0.05");
  push("        end");
  push("        set i to i + 1");
  push("      end");
  push("    end");
  push("    set x to x + 1");
  push("  end");

  // ---- a rebuilt city every 10,000
  push("  if score >= nextcity then");
  push("    set nextcity to nextcity + 10000");
  push("    set rebuilt to 0");
  for (let c = 0; c < 6; c++) {
    push(`    if rebuilt == 0 and cal[${c}] == 0 then`);
    push(`      set cal[${c}] to 1`);
    push("      set rebuilt to 1");
    push("      beep 784 for 0.08");
    push("      beep 1047 for 0.12");
    push('      set status.text to "BONUS CITY — ONE RUIN REBUILT"');
    push("    end");
  }
  push("  end");

  // ---- wave end · THE END
  push("  set alive to cal[0] + cal[1] + cal[2] + cal[3] + cal[4] + cal[5]");
  push("  set aloft to eon[0] + eon[1] + eon[2] + eon[3] + eon[4] + eon[5] + eon[6] + eon[7]");
  push("  if alive == 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push('    set status.text to "CLICK TO DEFEND AGAIN"');
  push("    beep 80 for 0.6");
  push("  end");
  push("  if game == 0 and tospawn == 0 and aloft == 0 then");
  push("    set bonus to alive * 100 * mult + (ammo[0] + ammo[1] + ammo[2]) * 5 * mult");
  push("    change score by bonus");
  push('    set status.text to "WAVE " + wave + " HELD — BONUS " + bonus + " (" + alive + " CITIES, ×" + mult + ")"');
  push("    set wave to wave + 1");
  dealWave("    ");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set wavetx.text to "WAVE " + wave + "  ×" + mult');
  for (let b = 0; b < 3; b++) {
    push(`  set ammotx${b}.text to "" + ammo[${b}]`);
    push(`  if bal[${b}] == 0 then`);
    push(`    set ammotx${b}.text to "X"`);
    push("  end");
  }
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set wavetx.visible to (game != 9)");
  push("set theend.visible to (game == 2)");
  push("if game == 2 then");
  push("  set theend.glow to 12 + sin(time() * 240) * 10");
  push("end");
  for (let b = 0; b < 3; b++) push(`set ammotx${b}.visible to (game != 9)`);
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];

  // the ground
  objects.push({
    id: "mc_gr", name: "groundline", type: "line",
    x: 0, y: GROUND + 8, size: W, angle: 0, color: GOLD, glow: 5, visible: 0, text: "",
    script: [{ event: "code", source: "when tick\nset self.visible to (game != 9)\nend" }]
  });

  // six cities
  for (let c = 0; c < 6; c++) {
    objects.push({
      id: "mc_c" + c, name: "city" + (c + 1), type: "text",
      x: CITYX[c], y: GROUND - 2, size: 13, color: CYAN, glow: 8, visible: 0, text: "▓▓",
      script: [{
        event: "code", source: `when tick
set self.visible to (game != 9)
if cal[${c}] == 1 then
  set self.text to "▓▓"
  set self.color to "${CYAN}"
  set self.glow to 8
else
  set self.text to "::"
  set self.color to "${DIM}"
  set self.glow to 2
end
end` }]
    });
  }

  // three silos and their counters
  for (let b = 0; b < 3; b++) {
    objects.push({
      id: "mc_b" + b, name: "silo" + (b + 1), type: "tri",
      x: BASEX[b], y: GROUND - 4, size: 11, angle: -90, color: GOLD, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game != 9)
if bal[${b}] == 1 then
  set self.color to "${GOLD}"
  set self.glow to 10
else
  set self.color to "${DIM}"
  set self.glow to 2
end
end` }]
    });
    objects.push({ id: "mc_a" + b, name: "ammotx" + b, type: "text", x: BASEX[b], y: GROUND + 20, size: 10, color: DIM, glow: 4, visible: 0, text: "10", script: [] });
  }

  // eight warhead threads and their sparks
  for (let i = 0; i < NEN; i++) {
    objects.push({
      id: "mc_e" + i, name: "thread" + (i + 1), type: "line",
      x: -50, y: -50, size: 1, angle: 90, color: RED, glow: 7, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and eon[${i}] == 1)
set self.x to esx[${i}]
set self.y to esy[${i}]
set self.angle to eang[${i}]
set self.size to ep[${i}]
end` }]
    });
    objects.push({
      id: "mc_w" + i, name: "spark" + (i + 1), type: "dot",
      x: -50, y: -50, size: 3, color: WHITE, glow: 12, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and eon[${i}] == 1)
set self.x to exx[${i}]
set self.y to eyy[${i}]
end` }]
    });
  }

  // three interceptors
  for (let j = 0; j < NSHOT; j++) {
    objects.push({
      id: "mc_s" + j, name: "inter" + (j + 1), type: "dot",
      x: -50, y: -50, size: 3, color: CYAN, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and son[${j}] == 1)
set self.x to shot${j}x
set self.y to shot${j}y
end` }]
    });
  }

  // four blossoms
  for (let x = 0; x < NBOOM; x++) {
    objects.push({
      id: "mc_x" + x, name: "blossom" + (x + 1), type: "ring",
      x: -80, y: -80, size: 4, color: ORANGE, glow: 16, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and xon[${x}] == 1)
set self.x to xx[${x}]
set self.y to xy[${x}]
set self.size to xr[${x}]
end` }]
    });
  }

  // HUD
  objects.push({ id: "mc_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "mc_wv", name: "wavetx", type: "text", x: 410, y: 22, size: 12, color: ORANGE, glow: 6, visible: 0, text: "WAVE 1 ×1", script: [] });
  objects.push({ id: "mc_st", name: "status", type: "text", x: W / 2, y: 22, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "mc_end", name: "theend", type: "text", x: W / 2, y: 170, size: 42, color: RED, glow: 18, visible: 0, text: "THE END", script: [] });

  // attract
  objects.push({ id: "mc_big", name: "bigtitle", type: "text", x: W / 2, y: 112, size: 36, color: RED, glow: 18, visible: 1, text: "MISSILE COMMAND", script: [] });
  objects.push({ id: "mc_sub", name: "subline", type: "text", x: W / 2, y: 144, size: 10, color: DIM, glow: 4, visible: 1, text: "ATARI 1980 · THE GAME THAT GAVE ITS MAKER NIGHTMARES", script: [] });
  objects.push({ id: "mc_coin", name: "coinline", type: "text", x: W / 2, y: 176, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO DEFEND ◎", script: [] });
  objects.push({ id: "mc_play", name: "playbtn", type: "text", x: W / 2, y: 214, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ DEFEND ]", script: [] });
  objects.push({
    id: "mc_help", name: "help", type: "text",
    x: W / 2, y: 248, size: 9, color: DIM, glow: 3, visible: 1,
    text: "CLICK TO INTERCEPT — THE BLAST DOES THE WORK · SIX CITIES · THREE SILOS",
    script: []
  });

  objects.push({
    id: "mc_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });

  return { title: "Missile Command (1980)", objects };
}

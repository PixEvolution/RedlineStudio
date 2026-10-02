// example-robotron.js — ROBOTRON: 2084 (1982), rebuilt in our studio.
//
// Eugene Jarvis put a second stick on the panel and invented a genre that
// is still copied forty years on: one stick RUNS, the other FIRES, and the
// two never have to agree. One arena, no walls to hide behind, and the
// robots pour in from every side — you are the last man, saving the last
// family of 2084. Our cabinet is a TRUE twin-stick: stick 1 (or WASD)
// moves, stick 2 (or the arrows) fires, independently, in 8 directions.
//
// The 1982 design, faithfully:
//   · GRUNTS converge on you in their hundreds — 100 a head
//   · ELECTRODES stand deadly still; grunts blunder into them for you
//   · HULKS cannot be killed. Your shots only PUSH them — and they are
//     walking straight at the family
//   · SPHEROIDS skitter round the edges hatching ENFORCERS, which float
//     and fire back — 1000 and 150 when you burst them
//   · every human rescued pays more: 1000, 2000... 5000 a touch, until
//     you die · clear the killable robots and a meaner wave pours in
//
//   WASD / stick 1 RUN · ARROWS / stick 2 FIRE · 3 LAST MEN

const W = 480, H = 360;
const NG = 24, NEL = 8, NH = 4, NSP = 2, NEF = 3, NPS = 4, NES = 3, NHU = 3;
const TOP = 48, BOT = 340, LFT = 16, RGT = 464;
const CX = 240, CY = 194;
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", PINK = "#ff9dcf";

export function buildRobotronExample() {
  const L = [];
  const push = (s) => L.push(s);

  // random spot, never on top of the last man (he spawns at center)
  const spot = (pad, xv, yv) => {
    push(`${pad}set ${xv} to rand(40, 440)`);
    push(`${pad}set ${yv} to rand(70, 318)`);
    push(`${pad}if abs(${xv} - ${CX}) < 100 and abs(${yv} - ${CY}) < 95 then`);
    push(`${pad}  if ${yv} < ${CY} then`);
    push(`${pad}    set ${yv} to 318`);
    push(`${pad}  else`);
    push(`${pad}    set ${yv} to 70`);
    push(`${pad}  end`);
    push(`${pad}end`);
  };

  // full deal (new wave) or reposition (after a death: the living shuffle)
  const dealWave = (pad, full) => {
    push(`${pad}set px to ${CX}`);
    push(`${pad}set py to ${CY}`);
    if (full) {
      push(`${pad}set gcount to min(${NG}, 8 + wave * 3)`);
      push(`${pad}set gleft to gcount`);
    }
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${NG}`);
    if (full) {
      push(`${pad}  set gon[i] to 0`);
      push(`${pad}  if i < gcount then`);
      push(`${pad}    set gon[i] to 1`);
      push(`${pad}  end`);
    }
    push(`${pad}  if gon[i] == 1 then`);
    spot(pad + "    ", "nx", "ny");
    push(`${pad}    set gx[i] to nx`);
    push(`${pad}    set gy[i] to ny`);
    push(`${pad}  end`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${NEL}`);
    if (full) push(`${pad}  set elon[i] to 1`);
    push(`${pad}  if elon[i] == 1 then`);
    spot(pad + "    ", "nx", "ny");
    push(`${pad}    set elx[i] to nx`);
    push(`${pad}    set ely[i] to ny`);
    push(`${pad}  end`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    if (full) {
      push(`${pad}set hcount to 0`);
      push(`${pad}if wave >= 2 then`);
      push(`${pad}  set hcount to min(${NH}, 1 + floor(wave / 2))`);
      push(`${pad}end`);
    }
    for (let k = 0; k < NH; k++) {
      if (full) {
        push(`${pad}set hon[${k}] to 0`);
        push(`${pad}if ${k} < hcount then`);
        push(`${pad}  set hon[${k}] to 1`);
        push(`${pad}end`);
      }
      push(`${pad}if hon[${k}] == 1 then`);
      spot(pad + "  ", "nx", "ny");
      push(`${pad}  set hx[${k}] to nx`);
      push(`${pad}  set hy[${k}] to ny`);
      push(`${pad}end`);
    }
    for (let k = 0; k < NSP; k++) {
      if (full) {
        push(`${pad}set spon[${k}] to 0`);
        push(`${pad}if wave >= 3 then`);
        push(`${pad}  set spon[${k}] to 1`);
        push(`${pad}  set spk[${k}] to 0`);
        push(`${pad}end`);
      }
      push(`${pad}if spon[${k}] == 1 then`);
      push(`${pad}  set spx[${k}] to ${k === 0 ? 40 : 440}`);
      push(`${pad}  set spy[${k}] to ${k === 0 ? 70 : 318}`);
      push(`${pad}  set spt[${k}] to 240 + ${k} * 120`);
      push(`${pad}  set spvx[${k}] to 1.6`);
      push(`${pad}  set spvy[${k}] to 1.2`);
      push(`${pad}end`);
    }
    for (let k = 0; k < NEF; k++) push(`${pad}set efon[${k}] to 0`);
    for (let k = 0; k < NES; k++) push(`${pad}set eson[${k}] to 0`);
    for (let k = 0; k < NPS; k++) push(`${pad}set son[${k}] to 0`);
    for (let h = 0; h < NHU; h++) {
      if (full) push(`${pad}set huon[${h}] to 1`);
      push(`${pad}if huon[${h}] == 1 then`);
      spot(pad + "  ", "nx", "ny");
      push(`${pad}  set hux[${h}] to nx`);
      push(`${pad}  set huy[${h}] to ny`);
      push(`${pad}  set hut[${h}] to 0`);
      push(`${pad}end`);
    }
    push(`${pad}set grace to 55`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set wave to 1`);
    push(`${pad}set chain to 0`);
    push(`${pad}set cool to 0`);
    push(`${pad}set tik to 0`);
    dealWave(pad, true);
    push(`${pad}set status.text to "WAVE 1 — THE LAST FAMILY IS LOOSE IN HERE. SO ARE THEY."`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set wave to 1");
  push("set tik to 0");
  dealWave("", true);
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO SAVE THEM ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO SAVE THEM ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  push("  if cool > 0 then");
  push("    set cool to cool - 1");
  push("  end");
  push("  set pdie to 0");

  // ---- stick one: run
  push(`  set mvx to max(-1, min(1, keydown("d") - keydown("a") + stickx(1)))`);
  push(`  set mvy to max(-1, min(1, keydown("s") - keydown("w") + sticky(1)))`);
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
  push("  change px by ix2 * 2.5");
  push("  change py by iy2 * 2.5");
  push(`  set px to max(${LFT + 10}, min(${RGT - 10}, px))`);
  push(`  set py to max(${TOP + 10}, min(${BOT - 10}, py))`);

  // ---- stick two: fire (independently)
  push(`  set fvx to max(-1, min(1, keydown("ArrowRight") - keydown("ArrowLeft") + stickx(2)))`);
  push(`  set fvy to max(-1, min(1, keydown("ArrowDown") - keydown("ArrowUp") + sticky(2)))`);
  push("  set fxs to 0");
  push("  if fvx > 0.35 then");
  push("    set fxs to 1");
  push("  end");
  push("  if fvx < -0.35 then");
  push("    set fxs to -1");
  push("  end");
  push("  set fys to 0");
  push("  if fvy > 0.35 then");
  push("    set fys to 1");
  push("  end");
  push("  if fvy < -0.35 then");
  push("    set fys to -1");
  push("  end");
  push("  if (fxs != 0 or fys != 0) and cool <= 0 then");
  push("    set spd2 to 7");
  push("    if fxs != 0 and fys != 0 then");
  push("      set spd2 to 5");
  push("    end");
  for (let s = 0; s < NPS; s++) {
    push(`    if cool <= 0 and son[${s}] == 0 then`);
    push(`      set son[${s}] to 1`);
    push(`      set sx2[${s}] to px + fxs * 10`);
    push(`      set sy2[${s}] to py + fys * 10`);
    push(`      set svx[${s}] to fxs * spd2`);
    push(`      set svy[${s}] to fys * spd2`);
    push("      set cool to 9");
    push("      beep 760 for 0.03");
    push("    end");
  }
  push("  end");

  // ---- your shots fly
  for (let s = 0; s < NPS; s++) {
    push(`  if son[${s}] == 1 then`);
    push(`    change sx2[${s}] by svx[${s}]`);
    push(`    change sy2[${s}] by svy[${s}]`);
    push(`    if sx2[${s}] < ${LFT} or sx2[${s}] > ${RGT} or sy2[${s}] < ${TOP} or sy2[${s}] > ${BOT} then`);
    push(`      set son[${s}] to 0`);
    push("    end");
    push("  end");
  }

  // ---- GRUNTS: the tide (loop-driven; they shamble on a cadence)
  push("  set gspd to min(2.1, 0.95 + wave * 0.08)");
  push("  set i to 0");
  push(`  repeat ${NG}`);
  push("    if gon[i] == 1 then");
  push("      if (tik + i) % 2 == 0 then");
  push("        if px > gx[i] + 3 then");
  push("          change gx[i] by gspd + rand(-0.3, 0.3)");
  push("        end");
  push("        if px < gx[i] - 3 then");
  push("          change gx[i] by 0 - gspd + rand(-0.3, 0.3)");
  push("        end");
  push("        if py > gy[i] + 3 then");
  push("          change gy[i] by gspd");
  push("        end");
  push("        if py < gy[i] - 3 then");
  push("          change gy[i] by 0 - gspd");
  push("        end");
  // grunts blunder into electrodes — and still pay you
  push("        set j to 0");
  push(`        repeat ${NEL}`);
  push("          if elon[j] == 1 and gon[i] == 1 and abs(gx[i] - elx[j]) < 11 and abs(gy[i] - ely[j]) < 11 then");
  push("            set gon[i] to 0");
  push("            set elon[j] to 0");
  push("            set gleft to gleft - 1");
  push("            change score by 100");
  push("            beep 140 for 0.06");
  push("          end");
  push("          set j to j + 1");
  push("        end");
  push("      end");
  // your shots
  push("      set si to 0");
  push(`      repeat ${NPS}`);
  push("        if son[si] == 1 and gon[i] == 1 and abs(sx2[si] - gx[i]) < 12 and abs(sy2[si] - gy[i]) < 12 then");
  push("          set son[si] to 0");
  push("          set gon[i] to 0");
  push("          set gleft to gleft - 1");
  push("          change score by 100");
  push("          beep 140 for 0.05");
  push("        end");
  push("        set si to si + 1");
  push("      end");
  // touch
  push("      if gon[i] == 1 and grace <= 0 and abs(gx[i] - px) < 11 and abs(gy[i] - py) < 11 then");
  push("        set pdie to 1");
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // ---- ELECTRODES: shootable, lethal
  push("  set i to 0");
  push(`  repeat ${NEL}`);
  push("    if elon[i] == 1 then");
  push("      set si to 0");
  push(`      repeat ${NPS}`);
  push("        if son[si] == 1 and abs(sx2[si] - elx[i]) < 11 and abs(sy2[si] - ely[i]) < 11 then");
  push("          set son[si] to 0");
  push("          set elon[i] to 0");
  push("        end");
  push("        set si to si + 1");
  push("      end");
  push("      if elon[i] == 1 and grace <= 0 and abs(elx[i] - px) < 10 and abs(ely[i] - py) < 10 then");
  push("        set pdie to 1");
  push("      end");
  push("    end");
  push("    set i to i + 1");
  push("  end");

  // ---- HULKS: unkillable. Your shots only push.
  for (let k = 0; k < NH; k++) {
    push(`  if hon[${k}] == 1 then`);
    // nearest living human, else you
    push("    set txh to px");
    push("    set tyh to py");
    push("    set bhd to 9999");
    for (let h = 0; h < NHU; h++) {
      push(`    if huon[${h}] == 1 then`);
      push(`      set dh to abs(hux[${h}] - hx[${k}]) + abs(huy[${h}] - hy[${k}])`);
      push("      if dh < bhd then");
      push("        set bhd to dh");
      push(`        set txh to hux[${h}]`);
      push(`        set tyh to huy[${h}]`);
      push("      end");
      push("    end");
    }
    push("    if tik % 2 == 0 then");
    push(`      if txh > hx[${k}] + 2 then`);
    push(`        change hx[${k}] by 0.62`);
    push("      end");
    push(`      if txh < hx[${k}] - 2 then`);
    push(`        change hx[${k}] by -0.62`);
    push("      end");
    push(`      if tyh > hy[${k}] + 2 then`);
    push(`        change hy[${k}] by 0.62`);
    push("      end");
    push(`      if tyh < hy[${k}] - 2 then`);
    push(`        change hy[${k}] by -0.62`);
    push("      end");
    push("    end");
    // shots shove it
    for (let s = 0; s < NPS; s++) {
      push(`    if son[${s}] == 1 and abs(sx2[${s}] - hx[${k}]) < 14 and abs(sy2[${s}] - hy[${k}]) < 14 then`);
      push(`      set son[${s}] to 0`);
      push(`      change hx[${k}] by svx[${s}] * 1.6`);
      push(`      change hy[${k}] by svy[${s}] * 1.6`);
      push("      beep 110 for 0.04");
      push("    end");
    }
    push(`    set hx[${k}] to max(${LFT + 12}, min(${RGT - 12}, hx[${k}]))`);
    push(`    set hy[${k}] to max(${TOP + 12}, min(${BOT - 12}, hy[${k}]))`);
    // it crushes the family…
    for (let h = 0; h < NHU; h++) {
      push(`    if huon[${h}] == 1 and abs(hx[${k}] - hux[${h}]) < 12 and abs(hy[${k}] - huy[${h}]) < 12 then`);
      push(`      set huon[${h}] to 0`);
      push(`      explode human${h + 1}`);
      push("      beep 98 for 0.15");
      push('      set status.text to "THE HULK GOT ONE OF THEM"');
      push("    end");
    }
    // …and you
    push(`    if grace <= 0 and abs(hx[${k}] - px) < 13 and abs(hy[${k}] - py) < 13 then`);
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }

  // ---- SPHEROIDS skitter and hatch ENFORCERS
  for (let k = 0; k < NSP; k++) {
    push(`  if spon[${k}] == 1 then`);
    push("    if tik % 60 == 0 then");
    push(`      set spvx[${k}] to rand(-2.2, 2.2)`);
    push(`      set spvy[${k}] to rand(-1.8, 1.8)`);
    push("    end");
    push(`    change spx[${k}] by spvx[${k}]`);
    push(`    change spy[${k}] by spvy[${k}]`);
    push(`    if spx[${k}] < ${LFT + 12} or spx[${k}] > ${RGT - 12} then`);
    push(`      set spvx[${k}] to 0 - spvx[${k}]`);
    push(`      set spx[${k}] to max(${LFT + 12}, min(${RGT - 12}, spx[${k}]))`);
    push("    end");
    push(`    if spy[${k}] < ${TOP + 12} or spy[${k}] > ${BOT - 12} then`);
    push(`      set spvy[${k}] to 0 - spvy[${k}]`);
    push(`      set spy[${k}] to max(${TOP + 12}, min(${BOT - 12}, spy[${k}]))`);
    push("    end");
    push(`    set spt[${k}] to spt[${k}] - 1`);
    push(`    if spt[${k}] <= 0 and spk[${k}] < 2 then`);
    push(`      set spt[${k}] to 300`);
    for (let f = 0; f < NEF; f++) {
      push(`      if spk[${k}] < 2 and efon[${f}] == 0 then`);
      push(`        set efon[${f}] to 1`);
      push(`        set efx[${f}] to spx[${k}]`);
      push(`        set efy[${f}] to spy[${k}]`);
      push(`        set eft2[${f}] to 80`);
      push(`        set spk[${k}] to spk[${k}] + 1`);
      push("        beep 494 for 0.06");
      push("      end");
    }
    push("    end");
    for (let s = 0; s < NPS; s++) {
      push(`    if spon[${k}] == 1 and son[${s}] == 1 and abs(sx2[${s}] - spx[${k}]) < 12 and abs(sy2[${s}] - spy[${k}]) < 12 then`);
      push(`      set son[${s}] to 0`);
      push(`      set spon[${k}] to 0`);
      push(`      explode spheroid${k + 1}`);
      push("      change score by 1000");
      push("      beep 659 for 0.08");
      push("    end");
    }
    push(`    if spon[${k}] == 1 and grace <= 0 and abs(spx[${k}] - px) < 11 and abs(spy[${k}] - py) < 11 then`);
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }
  for (let f = 0; f < NEF; f++) {
    push(`  if efon[${f}] == 1 then`);
    push(`    if px > efx[${f}] then`);
    push(`      change efx[${f}] by 1.1`);
    push("    else");
    push(`      change efx[${f}] by -1.1`);
    push("    end");
    push(`    if py > efy[${f}] then`);
    push(`      change efy[${f}] by 0.9`);
    push("    else");
    push(`      change efy[${f}] by -0.9`);
    push("    end");
    push(`    set eft2[${f}] to eft2[${f}] - 1`);
    push(`    if eft2[${f}] <= 0 then`);
    push(`      set eft2[${f}] to 100 + rand(0, 40)`);
    push(`      set dd to max(1, abs(px - efx[${f}]) + abs(py - efy[${f}]))`);
    for (let s = 0; s < NES; s++) {
      push(`      if eson[${s}] == 0 and dd < 9000 then`);
      push(`        set eson[${s}] to 1`);
      push(`        set esx[${s}] to efx[${f}]`);
      push(`        set esy[${s}] to efy[${f}]`);
      push(`        set esvx[${s}] to (px - efx[${f}]) / dd * 3.4`);
      push(`        set esvy[${s}] to (py - efy[${f}]) / dd * 3.4`);
      push("        set dd to 9999");
      push("        beep 620 for 0.04");
      push("      end");
    }
    push("    end");
    for (let s = 0; s < NPS; s++) {
      push(`    if efon[${f}] == 1 and son[${s}] == 1 and abs(sx2[${s}] - efx[${f}]) < 11 and abs(sy2[${s}] - efy[${f}]) < 11 then`);
      push(`      set son[${s}] to 0`);
      push(`      set efon[${f}] to 0`);
      push(`      explode enforcer${f + 1}`);
      push("      change score by 150");
      push("      beep 140 for 0.06");
      push("    end");
    }
    push(`    if efon[${f}] == 1 and grace <= 0 and abs(efx[${f}] - px) < 11 and abs(efy[${f}] - py) < 11 then`);
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }
  for (let s = 0; s < NES; s++) {
    push(`  if eson[${s}] == 1 then`);
    push(`    change esx[${s}] by esvx[${s}]`);
    push(`    change esy[${s}] by esvy[${s}]`);
    push(`    if esx[${s}] < ${LFT} or esx[${s}] > ${RGT} or esy[${s}] < ${TOP} or esy[${s}] > ${BOT} then`);
    push(`      set eson[${s}] to 0`);
    push("    end");
    push(`    if eson[${s}] == 1 and grace <= 0 and abs(esx[${s}] - px) < 9 and abs(esy[${s}] - py) < 9 then`);
    push(`      set eson[${s}] to 0`);
    push("      set pdie to 1");
    push("    end");
    push("  end");
  }

  // ---- the family: wandering, crushable, saveable
  for (let h = 0; h < NHU; h++) {
    push(`  if huon[${h}] == 1 then`);
    push(`    set hut[${h}] to hut[${h}] - 1`);
    push(`    if hut[${h}] <= 0 then`);
    push(`      set hut[${h}] to 40 + rand(0, 40)`);
    push(`      set huvx[${h}] to rand(-0.8, 0.8)`);
    push(`      set huvy[${h}] to rand(-0.8, 0.8)`);
    push("    end");
    push(`    change hux[${h}] by huvx[${h}]`);
    push(`    change huy[${h}] by huvy[${h}]`);
    push(`    set hux[${h}] to max(${LFT + 10}, min(${RGT - 10}, hux[${h}]))`);
    push(`    set huy[${h}] to max(${TOP + 10}, min(${BOT - 10}, huy[${h}]))`);
    push(`    if abs(hux[${h}] - px) < 12 and abs(huy[${h}] - py) < 12 then`);
    push(`      set huon[${h}] to 0`);
    push("      set chain to chain + 1");
    push("      set pay to 1000 * min(5, chain)");
    push("      change score by pay");
    push("      beep 659 for 0.06");
    push("      beep 988 for 0.08");
    push('      set status.text to "SAVED — +" + pay');
    push("    end");
    push("  end");
  }

  // ---- wave clear: every killable robot down
  push("  set kleft to gleft");
  for (let k = 0; k < NSP; k++) push(`  set kleft to kleft + spon[${k}]`);
  for (let f = 0; f < NEF; f++) push(`  set kleft to kleft + efon[${f}]`);
  push("  if kleft <= 0 then");
  push("    set wave to wave + 1");
  push("    beep 659 for 0.08");
  push("    beep 784 for 0.08");
  push("    beep 988 for 0.12");
  dealWave("    ", true);
  push('    set status.text to "WAVE " + wave + " — THEY POUR IN MEANER"');
  push("  end");

  // ---- the last man falls
  push("  if pdie == 1 and game == 0 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    set chain to 0");
  push("    explode lastman");
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "2084 BELONGS TO THE ROBOTS — SCORE " + score + " — CLICK TO RESIST"');
  push("    else");
  dealWave("      ", false);
  push('      set status.text to lives + " LAST MEN LEFT — THE ROBOTS REGROUP"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set wavetx.text to "WAVE " + wave');
  push('  set livestx.text to "LAST MEN " + lives');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set wavetx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // the arena frame
  const borders = [
    ["frameT", LFT, TOP, RGT - LFT, 0], ["frameB", LFT, BOT, RGT - LFT, 0],
    ["frameL", LFT, TOP, BOT - TOP, 1], ["frameR", RGT, TOP, BOT - TOP, 1],
  ];
  borders.forEach(([name, x, y, len, vert], i) => {
    objects.push({
      id: "rb_b" + i, name, type: "line",
      x, y, size: len, angle: vert ? 90 : 0, color: CYAN, glow: 4, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nset self.glow to 4 + sin(time() * 200 + ${i * 70}) * 2\nend` }]
    });
  });

  // grunts
  for (let i = 0; i < NG; i++) {
    objects.push({
      id: "rb_g" + i, name: "grunt" + (i + 1), type: "text",
      x: -50, y: -50, size: 14, color: RED, glow: 8, visible: 0, text: "Π",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and gon[${i}] == 1)
set self.x to gx[${i}]
set self.y to gy[${i}]
end` }]
    });
  }
  // electrodes
  for (let i = 0; i < NEL; i++) {
    objects.push({
      id: "rb_el" + i, name: "electrode" + (i + 1), type: "text",
      x: -50, y: -50, size: 13, color: GOLD, glow: 9, visible: 0, text: "✶",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and elon[${i}] == 1)
set self.x to elx[${i}]
set self.y to ely[${i}]
set self.glow to 7 + sin(time() * 500 + ${i * 60}) * 4
end` }]
    });
  }
  // hulks
  for (let k = 0; k < NH; k++) {
    objects.push({
      id: "rb_h" + k, name: "hulk" + (k + 1), type: "box",
      x: -50, y: -50, size: 17, color: GREEN, glow: 7, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and hon[${k}] == 1)
set self.x to hx[${k}]
set self.y to hy[${k}]
end` }]
    });
  }
  // spheroids and enforcers
  for (let k = 0; k < NSP; k++) {
    objects.push({
      id: "rb_sp" + k, name: "spheroid" + (k + 1), type: "ring",
      x: -50, y: -50, size: 9, color: RED, glow: 12, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and spon[${k}] == 1)
set self.x to spx[${k}]
set self.y to spy[${k}]
set self.size to 8 + sin(time() * 600) * 3
end` }]
    });
  }
  for (let f = 0; f < NEF; f++) {
    objects.push({
      id: "rb_ef" + f, name: "enforcer" + (f + 1), type: "text",
      x: -50, y: -50, size: 14, color: CYAN, glow: 9, visible: 0, text: "◇",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and efon[${f}] == 1)
set self.x to efx[${f}]
set self.y to efy[${f}]
end` }]
    });
  }
  // shots
  for (let s = 0; s < NPS; s++) {
    objects.push({
      id: "rb_s" + s, name: "yourshot" + (s + 1), type: "dot",
      x: -50, y: -50, size: 3, color: WHITE, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and son[${s}] == 1)
set self.x to sx2[${s}]
set self.y to sy2[${s}]
end` }]
    });
  }
  for (let s = 0; s < NES; s++) {
    objects.push({
      id: "rb_es" + s, name: "robotshot" + (s + 1), type: "dot",
      x: -50, y: -50, size: 3, color: RED, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and eson[${s}] == 1)
set self.x to esx[${s}]
set self.y to esy[${s}]
end` }]
    });
  }
  // the family
  for (let h = 0; h < NHU; h++) {
    objects.push({
      id: "rb_hu" + h, name: "human" + (h + 1), type: "text",
      x: -50, y: -50, size: 13, color: PINK, glow: 8, visible: 0, text: "i",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and huon[${h}] == 1)
set self.x to hux[${h}]
set self.y to huy[${h}]
end` }]
    });
  }
  // the last man
  objects.push({
    id: "rb_p", name: "lastman", type: "box",
    x: CX, y: CY, size: 11, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4))
set self.x to px
set self.y to py
end` }]
  });

  // HUD
  objects.push({ id: "rb_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "rb_wv", name: "wavetx", type: "text", x: 240, y: 24, size: 12, color: GOLD, glow: 6, visible: 0, text: "WAVE 1", script: [] });
  objects.push({ id: "rb_lv", name: "livestx", type: "text", x: 408, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "LAST MEN 3", script: [] });
  objects.push({ id: "rb_st", name: "status", type: "text", x: W / 2, y: 352, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "rb_big", name: "bigtitle", type: "text", x: W / 2, y: 106, size: 36, color: RED, glow: 18, visible: 1, text: "ROBOTRON: 2084", script: [] });
  objects.push({ id: "rb_sub", name: "subline", type: "text", x: W / 2, y: 138, size: 10, color: DIM, glow: 4, visible: 1, text: "WILLIAMS 1982 · EUGENE JARVIS · THE TWIN-STICK TEMPLATE", script: [] });
  objects.push({ id: "rb_coin", name: "coinline", type: "text", x: W / 2, y: 170, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO SAVE THEM ◎", script: [] });
  objects.push({ id: "rb_play", name: "playbtn", type: "text", x: W / 2, y: 208, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ RESIST ]", script: [] });
  objects.push({
    id: "rb_help", name: "help", type: "text",
    x: W / 2, y: 242, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD / STICK 1 RUNS · ARROWS / STICK 2 FIRE — INDEPENDENTLY",
    script: []
  });
  objects.push({
    id: "rb_help2", name: "help2", type: "text",
    x: W / 2, y: 260, size: 9, color: DIM, glow: 3, visible: 1,
    text: "SAVE THE FAMILY: 1000, 2000... 5000 A TOUCH · HULKS ONLY PUSH",
    script: []
  });

  objects.push({
    id: "rb_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "rb_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "RUN", script: [] });
  objects.push({ id: "rb_t2", name: "stick2tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "FIRE", script: [] });

  return { title: "Robotron: 2084 (1982)", objects };
}

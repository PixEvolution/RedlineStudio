// example-poleposition.js — POLE POSITION (1982), rebuilt in our studio.
//
// Namco's racer (distributed by Atari) was the top-grossing arcade game of
// 1983, and it changed what a driving game WAS: not an abstract road but a
// REAL CIRCUIT — Fuji Speedway, long straight, hairpin and all — and you
// didn't just race it, you had to EARN your place on it with a qualifying
// lap. Miss the cut and the machine sent you home. Ours runs the same
// contract on a Fuji-style circuit of eleven segments:
//
//   · ONE FLYING LAP to qualify — under 45.0s or go home; under 32.5s
//     and the grid announcer says the magic words: POLE POSITION
//   · then the RACE: 4 laps, traffic to pass (+50 a car), 60 seconds
//     on the clock and +35 for every lap you complete
//   · LO and HI gears (SPACE shifts): LO launches, HI flies — 306 km/h
//     flat out, but the HAIRPIN wants 130 or the grass takes you
//   · corners push you OUT the faster you go; offroad over 150 km/h
//     is a crash, and so is the back of a slower car
//   · finish all four laps: +2000 and the clock pays out
//
//   A/D or stick steer · W accelerates, S brakes · SPACE shifts · GO

const W = 480, H = 360;
const HOR = 170;                         // the horizon
const NSTRIP = 14, NCAR = 6;
// the circuit: Fuji-style — the long straight, the hairpin, the sweepers, the S
const TRACK = [
  [600, 0],      // the long main straight
  [140, 4.5],    // the HAIRPIN
  [150, 0],
  [260, 1.8],    // long right sweeper
  [120, 0],
  [160, -2.5],   // the S, left…
  [160, 2.5],    // …and right
  [200, 0],
  [240, -1.5],   // left sweeper
  [150, 0],
  [180, 2.8],    // the final corner onto the straight
  [134, 0],
];
const LAPLEN = TRACK.reduce((a, [l]) => a + l, 0);
const QUALCUT = 2700;                    // 45.0s at 60 ticks/s
const POLEAT = 1950;                     // 32.5s
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", ROAD_A = "#3a414e", ROAD_B = "#4a5260";
// strip depths (evenly spaced on screen — the road reads as a solid wedge).
// Each strip also knows how far down the TRACK it sits, so the bend it shows
// is the bend of the road AT THAT DISTANCE — the corner is visible coming.
const SUB = 8, NSUB = 37, RSC = 0.001577;   // look-ahead ≈ 290 units, ~200px max bend
const STRIPS = [];
for (let i = 0; i < NSTRIP; i++) {
  const y = 356 - i * 13.3;
  const t = (y - HOR) / 186;             // 1 at your bumper, →0 at the horizon
  const D = 22 * (1 / t - 1);            // world distance this strip shows
  STRIPS.push({ y, hw: 210 * t, sub: Math.min(NSUB, Math.round(D / SUB)) });
}
// the whole lap's curvature, one entry per 8 world units (filled at start)
const TABN = Math.ceil(LAPLEN / SUB);
const CURVETAB = [];
{
  let a = 0;
  const segAt = (p) => { let acc = 0; for (const [l, c] of TRACK) { if (p < acc + l) return c; acc += l; } return 0; };
  for (let k = 0; k < TABN; k++) CURVETAB.push(segAt(Math.min(LAPLEN - 1, k * SUB + SUB / 2)));
}

export function buildPolePositionExample() {
  const L = [];
  const push = (s) => L.push(s);

  const dealTraffic = (pad) => {
    push(`${pad}set ahead to min(${NCAR}, grid - 1)`);
    for (let c = 0; c < NCAR; c++) {
      push(`${pad}set con[${c}] to 1`);
      push(`${pad}if ${c} < ahead then`);
      push(`${pad}  set cpos[${c}] to 50 + ${c} * 38`);
      push(`${pad}else`);
      push(`${pad}  set cpos[${c}] to ${500 + c * 330}`);
      push(`${pad}end`);
      push(`${pad}set clx[${c}] to ${[-0.45, 0.45, 0, -0.4, 0.4, -0.1][c]}`);
      push(`${pad}set cv[${c}] to ${(0.78 + c * 0.045).toFixed(3)}`);
      push(`${pad}set prel[${c}] to 999`);
    }
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set phase to 0`);
    push(`${pad}set pos to 0`);
    push(`${pad}set v to 0`);
    push(`${pad}set playerx to 0`);
    push(`${pad}set gear to 0`);
    push(`${pad}set curnear to 0`);
    push(`${pad}set qt to 0`);
    push(`${pad}set laps to 0`);
    push(`${pad}set passes to 0`);
    push(`${pad}set crash to 0`);
    push(`${pad}set tik to 0`);
    for (let c = 0; c < NCAR; c++) push(`${pad}set con[${c}] to 0`);
    push(`${pad}set status.text to "QUALIFYING — ONE LAP. BEAT 45.0 OR OUT."`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set endplay to 0");
  push("set phase to 0");
  push("set pos to 0");
  push("set v to 0");
  push("set playerx to 0");
  push("set curnear to 0");
  push("set tik to 0");
  for (let c = 0; c < NCAR; c++) push(`set con[${c}] to 0`);
  // the circuit tables
  let acc = 0;
  TRACK.forEach(([len, curve], i) => {
    push(`set segs[${i}] to ${acc}`);
    push(`set segc[${i}] to ${curve}`);
    acc += len;
  });
  push("set i to 0");
  push(`repeat ${TABN}`);
  push("  set curvetab[i] to 0");
  push("  set i to i + 1");
  push("end");
  CURVETAB.forEach((c, k) => { if (c !== 0) push(`set curvetab[${k}] to ${c}`); });
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK FOR THE GRID ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK FOR THE GRID ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");

  // ---- which segment of the circuit are we on?
  push(`  set lpos to pos % ${LAPLEN}`);
  push("  set curseg to 0");
  for (let i = 0; i < TRACK.length; i++) {
    push(`  if lpos >= segs[${i}] then`);
    push(`    set curseg to ${i}`);
    push("  end");
  }
  push("  set curve to segc[curseg]");
  push("  set curnear to curnear + (curve - curnear) * 0.07");

  // ---- the pedals and the stick
  push(`  set accl to keydown("w") + keydown("ArrowUp")`);
  push("  if sticky(1) < -0.4 then");
  push("    set accl to 1");
  push("  end");
  push(`  set brak to keydown("s") + keydown("ArrowDown")`);
  push("  if sticky(1) > 0.4 then");
  push("    set brak to 1");
  push("  end");
  push(`  set strx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  set gk to keydown("Space")`);
  push("  if gk == 1 and gk0 == 0 and crash <= 0 then");
  push("    set gear to 1 - gear");
  push("    beep 330 for 0.04");
  push("  end");
  push("  set gk0 to gk");

  push("  if crash > 0 then");
  push("    set crash to crash - 1");
  push("    set v to 0");
  push("    set playerx to playerx * 0.95");
  push("  else");
  // gearing: LO launches, HI flies
  push("    if accl >= 1 then");
  push("      if gear == 0 then");
  push("        set v to min(132, v + 1.0)");
  push("      else");
  push("        if v < 100 then");
  push("          set v to v + 0.32");
  push("        else");
  push("          set v to min(240, v + 0.55)");
  push("        end");
  push("      end");
  push("    else");
  push("      set v to max(0, v - 0.5)");
  push("    end");
  push("    if brak >= 1 then");
  push("      set v to max(0, v - 2.2)");
  push("    end");
  // steering vs the corner's push
  push("    set playerx to playerx + strx * 0.022 * (v / 60 + 0.5)");
  push("    set playerx to playerx - curnear * v * v * 0.0000008");
  push("    set playerx to max(-1.6, min(1.6, playerx))");
  // offroad: the grass grabs you
  push("    if abs(playerx) > 1.05 then");
  push("      if v > 150 then");
  push("        set crash to 100");
  push("        explode racecar");
  push("        beep 110 for 0.25");
  push("        beep 82 for 0.3");
  push('        set status.text to "OFF AT SPEED — WRECKED FOR A MOMENT"');
  push("      else");
  push("        set v to v * 0.96");
  push("      end");
  push("    end");
  push("  end");
  push("  change pos by v * 0.006");

  // ---- the lap line
  push(`  if pos >= ${LAPLEN} then`);
  push(`    set pos to pos - ${LAPLEN}`);
  push("    if phase == 0 then");
  // ---------- qualifying decided ----------
  push(`      if qt > ${QUALCUT} then`);
  push("        set game to 2");
  push("        set endplay to 1");
  push("        set score to passes * 50");
  push('        set status.text to "FAILED TO QUALIFY — " + floor(qt / 60) + "." + floor(qt / 6) % 10 + "s. CLICK TO TRY AGAIN."');
  push("        beep 147 for 0.15");
  push("        beep 110 for 0.25");
  push("      else");
  push(`        set grid to max(1, min(8, 1 + floor((qt - ${POLEAT}) / 120)))`);
  push("        set phase to 1");
  push("        set laps to 0");
  push("        set pos to 0");
  push("        set rtime to 3600");
  push("        change score by 200 * (9 - grid)");
  push("        if grid == 1 then");
  push("          change score by 1800");
  push('          say "POLE POSITION!" for 1.4');
  push('          set status.text to "POLE POSITION! +2000 — GREEN FLAG, GO"');
  push("        else");
  push('          set status.text to "QUALIFIED — GRID " + grid + " — 4 LAPS, GREEN FLAG, GO"');
  push("        end");
  dealTraffic("        ");
  push("        set v to 0");
  push("        set playerx to 0");
  push("        beep 523 for 0.08");
  push("        beep 659 for 0.08");
  push("        beep 784 for 0.12");
  push("      end");
  push("    else");
  // ---------- a race lap done ----------
  push("      set laps to laps + 1");
  push("      change score by 1000");
  push("      if laps >= 4 then");
  push("        set game to 2");
  push("        set endplay to 1");
  push("        change score by 2000 + floor(rtime / 60) * 20");
  push('        say "CHECKERED FLAG." for 1.3');
  push('        set status.text to "FINISHED — 4 LAPS, " + passes + " PASSED, SCORE " + score + " — CLICK TO RACE AGAIN"');
  push("        beep 523 for 0.1");
  push("        beep 659 for 0.1");
  push("        beep 784 for 0.1");
  push("        beep 1047 for 0.2");
  push("      else");
  push("        set rtime to rtime + 2100");
  push("        beep 659 for 0.06");
  push("        beep 988 for 0.1");
  push('        set status.text to "LAP " + laps + " DONE +1000 — +35 SECONDS"');
  push("      end");
  push("    end");
  push("  end");

  // ---- the clocks
  push("  if phase == 0 and game == 0 then");
  push("    set qt to qt + 1");
  push('    set timetx.text to "LAP " + floor(qt / 60) + "." + floor(qt / 6) % 10');
  push("  end");
  push("  if phase == 1 and game == 0 then");
  push("    set rtime to rtime - 1");
  push("    if rtime <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "OUT OF TIME ON LAP " + (laps + 1) + " — SCORE " + score + " — CLICK TO RACE AGAIN"');
  push("      beep 147 for 0.15");
  push("      beep 110 for 0.25");
  push("    end");
  push('    set timetx.text to "TIME " + floor(rtime / 60)');
  push("  end");

  // ---- traffic (race only)
  for (let c = 0; c < NCAR; c++) {
    push(`  if con[${c}] == 1 then`);
    push(`    change cpos[${c}] by cv[${c}]`);
    push(`    if cpos[${c}] >= ${LAPLEN} then`);
    push(`      set cpos[${c}] to cpos[${c}] - ${LAPLEN}`);
    push("    end");
    push(`    set rel to (cpos[${c}] - pos + ${LAPLEN * 2}) % ${LAPLEN}`);
    push(`    set crel[${c}] to rel`);
    // a clean pass
    push(`    if prel[${c}] < 15 and rel > ${LAPLEN - 15} then`);
    push("      set passes to passes + 1");
    push("      change score by 50");
    push("      beep 587 for 0.04");
    push("    end");
    push(`    set prel[${c}] to rel`);
    // the back of a slower car
    push(`    if crash <= 0 and rel < 10 and rel >= 0 and abs(playerx - clx[${c}]) < 0.33 and v > cv[${c}] / 0.006 then`);
    push("      set crash to 100");
    push("      explode racecar");
    push("      beep 110 for 0.25");
    push("      beep 82 for 0.3");
    push('      set status.text to "REAR-ENDED TRAFFIC — WRECKED A MOMENT"');
    push("    end");
    push("  end");
  }

  // ---- project the road: march down the track, integrating the curvature
  // at each strip's own distance — the corner bends the horizon FIRST
  push(`  set ci0 to floor(lpos / ${SUB})`);
  push("  set dxv to 0");
  push("  set accx to 0");
  STRIPS.forEach((st, i) => {
    if (st.sub === 0) push(`  set rsx[${i}] to 240 - playerx * ${(st.hw * 0.9).toFixed(1)}`);
  });
  for (let k = 0; k < NSUB; k++) {
    push(`  set dxv to dxv + curvetab[(ci0 + ${k}) % ${TABN}] * ${SUB}`);
    push(`  set accx to accx + dxv * ${SUB}`);
    STRIPS.forEach((st, i) => {
      if (st.sub === k + 1) push(`  set rsx[${i}] to 240 - playerx * ${(st.hw * 0.9).toFixed(1)} + max(-210, min(210, accx * ${RSC}))`);
    });
  }
  // traffic projection
  for (let c = 0; c < NCAR; c++) {
    push(`  set cvz[${c}] to 0`);
    push(`  if con[${c}] == 1 and crel[${c}] > 2 and crel[${c}] < 250 then`);
    push(`    set cz to 1 + crel[${c}] / 20`);
    push(`    set cvz[${c}] to 1`);
    push(`    set cdy[${c}] to ${HOR} + 186 / cz`);
    push(`    set sj to max(0, min(${NSTRIP - 1}, round((356 - cdy[${c}]) / 13.3)))`);
    push(`    set cdx[${c}] to rsx[sj] + clx[${c}] * (210 / cz)`);
    push(`    set cds[${c}] to max(7, 30 / cz * 1.6)`);
    push("  end");
  }

  // ---- engine note and HUD
  push("  if tik % 7 == 0 and v > 5 and crash <= 0 then");
  push("    beep 40 + v * 0.6 + gear * 30 for 0.05");
  push("  end");
  push('  set speedtx.text to floor(v * 1.275) + " KM/H"');
  push("  if gear == 0 then");
  push('    set geartx.text to "GEAR LO"');
  push("  else");
  push('    set geartx.text to "GEAR HI"');
  push("  end");
  push("  if phase == 0 then");
  push('    set laptx.text to "QUALIFY"');
  push("  else");
  push('    set laptx.text to "LAP " + (laps + 1) + "/4"');
  push("  end");
  push('  set scoretx.text to "" + score');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set speedtx.visible to (game != 9)");
  push("set geartx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set laptx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // the mountain on the horizon (the circuit sits under a famous one)
  objects.push({
    id: "pp_mt", name: "mountain", type: "text",
    x: 310, y: HOR - 18, size: 52, color: "#2e3a4a", glow: 1, visible: 0, text: "▲",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nset self.x to 310 - curnear * 40 - playerx * 10\nend` }]
  });
  objects.push({
    id: "pp_hz", name: "horizon", type: "line",
    x: 0, y: HOR, size: 480, angle: 0, color: "#26303d", glow: 1, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  // the road, strip by strip
  for (let i = NSTRIP - 1; i >= 0; i--) {
    const st = STRIPS[i];
    objects.push({
      id: "pp_r" + i, name: "roadstrip" + (i + 1), type: "line",
      x: 240 - st.hw, y: st.y, size: st.hw * 2, angle: 0, color: ROAD_A, glow: 1, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to ${inGame}
set self.x to rsx[${i}] - ${st.hw.toFixed(1)}
if (floor(lpos / 9) + ${i}) % 2 == 0 then
  set self.color to "${ROAD_A}"
else
  set self.color to "${ROAD_B}"
end
end` }]
    });
    // rumble markers on alternating strips
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        objects.push({
          id: "pp_m" + i + (side > 0 ? "r" : "l"), name: "rumble" + (i + 1) + (side > 0 ? "r" : "l"), type: "dot",
          x: 240 + side * st.hw, y: st.y, size: Math.max(2, 5 - i * 0.3), color: RED, glow: 4, visible: 0, text: "",
          script: [{
            event: "code", source: `when tick
set self.visible to ${inGame}
set self.x to rsx[${i}] + ${(side * st.hw).toFixed(1)}
if (floor(lpos / 9) + ${i}) % 2 == 0 then
  set self.color to "${RED}"
else
  set self.color to "${WHITE}"
end
end` }]
        });
      }
    }
  }
  // the traffic
  const CARCOL = ["#e8c84a", "#7ddfff", "#7dff9e", "#ff9d4a", "#b48cff", "#ff9dcf"];
  for (let c = 0; c < NCAR; c++) {
    objects.push({
      id: "pp_c" + c, name: "rival" + (c + 1), type: "text",
      x: -60, y: -60, size: 14, color: CARCOL[c], glow: 8, visible: 0, text: "◢◣",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and cvz[${c}] == 1)
set self.x to cdx[${c}]
set self.y to cdy[${c}] - cds[${c}] * 0.4
set self.size to cds[${c}]
end` }]
    });
  }
  // your car
  objects.push({
    id: "pp_p", name: "racecar", type: "tri",
    x: 240, y: 330, size: 13, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (crash <= 0 or crash % 10 < 5))
set self.angle to 270 + strx * 16
set self.y to 330 + sin(time() * 900) * (abs(playerx) > 1.05) * 2
end` }]
  });

  // HUD
  objects.push({ id: "pp_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "pp_sp", name: "speedtx", type: "text", x: 170, y: 22, size: 12, color: CYAN, glow: 6, visible: 0, text: "0 KM/H", script: [] });
  objects.push({ id: "pp_gr", name: "geartx", type: "text", x: 262, y: 22, size: 11, color: GOLD, glow: 5, visible: 0, text: "GEAR LO", script: [] });
  objects.push({ id: "pp_tm", name: "timetx", type: "text", x: 345, y: 22, size: 12, color: GOLD, glow: 6, visible: 0, text: "LAP 0.0", script: [] });
  objects.push({ id: "pp_lp", name: "laptx", type: "text", x: 432, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "QUALIFY", script: [] });
  objects.push({ id: "pp_st", name: "status", type: "text", x: W / 2, y: 352, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "pp_big", name: "bigtitle", type: "text", x: W / 2, y: 104, size: 40, color: RED, glow: 18, visible: 1, text: "POLE POSITION", script: [] });
  objects.push({ id: "pp_sub", name: "subline", type: "text", x: W / 2, y: 136, size: 10, color: DIM, glow: 4, visible: 1, text: "NAMCO 1982 · 1983'S TOP GROSSER", script: [] });
  objects.push({ id: "pp_coin", name: "coinline", type: "text", x: W / 2, y: 168, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK FOR THE GRID ◎", script: [] });
  objects.push({ id: "pp_play", name: "playbtn", type: "text", x: W / 2, y: 206, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ QUALIFY ]", script: [] });
  objects.push({
    id: "pp_help", name: "help", type: "text",
    x: W / 2, y: 240, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A·D · W GAS · SPACE SHIFTS · HAIRPIN=130",
    script: []
  });
  objects.push({
    id: "pp_help2", name: "help2", type: "text",
    x: W / 2, y: 258, size: 9, color: DIM, glow: 3, visible: 1,
    text: "QUALIFY UNDER 45.0 · THEN 4 LAPS",
    script: []
  });

  objects.push({
    id: "pp_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "pp_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "DRIVE", script: [] });

  return { title: "Pole Position (1982)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

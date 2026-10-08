// example-galaxian.js — GALAXIAN (1979), rebuilt in our studio.
//
// Namco's answer to Space Invaders, and the machine that killed it: the first
// arcade game drawn in FULL RGB COLOR — real multicolored sprites over a
// scrolling rainbow starfield, next to which Invaders' cellophane strips
// suddenly looked like 1972. And the real murder weapon wasn't the paint:
// in Galaxian the aliens don't wait to be shot. They PEEL OFF the formation
// and DIVE at you in swooping arcs, firing on the way down.
//
// The 1979 machine, faithfully:
//   · a 46-strong convoy in FOUR COLORS — yellow flagships, red escorts,
//     purple officers, three rows of blue drones — sliding, never sinking
//   · the formation itself never fires. The DIVERS do. Up to two at once
//     swoop down shooting, then loop home to their slot if you miss them.
//   · pay by rank: blue 30 · purple 40 · red 50 · flagship 60 — and every
//     one is worth DOUBLE mid-dive (a diving flagship pays 150)
//   · ONE shot on screen · 3 lives · NO bunkers — 1979 took the cover away
//   · a diver that reaches you takes you with it
//   · the scrolling RGB starfield, the whole reason the board existed
//
//   ← → or A/D (or the stick) MOVE · SPACE FIRES

const W = 360, H = 480;
const COLS = 10, ROWS = 6, NSLOT = 60;
const SPX = 28, SPY = 20;
const FX0 = 40, FY0 = 70;
const CANY = 448;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e";
const C_FLAG = "#ffe14a", C_RED = "#ff5a4a", C_PUR = "#c77dff", C_BLUE = "#4aa8ff";
// which grid slots hold a ship at wave start (the convoy's wedge shape)
const SLOT_ALIVE = (r, c) =>
  r === 0 ? (c === 4 || c === 5) :
  r === 1 ? (c >= 2 && c <= 7) :
  r === 2 ? (c >= 1 && c <= 8) : true;
const rowPts = (r) => r === 0 ? 60 : r === 1 ? 50 : r === 2 ? 40 : 30;

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const fillWave = (pad) => {
    push(`${pad}set i to 0`);
    push(`${pad}set alive to 0`);
    push(`${pad}repeat ${NSLOT}`);
    push(`${pad}  set c to i % ${COLS}`);
    push(`${pad}  set r to floor(i / ${COLS})`);
    // the wedge: flagships 2, red 6, purple 8, blue 30
    push(`${pad}  set ok to 1`);
    push(`${pad}  if r == 0 and c != 4 and c != 5 then`);
    push(`${pad}    set ok to 0`);
    push(`${pad}  end`);
    push(`${pad}  if r == 1 and (c < 2 or c > 7) then`);
    push(`${pad}    set ok to 0`);
    push(`${pad}  end`);
    push(`${pad}  if r == 2 and (c < 1 or c > 8) then`);
    push(`${pad}    set ok to 0`);
    push(`${pad}  end`);
    push(`${pad}  set a[i] to ok`);
    push(`${pad}  set alive to alive + ok`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set fx to ${FX0}`);
    push(`${pad}set dirx to 1`);
    push(`${pad}set stept to 0`);
    push(`${pad}set dv1 to 0 - 1`);
    push(`${pad}set dv2 to 0 - 1`);
    push(`${pad}set divet to 160`);
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
    push(`${pad}set cannon.x to ${W / 2}`);
    fillWave(pad);
    push(`${pad}set status.text to "THEY DON\'T WAIT TO BE SHOT ANYMORE."`);
  };

  // one diver's flight: swoop toward the cannon's lane, loop home off the
  // bottom. n = 1 or 2; the state is dvN (slot index or -1), dvNx/dvNy/dvNt.
  const diver = (n) => {
    push(`  if dv${n} >= 0 then`);
    push(`    set dv${n}t to dv${n}t + 1`);
    push(`    change dv${n}y by 2.7`);
    push(`    set dv${n}x to dv${n}x + sin(dv${n}t * 6) * 2.4 + max(-1.1, min(1.1, (cannon.x - dv${n}x) * 0.02))`);
    // a diver fires on the way down
    push(`    if bombon${n} == 0 and dv${n}y > 120 and dv${n}y < 360 and rand(0, 100) < 4 then`);
    push(`      set bombon${n} to 1`);
    push(`      set bomb${n}.x to dv${n}x`);
    push(`      set bomb${n}.y to dv${n}y + 10`);
    push("    end");
    // a diver that reaches you takes you with it
    push(`    if game == 0 and abs(dv${n}x - cannon.x) < 13 and abs(dv${n}y - ${CANY}) < 12 then`);
    push(`      set a[dv${n}] to 0`);
    push("      set alive to alive - 1");
    push(`      set dv${n} to 0 - 1`);
    push("      explode cannon");
    push("      beep 90 for 0.3");
    push("      set lives to lives - 1");
    push(`      set cannon.x to ${W / 2}`);
    push("      if lives <= 0 then");
    push("        set game to 2");
    push("        set endplay to 1");
    push('        set status.text to "GAME OVER — CLICK FOR A NEW CONVOY"');
    push("      end");
    push("    end");
    // off the bottom: loop home to the formation slot, unharmed
    push(`    if dv${n}y > ${H + 14} then`);
    push(`      set dv${n} to 0 - 1`);
    push("    end");
    push("  end");
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
  fillWave("");
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO FLY ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO FLY ◎"');
  push("end");

  // ---- the convoy SLIDES — it never descends. 1979's menace comes DOWN
  // to you personally instead.
  push("if game == 0 or game == 9 then");
  push(`  set stepn to max(6, 8 + floor(alive * 22 / 46))`);
  push("  set stept to stept + 1");
  push("  if stept >= stepn then");
  push("    set stept to 0");
  push("    set mincol to 9");
  push("    set maxcol to 0");
  push("    set i to 0");
  push(`    repeat ${NSLOT}`);
  push("      if a[i] == 1 then");
  push(`        set c to i % ${COLS}`);
  push("        set mincol to min(mincol, c)");
  push("        set maxcol to max(maxcol, c)");
  push("      end");
  push("      set i to i + 1");
  push("    end");
  push(`    if (dirx > 0 and fx + maxcol * ${SPX} + 6 > ${W - 22}) or (dirx < 0 and fx + mincol * ${SPX} - 6 < 14) then`);
  push("      set dirx to 0 - dirx");
  push("    else");
  push(`      set fx to fx + dirx * 6`);
  push("    end");
  push("  end");
  push("end");

  push("if game == 0 then");
  // ---- the divers peel off
  push("  set divet to divet - 1");
  push("  if divet <= 0 and alive > 0 then");
  push(`    set divet to max(60, 150 - wave * 15) + floor(rand(0, 50))`);
  push("    set slot to 0 - 1");
  push("    set tries to 0");
  push("    repeat 20");
  push("      if slot < 0 then");
  push(`        set cand to floor(rand(0, ${NSLOT}))`);
  push("        if a[cand] == 1 and cand != dv1 and cand != dv2 then");
  push("          set slot to cand");
  push("        end");
  push("      end");
  push("      set tries to tries + 1");
  push("    end");
  push("    if slot >= 0 then");
  push("      if dv1 < 0 then");
  push("        set dv1 to slot");
  push(`        set dv1x to fx + (slot % ${COLS}) * ${SPX}`);
  push(`        set dv1y to ${FY0} + floor(slot / ${COLS}) * ${SPY}`);
  push("        set dv1t to 0");
  push("        beep 620 for 0.06");
  push("        beep 500 for 0.06");
  push("      else");
  push("        if dv2 < 0 then");
  push("          set dv2 to slot");
  push(`          set dv2x to fx + (slot % ${COLS}) * ${SPX}`);
  push(`          set dv2y to ${FY0} + floor(slot / ${COLS}) * ${SPY}`);
  push("          set dv2t to 0");
  push("          beep 620 for 0.06");
  push("          beep 500 for 0.06");
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  diver(1);
  diver(2);
  // ---- wave cleared → a fresh convoy, hungrier
  push("  if alive == 0 then");
  push("    set wave to wave + 1");
  fillWave("    ");
  push("    set shoton to 0");
  push("    set bombon1 to 0");
  push("    set bombon2 to 0");
  push('    set status.text to "WAVE " + wave + " — THEY DIVE SOONER NOW"');
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

function cannonCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game == 0)");
  push("if game == 0 then");
  push(`  set mv to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push("  change self.x by mv * 3.6");
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

function shotCode() {
  const L = [];
  const push = (s) => L.push(s);
  const killDiver = (n) => {
    push(`  if shoton == 1 and dv${n} >= 0 and abs(self.x - dv${n}x) < 11 and abs(self.y - dv${n}y) < 11 then`);
    push(`    set a[dv${n}] to 0`);
    push("    set alive to alive - 1");
    push("    set shoton to 0");
    // DOUBLE mid-dive — a diving flagship pays 150
    push(`    set r to floor(dv${n} / ${COLS})`);
    push("    if r == 0 then");
    push("      change score by 150");
    push('      say "FLAGSHIP 150" for 0.8');
    push("    else");
    push("      if r == 1 then");
    push("        change score by 100");
    push("      else");
    push("        if r == 2 then");
    push("          change score by 80");
    push("        else");
    push("          change score by 60");
    push("        end");
    push("      end");
    push("    end");
    push(`    set dv${n} to 0 - 1`);
    push("    beep 659 for 0.05");
    push("    beep 330 for 0.05");
    push("  end");
  };
  push("when tick");
  push("set self.visible to (game == 0 and shoton == 1)");
  push("if game == 0 and shoton == 1 then");
  push("  change self.y by -8");
  push("  if self.y < 14 then");
  push("    set shoton to 0");
  push("  end");
  killDiver(1);
  killDiver(2);
  // the formation: grid math — but a diver's slot is EMPTY air while it dives
  push(`  set c to round((self.x - fx) / ${SPX})`);
  push(`  set r to round((self.y - ${FY0}) / ${SPY})`);
  push(`  if shoton == 1 and c >= 0 and c <= ${COLS - 1} and r >= 0 and r <= ${ROWS - 1} then`);
  push(`    if abs(self.x - (fx + c * ${SPX})) < 12 and abs(self.y - (${FY0} + r * ${SPY})) < 9 then`);
  push(`      set idx to r * ${COLS} + c`);
  push("      if a[idx] == 1 and idx != dv1 and idx != dv2 then");
  push("        set a[idx] to 0");
  push("        set alive to alive - 1");
  push("        set shoton to 0");
  push("        if r == 0 then");
  push("          change score by 60");
  push("        else");
  push("          if r == 1 then");
  push("            change score by 50");
  push("          else");
  push("            if r == 2 then");
  push("              change score by 40");
  push("            else");
  push("              change score by 30");
  push("            end");
  push("          end");
  push("        end");
  push("        beep 523 for 0.05");
  push("        beep 262 for 0.05");
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

// a diver's bomb — only divers fire in Galaxian
function bombCode(n) {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push(`set self.visible to (game == 0 and bombon${n} == 1)`);
  push(`if game == 0 and bombon${n} == 1 then`);
  push("  change self.y by 3.4");
  push(`  if self.y > ${H - 6} then`);
  push(`    set bombon${n} to 0`);
  push("  end");
  push(`  if bombon${n} == 1 and abs(self.x - cannon.x) < 11 and abs(self.y - ${CANY}) < 10 then`);
  push(`    set bombon${n} to 0`);
  push("    set lives to lives - 1");
  push("    explode cannon");
  push("    beep 90 for 0.3");
  push(`    set cannon.x to ${W / 2}`);
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "GAME OVER — CLICK FOR A NEW CONVOY"');
  push("    else");
  push('      set status.text to "FIGHTER DOWN — " + lives + " LEFT"');
  push("    end");
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

export function buildGalaxianExample() {
  const objects = [];

  // THE RGB STARFIELD — the first thing 1979 wanted you to see.
  // Twelve colored stars falling forever, twinkling by glow.
  const starCols = ["#ff5a4a", "#ffe14a", "#4aa8ff", "#c77dff", "#7dff9e", "#2dd2ff"];
  for (let s = 0; s < 12; s++) {
    objects.push({
      id: "gx_st" + s, name: "star" + (s + 1), type: "dot",
      x: 18 + (s * 83) % (W - 30), y: (s * 157) % H, size: 2, color: starCols[s % 6], glow: 8, visible: 1, text: "",
      script: [{
        event: "code", source: `when tick
change self.y by ${(1 + (s % 3)) * 0.7}
if self.y > ${H} then
  set self.y to 0
  set self.x to rand(12, ${W - 12})
end
set self.glow to 6 + sin(time() * ${140 + s * 25}) * 5
end` }]
    });
  }

  // THE CONVOY: 60 grid slots, 46 ships in a wedge, FOUR COLORS.
  // Each glyph watches its slot — and rides a dive when it's the diver.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c;
      if (!SLOT_ALIVE(r, c)) {
        // empty wedge slots still need display objects? No — skip them:
        // a[] marks them dead forever, nothing to draw.
        continue;
      }
      const color = r === 0 ? C_FLAG : r === 1 ? C_RED : r === 2 ? C_PUR : C_BLUE;
      const glyph = r === 0 ? "Ѧ" : r === 1 ? "Ж" : r === 2 ? "Ж" : "Ψ";
      objects.push({
        id: "gx_i" + k, name: "inv" + (k + 1), type: "text",
        x: FX0 + c * SPX, y: FY0 + r * SPY, size: 14, color, glow: 9, visible: 1, text: glyph,
        script: [{
          event: "code", source: `when tick
if dv1 == ${k} then
  set self.x to dv1x
  set self.y to dv1y
else
  if dv2 == ${k} then
    set self.x to dv2x
    set self.y to dv2y
  else
    set self.x to fx + ${c} * ${SPX}
    set self.y to ${FY0} + ${r} * ${SPY}
  end
end
set self.visible to a[${k}] * (game != 2)
end` }]
      });
    }
  }

  // fighter, shot, two diver bombs
  objects.push({
    id: "gx_can", name: "cannon", type: "tri",
    x: W / 2, y: CANY, size: 12, angle: 270, color: WHITE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: cannonCode() }]
  });
  objects.push({
    id: "gx_shot", name: "shot", type: "box",
    x: -30, y: -30, size: 4, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{ event: "code", source: shotCode() }]
  });
  objects.push({
    id: "gx_bm1", name: "bomb1", type: "box",
    x: -30, y: -30, size: 5, color: C_RED, glow: 8, visible: 0, text: "",
    script: [{ event: "code", source: bombCode(1) }]
  });
  objects.push({
    id: "gx_bm2", name: "bomb2", type: "box",
    x: -30, y: -30, size: 5, color: C_PUR, glow: 8, visible: 0, text: "",
    script: [{ event: "code", source: bombCode(2) }]
  });

  // HUD
  objects.push({ id: "gx_sc", name: "scoretx", type: "text", x: 48, y: 26, size: 22, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "gx_lv", name: "livestx", type: "text", x: 300, y: 20, size: 12, color: DIM, glow: 4, visible: 0, text: "LIVES 3", script: [] });
  objects.push({ id: "gx_wv", name: "wavetx", type: "text", x: 300, y: 40, size: 12, color: DIM, glow: 4, visible: 0, text: "WAVE 1", script: [] });
  objects.push({ id: "gx_st2", name: "status", type: "text", x: W / 2, y: 470, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "gx_big", name: "bigtitle", type: "text", x: W / 2, y: 250, size: 36, color: C_FLAG, glow: 18, visible: 1, text: "GALAXIAN", script: [] });
  objects.push({ id: "gx_sub", name: "subline", type: "text", x: W / 2, y: 282, size: 10, color: DIM, glow: 4, visible: 1, text: "NAMCO 1979 · FULL COLOR · THEY DIVE NOW", script: [] });
  objects.push({ id: "gx_coin", name: "coinline", type: "text", x: W / 2, y: 312, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO FLY ◎", script: [] });
  objects.push({ id: "gx_play", name: "playbtn", type: "text", x: W / 2, y: 350, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ FLY ]", script: [] });
  objects.push({
    id: "gx_help", name: "help", type: "text",
    x: W / 2, y: 390, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A/D · SPACE FIRES · DIVERS PAY DOUBLE",
    script: []
  });

  objects.push({
    id: "gx_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({ id: "gx_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "MOVE", script: [] });

  return { title: "Galaxian (1979)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    w: W, h: H, objects };
}

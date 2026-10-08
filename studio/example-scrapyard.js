// example-scrapyard.js — SCRAPYARD CLIMB, an original platformer, 1981 style.
//
// 1981: Nintendo's breakout arcade hit invented the platformer in one
// cabinet — girders, ladders, rolling hazards, and above all THE JUMP —
// and introduced a carpenter called Jumpman, soon renamed Mario. Those
// characters belong to Nintendo, every pixel of them — so like our text
// adventures, this is an ORIGINAL: a scrapyard, a crusher gone haywire at
// the top of the pile, and a runner climbing up to hit its OFF switch
// while it hurls TIRES down the girders. What we keep is the invention:
//
//   · six girder floors and the ladders between them — UP on a ladder
//     climbs, and nothing else gets you off a floor alive
//   · tires that roll each floor's direction, drop at the open end,
//     and sometimes take a ladder down early just to ruin your plan
//   · THE JUMP: SPACE, a real arc — clear a tire mid-air for 100
//   · the WRENCH: grab it and for a few seconds tires die on touch, 300
//     apiece — the hammer, reborn as shop equipment
//   · a BONUS counter draining the whole climb: reach the switch and
//     what's left is yours · every level the crusher throws faster
//   · and the rule that made it tense: a FALL is a fall. Don't.
//
//   A/D WALK · W/S CLIMB LADDERS · SPACE JUMPS · 3 RUNNERS

const W = 360, H = 480;
const NTIRE = 6;
// floors: [y, xmin, xmax, dir tires roll, gap side (-1 left, 1 right, 0 none)]
const FLOORS = [
  null,
  [448, 16, 344, 1, 0],    // 1: the yard floor — tires roll off the right edge
  [384, 16, 300, 1, 1],
  [320, 60, 344, -1, -1],
  [256, 16, 300, 1, 1],
  [192, 60, 344, -1, -1],
  [128, 16, 344, 1, 1],    // 6: gap right, under the platform? no — rolls right, drops at 300
];
FLOORS[6] = [128, 16, 300, 1, 1];
const PLAT = [80, 24, 140];                     // the crusher's platform
// ladders: [x, lower floor, upper floor]
const LADDERS = [
  [80, 1, 2], [260, 1, 2], [180, 2, 3], [100, 3, 4], [280, 3, 4],
  [200, 4, 5], [120, 5, 6], [300, 5, 6], [60, 6, 7],
];
const WRENCH_AT = [70, 4];
const SWITCH_X = 120;
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  RED = "#ff6666", CYAN = "#7ddfff", ORANGE = "#ff9d4a", STEEL = "#5a7a94";

export function buildScrapyardExample() {
  const L = [];
  const push = (s) => L.push(s);

  const resetPlayer = (pad) => {
    push(`${pad}set px to 40`);
    push(`${pad}set py to ${FLOORS[1][0] - 10}`);
    push(`${pad}set pfloor to 1`);
    push(`${pad}set climbing to 0`);
    push(`${pad}set jumping to 0`);
    push(`${pad}set grace to 60`);
  };
  const dealLevel = (pad) => {
    for (let t = 0; t < NTIRE; t++) push(`${pad}set ton[${t}] to 0`);
    push(`${pad}set spawnt to 40`);
    push(`${pad}set btimer to 5000`);
    push(`${pad}set btick to 0`);
    push(`${pad}set wron to 1`);
    push(`${pad}set wrmode to 0`);
    resetPlayer(pad);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set level to 1`);
    dealLevel(pad);
    push(`${pad}set status.text to "UP THERE. THE SWITCH. GO."`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set level to 1");
  dealLevel("");
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

  // floor y lookup chain → fy (floor 7 = the platform)
  const floorY = (pad, fvar, out) => {
    push(`${pad}set ${out} to ${PLAT[0]}`);
    for (let f = 1; f <= 6; f++) {
      push(`${pad}if ${fvar} == ${f} then`);
      push(`${pad}  set ${out} to ${FLOORS[f][0]}`);
      push(`${pad}end`);
    }
  };

  // ======== tick
  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO CLIMB ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO CLIMB ◎"');
  push("end");

  push("if game == 0 then");
  push("  if grace > 0 then");
  push("    set grace to grace - 1");
  push("  end");
  // ---- the bonus drains all climb long
  push("  set btick to btick + 1");
  push("  if btick >= 120 then");
  push("    set btick to 0");
  push("    set btimer to max(0, btimer - 100)");
  push("  end");

  // ---- input
  push(`  set mvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  set mvy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push('  set pj to keydown("Space")');

  // ---- ladders: UP grabs one, and the climb owns you until a floor
  push("  set onladder to 0 - 1");
  LADDERS.forEach(([lx, lo, hi], i) => {
    push(`  if abs(px - ${lx}) < 9 and (pfloor == ${lo} or pfloor == ${hi} or climbing == ${i + 1}) then`);
    push(`    set onladder to ${i}`);
    push("  end");
  });
  push("  if climbing == 0 and jumping == 0 and onladder >= 0 and (mvy < -0.35 or mvy > 0.35) then");
  push("    set climbing to onladder + 1");
  push("  end");
  push("  if climbing > 0 then");
  const climbBlock = (i, lx, lo, hi) => {
    push(`    if climbing == ${i + 1} then`);
    push(`      set px to ${lx}`);
    push("      change py by mvy * 2");
    floorY("      ", String(hi), "topy");
    floorY("      ", String(lo), "boty");
    push("      if py <= topy - 10 then");
    push("        set py to topy - 10");
    push(`        set pfloor to ${hi}`);
    push("        set climbing to 0");
    push("      end");
    push("      if py >= boty - 10 then");
    push("        set py to boty - 10");
    push(`        set pfloor to ${lo}`);
    push("        set climbing to 0");
    push("      end");
    push("    end");
  };
  LADDERS.forEach(([lx, lo, hi], i) => climbBlock(i, lx, lo, hi));
  push("  else");
  // ---- walking and THE JUMP
  push("    change px by mvx * 1.8");
  push("    if jumping == 0 and pj == 1 and pj0 == 0 then");
  push("      set jumping to 1");
  push("      set jvy to -4.4");
  push("      set jscored to 0");
  push("      beep 392 for 0.05");
  push("    end");
  push("    if jumping == 1 then");
  push("      set jvy to jvy + 0.33");
  push("      change py by jvy");
  floorY("      ", "pfloor", "fy");
  push("      if jvy > 0 and py >= fy - 10 then");
  push("        set py to fy - 10");
  push("        set jumping to 0");
  push("      end");
  push("    else");
  floorY("      ", "pfloor", "fy");
  push("      set py to fy - 10");
  push("    end");
  push("  end");
  push("  set pj0 to pj");
  // screen edges
  push("  set px to max(18, min(342, px))");
  // ---- a fall is a fall: stepping past a girder's end
  push("  set offend to 0");
  for (let f = 1; f <= 6; f++) {
    push(`  if pfloor == ${f} and climbing == 0 and jumping == 0 and (px < ${FLOORS[f][1] - 4} or px > ${FLOORS[f][2] + 4}) then`);
    push("    set offend to 1");
    push("  end");
  }
  push(`  if pfloor == 7 and climbing == 0 and (px < ${PLAT[1] - 4} or px > ${PLAT[2] + 4}) then`);
  push("    set offend to 1");
  push("  end");
  push("  if offend == 1 and grace <= 0 then");
  push("    set pdie to 1");
  push('    set status.text to "THE DROP IS FURTHER THAN IT LOOKS"');
  push("  end");

  // ---- the crusher throws
  push("  set spawnt to spawnt - 1");
  push("  if spawnt <= 0 then");
  push("    set spawnt to max(70, 170 - level * 25)");
  push("    set free to 0 - 1");
  for (let t = 0; t < NTIRE; t++) {
    push(`    if free < 0 and ton[${t}] == 0 then`);
    push(`      set free to ${t}`);
    push("    end");
  }
  push("    if free >= 0 then");
  push("      set ton[free] to 1");
  push(`      set tx[free] to ${PLAT[1] + 32}`);   // out of the crusher itself
  push(`      set ty[free] to ${PLAT[0] - 8}`);
  push("      set tfl[free] to 7");
  push("      set tdrop[free] to 0");
  push("      beep 147 for 0.06");
  push("    end");
  push("  end");

  // ---- tires roll, drop, and surprise
  push("  set tspd to min(3, 1.5 + level * 0.25)");
  for (let t = 0; t < NTIRE; t++) {
    push(`  if ton[${t}] == 1 then`);
    push(`    if tdrop[${t}] == 1 then`);
    // falling to the next floor
    push(`      change ty[${t}] by 4`);
    floorY("      ", `tfl[${t}]`, "fy");
    push(`      if ty[${t}] >= fy - 8 then`);
    push(`        set ty[${t}] to fy - 8`);
    push(`        set tdrop[${t}] to 0`);
    push("      end");
    push("    else");
    // rolling the floor's way
    for (let f = 1; f <= 6; f++) {
      push(`      if tfl[${t}] == ${f} then`);
      push(`        change tx[${t}] by ${FLOORS[f][3]} * tspd`);
      push("      end");
    }
    push(`      if tfl[${t}] == 7 then`);
    push(`        change tx[${t}] by tspd`);
    push(`        if tx[${t}] > ${PLAT[2]} then`);
    push(`          set tfl[${t}] to 6`);
    push(`          set tdrop[${t}] to 1`);
    push("        end");
    push("      end");
    // off the open end → down a floor
    for (let f = 2; f <= 6; f++) {
      const gapRight = FLOORS[f][4] === 1;
      const edge = gapRight ? FLOORS[f][2] : FLOORS[f][1];
      push(`      if tfl[${t}] == ${f} and tx[${t}] ${gapRight ? ">" : "<"} ${edge} then`);
      push(`        set tfl[${t}] to ${f - 1}`);
      push(`        set tdrop[${t}] to 1`);
      push("      end");
    }
    // sometimes a tire takes a ladder down, just to ruin your plan
    LADDERS.filter(([, lo, hi]) => hi <= 6).forEach(([lx, lo, hi]) => {
      push(`      if tfl[${t}] == ${hi} and abs(tx[${t}] - ${lx}) < 2 and rand(0, 1) < 0.2 then`);
      push(`        set tfl[${t}] to ${lo}`);
      push(`        set tdrop[${t}] to 1`);
      push("      end");
    });
    // the yard floor rolls them out of the game
    push(`      if tfl[${t}] == 1 and tx[${t}] > 338 then`);
    push(`        set ton[${t}] to 0`);
    push("      end");
    push("    end");
    // the jump pays when a tire passes beneath you
    push(`    if jumping == 1 and jscored == 0 and abs(tx[${t}] - px) < 12 and ty[${t}] > py + 8 then`);
    push("      set jscored to 1");
    push("      change score by 100");
    push("      beep 659 for 0.06");
    push('      say "+100" for 0.5');
    push("    end");
    // contact: death — or, with the wrench, 300
    push(`    if ton[${t}] == 1 and abs(tx[${t}] - px) < 11 and abs(ty[${t}] - py) < 12 then`);
    push("      if wrmode > 0 then");
    push(`        set ton[${t}] to 0`);
    push(`        explode tire${t + 1}`);
    push("        change score by 300");
    push("        beep 220 for 0.08");
    push("      else");
    push("        if grace <= 0 then");
    push("          set pdie to 1");
    push("        end");
    push("      end");
    push("    end");
    push("  end");
  }

  // ---- the wrench
  push("  if wrmode > 0 then");
  push("    set wrmode to wrmode - 1");
  push("  end");
  push(`  if wron == 1 and pfloor == ${WRENCH_AT[1]} and abs(px - ${WRENCH_AT[0]}) < 12 and climbing == 0 then`);
  push("    set wron to 0");
  push("    set wrmode to 480");
  push("    beep 523 for 0.08");
  push("    beep 659 for 0.1");
  push('    set status.text to "WRENCH! TIRES ARE SCRAP FOR A FEW SECONDS"');
  push("  end");

  // ---- the switch at the top
  push(`  if pfloor == 7 and abs(px - ${SWITCH_X}) < 12 and climbing == 0 then`);
  push("    change score by btimer");
  push("    set level to level + 1");
  push("    beep 523 for 0.08");
  push("    beep 659 for 0.08");
  push("    beep 784 for 0.08");
  push("    beep 1047 for 0.2");
  push('    set status.text to "CRUSHER OFF! BANKED — ANGRIER NOW (LVL " + level + ")"');
  dealLevel("    ");
  push("  end");

  // ---- death
  push("  if pdie == 1 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode runner");
  push("    beep 150 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "THE YARD WINS — CLICK TO CLIMB AGAIN"');
  push("    else");
  resetPlayer("      ");
  push('      set status.text to lives + " RUNNERS LEFT"');
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "RUNNERS " + lives');
  push('  set bonustx.text to "BONUS " + btimer + " · L" + level');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set bonustx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // girders and the platform
  for (let f = 1; f <= 6; f++) {
    objects.push({
      id: "sy_f" + f, name: "girder" + f, type: "line",
      x: FLOORS[f][1], y: FLOORS[f][0], size: FLOORS[f][2] - FLOORS[f][1], angle: 0,
      color: ORANGE, glow: 5, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
    });
  }
  objects.push({
    id: "sy_pl", name: "platform", type: "line",
    x: PLAT[1], y: PLAT[0], size: PLAT[2] - PLAT[1], angle: 0, color: ORANGE, glow: 5, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  // ladders
  LADDERS.forEach(([lx, lo, hi], i) => {
    const yTop = hi === 7 ? PLAT[0] : FLOORS[hi][0];
    const yBot = FLOORS[lo] ? FLOORS[lo][0] : 448;
    objects.push({
      id: "sy_l" + i, name: "ladder" + (i + 1), type: "line",
      x: lx, y: yTop, size: yBot - yTop, angle: 90, color: CYAN, glow: 4, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
    });
  });

  // THE CRUSHER, its switch, the wrench
  objects.push({
    id: "sy_cr", name: "crusher", type: "box",
    x: PLAT[1] + 22, y: PLAT[0] - 16, size: 24, color: RED, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to ${inGame}
set self.glow to 8 + sin(time() * 500) * 5
end` }]
  });
  objects.push({
    id: "sy_sw", name: "offswitch", type: "text",
    x: SWITCH_X, y: PLAT[0] - 12, size: 10, color: GREEN, glow: 10, visible: 0, text: "OFF",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  objects.push({
    id: "sy_wr", name: "wrench", type: "text",
    x: WRENCH_AT[0], y: FLOORS[WRENCH_AT[1]][0] - 10, size: 13, color: GOLD, glow: 10, visible: 0, text: "W",
    script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and wron == 1)\nend` }]
  });

  // tires
  for (let t = 0; t < NTIRE; t++) {
    objects.push({
      id: "sy_t" + t, name: "tire" + (t + 1), type: "ring",
      x: -40, y: -40, size: 8, color: STEEL, glow: 6, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and ton[${t}] == 1)
set self.x to tx[${t}]
set self.y to ty[${t}]
end` }]
    });
  }

  // the runner (flashes with the wrench)
  objects.push({
    id: "sy_p", name: "runner", type: "box",
    x: 40, y: 438, size: 11, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (grace <= 0 or grace % 8 < 4))
set self.x to px
set self.y to py
if wrmode > 0 then
  set self.color to "${GOLD}"
  set self.glow to 14
else
  set self.color to "${WHITE}"
  set self.glow to 10
end
end` }]
  });

  // HUD
  objects.push({ id: "sy_sc", name: "scoretx", type: "text", x: 48, y: 22, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "sy_lv", name: "livestx", type: "text", x: 300, y: 20, size: 11, color: DIM, glow: 4, visible: 0, text: "RUNNERS 3", script: [] });
  objects.push({ id: "sy_bn", name: "bonustx", type: "text", x: 170, y: 20, size: 11, color: GOLD, glow: 5, visible: 0, text: "BONUS 5000 · L1", script: [] });
  objects.push({ id: "sy_st", name: "status", type: "text", x: W / 2, y: 468, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "sy_big", name: "bigtitle", type: "text", x: W / 2, y: 170, size: 30, color: ORANGE, glow: 16, visible: 1, text: "SCRAPYARD CLIMB", script: [] });
  objects.push({ id: "sy_sub", name: "subline", type: "text", x: W / 2, y: 206, size: 9, color: DIM, glow: 4, visible: 1, text: "ORIGINAL PLATFORMER · 1981 STYLE · TRIBUTE", script: [] });
  objects.push({ id: "sy_coin", name: "coinline", type: "text", x: W / 2, y: 236, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO CLIMB ◎", script: [] });
  objects.push({ id: "sy_play", name: "playbtn", type: "text", x: W / 2, y: 268, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ CLIMB ]", script: [] });
  objects.push({
    id: "sy_help", name: "help", type: "text",
    x: W / 2, y: 300, size: 8, color: DIM, glow: 3, visible: 1,
    text: "A/D WALK · W/S CLIMB · SPACE JUMPS +100",
    script: []
  });

  objects.push({
    id: "sy_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "sy_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "MOVE", script: [] });

  return { title: "Scrapyard Climb (1981 style)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    w: W, h: H, objects };
}

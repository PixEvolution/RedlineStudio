// example-frogger.js — FROGGER (1981), rebuilt in our studio.
//
// Konami's road-crossing classic: one hopper, thirteen rows of moving
// death, and the sharpest design trick of 1981 — the game FLIPS on you
// halfway up. On the road, everything that moves kills you. On the river,
// everything that moves is the only thing keeping you alive. Same joystick,
// opposite instincts, and five little bays at the top that each want
// exactly one safe arrival.
//
// The 1981 machine, faithfully:
//   · grid hops: every tap is one square, forward pays 10 the first time
//   · five traffic lanes, alternating directions, trucks wider than cars
//   · five river lanes: ride the logs and turtle rafts or drown — and
//     carried off the screen's edge counts as carried away
//   · DIVING turtles: they blink, then they go under. Don't be standing
//     on one when they do.
//   · five HOME BAYS: 50 + a time bonus each, walls between them are
//     real, a full bay is a wall too, and all five pay 1000 and deal a
//     faster level · sometimes a fly (*) waits in a bay for +200
//   · a timer on every crossing: the clock is a sixth lane of traffic
//
//   WASD / arrows / stick HOP · one square at a time · 3 HOPPERS

const W = 360, H = 480;
const STEP = 24, STARTY = 456, BANKY = 144;
const BAYX = [36, 108, 180, 252, 324];
const TIMER0 = 1800;                       // 30 seconds a crossing
// lanes: [y, dir, speed, kind, width, [slot offsets...], diverMask]
const LANES = [
  [408, 1, 1.1, "car", 20, [0, 120, 240]],
  [384, -1, 1.5, "car", 20, [40, 160, 280]],
  [360, 1, 2.1, "car", 20, [0, 180]],
  [336, -1, 1.3, "truck", 36, [60, 240]],
  [312, 1, 2.6, "car", 20, [20, 200]],
  [264, -1, 1.0, "turtle", 40, [0, 120, 240], [0, 1, 0]],
  [240, 1, 1.3, "log", 64, [0, 180]],
  [216, 1, 1.9, "log", 104, [40, 260]],
  [192, -1, 1.5, "turtle", 40, [30, 150, 270], [1, 0, 0]],
  [168, 1, 1.0, "log", 64, [70, 250]],
];
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  RED = "#ff6666", CYAN = "#7ddfff", BROWN = "#c89b5a", TGREEN = "#4ab87a";

// flatten vehicles
const VEH = [];
LANES.forEach(([y, dir, spd, kind, w, offs, divers], li) => {
  offs.forEach((off, k) => VEH.push({ y, dir, spd, kind, w, off, dive: divers ? divers[k] : 0, ph: (li * 97 + k * 173) % 420 }));
});
const NV = VEH.length;

export function buildFroggerExample() {
  const L = [];
  const push = (s) => L.push(s);

  const newHopper = (pad) => {
    push(`${pad}set px to 180`);
    push(`${pad}set py to ${STARTY}`);
    push(`${pad}set maxrow to 0`);
    push(`${pad}set btimer to ${TIMER0}`);
  };
  const dealLevel = (pad) => {
    for (let b = 0; b < 5; b++) push(`${pad}set homes[${b}] to 0`);
    push(`${pad}set flybay to floor(rand(0, 5))`);
    push(`${pad}set flyt to 600`);
    for (let i = 0; i < NV; i++) {
      push(`${pad}set vx[${i}] to ${VEH[i].off}`);
    }
    newHopper(pad);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set level to 1`);
    push(`${pad}set tik to 0`);
    dealLevel(pad);
    push(`${pad}set status.text to "THE ROAD KILLS. THE RIVER CARRIES. FIVE BAYS."`);
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

  // is turtle slot i under water right now? emits → sub
  const subCheck = (pad, i) => {
    push(`${pad}set sub to 0`);
    if (VEH[i].dive) {
      push(`${pad}set cyc to (tik + ${VEH[i].ph}) % 420`);
      push(`${pad}if cyc >= 320 then`);
      push(`${pad}  set sub to 1`);
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO CROSS ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO CROSS ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");
  push("  set lvm to 1 + (level - 1) * 0.2");
  // ---- traffic and river move
  for (let i = 0; i < NV; i++) {
    push(`  set vx[${i}] to ((vx[${i}] + ${VEH[i].dir} * ${VEH[i].spd} * lvm) + 540) % 480 - 60`);
  }
  // ---- the clock is a sixth lane
  push("  set btimer to btimer - 1");
  push("  if btimer <= 0 then");
  push("    set pdie to 1");
  push('    set status.text to "OUT OF TIME"');
  push("  end");

  // ---- hops (one square a tap)
  const hop = (expr, flag, dx, dy) => {
    push(`  set pk to ${expr}`);
    push(`  if pk >= 1 and ${flag} == 0 then`);
    if (dy < 0) {
      push(`    set py to max(${BANKY}, py + ${dy})`);
      push("    set rown to floor((456 - py) / 24 + 0.5)");
      push("    if rown > maxrow then");
      push("      set maxrow to rown");
      push("      change score by 10");
      push("      beep 523 for 0.03");
      push("    else");
      push("      beep 392 for 0.03");
      push("    end");
    } else if (dy > 0) {
      push(`    set py to min(${STARTY}, py + ${dy})`);
      push("    beep 392 for 0.03");
    } else {
      push(`    set px to max(12, min(348, px + ${dx}))`);
      push("    beep 392 for 0.03");
    }
    push("  end");
    push(`  set ${flag} to pk`);
  };
  hop('keydown("w") + keydown("ArrowUp") + max(0, 0 - sticky(1))', "pkw", 0, -STEP);
  hop('keydown("s") + keydown("ArrowDown") + max(0, sticky(1))', "pks", 0, STEP);
  hop('keydown("a") + keydown("ArrowLeft") + max(0, 0 - stickx(1))', "pka", -STEP, 0);
  hop('keydown("d") + keydown("ArrowRight") + max(0, stickx(1))', "pkd", STEP, 0);

  // ---- the bank: bays, walls, the fly
  push(`  if py <= ${BANKY} then`);
  push("    set bay to 0 - 1");
  BAYX.forEach((bx, b) => {
    push(`    if abs(px - ${bx}) < 16 then`);
    push(`      set bay to ${b}`);
    push("    end");
  });
  push("    if bay < 0 then");
  push("      set pdie to 1");
  push('      set status.text to "THAT WAS THE WALL, NOT THE BAY"');
  push("    else");
  push("      if homes[bay] == 1 then");
  push("        set pdie to 1");
  push('        set status.text to "THAT BAY IS TAKEN"');
  push("      else");
  push("        set homes[bay] to 1");
  push("        change score by 50 + floor(btimer / 30)");
  push("        beep 659 for 0.08");
  push("        if flybay == bay and flyt > 0 then");
  push("          change score by 200");
  push('          say "FLY +200" for 0.8');
  push("        end");
  push("        set homed to homes[0] + homes[1] + homes[2] + homes[3] + homes[4]");
  push("        if homed == 5 then");
  push("          change score by 1000");
  push("          set level to level + 1");
  push("          beep 523 for 0.08");
  push("          beep 659 for 0.08");
  push("          beep 784 for 0.08");
  push("          beep 1047 for 0.2");
  dealLevel("          ");
  push('          set status.text to "ALL FIVE HOME +1000 — LEVEL " + level + ", FASTER TRAFFIC"');
  push("        else");
  newHopper("          ");
  push('          set status.text to homed + " OF 5 HOME"');
  push("        end");
  push("      end");
  push("    end");
  push("  end");

  // ---- the fly flits between empty bays
  push("  set flyt to flyt - 1");
  push("  if flyt <= 0 then");
  push("    set flyt to 600");
  push("    set flybay to floor(rand(0, 5))");
  push("  end");

  // ---- the road kills
  push(`  if py >= 312 and py <= 408 then`);
  for (let i = 0; i < NV; i++) {
    if (VEH[i].kind !== "car" && VEH[i].kind !== "truck") continue;
    push(`    if py == ${VEH[i].y} and abs(px - vx[${i}]) < ${VEH[i].w / 2 + 4} then`);
    push("      set pdie to 1");
    push('      set status.text to "TRAFFIC."');
    push("    end");
  }
  push("  end");

  // ---- the river carries — or it doesn't
  push(`  if py >= 168 and py <= 264 then`);
  push("    set riding to 0 - 1");
  for (let i = 0; i < NV; i++) {
    if (VEH[i].kind !== "log" && VEH[i].kind !== "turtle") continue;
    push(`    if py == ${VEH[i].y} and abs(px - vx[${i}]) < ${VEH[i].w / 2 + 8} then`);
    subCheck("      ", i);
    push("      if sub == 0 then");
    push(`        set riding to ${i}`);
    push(`        set ridespd to ${VEH[i].dir} * ${VEH[i].spd}`);
    push("      end");
    push("    end");
  }
  push("    if riding < 0 then");
  push("      set pdie to 1");
  push('      set status.text to "THE RIVER IS NOT A ROAD"');
  push("    else");
  push("      change px by ridespd * lvm");
  push("      if px < 4 or px > 356 then");
  push("        set pdie to 1");
  push('        set status.text to "CARRIED AWAY"');
  push("      end");
  push("    end");
  push("  end");

  // ---- a death
  push("  if pdie == 1 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode hopper");
  push("    beep 150 for 0.15");
  push("    beep 82 for 0.25");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "NO HOPPERS LEFT — CLICK TO CROSS AGAIN"');
  push("    else");
  newHopper("      ");
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "HOPPERS " + lives + " · L" + level');
  push("  set timebar.size to max(1, btimer * 0.1)");
  push("  if btimer < 450 then");
  push(`    set timebar.color to "${RED}"`);
  push("  else");
  push(`    set timebar.color to "${GREEN}"`);
  push("  end");
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set timebar.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // the two shores, the median, the water band
  const strips = [
    ["startstrip", STARTY + 10, GREEN], ["median", 288 + 10, GREEN], ["bankline", BANKY + 12, GREEN],
  ];
  strips.forEach(([name, y, c], i) => {
    objects.push({
      id: "fg_s" + i, name, type: "line",
      x: 0, y, size: W, angle: 0, color: c, glow: 3, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
    });
  });
  // bay walls: short segments between bays
  for (let wseg = 0; wseg <= 5; wseg++) {
    const x0 = wseg === 0 ? 0 : BAYX[wseg - 1] + 18;
    const x1 = wseg === 5 ? W : BAYX[wseg] - 18;
    objects.push({
      id: "fg_w" + wseg, name: "baywall" + (wseg + 1), type: "line",
      x: x0, y: BANKY - 10, size: Math.max(2, x1 - x0), angle: 0, color: DIM, glow: 3, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
    });
  }
  // the bays and their trophies
  BAYX.forEach((bx, b) => {
    objects.push({
      id: "fg_b" + b, name: "bay" + (b + 1), type: "tri",
      x: bx, y: BANKY - 2, size: 9, angle: -90, color: GREEN, glow: 10, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and homes[${b}] == 1)
end` }]
    });
  });
  objects.push({
    id: "fg_fly", name: "fly", type: "text",
    x: -20, y: BANKY - 4, size: 11, color: GOLD, glow: 10, visible: 0, text: "*",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and flyt > 0 and homes[flybay] == 0)
set self.x to 36 + flybay * 72
set self.glow to 8 + sin(time() * 500) * 5
end` }]
  });

  // the traffic and the river fleet
  VEH.forEach((v, i) => {
    let glyph, col, size;
    if (v.kind === "car") { glyph = "■"; col = i % 2 ? RED : CYAN; size = 20; }
    if (v.kind === "truck") { glyph = "■■"; col = GOLD; size = 22; }
    if (v.kind === "log") { glyph = v.w > 100 ? "■■■■■■■■" : "■■■■■"; col = BROWN; size = v.w > 100 ? 18 : 17; }
    if (v.kind === "turtle") { glyph = "●●●"; col = TGREEN; size = 16; }
    const diveSrc = v.dive ? `
set cyc to (tik + ${v.ph}) % 420
if cyc >= 320 then
  set self.visible to 0
end
if cyc >= 260 and cyc < 320 then
  set self.color to "${DIM}"
else
  set self.color to "${TGREEN}"
end` : "";
    objects.push({
      id: "fg_v" + i, name: "veh" + (i + 1), type: "text",
      x: Math.max(40, Math.min(320, v.off)), y: v.y, size, color: col, glow: 7, visible: 0, text: glyph,
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and vx[${i}] > -55 and vx[${i}] < 415)
set self.x to vx[${i}]${diveSrc}
end` }]
    });
  });

  // the hopper
  objects.push({
    id: "fg_p", name: "hopper", type: "box",
    x: 180, y: STARTY, size: 12, color: GREEN, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to ${inGame}
set self.x to px
set self.y to py
end` }]
  });

  // HUD
  objects.push({ id: "fg_sc", name: "scoretx", type: "text", x: 48, y: 22, size: 18, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "fg_lv", name: "livestx", type: "text", x: 286, y: 20, size: 11, color: DIM, glow: 4, visible: 0, text: "HOPPERS 3 · L1", script: [] });
  objects.push({ id: "fg_tt", name: "timetx", type: "text", x: 32, y: 474, size: 9, color: DIM, glow: 3, visible: 0, text: "TIME", script: [] });
  objects.push({ id: "fg_tb", name: "timebar", type: "line", x: 56, y: 474, size: 180, angle: 0, color: GREEN, glow: 7, visible: 0, text: "", script: [] });
  objects.push({ id: "fg_st", name: "status", type: "text", x: W / 2, y: 112, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "fg_big", name: "bigtitle", type: "text", x: W / 2, y: 170, size: 38, color: GREEN, glow: 18, visible: 1, text: "FROGGER", script: [] });
  objects.push({ id: "fg_sub", name: "subline", type: "text", x: W / 2, y: 198, size: 9, color: DIM, glow: 4, visible: 1, text: "KONAMI 1981 · THE ROAD-CROSSING CLASSIC", script: [] });
  objects.push({ id: "fg_coin", name: "coinline", type: "text", x: W / 2, y: 226, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO CROSS ◎", script: [] });
  objects.push({ id: "fg_play", name: "playbtn", type: "text", x: W / 2, y: 258, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ CROSS ]", script: [] });
  objects.push({
    id: "fg_help", name: "help", type: "text",
    x: W / 2, y: 288, size: 8, color: DIM, glow: 3, visible: 1,
    text: "WASD HOPS ONE SQUARE · RIDE THE LOGS · MIND THE DIVING TURTLES · 5 BAYS",
    script: []
  });

  objects.push({
    id: "fg_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "fg_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "HOP", script: [] });

  return { title: "Frogger (1981)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    w: W, h: H, objects };
}

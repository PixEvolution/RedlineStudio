// example-battlezone.js — BATTLEZONE (1980), rebuilt in our studio.
//
// Atari's green wireframe battlefield: the first 3D world most people ever
// stood inside. A flat plane out to the mountains, geometry you can hide
// behind, one enemy tank hunting you through it — and a periscope hood on
// the cabinet so you LOOKED INTO the world instead of at it. It was so
// convincing that the U.S. Army commissioned a modified version ("The
// Bradley Trainer") to teach gunnery — one of the first serious military
// uses of a video game, and two of its developers refused to work on it.
//
// The 1980 machine, faithfully:
//   · true first-person: the world turns around YOU — every object is
//     projected from tank-relative coordinates every frame
//   · pyramids and blocks are COVER: they stop shells, theirs and yours
//   · one hunter at a time — the tank (1000) stalks and shells you, and
//     every third kill sends the MISSILE (2000) charging straight in
//   · the radar sweep up top, the crack of a hull hit, the volcano
//     smoking on the horizon because the horizon deserved one
//   · their shell is slow and honest: SEEN EARLY, it can be dodged
//
//   W/S DRIVE · A/D TURN · SPACE FIRES · or the stick · 3 HULLS

const W = 480, H = 360;
const HOR = 158;                 // the horizon line
const NOBS = 6;
const OBST = [                   // world x, z, shape (0 pyramid, 1 block)
  [120, 160, 0], [-140, 240, 1], [40, 380, 0],
  [-60, -200, 1], [220, -120, 0], [-260, 60, 1],
];
const GREEN = "#7dff9e", DIMG = "#3f7a52", DIM = "#7a8894", WHITE = "#ffffff", RED = "#ff6666";

export function buildBattlezoneExample() {
  const L = [];
  const push = (s) => L.push(s);

  // tank-relative transform for world point (wx, wz) → rxv (right), rzv (ahead)
  const rel = (pad, wxE, wzE) => {
    push(`${pad}set dxx to ${wxE} - px`);
    push(`${pad}set dzz to ${wzE} - pz`);
    push(`${pad}set rxv to dxx * cos(hdg) - dzz * sin(hdg)`);
    push(`${pad}set rzv to dxx * sin(hdg) + dzz * cos(hdg)`);
  };

  const spawnEnemy = (pad) => {
    push(`${pad}set kills3 to kills % 3`);
    push(`${pad}set emiss to 0`);
    push(`${pad}if kills > 0 and kills3 == 0 then`);
    push(`${pad}  set emiss to 1`);
    push(`${pad}end`);
    push(`${pad}set ebear to rand(0, 360)`);
    push(`${pad}set ex to px + sin(ebear) * 320`);
    push(`${pad}set ez to pz + cos(ebear) * 320`);
    push(`${pad}set efire to 160`);
    push(`${pad}set eshell to 0`);
    push(`${pad}if emiss == 1 then`);
    push(`${pad}  set status.text to "MISSILE INBOUND — IT DOES NOT STOP"`);
    push(`${pad}  beep 988 for 0.1`);
    push(`${pad}  beep 988 for 0.1`);
    push(`${pad}else`);
    push(`${pad}  set status.text to "ENEMY TANK IN THE ZONE"`);
    push(`${pad}end`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set kills to 0`);
    push(`${pad}set px to 0`);
    push(`${pad}set pz to 0`);
    push(`${pad}set hdg to 0`);
    push(`${pad}set pshot to 0`);
    push(`${pad}set hitt to 0`);
    spawnEnemy(pad);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push("set px to 0");
  push("set pz to 0");
  push("set hdg to 0");
  push("set pshot to 0");
  push("set eshell to 0");
  push("set kills to 0");
  spawnEnemy("");
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO ROLL OUT ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO ROLL OUT ◎"');
  push("end");

  push("if game == 0 then");
  // ---- treads
  push(`  set trn to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push("  change hdg by trn * 1.7");
  push(`  set thr to max(-1, min(1, keydown("w") + keydown("ArrowUp") - keydown("s") - keydown("ArrowDown") - sticky(1)))`);
  push("  set npx to px + sin(hdg) * thr * 1.9");
  push("  set npz to pz + cos(hdg) * thr * 1.9");
  // geometry is solid: you can hide behind it, not drive through it
  push("  set blocked to 0");
  for (let i = 0; i < NOBS; i++) {
    push(`  if abs(npx - ${OBST[i][0]}) < 26 and abs(npz - ${OBST[i][1]}) < 26 then`);
    push("    set blocked to 1");
    push("  end");
  }
  push("  if blocked == 0 then");
  push("    set px to npx");
  push("    set pz to npz");
  push("  end");
  push("  if hitt > 0 then");
  push("    set hitt to hitt - 1");
  push("  end");

  // ---- the hunter
  push("  set espd to 1.1");
  push("  if emiss == 1 then");
  push("    set espd to 3.1");
  push("  end");
  push("  set edx to px - ex");
  push("  set edz to pz - ez");
  push("  set edist to abs(edx) + abs(edz)");
  // the tank keeps its distance band; the missile just comes
  push("  if emiss == 1 or edist > 150 then");
  push("    if abs(edx) > 4 then");
  push("      if edx > 0 then");
  push("        change ex by espd * 0.7");
  push("      else");
  push("        change ex by 0 - espd * 0.7");
  push("      end");
  push("    end");
  push("    if abs(edz) > 4 then");
  push("      if edz > 0 then");
  push("        change ez by espd * 0.7");
  push("      else");
  push("        change ez by 0 - espd * 0.7");
  push("      end");
  push("    end");
  push("  end");
  // the missile rams
  push("  if emiss == 1 and abs(edx) < 14 and abs(edz) < 14 then");
  push("    set ehit to 1");
  push("  end");
  // the tank shells (slow, honest, dodgeable)
  push("  if emiss == 0 and eshell == 0 then");
  push("    set efire to efire - 1");
  push("    if efire <= 0 and edist < 420 then");
  push("      set efire to 200 + rand(0, 100)");
  push("      set eshell to 1");
  push("      set shx to ex");
  push("      set shz to ez");
  push("      set shlen to max(10, max(abs(edx), abs(edz)) + 0.41 * min(abs(edx), abs(edz)))");
  push("      set shvx to edx / shlen * 2.6");
  push("      set shvz to edz / shlen * 2.6");
  push("      set shage to 220");
  push("      beep 540 for 0.08");
  push("    end");
  push("  end");
  push("  if eshell == 1 then");
  push("    change shx by shvx");
  push("    change shz by shvz");
  push("    set shage to shage - 1");
  push("    if shage <= 0 then");
  push("      set eshell to 0");
  push("    end");
  // cover stops their shells too
  for (let i = 0; i < NOBS; i++) {
    push(`    if abs(shx - ${OBST[i][0]}) < 22 and abs(shz - ${OBST[i][1]}) < 22 then`);
    push("      set eshell to 0");
    push("    end");
  }
  push("    if eshell == 1 and abs(shx - px) < 11 and abs(shz - pz) < 11 then");
  push("      set eshell to 0");
  push("      set ehit to 1");
  push("    end");
  push("  end");
  // taking the hit
  push("  if ehit == 1 then");
  push("    set ehit to 0");
  push("    set lives to lives - 1");
  push("    set hitt to 50");
  push("    beep 70 for 0.5");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "HULL GONE — CLICK TO ROLL OUT AGAIN"');
  push("    else");
  push('      set status.text to "HULL HIT — " + lives + " LEFT"');
  spawnEnemy("      ");
  push("    end");
  push("  end");

  // ---- your gun: one shell, straight down the barrel
  push('  set pf to keydown("Space")');
  push("  if pf == 1 and pf0 == 0 and pshot == 0 then");
  push("    set pshot to 1");
  push("    set psx to px + sin(hdg) * 14");
  push("    set psz to pz + cos(hdg) * 14");
  push("    set psvx to sin(hdg) * 7");
  push("    set psvz to cos(hdg) * 7");
  push("    set psage to 70");
  push("    beep 180 for 0.08");
  push("  end");
  push("  set pf0 to pf");
  push("  if pshot == 1 then");
  push("    change psx by psvx");
  push("    change psz by psvz");
  push("    set psage to psage - 1");
  push("    if psage <= 0 then");
  push("      set pshot to 0");
  push("    end");
  for (let i = 0; i < NOBS; i++) {
    push(`    if abs(psx - ${OBST[i][0]}) < 22 and abs(psz - ${OBST[i][1]}) < 22 then`);
    push("      set pshot to 0");
    push("      beep 120 for 0.05");
    push("    end");
  }
  push("    if pshot == 1 and abs(psx - ex) < 16 and abs(psz - ez) < 16 then");
  push("      set pshot to 0");
  // the explosion lives in the WORLD, not on the glass: it keeps the dead
  // tank's ground position and is re-projected every frame, so turning the
  // periscope sweeps it past like everything else
  push("      set wrecon to 1");
  push("      set wrecx to ex");
  push("      set wrecz to ez");
  push("      set wrect to 55");
  push("      beep 90 for 0.3");
  push("      set kills to kills + 1");
  push("      if emiss == 1 then");
  push("        change score by 2000");
  push('        say "MISSILE DOWN +2000" for 1');
  push("      else");
  push("        change score by 1000");
  push('        say "TANK DOWN +1000" for 1');
  push("      end");
  spawnEnemy("      ");
  push("    end");
  push("  end");

  // ---- PROJECTION: the whole world through the periscope, every frame
  rel("  ", "ex", "ez");
  push("  set escx to 240 + rxv * 260 / max(8, rzv)");
  push("  set escy to " + HOR + " + 3400 / max(8, rzv)");
  push("  set escs to min(56, 3200 / max(8, rzv))");
  push("  set eson to 0");
  push("  if rzv > 8 then");
  push("    set eson to 1");
  push("  end");
  push("  set erx to rxv");
  push("  set erz to rzv");
  // ---- the burning wreck: a world point like any other
  push("  set wkv to 0");
  push("  if wrecon == 1 then");
  push("    set wrect to wrect - 1");
  push("    if wrect <= 0 then");
  push("      set wrecon to 0");
  push("    end");
  push("  end");
  rel("  ", "wrecx", "wrecz");
  push("  set wkx to 240 + rxv * 260 / max(8, rzv)");
  push(`  set wky to ${HOR} + 3400 / max(8, rzv)`);
  push("  set wks to min(56, 3200 / max(8, rzv))");
  push("  if wrecon == 1 and rzv > 8 then");
  push("    set wkv to 1");
  push("  end");
  for (let i = 0; i < NOBS; i++) {
    rel("  ", String(OBST[i][0]), String(OBST[i][1]));
    push(`  set o${i}x to 240 + rxv * 260 / max(8, rzv)`);
    push(`  set o${i}y to ${HOR} + 3400 / max(8, rzv)`);
    push(`  set o${i}s to min(78, 3000 / max(8, rzv))`);
    push(`  set o${i}on to 0`);
    push("  if rzv > 8 then");
    push(`    set o${i}on to 1`);
    push("  end");
  }
  rel("  ", "shx", "shz");
  push("  set sscx to 240 + rxv * 260 / max(8, rzv)");
  push("  set sscy to " + HOR + " + 3400 / max(8, rzv)");
  push("  set sson to 0");
  push("  if eshell == 1 and rzv > 8 then");
  push("    set sson to 1");
  push("  end");
  rel("  ", "psx", "psz");
  push("  set pscx to 240 + rxv * 260 / max(8, rzv)");
  push("  set pscy to " + HOR + " + 3400 / max(8, rzv)");
  push("  set pson to 0");
  push("  if pshot == 1 and rzv > 8 then");
  push("    set pson to 1");
  push("  end");
  // the mountains slide with the heading; the volcano smokes at 140°
  push("  set volx to (140 - hdg) % 360");
  push("  if volx > 180 then");
  push("    set volx to volx - 360");
  push("  end");
  push("  if volx < -180 then");
  push("    set volx to volx + 360");
  push("  end");
  push("  set volsx to 240 + volx * 4");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push('  set livestx.text to "HULLS " + lives');
  push("  set warn to 0");
  push("  if eson == 1 and erz < 160 and abs(erx) < erz * 0.9 then");
  push("    set warn to 1");
  push("  end");
  push("  set warntx.visible to (warn == 1)");
  push("  set warntx.glow to 8 + sin(time() * 400) * 6");
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("if game != 0 then");
  push("  set warntx.visible to 0");
  push("end");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // the horizon, the mountains, the volcano
  objects.push({
    id: "bz_hr", name: "horizon", type: "line",
    x: 0, y: HOR, size: W, angle: 0, color: DIMG, glow: 4, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  for (let m = 0; m < 5; m++) {
    const az = m * 72;   // evenly around the compass
    objects.push({
      id: "bz_m" + m, name: "mountain" + (m + 1), type: "tri",
      x: 0, y: HOR - 7, size: 13 + (m % 3) * 4, angle: -90, color: DIMG, glow: 3, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set mrel to (${az} - hdg) % 360
if mrel > 180 then
  set mrel to mrel - 360
end
if mrel < -180 then
  set mrel to mrel + 360
end
set self.x to 240 + mrel * 4
set self.visible to (${inGame} and abs(mrel) < 62)
end` }]
    });
  }
  objects.push({
    id: "bz_v", name: "volcano", type: "tri",
    x: 0, y: HOR - 10, size: 20, angle: -90, color: DIMG, glow: 4, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.x to volsx
set self.visible to (${inGame} and abs(volx) < 62)
end` }]
  });
  objects.push({
    id: "bz_vs", name: "volcanospark", type: "dot",
    x: 0, y: HOR - 24, size: 2, color: RED, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.x to volsx + rand(-4, 4)
set self.y to ${HOR} - 22 - rand(0, 8)
set self.visible to (${inGame} and abs(volx) < 62 and rand(0, 1) < 0.5)
end` }]
    });

  // the geometry — cover you can hide behind
  for (let i = 0; i < NOBS; i++) {
    objects.push({
      id: "bz_o" + i, name: (OBST[i][2] ? "block" : "pyramid") + (i + 1), type: OBST[i][2] ? "box" : "tri",
      x: -100, y: -100, size: 20, angle: OBST[i][2] ? 0 : -90, color: GREEN, glow: 6, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and o${i}on == 1)
set self.x to o${i}x
set self.y to o${i}y - o${i}s / 2
set self.size to o${i}s
end` }]
    });
  }

  // the hunter (tank or missile), their shell, your shell
  objects.push({
    id: "bz_e", name: "enemy", type: "text",
    x: -100, y: -100, size: 16, color: GREEN, glow: 10, visible: 0, text: "[Ξ]",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and eson == 1)
set self.x to escx
set self.y to escy - escs / 3
set self.size to max(6, escs * 0.6)
if emiss == 1 then
  set self.text to "▲"
  set self.color to "${WHITE}"
else
  set self.text to "[Ξ]"
  set self.color to "${GREEN}"
end
end` }]
  });

  // the wreck: two expanding rings + a guttering flame, pinned to the ground
  // where the tank died — they slide across the glass as you turn, like the
  // mountains do, because they live in the world
  objects.push({
    id: "bz_wk1", name: "wreckring1", type: "ring",
    x: -90, y: -90, size: 8, color: WHITE, glow: 14, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and wkv == 1)
set self.x to wkx
set self.y to wky
set self.size to wks * (0.15 + (55 - wrect) / 55 * 0.85)
end` }]
  });
  objects.push({
    id: "bz_wk2", name: "wreckring2", type: "ring",
    x: -90, y: -90, size: 5, color: RED, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and wkv == 1)
set self.x to wkx
set self.y to wky
set self.size to wks * (0.08 + (55 - wrect) / 55 * 0.45)
end` }]
  });
  objects.push({
    id: "bz_wk3", name: "wreckflame", type: "dot",
    x: -90, y: -90, size: 4, color: WHITE, glow: 16, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and wkv == 1 and wrect % 6 < 4)
set self.x to wkx
set self.y to wky
set self.size to max(2, wks * 0.12 * wrect / 55 * (1 + sin(time() * 900) * 0.4))
end` }]
  });
  objects.push({
    id: "bz_es", name: "theirshell", type: "dot",
    x: -100, y: -100, size: 3, color: WHITE, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and sson == 1)
set self.x to sscx
set self.y to sscy - 6
end` }]
  });
  objects.push({
    id: "bz_ps", name: "yourshell", type: "dot",
    x: -100, y: -100, size: 3, color: GREEN, glow: 12, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and pson == 1)
set self.x to pscx
set self.y to pscy - 6
end` }]
  });

  // the periscope furniture: crosshair, radar, hit flash
  objects.push({
    id: "bz_ch1", name: "crossv", type: "line",
    x: 240, y: HOR + 28, size: 26, angle: 90, color: GREEN, glow: 6, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  objects.push({
    id: "bz_ch2", name: "crossh", type: "line",
    x: 227, y: HOR + 41, size: 26, angle: 0, color: GREEN, glow: 6, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  objects.push({
    id: "bz_r", name: "radar", type: "ring",
    x: 240, y: 44, size: 32, color: DIMG, glow: 4, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  objects.push({
    id: "bz_rs", name: "radarsweep", type: "line",
    x: 240, y: 44, size: 32, angle: 0, color: GREEN, glow: 6, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to ${inGame}
change self.angle by 4
end` }]
  });
  objects.push({
    id: "bz_rb", name: "radarblip", type: "dot",
    x: 240, y: 44, size: 3, color: RED, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and abs(erx) < 300 and abs(erz) < 300)
set self.x to 240 + max(-30, min(30, erx * 0.1))
set self.y to 44 - max(-30, min(30, erz * 0.1))
end` }]
  });
  objects.push({
    id: "bz_hf", name: "hitflash", type: "ring",
    x: 240, y: 180, size: 170, color: RED, glow: 18, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and hitt > 0)
set self.size to 170 + hitt * 4
end` }]
  });

  // HUD
  objects.push({ id: "bz_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "bz_lv", name: "livestx", type: "text", x: 424, y: 22, size: 12, color: DIM, glow: 4, visible: 0, text: "HULLS 3", script: [] });
  objects.push({ id: "bz_wr", name: "warntx", type: "text", x: 240, y: 96, size: 13, color: RED, glow: 10, visible: 0, text: "⚠ ENEMY IN SIGHTS ⚠", script: [] });
  objects.push({ id: "bz_st", name: "status", type: "text", x: W / 2, y: 346, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "bz_big", name: "bigtitle", type: "text", x: W / 2, y: 112, size: 40, color: GREEN, glow: 18, visible: 1, text: "BATTLEZONE", script: [] });
  objects.push({ id: "bz_sub", name: "subline", type: "text", x: W / 2, y: 144, size: 10, color: DIM, glow: 4, visible: 1, text: "ATARI 1980 · FIRST-PERSON 3D VECTOR TANK COMBAT", script: [] });
  objects.push({ id: "bz_coin", name: "coinline", type: "text", x: W / 2, y: 176, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO ROLL OUT ◎", script: [] });
  objects.push({ id: "bz_play", name: "playbtn", type: "text", x: W / 2, y: 214, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ ROLL OUT ]", script: [] });
  objects.push({
    id: "bz_help", name: "help", type: "text",
    x: W / 2, y: 248, size: 9, color: DIM, glow: 3, visible: 1,
    text: "W/S DRIVE · A/D TURN · SPACE FIRES · HIDE BEHIND THE GEOMETRY",
    script: []
  });

  objects.push({
    id: "bz_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "bz_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "TREADS", script: [] });

  return { title: "Battlezone (1980)", objects };
}

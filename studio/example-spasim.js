// example-spasim.js — SPASIM (1974), rebuilt in our studio.
// Jim Bowery's space sim on the PLATO network: the first 3D MULTIPLAYER
// game — 32 players at once, flying wireframe ships across four planetary
// systems of EIGHT players each, positions updating about once a second
// over the network. Our cabinet is one full planetary system: publish it
// with PLAYERS = 8 and eight humans share this cube of space (and our wire
// updates ~7×/second — faster than PLATO managed in 1974).
//
// This machine teaches the Studio true 3D: every ship and planet is
// PROJECTED — camera-space rotation by your yaw and pitch, then a
// perspective divide — all in plain RedScript with sin/cos. Open the code
// and read the projection block: it's the whole secret of 3D, in 20 lines.
//
//   A/D yaw · W/S pitch · hold E to thrust · SPACE fires the phaser
//   Free-flight dogfight: get hit and you re-enter at your home point;
//   your kills ride the HIGH SCORES table. Space wraps around (fly off one
//   edge of the cube, arrive at the other). The coin buys ~90 seconds.
//
// Period details, straight from the real machine: you STEER in polar
// (turn/pitch keys) but your POSITION reads out in Cartesian — an X · Y · Z
// instrument that updates once a second, exactly the beat PLATO managed.
// And the planets aren't scenery: the July '74 version made them real
// places, so ours ORBIT the system's sun — navigate by where they'll be.

const T = 5400;                                    // ~90 seconds per coin
const VX = 240, VY = 166, K = 240;                 // screen center + focal length
const SEATS = 8;

// home entry points, spread through the 100³ cube, each facing the middle
const SPAWNS = [
  [10, 10, 10], [90, 90, 90], [90, 10, 50], [10, 90, 50],
  [50, 10, 90], [50, 90, 10], [10, 50, 90], [90, 50, 10]
];
const spawnYaw = ([x, y]) => Math.round(Math.atan2(50 - y, 50 - x) * 180 / Math.PI);

// THE SYSTEM: a sun at the center of the cube, four planets in real orbits
// around it — different radii, speeds and heights, so the sky is never
// the same twice and the scope reads like a live orrery, not a parade square.
const SUN = { x: 50, y: 50, z: 50, r: 2600, c: "#ffe08a" };
const PLANETS = [
  { orb: 16, z: 46, spd: 0.050, ph: 20,  r: 700,  c: "#8fd0ff" },   // quick inner rock
  { orb: 26, z: 58, spd: 0.032, ph: 140, r: 1100, c: "#7dff9e" },   // the green one
  { orb: 35, z: 40, spd: 0.022, ph: 250, r: 900,  c: "#e8b3ff" },   // below the ecliptic
  { orb: 44, z: 64, spd: 0.015, ph: 330, r: 1400, c: "#ff9d4a" }    // slow outer giant
];

const SHIPCOLS = ["#ff9d4a", "#7dff9e", "#8fd0ff", "#e8b3ff", "#ffe08a", "#ff8f8c", "#9effe8"];
const RX = 410, RY = 296, RR = 38;                 // the radar scope

const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a";

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  // shortest wrap-aware delta on one axis of the 0..100 torus
  const wrapDelta = (v, pad) => {
    push(`${pad}if ${v} > 50 then`);
    push(`${pad}  change ${v} by -100`);
    push(`${pad}end`);
    push(`${pad}if ${v} < -50 then`);
    push(`${pad}  change ${v} by 100`);
    push(`${pad}end`);
  };

  // THE PROJECTION: world → camera → screen, for a target at (tx,ty,tz).
  // Leaves fwd/rgt/upp set; sxp/syp are the screen point when fwd > 2.
  const project = (tx, ty, tz, pad) => {
    push(`${pad}set dx to ${tx} - px`);
    push(`${pad}set dy to ${ty} - py`);
    push(`${pad}set dz to ${tz} - pz`);
    wrapDelta("dx", pad);
    wrapDelta("dy", pad);
    wrapDelta("dz", pad);
    // yaw: how far ahead, and how far to the right
    push(`${pad}set f1p to dx * cos(yaw) + dy * sin(yaw)`);
    push(`${pad}set rgt to dy * cos(yaw) - dx * sin(yaw)`);
    // pitch: how far ahead now, and how far above
    push(`${pad}set fwd to f1p * cos(pit) + dz * sin(pit)`);
    push(`${pad}set upp to dz * cos(pit) - f1p * sin(pit)`);
    push(`${pad}set sxp to ${VX} + ${K} * rgt / max(0.5, fwd)`);
    push(`${pad}set syp to ${VY} - ${K} * upp / max(0.5, fwd)`);
  };

  push("when start");
  push("set game to 9");
  push("set endplay to 0");
  push("set score to 0");
  push("set lasthits to 0");
  push("set clk to 0");
  SPAWNS.forEach(([x, y, z], i) => {
    push(`set sxs[${i + 1}] to ${x}`);
    push(`set sys[${i + 1}] to ${y}`);
    push(`set szs[${i + 1}] to ${z}`);
    push(`set sws[${i + 1}] to ${spawnYaw(SPAWNS[i])}`);
  });
  push("set px to 10");
  push("set py to 10");
  push("set pz to 10");
  push("set yaw to 45");
  push("set pit to 0");
  push("set spd to 0.18");
  push("end");

  push("when tick");
  push("set clk to clk + 1");
  // THE ORRERY: each planet rides its own circle around the sun — the
  // whole system is four lines of trig, and the scope becomes a live map
  PLANETS.forEach((p, i) => {
    push(`set p${i + 1}x to ${SUN.x} + ${p.orb} * cos(clk * ${p.spd} + ${p.ph})`);
    push(`set p${i + 1}y to ${SUN.y} + ${p.orb} * sin(clk * ${p.spd} + ${p.ph})`);
  });
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set startbtn.visible to (game == 9)");
  push("set scoretx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set hdgtx.visible to (game != 9)");
  push("set postx.visible to (game != 9)");
  push("set statusline.visible to (game == 2)");
  push("set ch1.visible to (game == 0)");
  push("set ch2.visible to (game == 0)");
  push("set ch3.visible to (game == 0)");
  push("set ch4.visible to (game == 0)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PRESS LAUNCH ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN ◎"');
  push("end");
  push('set scoretx.text to "KILLS " + score + " · PILOTS " + max(1, pcount)');
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60))');
  push('set hdgtx.text to "HDG " + floor((yaw % 360 + 360) % 360) + " · PIT " + floor(pit)');

  push("if game != 2 then");
  push("  set ns to max(1, netslot)");
  // my seat's slice of the room: the 7 other seats
  push("  set k to 0");
  for (let s = 1; s <= SEATS; s++) {
    push(`  if ns != ${s} then`);
    push("    set k to k + 1");
    push(`    set os[k] to ${s}`);
    push("  end");
  }

  // shot down? re-enter at my home point (the attacker already scored)
  push("  if game == 0 and hits != lasthits then");
  push("    set lasthits to hits");
  push("    explode self");
  push("    beep 70 for 0.4");
  push("    set px to sxs[ns]");
  push("    set py to sys[ns]");
  push("    set pz to szs[ns]");
  push("    set yaw to sws[ns]");
  push("    set pit to 0");
  push("    set spd to 0.18");
  push('    say "SHIP DESTROYED — RE-ENTERING" for 2');
  push("  end");
  push("  if game != 0 then");
  push("    set lasthits to hits");
  push("  end");

  // FLIGHT: the attract reel just cruises; the pilot flies with the keys
  push("  if game == 9 then");
  push("    change yaw by 0.25");
  push("    set pit to sin(time() * 20) * 8");
  push("    set spd to 0.22");
  push("  else");
  push('    if keydown("a") then');
  push("      change yaw by -2.2");
  push("    end");
  push('    if keydown("d") then');
  push("      change yaw by 2.2");
  push("    end");
  push('    if keydown("w") then');
  push("      set pit to min(80, pit + 1.8)");
  push("    end");
  push('    if keydown("s") then');
  push("      set pit to max(-80, pit - 1.8)");
  push("    end");
  push('    if keydown("e") then');
  push("      set spd to min(0.5, spd + 0.01)");
  push("    else");
  push("      set spd to max(0.12, spd * 0.995)");
  push("    end");
  push("  end");
  // fly (space is a torus — off one edge, in the other)
  push("  change px by cos(pit) * cos(yaw) * spd");
  push("  change py by cos(pit) * sin(yaw) * spd");
  push("  change pz by sin(pit) * spd");
  for (const v of ["px", "py", "pz"]) {
    push(`  if ${v} > 100 then`);
    push(`    change ${v} by -100`);
    push("  end");
    push(`  if ${v} < 0 then`);
    push(`    change ${v} by 100`);
    push("  end");
  }

  // ---- PROJECT THE SYSTEM ----
  // the sun
  project(SUN.x, SUN.y, SUN.z, "  ");
  push(`  if fwd > 2 and abs(sxp - ${VX}) < 300 and abs(syp - ${VY}) < 220 then`);
  push("    set sol.visible to 1");
  push("    set sol.x to sxp");
  push("    set sol.y to syp");
  push(`    set sol.size to min(70, ${SUN.r} / max(4, fwd) / 10)`);
  push("  else");
  push("    set sol.visible to 0");
  push("  end");
  // the planets, wherever their orbits have carried them
  PLANETS.forEach((p, i) => {
    project(`p${i + 1}x`, `p${i + 1}y`, p.z, "  ");
    push(`  if fwd > 2 and abs(sxp - ${VX}) < 300 and abs(syp - ${VY}) < 220 then`);
    push(`    set pl${i + 1}.visible to 1`);
    push(`    set pl${i + 1}.x to sxp`);
    push(`    set pl${i + 1}.y to syp`);
    push(`    set pl${i + 1}.size to min(60, ${p.r} / max(4, fwd) / 10)`);
    push("  else");
    push(`    set pl${i + 1}.visible to 0`);
    push("  end");
  });
  // the other pilots' ships — and whether my crosshair is on them
  for (let oi = 1; oi <= SEATS - 1; oi++) {
    push(`  set aimok[${oi}] to 0`);
    push(`  if fon[os[${oi}]] == 1 then`);
    project(`f1[os[${oi}]]`, `f2[os[${oi}]]`, `f3[os[${oi}]]`, "    ");
    push(`    if fwd > 2 and abs(sxp - ${VX}) < 300 and abs(syp - ${VY}) < 220 then`);
    push(`      set sh${oi}.visible to 1`);
    push(`      set sh${oi}.x to sxp`);
    push(`      set sh${oi}.y to syp`);
    push(`      set sh${oi}.size to min(22, max(3, 320 / max(2, fwd)))`);
    push(`      set sh${oi}.angle to f4[os[${oi}]] - yaw - 90`);
    push("    else");
    push(`      set sh${oi}.visible to 0`);
    push("    end");
    push("    if fwd > 2 and fwd < 70 and abs(rgt) < fwd * 0.12 and abs(upp) < fwd * 0.12 then");
    push(`      set aimok[${oi}] to 1`);
    push(`      set adist[${oi}] to fwd`);
    push("    end");
    // the radar scope: everyone on the same slice of sky
    push(`    set rd${oi}.visible to 1`);
    push(`    set rd${oi}.x to ${RX} + max(-${RR - 4}, min(${RR - 4}, dx * 0.65))`);
    push(`    set rd${oi}.y to ${RY} + max(-${RR - 4}, min(${RR - 4}, dy * 0.65))`);
    push("  else");
    push(`    set sh${oi}.visible to 0`);
    push(`    set rd${oi}.visible to 0`);
    push("  end");
  }
  // radar shows the system too — the sun and the planets mid-orbit
  push(`  set dx to ${SUN.x} - px`);
  push(`  set dy to ${SUN.y} - py`);
  wrapDelta("dx", "  ");
  wrapDelta("dy", "  ");
  push(`  set rsol.x to ${RX} + max(-${RR - 4}, min(${RR - 4}, dx * 0.65))`);
  push(`  set rsol.y to ${RY} + max(-${RR - 4}, min(${RR - 4}, dy * 0.65))`);
  PLANETS.forEach((p, i) => {
    push(`  set dx to p${i + 1}x - px`);
    push(`  set dy to p${i + 1}y - py`);
    wrapDelta("dx", "  ");
    wrapDelta("dy", "  ");
    push(`  set rp${i + 1}.x to ${RX} + max(-${RR - 4}, min(${RR - 4}, dx * 0.65))`);
    push(`  set rp${i + 1}.y to ${RY} + max(-${RR - 4}, min(${RR - 4}, dy * 0.65))`);
  });
  // the scope is a top-down world map (x right, y down — same as the sky),
  // so my marker's nose points exactly along my yaw: it flies nose-first
  push("  set rme.angle to yaw");

  // the Cartesian instrument: steer in polar, READ your position in X·Y·Z —
  // refreshed once a second, the same beat the PLATO network managed in 1974
  push("  if clk % 60 == 0 then");
  push('    set postx.text to "POS X " + floor(px) + " · Y " + floor(py) + " · Z " + floor(pz)');
  push("  end");

  // the net contract: where I am, which way I face, how I'm scoring
  push("  set net1 to px");
  push("  set net2 to py");
  push("  set net3 to pz");
  push("  set net4 to yaw");
  push("  set net5 to pit");
  push("  set net6 to score");
  push("end");

  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 150 for 0.5");
  push('    set statusline.text to "KILLS " + score + " · CLICK"');
  push("  end");
  push("end");
  push("end");

  // the phaser: hits the nearest ship under the crosshair
  push('when key "Space"');
  push("if game == 0 then");
  push("  beep 300 for 0.05");
  push("  set best to 0");
  push("  set bestd to 9999");
  for (let oi = 1; oi <= SEATS - 1; oi++) {
    push(`  if aimok[${oi}] == 1 and adist[${oi}] < bestd then`);
    push(`    set best to ${oi}`);
    push(`    set bestd to adist[${oi}]`);
    push("  end");
  }
  push("  if best > 0 then");
  for (let oi = 1; oi <= SEATS - 1; oi++) {
    push(`    if best == ${oi} then`);
    push(`      explode sh${oi}`);
    push("      beep 620 for 0.12");
    push("      change score by 1");
    push(`      set nettgt to os[${oi}]`);
    push("      change netev by 1");
    push("    end");
  }
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 240) < 60 and abs(mousey() - 210) < 16 then");
  push("    set game to 0");
  push("    set endplay to 0");
  push("    set score to 0");
  push("    set lasthits to hits");
  push(`    set timeleft to ${T}`);
  push("    set px to sxs[max(1, netslot)]");
  push("    set py to sys[max(1, netslot)]");
  push("    set pz to szs[max(1, netslot)]");
  push("    set yaw to sws[max(1, netslot)]");
  push("    set pit to 0");
  push("    set spd to 0.18");
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildSpasimExample() {
  const objects = [];

  // the sun, then the four planets that orbit it (drawn over the sun)
  objects.push({
    id: "sp_sol", name: "sol", type: "ring",
    x: VX, y: VY, size: 30, color: SUN.c, glow: 16, visible: 0, text: "", script: []
  });
  PLANETS.forEach((p, i) => {
    objects.push({
      id: "sp_p" + (i + 1), name: "pl" + (i + 1), type: "ring",
      x: VX, y: VY, size: 20, color: p.c, glow: 8, visible: 0, text: "", script: []
    });
  });

  // the seven other pilots
  for (let oi = 1; oi <= SEATS - 1; oi++) {
    objects.push({
      id: "sp_s" + oi, name: "sh" + oi, type: "tri",
      x: VX, y: VY, size: 10, angle: 0, color: SHIPCOLS[oi - 1], glow: 10, visible: 0, text: "", script: []
    });
  }

  // the crosshair
  const ch = (n, x, y, ang) => objects.push({
    id: "sp_" + n, name: n, type: "line",
    x, y, size: 10, angle: ang, color: GREEN, glow: 6, visible: 0, text: "", script: []
  });
  ch("ch1", VX - 22, VY, 0);
  ch("ch2", VX + 12, VY, 0);
  ch("ch3", VX, VY - 22, 90);
  ch("ch4", VX, VY + 12, 90);

  // the radar scope
  objects.push({
    id: "sp_rr", name: "rring", type: "ring",
    x: RX, y: RY, size: RR, color: "#2e5c3a", glow: 3, visible: 1, text: "", script: []
  });
  objects.push({
    id: "sp_rsol", name: "rsol", type: "dot",
    x: RX, y: RY, size: 3, color: SUN.c, glow: 6, visible: 1, text: "", script: []
  });
  PLANETS.forEach((p, i) => {
    objects.push({
      id: "sp_rp" + (i + 1), name: "rp" + (i + 1), type: "ring",
      x: RX, y: RY, size: 3, color: p.c, glow: 3, visible: 1, text: "", script: []
    });
  });
  for (let oi = 1; oi <= SEATS - 1; oi++) {
    objects.push({
      id: "sp_rd" + oi, name: "rd" + oi, type: "dot",
      x: RX, y: RY, size: 4, color: SHIPCOLS[oi - 1], glow: 5, visible: 0, text: "", script: []
    });
  }
  objects.push({
    id: "sp_rme", name: "rme", type: "tri",
    x: RX, y: RY, size: 6, angle: 45, color: WHITE, glow: 8, visible: 1, text: "",
    script: [{ event: "code", source: brainCode() }]
  });

  // HUD
  objects.push({
    id: "sp_sc", name: "scoretx", type: "text",
    x: 100, y: 22, size: 12, color: GREEN, glow: 8, visible: 0, text: "KILLS 0 · PILOTS 1", script: []
  });
  objects.push({
    id: "sp_tm", name: "timetx", type: "text",
    x: 240, y: 22, size: 12, color: WHITE, glow: 8, visible: 0, text: "TIME 90", script: []
  });
  objects.push({
    id: "sp_hd", name: "hdgtx", type: "text",
    x: 386, y: 22, size: 12, color: AMBER, glow: 8, visible: 0, text: "HDG 45 · PIT 0", script: []
  });
  // the Cartesian position instrument — polar in, X·Y·Z out, 1Hz, pure 1974
  objects.push({
    id: "sp_pos", name: "postx", type: "text",
    x: 88, y: 306, size: 10, color: AMBER, glow: 6, visible: 0, text: "POS X — · Y — · Z —", script: []
  });

  // the marquee
  objects.push({
    id: "sp_big", name: "bigtitle", type: "text",
    x: 240, y: 112, size: 24, color: WHITE, glow: 16, visible: 1, text: "SPASIM", script: []
  });
  objects.push({
    id: "sp_coin", name: "coinline", type: "text",
    x: 240, y: 140, size: 10, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "sp_sub", name: "subline", type: "text",
    x: 240, y: 162, size: 10, color: AMBER, glow: 8, visible: 1,
    text: "PLATO 1974 · ONE PLANETARY SYSTEM · 8 PILOTS", script: []
  });
  objects.push({
    id: "sp_start", name: "startbtn", type: "text",
    x: 240, y: 210, size: 14, color: GREEN, glow: 12, visible: 1, text: "[ LAUNCH ]", script: []
  });
  objects.push({
    id: "sp_status", name: "statusline", type: "text",
    x: 240, y: 140, size: 11, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "sp_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "1974 · A/D YAW · W/S PITCH · HOLD E THRUST · SPACE PHASER · SPACE WRAPS",
    script: []
  });

  return { title: "Spasim (1974)", objects };
}

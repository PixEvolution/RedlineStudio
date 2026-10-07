// example-asteroids.js — ASTEROIDS (1979), rebuilt in our studio.
//
// Atari's best-selling arcade machine EVER (~70,000 cabinets) — and it came
// off the same vector tube as Lunar Lander, four months later. Spacewar!'s
// physics (1962, two rooms over) finally met the coin slot: a ship that
// drifts forever, a screen that wraps in every direction, and rocks that
// split into FASTER, MEANER children when you shoot them. The genius is the
// pacing: the safest screen in the game is the one full of big slow rocks,
// and every shot you fire makes the room more dangerous.
//
// The 1979 machine, faithfully:
//   · real inertia — thrust is a suggestion, momentum is the law
//   · rocks split 1 → 2 → 4: large 20, medium 50, small 100 points
//   · FOUR shots in the air max, and they inherit your ship's velocity
//   · everything wraps: you, the rocks, your shots, the saucers
//   · saucers — the big one (200) sprays blind, the small one (1000)
//     AIMS, and shows up once you look like you know what you're doing
//   · HYPERSPACE — the panic button: teleport anywhere, and roughly one
//     jump in six the anywhere kills you
//   · extra ship every 10,000 · waves grow · the heartbeat quickens
//
//   A/D ROTATE · W THRUST · SPACE FIRE · S HYPERSPACE · or the stick:
//   lean to rotate, push up to thrust

const W = 480, H = 360;
const NROCK = 28, SHOTS = 4, SHOT_SPD = 6.5, SHOT_LIFE = 44;
const TURN = 3.6, THRUST = 0.09, DRAG = 0.003;
const RBIG = 22, RMED = 12, RSML = 6;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", ORANGE = "#ff9d4a";
const rockR = "(rsz[i] * rsz[i] * 2 + 2)";   // 3→20, 2→10, 1→4 (+ship/shot pad)

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const clearRocks = (pad) => {
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${NROCK}`);
    push(`${pad}  set rsz[i] to 0`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set rocks to 0`);
  };
  const dealWave = (pad) => {
    clearRocks(pad);
    push(`${pad}set nbig to min(10, 3 + wave)`);
    push(`${pad}set i to 0`);
    push(`${pad}repeat 10`);
    push(`${pad}  if i < nbig then`);
    push(`${pad}    set rsz[i] to 3`);
    push(`${pad}    set rx[i] to rand(0, ${W})`);
    push(`${pad}    set ry[i] to rand(0, 110) + (i % 2) * 220`);   // spawn off the ship's lane
    push(`${pad}    set rvx[i] to rand(-0.9, 0.9)`);
    push(`${pad}    set rvy[i] to rand(-0.9, 0.9)`);
    push(`${pad}    set rocks to rocks + 1`);
    push(`${pad}  end`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    push(`${pad}set wave to 1`);
    push(`${pad}set nextlife to 10000`);
    push(`${pad}set shipdead to 0`);
    push(`${pad}set sauceron to 0`);
    push(`${pad}set saucert to 800`);
    push(`${pad}set sshot to 0`);
    push(`${pad}set ship.x to ${W / 2}`);
    push(`${pad}set ship.y to ${H / 2}`);
    push(`${pad}set ship.angle to -90`);
    push(`${pad}set vx to 0`);
    push(`${pad}set vy to 0`);
    for (let j = 1; j <= SHOTS; j++) push(`${pad}set shot${j}.live to 0`);
    dealWave(pad);
    push(`${pad}set status.text to "EVERY SHOT MAKES THE ROOM MEANER."`);
  };

  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set wave to 1");
  push("set endplay to 0");
  push("set shipdead to 0");
  push("set sauceron to 0");
  dealWave("");
  push('set status.text to ""');
  push("end");

  push("when tick");
  push('set scoretx.text to "" + score');
  push('set livestx.text to "SHIPS " + lives');
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO DRIFT ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO DRIFT ◎"');
  push("end");

  // ---- the rocks drift and wrap, in the attract too
  push("if game == 0 or game == 9 then");
  push("  set i to 0");
  push(`  repeat ${NROCK}`);
  push("    if rsz[i] > 0 then");
  push("      set rx[i] to (rx[i] + rvx[i] + " + W + ") % " + W);
  push("      set ry[i] to (ry[i] + rvy[i] + " + H + ") % " + H);
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push("end");

  push("if game == 0 then");
  // the heartbeat — quicker as the room empties
  push("  set beatt to beatt + 1");
  push("  if beatt >= 18 + rocks * 3 then");
  push("    set beatt to 0");
  push("    set btone to 1 - btone");
  push("    if btone == 1 then");
  push("      beep 92 for 0.05");
  push("    else");
  push("      beep 78 for 0.05");
  push("    end");
  push("  end");
  // extra ship every 10,000
  push("  if score >= nextlife then");
  push("    set lives to lives + 1");
  push("    set nextlife to nextlife + 10000");
  push("    beep 784 for 0.08");
  push("    beep 988 for 0.08");
  push("    beep 1175 for 0.12");
  push('    say "EXTRA SHIP" for 1');
  push("  end");
  // ---- saucers: the big one sprays, the small one AIMS
  push("  if sauceron == 0 then");
  push("    set saucert to saucert - 1");
  push("    if saucert <= 0 then");
  push("      set sauceron to 1");
  push("      if score >= 5000 and rand(0, 100) < 55 then");
  push("        set sauceron to 2");
  push("      end");
  push("      set saucer.x to -14");
  push(`      set saucer.y to rand(40, ${H - 40})`);
  push("      set saucer.size to 14 - sauceron * 3");
  push("      set sfiret to 60");
  push("    end");
  push("  else");
  push("    change saucer.x by 1.8");
  push("    if saucer.x % 90 < 2 then");
  push("      change saucer.y by rand(-24, 24)");
  push("      set saucer.y to max(30, min(330, saucer.y))");   // never jink off the glass
  push("    end");
  push(`    if saucer.x > ${W + 14} then`);
  push("      set sauceron to 0");
  push("      set saucert to 800 + floor(rand(0, 400))");
  push("    end");
  push("    set sfiret to sfiret - 1");
  push("    if sfiret <= 0 and sshot == 0 and shipdead == 0 then");
  push("      set sfiret to 70");
  push("      set sshot to 1");
  push("      set sshotl to 90");
  push("      set sshot1.x to saucer.x");
  push("      set sshot1.y to saucer.y");
  push("      if sauceron == 2 then");
  // the small one aims — dist() normalizes the lead
  push("        set dd to max(10, dist(sshot1, ship))");
  push("        set ssvx to (ship.x - saucer.x) / dd * 3.4");
  push("        set ssvy to (ship.y - saucer.y) / dd * 3.4");
  push("      else");
  push("        set sa to rand(0, 360)");
  push("        set ssvx to cos(sa) * 3");
  push("        set ssvy to sin(sa) * 3");
  push("      end");
  push("      beep 540 for 0.05");
  push("    end");
  push("  end");
  // the saucer's shot flies and wraps
  push("  if sshot == 1 then");
  push(`    set sshot1.x to (sshot1.x + ssvx + ${W}) % ${W}`);
  push(`    set sshot1.y to (sshot1.y + ssvy + ${H}) % ${H}`);
  push("    set sshotl to sshotl - 1");
  push("    if sshotl <= 0 then");
  push("      set sshot to 0");
  push("    end");
  push("    if shipdead == 0 and abs(sshot1.x - ship.x) < 10 and abs(sshot1.y - ship.y) < 10 then");
  push("      set sshot to 0");
  push("      set shipdie to 1");
  push("    end");
  push("  end");
  // ---- respawn and wave logic
  push("  if shipdead > 0 then");
  push("    set shipdead to shipdead - 1");
  push("    if shipdead == 0 then");
  push("      if lives <= 0 then");
  push("        set game to 2");
  push("        set endplay to 1");
  push('        set status.text to "GAME OVER — CLICK TO DRIFT AGAIN"');
  push("        set shipdead to 1");
  push("      else");
  push(`        set ship.x to ${W / 2}`);
  push(`        set ship.y to ${H / 2}`);
  push("        set ship.angle to -90");
  push("        set vx to 0");
  push("        set vy to 0");
  push("      end");
  push("    end");
  push("  end");
  push("  if rocks == 0 and sauceron == 0 then");
  push("    set wave to wave + 1");
  dealWave("    ");
  push('    set status.text to "WAVE " + wave + " — MORE ROCK, SAME SHIP"');
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
  dealWave("    ");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

// the ship: Spacewar's physics with 1979's coin slot
function shipCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game == 0 and shipdead == 0)");
  push("set flame.visible to 0");
  push("if game == 0 and shipdead == 0 then");
  push(`  set st to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  change self.angle by st * ${TURN}`);
  push(`  set th to max(0, min(1, keydown("w") + keydown("ArrowUp") + (0 - sticky(1))))`);
  push("  if th > 0 then");
  push(`    set vx to vx + cos(self.angle) * th * ${THRUST}`);
  push(`    set vy to vy + sin(self.angle) * th * ${THRUST}`);
  push("    set flame.visible to 1");
  push("    set flame.x to self.x - cos(self.angle) * 11");
  push("    set flame.y to self.y - sin(self.angle) * 11");
  push("    set flame.angle to self.angle + 180");
  push("  end");
  push(`  set vx to vx * ${1 - DRAG}`);
  push(`  set vy to vy * ${1 - DRAG}`);
  push(`  set self.x to (self.x + vx + ${W}) % ${W}`);
  push(`  set self.y to (self.y + vy + ${H}) % ${H}`);
  // FIRE: four in the air, each inheriting the ship's drift
  push('  set pf to keydown("Space")');
  push("  if pf == 1 and pf0 == 0 then");
  for (let j = 1; j <= SHOTS; j++) {
    push(`    if shot${j}.live == 0 and pf == 1 then`);
    push(`      set shot${j}.live to 1`);
    push(`      set shot${j}.age to ${SHOT_LIFE}`);
    push(`      set shot${j}.x to self.x + cos(self.angle) * 12`);
    push(`      set shot${j}.y to self.y + sin(self.angle) * 12`);
    push(`      set shot${j}.vx to vx + cos(self.angle) * ${SHOT_SPD}`);
    push(`      set shot${j}.vy to vy + sin(self.angle) * ${SHOT_SPD}`);
    push("      set pf to 2");   // claimed — the chain stops here
    push("      beep 740 for 0.03");
    push("    end");
  }
  push("  end");
  push('  set pf0 to keydown("Space")');
  // HYPERSPACE: the panic button, with the house's cut
  push('  set ph to keydown("s")');
  push("  if ph == 1 and ph0 == 0 then");
  push(`    set self.x to rand(20, ${W - 20})`);
  push(`    set self.y to rand(20, ${H - 20})`);
  push("    set vx to 0");
  push("    set vy to 0");
  push("    beep 1400 for 0.06");
  push("    beep 200 for 0.06");
  push("    if rand(0, 6) < 1 then");
  push("      set shipdie to 1");
  push('      say "HYPERSPACE FAILURE" for 1');
  push("    end");
  push("  end");
  push("  set ph0 to ph");
  // the rocks are the law
  push("  set i to 0");
  push(`  repeat ${NROCK}`);
  push(`    if rsz[i] > 0 and abs(self.x - rx[i]) < ${rockR} + 6 and abs(self.y - ry[i]) < ${rockR} + 6 then`);
  push("      set shipdie to 1");
  push("    end");
  push("    set i to i + 1");
  push("  end");
  // the saucer itself is solid too
  push("  if sauceron > 0 and abs(self.x - saucer.x) < 14 and abs(self.y - saucer.y) < 12 then");
  push("    set shipdie to 1");
  push("  end");
  push("  if shipdie == 1 then");
  push("    set shipdie to 0");
  push("    set lives to lives - 1");
  push("    set shipdead to 90");
  push("    explode self");
  push("    beep 70 for 0.4");
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

export function buildAsteroidsExample() {
  // one player shot: flies, wraps, ages out, splits what it hits
  const shotSrc = (j) => {
    const L = [];
    const push = (s) => L.push(s);
    push("when tick");
    push("set self.visible to (game == 0 and self.live == 1)");
    push("if game == 0 and self.live == 1 then");
    push(`  set self.x to (self.x + self.vx + ${W}) % ${W}`);
    push(`  set self.y to (self.y + self.vy + ${H}) % ${H}`);
    push("  set self.age to self.age - 1");
    push("  if self.age <= 0 then");
    push("    set self.live to 0");
    push("  end");
    // saucers: big 200, small 1000
    push("  if self.live == 1 and sauceron > 0 and abs(self.x - saucer.x) < 14 and abs(self.y - saucer.y) < 11 then");
    push("    if sauceron == 2 then");
    push("      change score by 1000");
    push('      say "SMALL SAUCER 1000" for 0.8');
    push("    else");
    push("      change score by 200");
    push("    end");
    push("    explode saucer");
    push("    set sauceron to 0");
    push("    set saucert to 800 + floor(rand(0, 400))");
    push("    set self.live to 0");
    push("    beep 659 for 0.08");
    push("  end");
    // the rocks: hit one and it SPLITS — large 20, medium 50, small 100
    push("  if self.live == 1 then");
    push("    set i to 0");
    push(`    repeat ${NROCK}`);
    push(`      if self.live == 1 and rsz[i] > 0 and abs(self.x - rx[i]) < ${rockR} and abs(self.y - ry[i]) < ${rockR} then`);
    push("        set self.live to 0");
    push("        if rsz[i] == 3 then");
    push("          change score by 20");
    push("          beep 180 for 0.06");
    push("        else");
    push("          if rsz[i] == 2 then");
    push("            change score by 50");
    push("            beep 260 for 0.05");
    push("          else");
    push("            change score by 100");
    push("            beep 380 for 0.05");
    push("          end");
    push("        end");
    push("        if rsz[i] == 1 then");
    push("          set rsz[i] to 0");
    push("          set rocks to rocks - 1");
    push("        else");
    // the slot becomes child #1 — faster, meaner
    push("          set rsz[i] to rsz[i] - 1");
    push("          set rvx[i] to rvx[i] * 1.4 + rand(-0.7, 0.7)");
    push("          set rvy[i] to rvy[i] * 1.4 + rand(-0.7, 0.7)");
    // child #2 takes any free slot
    push("          set k to 0 - 1");
    push("          set j2 to 0");
    push(`          repeat ${NROCK}`);
    push("            if k < 0 and rsz[j2] == 0 then");
    push("              set k to j2");
    push("            end");
    push("            set j2 to j2 + 1");
    push("          end");
    push("          if k >= 0 then");
    push("            set rsz[k] to rsz[i]");
    push("            set rx[k] to rx[i]");
    push("            set ry[k] to ry[i]");
    push("            set rvx[k] to rvx[i] * -0.8 + rand(-0.8, 0.8)");
    push("            set rvy[k] to rvy[i] * -0.8 + rand(-0.8, 0.8)");
    push("            set rocks to rocks + 1");
    push("          end");
    push("        end");
    push("      end");
    push("      set i to i + 1");
    push("    end");
    push("  end");
    push("end");
    push("end");
    return L.join("\n");
  };

  const objects = [];

  // THE ROCK POOL: 28 slots of pure data, 28 rings watching them
  for (let k = 0; k < NROCK; k++) {
    objects.push({
      id: "as_r" + k, name: "rock" + (k + 1), type: "ring",
      x: -60, y: -60, size: RBIG, color: WHITE, glow: 7, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (rsz[${k}] > 0 and game != 2)
set self.x to rx[${k}]
set self.y to ry[${k}]
if rsz[${k}] == 3 then
  set self.size to ${RBIG}
else
  if rsz[${k}] == 2 then
    set self.size to ${RMED}
  else
    set self.size to ${RSML}
  end
end
end` }]
    });
  }

  // the ship, its flame, four shots
  objects.push({
    id: "as_ship", name: "ship", type: "tri",
    x: W / 2, y: H / 2, size: 11, angle: -90, color: WHITE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: shipCode() }]
  });
  objects.push({ id: "as_fl", name: "flame", type: "tri", x: -40, y: -40, size: 6, angle: 90, color: ORANGE, glow: 14, visible: 0, text: "", script: [] });
  for (let j = 1; j <= SHOTS; j++) {
    objects.push({
      id: "as_s" + j, name: "shot" + j, type: "dot",
      x: -40, y: -40, size: 2, color: WHITE, glow: 10, visible: 0, text: "",
      script: [{ event: "code", source: shotSrc(j) }]
    });
  }

  // the saucers (one object, two sizes) and their shot
  objects.push({
    id: "as_sau", name: "saucer", type: "text",
    x: -40, y: 60, size: 14, color: GREEN, glow: 12, visible: 0, text: "<=>",
    script: [{ event: "code", source: "when tick\nset self.visible to (game == 0 and sauceron > 0)\nend" }]
  });
  objects.push({
    id: "as_ss", name: "sshot1", type: "dot",
    x: -40, y: -40, size: 3, color: GREEN, glow: 10, visible: 0, text: "",
    script: [{ event: "code", source: "when tick\nset self.visible to (game == 0 and sshot == 1)\nend" }]
  });

  // HUD
  objects.push({ id: "as_sc", name: "scoretx", type: "text", x: 54, y: 24, size: 22, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "as_lv", name: "livestx", type: "text", x: 424, y: 22, size: 12, color: DIM, glow: 4, visible: 0, text: "SHIPS 3", script: [] });
  objects.push({ id: "as_st", name: "status", type: "text", x: W / 2, y: 352, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "as_big", name: "bigtitle", type: "text", x: W / 2, y: 130, size: 46, color: WHITE, glow: 18, visible: 1, text: "ASTEROIDS", script: [] });
  objects.push({ id: "as_sub", name: "subline", type: "text", x: W / 2, y: 162, size: 10, color: DIM, glow: 4, visible: 1, text: "ATARI 1979 · ATARI'S BEST-SELLING ARCADE GAME", script: [] });
  objects.push({ id: "as_coin", name: "coinline", type: "text", x: W / 2, y: 192, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO DRIFT ◎", script: [] });
  objects.push({ id: "as_play", name: "playbtn", type: "text", x: W / 2, y: 228, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ DRIFT ]", script: [] });
  objects.push({
    id: "as_help", name: "help", type: "text",
    x: W / 2, y: 260, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A/D ROTATE · W THRUST · SPACE FIRE (4 MAX) · S HYPERSPACE · OR THE STICK",
    script: []
  });

  objects.push({
    id: "as_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({ id: "as_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "SHIP", script: [] });

  return { title: "Asteroids (1979)",
    display: "vector79", hardware: "vector79",   // the real machine's era
    objects };
}

// example-starraiders.js — STAR RAIDERS (1979), rebuilt in our studio.
//
// The game that sold the Atari 8-bit computers, and arguably the first
// first-person space combat sim: a COCKPIT, not a screen. Where Asteroids
// gave you one room of rocks, Star Raiders gave you a WAR — a 4×4 galactic
// chart, Zylon squadrons crawling sector by sector toward your starbases,
// hyperwarp that costs precious energy, and a torpedo crosshair in a
// streaming starfield. Nothing on the chart waits for you. When it ends,
// the computer judges your whole career and hands you a RANK — from
// GALACTIC COOK all the way up to STAR COMMANDER.
//
// Ours keeps the war:
//   · cockpit view: streaming stars, crosshair, Zylon fighters that jink,
//     close range, and SHOOT BACK (every hit costs 150 energy)
//   · M opens the galactic chart: Z = Zylons, ◊ = starbase, you in green
//   · WASD moves the warp cursor, ENTER engages hyperwarp — 80 energy
//     per sector crossed, stars streaking while you fly
//   · Zylons MOVE on the chart while you fight — reach a base, it falls
//   · dock at a safe starbase to refill to 9999
//   · energy is life: run dry anywhere, and the ship is lost
//
//   WASD / stick steers · SPACE fires · M chart · ENTER warps

const W = 480, H = 360;
const NSEC = 16, START = 5;
const BASES = [3, 12];
const ZSTART = { 0: 2, 2: 2, 7: 1, 10: 2, 15: 1 };   // 8 Zylons
const NZ = 8;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", RED = "#ff6666", CYAN = "#7ddfff", GOLD = "#e8c84a";
const CELLX = (s) => 162 + (s % 4) * 52;
const CELLY = (s) => 96 + Math.floor(s / 4) * 46;

export function buildStarraidersExample() {
  const L = [];
  const push = (s) => L.push(s);

  // ======== when start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set endplay to 0");
  push("set s to 0");
  push(`repeat ${NSEC}`);
  push("  set zs[s] to 0");
  push("  set bs[s] to 0");
  push("  set s to s + 1");
  push("end");
  for (const b of BASES) push(`set bs[${b}] to 1`);
  for (const [s, n] of Object.entries(ZSTART)) push(`set zs[${s}] to ${n}`);
  push(`set zleft to ${NZ}`);
  push(`set psec to ${START}`);
  push("set energy to 9999");
  push("set mode to 0");
  push("set warpt to 0");
  push("set tlive to 0");
  push("set hitt to 0");
  push("set z1on to 0");
  push("set z2on to 0");
  push("set z3on to 0");
  push('set status.text to ""');
  push("end");

  // ======== when click (coin / back to attract)
  push("when click");
  push("if game == 9 then");
  push("  set game to 0");
  push("  set endplay to 0");
  push("  set score to 0");
  push("  set s to 0");
  push(`  repeat ${NSEC}`);
  push("    set zs[s] to 0");
  push("    set bs[s] to 0");
  push("    set s to s + 1");
  push("  end");
  for (const b of BASES) push(`  set bs[${b}] to 1`);
  for (const [s, n] of Object.entries(ZSTART)) push(`  set zs[${s}] to ${n}`);
  push(`  set zleft to ${NZ}`);
  push(`  set psec to ${START}`);
  push(`  set cx to ${START % 4}`);
  push(`  set cyy to ${Math.floor(START / 4)}`);
  push("  set energy to 9999");
  push("  set mode to 0");
  push("  set warpt to 0");
  push("  set tlive to 0");
  push("  set hitt to 0");
  push("  set movet to 0");
  push("  set z1on to 0");
  push("  set z2on to 0");
  push("  set z3on to 0");
  push('  set status.text to "ZYLON SQUADRONS INBOUND — THE CHART IS ON M"');
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  // ======== when tick
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
  // steering
  push(`  set vvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1))) * 2.4`);
  push(`  set vvy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1))) * 2.4`);
  push("  if mode == 1 or warpt > 0 then");
  push("    set vvx to 0");
  push("    set vvy to 0");
  push("  end");
  // the reactor is always running
  push("  set drip to drip + 1");
  push("  if drip >= 4 then");
  push("    set drip to 0");
  push("    change energy by -1");
  push("  end");
  push("  if hitt > 0 then");
  push("    set hitt to hitt - 1");
  push("  end");
  // hyperwarp in flight
  push("  if warpt > 0 then");
  push("    set warpt to warpt - 1");
  push("    if warpt == 0 then");
  push("      if bs[psec] == 1 and zs[psec] == 0 then");
  push("        set energy to 9999");
  push("        beep 880 for 0.12");
  push('        set status.text to "DOCKED — ENERGY RESTORED"');
  push("      end");
  push("    end");
  push("  end");

  // M: cockpit ⇄ chart
  push('  set pm to keydown("m")');
  push("  if pm == 1 and pm0 == 0 then");
  push("    set mode to 1 - mode");
  push("    beep 440 for 0.04");
  push("    if mode == 1 then");
  push("      set cx to psec % 4");
  push("      set cyy to floor(psec / 4)");
  push("    end");
  push("  end");
  push("  set pm0 to pm");

  // ---- the galactic chart
  push("  if mode == 1 and warpt == 0 then");
  const cur = (expr, flag, body) => {
    push(`    set pk to ${expr}`);
    push(`    if pk >= 1 and ${flag} == 0 then`);
    for (const b of body) push(`      ${b}`);
    push("    end");
    push(`    set ${flag} to pk`);
  };
  cur('keydown("d") + keydown("ArrowRight")', "pkd", ["set cx to min(3, cx + 1)"]);
  cur('keydown("a") + keydown("ArrowLeft")', "pka", ["set cx to max(0, cx - 1)"]);
  cur('keydown("s") + keydown("ArrowDown")', "pks", ["set cyy to min(3, cyy + 1)"]);
  cur('keydown("w") + keydown("ArrowUp")', "pkw", ["set cyy to max(0, cyy - 1)"]);
  push("    set csec to cyy * 4 + cx");
  push("    set wcost to (abs(cx - psec % 4) + abs(cyy - floor(psec / 4))) * 80");
  push('    set pe to keydown("Enter")');
  push("    if pe == 1 and pe0 == 0 and csec != psec then");
  push("      if energy > wcost + 50 then");
  push("        change energy by 0 - wcost");
  push("        set psec to csec");
  push("        set mode to 0");
  push("        set warpt to 50");
  push("        set z1on to 0");
  push("        set z2on to 0");
  push("        set z3on to 0");
  push("        set tlive to 0");
  push("        beep 300 for 0.1");
  push("        beep 600 for 0.1");
  push("        beep 1200 for 0.15");
  push('        set status.text to "HYPERWARP ENGAGED"');
  push("      else");
  push("        beep 120 for 0.15");
  push('        set status.text to "NOT ENOUGH ENERGY TO WARP"');
  push("      end");
  push("    end");
  push("    set pe0 to pe");
  push("  end");

  // ---- the cockpit
  push("  if mode == 0 and warpt == 0 then");
  // deal the sector's fighters when none are active
  push("    if z1on + z2on + z3on == 0 and zs[psec] > 0 then");
  for (let n = 1; n <= 3; n++) {
    push(`      if zs[psec] >= ${n} then`);
    push(`        set z${n}on to 1`);
    push(`        set z${n}z to rand(45, 75)`);
    push(`        set zylon${n}.x to rand(80, 400)`);
    push(`        set zylon${n}.y to rand(70, 250)`);
    push(`        set z${n}f to 150 + rand(0, 120)`);
    push(`        set z${n}t to rand(0, 360)`);
    push("      end");
  }
  push('      set status.text to "CONDITION RED — ZYLONS IN SECTOR"');
  push("    end");
  // one torpedo at a time
  push('    set pf to keydown("Space")');
  push("    if pf == 1 and pf0 == 0 and tlive == 0 and energy > 10 then");
  push("      set tlive to 1");
  push("      set tprog to 0");
  push("      set torp.x to 240");
  push("      set torp.y to 330");
  push("      change energy by -10");
  push("      beep 740 for 0.05");
  push("    end");
  push("    set pf0 to pf");
  push("    if tlive == 1 then");
  push("      set tprog to tprog + 1");
  push("      set torp.y to 330 - tprog * 12");
  push("      if tprog >= 12 then");
  push("        set tlive to 0");
  for (let n = 1; n <= 3; n++) {
    push(`        if z${n}on == 1 and abs(zylon${n}.x - 240) < 14 + 600 / (z${n}z + 15) and abs(zylon${n}.y - 180) < 14 + 600 / (z${n}z + 15) then`);
    push(`          set z${n}on to 0`);
    push(`          explode zylon${n}`);
    push("          change score by 100");
    push("          set zs[psec] to zs[psec] - 1");
    push("          set zleft to zleft - 1");
    push("          beep 220 for 0.12");
    push("          if zs[psec] == 0 then");
    push('            set status.text to "SECTOR CLEARED — CONDITION GREEN"');
    push("          end");
    push("        end");
  }
  push("      end");
  push("    end");
  push("  end");

  // ---- the Zylon fleet moves while you fight
  push("  set movet to movet + 1");
  push("  if movet >= 600 then");
  push("    set movet to 0");
  push("    set moved to 0");
  push("    set s to 0");
  push(`    repeat ${NSEC}`);
  push("      if moved == 0 and zs[s] > 0 and s != psec then");
  push("        set bestd to 99");
  push("        set bests to 0 - 1");
  push("        set b to 0");
  push(`        repeat ${NSEC}`);
  push("          if bs[b] == 1 then");
  push("            set dd to abs(s % 4 - b % 4) + abs(floor(s / 4) - floor(b / 4))");
  push("            if dd < bestd then");
  push("              set bestd to dd");
  push("              set bests to b");
  push("            end");
  push("          end");
  push("          set b to b + 1");
  push("        end");
  push("        if bests >= 0 then");
  push("          set ns to s");
  push("          if s % 4 < bests % 4 then");
  push("            set ns to s + 1");
  push("          else");
  push("            if s % 4 > bests % 4 then");
  push("              set ns to s - 1");
  push("            else");
  push("              if floor(s / 4) < floor(bests / 4) then");
  push("                set ns to s + 4");
  push("              else");
  push("                if floor(s / 4) > floor(bests / 4) then");
  push("                  set ns to s - 4");
  push("                end");
  push("              end");
  push("            end");
  push("          end");
  push("          set moved to 1");
  push("          if ns != s and ns != psec then");
  push("            set zs[ns] to zs[ns] + zs[s]");
  push("            set zs[s] to 0");
  push("            if bs[ns] == 1 then");
  push("              set bs[ns] to 0");
  push("              beep 98 for 0.3");
  push('              set status.text to "A STARBASE HAS FALLEN"');
  push("            end");
  push("          end");
  push("        end");
  push("      end");
  push("      set s to s + 1");
  push("    end");
  push("  end");

  // ---- HUD
  push('  set energytx.text to "ENERGY " + max(0, floor(energy))');
  push('  set sectx.text to "SECTOR " + (psec % 4 + 1) + "-" + (floor(psec / 4) + 1)');
  push('  set zltx.text to "ZYLONS " + zleft');
  push("  if zs[psec] > 0 then");
  push('    set condtx.text to "CONDITION RED"');
  push(`    set condtx.color to "${RED}"`);
  push("  else");
  push('    set condtx.text to "CONDITION GREEN"');
  push(`    set condtx.color to "${GREEN}"`);
  push("  end");

  // ---- the two ways a career ends
  const rank = (line) => {
    push('    set rk to "GALACTIC COOK"');
    push("    if score >= 500 then");
    push('      set rk to "ROOKIE"');
    push("    end");
    push("    if score >= 900 then");
    push('      set rk to "PILOT"');
    push("    end");
    push("    if score >= 1300 then");
    push('      set rk to "ACE"');
    push("    end");
    push("    if score >= 1700 then");
    push('      set rk to "STAR COMMANDER"');
    push("    end");
    push("    set game to 2");
    push("    set endplay to 1");
    push(`    set status.text to ${line} + " — RANK: " + rk`);
  };
  push("  if energy <= 0 then");
  push("    beep 70 for 0.5");
  rank('"SHIP LOST — ENERGY SPENT"');
  push("  end");
  push("  if zleft <= 0 and game == 0 then");
  push("    change score by 500 + floor(energy / 20)");
  push("    beep 523 for 0.1");
  push("    beep 659 for 0.1");
  push("    beep 784 for 0.1");
  push("    beep 1047 for 0.25");
  rank('"THE ZYLON FLEET IS DESTROYED"');
  push("  end");
  push("end");

  // HUD visibility
  push("set energytx.visible to (game != 9)");
  push("set sectx.visible to (game != 9)");
  push("set zltx.visible to (game != 9)");
  push("set condtx.visible to (game != 9 and mode == 0)");
  push("set charttitle.visible to (game != 9 and mode == 1)");
  push("set chartlegend.visible to (game != 9 and mode == 1)");
  push("set warpline.visible to (game != 9 and mode == 1)");
  push("if mode == 1 then");
  push('  set warpline.text to "WARP COST " + (abs(cx - psec % 4) + abs(cyy - floor(psec / 4))) * 80 + " — ENTER TO ENGAGE"');
  push("end");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];

  // the streaming starfield (size doubles as parallax depth)
  for (let k = 0; k < 14; k++) {
    const depth = 1 + (k % 3);
    objects.push({
      id: "sr_st" + k, name: "star" + (k + 1), type: "dot",
      x: 30 + (k * 97) % 420, y: 24 + (k * 61) % 300, size: depth,
      color: k % 3 === 0 ? WHITE : DIM, glow: 3, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and mode == 0)
if game == 0 and mode == 0 then
  if warpt > 0 then
    change self.x by (self.x - 240) * 0.16
    change self.y by (self.y - 180) * 0.16
  else
    change self.x by (0 - vvx) * ${depth} * 0.8
    change self.y by (0 - vvy) * ${depth} * 0.8 + ${depth} * 0.1
  end
  if self.x < 2 or self.x > 478 or self.y < 2 or self.y > 358 then
    set self.x to rand(30, 450)
    set self.y to rand(30, 330)
  end
end
end` }]
    });
  }

  // three Zylon fighters
  for (let n = 1; n <= 3; n++) {
    objects.push({
      id: "sr_z" + n, name: "zylon" + n, type: "text",
      x: -60, y: -60, size: 16, color: n === 3 ? RED : GREEN, glow: 10, visible: 0, text: "]·[",
      script: [{
        event: "code", source: `when tick
set self.visible to (game == 0 and mode == 0 and warpt == 0 and z${n}on == 1)
if game == 0 and mode == 0 and warpt == 0 and z${n}on == 1 then
  set z${n}t to z${n}t + 1
  set par to 60 / (z${n}z + 20) + 0.4
  set self.x to max(30, min(450, self.x + sin(z${n}t * 3 + ${n * 120}) * 1.3 - vvx * par))
  set self.y to max(40, min(300, self.y + cos(z${n}t * 2.3 + ${n * 77}) * 1.0 - vvy * par))
  if z${n}z > 10 then
    set z${n}z to z${n}z - 0.1
  end
  set self.size to 7 + 500 / (z${n}z + 15)
  set z${n}f to z${n}f - 1
  if z${n}f <= 0 then
    set z${n}f to 160 + rand(0, 140)
    set hitt to 7
    change energy by -150
    beep 110 for 0.12
  end
end
end` }]
    });
  }

  // your torpedo, the hit flash, the crosshair, a starbase out the window
  objects.push({
    id: "sr_tp", name: "torp", type: "dot",
    x: -40, y: -40, size: 3, color: CYAN, glow: 12, visible: 0, text: "",
    script: [{ event: "code", source: "when tick\nset self.visible to (game == 0 and mode == 0 and tlive == 1)\nend" }]
  });
  objects.push({
    id: "sr_hf", name: "hitflash", type: "ring",
    x: 240, y: 180, size: 150, color: RED, glow: 18, visible: 0, text: "",
    script: [{ event: "code", source: "when tick\nset self.visible to (game == 0 and mode == 0 and hitt > 0)\nset self.size to 150 + hitt * 8\nend" }]
  });
  objects.push({
    id: "sr_ch", name: "crosshair", type: "text",
    x: 240, y: 180, size: 20, color: DIM, glow: 5, visible: 0, text: "+",
    script: [{ event: "code", source: "when tick\nset self.visible to (game == 0 and mode == 0 and warpt == 0)\nend" }]
  });
  objects.push({
    id: "sr_sb", name: "basedot", type: "text",
    x: 300, y: 140, size: 18, color: CYAN, glow: 12, visible: 0, text: "◊",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0 and mode == 0 and warpt == 0 and bs[psec] == 1)
if self.visible == 1 then
  change self.x by 0 - vvx * 0.9
  change self.y by 0 - vvy * 0.9
  set self.x to max(60, min(420, self.x))
  set self.y to max(60, min(300, self.y))
end
end` }]
  });

  // the galactic chart: 16 cells + the warp cursor
  for (let s = 0; s < NSEC; s++) {
    objects.push({
      id: "sr_c" + s, name: "cell" + s, type: "text",
      x: CELLX(s), y: CELLY(s), size: 15, color: DIM, glow: 4, visible: 0, text: "·",
      script: [{
        event: "code", source: `when tick
set self.visible to (game != 9 and mode == 1)
if mode == 1 then
  set self.text to "·"
  set self.color to "${DIM}"
  if bs[${s}] == 1 then
    set self.text to "◊"
    set self.color to "${CYAN}"
  end
  if zs[${s}] == 1 then
    set self.text to "Z"
    set self.color to "${RED}"
  end
  if zs[${s}] >= 2 then
    set self.text to "ZZ"
    set self.color to "${RED}"
  end
  if ${s} == psec then
    set self.color to "${GREEN}"
    if zs[${s}] == 0 and bs[${s}] == 0 then
      set self.text to "▲"
    end
  end
end
end` }]
    });
  }
  objects.push({
    id: "sr_cur", name: "cursor", type: "ring",
    x: 0, y: 0, size: 18, color: GOLD, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (game != 9 and mode == 1)
set self.x to 162 + cx * 52
set self.y to 96 + cyy * 46
end` }]
  });
  objects.push({ id: "sr_ct", name: "charttitle", type: "text", x: W / 2, y: 52, size: 16, color: WHITE, glow: 10, visible: 0, text: "GALACTIC CHART", script: [] });
  objects.push({ id: "sr_cl", name: "chartlegend", type: "text", x: W / 2, y: 268, size: 9, color: DIM, glow: 3, visible: 0, text: "Z ZYLONS · ◊ STARBASE · ▲ YOU · WASD MOVES THE CURSOR", script: [] });
  objects.push({ id: "sr_wl", name: "warpline", type: "text", x: W / 2, y: 290, size: 11, color: GOLD, glow: 8, visible: 0, text: "", script: [] });

  // HUD
  objects.push({ id: "sr_en", name: "energytx", type: "text", x: 76, y: 24, size: 13, color: GOLD, glow: 8, visible: 0, text: "ENERGY 9999", script: [] });
  objects.push({ id: "sr_se", name: "sectx", type: "text", x: 240, y: 24, size: 11, color: DIM, glow: 4, visible: 0, text: "SECTOR 2-2", script: [] });
  objects.push({ id: "sr_zl", name: "zltx", type: "text", x: 420, y: 24, size: 11, color: DIM, glow: 4, visible: 0, text: "ZYLONS 8", script: [] });
  objects.push({ id: "sr_cd", name: "condtx", type: "text", x: 240, y: 318, size: 11, color: GREEN, glow: 6, visible: 0, text: "CONDITION GREEN", script: [] });
  objects.push({ id: "sr_st2", name: "status", type: "text", x: W / 2, y: 344, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "sr_big", name: "bigtitle", type: "text", x: W / 2, y: 118, size: 40, color: CYAN, glow: 18, visible: 1, text: "STAR RAIDERS", script: [] });
  objects.push({ id: "sr_sub", name: "subline", type: "text", x: W / 2, y: 150, size: 10, color: DIM, glow: 4, visible: 1, text: "ATARI 8-BIT · 1979 · THE FIRST FIRST-PERSON SPACE WAR", script: [] });
  objects.push({ id: "sr_coin", name: "coinline", type: "text", x: W / 2, y: 182, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO LAUNCH ◎", script: [] });
  objects.push({ id: "sr_play", name: "playbtn", type: "text", x: W / 2, y: 220, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ LAUNCH ]", script: [] });
  objects.push({
    id: "sr_help", name: "help", type: "text",
    x: W / 2, y: 254, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD / STICK STEER · SPACE FIRES · M GALACTIC CHART · ENTER HYPERWARPS · SAVE THE STARBASES",
    script: []
  });

  objects.push({
    id: "sr_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "sr_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "HELM", script: [] });

  return { title: "Star Raiders (1979)", objects };
}

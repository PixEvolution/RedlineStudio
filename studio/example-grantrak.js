// example-grantrak.js — GRAN TRAK 10 (1974), rebuilt in our studio.
// Atari's first racing game and the first driving game with the real controls:
// a STEERING WHEEL, a GAS pedal, a BRAKE, and a FOUR-SPEED SHIFTER. Like the
// original, the course is a real closed circuit drawn in white dots — a fast
// perimeter road plus the signature move: the road dives into the middle of
// the screen and HAIRPINS back out around a center divider. Every dot is a
// road edge. (Famous footnote: an accounting error meant Atari sold every
// cabinet at a loss. The game still packed arcades.)
//
//   A/D steer · W gas · S brake · Q/E shift down/up. The gearbox is REAL:
//   below each gear's power band the engine LUGS (barely pulls at all), so
//   you launch in 1st and work up through the box — floor it in 4th from a
//   stop and you'll crawl. The MOTOR is live through the speaker: the pitch
//   follows the revs, so it drops on every upshift and climbs again — you
//   can shift by ear. Crash = towed back to your last checkpoint with a
//   stalled engine for a moment. The coin buys ~60 seconds.

const T = 3600;                                    // ~60 seconds per coin
const SPAWN = { x: 82, y: 291, a: 0 };             // bottom-left, heading right

// THE CIRCUIT (all axis-aligned, so the walls read as road edges):
//   outer border 24..456 × 40..330
//   the hook: a ∩ shape (top y=114 between x=140..340, arms down to y=252)
//   the hairpin divider: x=240 from the bottom wall up to y=188
// Lap: bottom straight → up into the hook → hairpin over the divider →
// back down and out → right straight → flat-out top straight → left straight.

// the racing line the attract car follows (lane centers, clockwise)
const WP = [
  [190, 291], [190, 151], [290, 151], [290, 291],
  [398, 291], [398, 77], [82, 77], [82, 291]
];

// checkpoints, in racing order along the line
const GATES = [
  { x: 190, y: 291 },   // 1: turning up into the hook
  { x: 240, y: 151 },   // 2: the hairpin apex, right over the divider
  { x: 398, y: 184 },   // 3: the right straight
  { x: 82,  y: 184 }    // 4: the left straight
];
const OILS = [{ x: 190, y: 225 }, { x: 150, y: 77 }, { x: 398, y: 250 }];

// the track, Gran Trak style: every wall is a line of dots
const WALLS = [
  [24, 40, 456, 40], [24, 330, 456, 330],          // outer border
  [24, 40, 24, 330], [456, 40, 456, 330],
  [140, 114, 340, 114],                            // the hook: inner top
  [140, 114, 140, 252],                            //   left arm
  [340, 114, 340, 252],                            //   right arm
  [240, 188, 240, 330]                             // the hairpin divider
];

// the gearbox: cap, pull, and the bottom of each gear's power band
const MAXS = [0, 1.4, 2.3, 3.2, 4.1];
const PULL = [0, 0.10, 0.075, 0.055, 0.042];
const LUG  = [0, 0, 0.9, 1.8, 2.7];                // below this, the engine lugs

const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a", DOTC = "#dfe9ee";

function carCode() {
  const L = [];
  const push = (s) => L.push(s);

  const toSpawn = (pad) => {
    push(`${pad}set self.x to ${SPAWN.x}`);
    push(`${pad}set self.y to ${SPAWN.y}`);
    push(`${pad}set self.angle to ${SPAWN.a}`);
  };

  push("when start");
  push("set game to 9");
  push("set gear to 1");
  push("set endplay to 0");
  push("set wp to 1");
  push(`set n to ${WP.length}`);
  WP.forEach(([x, y], i) => {
    push(`set wx[${i + 1}] to ${x}`);
    push(`set wy[${i + 1}] to ${y}`);
  });
  for (let g = 1; g <= 4; g++) {
    push(`set maxs[${g}] to ${MAXS[g]}`);
    push(`set pull[${g}] to ${PULL[g]}`);
    push(`set lug[${g}] to ${LUG[g]}`);
  }
  toSpawn("");
  push("end");

  push("when tick");
  // marquee & HUD visibility
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set startbtn.visible to (game == 9)");
  push("set scoretx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set geartx.visible to (game != 9)");
  push("set statusline.visible to (game == 2)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PRESS START ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN ◎"');
  push("end");
  push('set scoretx.text to "SCORE " + score + " · LAP " + laps');
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60))');
  push('set geartx.text to "GEAR " + gear');
  // the tach: amber = you're below the gear's power band (shift down!)
  push("if game == 0 and gear > 1 and speed < lug[gear] then");
  push(`  set geartx.color to "${AMBER}"`);
  push("else");
  push(`  set geartx.color to "${GREEN}"`);
  push("end");

  // the gates: your NEXT gate blinks green; the rest sit dim
  for (let i = 1; i <= 4; i++) {
    push(`if game == 0 and next == ${i} then`);
    push(`  set g${i}.color to "${GREEN}"`);
    push(`  set g${i}.glow to 10 + sin(time() * 400) * 6`);
    push("else");
    push(`  set g${i}.color to "${DIM}"`);
    push(`  set g${i}.glow to 3`);
    push("end");
  }

  // ATTRACT: the car laps the real course by itself — the live reel
  push("if game == 9 then");
  push("  set tx to wx[wp]");
  push("  set ty to wy[wp]");
  push("  if abs(tx - self.x) > abs(ty - self.y) then");
  push("    if tx > self.x then");
  push("      set self.angle to 0");
  push("    else");
  push("      set self.angle to 180");
  push("    end");
  push("  else");
  push("    if ty > self.y then");
  push("      set self.angle to 90");
  push("    else");
  push("      set self.angle to -90");
  push("    end");
  push("  end");
  push("  change self.x by cos(self.angle) * 2.2");
  push("  change self.y by sin(self.angle) * 2.2");
  push("  if abs(tx - self.x) < 5 and abs(ty - self.y) < 5 then");
  push("    set wp to wp % n + 1");
  push("  end");
  push("end");

  // THE RACE
  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  set oilcool to max(0, oilcool - 1)");
  push("  if stall > 0 then");
  push("    set stall to stall - 1");
  push("  else");
  // the wheel: bites with speed, like a real car
  push('    if keydown("a") then');
  push("      change self.angle by -3.4 * min(1, speed / 1.5)");
  push("    end");
  push('    if keydown("d") then');
  push("      change self.angle by 3.4 * min(1, speed / 1.5)");
  push("    end");
  // gas, through the gearbox: below the power band the engine LUGS
  push('    if keydown("w") then');
  push("      if speed < lug[gear] then");
  push("        change speed by 0.008");
  push("      else");
  push("        set speed to min(maxs[gear], speed + pull[gear])");
  push("      end");
  push("    end");
  push('    if keydown("s") then');
  push("      set speed to max(0, speed - 0.09)");
  push("    end");
  push("    set speed to speed * 0.995");
  // the MOTOR: a live putt through the speaker — pitch follows the revs,
  // so every upshift drops the note and every gear climbs it back up
  push("    if timeleft % 4 == 0 then");
  push("      beep 50 + (speed / maxs[gear]) * 110 for 0.05");
  push("    end");
  push("    change self.x by cos(self.angle) * speed");
  push("    change self.y by sin(self.angle) * speed");

  // oil slicks: the wheel stops listening for a moment
  for (let i = 1; i <= OILS.length; i++) {
    push(`    if oilcool == 0 and speed > 0.8 and dist(self, oil${i}) < 14 then`);
    push("      change self.angle by rand(-70, 70)");
    push("      set speed to speed * 0.55");
    push("      set oilcool to 30");
    push("      beep 200 for 0.08");
    push("    end");
  }

  // the dotted walls — every segment of the course, as math
  push("    set hit to 0");
  push("    if self.x < 33 or self.x > 447 or self.y < 49 or self.y > 321 then");
  push("      set hit to 1");
  push("    end");
  push("    if abs(self.y - 114) < 9 and self.x > 131 and self.x < 349 then");
  push("      set hit to 1");
  push("    end");
  push("    if abs(self.x - 140) < 9 and self.y > 105 and self.y < 261 then");
  push("      set hit to 1");
  push("    end");
  push("    if abs(self.x - 340) < 9 and self.y > 105 and self.y < 261 then");
  push("      set hit to 1");
  push("    end");
  push("    if abs(self.x - 240) < 9 and self.y > 179 then");
  push("      set hit to 1");
  push("    end");
  // crash = towed back to your last checkpoint, engine stalled for a moment
  push("    if hit == 1 then");
  push("      explode self");
  push("      beep 90 for 0.3");
  push("      set self.x to lastx");
  push("      set self.y to lasty");
  push("      set self.angle to lasta");
  push("      set speed to 0");
  push("      set stall to 30");
  push("    end");

  // the gates, in order — that's the whole race
  for (let i = 1; i <= 4; i++) {
    push(`    if next == ${i} and dist(self, g${i}) < 22 then`);
    push("      change score by 1");
    push("      beep 523 for 0.06");
    push(`      set lastx to g${i}.x`);
    push(`      set lasty to g${i}.y`);
    push("      set lasta to self.angle");
    if (i < 4) {
      push(`      set next to ${i + 1}`);
    } else {
      push("      set next to 1");
      push("      change laps by 1");
      push("      change score by 2");     // lap bonus
      push("      beep 784 for 0.12");
    }
    push("    end");
  }

  push("  end");
  // the quarter runs out
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 150 for 0.5");
  push('    set statusline.text to "SCORE " + score + " · " + laps + " LAPS · CLICK"');
  push("  end");
  push("end");
  push("end");

  // the shifter: four on the floor
  push('when key "q"');
  push("if game == 0 and stall == 0 then");
  push("  set gear to max(1, gear - 1)");
  push("  beep 300 for 0.05");
  push("end");
  push("end");
  push('when key "e"');
  push("if game == 0 and stall == 0 then");
  push("  set gear to min(4, gear + 1)");
  push("  beep 300 + gear * 60 for 0.05");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 240) < 60 and abs(mousey() - 151) < 16 then");
  push("    set game to 0");
  push("    set endplay to 0");
  push("    set score to 0");
  push("    set laps to 0");
  push("    set gear to 1");
  push("    set speed to 0");
  push("    set next to 1");
  push("    set stall to 0");
  push("    set oilcool to 0");
  push(`    set timeleft to ${T}`);
  toSpawn("    ");
  push(`    set lastx to ${SPAWN.x}`);
  push(`    set lasty to ${SPAWN.y}`);
  push(`    set lasta to ${SPAWN.a}`);
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("    set wp to 1");
  toSpawn("    ");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildGrantrakExample() {
  const objects = [];

  // the gates
  GATES.forEach((g, i) => {
    objects.push({
      id: "gk_g" + (i + 1), name: "g" + (i + 1), type: "ring",
      x: g.x, y: g.y, size: 14, color: DIM, glow: 3, visible: 1, text: "", script: []
    });
  });

  // the oil
  OILS.forEach((o, i) => {
    objects.push({
      id: "gk_o" + (i + 1), name: "oil" + (i + 1), type: "dot",
      x: o.x, y: o.y, size: 7, color: "#3a4a58", glow: 2, visible: 1, text: "", script: []
    });
  });

  // the car — brain included
  objects.push({
    id: "gk_car", name: "car", type: "tri",
    x: SPAWN.x, y: SPAWN.y, size: 11, angle: SPAWN.a, color: AMBER, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: carCode() }]
  });

  // HUD
  objects.push({
    id: "gk_sc", name: "scoretx", type: "text",
    x: 100, y: 22, size: 12, color: WHITE, glow: 8, visible: 0, text: "SCORE 0 · LAP 0", script: []
  });
  objects.push({
    id: "gk_tm", name: "timetx", type: "text",
    x: 240, y: 22, size: 12, color: WHITE, glow: 8, visible: 0, text: "TIME 60", script: []
  });
  objects.push({
    id: "gk_gr", name: "geartx", type: "text",
    x: 386, y: 22, size: 12, color: GREEN, glow: 8, visible: 0, text: "GEAR 1", script: []
  });

  // the marquee (the top straight is the header lane)
  objects.push({
    id: "gk_big", name: "bigtitle", type: "text",
    x: 240, y: 68, size: 20, color: WHITE, glow: 16, visible: 1, text: "GRAN TRAK 10", script: []
  });
  objects.push({
    id: "gk_coin", name: "coinline", type: "text",
    x: 240, y: 92, size: 10, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "gk_start", name: "startbtn", type: "text",
    x: 240, y: 151, size: 13, color: GREEN, glow: 12, visible: 1, text: "[ START ]", script: []
  });
  objects.push({
    id: "gk_status", name: "statusline", type: "text",
    x: 240, y: 92, size: 11, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });

  objects.push({
    id: "gk_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "ATARI 1974 · A/D STEER · W GAS · S BRAKE · Q/E SHIFT · GATES IN ORDER",
    script: []
  });

  // the course itself: every wall drawn as a line of dots, like the original.
  // (These sit LAST so the watch window keeps the car and HUD first.)
  const seen = new Set();
  let d = 0;
  for (const [x1, y1, x2, y2] of WALLS) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.round(len / 12));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x1 + (x2 - x1) * i / steps);
      const y = Math.round(y1 + (y2 - y1) * i / steps);
      const key = x + "," + y;
      if (seen.has(key)) continue;
      seen.add(key);
      d++;
      objects.push({
        id: "gk_w" + d, name: "trk" + d, type: "dot",
        x, y, size: 3, color: DOTC, glow: 2, visible: 1, text: "", script: []
      });
    }
  }

  return { title: "Gran Trak 10 (1974)", objects };
}

// example-grantrak.js — GRAN TRAK 10 (1974), rebuilt in our studio.
// Atari's first racing game and the first driving game with the real controls:
// a STEERING WHEEL, a GAS pedal, a BRAKE, and a FOUR-SPEED SHIFTER. One car,
// one track, one quarter's worth of time — pass the checkpoints in order,
// dodge the oil slicks, and don't kiss the walls. (Famous footnote: an
// accounting error meant Atari sold every cabinet at a loss. The game still
// packed arcades.)
//
//   A/D steer · W gas · S brake · Q/E shift down/up (low gears pull harder,
//   high gears run faster) · hit the blinking gates IN ORDER · crash = back
//   to your last gate. The coin buys ~60 seconds.

const T = 3600;                                   // ~60 seconds per coin
const SPAWN = { x: 140, y: 274, a: 0 };
const GATES = [
  { x: 300, y: 274 },   // 1: bottom straight
  { x: 398, y: 180 },   // 2: right side
  { x: 240, y: 86 },    // 3: top straight
  { x: 82,  y: 180 }    // 4: left side
];
const OILS = [{ x: 150, y: 86 }, { x: 398, y: 110 }, { x: 180, y: 290 }];
// the circuit: canvas edge is the outer wall, the infield island the inner
const OUT = { x0: 42, x1: 438, y0: 42, y1: 318 };
const ISLE = { hx: 120, hy: 36 };                 // half-extents incl. car size
const MAXSPD = [0, 1.4, 2.3, 3.2, 4.1];           // per gear
const ACC = [0, 0.10, 0.075, 0.055, 0.042];       // low gears pull harder
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a", WALLC = "#1f8f3c";

function carCode() {
  const L = [];
  const push = (s) => L.push(s);

  const startRace = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set laps to 0`);
    push(`${pad}set gear to 1`);
    push(`${pad}set speed to 0`);
    push(`${pad}set next to 1`);
    push(`${pad}set stall to 0`);
    push(`${pad}set oilcool to 0`);
    push(`${pad}set timeleft to ${T}`);
    push(`${pad}set self.x to ${SPAWN.x}`);
    push(`${pad}set self.y to ${SPAWN.y}`);
    push(`${pad}set self.angle to ${SPAWN.a}`);
    push(`${pad}set lastx to ${SPAWN.x}`);
    push(`${pad}set lasty to ${SPAWN.y}`);
    push(`${pad}set lasta to ${SPAWN.a}`);
  };

  push("when start");
  push("set game to 9");
  push("set wp to 1");
  push("set gear to 1");
  push("set endplay to 0");
  push(`set self.x to ${SPAWN.x}`);
  push(`set self.y to ${SPAWN.y}`);
  push("set self.angle to 0");
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

  // ATTRACT: the car laps the circuit by itself — the live reel
  push("if game == 9 then");
  push("  set speed to 2.4");
  push("  if wp == 1 then");
  push("    set self.angle to 0");
  push("    if self.x > 395 then");
  push("      set wp to 2");
  push("    end");
  push("  end");
  push("  if wp == 2 then");
  push("    set self.angle to -90");
  push("    if self.y < 86 then");
  push("      set wp to 3");
  push("    end");
  push("  end");
  push("  if wp == 3 then");
  push("    set self.angle to 180");
  push("    if self.x < 85 then");
  push("      set wp to 4");
  push("    end");
  push("  end");
  push("  if wp == 4 then");
  push("    set self.angle to 90");
  push("    if self.y > 274 then");
  push("      set wp to 1");
  push("      set self.x to 140");
  push("      set self.y to 274");
  push("    end");
  push("  end");
  push("  change self.x by cos(self.angle) * speed");
  push("  change self.y by sin(self.angle) * speed");
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
  // gas & brake, through the gearbox
  push('    if keydown("w") then');
  for (let g = 1; g <= 4; g++) {
    push(`      if gear == ${g} then`);
    push(`        set speed to min(${MAXSPD[g]}, speed + ${ACC[g]})`);
    push("      end");
  }
  push("    end");
  push('    if keydown("s") then');
  push("      set speed to max(0, speed - 0.09)");
  push("    end");
  push("    set speed to speed * 0.995");
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

  // the walls: outer edge + the infield island — crash = back to your last gate
  push(`    if self.x < ${OUT.x0} or self.x > ${OUT.x1} or self.y < ${OUT.y0} or self.y > ${OUT.y1} or (abs(self.x - 240) < ${ISLE.hx} and abs(self.y - 180) < ${ISLE.hy}) then`);
  push("      explode self");
  push("      beep 90 for 0.3");
  push("      set self.x to lastx");
  push("      set self.y to lasty");
  push("      set self.angle to lasta");
  push("      set speed to 0");
  push("      set stall to 35");
  push("    end");

  // the gates, in order — that's the whole race
  for (let i = 1; i <= 4; i++) {
    push(`    if next == ${i} and dist(self, g${i}) < 20 then`);
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
  push('    set statusline.text to "SCORE " + score + " · " + laps + " LAPS — CLICK FOR ATTRACT"');
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
  push("  if abs(mousex() - 240) < 60 and abs(mousey() - 240) < 16 then");
  startRace("    ");
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("    set wp to 1");
  push(`    set self.x to ${SPAWN.x}`);
  push(`    set self.y to ${SPAWN.y}`);
  push("    set self.angle to 0");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildGrantrakExample() {
  const objects = [];

  // the infield island (visual — collision is the math above)
  [156, 212, 268, 324].forEach((x, i) => {
    objects.push({
      id: "gk_i" + i, name: "isle" + i, type: "box",
      x, y: 180, size: 56, color: WALLC, glow: 3, visible: 1, text: "", script: []
    });
  });

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
    x: SPAWN.x, y: SPAWN.y, size: 11, angle: 0, color: AMBER, glow: 12, visible: 1, text: "",
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

  // the marquee lives on the infield
  objects.push({
    id: "gk_big", name: "bigtitle", type: "text",
    x: 240, y: 172, size: 26, color: WHITE, glow: 16, visible: 1, text: "GRAN TRAK 10", script: []
  });
  objects.push({
    id: "gk_coin", name: "coinline", type: "text",
    x: 240, y: 196, size: 11, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "gk_start", name: "startbtn", type: "text",
    x: 240, y: 240, size: 15, color: GREEN, glow: 12, visible: 1, text: "[ START ]", script: []
  });
  objects.push({
    id: "gk_status", name: "statusline", type: "text",
    x: 240, y: 196, size: 11, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });

  objects.push({
    id: "gk_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "ATARI 1974 · A/D STEER · W GAS · S BRAKE · Q/E SHIFT · GATES IN ORDER",
    script: []
  });

  return { title: "Gran Trak 10 (1974)", objects };
}

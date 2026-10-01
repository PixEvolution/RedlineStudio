// example-lunarlander.js — LUNAR LANDER (1979), rebuilt in our studio.
//
// The lineage is beautiful: in 1969, months after Apollo 11, a high-school
// student named Jim Storer wrote a TEXT lunar landing sim on a PDP-8 — type
// a burn rate, read your altitude, try not to die. It spread everywhere for
// a decade, and in 1979 Atari gave it GRAPHICS — their first VECTOR game,
// glowing white wireframes months before Asteroids used the same tube. The
// cabinet had a giant thrust lever, and the coin didn't buy a life: it
// bought FUEL.
//
// The 1979 machine, faithfully:
//   · real physics — gravity never blinks, thrust is a VECTOR along your
//     nose, and momentum doesn't care about your plans
//   · a wireframe mountain range with FLAT PADS rated 2X / 3X / 5X —
//     the tiny mesa pad pays five times for a reason
//   · one tank of fuel per coin — every burn spends it, landings and
//     crashes alike, and when it's gone the game is over
//   · land GENTLY (slow, level, upright, ON a pad) for mult × 50 and a
//     fuel bonus; land hard or on the rocks and you're a new crater
//   · live readouts: ALTITUDE · FUEL · ↓ and → speed, like the cabinet
//
//   A/D ROTATE · W THRUSTS (or the stick: lean to rotate, PUSH UP to burn —
//   it's ANALOG, half a push is half a burn, just like the 1979 lever)

const W = 480, H = 360;
const G = 0.028, THRUST = 0.062, TURN = 2.4, BURN = 1.15;
const FUEL0 = 1000, VY_MAX = 1.2, VX_MAX = 0.8, TILT_MAX = 18;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", ORANGE = "#ff9d4a";

// the mountain range: a polyline with four flat pads in it
const PTS = [
  [0, 295], [30, 255], [65, 318], [115, 318],      // PAD 2X (65..115)
  [140, 262], [175, 332], [215, 332],              // PAD 3X (175..215)
  [240, 285], [262, 210], [288, 210],              // PAD 5X — the high mesa
  [315, 300], [345, 338], [383, 338],              // PAD 2X (345..383)
  [410, 280], [445, 310], [480, 290]
];
const PADS = [[65, 115, 2], [175, 215, 3], [262, 288, 5], [345, 383, 2]];

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const newApproach = (pad) => {
    push(`${pad}set flying to 1`);
    push(`${pad}set lander.x to rand(60, 420)`);
    push(`${pad}set lander.y to 40`);
    push(`${pad}set lander.angle to -90`);
    push(`${pad}set vx to rand(-0.8, 0.8)`);
    push(`${pad}set vy to 0.3`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set fuel to ${FUEL0}`);
    push(`${pad}set landings to 0`);
    push(`${pad}set waitt to 0`);
    newApproach(pad);
    push(`${pad}set status.text to "ONE TANK PER COIN. GRAVITY IS PATIENT."`);
  };

  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set fuel to 0");
  push("set endplay to 0");
  push("set flying to 0");
  push('set status.text to ""');
  push("end");

  push("when tick");
  push('set fueltx.text to "FUEL " + max(0, floor(fuel))');
  push("set fueltx.visible to (game != 9)");
  push("set alttx.visible to (game != 9)");
  push("set veltx.visible to (game != 9)");
  push("set scoretx.visible to (game != 9)");
  push('set scoretx.text to "" + score');
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — THE COIN IS THE FUEL ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — THE COIN IS THE FUEL ◎"');
  push("end");

  push("if game == 0 then");
  push("  if flying == 1 then");
  // ---- rotation: keys or the stick's lean; the nose stays above the horizon
  push(`    set st to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`    set lander.angle to max(-180, min(0, lander.angle + st * ${TURN}))`);
  // ---- the lever: W is full burn, the stick is ANALOG — half push, half burn
  push(`    set th to max(0, min(1, keydown("w") + keydown("ArrowUp") + (0 - sticky(1))))`);
  push("    if fuel <= 0 then");
  push("      set th to 0");
  push("    end");
  push("    if th > 0 then");
  push(`      set vx to vx + cos(lander.angle) * th * ${THRUST}`);
  push(`      set vy to vy + sin(lander.angle) * th * ${THRUST}`);
  push(`      set fuel to fuel - th * ${BURN}`);
  push("      beep 60 for 0.03");
  push("    end");
  push("    set flame.visible to (th > 0)");
  push("    set flame.x to lander.x - cos(lander.angle) * 11");
  push("    set flame.y to lander.y - sin(lander.angle) * 11");
  push("    set flame.angle to lander.angle + 180");
  // ---- gravity never blinks
  push(`    set vy to vy + ${G}`);
  push("    change lander.x by vx");
  push("    change lander.y by vy");
  push("    set lander.x to max(8, min(472, lander.x))");
  // ---- the ground under you (the polyline, one segment at a time)
  for (let i = 0; i < PTS.length - 1; i++) {
    const [x0, y0] = PTS[i], [x1, y1] = PTS[i + 1];
    const slope = ((y1 - y0) / (x1 - x0)).toFixed(5);
    push(`    if lander.x >= ${x0} and lander.x < ${x1} then`);
    push(`      set gy to ${y0} + (lander.x - ${x0}) * ${slope}`);
    push("    end");
  }
  push('    set alttx.text to "ALT " + max(0, floor(gy - lander.y - 8))');
  push('    set veltx.text to "↓" + floor(vy * 10) / 10 + "  →" + floor(vx * 10) / 10');
  // ---- touchdown, or the other thing
  push("    if lander.y + 8 >= gy then");
  push("      set flying to 0");
  push("      set flame.visible to 0");
  push("      set waitt to 70");
  push("      set onpad to 0");
  for (const [x0, x1, m] of PADS) {
    push(`      if lander.x >= ${x0 + 4} and lander.x <= ${x1 - 4} then`);
    push(`        set onpad to ${m}`);
    push("      end");
  }
  push(`      if onpad > 0 and vy <= ${VY_MAX} and abs(vx) <= ${VX_MAX} and abs(lander.angle + 90) <= ${TILT_MAX} then`);
  push("        set landings to landings + 1");
  push("        change score by onpad * 50");
  push("        set fuel to fuel + 60");
  push("        beep 523 for 0.1");
  push("        beep 659 for 0.1");
  push("        beep 784 for 0.15");
  push('        set status.text to "A GOOD LANDING — " + (onpad * 50) + " PTS, +60 FUEL"');
  push("      else");
  push("        explode lander");
  push("        beep 70 for 0.4");
  push("        if onpad > 0 then");
  push('          set status.text to "ON THE PAD — BUT NOT GENTLY. NEW CRATER."');
  push("        else");
  push('          set status.text to "THE MOUNTAINS DO NOT NEGOTIATE. NEW CRATER."');
  push("        end");
  push("      end");
  push("    end");
  push("  else");
  // between attempts: the tank decides if there's a next one
  push("    if waitt > 0 then");
  push("      set waitt to waitt - 1");
  push("      if waitt == 0 then");
  push("        if fuel > 40 then");
  newApproach("          ");
  push("        else");
  push("          set game to 2");
  push("          set endplay to 1");
  push('          set status.text to "TANK DRY — " + landings + " LANDING" + "S" + ", " + score + " PTS. CLICK FOR A FRESH TANK"');
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

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

  return L.join("\n");
}

export function buildLunarlanderExample() {
  const objects = [];

  // THE RANGE: glowing vector lines, Atari's 1979 look — every segment is
  // one Line object, angle and length done at build time
  for (let i = 0; i < PTS.length - 1; i++) {
    const [x0, y0] = PTS[i], [x1, y1] = PTS[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    const isPad = PADS.some(([px0, px1]) => x0 === px0 && x1 === px1);
    objects.push({
      id: "ll_t" + i, name: "terrain" + (i + 1), type: "line",
      x: x0, y: y0, size: Math.round(len * 10) / 10, angle: Math.round(ang * 100) / 100,
      color: isPad ? GREEN : WHITE, glow: isPad ? 12 : 7, visible: 1, text: "", script: []
    });
  }
  // the pads wear their prices
  for (const [x0, x1, m] of PADS) {
    objects.push({
      id: "ll_p" + m + "_" + x0, name: "padtag" + m + "x" + x0, type: "text",
      x: (x0 + x1) / 2, y: (PTS.find(p => p[0] === x0)?.[1] || 330) + 12,
      size: 10, color: GREEN, glow: 8, visible: 1, text: m + "X", script: []
    });
  }

  // the lander and its flame
  objects.push({
    id: "ll_ship", name: "lander", type: "tri",
    x: 240, y: 40, size: 10, angle: -90, color: WHITE, glow: 12, visible: 1, text: "", script: []
  });
  objects.push({
    id: "ll_fl", name: "flame", type: "tri",
    x: -40, y: -40, size: 6, angle: 90, color: ORANGE, glow: 14, visible: 0, text: "", script: []
  });

  // the cabinet readouts
  objects.push({ id: "ll_sc", name: "scoretx", type: "text", x: 46, y: 22, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "ll_fu", name: "fueltx", type: "text", x: 420, y: 18, size: 12, color: ORANGE, glow: 6, visible: 0, text: "FUEL 1000", script: [] });
  objects.push({ id: "ll_al", name: "alttx", type: "text", x: 420, y: 32, size: 12, color: DIM, glow: 4, visible: 0, text: "ALT 0", script: [] });
  objects.push({ id: "ll_ve", name: "veltx", type: "text", x: 420, y: 46, size: 12, color: DIM, glow: 4, visible: 0, text: "↓0 →0", script: [] });
  objects.push({ id: "ll_st", name: "status", type: "text", x: 240, y: 356, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "ll_big", name: "bigtitle", type: "text", x: 240, y: 120, size: 42, color: WHITE, glow: 18, visible: 1, text: "LUNAR LANDER", script: [] });
  objects.push({ id: "ll_sub", name: "subline", type: "text", x: 240, y: 152, size: 10, color: DIM, glow: 4, visible: 1, text: "ATARI 1979 · VECTORS · BORN A 1969 TEXT GAME", script: [] });
  objects.push({ id: "ll_coin", name: "coinline", type: "text", x: 240, y: 182, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — THE COIN IS THE FUEL ◎", script: [] });
  objects.push({ id: "ll_play", name: "playbtn", type: "text", x: 240, y: 218, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ LAND ]", script: [] });
  objects.push({
    id: "ll_help", name: "help", type: "text",
    x: 240, y: 250, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A/D ROTATE · W BURNS · THE STICK IS THE LEVER (ANALOG) · PADS PAY 2X 3X 5X",
    script: []
  });

  objects.push({
    id: "ll_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({ id: "ll_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "LEVER", script: [] });

  return { title: "Lunar Lander (1979)", objects };
}

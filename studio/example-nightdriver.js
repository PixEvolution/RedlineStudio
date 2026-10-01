// example-nightdriver.js — NIGHT DRIVER (1976), rebuilt in our studio.
//
// Atari, October 1976: a black screen, a string of white roadside posts
// rushing out of the dark, and nothing else — one of the first first-person
// driving games ever put in a cabinet. The famous part: THE CAR WASN'T ON THE
// SCREEN. It was a painted plastic decal glued to the glass, and the video
// road just moved around it. Hardwired logic, a real steering wheel, a gas
// pedal, and a coin that bought TIME — distance was the score.
//
// Faithful here:
//   · first-person pseudo-3D: posts projected from depth, dead simple and
//     dead convincing — the whole renderer is one loop of divides
//   · nothing but posts and night (the road is where the posts aren't)
//   · the car is an OVERLAY — our little decal never moves; the world does
//   · wheel + pedal → A/D + W, or 🕹 stick 1 (the WHEEL: lean to steer,
//     push up for gas) · curves shove you outward — countersteer or crash
//   · the coin buys 75 seconds; distance is the ★ score
//
// Read the brain: eight depth slots, one projection, sixteen posts watching
// lists. That's every "3D" racer until the mid-80s, in thirty lines.

const W = 480, H = 360;
const SLOTS = 8, SPACING = 60, FAR = SLOTS * SPACING;   // the lit stretch of road
const HOR = 150;            // the horizon line
const ROADW = 150;          // road half-width in screen px at the windshield
const SEG = 420;            // track-curve segment length (distance units)
// the track: curvature per segment, looping — gentle, then the esses, then
// the long sweeper. Positive bends right.
const TRACK = [0, 0, 1, 2, 1, 0, -1, -2, -1, 0, 2, -2, 0, 1, -1, 0];
const MAXSPD = 4.2, ACCEL = 0.045, DRAG = 0.015, STEER = 3.4, SHOVE = 0.52;
const PLAYSECS = 75;
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", ORANGE = "#ff9d4a";

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set dist to 0`);
    push(`${pad}set speed to 0`);
    push(`${pad}set px to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set crashes to 0`);
    push(`${pad}set tleft to ${PLAYSECS * 60}`);
    push(`${pad}set status.text to "GAS IT — THE POSTS ARE THE ROAD\'S EDGES"`);
  };

  push("when start");
  push("set game to 9");
  push("set dist to 0");
  push("set speed to 2.2");    // the attract car drives itself into the night
  push("set px to 0");
  push("set score to 0");
  push("set endplay to 0");
  for (let i = 0; i < TRACK.length; i++) push(`set trk[${i}] to ${TRACK[i]}`);
  push('set status.text to ""');
  push("end");

  push("when tick");
  push('set scoretx.text to "" + score');
  push('set timetx.text to "TIME " + floor(tleft / 60)');
  push("set scoretx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set bigtitle.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO DRIVE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO DRIVE ◎"');
  push("end");

  // the current curve, EASED: each segment blends into the next across its
  // whole length, so a straight leans into a corner instead of snapping
  push(`set kseg to floor(dist / ${SEG}) % ${TRACK.length}`);
  push(`set kf to (dist % ${SEG}) / ${SEG}`);
  push(`set kurv to trk[kseg] + (trk[(kseg + 1) % ${TRACK.length}] - trk[kseg]) * kf`);

  push("if game == 9 then");
  // attract: the car drives itself — gas on, steering glued to the curve
  push(`  set speed to 2.4`);
  push(`  change dist by speed`);
  push(`  set px to px - kurv * speed * ${SHOVE} * 0.9`);
  push(`  set px to px - px * 0.08`);   // lazy perfect countersteer
  push("end");

  push("if game == 0 then");
  // THE PEDAL: W (or stick up) accelerates, drag always pulls back
  push(`  set gas to max(0, min(1, keydown("w") + keydown("ArrowUp") + (0 - sticky(1))))`);
  push(`  set speed to min(${MAXSPD}, speed + gas * ${ACCEL} - ${DRAG})`);
  push("  if speed < 0 then");
  push("    set speed to 0");
  push("  end");
  // THE WHEEL: A/D (or the stick) steers; the curve SHOVES you outward
  push(`  set st to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  change px by st * ${STEER}`);
  // the road bends away under you: not steering in a LEFT turn drifts you
  // OUT to the RIGHT wall — real-car physics, so the shove opposes the curve
  push(`  change px by (0 - kurv) * speed * ${SHOVE}`);
  push("  change dist by speed");
  push(`  set score to floor(dist / 20)`);
  // off the road = into the dark = CRASH
  push(`  if abs(px) > ${ROADW - 10} then`);
  push("    set crashes to crashes + 1");
  push("    beep 82 for 0.25");
  push("    beep 55 for 0.35");
  push('    say "CRASH!" for 0.8');
  push("    explode decal");
  push("    set px to 0");
  push("    set speed to 0");
  push("  end");
  // the clock is the coin
  push("  set tleft to tleft - 1");
  push("  if tleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push('    set status.text to "TIME — " + score + " DOWN THE ROAD. CLICK FOR A NEW RUN"');
  push("  end");
  push("end");

  // ---- THE RENDERER: eight gates of two posts, projected from depth.
  // scale(z) = 60/(z+60): big and low up close, small and high far away.
  // The curve bends the FAR road sideways (z² — that's the whole trick),
  // your own offset px shifts the NEAR road under you.
  push("set i to 0");
  push(`repeat ${SLOTS}`);
  push(`  set z to (${SPACING} - dist % ${SPACING}) + i * ${SPACING}`);
  push("  set sc to 60 / (z + 60)");
  push("  set rc to 240 + kurv * z * z * 0.0011 - px * sc");
  push(`  set py[i] to ${HOR} + 210 * sc`);
  push(`  set plx[i] to rc - ${ROADW} * sc`);
  push(`  set prx[i] to rc + ${ROADW} * sc`);
  push("  set ps[i] to 3 + 20 * sc");
  push("  set i to i + 1");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  startMatch("  ");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("    set speed to 2.4");
  push("    set px to 0");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildNightdriverExample() {
  const objects = [];

  // sixteen white posts — the entire visible world of 1976
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < SLOTS; i++) {
      objects.push({
        id: "nd_p" + side + "_" + i, name: (side ? "postr" : "postl") + (i + 1), type: "box",
        x: 240, y: 300, size: 10, color: WHITE, glow: 10, visible: 1, text: "",
        script: [{
          event: "code", source: `when tick
set self.visible to (game != 2)
set self.x to ${side ? "prx" : "plx"}[${i}]
set self.y to py[${i}]
set self.size to ps[${i}]
end` }]
      });
    }
  }

  // the horizon — a thin distant line, all you get of the world
  objects.push({ id: "nd_hz", name: "horizon", type: "line", x: 100, y: HOR, size: 280, angle: 0, color: "#20242c", glow: 2, visible: 1, text: "", script: [] });

  // THE DECAL: the car that was never in the video — a handful of slabs that
  // never move, exactly like the plastic overlay on the 1976 glass. Seen
  // from behind at night: a wide rear, a roof, and two burning taillights.
  objects.push({ id: "nd_cw1", name: "decalwl", type: "box", x: 219, y: 345, size: 10, angle: 0, color: "#14161b", glow: 2, visible: 1, text: "", script: [] });
  objects.push({ id: "nd_cw2", name: "decalwr", type: "box", x: 261, y: 345, size: 10, angle: 0, color: "#14161b", glow: 2, visible: 1, text: "", script: [] });
  objects.push({ id: "nd_c1", name: "decal", type: "box", x: 240, y: 337, size: 22, angle: 0, color: "#3d4452", glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "nd_c1l", name: "decalbl", type: "box", x: 221, y: 337, size: 18, angle: 0, color: "#3d4452", glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "nd_c1r", name: "decalbr", type: "box", x: 259, y: 337, size: 18, angle: 0, color: "#3d4452", glow: 4, visible: 1, text: "", script: [] });
  objects.push({ id: "nd_c2", name: "decalroof", type: "box", x: 240, y: 321, size: 15, angle: 0, color: "#2a2f3a", glow: 3, visible: 1, text: "", script: [] });
  objects.push({ id: "nd_c3", name: "decaltl", type: "box", x: 223, y: 331, size: 6, angle: 0, color: "#ff3b30", glow: 14, visible: 1, text: "", script: [] });
  objects.push({ id: "nd_c4", name: "decaltr", type: "box", x: 257, y: 331, size: 6, angle: 0, color: "#ff3b30", glow: 14, visible: 1, text: "", script: [] });

  // HUD
  objects.push({ id: "nd_sc", name: "scoretx", type: "text", x: 60, y: 24, size: 24, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "nd_tm", name: "timetx", type: "text", x: 410, y: 24, size: 16, color: DIM, glow: 6, visible: 0, text: "TIME 75", script: [] });
  objects.push({ id: "nd_st", name: "status", type: "text", x: 240, y: 352, size: 10, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "nd_big", name: "bigtitle", type: "text", x: 240, y: 120, size: 44, color: WHITE, glow: 18, visible: 1, text: "NIGHT DRIVER", script: [] });
  objects.push({ id: "nd_coin", name: "coinline", type: "text", x: 240, y: 155, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO DRIVE ◎", script: [] });
  objects.push({ id: "nd_play", name: "playbtn", type: "text", x: 240, y: 195, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ DRIVE ]", script: [] });
  objects.push({
    id: "nd_help", name: "help", type: "text",
    x: 240, y: 290, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A/D STEER · W GAS · OR THE WHEEL · CURVES SHOVE — COUNTERSTEER",
    script: []
  });

  // the brain
  objects.push({
    id: "nd_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({ id: "nd_s1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "WHEEL", script: [] });

  return { title: "Night Driver (1976)", objects };
}

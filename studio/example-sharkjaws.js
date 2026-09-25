// example-sharkjaws.js — SHARK JAWS (1975), rebuilt in our studio.
// The summer Jaws ate the box office, Atari wanted a bite — but couldn't get
// (or didn't ask for) the movie license. So they shipped this under a
// fictitious subsidiary called "Horror Games", and on the cabinet the word
// SHARK is enormous while "jaws" hides underneath in tiny letters. The
// lawyers never called. The game: you're a DIVER grabbing fish for points
// while a shark that is faster than you decides you're the fish.
//
//   WASD (or joystick 1) swims · that's it · that's the game
//   Catch fish = points. The shark catches YOU = back to the surface.
//   The coin buys ~90 seconds; your fish ride the ★ HIGH SCORES table.
//
// World size: a 640×360 WIDE tank — the chase needs room to run.

const W = 640, H = 360;
const T = 5400;
const DIVER_SPD = 2.4, SHARK_SPD = 2.7, SHARK_TURN = 0.08;
const FISH = 3;
const STUN = 60;

const WHITE = "#e8e8ec", AMBER = "#ff9d4a", GREEN = "#7dff9e", DIM = "#7a8894", BLUE = "#8fd0ff";

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  push("when start");
  push("set game to 9");
  push("set endplay to 0");
  push("set score to 0");
  push("set st to 0");
  push("set svx to -1");
  push("set svy to 0");
  push("set sfc to -1");
  for (let f = 1; f <= FISH; f++) {
    push(`set f${f}vx to ${(f % 2 ? 1 : -1)} * 1.4`);
    push(`set f${f}vy to 0.6`);
  }
  push("end");

  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set jawstx.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set divebtn.visible to (game == 9)");
  push("set scoretx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set statusline.visible to (game == 2)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — PRESS DIVE ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN ◎"');
  push("end");
  push('set scoretx.text to "FISH " + score');
  push('set timetx.text to "TIME " + max(0, floor(timeleft / 60))');

  push("if game != 2 then");

  // ---- the chomp pause: diver surfaces, shark backs off ----
  push("  if st > 0 then");
  push("    set st to st - 1");
  push("    if st == 1 then");
  push("      set diver.x to 60");
  push("      set diver.y to 60");
  push("      set shark.x to 560");
  push("      set shark.y to 300");
  push("      set svx to -1");
  push("      set svy to 0");
  push("      set diver.visible to 1");
  push("    end");
  push("  else");

  // ---- the diver: keys or the stick, facing follows the swim ----
  push("    if game == 9 then");
  push("      set ax to sin(time() * 50)");
  push("      set ay to cos(time() * 33)");
  push("    else");
  push('      set ax to max(-1, min(1, keydown("d") - keydown("a") + stickx(1)))');
  push('      set ay to max(-1, min(1, keydown("s") - keydown("w") + sticky(1)))');
  push("    end");
  push(`    change diver.x by ax * ${DIVER_SPD}`);
  push(`    change diver.y by ay * ${DIVER_SPD}`);
  push("    if ax > 0.3 then");
  push("      set fc to 1");
  push("    end");
  push("    if ax < -0.3 then");
  push("      set fc to -1");
  push("    end");
  push("    if fc == 1 then");
  push("      set diver.angle to ay * 35");
  push("    else");
  push("      set diver.angle to 180 - ay * 35");
  push("    end");
  push(`    set diver.x to max(20, min(${W - 20}, diver.x))`);
  push(`    set diver.y to max(40, min(${H - 20}, diver.y))`);

  // ---- the shark: always hunting, a little faster, wide turns ----
  push(`    set svx to svx + max(-${SHARK_TURN}, min(${SHARK_TURN}, (diver.x - shark.x) * 0.01 - svx * 0.05))`);
  push(`    set svy to svy + max(-${SHARK_TURN}, min(${SHARK_TURN}, (diver.y - shark.y) * 0.01 - svy * 0.05))`);
  push(`    set svm to max(1, abs(svx) + abs(svy))`);
  push(`    change shark.x by svx / svm * ${SHARK_SPD}`);
  push(`    change shark.y by svy / svm * ${SHARK_SPD}`);
  push(`    set shark.x to max(15, min(${W - 15}, shark.x))`);
  push(`    set shark.y to max(40, min(${H - 15}, shark.y))`);
  // the shark's nose: facing flips only on a REAL horizontal push (no
  // jitter when it hunts straight up or down), and the pitch is the
  // vertical FRACTION of its swim — always between level and ±40°
  push("    if svx > 0.15 then");
  push("      set sfc to 1");
  push("    end");
  push("    if svx < -0.15 then");
  push("      set sfc to -1");
  push("    end");
  push("    set spit to svy / max(0.5, abs(svx) + abs(svy)) * 40");
  push("    if sfc == 1 then");
  push("      set shark.angle to spit");
  push("    else");
  push("      set shark.angle to 180 - spit");
  push("    end");

  // the shark gets its bite in
  push("    if st == 0 and touching(shark, diver) then");
  push("      explode diver");
  push("      set diver.visible to 0");
  push('      say "CHOMP!" for 1.2');
  push("      beep 80 for 0.4");
  push(`      set st to ${STUN}`);
  push("    end");
  push("  end");

  // ---- the fish: darting, catchable, always replaced ----
  for (let f = 1; f <= FISH; f++) {
    push(`  change fish${f}.x by f${f}vx`);
    push(`  change fish${f}.y by f${f}vy`);
    push(`  if fish${f}.x < 15 or fish${f}.x > ${W - 15} then`);
    push(`    set f${f}vx to 0 - f${f}vx`);
    push("  end");
    push(`  if fish${f}.y < 45 or fish${f}.y > ${H - 15} then`);
    push(`    set f${f}vy to 0 - f${f}vy`);
    push("  end");
    push("  if rand(0, 100) < 2 then");
    push(`    set f${f}vx to rand(-1.8, 1.8)`);
    push(`    set f${f}vy to rand(-1.2, 1.2)`);
    push("  end");
    push(`  if f${f}vx > 0 then`);
    push(`    set fish${f}.angle to 0`);
    push("  else");
    push(`    set fish${f}.angle to 180`);
    push("  end");
    push(`  if game == 0 and st == 0 and touching(diver, fish${f}) then`);
    push("    change score by 1");
    push("    beep 620 for 0.07");
    push(`    explode fish${f}`);
    push(`    set fish${f}.x to rand(40, ${W - 40})`);
    push(`    set fish${f}.y to rand(60, ${H - 40})`);
    push(`    set f${f}vx to rand(-1.8, 1.8)`);
    push(`    set f${f}vy to rand(-1.2, 1.2)`);
    push("  end");
  }
  push("end");

  // the coin's clock
  push("if game == 0 then");
  push("  set timeleft to timeleft - 1");
  push("  if timeleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 150 for 0.5");
  push('    set statusline.text to "FISH " + score + " · CLICK"');
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if game == 9 then");
  push("  if abs(mousex() - 320) < 60 and abs(mousey() - 250) < 16 then");
  push("    set game to 0");
  push("    set endplay to 0");
  push("    set score to 0");
  push(`    set timeleft to ${T}`);
  push("    set st to 2");
  push("  end");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildSharkjawsExample() {
  const objects = [];

  // the fish
  for (let f = 1; f <= FISH; f++) {
    objects.push({
      id: "sj_f" + f, name: "fish" + f, type: "tri",
      x: 120 + f * 130, y: 90 + f * 70, size: 7, angle: 0, color: GREEN, glow: 7, visible: 1, text: "", script: []
    });
  }

  // the diver and the reason he should have stayed home
  objects.push({
    id: "sj_d", name: "diver", type: "tri",
    x: 60, y: 60, size: 11, angle: 0, color: BLUE, glow: 10, visible: 1, text: "", script: []
  });
  objects.push({
    id: "sj_s", name: "shark", type: "tri",
    x: 560, y: 300, size: 22, angle: 180, color: WHITE, glow: 12, visible: 1, text: "",
    script: [{ event: "code", source: brainCode() }]
  });

  // HUD
  objects.push({
    id: "sj_sc", name: "scoretx", type: "text",
    x: 70, y: 24, size: 12, color: GREEN, glow: 8, visible: 0, text: "FISH 0", script: []
  });
  objects.push({
    id: "sj_tm", name: "timetx", type: "text",
    x: 570, y: 24, size: 12, color: WHITE, glow: 8, visible: 0, text: "TIME 90", script: []
  });

  // the marquee — the famous legal dodge, in pixels: SHARK huge, jaws tiny
  objects.push({
    id: "sj_big", name: "bigtitle", type: "text",
    x: 320, y: 130, size: 34, color: WHITE, glow: 16, visible: 1, text: "SHARK", script: []
  });
  objects.push({
    id: "sj_jaws", name: "jawstx", type: "text",
    x: 320, y: 152, size: 10, color: DIM, glow: 4, visible: 1, text: "jaws", script: []
  });
  objects.push({
    id: "sj_sub", name: "subline", type: "text",
    x: 320, y: 182, size: 10, color: AMBER, glow: 8, visible: 1,
    text: "\"HORROR GAMES\" 1975 · DEFINITELY NOT ATARI · DEFINITELY NOT THAT MOVIE", script: []
  });
  objects.push({
    id: "sj_coin", name: "coinline", type: "text",
    x: 320, y: 210, size: 10, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN ◎", script: []
  });
  objects.push({
    id: "sj_dive", name: "divebtn", type: "text",
    x: 320, y: 250, size: 14, color: GREEN, glow: 12, visible: 1, text: "[ DIVE ]", script: []
  });
  objects.push({
    id: "sj_status", name: "statusline", type: "text",
    x: 320, y: 210, size: 12, color: AMBER, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "sj_help", name: "help", type: "text",
    x: 320, y: 344, size: 10, color: DIM, glow: 3, visible: 1,
    text: "1975 · WASD OR THE STICK TO SWIM · GRAB FISH · THE SHARK IS FASTER THAN YOU", script: []
  });

  // name the on-screen joystick
  objects.push({ id: "sj_st1", name: "stick1tag", type: "text", x: 0, y: 0, size: 10, color: "#3f7a52", glow: 0, visible: 0, text: "SWIM", script: [] });

  return { title: "Shark Jaws (1975)", w: W, h: H, objects };
}

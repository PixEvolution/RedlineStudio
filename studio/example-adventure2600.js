// example-adventure2600.js — ADVENTURE (1979), rebuilt in our studio.
//
// The first console action-adventure: Atari 2600, one square hero, three
// dragons that look like ducks, two castles, and ONE pair of hands — you
// carry a single item at a time, and choosing which one IS the game. It
// compressed a 4,000-room mainframe text adventure into 4 kilobytes of
// cartridge, and smuggled something else in with it: a secret room where
// the designer hid his own name, because the company wouldn't print it on
// the box. Players found it in 1980, and the EASTER EGG was born.
//
// Ours keeps the whole loop:
//   · rooms flip like cards, each its own color, exits on the edges
//   · gold key opens the gold castle, black key opens the black one
//   · the chalice waits in the black castle — bring it HOME to win
//   · three dragons, three speeds — the red one is faster than you
//   · the sword slays, but only if it's THERE (carried or lying nearby)
//   · and somewhere, an invisible dot… that opens a wall
//
//   WASD / arrows / stick to move · SPACE drops what you carry

const W = 480, H = 360;
const SPEED = 2.6;
const NAMES = ["", "GOLD KEY", "BLACK KEY", "THE SWORD", "THE CHALICE", "SOMETHING…"];
// the carry line doubles as the quest compass — what the item is FOR
// (full line = NAME + HINT, kept under the 2600 display's 41-char width)
const HINTS = [
  "",
  " — OPENS THE GOLD CASTLE",
  " — OPENS THE BLACK CASTLE",
  " — TOUCH A DRAGON TO SLAY IT",
  " — GOLD CASTLE = VICTORY",
  "",
];
// map: 0 1 2 / 3 4 5 outdoors · 9 gold inside · 10 black inside · 11 secret
const EXITS = {
  //      N   S   E   W
  0:  [ -1,  3,  1, -1],
  1:  [ -1,  4,  2,  0],
  2:  [ -1,  5, -1,  1],
  3:  [  0, -1,  4, -1],
  4:  [  1, -1,  5,  3],
  5:  [  2, -1, -1,  4],   // east opens only to the dot
  9:  [ -1,  0, -1, -1],   // S leaves the gold castle
  10: [ -1,  2, -1, -1],   // S leaves the black castle
  11: [ -1, -1, -1,  5],
};
const ROOMCOLOR = {
  0: "#e8c84a", 1: "#7dff9e", 2: "#b48cff", 3: "#6ec3ff",
  4: "#ff9d4a", 5: "#ff6666", 9: "#ffe28a", 10: "#7a8894", 11: "#ffffff",
};
const ROOMNAME = {
  0: "THE GOLD CASTLE", 1: "THE MEADOW", 2: "THE BLACK CASTLE",
  3: "THE BLUE PATH", 4: "THE CROSSROADS", 5: "THE CATACOMBS",
  9: "INSIDE THE GOLD CASTLE", 10: "INSIDE THE BLACK CASTLE", 11: "???",
};
const ROOMS = [0, 1, 2, 3, 4, 5, 9, 10, 11];
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e", RED = "#ff6666", YEL = "#ffe28a";

// item start positions: 1 goldkey, 2 blackkey, 3 sword, 4 chalice, 5 the dot
const ITEMS = [
  null,
  { room: 4, x: 360, y: 280 },
  { room: 5, x: 240, y: 290 },
  { room: 1, x: 120, y: 260 },
  { room: 10, x: 240, y: 120 },
  { room: 10, x: 452, y: 40 },
];
// dragons: [room, x, y, speed] — yellow, green, red
const DRAGONS = [null, [1, 360, 120, 1.3], [5, 120, 120, 1.6], [10, 120, 240, 2.1]];

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const resetWorld = (pad) => {
    for (let i = 1; i <= 5; i++) {
      push(`${pad}set ir[${i}] to ${ITEMS[i].room}`);
      push(`${pad}set ixx[${i}] to ${ITEMS[i].x}`);
      push(`${pad}set iyy[${i}] to ${ITEMS[i].y}`);
    }
    for (let d = 1; d <= 3; d++) {
      push(`${pad}set d${d}room to ${DRAGONS[d][0]}`);
      push(`${pad}set dragon${d}.x to ${DRAGONS[d][1]}`);
      push(`${pad}set dragon${d}.y to ${DRAGONS[d][2]}`);
      push(`${pad}set d${d}dead to 0`);
      push(`${pad}set dragon${d}.text to "ζ"`);
    }
    push(`${pad}set dragon1.color to "${YEL}"`);
    push(`${pad}set dragon2.color to "${GREEN}"`);
    push(`${pad}set dragon3.color to "${RED}"`);
    push(`${pad}set dragon1.glow to 10`);
    push(`${pad}set dragon2.glow to 10`);
    push(`${pad}set dragon3.glow to 12`);
    push(`${pad}set chget to 0`);
    push(`${pad}set ggate to 0`);
    push(`${pad}set bgate to 0`);
    push(`${pad}set carry to 0`);
    push(`${pad}set eggfound to 0`);
    push(`${pad}set room to 0`);
    push(`${pad}set hero.x to 240`);
    push(`${pad}set hero.y to 200`);
  };
  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set lives to 3`);
    resetWorld(pad);
    push(`${pad}set status.text to "ONE PAIR OF HANDS. CHOOSE WELL."`);
  };

  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  resetWorld("");
  push('set status.text to ""');
  push("end");

  push("when tick");
  push('set scoretx.text to "" + score');
  push('set livestx.text to "LIVES " + lives');
  push("set scoretx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set roomtx.visible to (game != 9)");
  push("set carrytx.visible to (game != 9)");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set help2.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO QUEST ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO QUEST ◎"');
  push("end");

  push("if game == 0 then");
  // where the sword IS this tick (for the dragons to fear)
  push("  set swordon to 0");
  push("  if carry == 3 then");
  push("    set swordon to 1");
  push("    set swx to hero.x");
  push("    set swy to hero.y");
  push("  else");
  push("    if ir[3] == room then");
  push("      set swordon to 1");
  push("      set swx to ixx[3]");
  push("      set swy to iyy[3]");
  push("    end");
  push("  end");

  // ---- room transitions: every exit is a GAP in the wall
  push("  set nroom to 0 - 1");
  const dir = (test, exIdx, placeX, placeY) => {
    push(`  if ${test} then`);
    push(`    set nroom to ex${exIdx}[room]`);
    push("    if nroom >= 0 then");
    push(`      set hero.x to ${placeX}`);
    push(`      set hero.y to ${placeY}`);
    push("      set room to nroom");
    push("    end");
    push("  end");
  };
  dir("hero.x < 10 and abs(hero.y - 180) < 30", "e2", 452, "hero.y");   // west gap
  push("  set nroom to 0 - 1");
  dir("hero.x > 470 and abs(hero.y - 180) < 30", "e1", 28, "hero.y");   // east gap
  push("  set nroom to 0 - 1");
  dir("hero.y > 350 and abs(hero.x - 240) < 30", "s1", "hero.x", 28);   // south gap
  push("  set nroom to 0 - 1");
  dir("hero.y < 10 and abs(hero.x - 240) < 30", "n1", "hero.x", 332);   // north gap
  // the dot opens the catacombs' east wall
  push("  if room == 5 and carry == 5 and hero.x > 452 then");
  push("    set room to 11");
  push("    set hero.x to 40");
  push("  end");
  push("  if room == 11 and eggfound == 0 then");
  push("    set eggfound to 1");
  push("    change score by 500");
  push("    beep 784 for 0.08");
  push("    beep 988 for 0.08");
  push("    beep 1175 for 0.14");
  push('    set status.text to "A ROOM THAT ISN\'T ON THE MAP — +500"');
  push("  end");

  // ---- clamp to the walls that remain (a gap is the only way through)
  push("  if exn1[room] < 0 then");
  push("    set gatepass to 0");
  push("    if room == 0 and ggate == 1 and abs(hero.x - 240) < 14 then");
  push("      set gatepass to 1");
  push("    end");
  push("    if room == 2 and bgate == 1 and abs(hero.x - 240) < 14 then");
  push("      set gatepass to 1");
  push("    end");
  push("    if gatepass == 0 then");
  push("      set hero.y to max(hero.y, 26)");
  push("    end");
  push("  else");
  push("    if abs(hero.x - 240) >= 30 then");
  push("      set hero.y to max(hero.y, 26)");
  push("    end");
  push("  end");
  push("  if exs1[room] < 0 then");
  push("    set hero.y to min(hero.y, 334)");
  push("  else");
  push("    if abs(hero.x - 240) >= 30 then");
  push("      set hero.y to min(hero.y, 334)");
  push("    end");
  push("  end");
  push("  if exe1[room] < 0 then");
  push("    if room == 5 and carry == 5 then");
  push("      set hero.x to hero.x");
  push("    else");
  push("      set hero.x to min(hero.x, 454)");
  push("    end");
  push("  else");
  push("    if abs(hero.y - 180) >= 30 then");
  push("      set hero.x to min(hero.x, 454)");
  push("    end");
  push("  end");
  push("  if exe2[room] < 0 then");
  push("    set hero.x to max(hero.x, 26)");
  push("  else");
  push("    if abs(hero.y - 180) >= 30 then");
  push("      set hero.x to max(hero.x, 26)");
  push("    end");
  push("  end");

  // ---- the castle gates
  push("  if room == 0 then");
  push("    if ggate == 0 and carry == 1 and abs(hero.x - 240) < 22 and hero.y < 60 then");
  push("      set ggate to 1");
  push("      change score by 50");
  push("      beep 660 for 0.1");
  push('      set status.text to "THE GOLD GATE RISES — WALK THROUGH"');
  push("    end");
  push("    if ggate == 1 and abs(hero.x - 240) < 14 and hero.y < 20 then");
  push("      set room to 9");
  push("      set hero.y to 320");
  push("    end");
  push("  end");
  push("  if room == 2 then");
  push("    if bgate == 0 and carry == 2 and abs(hero.x - 240) < 22 and hero.y < 60 then");
  push("      set bgate to 1");
  push("      change score by 50");
  push("      beep 660 for 0.1");
  push('      set status.text to "THE BLACK GATE RISES — WALK THROUGH"');
  push("    end");
  push("    if bgate == 1 and abs(hero.x - 240) < 14 and hero.y < 20 then");
  push("      set room to 10");
  push("      set hero.y to 320");
  push("    end");
  push("  end");

  // ---- pick up (touch) and drop (SPACE)
  push("  if carry == 0 then");
  push("    set i to 1");
  push("    repeat 5");
  push("      if carry == 0 and ir[i] == room and abs(hero.x - ixx[i]) < 13 and abs(hero.y - iyy[i]) < 13 then");
  push("        set carry to i");
  push("        set ir[i] to 0 - 1");
  push("        beep 520 for 0.06");
  push("        if i == 4 then");
  push("          if chget == 0 then");
  push("            set chget to 1");
  push("            change score by 200");
  push("          end");
  push('          set status.text to "THE CHALICE! TO THE GOLD CASTLE"');
  push("        end");
  push("        if i == 5 then");
  push('          set status.text to "YOU ARE CARRYING… SOMETHING?"');
  push("        end");
  push("      end");
  push("      set i to i + 1");
  push("    end");
  push("  end");
  push('  set pd to keydown("Space")');
  push("  if pd == 1 and pd0 == 0 and carry > 0 then");
  push("    set ir[carry] to room");
  push("    set ixx[carry] to hero.x + 20");
  push("    set iyy[carry] to hero.y");
  push("    set carry to 0");
  push("    beep 320 for 0.05");
  push("  end");
  push("  set pd0 to pd");

  // ---- a dragon got you
  push("  if herodie == 1 then");
  push("    set herodie to 0");
  push("    set lives to lives - 1");
  push("    explode hero");
  push("    beep 90 for 0.4");
  push("    if carry > 0 then");
  push("      set ir[carry] to room");
  push("      set ixx[carry] to hero.x");
  push("      set iyy[carry] to hero.y");
  push("      set carry to 0");
  push("    end");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "SWALLOWED — GAME OVER. CLICK TO RETRY"');
  push("    else");
  push("      set room to 0");
  push("      set hero.x to 240");
  push("      set hero.y to 200");
  push('      set status.text to "SWALLOWED! BACK TO THE GOLD CASTLE"');
  push("    end");
  push("  end");

  // ---- victory: the chalice comes home
  push("  if room == 9 and carry == 4 then");
  push("    change score by 1000 + lives * 200");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    beep 523 for 0.1");
  push("    beep 659 for 0.1");
  push("    beep 784 for 0.1");
  push("    beep 1047 for 0.25");
  push('    set status.text to "THE CHALICE IS HOME — KINGDOM SAVED"');
  push("  end");

  // ---- HUD text
  const nm = (r) => ROOMNAME[r];
  push('  set roomtx.text to ""');
  for (const r of ROOMS) {
    push(`  if room == ${r} then`);
    push(`    set roomtx.text to "${nm(r)}"`);
    push("  end");
  }
  push('  set carrytx.text to ""');
  for (let i = 1; i <= 5; i++) {
    push(`  if carry == ${i} then`);
    push(`    set carrytx.text to "${NAMES[i]}${HINTS[i]}"`);
    push("  end");
  }
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

// the square hero — the most famous square in video games
function heroCode() {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push("set self.visible to (game == 0)");
  push("if game == 0 then");
  push(`  set dx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`  set dy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push(`  change self.x by dx * ${SPEED}`);
  push(`  change self.y by dy * ${SPEED}`);
  push("end");
  push("end");
  return L.join("\n");
}

function dragonCode(d, speed) {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push(`set self.visible to (game != 9 and d${d}room == room)`);
  push(`if game == 0 and d${d}room == room then`);
  push(`  if d${d}dead == 1 then`);
  push('    set self.text to "~"');
  push(`    set self.color to "${DIM}"`);
  push("    set self.glow to 2");
  push("  else");
  // the sword is the only thing a dragon fears
  push("    if swordon == 1 and abs(self.x - swx) < 17 and abs(self.y - swy) < 17 then");
  push(`      set d${d}dead to 1`);
  push("      change score by 100");
  push("      beep 240 for 0.15");
  push(`      set status.text to "A DRAGON IS SLAIN"`);
  push("    else");
  // the chase
  push("      if hero.x > self.x then");
  push(`        change self.x by ${speed}`);
  push("      else");
  push(`        change self.x by 0 - ${speed}`);
  push("      end");
  push("      if hero.y > self.y then");
  push(`        change self.y by ${speed * 0.8}`);
  push("      else");
  push(`        change self.y by 0 - ${speed * 0.8}`);
  push("      end");
  push("      if abs(self.x - hero.x) < 13 and abs(self.y - hero.y) < 13 then");
  push("        set herodie to 1");
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

// an item: lies where it was left, or rides the hero's hands
function itemCode(i) {
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push(`set self.visible to (game != 9 and (carry == ${i} or ir[${i}] == room))`);
  push(`if carry == ${i} then`);
  push("  set self.x to hero.x + 14");
  push("  set self.y to hero.y - 6");
  push("else");
  push(`  if ir[${i}] == room then`);
  push(`    set self.x to ixx[${i}]`);
  push(`    set self.y to iyy[${i}]`);
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

// a wall: shown when this room has no exit that way, in the ROOM's color
function wallCode(exList, extra = "") {
  return `when tick
set self.visible to (game != 9 and ${exList}[room] < 0${extra})
set self.color to roomc
end`;
}

export function buildAdventure2600Example() {
  const objects = [];

  // room color feeds the walls — the brain can't easily hold strings per
  // room, so a tiny colorist object does the if-chain
  const colorist = ROOMS.map((r) => `if room == ${r} then\n  set roomc to "${ROOMCOLOR[r]}"\nend`).join("\n");
  objects.push({
    id: "ad_col", name: "colorist", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\n${colorist}\nend` }]
  });

  // the four edge walls (thin vector lines, colored by room) — a full
  // line where there is no exit, two segments framing a GAP where there is
  const gapCode = (exList) => `when tick
set self.visible to (game != 9 and ${exList}[room] >= 0)
set self.color to roomc
end`;
  // the north wall hides over an OPEN castle gate (rooms 0/2) so the
  // doorway reads as a doorway — two snug segments frame the real 28px gap
  const gateOpen = "(room == 0 and ggate == 1) or (room == 2 and bgate == 1)";
  objects.push({ id: "ad_wn", name: "wallN", type: "line", x: 0, y: 16, size: W, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: wallCode("exn1", ` and not (${gateOpen})`) }] });
  const doorCode = `when tick
set self.visible to (game != 9 and (${gateOpen}))
set self.color to roomc
end`;
  objects.push({ id: "ad_wdl", name: "gatewallL", type: "line", x: 0, y: 16, size: 226, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: doorCode }] });
  objects.push({ id: "ad_wdr", name: "gatewallR", type: "line", x: 254, y: 16, size: W - 254, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: doorCode }] });
  objects.push({ id: "ad_wna", name: "wallNa", type: "line", x: 0, y: 16, size: 204, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exn1") }] });
  objects.push({ id: "ad_wnb", name: "wallNb", type: "line", x: 276, y: 16, size: 204, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exn1") }] });
  objects.push({ id: "ad_ws", name: "wallS", type: "line", x: 0, y: 344, size: W, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: wallCode("exs1") }] });
  objects.push({ id: "ad_wsa", name: "wallSa", type: "line", x: 0, y: 344, size: 204, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exs1") }] });
  objects.push({ id: "ad_wsb", name: "wallSb", type: "line", x: 276, y: 344, size: 204, angle: 0, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exs1") }] });
  objects.push({ id: "ad_we", name: "wallE", type: "line", x: 464, y: 0, size: H, angle: 90, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: wallCode("exe1", " and (room != 5 or carry != 5)") }] });
  objects.push({ id: "ad_wea", name: "wallEa", type: "line", x: 464, y: 0, size: 144, angle: 90, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exe1") }] });
  objects.push({ id: "ad_web", name: "wallEb", type: "line", x: 464, y: 216, size: 144, angle: 90, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exe1") }] });
  objects.push({ id: "ad_ww", name: "wallW", type: "line", x: 16, y: 0, size: H, angle: 90, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: wallCode("exe2") }] });
  objects.push({ id: "ad_wwa", name: "wallWa", type: "line", x: 16, y: 0, size: 144, angle: 90, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exe2") }] });
  objects.push({ id: "ad_wwb", name: "wallWb", type: "line", x: 16, y: 216, size: 144, angle: 90, color: GOLD, glow: 6, visible: 0, text: "", script: [{ event: "code", source: gapCode("exe2") }] });

  // the castle gates (a closed gate is a bright block over the doorway)
  objects.push({
    id: "ad_gg", name: "goldgate", type: "box",
    x: 240, y: 26, size: 24, color: GOLD, glow: 10, visible: 0, text: "",
    script: [{ event: "code", source: "when tick\nset self.visible to (game != 9 and room == 0 and ggate == 0)\nend" }]
  });
  objects.push({
    id: "ad_bg", name: "blackgate", type: "box",
    x: 240, y: 26, size: 24, color: DIM, glow: 6, visible: 0, text: "",
    script: [{ event: "code", source: "when tick\nset self.visible to (game != 9 and room == 2 and bgate == 0)\nend" }]
  });

  // the items — one pair of hands
  objects.push({ id: "ad_i1", name: "goldkey", type: "text", x: 0, y: 0, size: 13, color: GOLD, glow: 8, visible: 0, text: "K", script: [{ event: "code", source: itemCode(1) }] });
  objects.push({ id: "ad_i2", name: "blackkey", type: "text", x: 0, y: 0, size: 13, color: DIM, glow: 5, visible: 0, text: "K", script: [{ event: "code", source: itemCode(2) }] });
  objects.push({ id: "ad_i3", name: "sword", type: "line", x: 0, y: 0, size: 18, angle: -45, color: WHITE, glow: 10, visible: 0, text: "", script: [{ event: "code", source: itemCode(3) }] });
  objects.push({ id: "ad_i4", name: "chalice", type: "text", x: 0, y: 0, size: 16, color: YEL, glow: 16, visible: 0, text: "Y", script: [{ event: "code", source: itemCode(4) }] });
  // the dot: it is THERE, but you will never see it
  objects.push({ id: "ad_i5", name: "thedot", type: "dot", x: 0, y: 0, size: 2, color: "#16211b", glow: 0, visible: 0, text: "", script: [{ event: "code", source: itemCode(5) }] });

  // the hero
  objects.push({
    id: "ad_hero", name: "hero", type: "box",
    x: 240, y: 200, size: 12, color: WHITE, glow: 10, visible: 1, text: "",
    script: [{ event: "code", source: heroCode() }]
  });

  // the dragons — ducks to you, death to the hero
  objects.push({ id: "ad_d1", name: "dragon1", type: "text", x: 0, y: 0, size: 24, color: YEL, glow: 10, visible: 0, text: "ζ", script: [{ event: "code", source: dragonCode(1, DRAGONS[1][3]) }] });
  objects.push({ id: "ad_d2", name: "dragon2", type: "text", x: 0, y: 0, size: 24, color: GREEN, glow: 10, visible: 0, text: "ζ", script: [{ event: "code", source: dragonCode(2, DRAGONS[2][3]) }] });
  objects.push({ id: "ad_d3", name: "dragon3", type: "text", x: 0, y: 0, size: 26, color: RED, glow: 12, visible: 0, text: "ζ", script: [{ event: "code", source: dragonCode(3, DRAGONS[3][3]) }] });

  // the secret room's reward
  objects.push({
    id: "ad_e1", name: "eggtext1", type: "text",
    x: W / 2, y: 150, size: 22, color: WHITE, glow: 16, visible: 0, text: "THE FIRST EASTER EGG",
    script: [{ event: "code", source: "when tick\nset self.visible to (game != 9 and room == 11)\nend" }]
  });
  objects.push({
    id: "ad_e2", name: "eggtext2", type: "text",
    x: W / 2, y: 182, size: 10, color: DIM, glow: 4, visible: 0,
    text: "IN 1979 A DESIGNER HID HIS NAME IN A ROOM LIKE THIS — NOW HIDE YOURS",
    script: [{ event: "code", source: "when tick\nset self.visible to (game != 9 and room == 11)\nend" }]
  });

  // HUD
  objects.push({ id: "ad_sc", name: "scoretx", type: "text", x: 58, y: 42, size: 20, color: WHITE, glow: 8, visible: 0, text: "0", script: [] });
  objects.push({ id: "ad_lv", name: "livestx", type: "text", x: 422, y: 40, size: 12, color: DIM, glow: 4, visible: 0, text: "LIVES 3", script: [] });
  objects.push({ id: "ad_rm", name: "roomtx", type: "text", x: W / 2, y: 356, size: 10, color: DIM, glow: 4, visible: 0, text: "", script: [] });
  objects.push({ id: "ad_cy", name: "carrytx", type: "text", x: W / 2, y: 10, size: 9, color: DIM, glow: 4, visible: 0, text: "", script: [] });
  objects.push({ id: "ad_st", name: "status", type: "text", x: W / 2, y: 336, size: 10, color: GREEN, glow: 6, visible: 1, text: "", script: [] });

  // attract furniture
  objects.push({ id: "ad_big", name: "bigtitle", type: "text", x: W / 2, y: 120, size: 44, color: GOLD, glow: 18, visible: 1, text: "ADVENTURE", script: [] });
  objects.push({ id: "ad_sub", name: "subline", type: "text", x: W / 2, y: 152, size: 10, color: DIM, glow: 4, visible: 1, text: "ATARI 2600 · 1979 · FIRST EASTER EGG", script: [] });
  objects.push({ id: "ad_coin", name: "coinline", type: "text", x: W / 2, y: 184, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO QUEST ◎", script: [] });
  objects.push({ id: "ad_play", name: "playbtn", type: "text", x: W / 2, y: 222, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ QUEST ]", script: [] });
  objects.push({
    id: "ad_help", name: "help", type: "text",
    x: W / 2, y: 256, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD · TOUCH GRABS · SPACE DROPS",
    script: []
  });
  objects.push({
    id: "ad_help2", name: "help2", type: "text",
    x: W / 2, y: 272, size: 9, color: DIM, glow: 3, visible: 1,
    text: "BLACK CASTLE'S CHALICE → GOLD CASTLE",
    script: []
  });

  // the brain — and the exit map it deals once
  const exitSetup = ROOMS.map((r) => {
    const [n, s, e, w] = EXITS[r];
    return `set exn1[${r}] to ${n}\nset exs1[${r}] to ${s}\nset exe1[${r}] to ${e}\nset exe2[${r}] to ${w}`;
  }).join("\n");
  const brain = brainCode().replace("when start\n", "when start\n" + exitSetup + "\n");
  objects.push({
    id: "ad_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "ad_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "HERO", script: [] });

  return { title: "Adventure (1979)",
    display: "tv2600", hardware: "tv2600",   // the real machine's era
    objects };
}

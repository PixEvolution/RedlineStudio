// example-wumpus.js — HUNT THE WUMPUS (1973), rebuilt in our studio.
// Gregory Yob wrote it in BASIC and mailed it to the People's Computer
// Company, and it spread from teletype to teletype — the ancestor of every
// adventure game. No screen at all in the original: just text. You are in a
// cave of 20 rooms joined like the corners of a dodecahedron. Somewhere in
// the dark: the WUMPUS. Also two bottomless pits and two colonies of super
// bats that snatch you to a random room. You can't see any of them — you
// HUNT BY EAR, room by room, reading the warnings:
//
//     I SMELL A WUMPUS · I FEEL A DRAFT · BATS NEARBY
//
// Our version draws the cave as a map (the text lives on the right, like
// the printout), but the game is the original: walk the lit rooms, and when
// you think you know where it sleeps, switch to SHOOT and fire an arrow
// into a tunnel. Five arrows. Miss, and the startled Wumpus usually moves.
//
//   Not a coin-op — this one was passed around for free, so no coin slot.

const CX = 150, CY = 195;                       // map center
const RO = 128, RM = 86, RI = 46;               // dodecahedron rings
const ARROWS = 5, WAKE = 75;                    // arrows · % a miss moves it
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e",
      AMBER = "#ff9d4a", RED = "#e5322d", CAVE = "#39734a";

// the canonical cave: room N's three tunnels (a dodecahedron's corners)
const ADJ = [
  [2, 5, 8],   [1, 3, 10],  [2, 4, 12],  [3, 5, 14],  [1, 4, 6],
  [5, 7, 15],  [6, 8, 17],  [1, 7, 9],   [8, 10, 18], [2, 9, 11],
  [10, 12, 19],[3, 11, 13], [12, 14, 20],[4, 13, 15], [6, 14, 16],
  [15, 17, 20],[7, 16, 18], [9, 17, 19], [11, 18, 20],[13, 16, 19]
];

function roomPos(n) {
  let a, r;
  if (n <= 5) { a = -90 + (n - 1) * 72; r = RO; }
  else if (n <= 15) { a = -90 + (n - 8) * 36; r = RM; }
  else { a = -126 + (n - 17) * 72; r = RI; }
  const rad = a * Math.PI / 180;
  return { x: Math.round(CX + Math.cos(rad) * r), y: Math.round(CY + Math.sin(rad) * r) };
}

function roomCode(n) {
  const [a, b, c] = ADJ[n - 1];
  const L = [];
  const push = (s) => L.push(s);
  push("when tick");
  push(`if game != 0 and wumpus == ${n} then`);        // the reveal
  push(`  set self.color to "${RED}"`);
  push("  set self.glow to 16");
  push("else");
  push(`  if pos == ${n} then`);
  push(`    set self.color to "${WHITE}"`);
  push("    set self.glow to 16");
  push("  else");
  push(`    if game == 0 and (pos == ${a} or pos == ${b} or pos == ${c}) then`);
  push("      if shootmode == 1 then");
  push(`        set self.color to "${AMBER}"`);
  push("      else");
  push(`        set self.color to "${GREEN}"`);
  push("      end");
  push("      set self.glow to 10");
  push("    else");
  push(`      set self.color to "${CAVE}"`);
  push("      set self.glow to 2");
  push("    end");
  push("  end");
  push("end");
  push("end");
  push("when click");
  push(`if game == 0 and abs(mousex() - self.x) < 15 and abs(mousey() - self.y) < 15 then`);
  push(`  if pos == ${a} or pos == ${b} or pos == ${c} then`);
  push(`    set target to ${n}`);
  push("    set act to 1");
  push("  end");
  push("end");
  push("end");
  return L.join("\n");
}

function modeBtnCode() {
  return [
    "when tick",
    "set self.visible to (game == 0)",
    "if shootmode == 1 then",
    '  set self.text to "[ MODE: SHOOT ]"',
    `  set self.color to "${AMBER}"`,
    "else",
    '  set self.text to "[ MODE: MOVE ]"',
    `  set self.color to "${GREEN}"`,
    "end",
    "end",
    "when click",
    "if game == 0 and abs(mousex() - self.x) < 60 and abs(mousey() - self.y) < 14 then",
    "  if shootmode == 1 then",
    "    set shootmode to 0",
    "  else",
    "    set shootmode to 1",
    "  end",
    "end",
    "end"
  ].join("\n");
}

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  // fresh cave: you at room 1, hazards rolled into distinct dark rooms
  const setup = (pad) => {
    push(`${pad}set pos to 1`);
    push(`${pad}set arrows to ${ARROWS}`);
    push(`${pad}set shootmode to 0`);
    push(`${pad}set act to 0`);
    push(`${pad}set target to 0`);
    push(`${pad}set game to 0`);
    push(`${pad}set wumpus to floor(rand(2, 21))`);
    for (const [v, taken] of [
      ["pit1", ["wumpus"]],
      ["pit2", ["wumpus", "pit1"]],
      ["bat1", ["wumpus", "pit1", "pit2"]],
      ["bat2", ["wumpus", "pit1", "pit2", "bat1"]]
    ]) {
      push(`${pad}set ${v} to 0`);
      push(`${pad}repeat 20`);
      push(`${pad}  if ${v} == 0 then`);
      push(`${pad}    set c to floor(rand(2, 21))`);
      push(`${pad}    if ${taken.map(t => `c != ${t}`).join(" and ")} then`);
      push(`${pad}      set ${v} to c`);
      push(`${pad}    end`);
      push(`${pad}  end`);
      push(`${pad}end`);
    }
  };
  const lose = (pad, cry, why) => {
    push(`${pad}set game to 2`);
    push(`${pad}say "${cry}" for 3`);
    push(`${pad}set statusline.text to "${why}"`);
  };

  push("when start");
  // the cave map, as a list the scripts can walk
  for (let n = 1; n <= 20; n++) {
    for (let k = 0; k < 3; k++) push(`set adj[${(n - 1) * 3 + k}] to ${ADJ[n - 1][k]}`);
  }
  setup("");
  push("end");

  push("when tick");
  push("if act == 1 then");
  push("  set act to 0");
  push("  if shootmode == 1 then");
  // THE CROOKED ARROW
  push("    set shootmode to 0");
  push("    set arrows to arrows - 1");
  push("    if target == wumpus then");
  push("      set game to 1");
  push('      say "AHA! YOU GOT THE WUMPUS!" for 3');
  push('      set statusline.text to "YOU WIN!"');
  push("    else");
  push('      say "MISSED!" for 1');
  push(`      if rand(0, 100) < ${WAKE} then`);        // a miss wakes it
  push("        set wumpus to adj[(wumpus - 1) * 3 + floor(rand(0, 3))]");
  push("      end");
  push("      if wumpus == pos then");
  lose("        ", "TSK TSK TSK — WUMPUS GOT YOU!", "EATEN!");
  push("      end");
  push("      if game == 0 and arrows <= 0 then");
  lose("        ", "OUT OF ARROWS...", "NO ARROWS LEFT");
  push("      end");
  push("    end");
  push("  else");
  // WALKING IN THE DARK
  push("    set pos to target");
  push("    if pos == wumpus then");
  lose("      ", "TSK TSK TSK — WUMPUS GOT YOU!", "EATEN!");
  push("    end");
  push("    if game == 0 and (pos == pit1 or pos == pit2) then");
  lose("      ", "YYYIIIIEEEE — FELL IN A PIT!", "FELL IN A PIT");
  push("    end");
  push("    if game == 0 and (pos == bat1 or pos == bat2) then");
  push('      say "ZAP — SUPER BAT SNATCH!" for 2');
  push("      set pos to floor(rand(1, 21))");
  push("      if pos == wumpus then");
  lose("        ", "TSK TSK TSK — WUMPUS GOT YOU!", "EATEN!");
  push("      end");
  push("      if game == 0 and (pos == pit1 or pos == pit2) then");
  lose("        ", "YYYIIIIEEEE — FELL IN A PIT!", "FELL IN A PIT");
  push("      end");
  push("    end");
  push("  end");
  push("end");

  // the printout: where you are, and what you hear in the dark
  push("set n1 to adj[(pos - 1) * 3]");
  push("set n2 to adj[(pos - 1) * 3 + 1]");
  push("set n3 to adj[(pos - 1) * 3 + 2]");
  push('set roomline.text to "ROOM " + pos + " · ARROWS " + arrows');
  push('set tunnels.text to "TUNNELS: " + n1 + " " + n2 + " " + n3');
  push("set warn1.visible to (game == 0 and (n1 == wumpus or n2 == wumpus or n3 == wumpus))");
  push("set warn2.visible to (game == 0 and (n1 == pit1 or n2 == pit1 or n3 == pit1 or n1 == pit2 or n2 == pit2 or n3 == pit2))");
  push("set warn3.visible to (game == 0 and (n1 == bat1 or n2 == bat1 or n3 == bat1 or n1 == bat2 or n2 == bat2 or n3 == bat2))");
  push("set statusline.visible to (game != 0)");
  push("set againline.visible to (game != 0)");
  push("end");

  push("when click");
  push("if game != 0 then");
  setup("  ");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildWumpusExample() {
  const objects = [];

  // the cave: 20 numbered rooms, corners of a dodecahedron
  for (let n = 1; n <= 20; n++) {
    const p = roomPos(n);
    objects.push({
      id: "wu_r" + n, name: "r" + n, type: "text",
      x: p.x, y: p.y, size: 13, color: CAVE, glow: 2, visible: 1, text: String(n),
      script: [{ event: "code", source: roomCode(n) }]
    });
  }

  // the printout column
  objects.push({
    id: "wu_room", name: "roomline", type: "text",
    x: 386, y: 90, size: 11, color: WHITE, glow: 8, visible: 1, text: "ROOM 1 · ARROWS 5", script: []
  });
  objects.push({
    id: "wu_w1", name: "warn1", type: "text",
    x: 386, y: 130, size: 11, color: RED, glow: 8, visible: 0, text: "I SMELL A WUMPUS", script: []
  });
  objects.push({
    id: "wu_w2", name: "warn2", type: "text",
    x: 386, y: 152, size: 11, color: "#8fd0ff", glow: 8, visible: 0, text: "I FEEL A DRAFT", script: []
  });
  objects.push({
    id: "wu_w3", name: "warn3", type: "text",
    x: 386, y: 174, size: 11, color: AMBER, glow: 8, visible: 0, text: "BATS NEARBY", script: []
  });
  objects.push({
    id: "wu_tun", name: "tunnels", type: "text",
    x: 386, y: 214, size: 11, color: DIM, glow: 4, visible: 1, text: "TUNNELS: 2 5 8", script: []
  });
  objects.push({
    id: "wu_mode", name: "modebtn", type: "text",
    x: 386, y: 254, size: 12, color: GREEN, glow: 10, visible: 1, text: "[ MODE: MOVE ]",
    script: [{ event: "code", source: modeBtnCode() }]
  });
  objects.push({
    id: "wu_status", name: "statusline", type: "text",
    x: 386, y: 292, size: 12, color: WHITE, glow: 10, visible: 0, text: "", script: []
  });
  objects.push({
    id: "wu_again", name: "againline", type: "text",
    x: 386, y: 312, size: 10, color: DIM, glow: 4, visible: 0, text: "CLICK FOR A NEW HUNT", script: []
  });

  // the brain rides on the title
  objects.push({
    id: "wu_title", name: "title", type: "text",
    x: 240, y: 22, size: 16, color: WHITE, glow: 10, visible: 1, text: "HUNT THE WUMPUS",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({
    id: "wu_help", name: "help", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "GREGORY YOB 1973 · WALK THE LIT ROOMS · SHOOT MODE FIRES INTO A TUNNEL",
    script: []
  });

  return { title: "Hunt the Wumpus (1973)", objects };
}

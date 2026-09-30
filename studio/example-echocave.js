// example-echocave.js — ECHO CAVE, an ORIGINAL text adventure in the 1976 style.
//
// 1976 is the year the text adventure was born and named a whole genre. But a
// text game IS its prose, and prose belongs to its author — so unlike the
// arcade machines (whose MECHANICS we rebuild with our own code and art),
// this museum piece is not a recreation. It's our own cave, written for this
// platform, honoring the year: a two-word parser, a lantern against the dark,
// treasures carried back to a cabin, and a magic word carved on a wall.
//
// It exists to teach the platform's whole text-adventure kit in one game:
//   print · clear · when answer · answer() · upper() · word()
// word() is the new trick this machine taught the engine: word(answer(), 1)
// is the VERB, word(answer(), 2) is the NOUN — the classic two-word parser,
// in two expressions. Open the brain and read it: it's one state machine.
//
//   FIVE treasures, 100 points each, safe in the CABIN · 500 is perfect
//   TYPE TWO WORDS: GO NORTH · GET LAMP · UNLOCK DOOR · HELP lists them

const NROOMS = 14, NITEMS = 9;
// items: 0 KEY · 1 LANTERN · 2 HONEY · 3 PLANK · then the treasures:
// 4 AMBER · 5 CROWN · 6 IDOL · 7 PEARL · 8 OPAL   (loc 99 = carried, 0 = gone)
const ITEM_START = [2, 2, 2, 7, 7, 9, 10, 13, 14];
const TREASURE0 = 4, CARRIED = 99;
// exits: room × [N, S, E, W, U, D] (0 = no way). Doors/chasms gate in code.
const EXITS = [
  /* 1 trailhead */[0, 3, 2, 0, 0, 0],
  /* 2 cabin     */[0, 0, 0, 1, 0, 0],
  /* 3 creek     */[1, 4, 0, 0, 0, 0],
  /* 4 sinkhole  */[3, 0, 0, 0, 0, 5],
  /* 5 stair     */[6, 0, 0, 0, 4, 0],
  /* 6 echo hall */[14, 5, 8, 7, 0, 0],
  /* 7 grotto    */[0, 11, 6, 0, 0, 0],
  /* 8 chasm     */[0, 0, 9, 6, 0, 0],
  /* 9 alcove    */[0, 0, 0, 8, 0, 0],
  /* 10 bear den */[0, 0, 14, 0, 0, 0],
  /* 11 tangle   */[11, 12, 11, 11, 7, 0],
  /* 12 tangle   */[11, 12, 13, 12, 12, 0],
  /* 13 tangle   */[13, 13, 13, 12, 13, 0],
  /* 14 lakeshore*/[0, 6, 0, 10, 0, 0]
];
const DARK_FROM = 5;   // rooms 5+ have never seen the sun

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const setup = (pad) => {
    push(`${pad}set pos to 1`);
    push(`${pad}set score to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set lit to 0`);
    push(`${pad}set dooropen to 0`);
    push(`${pad}set planked to 0`);
    push(`${pad}set bear to 1`);
    push(`${pad}set sawword to 0`);
    push(`${pad}set darksteps to 0`);
    push(`${pad}set banked to 0`);
    push(`${pad}set dead to 0`);
    for (let k = 0; k < NITEMS; k++) push(`${pad}set iloc[${k}] to ${ITEM_START[k]}`);
    for (let r = 0; r < NROOMS; r++) for (let d = 0; d < 6; d++)
      push(`${pad}set ex[${r * 6 + d}] to ${EXITS[r][d]}`);
  };

  // is the player in the dark? (deep room, and no lit lantern in hand)
  const inDark = `pos >= ${DARK_FROM} and (iloc[1] != ${CARRIED} or lit == 0)`;

  push("when start");
  push("set title1.visible to 0");
  push("set title2.visible to 0");
  setup("");
  push('print "ECHO CAVE"');
  push('print "AN ORIGINAL TEXT ADVENTURE, 1976 STYLE"');
  push('print "TYPE TWO WORDS — LIKE: GO SOUTH · GET LAMP · HELP"');
  push('print ""');
  push("set look to 1");
  push("end");

  // ---- the room reporter: one frame after any move, describe where you are
  push("when tick");
  push("if look == 1 then");
  push("  set look to 0");
  push(`  if ${inDark} then`);
  push('    print "IT IS PITCH DARK. YOU CANNOT SEE A THING."');
  push('    print "ANOTHER BLIND STEP COULD BE OFF AN UNSEEN LEDGE."');
  push("  else");
  const room = (n, lines) => {
    push(`  if pos == ${n} then`);
    for (const t of lines) push(`    print "${t}"`);
    push("  end");
  };
  room(1, ["YOU STAND AT A TRAILHEAD WHERE THE FOREST THINS.",
           "A RANGER CABIN IS EAST. A DRY CREEK BED RUNS SOUTH."]);
  room(2, ["INSIDE THE RANGER CABIN. SHELVES, A COLD STOVE, AND A",
           "STRONGBOX FOR ANYTHING VALUABLE. THE TRAILHEAD IS WEST."]);
  room(3, ["YOU FOLLOW THE DRY CREEK BED. IT DEEPENS SOUTHWARD."]);
  room(4, ["A SINKHOLE SWALLOWS THE CREEK. SET IN ITS FLOOR IS AN",
           "IRON DOOR. THE CREEK BED CLIMBS BACK NORTH."]);
  room(5, ["A STONE STAIR SPIRALS DOWN INTO COLD AIR. THE IRON DOOR",
           "IS ABOVE YOU. A PASSAGE OPENS NORTH."]);
  room(6, ["A VAST HALL WHERE EVERY SOUND COMES BACK TWICE — THE",
           "ECHO HALL. WAYS LEAD NORTH, SOUTH, EAST AND WEST.",
           "LETTERS ARE CHISELED INTO THE WALL HERE."]);
  room(7, ["A GROTTO OF PALE MUSHROOMS, SOME TALLER THAN YOU.",
           "A LOW CRAWL WORMS SOUTH. THE HALL IS BACK EAST."]);
  room(8, ["THE FLOOR TEARS OPEN INTO A BLACK CHASM. THE FAR LIP",
           "IS EAST, A LONG STRIDE TOO FAR TO JUMP."]);
  room(9, ["A QUIET ALCOVE BEYOND THE CHASM, SMOOTHED BY OLD WATER."]);
  room(10, ["A ROUND DEN THAT SMELLS OF MUSK AND WET FUR."]);
  room(11, ["A TANGLE OF CRAWLWAYS, EACH ONE LIKE THE LAST."]);
  room(12, ["A TANGLE OF CRAWLWAYS, EACH ONE LIKE THE LAST."]);
  room(13, ["A TANGLE OF CRAWLWAYS, EACH ONE LIKE THE LAST."]);
  room(14, ["A BLACK UNDERGROUND LAKE LAPS AT A GRAVEL SHORE.",
            "THE WATER SWALLOWS YOUR LIGHT WHOLE."]);
  // standing furniture and blockers
  push("  if pos == 4 or pos == 5 then");
  push("    if dooropen == 1 then");
  push('      print "THE IRON DOOR STANDS OPEN."');
  push("    else");
  push('      print "THE IRON DOOR IS LOCKED."');
  push("    end");
  push("  end");
  push("  if pos == 6 and sawword == 0 then");
  push("    set sawword to 1");
  push('    print "THE CHISELED LETTERS SPELL ONE WORD: REDLINE"');
  push("  end");
  push("  if pos == 8 then");
  push("    if planked == 1 then");
  push('      print "YOUR PLANK BRIDGES THE CHASM."');
  push("    end");
  push("  end");
  push("  if pos == 10 and bear == 1 then");
  push('    print "AN ENORMOUS BEAR SLEEPS HERE, CURLED AROUND SOMETHING."');
  push("  end");
  // whatever lies about
  push("  set i to 0");
  push(`  repeat ${NITEMS}`);
  push("    if iloc[i] == pos then");
  const itemLine = [
    "A SMALL IRON KEY LIES HERE.",
    "A BRASS LANTERN SITS HERE.",
    "A JAR OF HONEY SITS HERE.",
    "A STOUT WOODEN PLANK LEANS HERE.",
    "A LUMP OF AMBER GLOWS HERE LIKE TRAPPED SUNLIGHT!",
    "A THIN SILVER CROWN RESTS HERE!",
    "A CARVED STONE IDOL SITS HERE, HEAVIER THAN IT LOOKS!",
    "A GREAT PEARL SHINES HERE IN YOUR LIGHT!",
    "AN OPAL GLINTS IN THE SHALLOWS HERE!"
  ];
  itemLine.forEach((t, k) => {
    push(`      if i == ${k} then`);
    push(`        print "${t}"`);
    push("      end");
  });
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push("  end");
  push("end");
  push("end");

  // ---- the parser: VERB NOUN, nothing more, nothing less
  push("when answer");
  push("if dead == 0 then");
  push("set a to upper(answer())");
  push("set v to word(a, 1)");
  push("set n to word(a, 2)");
  // bare directions work, and GO NORTH folds into them
  push('if v == "GO" or v == "WALK" or v == "CLIMB" then');
  push("  set v to n");
  push("end");
  push("set dir to 0 - 1");
  const dirs = [["NORTH", "N", 0], ["SOUTH", "S", 1], ["EAST", "E", 2], ["WEST", "W", 3], ["UP", "U", 4], ["DOWN", "D", 5]];
  for (const [long, short, d] of dirs) {
    push(`if v == "${long}" or v == "${short}" then`);
    push(`  set dir to ${d}`);
    push("end");
  }
  push("set acted to 0");

  // ---------------- movement
  push("if dir >= 0 then");
  push("  set acted to 1");
  push("  set dest to ex[(pos - 1) * 6 + dir]");
  // the gates
  push("  if pos == 4 and dir == 5 and dooropen == 0 then");
  push("    set dest to 0");
  push('    print "THE IRON DOOR IS LOCKED."');
  push("  end");
  push("  if pos == 5 and dir == 4 and dooropen == 0 then");
  push("    set dest to 0");
  push('    print "THE IRON DOOR IS LOCKED."');
  push("  end");
  push("  if pos == 8 and dir == 2 and planked == 0 then");
  push("    set dest to 0");
  push('    print "THE CHASM IS TOO WIDE. A STOUT PLANK WOULD SPAN IT."');
  push("  end");
  push("  if pos == 9 and dir == 3 and planked == 0 then");
  push("    set dest to 0");
  push('    print "THE CHASM IS TOO WIDE."');
  push("  end");
  push("  if dest == 0 then");
  push('    print "YOU CAN\'T GO THAT WAY."');
  push("  else");
  push("    set pos to dest");
  // darkness is patient, then it isn't
  push(`    if ${inDark} then`);
  push("      set darksteps to darksteps + 1");
  push("      if darksteps > 1 and rand(0, 100) < 40 then");
  push("        set dead to 1");
  push('        print "YOU STEP OFF AN UNSEEN LEDGE INTO NOTHING."');
  push('        print "THE ECHO TAKES A LONG TIME TO COME BACK."');
  push('        print "*** YOU HAVE DIED *** FINAL SCORE: " + score');
  push("        set endplay to 1");
  push("      end");
  push("    else");
  push("      set darksteps to 0");
  push("    end");
  push("    if dead == 0 then");
  push("      set look to 1");
  push("    end");
  push("  end");
  push("end");

  // ---------------- GET / TAKE
  push('if v == "GET" or v == "TAKE" or v == "GRAB" then');
  push("  set acted to 1");
  push("  set found to 0 - 1");
  const nouns = [
    ["KEY", "KEYS"], ["LANTERN", "LAMP"], ["HONEY", "JAR"], ["PLANK", "BOARD"],
    ["AMBER", "LUMP"], ["CROWN", "SILVER"], ["IDOL", "STATUE"], ["PEARL", "PEARLS"], ["OPAL", "OPALS"]
  ];
  nouns.forEach((names, k) => {
    push(`  if n == "${names[0]}" or n == "${names[1]}" then`);
    push(`    set found to ${k}`);
    push("  end");
  });
  push("  if found < 0 then");
  push('    print "I DON\'T SEE THAT HERE."');
  push("  else");
  push(`    if iloc[found] == ${CARRIED} then`);
  push('      print "YOU ALREADY HAVE IT."');
  push("    else");
  push("      if iloc[found] != pos then");
  push('        print "I DON\'T SEE THAT HERE."');
  push("      else");
  push("        if found == 6 and bear == 1 then");
  push('          print "THE BEAR GROWLS IN ITS SLEEP. VERY BAD IDEA."');
  push("        else");
  push(`          set iloc[found] to ${CARRIED}`);
  push('          print "TAKEN."');
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("end");

  // ---------------- DROP (and the strongbox banks treasure)
  push('if v == "DROP" or v == "PLACE" or v == "PUT" or v == "LEAVE" then');
  push("  set acted to 1");
  push("  set found to 0 - 1");
  nouns.forEach((names, k) => {
    push(`  if n == "${names[0]}" or n == "${names[1]}" then`);
    push(`    set found to ${k}`);
    push("  end");
  });
  push(`  if found < 0 or iloc[found] != ${CARRIED} then`);
  push('    print "YOU\'RE NOT CARRYING THAT."');
  push("  else");
  // the plank at the chasm becomes the bridge
  push("    if found == 3 and (pos == 8 or pos == 9) then");
  push("      set planked to 1");
  push("      set iloc[3] to 0");
  push('      print "YOU LAY THE PLANK ACROSS THE CHASM. IT HOLDS."');
  push("    else");
  push("      set iloc[found] to pos");
  push(`      if pos == 2 and found >= ${TREASURE0} then`);
  push("        set iloc[found] to 0");   // safe in the strongbox for good
  push("        set banked to banked + 1");
  push("        set score to banked * 100");
  push('        print "SAFE IN THE STRONGBOX. SCORE: " + score');
  push("        if banked == 5 then");
  push('          print ""');
  push('          print "ALL FIVE TREASURES SAFE — A PERFECT 500!"');
  push('          print "THE CAVE KEEPS ITS SILENCE. YOU KEPT EVERYTHING ELSE."');
  push("          set endplay to 1");
  push("          set dead to 1");
  push("        end");
  push("      else");
  push('        print "DROPPED."');
  push("      end");
  push("    end");
  push("  end");
  push("end");

  // ---------------- the lantern
  push('if v == "LIGHT" or v == "ON" then');
  push("  set acted to 1");
  push(`  if iloc[1] == ${CARRIED} then`);
  push("    set lit to 1");
  push("    set darksteps to 0");
  push('    print "THE LANTERN BURNS BRIGHT AND STEADY."');
  push("    set look to 1");
  push("  else");
  push('    print "YOU HAVE NO LIGHT TO LIGHT."');
  push("  end");
  push("end");
  push('if v == "OFF" or v == "DOUSE" then');
  push("  set acted to 1");
  push("  set lit to 0");
  push('  print "DARKNESS, INSTANTLY."');
  push("end");

  // ---------------- the iron door
  push('if v == "UNLOCK" or v == "OPEN" then');
  push("  set acted to 1");
  push("  if pos != 4 and pos != 5 then");
  push('    print "THERE IS NOTHING TO OPEN HERE."');
  push("  else");
  push(`    if iloc[0] == ${CARRIED} then`);
  push("      set dooropen to 1");
  push('      print "THE KEY TURNS. THE IRON DOOR GRINDS OPEN."');
  push("    else");
  push('      print "IT\'S LOCKED, AND YOU HAVE NO KEY."');
  push("    end");
  push("  end");
  push("end");

  // ---------------- the bear takes bribes
  push('if v == "GIVE" or v == "FEED" then');
  push("  set acted to 1");
  push(`  if pos == 10 and bear == 1 and iloc[2] == ${CARRIED} then`);
  push("    set bear to 0");
  push("    set iloc[2] to 0");
  push('    print "THE BEAR SNIFFS, HOOKS THE JAR WITH ONE CLAW, AND"');
  push('    print "SHUFFLES OFF INTO THE DARK TO ENJOY IT IN PRIVATE."');
  push('    print "THE IDOL LIES UNGUARDED."');
  push("  else");
  push('    print "NOTHING HERE WANTS THAT."');
  push("  end");
  push("end");

  // ---------------- the magic word
  push('if v == "REDLINE" then');
  push("  set acted to 1");
  push("  if sawword == 1 and (pos == 2 or pos == 6) then");
  push("    if pos == 2 then");
  push("      set pos to 6");
  push("    else");
  push("      set pos to 2");
  push("    end");
  push('    print ">>> THE ECHO ANSWERS, AND THE WORLD BLINKS <<<"');
  push("    set look to 1");
  push("  else");
  push('    print "NOTHING HAPPENS."');
  push("  end");
  push("end");

  // ---------------- housekeeping verbs
  push('if v == "LOOK" or v == "L" then');
  push("  set acted to 1");
  push("  set look to 1");
  push("end");
  push('if v == "INV" or v == "INVENTORY" or v == "I" then');
  push("  set acted to 1");
  push('  print "YOU ARE CARRYING:"');
  push("  set any to 0");
  push("  set i to 0");
  push(`  repeat ${NITEMS}`);
  push(`    if iloc[i] == ${CARRIED} then`);
  push("      set any to 1");
  const invName = ["AN IRON KEY", "A BRASS LANTERN", "A JAR OF HONEY", "A WOODEN PLANK",
    "A LUMP OF AMBER", "A SILVER CROWN", "A STONE IDOL", "A GREAT PEARL", "AN OPAL"];
  invName.forEach((t, k) => {
    push(`      if i == ${k} then`);
    push(`        print "  ${t}"`);
    push("      end");
  });
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push("  if any == 0 then");
  push('    print "  NOTHING AT ALL."');
  push("  end");
  push("end");
  push('if v == "SCORE" then');
  push("  set acted to 1");
  push('  print "SCORE: " + score + " OF 500 (100 PER TREASURE IN THE STRONGBOX)"');
  push("end");
  push('if v == "HELP" then');
  push("  set acted to 1");
  push('  print "TWO WORDS: GO NORTH (OR JUST N/S/E/W/U/D) · GET THING ·"');
  push('  print "DROP THING · UNLOCK DOOR · LIGHT LAMP · OFF · GIVE HONEY ·"');
  push('  print "LOOK · INV · SCORE · QUIT — AND THE CAVE HIDES ONE MORE WORD."');
  push("end");
  push('if v == "QUIT" then');
  push("  set acted to 1");
  push("  set dead to 1");
  push('  print "YOU WALK BACK TO DAYLIGHT. FINAL SCORE: " + score');
  push("  set endplay to 1");
  push("end");
  push("if acted == 0 then");
  push('  print "I DON\'T UNDERSTAND. (TWO WORDS — HELP LISTS THEM.)"');
  push("end");
  push("else");
  // dead or done: the teletype only listens for a fresh cave
  push('if upper(answer()) == "RESTART" then');
  push("  clear");
  setup("  ");
  push('  print "A FRESH CAVE, A FRESH LANTERN, THE SAME FIVE TREASURES."');
  push("  set look to 1");
  push("else");
  push('  print "THE PLAY IS OVER — TYPE RESTART FOR A FRESH CAVE."');
  push("end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildEchocaveExample() {
  return {
    title: "Echo Cave (1976 style)",
    objects: [
      // the arcade-screen card; the teletype hides them in play
      {
        id: "ec_t1", name: "title1", type: "text",
        x: 240, y: 150, size: 34, color: "#8dffa9", glow: 14, visible: 1,
        text: "ECHO CAVE", script: []
      },
      {
        id: "ec_t2", name: "title2", type: "text",
        x: 240, y: 195, size: 12, color: "#7a8894", glow: 4, visible: 1,
        text: "A TEXT ADVENTURE · 1976 STYLE · TYPE TWO WORDS", script: []
      },
      {
        id: "ec_brain", name: "teletype", type: "text",
        x: -50, y: -50, size: 1, color: "#000000", glow: 0, visible: 0, text: "",
        script: [{ event: "code", source: brainCode() }]
      }
    ]
  };
}

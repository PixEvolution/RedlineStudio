// example-undervault.js — UNDERVAULT, an ORIGINAL text adventure, 1977 style.
//
// 1977: hackers at MIT raised the text adventure's bar — a parser with manners
// and a sense of humor, a dungeon that fought back, treasures displayed in a
// case, a lamp you had to BUDGET. That lineage became a commercial giant. But
// like Echo Cave: a text game IS its prose, and that prose belongs to its
// authors — so this is not a recreation of anything. It's our own vault,
// built to teach the 1977 TRICKS as mechanics:
//
//   · a SMARTER PARSER — "TAKE THE OLD LAMP" works (articles and adjectives
//     are skipped), "GET ALL" grabs a whole room, and wrong words get wit
//   · a LAMP WITH A BATTERY — it only burns while lit, so darkness is a
//     budget, not a switch
//   · a THIEF — he walks the vault while you do, and if he crosses your
//     path he lifts a treasure and melts away; his den holds everything he's
//     ever taken, and a SWORD settles the matter for good
//   · a TROPHY CASE — treasures only score once they're IN it: 5 × 50,
//     plus 50 for the full set. 300 is a perfect game.
//
//   TYPE IT: GO NORTH (or N) · TAKE ALL · LIGHT LAMP · ATTACK THIEF · HELP

const NROOMS = 15, NITEMS = 8;
// items: 0 LAMP · 1 SWORD · 2 ROPE · treasures 3..7:
// COINS(mint) PAINTING(gallery) CHALICE(crypt) SCEPTER(throne) EMERALD(vault)
// (loc 99 = carried, 0 = gone/banked)
const ITEM_START = [2, 3, 2, 5, 6, 7, 9, 13];
const CARRIED = 99, TREASURE0 = 3, NTREASURE = 5;
const BATT_FULL = 60;                            // lit moves before the lamp dies
const EXITS = [
  /* 1 meadow    */[0, 0, 2, 0, 0, 4],   // D gated by the rope
  /* 2 towerhall */[0, 0, 0, 1, 3, 0],
  /* 3 towertop  */[0, 0, 0, 0, 0, 2],
  /* 4 wellbottom*/[5, 0, 12, 0, 1, 0],  // U gated by the rope
  /* 5 mint      */[0, 4, 6, 0, 0, 0],
  /* 6 gallery   */[0, 7, 9, 5, 0, 0],
  /* 7 crypt     */[6, 0, 8, 0, 0, 0],
  /* 8 stair     */[0, 0, 10, 7, 15, 0],
  /* 9 throne    */[0, 10, 0, 6, 0, 0],
  /* 10 roots    */[9, 0, 11, 8, 0, 0],
  /* 11 den      */[0, 0, 0, 10, 0, 0],
  /* 12 tunnels  */[0, 14, 13, 4, 0, 0],
  /* 13 vault    */[0, 0, 0, 12, 0, 0],
  /* 14 pool     */[12, 0, 0, 15, 0, 0],
  /* 15 collapsed*/[0, 0, 14, 0, 0, 8]
];
const DARK_FROM = 4, DEN = 11;

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const setup = (pad) => {
    push(`${pad}set pos to 1`);
    push(`${pad}set score to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set lit to 0`);
    push(`${pad}set batt to ${BATT_FULL}`);
    push(`${pad}set roped to 0`);
    push(`${pad}set thiefat to ${DEN}`);
    push(`${pad}set thiefup to 1`);
    push(`${pad}set darksteps to 0`);
    push(`${pad}set banked to 0`);
    push(`${pad}set dead to 0`);
    push(`${pad}set sass to 0`);
    for (let k = 0; k < NITEMS; k++) push(`${pad}set iloc[${k}] to ${ITEM_START[k]}`);
    for (let r = 0; r < NROOMS; r++) for (let d = 0; d < 6; d++)
      push(`${pad}set ex[${r * 6 + d}] to ${EXITS[r][d]}`);
  };

  const inDark = `pos >= ${DARK_FROM} and (iloc[0] != ${CARRIED} or lit == 0)`;

  push("when start");
  push("set title1.visible to 0");
  push("set title2.visible to 0");
  setup("");
  push('print "UNDERVAULT"');
  push('print "AN ORIGINAL TEXT ADVENTURE IN THE 1977 STYLE"');
  push('print "FULL SENTENCES WELCOME: TAKE THE OLD LAMP · GET ALL · HELP"');
  push('print ""');
  push("set look to 1");
  push("end");

  // ---- the room reporter
  push("when tick");
  push("if look == 1 then");
  push("  set look to 0");
  push(`  if ${inDark} then`);
  push('    print "DARKNESS, TOTAL AND PATIENT. SOMETHING IN IT SOUNDS HUNGRY."');
  push("  else");
  const room = (n, lines) => {
    push(`  if pos == ${n} then`);
    for (const t of lines) push(`    print "${t}"`);
    push("  end");
  };
  room(1, ["A WIND-FLATTENED MEADOW. A RUINED WATCHTOWER STANDS EAST,",
           "AND AN OLD WELL DROPS STRAIGHT DOWN INTO NOTHING."]);
  room(2, ["THE WATCHTOWER HALL. AGAINST THE WALL STANDS A GLASS",
           "TROPHY CASE, DUSTED AND WAITING. STAIRS CLIMB UP."]);
  room(3, ["THE TOWER TOP. FROM HERE THE MEADOW LOOKS SMALL AND THE",
           "WELL LOOKS LIKE AN EYE."]);
  room(4, ["THE BOTTOM OF THE WELL. PASSAGES RUN NORTH AND EAST,",
           "AND THE ROPE CLIMBS BACK TO DAYLIGHT."]);
  room(5, ["AN OLD MINT. THE PRESSES RUSTED MID-STRIKE."]);
  room(6, ["A LONG GALLERY. YOUR FOOTSTEPS COME BACK WRONG."]);
  room(7, ["A FLOODED CRYPT. THE WATER IS ANKLE-DEEP AND VERY STILL."]);
  room(8, ["A BROKEN STAIR, HALF-SWALLOWED BY THE HILL. IT CLIMBS UP",
           "TOWARD COLD AIR AND RUNS EAST INTO ROOTS."]);
  room(9, ["A THRONE ROOM FOR SOMEBODY LONG PAST NEEDING ONE."]);
  room(10, ["A HALL OF ROOTS — THE FOREST ABOVE, REACHING DOWN."]);
  room(11, ["A LOW DEN BEHIND THE ROOTS. BONES, RAGS, AND A NEAT",
            "LITTLE HOARD. SOMEBODY TIDY LIVES HERE."]);
  room(12, ["CRAMPED TUNNELS. PICK MARKS IN THE STONE, CENTURIES OLD."]);
  room(13, ["A COBWEBBED VAULT. THE WEBS ARE OLD. PROBABLY OLD."]);
  room(14, ["A DEEP POOL, BLACK AS THE DARK ITSELF."]);
  room(15, ["A COLLAPSED HALL. THE CEILING GAVE UP GENERATIONS AGO."]);
  // standing furniture
  push("  if pos == 1 then");
  push("    if roped == 1 then");
  push('      print "YOUR ROPE IS TIED TO THE WELL HEAD, HANGING DOWN."');
  push("    else");
  push('      print "THE WELL HAS NO ROPE. A STURDY ONE WOULD REACH."');
  push("    end");
  push("  end");
  push("  if pos == 2 then");
  push('    print "THE CASE HOLDS " + banked + " OF 5 TREASURES."');
  push("  end");
  push("  if pos == thiefat and thiefup == 1 then");
  push('    print "A THIN FIGURE WATCHES YOU FROM THE SHADOWS, SMILING."');
  push("  end");
  // what lies about
  push("  set i to 0");
  push(`  repeat ${NITEMS}`);
  push("    if iloc[i] == pos then");
  const itemLine = [
    "A BRASS LAMP SITS HERE, DENTED BUT WILLING.",
    "AN OLD SWORD LEANS HERE, STILL PROUD.",
    "A COIL OF STURDY ROPE LIES HERE.",
    "A SACK OF ANCIENT COINS SPILLS HERE!",
    "A SMALL OIL PAINTING HANGS CROOKED HERE!",
    "A SILVER CHALICE GLEAMS HERE!",
    "A JEWELED SCEPTER LIES ACROSS THE THRONE!",
    "AN EMERALD THE SIZE OF A FIST GLOWS HERE!"
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

  // ---- the parser
  push("when answer");
  push("if dead == 0 then");
  push("set a to upper(answer())");
  push("set v to word(a, 1)");
  push("set n to word(a, 2)");
  push("set n3 to word(a, 3)");
  // the 1977 trick: articles and adjectives step aside — TAKE THE OLD LAMP
  // two skip passes, SAME list both times: "TAKE THE OLD LAMP" sheds
  // "THE" then "OLD" and lands on the noun
  push('if (n == "THE" or n == "A" or n == "AN" or n == "OLD" or n == "BRASS" or n == "SILVER" or n == "JEWELED" or n == "ANCIENT" or n == "STURDY" or n == "SMALL" or n == "OIL" or n == "MY") and n3 != "" then');
  push("  set n to n3");
  push("  set n3 to word(a, 4)");
  push('  if (n == "THE" or n == "A" or n == "AN" or n == "OLD" or n == "BRASS" or n == "SILVER" or n == "JEWELED" or n == "ANCIENT" or n == "STURDY" or n == "SMALL" or n == "OIL" or n == "MY") and n3 != "" then');
  push("    set n to n3");
  push("  end");
  push("end");
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
  push("set moved to 0");

  // ---------------- movement
  push("if dir >= 0 then");
  push("  set acted to 1");
  push("  set dest to ex[(pos - 1) * 6 + dir]");
  push("  if pos == 1 and dir == 5 and roped == 0 then");
  push("    set dest to 0");
  push('    print "THE WELL IS A LONG, DARK NO. YOU\'D WANT A ROPE TIED HERE."');
  push("  end");
  push("  if pos == 4 and dir == 4 and roped == 0 then");
  push("    set dest to 0");
  push('    print "THE SHAFT IS SHEER. NO ROPE, NO CLIMB."');
  push("  end");
  push("  if dest == 0 then");
  push('    print "YOU CAN\'T GO THAT WAY."');
  push("  else");
  push("    set pos to dest");
  push("    set moved to 1");
  // the lamp burns only while burning — and only while you MOVE
  push(`    if lit == 1 and iloc[0] == ${CARRIED} then`);
  push("      set batt to batt - 1");
  push("      if batt == 15 then");
  push('        print "(THE LAMP IS BROWNING OUT — 15 MOVES OF LIGHT LEFT.)"');
  push("      end");
  push("      if batt == 5 then");
  push('        print "(THE LAMP GUTTERS. FIVE MOVES, MAYBE.)"');
  push("      end");
  push("      if batt <= 0 then");
  push("        set lit to 0");
  push('        print "THE LAMP DIES WITHOUT APOLOGY."');
  push("      end");
  push("    end");
  push(`    if ${inDark} then`);
  push("      set darksteps to darksteps + 1");
  push("      if darksteps > 1 and rand(0, 100) < 40 then");
  push("        set dead to 1");
  push('        print "THE HUNGRY SOUND FINDS YOU. IT WAS CLOSER THAN IT SOUNDED."');
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

  // ---------------- GET / TAKE (and TAKE ALL)
  const nouns = [
    ["LAMP", "LANTERN"], ["SWORD", "BLADE"], ["ROPE", "COIL"],
    ["COINS", "SACK"], ["PAINTING", "ART"], ["CHALICE", "CUP"], ["SCEPTER", "SCEPTRE"], ["EMERALD", "GEM"]
  ];
  const findNoun = (pad) => {
    push(`${pad}set found to 0 - 1`);
    nouns.forEach((names, k) => {
      push(`${pad}if n == "${names[0]}" or n == "${names[1]}" then`);
      push(`${pad}  set found to ${k}`);
      push(`${pad}end`);
    });
  };
  push('if v == "GET" or v == "TAKE" or v == "GRAB" then');
  push("  set acted to 1");
  push('  if n == "ALL" or n == "EVERYTHING" then');
  push("    set got to 0");
  push("    set i to 0");
  push(`    repeat ${NITEMS}`);
  push("      if iloc[i] == pos then");
  push(`        set iloc[i] to ${CARRIED}`);
  push("        set got to got + 1");
  push("      end");
  push("      set i to i + 1");
  push("    end");
  push("    if got == 0 then");
  push('      print "THERE IS NOTHING HERE WORTH YOUR POCKETS."');
  push("    else");
  push("      if got == 1 then");
  push('        print "TAKEN: THE ONE THING HERE."');
  push("      else");
  push('        print "TAKEN, ALL " + got + " OF THEM."');
  push("      end");
  push("    end");
  push("  else");
  findNoun("    ");
  push("    if found < 0 then");
  push('      print "I SEE NO SUCH THING HERE."');
  push("    else");
  push(`      if iloc[found] == ${CARRIED} then`);
  push('        print "YOU ALREADY HAVE IT. GREED IS A LADDER, NOT A LOOP."');
  push("      else");
  push("        if iloc[found] != pos then");
  push('          print "I SEE NO SUCH THING HERE."');
  push("        else");
  push(`          set iloc[found] to ${CARRIED}`);
  push('          print "TAKEN."');
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("  set moved to 1");
  push("end");

  // ---------------- DROP / PUT — the trophy case banks treasure
  push('if v == "DROP" or v == "PUT" or v == "PLACE" or v == "LEAVE" then');
  push("  set acted to 1");
  findNoun("  ");
  push(`  if found < 0 or iloc[found] != ${CARRIED} then`);
  push('    print "YOU\'RE NOT CARRYING THAT."');
  push("  else");
  push("    set iloc[found] to pos");
  push(`    if pos == 2 and found >= ${TREASURE0} then`);
  push("      set iloc[found] to 0");
  push("      set banked to banked + 1");
  push("      set score to banked * 50");
  push('      print "IT GOES IN THE CASE. THE GLASS APPROVES. SCORE: " + score');
  push(`      if banked == ${NTREASURE} then`);
  push("        set score to score + 50");
  push('        print ""');
  push('        print "THE CASE IS FULL — ALL FIVE, AND A 50-POINT FLOURISH: 300."');
  push('        print "THE UNDERVAULT IS EMPTY AND YOU ARE NOT. PERFECT GAME."');
  push("        set endplay to 1");
  push("        set dead to 1");
  push("      end");
  push("    else");
  push('      print "DROPPED."');
  push("    end");
  push("  end");
  push("  set moved to 1");
  push("end");

  // ---------------- the rope
  push('if v == "TIE" then');
  push("  set acted to 1");
  push(`  if pos == 1 and iloc[2] == ${CARRIED} then`);
  push("    set roped to 1");
  push("    set iloc[2] to 0");
  push('    print "YOU TIE THE ROPE TO THE WELL HEAD AND DROP THE COIL IN."');
  push("  else");
  push('    print "NOTHING HERE WANTS TYING."');
  push("  end");
  push("end");

  // ---------------- the lamp
  push('if v == "LIGHT" or v == "ON" then');
  push("  set acted to 1");
  push(`  if iloc[0] == ${CARRIED} then`);
  push("    if batt <= 0 then");
  push('      print "THE LAMP IS DEAD. IT HAD A GOOD RUN."');
  push("    else");
  push("      set lit to 1");
  push("      set darksteps to 0");
  push('      print "THE LAMP TAKES. LIGHT, WHILE IT LASTS — " + batt + " MOVES OF IT."');
  push("      set look to 1");
  push("    end");
  push("  else");
  push('    print "YOU HAVE NOTHING TO LIGHT."');
  push("  end");
  push("end");
  push('if v == "OFF" or v == "DOUSE" then');
  push("  set acted to 1");
  push("  set lit to 0");
  push('  print "DARK. THE BATTERY THANKS YOU."');
  push("end");

  // ---------------- the thief, and the sword that ends him
  push('if v == "ATTACK" or v == "KILL" or v == "HIT" or v == "FIGHT" then');
  push("  set acted to 1");
  push("  if thiefup == 1 and thiefat == pos then");
  push(`    if iloc[1] == ${CARRIED} then`);
  push("      set thiefup to 0");
  push('      print "ONE CLEAN STROKE. THE FIGURE FOLDS INTO ITS RAGS AND IS GONE."');
  push('      print "WHATEVER HE EVER TOOK IS LYING IN HIS DEN NOW, UNGUARDED."');
  push("    else");
  push('      print "WITH WHAT — YOUR MANNERS? HE LAUGHS AND IS ELSEWHERE."');
  push(`      set thiefat to floor(rand(${DARK_FROM}, ${NROOMS + 1}))`);
  push("    end");
  push("  else");
  push('    print "THERE IS NOTHING HERE TO FIGHT BUT THE QUIET."');
  push("  end");
  push("end");

  // ---------------- housekeeping
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
  const invName = ["A BRASS LAMP", "AN OLD SWORD", "A COIL OF ROPE",
    "A SACK OF COINS", "A SMALL PAINTING", "A SILVER CHALICE", "A JEWELED SCEPTER", "AN EMERALD"];
  invName.forEach((t, k) => {
    push(`      if i == ${k} then`);
    push(`        print "  ${t}"`);
    push("      end");
  });
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push("  if any == 0 then");
  push('    print "  POCKETS FULL OF NOTHING."');
  push("  end");
  push("end");
  push('if v == "SCORE" then');
  push("  set acted to 1");
  push('  print "SCORE: " + score + " OF 300 (50 A TREASURE, CASED, PLUS 50 FOR THE SET)"');
  push("end");
  push('if v == "HELP" then');
  push("  set acted to 1");
  push('  print "GO NORTH (OR N/S/E/W/U/D) · TAKE THING · TAKE ALL · DROP THING ·"');
  push('  print "TIE ROPE · LIGHT LAMP · OFF · ATTACK THIEF · LOOK · INV · SCORE ·"');
  push('  print "QUIT. ARTICLES ARE FINE: TAKE THE OLD LAMP WORKS. MIND THE BATTERY."');
  push("end");
  push('if v == "QUIT" then');
  push("  set acted to 1");
  push("  set dead to 1");
  push('  print "YOU CLIMB BACK TO THE MEADOW AND THE ORDINARY SUN. SCORE: " + score');
  push("  set endplay to 1");
  push("end");
  // the sass rotation — 1977 parsers had OPINIONS
  push("if acted == 0 then");
  push("  set sass to sass % 3 + 1");
  push("  if sass == 1 then");
  push('    print "I DON\'T KNOW THAT WORD, AND I KNOW PLENTY."');
  push("  else");
  push("    if sass == 2 then");
  push('      print "TRY TWO WORDS. I\'M CLEVER, NOT PSYCHIC."');
  push("    else");
  push('      print "THAT SENTENCE PUT UP A FIGHT AND WON."');
  push("    end");
  push("  end");
  push("end");

  // ---------------- the thief takes his turn whenever you take yours
  push("if moved == 1 and thiefup == 1 and dead == 0 then");
  push(`  set thiefat to floor(rand(${DARK_FROM}, ${NROOMS + 1}))`);
  push("  if thiefat == pos then");
  // he lifts the first treasure you're carrying — to the den it goes
  push("    set stole to 0 - 1");
  push("    set i to 7");
  push(`    repeat ${NITEMS - TREASURE0}`);
  push(`      if iloc[i] == ${CARRIED} then`);
  push("        set stole to i");
  push("      end");
  push("      set i to i - 1");
  push("    end");
  push("    if stole >= 0 then");
  push(`      set iloc[stole] to ${DEN}`);
  push('      print "A THIN HAND BRUSHES YOUR PACK — AND A TREASURE IS GONE,"');
  push('      print "ALONG WITH ITS NEW OWNER. HIS DEN MUST BE AROUND SOMEWHERE."');
  push(`      set thiefat to ${DEN}`);
  push("    end");
  push("  end");
  push("end");

  push("else");
  // dead or done
  push('if upper(answer()) == "RESTART" then');
  push("  clear");
  setup("  ");
  push('  print "A FRESH MEADOW, A FULL BATTERY, THE SAME FIVE TREASURES."');
  push("  set look to 1");
  push("else");
  push('  print "THE PLAY IS OVER — TYPE RESTART FOR A FRESH VAULT."');
  push("end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildUndervaultExample() {
  return {
    title: "Undervault (1977 style)",
    objects: [
      {
        id: "uv_t1", name: "title1", type: "text",
        x: 240, y: 150, size: 34, color: "#8dffa9", glow: 14, visible: 1,
        text: "UNDERVAULT", script: []
      },
      {
        id: "uv_t2", name: "title2", type: "text",
        x: 240, y: 195, size: 12, color: "#7a8894", glow: 4, visible: 1,
        text: "A TEXT ADVENTURE · 1977 STYLE · MIND THE BATTERY", script: []
      },
      {
        id: "uv_brain", name: "teletype", type: "text",
        x: -50, y: -50, size: 1, color: "#000000", glow: 0, visible: 0, text: "",
        script: [{ event: "code", source: brainCode() }]
      }
    ]
  };
}

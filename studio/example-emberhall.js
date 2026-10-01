// example-emberhall.js — EMBERHALL, an ORIGINAL text adventure, 1980 style.
//
// 1980: the MIT mainframe adventure was packed into a product, sold in
// stores, and text adventures became a BUSINESS. What the commercial
// release added was polish you could feel: a parser that understood
// "PUT THE COIN IN THE CASE", containers with things inside them,
// machines that transformed one object into another, and a RANK for your
// score — so finishing felt like a career, not a walkthrough. But a text
// game IS its prose, and that prose belongs to its authors — so like Echo
// Cave and Undervault, this is OUR OWN house, built to teach the 1980
// tricks as mechanics:
//
//   · PUT X IN Y — the two-object parser: oil goes in the lamp, sand
//     goes in the kiln, and treasures go in the display case
//   · a CONTAINER — the study's box must be OPENED to give up its key
//   · a TRANSFORMER — the kiln turns fine sand into a glass rose
//   · a LOCK — the vault opens for the key and nothing else
//   · the LEDGER — six treasures score once when TAKEN and again when
//     CASED: 180 + 180 + 40 for the full set. 400 is a perfect game.
//   · and a RANK at every SCORE check: VISITOR to MASTER OF EMBERHALL
//
//   TYPE IT: GO NORTH (or N) · TAKE ALL · PUT OIL IN LAMP · SCORE · HELP

const NROOMS = 13, NITEMS = 12;
const CARRIED = 99, CASED = 98, GONE = 0;
// items: 0 LAMP · 1 OIL · 2 SAND · 3 BOX(fixed) · 4 KEY(hidden) · 5 BOOK
// treasures 6..11: BEAD FIGURINE HARP RING CROWN ROSE(hidden until kilned)
const ITEM_START = [2, 5, 9, 6, 0, 4, 7, 8, 13, 12, 12, 0];
const TREASURE0 = 6, NTREASURE = 6;
const TVALS = [15, 20, 30, 25, 40, 50];
const EXITS = [
  /* 1 foyer    */[2, 0, 0, 0, 0, 0],
  /* 2 greathall*/[4, 1, 5, 3, 0, 9],
  /* 3 gallery  */[0, 0, 2, 13, 0, 0],
  /* 4 library  */[11, 2, 6, 0, 0, 0],
  /* 5 kitchen  */[7, 0, 0, 2, 0, 0],
  /* 6 study    */[0, 0, 0, 4, 0, 0],
  /* 7 garden   */[0, 5, 8, 0, 0, 0],
  /* 8 tower    */[0, 0, 0, 7, 0, 0],
  /* 9 cellar   */[10, 0, 0, 0, 2, 0],
  /* 10 kilnroom*/[0, 9, 0, 0, 0, 0],
  /* 11 anteroom*/[12, 4, 0, 0, 0, 0],   // N gated by the vault door
  /* 12 vault   */[0, 11, 0, 0, 0, 0],
  /* 13 music   */[0, 0, 3, 0, 0, 0]
];
const DARKROOMS = [9, 10];

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const setup = (pad) => {
    push(`${pad}set pos to 1`);
    push(`${pad}set score to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set oiled to 0`);
    push(`${pad}set lit to 0`);
    push(`${pad}set boxopen to 0`);
    push(`${pad}set vaultopen to 0`);
    push(`${pad}set kilned to 0`);
    push(`${pad}set ncase to 0`);
    push(`${pad}set sass to 0`);
    for (let k = 0; k < NITEMS; k++) push(`${pad}set iloc[${k}] to ${ITEM_START[k]}`);
    for (let t = 0; t < NTREASURE; t++) {
      push(`${pad}set tf[${TREASURE0 + t}] to 0`);
      push(`${pad}set val[${TREASURE0 + t}] to ${TVALS[t]}`);
    }
    for (let r = 0; r < NROOMS; r++) for (let d = 0; d < 6; d++)
      push(`${pad}set ex[${r * 6 + d}] to ${EXITS[r][d]}`);
  };

  const rankChain = (pad) => {
    push(`${pad}set rk to "VISITOR"`);
    push(`${pad}if score >= 100 then`);
    push(`${pad}  set rk to "COLLECTOR"`);
    push(`${pad}end`);
    push(`${pad}if score >= 200 then`);
    push(`${pad}  set rk to "CURATOR"`);
    push(`${pad}end`);
    push(`${pad}if score >= 300 then`);
    push(`${pad}  set rk to "KEEPER"`);
    push(`${pad}end`);
    push(`${pad}if score >= 400 then`);
    push(`${pad}  set rk to "MASTER OF EMBERHALL"`);
    push(`${pad}end`);
  };

  push("when start");
  push("set title1.visible to 0");
  push("set title2.visible to 0");
  setup("");
  push('print "EMBERHALL"');
  push('print "AN ORIGINAL TEXT ADVENTURE IN THE 1980 STYLE"');
  push('print "TWO OBJECTS WELCOME: PUT THE OIL IN THE LAMP · TAKE ALL · HELP"');
  push('print ""');
  push("set look to 1");
  push("end");

  // ---- the room reporter
  push("when tick");
  push("if look == 1 then");
  push("  set look to 0");
  const room = (n, lines) => {
    push(`  if pos == ${n} then`);
    for (const t of lines) push(`    print "${t}"`);
    push("  end");
  };
  room(1, ["THE FOYER OF EMBERHALL. DUST HOLDS THE SHAPE OF OLD FOOTSTEPS.",
           "THE GREAT HALL OPENS NORTH."]);
  room(2, ["THE GREAT HALL. DOORWAYS RUN EVERY WAY: GALLERY WEST, KITCHEN",
           "EAST, LIBRARY NORTH, FOYER SOUTH — AND STAIRS SINK DOWN."]);
  room(3, ["THE GALLERY. ONE GLASS DISPLAY CASE STANDS POLISHED AND EMPTY-",
           "PROUD, WITH SIX FITTED VELVET HOLLOWS. MUSIC ROOM WEST."]);
  room(4, ["THE LIBRARY. SHELVES TO THE CEILING, LADDERS LONG GONE.",
           "THE STUDY IS EAST; A COLD ANTEROOM WAITS NORTH."]);
  room(5, ["THE KITCHEN. COPPER PANS GONE GREEN. A DOOR OPENS NORTH",
           "TO THE GARDEN."]);
  room(6, ["THE STUDY. A WRITING DESK WITH A SMALL WOODEN BOX BUILT",
           "INTO ITS TOP."]);
  room(7, ["AN OVERGROWN WALLED GARDEN. THE HEDGES HAVE OPINIONS NOW.",
           "A TOWER DOOR STANDS EAST."]);
  room(8, ["THE TOWER ROOM. ROUND, COLD, AND HIGHER THAN IT LOOKS."]);
  room(9, ["THE CELLAR. BARRELS, COBWEBS, AND A HEAP OF FINE WHITE SAND",
           "BY THE NORTH ARCH."]);
  room(10, ["THE KILN ROOM. THE OLD GLASS KILN STILL BREATHES HEAT,",
            "BANKED AND PATIENT ALL THESE YEARS."]);
  room(11, ["A BARE ANTEROOM. THE NORTH WALL IS ONE IRON VAULT DOOR,",
            "WITH A KEYHOLE POLISHED BY WORRY."]);
  room(12, ["INSIDE THE VAULT. SHELVES OF EMPTY STRONGBOXES — ALMOST."]);
  room(13, ["THE MUSIC ROOM. A DENT IN THE CARPET REMEMBERS A PIANO."]);
  // standing furniture
  push("  if pos == 3 then");
  push('    print "THE CASE HOLDS " + ncase + " OF 6 TREASURES."');
  push("  end");
  push("  if pos == 11 then");
  push("    if vaultopen == 1 then");
  push('      print "THE VAULT DOOR STANDS OPEN."');
  push("    else");
  push('      print "THE VAULT DOOR IS LOCKED."');
  push("    end");
  push("  end");
  push("  if pos == 6 and boxopen == 0 then");
  push('    print "THE BOX IS SHUT."');
  push("  end");
  // what lies about
  push("  set i to 0");
  push(`  repeat ${NITEMS}`);
  push("    if iloc[i] == pos then");
  const itemLine = [
    "A BRASS LAMP SITS HERE, WICK DRY AS A SERMON.",
    "A STOPPERED FLASK OF LAMP OIL STANDS HERE.",
    "A HEAP OF FINE WHITE SAND IS PILED HERE.",
    "",   // the box is furniture; the room text carries it
    "A SMALL IRON KEY LIES IN THE OPEN BOX.",
    "A LEATHER-BOUND BOOK LIES HERE: THE GLASSMAKER'S ART.",
    "AN AMBER BEAD CATCHES WHAT LIGHT THERE IS!",
    "A JET FIGURINE OF A SLEEPING CAT SITS HERE!",
    "A GILDED HARP LEANS IN THE CORNER, MISSING NOTHING!",
    "AN OPAL RING RESTS ON A SHELF!",
    "AN IRON CROWN — PLAIN, HEAVY, AND SOMEHOW LOUD!",
    "A GLASS ROSE COOLS ON THE KILN'S LIP, PERFECT!"
  ];
  itemLine.forEach((t, k) => {
    if (!t) return;
    push(`      if i == ${k} then`);
    push(`        print "${t}"`);
    push("      end");
  });
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push("end");
  push("end");

  // ---- the parser
  push("when answer");
  push("set a to upper(answer())");
  push("set v to word(a, 1)");
  // 1980 manners: collect the words that MATTER, shedding articles and
  // adjectives — so PUT THE AMBER BEAD IN THE DISPLAY CASE parses clean
  push("set n to \"\"");
  push("set n2 to \"\"");
  push("set n4 to \"\"");
  push("set sl to 0");
  push("set wi to 2");
  push("repeat 7");
  push("  set ww to word(a, wi)");
  const SKIP = ["THE", "A", "AN", "MY", "OLD", "BRASS", "GLASS", "DISPLAY", "FINE", "WHITE",
    "SMALL", "IRON", "WOODEN", "AMBER", "JET", "GILDED", "OPAL", "LEATHER", "LAMP2"];
  const skipCond = SKIP.filter(s => s !== "LAMP2").map(s => `ww != "${s}"`).join(" and ");
  push(`  if ww != "" and ${skipCond} then`);
  push("    set sl to sl + 1");
  push("    if sl == 1 then");
  push("      set n to ww");
  push("    end");
  push("    if sl == 2 then");
  push("      set n2 to ww");
  push("    end");
  push("    if sl == 3 then");
  push("      set n4 to ww");
  push("    end");
  push("  end");
  push("  set wi to wi + 1");
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

  // which item does a noun name? (emitted twice: for n and for n4)
  const matchItem = (src, out) => {
    push(`set ${out} to 0 - 1`);
    const names = [
      ['"LAMP"', '"LANTERN"'], ['"OIL"', '"FLASK"'], ['"SAND"'], ['"BOX"'],
      ['"KEY"'], ['"BOOK"'], ['"BEAD"'], ['"FIGURINE"', '"CAT"', '"STATUE"'],
      ['"HARP"'], ['"RING"'], ['"CROWN"'], ['"ROSE"']
    ];
    names.forEach((alts, k) => {
      push(`if ${alts.map(x => `${src} == ${x}`).join(" or ")} then`);
      push(`  set ${out} to ${k}`);
      push("end");
    });
  };

  // ---------------- movement (the dark stops you at the stairhead)
  push("if dir >= 0 then");
  push("  set acted to 1");
  push("  set dest to ex[(pos - 1) * 6 + dir]");
  push("  if pos == 11 and dir == 0 and vaultopen == 0 then");
  push("    set dest to 0");
  push('    print "THE VAULT DOOR IS LOCKED. IT WANTS A KEY, NOT A SHOULDER."');
  push("  end");
  push("  if dest == 0 then");
  push('    print "YOU CAN\'T GO THAT WAY."');
  push("  else");
  push(`    if (dest == ${DARKROOMS[0]} or dest == ${DARKROOMS[1]}) and (iloc[0] != ${CARRIED} or lit == 0) then`);
  push('      print "IT IS PITCH DARK THAT WAY. YOU STEP BACK FROM THE EDGE."');
  push('      print "(A LIT LAMP WOULD CHANGE THE CONVERSATION.)"');
  push("    else");
  push("      set pos to dest");
  push("      set look to 1");
  push("    end");
  push("  end");
  push("end");

  // ---------------- LOOK
  push('if v == "LOOK" or v == "L" then');
  push("  set acted to 1");
  push("  set look to 1");
  push("end");

  // ---------------- TAKE / GET (and TAKE ALL)
  push('if v == "TAKE" or v == "GET" or v == "GRAB" then');
  push("  set acted to 1");
  push('  if n == "ALL" or n == "EVERYTHING" then');
  push("    set got to 0");
  push("    set i to 0");
  push(`    repeat ${NITEMS}`);
  push("    if iloc[i] == pos and i != 3 then");
  push("        set got to got + 1");
  push(`        set iloc[i] to ${CARRIED}`);
  push(`        if i >= ${TREASURE0} and tf[i] == 0 then`);
  push("          set tf[i] to 1");
  push("          change score by val[i]");
  push("        end");
  push("      end");
  push("      set i to i + 1");
  push("    end");
  push("    if got == 0 then");
  push('      print "NOTHING HERE WANTS CARRYING."');
  push("    else");
  push('      print "TAKEN: " + got + " THING(S). YOUR POCKETS APPROVE."');
  push("    end");
  push("  else");
  matchItem("n", "it");
  push("    if it < 0 then");
  push('      print "TAKE WHAT, EXACTLY?"');
  push("    else");
  push("      if it == 3 then");
  push('        print "THE BOX IS BUILT INTO THE DESK. THE DESK DISAGREES."');
  push("      else");
  push("        if iloc[it] == pos then");
  push(`          set iloc[it] to ${CARRIED}`);
  push(`          if it >= ${TREASURE0} and tf[it] == 0 then`);
  push("            set tf[it] to 1");
  push("            change score by val[it]");
  push("          end");
  push('          print "TAKEN."');
  push("        else");
  push(`          if iloc[it] == ${CARRIED} then`);
  push('            print "YOU ALREADY HAVE IT."');
  push("          else");
  push('            print "YOU DON\'T SEE THAT HERE."');
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("end");

  // ---------------- DROP
  push('if v == "DROP" or v == "LEAVE" then');
  push("  set acted to 1");
  matchItem("n", "it");
  push(`  if it >= 0 and iloc[it] == ${CARRIED} then`);
  push("    set iloc[it] to pos");
  push('    print "DROPPED."');
  push("  else");
  push('    print "YOU AREN\'T CARRYING THAT."');
  push("  end");
  push("end");

  // ---------------- OPEN (the container, and the vault's polite refusal)
  push('if v == "OPEN" then');
  push("  set acted to 1");
  push('  if n == "BOX" then');
  push("    if pos == 6 then");
  push("      if boxopen == 1 then");
  push('        print "THE BOX IS ALREADY OPEN."');
  push("      else");
  push("        set boxopen to 1");
  push("        set iloc[4] to 6");
  push('        print "THE LID LIFTS ON STIFF HINGES. INSIDE: A SMALL IRON KEY."');
  push("      end");
  push("    else");
  push('      print "THERE\'S NO BOX HERE."');
  push("    end");
  push("  else");
  push('    if n == "VAULT" or n == "DOOR" then');
  push(`      if pos == 11 and iloc[4] == ${CARRIED} and vaultopen == 0 then`);
  push("        set vaultopen to 1");
  push('        print "THE KEY TURNS. THE VAULT DOOR SWINGS WIDE, SLOW AS A SUNRISE."');
  push("      else");
  push("        if pos == 11 and vaultopen == 1 then");
  push('          print "IT STANDS OPEN."');
  push("        else");
  push('          print "LOCKED — OR NOT HERE. A KEY WOULD SETTLE IT."');
  push("        end");
  push("      end");
  push("    else");
  push('      print "THAT DOESN\'T OPEN."');
  push("    end");
  push("  end");
  push("end");
  push('if v == "UNLOCK" then');
  push("  set acted to 1");
  push(`  if pos == 11 and iloc[4] == ${CARRIED} then`);
  push("    set vaultopen to 1");
  push('    print "THE KEY TURNS. THE VAULT DOOR SWINGS WIDE, SLOW AS A SUNRISE."');
  push("  else");
  push('    print "NOTHING HERE UNLOCKS — OR YOU LACK THE KEY."');
  push("  end");
  push("end");

  // ---------------- READ / EXAMINE
  push('if v == "READ" or v == "EXAMINE" or v == "X" then');
  push("  set acted to 1");
  push('  if n == "BOOK" then');
  push(`    if iloc[5] == ${CARRIED} or iloc[5] == pos then`);
  push('      print "THE GLASSMAKER\'S ART, CHAPTER ONE: FINE SAND, GREAT HEAT,"');
  push('      print "AND PATIENCE. THE OLD KILN BELOW NEVER TRULY WENT OUT."');
  push("    else");
  push('      print "NO BOOK IN REACH."');
  push("    end");
  push("  else");
  push('    if n == "LAMP" then');
  push("      if lit == 1 then");
  push('        print "BURNING STEADY. OIL WAS ALL IT WANTED."');
  push("      else");
  push("        if oiled == 1 then");
  push('          print "OILED AND READY. IT WANTS A LIGHT."');
  push("        else");
  push('          print "THE WICK IS BONE DRY. IT WANTS OIL."');
  push("        end");
  push("      end");
  push("    else");
  push('      if n == "CASE" then');
  push('        print "SIX VELVET HOLLOWS. " + ncase + " ARE FILLED."');
  push("      else");
  push('        print "YOU STUDY IT. IT ENDURES THE ATTENTION."');
  push("      end");
  push("    end");
  push("  end");
  push("end");

  // ---------------- LIGHT
  push('if v == "LIGHT" then');
  push("  set acted to 1");
  push(`  if iloc[0] != ${CARRIED} then`);
  push('    print "YOU\'D WANT THE LAMP IN HAND FIRST."');
  push("  else");
  push("    if oiled == 0 then");
  push('      print "THE DRY WICK CATCHES, GUTTERS, AND DIES. IT NEEDS OIL."');
  push("    else");
  push("      set lit to 1");
  push('      print "THE LAMP TAKES THE FLAME AND HOLDS IT. WARM, STEADY LIGHT."');
  push("    end");
  push("  end");
  push("end");

  // ---------------- PUT X IN Y — the 1980 headline
  push('if v == "PUT" or v == "PLACE" or v == "INSERT" or v == "POUR" then');
  push("  set acted to 1");
  push('  if n2 != "IN" and n2 != "INTO" and n2 != "ON" then');
  push('    print "PUT IT IN WHAT? (TRY: PUT OIL IN LAMP)"');
  push("  else");
  matchItem("n", "it");
  push("    if it < 0 then");
  push('      print "PUT WHAT, EXACTLY?"');
  push("    else");
  push(`      if iloc[it] != ${CARRIED} then`);
  push('        print "YOU AREN\'T CARRYING THAT."');
  push("      else");
  // oil → lamp
  push(`        if it == 1 and (n4 == "LAMP" or n4 == "LANTERN") and iloc[0] == ${CARRIED} then`);
  push("          set oiled to 1");
  push(`          set iloc[1] to ${GONE}`);
  push('          print "YOU FILL THE RESERVOIR. THE FLASK GIVES ITS ALL."');
  push("        else");
  // sand → kiln
  push('          if it == 2 and n4 == "KILN" then');
  push("            if pos == 10 then");
  push("              set kilned to 1");
  push(`              set iloc[2] to ${GONE}`);
  push("              set iloc[11] to 10");
  push('              print "YOU FEED THE SAND TO THE KILN. HEAT LEANS CLOSE. WHEN THE"');
  push('              print "GLOW FADES, A GLASS ROSE COOLS ON THE LIP — PERFECT."');
  push("            else");
  push('              print "NO KILN HERE."');
  push("            end");
  push("          else");
  // treasure → case
  push(`            if it >= ${TREASURE0} and (n4 == "CASE" or n4 == "HOLLOWS") then`);
  push("              if pos == 3 then");
  push(`                set iloc[it] to ${CASED}`);
  push("                set ncase to ncase + 1");
  push("                change score by val[it]");
  push('                print "IT SETTLES INTO ITS HOLLOW LIKE IT GREW THERE. (" + ncase + "/6)"');
  push(`                if ncase == ${NTREASURE} then`);
  push("                  change score by 40");
  rankChain("                  ");
  push('                  print ""');
  push('                  print "THE SIXTH HOLLOW FILLS — AND THE CASE LIGHTS FROM WITHIN."');
  push('                  print "EMBERHALL IS CATALOGUED. FINAL SCORE: " + score + " OF 400."');
  push('                  print "RANK: " + rk');
  push("                  set endplay to 1");
  push("                end");
  push("              else");
  push('                print "THE CASE IS IN THE GALLERY."');
  push("              end");
  push("            else");
  push('              print "THAT WON\'T GO IN THERE."');
  push("            end");
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("end");

  // ---------------- INVENTORY · SCORE · HELP · RESTART
  push('if v == "INVENTORY" or v == "I" or v == "INV" then');
  push("  set acted to 1");
  push("  set got to 0");
  push("  set i to 0");
  push(`  repeat ${NITEMS}`);
  push(`    if iloc[i] == ${CARRIED} then`);
  push("      set got to got + 1");
  push("    end");
  push("    set i to i + 1");
  push("  end");
  push('  print "YOU CARRY " + got + " THING(S). SCORE " + score + "."');
  push("end");
  push('if v == "SCORE" then');
  push("  set acted to 1");
  rankChain("  ");
  push('  print "SCORE " + score + " OF 400 · RANK: " + rk');
  push("end");
  push('if v == "HELP" then');
  push("  set acted to 1");
  push('  print "VERBS: GO/N/S/E/W/U/D · TAKE (ALL) · DROP · OPEN · UNLOCK ·"');
  push('  print "READ · EXAMINE · LIGHT · PUT X IN Y · INVENTORY · SCORE"');
  push('  print "SIX TREASURES. THEY SCORE TWICE: TAKEN, THEN CASED."');
  push("end");
  push('if v == "RESTART" then');
  push("  set acted to 1");
  setup("  ");
  push('  print "EMBERHALL RESETS ITSELF, PATIENT AS EVER."');
  push("  set look to 1");
  push("end");

  // ---------------- the sass rotation
  push("if acted == 0 then");
  push("  set sass to (sass + 1) % 3");
  push("  if sass == 0 then");
  push('    print "EMBERHALL CONSIDERS \'" + v + "\' AND DECLINES."');
  push("  end");
  push("  if sass == 1 then");
  push('    print "THAT ISN\'T A THING ONE DOES HERE. (TRY HELP.)"');
  push("  end");
  push("  if sass == 2 then");
  push('    print "THE HOUSE PRETENDS NOT TO HEAR YOU."');
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildEmberhallExample() {
  return {
    title: "Emberhall (1980 style)",
    objects: [
      { id: "eh_t1", name: "title1", type: "text", x: 240, y: 150, size: 34, color: "#e8c84a", glow: 16, visible: 1, text: "EMBERHALL", script: [] },
      { id: "eh_t2", name: "title2", type: "text", x: 240, y: 182, size: 10, color: "#7a8894", glow: 4, visible: 1, text: "AN ORIGINAL TEXT ADVENTURE · 1980 STYLE · PUT X IN Y", script: [] },
      {
        id: "eh_ref", name: "referee", type: "text",
        x: 0, y: 0, size: 1, color: "#7a8894", glow: 0, visible: 0, text: "",
        script: [{ event: "code", source: brainCode() }]
      }
    ]
  };
}

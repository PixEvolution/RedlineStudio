// example-wumpus2.js — HUNT THE WUMPUS (1973), the TELETYPE ORIGINAL.
// This is the game as Gregory Yob actually shipped it: no graphics at all,
// just a conversation with a cave. You type, it prints. The prompts here are
// the real ones — "SHOOT OR MOVE (S-M)?", "WHERE TO?", "TSK TSK TSK".
//
// It's also the studio's reference TEXT ADVENTURE: everything it uses —
// print, clear, "when answer", answer(), upper() — is yours, so any player
// can build interactive fiction on the platform. The map version
// (Hunt the Wumpus — Map) is the same cave with eyes; this one is the
// original: you hunt blind, drawing the map on paper like 1973.

const ARROWS = 5, WAKE = 75;

// the canonical cave (a dodecahedron's corners) — same table as the map version
const ADJ = [
  [2, 5, 8],   [1, 3, 10],  [2, 4, 12],  [3, 5, 14],  [1, 4, 6],
  [5, 7, 15],  [6, 8, 17],  [1, 7, 9],   [8, 10, 18], [2, 9, 11],
  [10, 12, 19],[3, 11, 13], [12, 14, 20],[4, 13, 15], [6, 14, 16],
  [15, 17, 20],[7, 16, 18], [9, 17, 19], [11, 18, 20],[13, 16, 19]
];

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const setup = (pad) => {
    push(`${pad}set pos to 1`);
    push(`${pad}set arrows to ${ARROWS}`);
    push(`${pad}set mode to 1`);
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

  // the room report — printed exactly like the 1973 printout
  const report = (pad) => {
    push(`${pad}set n1 to adj[(pos - 1) * 3]`);
    push(`${pad}set n2 to adj[(pos - 1) * 3 + 1]`);
    push(`${pad}set n3 to adj[(pos - 1) * 3 + 2]`);
    push(`${pad}print ""`);
    push(`${pad}if n1 == wumpus or n2 == wumpus or n3 == wumpus then`);
    push(`${pad}  print "I SMELL A WUMPUS!"`);
    push(`${pad}end`);
    push(`${pad}if n1 == pit1 or n2 == pit1 or n3 == pit1 or n1 == pit2 or n2 == pit2 or n3 == pit2 then`);
    push(`${pad}  print "I FEEL A DRAFT"`);
    push(`${pad}end`);
    push(`${pad}if n1 == bat1 or n2 == bat1 or n3 == bat1 or n1 == bat2 or n2 == bat2 or n3 == bat2 then`);
    push(`${pad}  print "BATS NEARBY!"`);
    push(`${pad}end`);
    push(`${pad}print "YOU ARE IN ROOM " + pos`);
    push(`${pad}print "TUNNELS LEAD TO " + n1 + " " + n2 + " " + n3`);
    push(`${pad}print ""`);
    push(`${pad}print "SHOOT OR MOVE (S-M)?"`);
    push(`${pad}set mode to 1`);
  };

  const lose = (pad, cry) => {
    push(`${pad}print "${cry}"`);
    push(`${pad}print "HA HA HA - YOU LOSE!"`);
    push(`${pad}print ""`);
    push(`${pad}print "PLAY AGAIN (Y-N)?"`);
    push(`${pad}set mode to 4`);
  };

  push("when start");
  push("set title1.visible to 0");
  push("set title2.visible to 0");
  for (let n = 1; n <= 20; n++) {
    for (let k = 0; k < 3; k++) push(`set adj[${(n - 1) * 3 + k}] to ${ADJ[n - 1][k]}`);
  }
  push('print "HUNT THE WUMPUS"');
  push('print "BY GREGORY YOB, 1973"');
  setup("");
  report("");
  push("end");

  push("when answer");
  push("set a to upper(answer())");

  // mode 1: SHOOT OR MOVE
  push("if mode == 1 then");
  push('  if a == "M" then');
  push('    print "WHERE TO?"');
  push("    set mode to 2");
  push("  else");
  push('    if a == "S" then');
  push('      print "WHERE TO?"');
  push("      set mode to 3");
  push("    else");
  push('      print "SHOOT OR MOVE (S-M)?"');
  push("    end");
  push("  end");
  push("else");

  // mode 2: MOVE — walk in the dark
  push("if mode == 2 then");
  push("  if a == n1 or a == n2 or a == n3 then");
  push("    set pos to a * 1");
  push("    if pos == wumpus then");
  lose("      ", "TSK TSK TSK- WUMPUS GOT YOU!");
  push("    else");
  push("      if pos == pit1 or pos == pit2 then");
  lose("        ", "YYYIIIIEEEE . . . FELL IN PIT");
  push("      else");
  push("        if pos == bat1 or pos == bat2 then");
  push('          print "ZAP--SUPER BAT SNATCH! ELSEWHEREVILLE FOR YOU!"');
  push("          set pos to floor(rand(1, 21))");
  push("        end");
  push("        if pos == wumpus then");
  lose("          ", "TSK TSK TSK- WUMPUS GOT YOU!");
  push("        else");
  push("          if pos == pit1 or pos == pit2 then");
  lose("            ", "YYYIIIIEEEE . . . FELL IN PIT");
  push("          else");
  report("            ");
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("  else");
  push('    print "NOT POSSIBLE - TUNNELS LEAD TO " + n1 + " " + n2 + " " + n3');
  push('    print "WHERE TO?"');
  push("  end");
  push("else");

  // mode 3: SHOOT — the crooked arrow
  push("if mode == 3 then");
  push("  if a == n1 or a == n2 or a == n3 then");
  push("    set arrows to arrows - 1");
  push("    if a == wumpus then");
  push('      print "AHA! YOU GOT THE WUMPUS!"');
  push("      print \"HEE HEE HEE - THE WUMPUS'LL GETCHA NEXT TIME!!\"");
  push('      print ""');
  push('      print "PLAY AGAIN (Y-N)?"');
  push("      set mode to 4");
  push("    else");
  push('      print "MISSED!"');
  push(`      if rand(0, 100) < ${WAKE} then`);
  push("        set wumpus to adj[(wumpus - 1) * 3 + floor(rand(0, 3))]");
  push("      end");
  push("      if wumpus == pos then");
  lose("        ", "TSK TSK TSK- WUMPUS GOT YOU!");
  push("      else");
  push("        if arrows <= 0 then");
  lose("          ", "YOU'VE RUN OUT OF ARROWS");
  push("        else");
  push('          print "ARROWS LEFT: " + arrows');
  report("          ");
  push("        end");
  push("      end");
  push("    end");
  push("  else");
  push('    print "NOT POSSIBLE - TUNNELS LEAD TO " + n1 + " " + n2 + " " + n3');
  push('    print "WHERE TO?"');
  push("  end");
  push("else");

  // mode 4: PLAY AGAIN
  push("if mode == 4 then");
  push('  if a == "Y" then');
  push("    clear");
  setup("    ");
  report("    ");
  push("  else");
  push('    if a == "N" then');
  push('      print "GOODBYE."');
  push("      set mode to 5");
  push("    else");
  push('      print "PLAY AGAIN (Y-N)?"');
  push("    end");
  push("  end");
  push("end");

  push("end");   // mode 3 else
  push("end");   // mode 2 else
  push("end");   // mode 1 else
  push("end");   // when answer

  return L.join("\n");
}

export function buildWumpus2Example() {
  return {
    title: "Hunt the Wumpus (Teletype)",
    objects: [
      // these two exist for the arcade-screen snapshot; the game hides them
      {
        id: "wt_t1", name: "title1", type: "text",
        x: 240, y: 150, size: 30, color: "#8dffa9", glow: 14, visible: 1,
        text: "HUNT THE WUMPUS", script: []
      },
      {
        id: "wt_t2", name: "title2", type: "text",
        x: 240, y: 195, size: 13, color: "#7a8894", glow: 4, visible: 1,
        text: "TELETYPE EDITION · TYPE TO PLAY", script: []
      },
      {
        id: "wt_brain", name: "teletype", type: "text",
        x: -50, y: -50, size: 1, color: "#000000", glow: 0, visible: 0, text: "",
        script: [{ event: "code", source: brainCode() }]
      }
    ]
  };
}

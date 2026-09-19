// example-txo.js — Tic-Tac-Toe on the TX-0 (1959), rebuilt in our studio.
// MIT's TX-0 was the hackers' playground: you tapped your move straight onto
// the screen with a light pen, and the machine answered. The interesting part
// was never the game — it was THE EXPERIMENT: how smart can the program be?
//
// So this one is a lab. Pick the opponent program from the instrument panel:
//   RANDOM  — pure chance (1950s "monkey" baseline)
//   CLEVER  — win-then-block, Bertie-class relay logic. Forkable!
//   PERFECT — the full OXO-class strategy. Cannot lose. Ever.
// The panel keeps a W-L-D tally PER PROGRAM across rounds, and rounds alternate
// who moves first — run your own experiment and see where the machine stops
// losing. TX-0 flavor: blue-white phosphor, light-pen input, ✕ vs ○.

const CELL = 80, BX = 30, BY = 70;
const cellXY = (c) => ({ x: BX + (c % 3) * CELL + CELL / 2, y: BY + Math.floor(c / 3) * CELL + CELL / 2 });

const CYAN = "#7ecfe0", CYAN_DIM = "#3d7f8f", GREEN = "#d8ffe2";

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  const winScan = (sign, outVar, pad) => {
    push(`${pad}set ${outVar} to -1`);
    push(`${pad}set l to 0`);
    push(`${pad}repeat 8`);
    push(`${pad}  set la to lines[l * 3]`);
    push(`${pad}  set lb to lines[l * 3 + 1]`);
    push(`${pad}  set lc to lines[l * 3 + 2]`);
    push(`${pad}  if board[la] + board[lb] + board[lc] == ${2 * sign} then`);
    push(`${pad}    if board[la] == 0 then`);
    push(`${pad}      set ${outVar} to la`);
    push(`${pad}    end`);
    push(`${pad}    if board[lb] == 0 then`);
    push(`${pad}      set ${outVar} to lb`);
    push(`${pad}    end`);
    push(`${pad}    if board[lc] == 0 then`);
    push(`${pad}      set ${outVar} to lc`);
    push(`${pad}    end`);
    push(`${pad}  end`);
    push(`${pad}  set l to l + 1`);
    push(`${pad}end`);
  };
  const wonScan = (sign, outVar, pad) => {
    push(`${pad}set ${outVar} to 0`);
    push(`${pad}set l to 0`);
    push(`${pad}repeat 8`);
    push(`${pad}  if board[lines[l * 3]] + board[lines[l * 3 + 1]] + board[lines[l * 3 + 2]] == ${3 * sign} then`);
    push(`${pad}    set ${outVar} to 1`);
    push(`${pad}  end`);
    push(`${pad}  set l to l + 1`);
    push(`${pad}end`);
  };
  const filledExpr = "(board[0] != 0) + (board[1] != 0) + (board[2] != 0) + (board[3] != 0) + (board[4] != 0) + (board[5] != 0) + (board[6] != 0) + (board[7] != 0) + (board[8] != 0)";
  // ---------------- start ----------------
  push("when start");
  push("set c to 0");
  push("repeat 9");
  push("  set board[c] to 0");
  push("  set c to c + 1");
  push("end");
  const LINES = [0,1,2, 3,4,5, 6,7,8, 0,3,6, 1,4,7, 2,5,8, 0,4,8, 2,4,6];
  LINES.forEach((v, i) => push(`set lines[${i}] to ${v}`));
  [[0,8],[2,6],[8,0],[6,2]].forEach(([a, b], i) => {
    push(`set copp[${i * 2}] to ${a}`);
    push(`set copp[${i * 2 + 1}] to ${b}`);
  });
  [4, 0, 2, 6, 8, 1, 3, 5, 7].forEach((v, i) => push(`set pref[${i}] to ${v}`));
  push("set i to 0");
  push("repeat 3");
  push("  set wt[i] to 0");
  push("  set lt[i] to 0");
  push("  set dt[i] to 0");
  push("  set i to i + 1");
  push("end");
  push("set level to 1");
  push("set round to 1");
  push("set starter to 1");
  push("set turn to 1");
  push("set game to 0");
  push("set aidelay to 0");
  push('set self.text to "YOUR MOVE — TAP A SQUARE"');
  push('set roundtxt.text to "ROUND 1 — YOU START"');
  push("end");

  // ---------------- tick ----------------
  push("when tick");
  // tallies on the panel
  push('set tally0.text to "W" + wt[0] + "  L" + lt[0] + "  D" + dt[0]');
  push('set tally1.text to "W" + wt[1] + "  L" + lt[1] + "  D" + dt[1]');
  push('set tally2.text to "W" + wt[2] + "  L" + lt[2] + "  D" + dt[2]');

  push("if game == 0 and turn == -1 then");
  push("  set aidelay to aidelay - 1");
  push("  if aidelay <= 0 then");
  push("    set move to -1");

  // ===== LEVEL 0: RANDOM =====
  push("    if level == 0 then");
  push(`      set n to 9 - (${filledExpr})`);
  push("      set pick to floor(rand(0, n))");
  push("      set c to 0");
  push("      repeat 9");
  push("        if board[c] == 0 then");
  push("          if pick == 0 and move < 0 then");
  push("            set move to c");
  push("          end");
  push("          set pick to pick - 1");
  push("        end");
  push("        set c to c + 1");
  push("      end");
  push("    end");

  // ===== LEVEL 1: CLEVER (win → block → center → corners → sides) =====
  push("    if level == 1 then");
  winScan(-1, "w", "      ");
  push("      if w >= 0 then");
  push("        set move to w");
  push("      end");
  push("      if move < 0 then");
  winScan(1, "w", "        ");
  push("        if w >= 0 then");
  push("          set move to w");
  push("        end");
  push("      end");
  push("      if move < 0 then");
  push("        set k to 0");
  push("        repeat 9");
  push("          if move < 0 and board[pref[k]] == 0 then");
  push("            set move to pref[k]");
  push("          end");
  push("          set k to k + 1");
  push("        end");
  push("      end");
  push("    end");

  // ===== LEVEL 2: PERFECT (full OXO strategy) =====
  push("    if level == 2 then");
  winScan(-1, "w", "      ");
  push("      if w >= 0 then");
  push("        set move to w");
  push("      end");
  push("      if move < 0 then");
  winScan(1, "w", "        ");
  push("        if w >= 0 then");
  push("          set move to w");
  push("        end");
  push("      end");
  // fork tables
  push("      set c to 0");
  push("      repeat 9");
  push("        set myfork[c] to 0");
  push("        set opfork[c] to 0");
  push("        if board[c] == 0 then");
  push("          set board[c] to -1");
  push("          set th to 0");
  push("          set l to 0");
  push("          repeat 8");
  push("            if board[lines[l * 3]] + board[lines[l * 3 + 1]] + board[lines[l * 3 + 2]] == -2 then");
  push("              set th to th + 1");
  push("            end");
  push("            set l to l + 1");
  push("          end");
  push("          set myfork[c] to th");
  push("          set board[c] to 1");
  push("          set th to 0");
  push("          set l to 0");
  push("          repeat 8");
  push("            if board[lines[l * 3]] + board[lines[l * 3 + 1]] + board[lines[l * 3 + 2]] == 2 then");
  push("              set th to th + 1");
  push("            end");
  push("            set l to l + 1");
  push("          end");
  push("          set opfork[c] to th");
  push("          set board[c] to 0");
  push("        end");
  push("        set c to c + 1");
  push("      end");
  push("      if move < 0 then");
  push("        set c to 0");
  push("        repeat 9");
  push("          if move < 0 and board[c] == 0 and myfork[c] >= 2 then");
  push("            set move to c");
  push("          end");
  push("          set c to c + 1");
  push("        end");
  push("      end");
  push("      if move < 0 then");
  push("        set fcount to 0");
  push("        set fcell to -1");
  push("        set c to 0");
  push("        repeat 9");
  push("          if board[c] == 0 and opfork[c] >= 2 then");
  push("            set fcount to fcount + 1");
  push("            set fcell to c");
  push("          end");
  push("          set c to c + 1");
  push("        end");
  push("        if fcount == 1 then");
  push("          set move to fcell");
  push("        end");
  push("        if move < 0 and fcount >= 2 then");
  push("          set c to 0");
  push("          repeat 9");
  push("            if move < 0 and board[c] == 0 then");
  push("              set board[c] to -1");
  winScan(-1, "e2", "              ");
  push("              set board[c] to 0");
  push("              if e2 >= 0 and opfork[e2] < 2 then");
  push("                set move to c");
  push("              end");
  push("            end");
  push("            set c to c + 1");
  push("          end");
  push("          if move < 0 then");
  push("            set move to fcell");
  push("          end");
  push("        end");
  push("      end");
  push("      if move < 0 and board[4] == 0 then");
  push("        set move to 4");
  push("      end");
  push("      if move < 0 then");
  push("        set k to 0");
  push("        repeat 4");
  push("          if move < 0 and board[copp[k * 2]] == 1 and board[copp[k * 2 + 1]] == 0 then");
  push("            set move to copp[k * 2 + 1]");
  push("          end");
  push("          set k to k + 1");
  push("        end");
  push("      end");
  push("      if move < 0 then");
  push("        set k to 0");
  push("        repeat 9");
  push("          if move < 0 and board[pref[k]] == 0 then");
  push("            set move to pref[k]");
  push("          end");
  push("          set k to k + 1");
  push("        end");
  push("      end");
  push("    end");

  // apply the machine's move + endings
  push("    if move >= 0 then");
  push("      set board[move] to -1");
  push("    end");
  wonScan(-1, "ww", "    ");
  push("    if ww == 1 then");
  push("      set game to 2");
  push("      set lt[level] to lt[level] + 1");
  push('      set self.text to "MACHINE WINS — TAP FOR NEXT ROUND"');
  push('      say "MACHINE WINS" for 2');
  push("    else");
  push(`      if ${filledExpr} == 9 then`);
  push("        set game to 3");
  push("        set dt[level] to dt[level] + 1");
  push('        set self.text to "A DRAW — TAP FOR NEXT ROUND"');
  push("      else");
  push("        set turn to 1");
  push('        set self.text to "YOUR MOVE — TAP A SQUARE"');
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

  // ---------------- click ----------------
  push("when click");
  push("set mx to mousex()");
  push("set my to mousey()");
  push("set handled to 0");
  // program selector (works anytime; switching mid-round restarts the round)
  push("set pick to -1");
  push("if mx > 285 and abs(my - 128) < 15 then");
  push("  set pick to 0");
  push("end");
  push("if mx > 285 and abs(my - 180) < 15 then");
  push("  set pick to 1");
  push("end");
  push("if mx > 285 and abs(my - 232) < 15 then");
  push("  set pick to 2");
  push("end");
  push("if pick >= 0 then");
  push("  set handled to 1");
  push("  if pick != level or game != 0 then");
  push("    set level to pick");
  push("    set c to 0");
  push("    repeat 9");
  push("      set board[c] to 0");
  push("      set c to c + 1");
  push("    end");
  push("    set game to 0");
  push("    set turn to starter");
  push("    if starter == -1 then");
  push("      set aidelay to 25");
  push('      set self.text to "MACHINE COMPUTING…"');
  push("    else");
  push('      set self.text to "YOUR MOVE — TAP A SQUARE"');
  push("    end");
  push("  end");
  push("end");
  // next round after a finished game
  push("if handled == 0 and game != 0 then");
  push("  set handled to 1");
  push("  set c to 0");
  push("  repeat 9");
  push("    set board[c] to 0");
  push("    set c to c + 1");
  push("  end");
  push("  set round to round + 1");
  push("  set starter to 0 - starter");
  push("  set game to 0");
  push("  set turn to starter");
  push("  if starter == -1 then");
  push("    set aidelay to 25");
  push('    set self.text to "MACHINE COMPUTING…"');
  push("  else");
  push('    set self.text to "YOUR MOVE — TAP A SQUARE"');
  push("  end");
  push("  if starter == 1 then");
  push('    set roundtxt.text to "ROUND " + round + " — YOU START"');
  push("  else");
  push('    set roundtxt.text to "ROUND " + round + " — MACHINE STARTS"');
  push("  end");
  push("end");
  // your light-pen move
  push("if handled == 0 and game == 0 and turn == 1 then");
  push(`  set col to floor((mx - ${BX}) / ${CELL})`);
  push(`  set row to floor((my - ${BY}) / ${CELL})`);
  push("  if col >= 0 and col <= 2 and row >= 0 and row <= 2 then");
  push("    set q to row * 3 + col");
  push("    if board[q] == 0 then");
  push("      set board[q] to 1");
  wonScan(1, "pw", "      ");
  push("      if pw == 1 then");
  push("        set game to 1");
  push("        set wt[level] to wt[level] + 1");
  push('        set self.text to "YOU WIN — TAP FOR NEXT ROUND"');
  push('        say "YOU WIN!" for 2');
  push("      else");
  push(`        if ${filledExpr} == 9 then`);
  push("          set game to 3");
  push("          set dt[level] to dt[level] + 1");
  push('          set self.text to "A DRAW — TAP FOR NEXT ROUND"');
  push("        else");
  push("          set turn to -1");
  push("          set aidelay to 25");
  push('          set self.text to "MACHINE COMPUTING…"');
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildTxoExample() {
  const objects = [];

  // dotted board grid, blue-white TX-0 phosphor
  let g = 0;
  const gridDot = (x, y) => objects.push({
    id: "tx_g" + (g++), name: "gd" + g, type: "dot",
    x, y, size: 3, color: CYAN_DIM, glow: 4, visible: 1, text: "", script: []
  });
  for (let y = BY; y <= BY + 3 * CELL; y += 10) { gridDot(BX + CELL, y); gridDot(BX + 2 * CELL, y); }
  for (let x = BX; x <= BX + 3 * CELL; x += 10) { gridDot(x, BY + CELL); gridDot(x, BY + 2 * CELL); }

  // marks: your ✕, the machine's ○ (a ring — first example to use rings as pieces)
  for (let c = 0; c < 9; c++) {
    const { x, y } = cellXY(c);
    objects.push({
      id: "tx_x" + c, name: "xm" + c, type: "text",
      x, y: y + 15, size: 46, color: GREEN, glow: 14, visible: 0, text: "✕",
      script: [{ event: "code", source: `when tick\nset self.visible to (board[${c}] == 1)\nend` }]
    });
    objects.push({
      id: "tx_o" + c, name: "om" + c, type: "ring",
      x, y, size: 24, color: CYAN, glow: 14, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to (board[${c}] == -1)\nend` }]
    });
  }

  // the instrument panel
  objects.push({
    id: "tx_ptitle", name: "paneltitle", type: "text",
    x: 372, y: 100, size: 13, color: CYAN, glow: 8, visible: 1,
    text: "OPPONENT PROGRAM", script: []
  });
  const progBtn = (id, name, y, label, lvl) => objects.push({
    id, name, type: "text", x: 372, y: y + 5, size: 15, color: CYAN, glow: 6, visible: 1,
    text: label,
    script: [{ event: "code", source: `when tick\nif level == ${lvl} then\n  set self.glow to 22\n  set self.color to "${GREEN}"\nelse\n  set self.glow to 6\n  set self.color to "${CYAN}"\nend\nend` }]
  });
  progBtn("tx_p0", "prog0", 128, "◦ RANDOM", 0);
  progBtn("tx_p1", "prog1", 180, "◦ CLEVER", 1);
  progBtn("tx_p2", "prog2", 232, "◦ PERFECT", 2);
  const tally = (id, name, y) => objects.push({
    id, name, type: "text", x: 372, y: y + 24, size: 11, color: CYAN_DIM, glow: 4, visible: 1,
    text: "W0  L0  D0", script: []
  });
  tally("tx_t0", "tally0", 128);
  tally("tx_t1", "tally1", 180);
  tally("tx_t2", "tally2", 232);

  objects.push({
    id: "tx_brain", name: "brain", type: "text",
    x: 240, y: 340, size: 13, color: CYAN, glow: 8, visible: 1,
    text: "YOUR MOVE — TAP A SQUARE",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({
    id: "tx_round", name: "roundtxt", type: "text",
    x: 372, y: 285, size: 11, color: CYAN_DIM, glow: 4, visible: 1,
    text: "ROUND 1 — YOU START", script: []
  });
  objects.push({
    id: "tx_title", name: "title", type: "text",
    x: 240, y: 24, size: 15, color: CYAN, glow: 10, visible: 1,
    text: "TIC-TAC-TOE — MIT TX-0 · 1959 · THE EXPERIMENT", script: []
  });

  return { title: "Tic-Tac-Toe on TX-0 (1959)", objects };
}

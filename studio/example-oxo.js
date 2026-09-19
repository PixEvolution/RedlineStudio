// example-oxo.js — OXO (1952), rebuilt in our studio. A.S. Douglas wrote it on
// Cambridge's EDSAC as part of his PhD — one of the very first games with a
// GRAPHICAL DISPLAY: a dot-matrix CRT drew the board, and you entered moves on
// a rotary telephone dial. You could choose who moved first, and EDSAC played a
// PERFECT game — it could never be beaten, only drawn.
//
// Faithful bits here: the board and the X/O marks are real dot-matrix patterns
// (hundreds of dot objects, just like EDSAC's 35×16 display), you pick who
// starts, and EDSAC plays the full perfect strategy: win → block → fork →
// fork-block (with forcing moves) → center → opposite corner → corner → side.
// Player is X (green). EDSAC is O (amber). board[0..8], real RedScript loops.

const CELL = 72, BX = 132, BY = 60;                    // board geometry
const cellXY = (c) => ({ x: BX + (c % 3) * CELL + CELL / 2, y: BY + Math.floor(c / 3) * CELL + CELL / 2 });

// dot-matrix glyphs on a 5×5 grid (spacing 12px, centered in the cell)
const X_DOTS = [[0,0],[1,1],[2,2],[3,3],[4,4],[0,4],[1,3],[3,1],[4,0]];
const O_DOTS = [[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[4,2],[0,3],[4,3],[1,4],[2,4],[3,4]];

// ---------------------------------------------------------------------------
// EDSAC's brain (generated; real loops over board[] and lines[])
// ---------------------------------------------------------------------------

function setupBoard(pad) {
  return [
    `${pad}set c to 0`,
    `${pad}repeat 9`,
    `${pad}  set board[c] to 0`,
    `${pad}  set c to c + 1`,
    `${pad}end`
  ].join("\n");
}

// scan all 8 lines: does `sign` have two-in-a-line with the third empty?
// leaves the empty cell in `outVar` (or -1)
function winScan(sign, outVar, pad) {
  return [
    `${pad}set ${outVar} to -1`,
    `${pad}set l to 0`,
    `${pad}repeat 8`,
    `${pad}  set la to lines[l * 3]`,
    `${pad}  set lb to lines[l * 3 + 1]`,
    `${pad}  set lc to lines[l * 3 + 2]`,
    `${pad}  if board[la] + board[lb] + board[lc] == ${2 * sign} then`,
    `${pad}    if board[la] == 0 then`,
    `${pad}      set ${outVar} to la`,
    `${pad}    end`,
    `${pad}    if board[lb] == 0 then`,
    `${pad}      set ${outVar} to lb`,
    `${pad}    end`,
    `${pad}    if board[lc] == 0 then`,
    `${pad}      set ${outVar} to lc`,
    `${pad}    end`,
    `${pad}  end`,
    `${pad}  set l to l + 1`,
    `${pad}end`
  ].join("\n");
}

// did `sign` complete a line? → outVar 1/0
function wonScan(sign, outVar, pad) {
  return [
    `${pad}set ${outVar} to 0`,
    `${pad}set l to 0`,
    `${pad}repeat 8`,
    `${pad}  if board[lines[l * 3]] + board[lines[l * 3 + 1]] + board[lines[l * 3 + 2]] == ${3 * sign} then`,
    `${pad}    set ${outVar} to 1`,
    `${pad}  end`,
    `${pad}  set l to l + 1`,
    `${pad}end`
  ].join("\n");
}

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  // ---------------- start ----------------
  push("when start");
  push(setupBoard(""));
  const LINES = [0,1,2, 3,4,5, 6,7,8, 0,3,6, 1,4,7, 2,5,8, 0,4,8, 2,4,6];
  LINES.forEach((v, i) => push(`set lines[${i}] to ${v}`));
  // corner → opposite corner pairs
  [[0,8],[2,6],[8,0],[6,2]].forEach(([a, b], i) => {
    push(`set copp[${i * 2}] to ${a}`);
    push(`set copp[${i * 2 + 1}] to ${b}`);
  });
  // corner and side orders
  [4, 0, 2, 6, 8, 1, 3, 5, 7].forEach((v, i) => push(`set pref[${i}] to ${v}`));
  push("set game to 9");   // 9 = choose-who-starts screen
  push("set aidelay to 0");
  push('set self.text to "WHO MOVES FIRST? PICK ONE BELOW"');
  push("end");

  // ---------------- tick ----------------
  push("when tick");
  push("if game == 0 and turn == -1 then");
  push("  set aidelay to aidelay - 1");
  push("  if aidelay <= 0 then");
  push("    set move to -1");
  // 1. win
  push(winScan(-1, "w", "    "));
  push("    if w >= 0 then");
  push("      set move to w");
  push("    end");
  // 2. block
  push("    if move < 0 then");
  push(winScan(1, "w", "      "));
  push("      if w >= 0 then");
  push("        set move to w");
  push("      end");
  push("    end");
  // 3/4. forks: mark every empty cell's fork power for both sides
  push("    set c to 0");
  push("    repeat 9");
  push("      set myfork[c] to 0");
  push("      set opfork[c] to 0");
  push("      if board[c] == 0 then");
  // my fork count at c
  push("        set board[c] to -1");
  push("        set th to 0");
  push("        set l to 0");
  push("        repeat 8");
  push("          set s to board[lines[l * 3]] + board[lines[l * 3 + 1]] + board[lines[l * 3 + 2]]");
  push("          if s == -2 then");
  push("            set th to th + 1");
  push("          end");
  push("          set l to l + 1");
  push("        end");
  push("        set myfork[c] to th");
  // opponent fork count at c
  push("        set board[c] to 1");
  push("        set th to 0");
  push("        set l to 0");
  push("        repeat 8");
  push("          set s to board[lines[l * 3]] + board[lines[l * 3 + 1]] + board[lines[l * 3 + 2]]");
  push("          if s == 2 then");
  push("            set th to th + 1");
  push("          end");
  push("          set l to l + 1");
  push("        end");
  push("        set opfork[c] to th");
  push("        set board[c] to 0");
  push("      end");
  push("      set c to c + 1");
  push("    end");
  // 3. take my fork
  push("    if move < 0 then");
  push("      set c to 0");
  push("      repeat 9");
  push("        if move < 0 and board[c] == 0 and myfork[c] >= 2 then");
  push("          set move to c");
  push("        end");
  push("        set c to c + 1");
  push("      end");
  push("    end");
  // 4. block opponent forks
  push("    if move < 0 then");
  push("      set fcount to 0");
  push("      set fcell to -1");
  push("      set c to 0");
  push("      repeat 9");
  push("        if board[c] == 0 and opfork[c] >= 2 then");
  push("          set fcount to fcount + 1");
  push("          set fcell to c");
  push("        end");
  push("        set c to c + 1");
  push("      end");
  push("      if fcount == 1 then");
  push("        set move to fcell");
  push("      end");
  push("      if move < 0 and fcount >= 2 then");
  // forcing move: create a threat whose forced block is NOT one of their fork squares
  push("        set c to 0");
  push("        repeat 9");
  push("          if move < 0 and board[c] == 0 then");
  push("            set board[c] to -1");
  push(winScan(-1, "e", "            "));
  push("            set board[c] to 0");
  push("            if e >= 0 and opfork[e] < 2 then");
  push("              set move to c");
  push("            end");
  push("          end");
  push("          set c to c + 1");
  push("        end");
  push("        if move < 0 then");
  push("          set move to fcell");
  push("        end");
  push("      end");
  push("    end");
  // 5. center FIRST (before opposite corner — the order matters for perfection)
  push("    if move < 0 and board[4] == 0 then");
  push("      set move to 4");
  push("    end");
  // 6. opposite corner (they hold a corner, its opposite is free)
  push("    if move < 0 then");
  push("      set k to 0");
  push("      repeat 4");
  push("        if move < 0 and board[copp[k * 2]] == 1 and board[copp[k * 2 + 1]] == 0 then");
  push("          set move to copp[k * 2 + 1]");
  push("        end");
  push("        set k to k + 1");
  push("      end");
  push("    end");
  // 7/8. corners, then sides (center already handled)
  push("    if move < 0 then");
  push("      set k to 0");
  push("      repeat 9");
  push("        if move < 0 and board[pref[k]] == 0 then");
  push("          set move to pref[k]");
  push("        end");
  push("        set k to k + 1");
  push("      end");
  push("    end");
  // apply
  push("    if move >= 0 then");
  push("      set board[move] to -1");
  push("    end");
  push(wonScan(-1, "ww", "    "));
  push("    if ww == 1 then");
  push("      set game to 2");
  push('      set self.text to "EDSAC WINS — CLICK TO PLAY AGAIN"');
  push('      say "EDSAC WINS" for 3');
  push("    else");
  push("      set filled to (board[0] != 0) + (board[1] != 0) + (board[2] != 0) + (board[3] != 0) + (board[4] != 0) + (board[5] != 0) + (board[6] != 0) + (board[7] != 0) + (board[8] != 0)");
  push("      if filled == 9 then");
  push("        set game to 3");
  push('        set self.text to "A DRAW — EDSAC CANNOT BE BEATEN. CLICK TO RETRY"');
  push("      else");
  push("        set turn to 1");
  push('        set self.text to "YOUR MOVE — YOU ARE X"');
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

  // ---------------- click ----------------
  push("when click");
  // choose-first screen
  push("if game == 9 then");
  push("  if abs(mousex() - 168) < 60 and abs(mousey() - 330) < 15 then");
  push("    set game to 0");
  push("    set turn to 1");
  push('    set self.text to "YOUR MOVE — YOU ARE X"');
  push("  end");
  push("  if abs(mousex() - 315) < 66 and abs(mousey() - 330) < 15 then");
  push("    set game to 0");
  push("    set turn to -1");
  push("    set aidelay to 30");
  push('    set self.text to "EDSAC COMPUTING…"');
  push("  end");
  push("else");
  // game over → back to the choose screen
  push("  if game != 0 then");
  push(setupBoard("    "));
  push("    set game to 9");
  push('    set self.text to "WHO MOVES FIRST? PICK ONE BELOW"');
  push("  else");
  // your move
  push("    if turn == 1 then");
  push(`      set col to floor((mousex() - ${BX}) / ${CELL})`);
  push(`      set row to floor((mousey() - ${BY}) / ${CELL})`);
  push("      if col >= 0 and col <= 2 and row >= 0 and row <= 2 then");
  push("        set q to row * 3 + col");
  push("        if board[q] == 0 then");
  push("          set board[q] to 1");
  push(wonScan(1, "pw", "          "));
  push("          if pw == 1 then");
  push("            set game to 1");
  push('            set self.text to "YOU BEAT EDSAC?! CLICK TO PLAY AGAIN"');
  push('            say "IMPOSSIBLE!" for 3');
  push("          else");
  push("            set filled to (board[0] != 0) + (board[1] != 0) + (board[2] != 0) + (board[3] != 0) + (board[4] != 0) + (board[5] != 0) + (board[6] != 0) + (board[7] != 0) + (board[8] != 0)");
  push("            if filled == 9 then");
  push("              set game to 3");
  push('              set self.text to "A DRAW — EDSAC CANNOT BE BEATEN. CLICK TO RETRY"');
  push("            else");
  push("              set turn to -1");
  push("              set aidelay to 30");
  push('              set self.text to "EDSAC COMPUTING…"');
  push("            end");
  push("          end");
  push("        end");
  push("      end");
  push("    end");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

// Every mark dot syncs itself to the board — self-contained dot-matrix pixels.
function dotScript(cell, sign) {
  return [{
    event: "code",
    source: `when tick\nset self.visible to (board[${cell}] == ${sign})\nend`
  }];
}

function chooserScript(which) {   // buttons only exist on the choose screen
  return [{
    event: "code",
    source: `when tick\nset self.visible to (game == 9)\nend`
  }];
}

export function buildOxoExample() {
  const objects = [];

  // dotted grid lines (static EDSAC pixels)
  let g = 0;
  const gridDot = (x, y) => objects.push({
    id: "ox_g" + (g++), name: "g" + g, type: "dot",
    x, y, size: 3, color: "#1f8f3c", glow: 4, visible: 1, text: "", script: []
  });
  for (let y = BY; y <= BY + 3 * CELL; y += 12) { gridDot(BX + CELL, y); gridDot(BX + 2 * CELL, y); }
  for (let x = BX; x <= BX + 3 * CELL; x += 12) { gridDot(x, BY + CELL); gridDot(x, BY + 2 * CELL); }

  // the 9 cells' X and O dot-matrix marks
  for (let c = 0; c < 9; c++) {
    const { x, y } = cellXY(c);
    X_DOTS.forEach(([dx, dy], i) => objects.push({
      id: `ox_x${c}_${i}`, name: `x${c}_${i}`, type: "dot",
      x: x + (dx - 2) * 12, y: y + (dy - 2) * 12,
      size: 7, color: "#7dff9e", glow: 12, visible: 0, text: "",
      script: dotScript(c, 1)
    }));
    O_DOTS.forEach(([dx, dy], i) => objects.push({
      id: `ox_o${c}_${i}`, name: `o${c}_${i}`, type: "dot",
      x: x + (dx - 2) * 12, y: y + (dy - 2) * 12,
      size: 7, color: "#ff9d4a", glow: 12, visible: 0, text: "",
      script: dotScript(c, -1)
    }));
  }

  objects.push({
    id: "ox_brain", name: "brain", type: "text",
    x: 240, y: 305, size: 14, color: "#2fdc55", glow: 8, visible: 1,
    text: "WHO MOVES FIRST? PICK ONE BELOW",
    script: [{ event: "code", source: brainCode() }]
  });

  objects.push({
    id: "ox_you", name: "youfirst", type: "text",
    x: 168, y: 335, size: 16, color: "#7dff9e", glow: 14, visible: 1,
    text: "[ YOU FIRST ]", script: chooserScript()
  });
  objects.push({
    id: "ox_ed", name: "edsacfirst", type: "text",
    x: 315, y: 335, size: 16, color: "#ff9d4a", glow: 14, visible: 1,
    text: "[ EDSAC FIRST ]", script: chooserScript()
  });

  objects.push({
    id: "ox_title", name: "title", type: "text",
    x: 240, y: 25, size: 16, color: "#8dffa9", glow: 12, visible: 1,
    text: "O X O — EDSAC · 1952", script: []
  });
  objects.push({
    id: "ox_sub", name: "subtitle", type: "text",
    x: 240, y: 44, size: 10, color: "#1f8f3c", glow: 4, visible: 1,
    text: "ONE OF THE FIRST GAMES WITH A GRAPHICAL DISPLAY · EDSAC PLAYS PERFECTLY",
    script: []
  });

  return { title: "OXO (1952)", objects };
}

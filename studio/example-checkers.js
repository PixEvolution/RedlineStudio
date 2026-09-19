// example-checkers.js — Draughts (1951), Christopher Strachey's checkers program,
// rebuilt in our studio. The original ran on the Ferranti Mark I in the UK and was
// one of the first real game-playing programs — full rules, and it looked at the
// board to choose its move.
//
// This example is the debut of RedScript LISTS: the whole game lives in board[0..63],
// and both the rules and MARK I's brain are real loops over it. Full English
// draughts: diagonal moves, MANDATORY captures, multi-jump chains, kings.
// You are green (moving up). MARK I is amber (moving down). Click a piece, then
// click where it goes. Click anywhere after the game ends to reset.
//
// MARK I's brain, like Strachey's: captures first (they're forced anyway), then it
// scores every legal move — advancing, kinging, and not leaving the piece where
// you can jump it — and plays the best one.

const SQ = 36, OX = 96, OY = 24;
const sqXY = (i) => ({ x: OX + (i % 8) * SQ + SQ / 2, y: OY + Math.floor(i / 8) * SQ + SQ / 2 });

// ---------------------------------------------------------------------------
// The brain program (generated so the loops/edge-math are typo-free)
// ---------------------------------------------------------------------------

function setupCode(pad) {
  // fills board[], resets all state — used by "when start" AND the click-to-reset
  return [
    `${pad}set i to 0`,
    `${pad}repeat 64`,
    `${pad}  set board[i] to 0`,
    `${pad}  set r to floor(i / 8)`,
    `${pad}  set c to i % 8`,
    `${pad}  if (r + c) % 2 == 1 then`,
    `${pad}    if r <= 2 then`,
    `${pad}      set board[i] to -1`,
    `${pad}    end`,
    `${pad}    if r >= 5 then`,
    `${pad}      set board[i] to 1`,
    `${pad}    end`,
    `${pad}  end`,
    `${pad}  set i to i + 1`,
    `${pad}end`,
    `${pad}set turn to 1`,
    `${pad}set sel to -1`,
    `${pad}set chain to -1`,
    `${pad}set clicked to -1`,
    `${pad}set game to 0`,
    `${pad}set aidelay to 0`,
    `${pad}set dirs[0] to -9`,
    `${pad}set dirs[1] to -7`,
    `${pad}set dirs[2] to 7`,
    `${pad}set dirs[3] to 9`,
    `${pad}set self.text to "YOUR MOVE — CLICK A PIECE, THEN A SQUARE"`
  ].join("\n");
}

// Generates a scan: does side `sign` (1 player / -1 ai) have any capture?
// Leaves the answer in variable `outVar`.
function anyJumpScan(sign, outVar) {
  const own = sign === 1 ? "board[i] > 0" : "board[i] < 0";
  const man = sign === 1 ? "board[i] == 1" : "board[i] == -1";
  const badK = sign === 1 ? "k >= 2" : "k <= 1";   // men only move toward the enemy
  const enemyMid = sign === 1 ? "board[m] < 0" : "board[m] > 0";
  return [
    `set ${outVar} to 0`,
    `set i to 0`,
    `repeat 64`,
    `  if ${own} then`,
    `    set k to 0`,
    `    repeat 4`,
    `      set ok to 1`,
    `      if ${man} and ${badK} then`,
    `        set ok to 0`,
    `      end`,
    `      if ok == 1 then`,
    `        set d to dirs[k]`,
    `        set m to i + d`,
    `        set t to i + d + d`,
    `        if t >= 0 and t < 64 and abs(m % 8 - i % 8) == 1 and abs(t % 8 - i % 8) == 2 then`,
    `          if ${enemyMid} and board[t] == 0 then`,
    `            set ${outVar} to 1`,
    `          end`,
    `        end`,
    `      end`,
    `      set k to k + 1`,
    `    end`,
    `  end`,
    `  set i to i + 1`,
    `end`
  ];
}

// Can the piece on square `sqVar` (already known to belong to `sign`) capture? → outVar
function pieceJumpScan(sign, sqVar, outVar) {
  const man = sign === 1 ? `board[${sqVar}] == 1` : `board[${sqVar}] == -1`;
  const badK = sign === 1 ? "k >= 2" : "k <= 1";
  const enemyMid = sign === 1 ? "board[m] < 0" : "board[m] > 0";
  return [
    `set ${outVar} to 0`,
    `set k to 0`,
    `repeat 4`,
    `  set ok to 1`,
    `  if ${man} and ${badK} then`,
    `    set ok to 0`,
    `  end`,
    `  if ok == 1 then`,
    `    set d to dirs[k]`,
    `    set m to ${sqVar} + d`,
    `    set t to ${sqVar} + d + d`,
    `    if t >= 0 and t < 64 and abs(m % 8 - ${sqVar} % 8) == 1 and abs(t % 8 - ${sqVar} % 8) == 2 then`,
    `      if ${enemyMid} and board[t] == 0 then`,
    `        set ${outVar} to 1`,
    `      end`,
    `    end`,
    `  end`,
    `  set k to k + 1`,
    `end`
  ];
}

function countScan(sign, outVar) {
  const own = sign === 1 ? "board[i] > 0" : "board[i] < 0";
  return [
    `set ${outVar} to 0`,
    `set i to 0`,
    `repeat 64`,
    `  if ${own} then`,
    `    set ${outVar} to ${outVar} + 1`,
    `  end`,
    `  set i to i + 1`,
    `end`
  ];
}

function brainCode() {
  const L = [];

  // ------------------------------------------------- start
  L.push("when start");
  L.push(setupCode(""));
  L.push("end");

  // ------------------------------------------------- tick
  L.push("when tick");

  // ============ PLAYER INPUT ============
  L.push("if clicked >= 0 and game == 0 and turn == 1 then");
  L.push("  set q to clicked");
  L.push("  set clicked to -1");
  anyJumpScan(1, "pjump").forEach(l => L.push("  " + l));
  // picking one of your pieces (not while mid-chain)
  L.push("  if board[q] > 0 and chain == -1 then");
  L.push("    set sel to q");
  L.push("  else");
  L.push("    if sel >= 0 and board[q] == 0 then");
  L.push("      set fr to sel");
  L.push("      set v to board[fr]");
  L.push("      set dr to floor(q / 8) - floor(fr / 8)");
  L.push("      set dc to q % 8 - fr % 8");
  L.push("      set moved to 0");
  L.push("      set wasjump to 0");
  // ---- simple move ----
  L.push("      if abs(dr) == 1 and abs(dc) == 1 and chain == -1 then");
  L.push("        set dirok to 0");
  L.push("        if v == 2 then");
  L.push("          set dirok to 1");
  L.push("        end");
  L.push("        if v == 1 and dr == -1 then");
  L.push("          set dirok to 1");
  L.push("        end");
  L.push("        if dirok == 1 then");
  L.push("          if pjump == 1 then");
  L.push('            say "CAPTURE IS MANDATORY!" for 1.5');
  L.push("          else");
  L.push("            set board[q] to v");
  L.push("            set board[fr] to 0");
  L.push("            set moved to 1");
  L.push("          end");
  L.push("        end");
  L.push("      end");
  // ---- jump ----
  L.push("      if abs(dr) == 2 and abs(dc) == 2 then");
  L.push("        set jok to 0");
  L.push("        if v == 2 then");
  L.push("          set jok to 1");
  L.push("        end");
  L.push("        if v == 1 and dr == -2 then");
  L.push("          set jok to 1");
  L.push("        end");
  L.push("        if chain >= 0 and fr != chain then");
  L.push("          set jok to 0");
  L.push("        end");
  L.push("        set mid to fr + (q - fr) / 2");
  L.push("        if jok == 1 and board[mid] < 0 then");
  L.push("          set board[q] to v");
  L.push("          set board[fr] to 0");
  L.push("          set board[mid] to 0");
  L.push("          set moved to 1");
  L.push("          set wasjump to 1");
  L.push("        end");
  L.push("      end");
  // ---- after a legal move ----
  L.push("      if moved == 1 then");
  L.push("        set promoted to 0");
  L.push("        if floor(q / 8) == 0 and board[q] == 1 then");
  L.push("          set board[q] to 2");
  L.push("          set promoted to 1");
  L.push('          say "KING ME!" for 1.5');
  L.push("        end");
  L.push("        set sel to -1");
  L.push("        set chain to -1");
  L.push("        set goai to 1");
  L.push("        if wasjump == 1 then");
  countScan(-1, "acount").forEach(l => L.push("          " + l));
  L.push("          if acount == 0 then");
  L.push("            set game to 1");
  L.push('            set self.text to "YOU WIN — MARK I HAS NO PIECES LEFT"');
  L.push('            say "YOU WIN!" for 3');
  L.push("            set goai to 0");
  L.push("          end");
  // multi-jump: same piece, still hungry → you keep the move
  pieceJumpScan(1, "q", "more").forEach(l => L.push("          " + l));
  L.push("          if game == 0 and more == 1 and promoted == 0 then");
  L.push("            set chain to q");
  L.push("            set sel to q");
  L.push("            set goai to 0");
  L.push('            set self.text to "KEEP JUMPING!"');
  L.push("          end");
  L.push("        end");
  L.push("        if goai == 1 and game == 0 then");
  L.push("          set turn to -1");
  L.push("          set aidelay to 35");
  L.push('          set self.text to "MARK I IS THINKING…"');
  L.push("        end");
  L.push("      end");
  L.push("    end");
  L.push("  end");
  L.push("end");

  // ============ MARK I'S TURN ============
  L.push("if turn == -1 and game == 0 then");
  L.push("  set aidelay to aidelay - 1");
  L.push("  if aidelay <= 0 then");
  anyJumpScan(-1, "ajump").forEach(l => L.push("    " + l));
  // score every legal move
  L.push("    set bscore to -99999");
  L.push("    set bf to -1");
  L.push("    set bt to -1");
  L.push("    set bj to 0");
  L.push("    set i to 0");
  L.push("    repeat 64");
  L.push("      if board[i] < 0 then");
  L.push("        set k to 0");
  L.push("        repeat 4");
  L.push("          set ok to 1");
  L.push("          if board[i] == -1 and k <= 1 then");
  L.push("            set ok to 0");
  L.push("          end");
  L.push("          if ok == 1 then");
  L.push("            set d to dirs[k]");
  L.push("            set m to i + d");
  L.push("            set t to i + d + d");
  // -- capture --
  L.push("            if t >= 0 and t < 64 and abs(m % 8 - i % 8) == 1 and abs(t % 8 - i % 8) == 2 then");
  L.push("              if board[m] > 0 and board[t] == 0 then");
  L.push("                set sc to 1000 + rand(0, 9)");
  L.push("                if sc > bscore then");
  L.push("                  set bscore to sc");
  L.push("                  set bf to i");
  L.push("                  set bt to t");
  L.push("                  set bj to 1");
  L.push("                end");
  L.push("              end");
  L.push("            end");
  // -- simple move (only when no capture exists anywhere) --
  L.push("            if ajump == 0 and m >= 0 and m < 64 and abs(m % 8 - i % 8) == 1 then");
  L.push("              if board[m] == 0 then");
  L.push("                set sc to 10 + d + rand(0, 4)");   // +d rewards advancing (down = +7/+9)
  L.push("                if floor(m / 8) == 7 and board[i] == -1 then");
  L.push("                  set sc to sc + 60");
  L.push("                end");
  // safety: would the player be able to jump this piece where it lands?
  L.push("                set danger to 0");
  L.push("                set k2 to 0");
  L.push("                repeat 4");
  L.push("                  set d2 to dirs[k2]");
  L.push("                  set a to m + d2");
  L.push("                  set l to m - d2");
  L.push("                  if a >= 0 and a < 64 and l >= 0 and l < 64 then");
  L.push("                    if abs(a % 8 - m % 8) == 1 and abs(l % 8 - m % 8) == 1 then");
  L.push("                      if board[l] == 0 or l == i then");
  L.push("                        if board[a] == 2 or (board[a] == 1 and d2 >= 7) then");
  L.push("                          set danger to 1");
  L.push("                        end");
  L.push("                      end");
  L.push("                    end");
  L.push("                  end");
  L.push("                  set k2 to k2 + 1");
  L.push("                end");
  L.push("                if danger == 1 then");
  L.push("                  set sc to sc - 45");
  L.push("                end");
  L.push("                if sc > bscore then");
  L.push("                  set bscore to sc");
  L.push("                  set bf to i");
  L.push("                  set bt to m");
  L.push("                  set bj to 0");
  L.push("                end");
  L.push("              end");
  L.push("            end");
  L.push("          end");
  L.push("          set k to k + 1");
  L.push("        end");
  L.push("      end");
  L.push("      set i to i + 1");
  L.push("    end");
  // -- no legal move at all: MARK I loses --
  L.push("    if bf < 0 then");
  L.push("      set game to 1");
  L.push('      set self.text to "MARK I CANNOT MOVE — YOU WIN"');
  L.push('      say "YOU WIN!" for 3');
  L.push("    else");
  // -- apply the chosen move --
  L.push("      set v to board[bf]");
  L.push("      set wasking to 0");
  L.push("      if v == -2 then");
  L.push("        set wasking to 1");
  L.push("      end");
  L.push("      set board[bt] to v");
  L.push("      set board[bf] to 0");
  L.push("      if bj == 1 then");
  L.push("        set board[bf + (bt - bf) / 2] to 0");
  L.push("      end");
  L.push("      if floor(bt / 8) == 7 and board[bt] == -1 then");
  L.push("        set board[bt] to -2");
  L.push("      end");
  // -- multi-jump chain: keep capturing with the same piece --
  L.push("      if bj == 1 and (wasking == 1 or board[bt] != -2) then");
  L.push("        repeat 8");
  pieceJumpScan(-1, "bt", "more").forEach(l => L.push("          " + l));
  L.push("          if more == 1 then");
  L.push("            set k to 0");
  L.push("            set done to 0");
  L.push("            repeat 4");
  L.push("              if done == 0 then");
  L.push("                set ok to 1");
  L.push("                if board[bt] == -1 and k <= 1 then");
  L.push("                  set ok to 0");
  L.push("                end");
  L.push("                if ok == 1 then");
  L.push("                  set d to dirs[k]");
  L.push("                  set m to bt + d");
  L.push("                  set t to bt + d + d");
  L.push("                  if t >= 0 and t < 64 and abs(m % 8 - bt % 8) == 1 and abs(t % 8 - bt % 8) == 2 then");
  L.push("                    if board[m] > 0 and board[t] == 0 then");
  L.push("                      set board[t] to board[bt]");
  L.push("                      set board[bt] to 0");
  L.push("                      set board[m] to 0");
  L.push("                      set bt to t");
  L.push("                      if floor(bt / 8) == 7 and board[bt] == -1 then");
  L.push("                        set board[bt] to -2");
  L.push("                      end");
  L.push("                      set done to 1");
  L.push("                    end");
  L.push("                  end");
  L.push("                end");
  L.push("              end");
  L.push("              set k to k + 1");
  L.push("            end");
  L.push("          end");
  L.push("        end");
  L.push("      end");
  // -- did MARK I wipe you out? --
  countScan(1, "pcount").forEach(l => L.push("      " + l));
  L.push("      if pcount == 0 then");
  L.push("        set game to 2");
  L.push('        set self.text to "MARK I WINS — CLICK TO PLAY AGAIN"');
  L.push('        say "MARK I WINS" for 3');
  L.push("      end");
  // -- can you even move? --
  L.push("      if game == 0 then");
  anyJumpScan(1, "pj2").forEach(l => L.push("        " + l));
  L.push("        set pmove to pj2");
  L.push("        set i to 0");
  L.push("        repeat 64");
  L.push("          if pmove == 0 and board[i] > 0 then");
  L.push("            set k to 0");
  L.push("            repeat 4");
  L.push("              set ok to 1");
  L.push("              if board[i] == 1 and k >= 2 then");
  L.push("                set ok to 0");
  L.push("              end");
  L.push("              if ok == 1 then");
  L.push("                set m to i + dirs[k]");
  L.push("                if m >= 0 and m < 64 and abs(m % 8 - i % 8) == 1 and board[m] == 0 then");
  L.push("                  set pmove to 1");
  L.push("                end");
  L.push("              end");
  L.push("              set k to k + 1");
  L.push("            end");
  L.push("          end");
  L.push("          set i to i + 1");
  L.push("        end");
  L.push("        if pmove == 0 then");
  L.push("          set game to 2");
  L.push('          set self.text to "YOU CANNOT MOVE — MARK I WINS"');
  L.push("        else");
  L.push("          set turn to 1");
  L.push('          set self.text to "YOUR MOVE"');
  L.push("        end");
  L.push("      end");
  L.push("    end");
  L.push("  end");
  L.push("end");
  L.push("end");

  // ------------------------------------------------- click-to-reset
  L.push("when click");
  L.push("if game != 0 then");
  L.push(setupCode("  "));
  L.push("end");
  L.push("end");

  return L.join("\n");
}

// Per-square display + click script (baked with its own index)
function squareCode(idx) {
  return [
    "when tick",
    `set v to board[${idx}]`,
    'set self.text to ""',
    "if v == 1 then",
    '  set self.text to "●"',
    '  set self.color to "#7dff9e"',
    "end",
    "if v == 2 then",
    '  set self.text to "★"',
    '  set self.color to "#d8ffe2"',
    "end",
    "if v == -1 then",
    '  set self.text to "●"',
    '  set self.color to "#ff9d4a"',
    "end",
    "if v == -2 then",
    '  set self.text to "★"',
    '  set self.color to "#ffd75e"',
    "end",
    `if sel == ${idx} then`,
    "  set self.glow to 26",
    "else",
    "  set self.glow to 9",
    "end",
    "end",
    "when click",
    "if game == 0 and turn == 1 then",
    "  if abs(mousex() - self.x) < 17 and abs(mousey() - self.y) < 17 then",
    `    set clicked to ${idx}`,
    "  end",
    "end",
    "end"
  ].join("\n");
}

export function buildCheckersExample() {
  const objects = [];

  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), c = i % 8;
    if ((r + c) % 2 !== 1) continue;
    const { x, y } = sqXY(i);
    // the dark square itself
    objects.push({
      id: "ex_b" + i, name: "b" + i, type: "box",
      x, y, size: 34, color: "#0d2a1a", glow: 0, visible: 1, text: "", script: []
    });
    // the piece display + click pad on top of it
    objects.push({
      id: "ex_d" + i, name: "d" + i, type: "text",
      x, y: y + 8, size: 26, color: "#7dff9e", glow: 9, visible: 1, text: "",
      script: [{ event: "code", source: squareCode(i) }]
    });
  }

  objects.push({
    id: "ex_ckbrain", name: "brain", type: "text",
    x: 240, y: 340, size: 13, color: "#2fdc55", glow: 8, visible: 1,
    text: "YOUR MOVE — CLICK A PIECE, THEN A SQUARE",
    script: [{ event: "code", source: brainCode() }]
  });

  objects.push({
    id: "ex_cktitle", name: "title", type: "text",
    x: 240, y: 13, size: 12, color: "#1f8f3c", glow: 4, visible: 1,
    text: "MARK I DRAUGHTS — STRACHEY, 1951 · CAPTURES ARE MANDATORY", script: []
  });

  return { title: "Draughts (1951)", objects };
}

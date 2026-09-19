// example-bertie.js — Bertie the Brain (1950), rebuilt in our studio.
// The original: a 4-meter-tall machine at the Canadian National Exhibition that
// played tic-tac-toe on a lighted board. You pressed a keypad square; Bertie's
// bulbs answered, and a sign lit up when someone won.
//
// Here: click a square to play X. Bertie plays O like the real machine did —
// take a win if one exists, block yours, otherwise center → corners → anything.
// Deterministic, just like relays. Click anywhere after the game ends to reset.
//
// The 9 squares are ordinary text objects with a tiny block script each (a great
// thing to save as a Model). Bertie's whole brain is ONE code block — generated
// below so all 8 winning lines are covered without typos.

const LINES = [
  [1, 2, 3], [4, 5, 6], [7, 8, 9],   // rows
  [1, 4, 7], [2, 5, 8], [3, 6, 9],   // columns
  [1, 5, 9], [3, 5, 7]               // diagonals
];

// Mark values: 0 empty, 1 = player X, 4 = Bertie O.
// A line's sum then uniquely identifies its state:
//   3 = three X (player won)   12 = three O (Bertie won)
//   2 = two X + empty (block!)  8 = two O + empty (win!)

function cellPos(n) {
  const col = (n - 1) % 3, row = Math.floor((n - 1) / 3);
  return { x: 150 + col * 90, y: 90 + row * 80 };
}

function brainCode() {
  const L = [];
  const sums = () => {
    LINES.forEach((ln, i) => {
      L.push(`  set s${i + 1} to cell${ln[0]}.mark + cell${ln[1]}.mark + cell${ln[2]}.mark`);
    });
  };
  const takePass = (sum) => {
    LINES.forEach((ln, i) => {
      L.push(`  if moved == 0 and s${i + 1} == ${sum} then`);
      for (const c of ln) {
        L.push(`    if moved == 0 and cell${c}.mark == 0 then`);
        L.push(`      set take to ${c}`);
        L.push(`      set moved to 1`);
        L.push(`    end`);
      }
      L.push(`  end`);
    });
  };
  const tryCell = (c) => {
    L.push(`  if moved == 0 and cell${c}.mark == 0 then`);
    L.push(`    set take to ${c}`);
    L.push(`    set moved to 1`);
    L.push(`  end`);
  };

  L.push(`when tick`);
  L.push(`if bertieturn == 1 and game == 0 then`);
  L.push(`  set bertieturn to 0`);
  sums();
  // did the player's move just win?
  L.push(`  if s1 == 3 or s2 == 3 or s3 == 3 or s4 == 3 or s5 == 3 or s6 == 3 or s7 == 3 or s8 == 3 then`);
  L.push(`    set game to 1`);
  L.push(`    set self.text to "YOU WIN — YOU BEAT BERTIE!"`);
  L.push(`    say "YOU WIN!" for 3`);
  L.push(`  end`);
  L.push(`  set filled to (cell1.mark != 0) + (cell2.mark != 0) + (cell3.mark != 0) + (cell4.mark != 0) + (cell5.mark != 0) + (cell6.mark != 0) + (cell7.mark != 0) + (cell8.mark != 0) + (cell9.mark != 0)`);
  L.push(`  if game == 0 and filled == 9 then`);
  L.push(`    set game to 3`);
  L.push(`    set self.text to "A DRAW — CLICK TO PLAY AGAIN"`);
  L.push(`  end`);
  // Bertie's move
  L.push(`  if game == 0 then`);
  L.push(`  set moved to 0`);
  L.push(`  set take to 0`);
  takePass(8);          // 1) win if possible
  takePass(2);          // 2) block the player
  tryCell(5);           // 3) center
  tryCell(1); tryCell(3); tryCell(7); tryCell(9);   // 4) corners
  tryCell(2); tryCell(4); tryCell(6); tryCell(8);   // 5) edges
  // place the O
  for (let c = 1; c <= 9; c++) {
    L.push(`  if take == ${c} then`);
    L.push(`    set cell${c}.mark to 4`);
    L.push(`    set cell${c}.text to "O"`);
    L.push(`    set cell${c}.color to "#ff8f5a"`);
    L.push(`  end`);
  }
  // did Bertie just win?
  sums();
  L.push(`  if s1 == 12 or s2 == 12 or s3 == 12 or s4 == 12 or s5 == 12 or s6 == 12 or s7 == 12 or s8 == 12 then`);
  L.push(`    set game to 2`);
  L.push(`    set self.text to "BERTIE WINS — CLICK TO TRY AGAIN"`);
  L.push(`    say "BERTIE WINS" for 3`);
  L.push(`  end`);
  L.push(`  end`);
  L.push(`end`);
  L.push(`end`);
  // click anywhere after the game ends → reset the board
  L.push(`when click`);
  L.push(`if game != 0 then`);
  L.push(`  set game to 0`);
  L.push(`  set bertieturn to 0`);
  for (let c = 1; c <= 9; c++) {
    L.push(`  set cell${c}.mark to 0`);
    L.push(`  set cell${c}.text to "·"`);
    L.push(`  set cell${c}.color to "#1f8f3c"`);
  }
  L.push(`  set self.text to "YOU ARE X — CLICK A SQUARE"`);
  L.push(`end`);
  L.push(`end`);
  return L.join("\n");
}

export function buildBertieExample() {
  const cells = [];
  for (let n = 1; n <= 9; n++) {
    const { x, y } = cellPos(n);
    cells.push({
      id: "ex_cell" + n, name: "cell" + n, type: "text",
      x, y, size: 44, color: "#1f8f3c", glow: 10, visible: 1, text: "·",
      script: [
        {
          event: "start", body: [
            { k: "set", lhs: "self.mark", value: "0" },
            { k: "set", lhs: "self.text", value: '"·"' }
          ]
        },
        {
          // each square handles its own click — this whole object makes a great Model
          event: "click", body: [
            {
              k: "if",
              cond: "game == 0 and self.mark == 0 and abs(mousex() - self.x) < 42 and abs(mousey() - self.y) < 38",
              then: [
                { k: "set", lhs: "self.mark", value: "1" },
                { k: "set", lhs: "self.text", value: '"X"' },
                { k: "set", lhs: "self.color", value: '"#7dff9e"' },
                { k: "set", lhs: "bertieturn", value: "1" }
              ],
              else: []
            }
          ]
        }
      ]
    });
  }

  const brain = {
    id: "ex_brain", name: "brain", type: "text",
    x: 240, y: 340, size: 15, color: "#2fdc55", glow: 8, visible: 1,
    text: "YOU ARE X — CLICK A SQUARE",
    script: [
      { event: "start", body: [
        { k: "set", lhs: "game", value: "0" },
        { k: "set", lhs: "bertieturn", value: "0" },
        { k: "set", lhs: "self.text", value: '"YOU ARE X — CLICK A SQUARE"' }
      ] },
      { event: "code", source: brainCode() }
    ]
  };

  const title = {
    id: "ex_title", name: "title", type: "text",
    x: 240, y: 30, size: 18, color: "#8dffa9", glow: 12, visible: 1,
    text: "BERTIE THE BRAIN — 1950", script: []
  };

  return {
    title: "Bertie the Brain (1950)",
    objects: [...cells, brain, title]
  };
}

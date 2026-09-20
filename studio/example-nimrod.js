// example-nimrod.js — NIMROD (1951), rebuilt in our studio.
// The original: Ferranti built an entire computer for the Festival of Britain
// that did exactly one thing — play Nim, on a wall of lights, and beat almost
// everyone using the nim-sum (XOR) strategy.
//
// Here: four rows of lights (1-3-5-7). On your turn, click a light — it and
// every light to its right in that row go out (that's how you take 1..N from
// one row with a single click, phone-friendly). Take the LAST light and you
// win. NIMROD plays mathematically perfect Nim: it XORs the rows, and if the
// nim-sum isn't zero it makes it zero. Beat it and you out-mathed a computer
// that humbled the public in 1951. (Tip: it CAN be beaten — if you move first
// and always leave the nim-sum at zero.)
//
// This example is also the debut of RedScript's math ops: `%` and `xor(a,b)`.

const SIZES = [1, 3, 5, 7];      // row sizes, rows 1..4 top to bottom
const ROW_Y = [88, 138, 188, 238];
const SPACING = 42;

function lightPos(row, pos) {
  const size = SIZES[row - 1];
  const x = 240 - ((size - 1) * SPACING) / 2 + (pos - 1) * SPACING;
  return { x, y: ROW_Y[row - 1] };
}

function brainCode() {
  const L = [];
  const total = "h1 + h2 + h3 + h4";

  L.push("when tick");
  // ---- process the player's move ----
  L.push("if playermoved == 1 then");
  L.push("  set playermoved to 0");
  L.push(`  if ${total} == 0 then`);
  L.push("    set game to 1");
  L.push('    set self.text to "YOU TOOK THE LAST LIGHT — YOU WIN!"');
  L.push('    say "YOU BEAT NIMROD!" for 3');
  L.push("  else");
  L.push("    set nimturn to 1");
  L.push("    set nimdelay to 45");
  L.push('    set self.text to "NIMROD IS THINKING…"');
  L.push("  end");
  L.push("end");

  // ---- NIMROD's move (after a short think, like the real light panel) ----
  L.push("if nimturn == 1 and game == 0 then");
  L.push("  set nimdelay to nimdelay - 1");
  L.push("  if nimdelay <= 0 then");
  L.push("    set nimturn to 0");
  L.push("    set s to xor(xor(h1, h2), xor(h3, h4))");
  L.push("    set moved to 0");
  // winning move: reduce one row so the nim-sum becomes zero
  L.push("    if s != 0 then");
  for (let i = 1; i <= 4; i++) L.push(`      set t${i} to xor(h${i}, s)`);
  for (let i = 1; i <= 4; i++) {
    L.push(`      if moved == 0 and t${i} < h${i} then`);
    L.push(`        set h${i} to t${i}`);
    L.push("        set moved to 1");
    L.push("      end");
  }
  L.push("    end");
  // losing position: stall — take a single light from the biggest row
  L.push("    if moved == 0 then");
  L.push("      if h1 >= h2 and h1 >= h3 and h1 >= h4 and h1 > 0 then");
  L.push("        set h1 to h1 - 1");
  L.push("        set moved to 1");
  L.push("      end");
  L.push("      if moved == 0 and h2 >= h3 and h2 >= h4 and h2 > 0 then");
  L.push("        set h2 to h2 - 1");
  L.push("        set moved to 1");
  L.push("      end");
  L.push("      if moved == 0 and h3 >= h4 and h3 > 0 then");
  L.push("        set h3 to h3 - 1");
  L.push("        set moved to 1");
  L.push("      end");
  L.push("      if moved == 0 and h4 > 0 then");
  L.push("        set h4 to h4 - 1");
  L.push("        set moved to 1");
  L.push("      end");
  L.push("    end");
  L.push(`    if ${total} == 0 then`);
  L.push("      set game to 2");
  L.push('      set self.text to "NIMROD TOOK THE LAST LIGHT — NIMROD WINS"');
  L.push('      say "NIMROD WINS" for 3');
  L.push("    else");
  L.push('      set self.text to "YOUR TURN — CLICK A LIGHT"');
  L.push("    end");
  L.push("  end");
  L.push("end");

  // ---- keep every light's bulb matching its row count ----
  for (let r = 1; r <= 4; r++) {
    for (let p = 1; p <= SIZES[r - 1]; p++) {
      L.push(`set l${r}${p}.visible to (${p} <= h${r})`);
    }
  }
  L.push("end");

  // ---- click after the game ends → reset the machine ----
  L.push("when click");
  L.push("if game != 0 then");
  L.push("  set game to 0");
  L.push("  set nimturn to 0");
  L.push("  set playermoved to 0");
  SIZES.forEach((s, i) => L.push(`  set h${i + 1} to ${s}`));
  L.push('  set self.text to "YOUR TURN — CLICK A LIGHT"');
  L.push("end");
  L.push("end");
  return L.join("\n");
}

export function buildNimrodExample() {
  const lights = [];
  for (let r = 1; r <= 4; r++) {
    for (let p = 1; p <= SIZES[r - 1]; p++) {
      const { x, y } = lightPos(r, p);
      lights.push({
        id: `ex_l${r}${p}`, name: `l${r}${p}`, type: "dot",
        x, y, size: 20, color: "#ffe94a", glow: 16, visible: 1, text: "",
        script: [
          {
            // taking lights: this bulb + everything to its right goes out
            event: "click", body: [
              {
                k: "if",
                cond: `game == 0 and nimturn == 0 and playermoved == 0 and ${p} <= h${r} and abs(mousex() - self.x) < 20 and abs(mousey() - self.y) < 22`,
                then: [
                  { k: "set", lhs: `h${r}`, value: `${p - 1}` },
                  { k: "set", lhs: "playermoved", value: "1" }
                ],
                else: []
              }
            ]
          }
        ]
      });
    }
  }

  const brain = {
    id: "ex_nimbrain", name: "brain", type: "text",
    x: 240, y: 300, size: 15, color: "#2fdc55", glow: 8, visible: 1,
    text: "YOUR TURN — CLICK A LIGHT",
    script: [
      { event: "start", body: [
        { k: "set", lhs: "h1", value: "1" },
        { k: "set", lhs: "h2", value: "3" },
        { k: "set", lhs: "h3", value: "5" },
        { k: "set", lhs: "h4", value: "7" },
        { k: "set", lhs: "game", value: "0" },
        { k: "set", lhs: "nimturn", value: "0" },
        { k: "set", lhs: "playermoved", value: "0" },
        { k: "set", lhs: "self.text", value: '"YOUR TURN — CLICK A LIGHT"' }
      ] },
      { event: "code", source: brainCode() }
    ]
  };

  const title = {
    id: "ex_nimtitle", name: "title", type: "text",
    x: 240, y: 30, size: 18, color: "#8dffa9", glow: 12, visible: 1,
    text: "NIMROD — 1951", script: []
  };

  const rules = {
    id: "ex_nimrules", name: "rules", type: "text",
    x: 240, y: 336, size: 11, color: "#1f8f3c", glow: 4, visible: 1,
    text: "CLICK A LIGHT: IT AND ALL TO ITS RIGHT GO OUT · LAST LIGHT WINS",
    script: []
  };

  return {
    title: "NIMROD (1951)",
    objects: [...lights, brain, title, rules]
  };
}

// example-mouse.js — Mouse in the Maze (1959), rebuilt in our studio.
// On MIT's TX-0, you drew maze walls with a LIGHT PEN, dropped a piece of
// cheese, and a little dot-mouse hunted for it. The magic: the mouse LEARNED —
// after finding the cheese once, it remembered the route and ran it straight.
// (In the infamous other version it hunted martinis and got wobblier each one.)
//
// Here the light pen is your finger/mouse: WALLS mode toggles cells, drop the
// CHEESE and the MOUSE, hit ▶ RUN. First run: real depth-first search, dead
// ends and backtracking on full display (the faint trail is its memory of
// where it's been). It learns the winning path — run again and it goes
// STRAIGHT there. Change the maze and it notices mid-run and relearns.
// A game that contains a level editor — very RedlineStudio.

const W = 15, H = 10, CS = 30, GX = 15, GY = 30;
const cellCX = (i) => GX + (i % W) * CS + CS / 2;
const cellCY = (i) => GY + Math.floor(i / W) * CS + CS / 2;

// default maze (drawn like the TX-0 demo reel — plenty of dead ends)
const DEFAULT_MAZE = [
  "...............",
  "..####.####.##.",
  "......#....#...",
  ".####.#.##.#.#.",
  ".#....#.#..#.#.",
  ".#.####.#.##.#.",
  ".#.#....#..#.#.",
  ".#.#.####.##.#.",
  ".#...#.....#...",
  "..............."
];
const DEFAULT_CHEESE = 6 * W + 5;   // tucked in a pocket
const DEFAULT_START = 0;

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);
  const setMarker = (obj, cellVar, pad) => {
    push(`${pad}set ${obj}.x to ${GX} + (${cellVar} % ${W}) * ${CS} + ${CS / 2}`);
    push(`${pad}set ${obj}.y to ${GY} + floor(${cellVar} / ${W}) * ${CS} + ${CS / 2}`);
  };

  // ---------------- start ----------------
  push("when start");
  push("set i to 0");
  push(`repeat ${W * H}`);
  push("  set maze[i] to 0");
  push("  set visited[i] to 0");
  push("  set i to i + 1");
  push("end");
  DEFAULT_MAZE.forEach((row, r) => {
    [...row].forEach((ch, c) => { if (ch === "#") push(`set maze[${r * W + c}] to 1`); });
  });
  push(`set cheese to ${DEFAULT_CHEESE}`);
  push(`set mstart to ${DEFAULT_START}`);
  push("set mcell to mstart");
  push("set mode to 0");
  push("set running to 0");
  push("set phase to 0");
  push("set trail to 0");
  push("set learnedlen to 0");
  push("set wins to 0");
  push("set steptimer to 0");
  push('set self.text to "LIGHT PEN READY — DRAW WALLS, THEN ▶ RUN"');
  push("end");

  // ---------------- tick ----------------
  push("when tick");
  // markers follow their cells; the mouse glides toward its cell (TX-0 dot style)
  setMarker("cheesedot", "cheese", "");
  setMarker("startring", "mstart", "");
  push(`set tx to ${GX} + (mcell % ${W}) * ${CS} + ${CS / 2}`);
  push(`set ty to ${GY} + floor(mcell / ${W}) * ${CS} + ${CS / 2}`);
  push("set mousedot.x to mousedot.x + (tx - mousedot.x) * 0.4");
  push("set mousedot.y to mousedot.y + (ty - mousedot.y) * 0.4");

  push("if running == 1 then");
  push("  set steptimer to steptimer - 1");
  push("  if steptimer <= 0 then");

  // ======== PHASE 1: depth-first search (the stack IS the current path) ========
  push("    if phase == 1 then");
  push("      set steptimer to 3");
  push("      set cur to stack[sp - 1]");
  push("      if cur == cheese then");
  // learned! the stack holds the clean route start→cheese
  push("        set learnedlen to sp");
  push("        set i to 0");
  push("        repeat 200");
  push("          if i < sp then");
  push("            set learned[i] to stack[i]");
  push("          end");
  push("          set i to i + 1");
  push("        end");
  push("        set running to 0");
  push("        set phase to 0");
  push("        set wins to wins + 1");
  push("        explode cheesedot");
  push('        say "CHEESE! PATH LEARNED" for 2');
  push('        set self.text to "LEARNED A " + (learnedlen - 1) + "-STEP PATH — ▶ RUN AGAIN TO SEE IT REMEMBER"');
  push("      else");
  // try neighbors: up, right, down, left — first unvisited open one
  push("        set nxt to -1");
  push(`        set cand to cur - ${W}`);
  push("        if cand >= 0 and maze[cand] == 0 and visited[cand] == 0 then");
  push("          set nxt to cand");
  push("        end");
  push("        set cand to cur + 1");
  push(`        if nxt < 0 and cand % ${W} != 0 and maze[cand] == 0 and visited[cand] == 0 then`);
  push("          set nxt to cand");
  push("        end");
  push(`        set cand to cur + ${W}`);
  push(`        if nxt < 0 and cand < ${W * H} and maze[cand] == 0 and visited[cand] == 0 then`);
  push("          set nxt to cand");
  push("        end");
  push("        set cand to cur - 1");
  push(`        if nxt < 0 and cur % ${W} != 0 and maze[cand] == 0 and visited[cand] == 0 then`);
  push("          set nxt to cand");
  push("        end");
  push("        if nxt >= 0 then");
  push("          set visited[nxt] to 1");
  push("          set stack[sp] to nxt");
  push("          set sp to sp + 1");
  push("          set mcell to nxt");
  push("        else");
  push("          set sp to sp - 1");         // dead end — backtrack
  push("          if sp <= 0 then");
  push("            set running to 0");
  push("            set phase to 0");
  push('            say "NO WAY TO THE CHEESE!" for 2.5');
  push('            set self.text to "THE MOUSE GAVE UP — OPEN A PATH AND ▶ RUN"');
  push("          else");
  push("            set mcell to stack[sp - 1]");
  push("          end");
  push("        end");
  push("      end");
  push("    end");

  // ======== PHASE 2: replaying the remembered path ========
  push("    if phase == 2 then");
  push("      set steptimer to 2");
  push("      set nxt to learned[ridx]");
  push("      if maze[nxt] == 1 then");
  // the maze changed under its feet — forget and search again from here
  push("        set learnedlen to 0");
  push('        say "THE MAZE CHANGED! RELEARNING…" for 2');
  push("        set i to 0");
  push(`        repeat ${W * H}`);
  push("          set visited[i] to 0");
  push("          set i to i + 1");
  push("        end");
  push("        set visited[mcell] to 1");
  push("        set stack[0] to mcell");
  push("        set sp to 1");
  push("        set phase to 1");
  push("        set trail to 1");
  push("      else");
  push("        set mcell to nxt");
  push("        set ridx to ridx + 1");
  push("        if mcell == cheese then");
  push("          set running to 0");
  push("          set phase to 0");
  push("          set wins to wins + 1");
  push("          explode cheesedot");
  push('          say "STRAIGHT THERE — I REMEMBERED!" for 2');
  push('          set self.text to "PERFECT RECALL. EDIT THE MAZE TO CONFUSE IT!"');
  push("          if wins >= 4 then");
  push('            say "…THE MOUSE WOULD PREFER A MARTINI NOW" for 3');
  push("          end");
  push("        end");
  push("      end");
  push("    end");

  push("  end");
  push("end");
  push("end");

  // ---------------- click (the light pen) ----------------
  push("when click");
  push("set mx to mousex()");
  push("set my to mousey()");
  push("if running == 1 then");
  // only the RUN button works mid-run (it stops)
  push("  if abs(mx - 312) < 40 and abs(my - 345) < 12 then");
  push("    set running to 0");
  push("    set phase to 0");
  push('    set self.text to "STOPPED — LIGHT PEN READY"');
  push("  end");
  push("else");
  push("  set handled to 0");
  // mode buttons
  push("  if abs(my - 345) < 12 then");
  push("    if abs(mx - 50) < 42 then");
  push("      set mode to 0");
  push("      set handled to 1");
  push('      set self.text to "WALLS — CLICK CELLS TO DRAW OR ERASE"');
  push("    end");
  push("    if abs(mx - 140) < 44 then");
  push("      set mode to 1");
  push("      set handled to 1");
  push('      set self.text to "CHEESE — CLICK WHERE THE CHEESE GOES"');
  push("    end");
  push("    if abs(mx - 228) < 40 then");
  push("      set mode to 2");
  push("      set handled to 1");
  push('      set self.text to "MOUSE — CLICK WHERE THE MOUSE STARTS"');
  push("    end");
  // RUN
  push("    if abs(mx - 312) < 40 then");
  push("      set handled to 1");
  push("      if learnedlen > 0 then");
  push("        set phase to 2");
  push("        set ridx to 0");
  push("        set mcell to mstart");
  push("        set trail to 0");
  push('        set self.text to "REPLAYING FROM MEMORY…"');
  push("      else");
  push("        set i to 0");
  push(`        repeat ${W * H}`);
  push("          set visited[i] to 0");
  push("          set i to i + 1");
  push("        end");
  push("        set mcell to mstart");
  push("        set visited[mstart] to 1");
  push("        set stack[0] to mstart");
  push("        set sp to 1");
  push("        set phase to 1");
  push("        set trail to 1");
  push('        set self.text to "SEARCHING… (WATCH IT BACKTRACK)"');
  push("      end");
  push("      set running to 1");
  push("      set steptimer to 1");
  push("    end");
  // CLEAR
  push("    if abs(mx - 412) < 42 then");
  push("      set handled to 1");
  push("      set i to 0");
  push(`      repeat ${W * H}`);
  push("        set maze[i] to 0");
  push("        set visited[i] to 0");
  push("        set i to i + 1");
  push("      end");
  push("      set learnedlen to 0");
  push("      set trail to 0");
  push('      set self.text to "BLANK SLATE — DRAW A MAZE"');
  push("    end");
  push("  end");
  // the grid itself
  push(`  if handled == 0 and mx >= ${GX} and mx < ${GX + W * CS} and my >= ${GY} and my < ${GY + H * CS} then`);
  push(`    set q to floor((my - ${GY}) / ${CS}) * ${W} + floor((mx - ${GX}) / ${CS})`);
  push("    if mode == 0 then");
  push("      if q != cheese and q != mstart then");
  push("        set maze[q] to 1 - maze[q]");
  push("      end");
  push("    end");
  push("    if mode == 1 and maze[q] == 0 then");
  push("      set cheese to q");
  push("      set learnedlen to 0");   // new cheese, old memory useless
  push("    end");
  push("    if mode == 2 and maze[q] == 0 then");
  push("      set mstart to q");
  push("      set mcell to q");
  push("      set learnedlen to 0");
  push("    end");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

// per-cell display scripts
const wallScript = (i) => [{ event: "code", source: `when tick\nset self.visible to (maze[${i}] == 1)\nend` }];
const trailScript = (i) => [{ event: "code", source: `when tick\nset self.visible to (trail == 1 and visited[${i}] == 1)\nend` }];
const btnScript = (m) => [{ event: "code", source: `when tick\nif mode == ${m} and running == 0 then\n  set self.glow to 20\nelse\n  set self.glow to 6\nend\nend` }];

export function buildMouseExample() {
  const objects = [];

  for (let i = 0; i < W * H; i++) {
    objects.push({
      id: "mz_w" + i, name: "w" + i, type: "box",
      x: cellCX(i), y: cellCY(i), size: 28, color: "#155c2e", glow: 3, visible: 0, text: "",
      script: wallScript(i)
    });
    objects.push({
      id: "mz_t" + i, name: "t" + i, type: "dot",
      x: cellCX(i), y: cellCY(i), size: 4, color: "#1f8f3c", glow: 3, visible: 0, text: "",
      script: trailScript(i)
    });
  }

  objects.push({
    id: "mz_cheese", name: "cheesedot", type: "dot",
    x: cellCX(DEFAULT_CHEESE), y: cellCY(DEFAULT_CHEESE),
    size: 11, color: "#ffd75e", glow: 16, visible: 1, text: "", script: []
  });
  objects.push({
    id: "mz_startring", name: "startring", type: "ring",
    x: cellCX(DEFAULT_START), y: cellCY(DEFAULT_START),
    size: 10, color: "#1f8f3c", glow: 6, visible: 1, text: "", script: []
  });
  objects.push({
    id: "mz_mouse", name: "mousedot", type: "dot",
    x: cellCX(DEFAULT_START), y: cellCY(DEFAULT_START),
    size: 9, color: "#d8ffe2", glow: 18, visible: 1, text: "", script: []
  });

  objects.push({
    id: "mz_brain", name: "brain", type: "text",
    x: 240, y: 16, size: 12, color: "#2fdc55", glow: 8, visible: 1,
    text: "LIGHT PEN READY — DRAW WALLS, THEN ▶ RUN",
    script: [{ event: "code", source: brainCode() }]
  });

  const btn = (id, name, x, label, color, mode) => objects.push({
    id, name, type: "text", x, y: 349, size: 14, color, glow: 6, visible: 1,
    text: label, script: mode == null ? [] : btnScript(mode)
  });
  btn("mz_bw", "wallsbtn", 50, "[ WALLS ]", "#7dff9e", 0);
  btn("mz_bc", "cheesebtn", 140, "[ CHEESE ]", "#ffd75e", 1);
  btn("mz_bm", "mousebtn", 228, "[ MOUSE ]", "#d8ffe2", 2);
  btn("mz_br", "runbtn", 312, "[ ▶ RUN ]", "#ff9d4a", null);
  btn("mz_bx", "clearbtn", 412, "[ CLEAR ]", "#ff5a55", null);

  return { title: "Mouse in the Maze (1959)", objects };
}

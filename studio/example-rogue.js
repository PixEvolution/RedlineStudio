// example-rogue.js — ROGUE (1980), rebuilt in our studio.
//
// Two Berkeley students with a text terminal and a dangerous idea: what if
// the dungeon was DIFFERENT every time, and death was FOREVER? No saved
// games, no memorized maps, no mercy — just an @ sign, a procedurally
// dealt dungeon, and monsters wearing the letters of their own names.
// It named an entire genre: every "roguelike" since is downstream of this.
//
// Ours deals the whole thing on the engine's teletype, like the original:
//   · a NEW dungeon every floor: six rooms diced and corridor-stitched,
//     never the same twice (your own eyes are the proof — die and look)
//   · bump to fight: walk into a letter to swing; adjacent letters
//     swing back on their turn
//   · B bat · R rat · O orc · Z zombie · T troll · D demon — each floor
//     deals meaner letters with deeper teeth
//   · * gold (the score) · ! potions (quaffed on contact) · > stairs down
//   · on floor 5 waits the AMULET (&) — touch it and the run is WON
//   · and the rule that made the legend: PERMADEATH. hp 0 is the end.
//
//   WASD / arrows step · SPACE holds your ground · one @, one life

const GW = 30, GH = 14;
const NM = 4, NGOLD = 4, NPOT = 2;
// monster letters and teeth by floor: [type of each spawn] type 1..6
const FLOORMOBS = [null, [1, 1, 2, 2], [2, 2, 3, 3], [3, 3, 4, 4], [4, 4, 5, 5], [5, 5, 6, 6]];
const MLETTER = ["", "B", "R", "O", "Z", "T", "D"];

export function buildRogueExample() {
  const L = [];
  const push = (s) => L.push(s);

  // ---- deal a floor: six diced rooms, corridor-stitched, stocked
  const genFloor = (pad) => {
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${GW * GH}`);
    push(`${pad}  set tl[i] to 0`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    // rooms in a 3×2 lattice of slots
    push(`${pad}set r to 0`);
    push(`${pad}repeat 6`);
    push(`${pad}  set sx to (r % 3) * 10`);
    push(`${pad}  set sy to floor(r / 3) * 7`);
    push(`${pad}  set rw[r] to 5 + floor(rand(0, 3))`);
    push(`${pad}  set rh[r] to 4 + floor(rand(0, 2))`);
    push(`${pad}  set rx0[r] to sx + 1`);
    push(`${pad}  set ry0[r] to sy + 1`);
    push(`${pad}  set rcx[r] to rx0[r] + floor(rw[r] / 2)`);
    push(`${pad}  set rcy[r] to ry0[r] + floor(rh[r] / 2)`);
    push(`${pad}  set yy to ry0[r]`);
    push(`${pad}  repeat rh[r]`);
    push(`${pad}    set xx to rx0[r]`);
    push(`${pad}    repeat rw[r]`);
    push(`${pad}      set tl[yy * ${GW} + xx] to 1`);
    push(`${pad}      set xx to xx + 1`);
    push(`${pad}    end`);
    push(`${pad}    set yy to yy + 1`);
    push(`${pad}  end`);
    push(`${pad}  set r to r + 1`);
    push(`${pad}end`);
    // corridors: an L between each stitched pair
    const PAIRS = [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [2, 5]];
    for (const [a, b] of PAIRS) {
      push(`${pad}set cax to rcx[${a}]`);
      push(`${pad}set cay to rcy[${a}]`);
      push(`${pad}set cbx to rcx[${b}]`);
      push(`${pad}set cby to rcy[${b}]`);
      push(`${pad}set stp to 1`);
      push(`${pad}if cbx < cax then`);
      push(`${pad}  set stp to -1`);
      push(`${pad}end`);
      push(`${pad}set cxx to cax`);
      push(`${pad}repeat abs(cbx - cax) + 1`);
      push(`${pad}  if tl[cay * ${GW} + cxx] == 0 then`);
      push(`${pad}    set tl[cay * ${GW} + cxx] to 2`);
      push(`${pad}  end`);
      push(`${pad}  set cxx to cxx + stp`);
      push(`${pad}end`);
      push(`${pad}set stp to 1`);
      push(`${pad}if cby < cay then`);
      push(`${pad}  set stp to -1`);
      push(`${pad}end`);
      push(`${pad}set cyy to cay`);
      push(`${pad}repeat abs(cby - cay) + 1`);
      push(`${pad}  if tl[cyy * ${GW} + cbx] == 0 then`);
      push(`${pad}    set tl[cyy * ${GW} + cbx] to 2`);
      push(`${pad}  end`);
      push(`${pad}  set cyy to cyy + stp`);
      push(`${pad}end`);
    }
    // the @ wakes in one room; the way down (or the AMULET) waits in another
    push(`${pad}set proom to floor(rand(0, 6))`);
    push(`${pad}set px to rcx[proom]`);
    push(`${pad}set py to rcy[proom]`);
    push(`${pad}set sroom to (proom + 3) % 6`);
    push(`${pad}set stx to rcx[sroom]`);
    push(`${pad}set sty to rcy[sroom]`);
    // gold and potions on random room floor
    for (let g = 0; g < NGOLD; g++) {
      push(`${pad}set rr to floor(rand(0, 6))`);
      push(`${pad}set gon[${g}] to 1`);
      push(`${pad}set gpx[${g}] to rx0[rr] + floor(rand(0, rw[rr]))`);
      push(`${pad}set gpy[${g}] to ry0[rr] + floor(rand(0, rh[rr]))`);
      push(`${pad}set gpv[${g}] to 10 + floor(rand(0, 30)) + dfloor * 5`);
    }
    for (let p = 0; p < NPOT; p++) {
      push(`${pad}set rr to floor(rand(0, 6))`);
      push(`${pad}set pon[${p}] to 1`);
      push(`${pad}set ppx[${p}] to rx0[rr] + floor(rand(0, rw[rr]))`);
      push(`${pad}set ppy[${p}] to ry0[rr] + floor(rand(0, rh[rr]))`);
    }
    // the letters, meaner by the floor
    for (let m = 0; m < NM; m++) {
      push(`${pad}set rr to floor(rand(0, 6))`);
      push(`${pad}if rr == proom then`);
      push(`${pad}  set rr to (rr + 1) % 6`);
      push(`${pad}end`);
      push(`${pad}set ma[${m}] to 1`);
      push(`${pad}set mtp[${m}] to fm${m}`);
      push(`${pad}set mhp[${m}] to 2 + fm${m} * 2`);
      push(`${pad}set mx[${m}] to rx0[rr] + floor(rand(0, rw[rr]))`);
      push(`${pad}set my[${m}] to ry0[rr] + floor(rand(0, rh[rr]))`);
    }
    push(`${pad}set needdraw to 1`);
  };
  const floorMobs = (pad) => {
    for (let f = 1; f <= 5; f++) {
      push(`${pad}if dfloor == ${f} then`);
      for (let m = 0; m < NM; m++) push(`${pad}  set fm${m} to ${FLOORMOBS[f][m]}`);
      push(`${pad}end`);
    }
  };

  const attractScreen = (pad) => {
    push(`${pad}clear`);
    push(`${pad}print ""`);
    push(`${pad}print "  ██ ROGUE ██  — 1980, ON A TELETYPE NEAR YOU"`);
    push(`${pad}print ""`);
    push(`${pad}print "  a NEW dungeon every time. death is FOREVER."`);
    push(`${pad}print "  the game that named the roguelike."`);
    push(`${pad}print ""`);
    push(`${pad}print "  @  is you.  the letters are not your friends:"`);
    push(`${pad}print "  B bat   R rat   O orc   Z zombie   T troll   D demon"`);
    push(`${pad}print ""`);
    push(`${pad}print "  * gold    ! potion    > down    &  THE AMULET (floor 5)"`);
    push(`${pad}print ""`);
    push(`${pad}print "  WASD / ARROWS step · SPACE waits · BUMP a letter to fight"`);
    push(`${pad}print ""`);
    push(`${pad}print "  ◎ INSERT COIN — CLICK TO DESCEND ◎"`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set endplay to 0");
  attractScreen("");
  push("end");

  // ======== click
  push("when click");
  push("if game == 9 then");
  push("  set game to 0");
  push("  set endplay to 0");
  push("  set score to 0");
  push("  set gold to 0");
  push("  set hp to 20");
  push("  set maxhp to 20");
  push("  set dfloor to 1");
  floorMobs("  ");
  genFloor("  ");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  attractScreen("    ");
  push("  end");
  push("end");
  push("end");

  // ======== tick: keys → one TURN; then the letters move; then redraw
  push("when tick");
  push("if game == 0 then");
  push("  set dirx to 0");
  push("  set diry to 0");
  push("  set act to 0");
  const key = (expr, flag, dx, dy) => {
    push(`  set pk to ${expr}`);
    push(`  if pk >= 1 and ${flag} == 0 then`);
    push("    set act to 1");
    push(`    set dirx to ${dx}`);
    push(`    set diry to ${dy}`);
    push("  end");
    push(`  set ${flag} to pk`);
  };
  key('keydown("d") + keydown("ArrowRight")', "pkd", 1, 0);
  key('keydown("a") + keydown("ArrowLeft")', "pka", -1, 0);
  key('keydown("s") + keydown("ArrowDown")', "pks", 0, 1);
  key('keydown("w") + keydown("ArrowUp")', "pkw", 0, -1);
  key('keydown("Space")', "pkp", 0, 0);

  push("  if act == 1 then");
  push("    set nx to max(0, min(" + (GW - 1) + ", px + dirx))");
  push("    set ny to max(0, min(" + (GH - 1) + ", py + diry))");
  // bump a letter → a swing
  push("    set fought to 0");
  push("    set m to 0");
  push(`    repeat ${NM}`);
  push("      if ma[m] == 1 and mx[m] == nx and my[m] == ny and (dirx != 0 or diry != 0) then");
  push("        set fought to 1");
  push("        set mhp[m] to mhp[m] - (2 + floor(rand(0, 4)))");
  push("        beep 220 for 0.05");
  push("        if mhp[m] <= 0 then");
  push("          set ma[m] to 0");
  push("          change score by mtp[m] * 10");
  push("          beep 140 for 0.1");
  push('          print "> the " + ml[mtp[m]] + " dies."');
  push("        end");
  push("      end");
  push("      set m to m + 1");
  push("    end");
  // or step, if the dungeon allows it
  push("    if fought == 0 and tl[ny * " + GW + " + nx] > 0 then");
  push("      set px to nx");
  push("      set py to ny");
  push("    end");
  // the floor's offerings
  for (let g = 0; g < NGOLD; g++) {
    push(`    if gon[${g}] == 1 and gpx[${g}] == px and gpy[${g}] == py then`);
    push(`      set gon[${g}] to 0`);
    push(`      set gold to gold + gpv[${g}]`);
    push(`      change score by gpv[${g}]`);
    push("      beep 660 for 0.06");
    push(`      print "> " + gpv[${g}] + " gold."`);
    push("    end");
  }
  for (let p = 0; p < NPOT; p++) {
    push(`    if pon[${p}] == 1 and ppx[${p}] == px and ppy[${p}] == py then`);
    push(`      set pon[${p}] to 0`);
    push("      set hp to min(maxhp, hp + 8)");
    push("      beep 784 for 0.08");
    push('      print "> you quaff the potion. warmth returns."');
    push("    end");
  }
  // the way down — or the AMULET
  push("    if dfloor < 5 and px == stx and py == sty then");
  push("      set dfloor to dfloor + 1");
  push("      set maxhp to maxhp + 2");
  push("      set hp to min(maxhp, hp + 4)");
  push("      beep 262 for 0.08");
  push("      beep 196 for 0.1");
  floorMobs("      ");
  genFloor("      ");
  push("    else");
  push("      if dfloor == 5 and px == stx and py == sty then");
  push("        change score by 1000");
  push("        set game to 2");
  push("        set endplay to 1");
  push("        beep 523 for 0.1");
  push("        beep 659 for 0.1");
  push("        beep 784 for 0.1");
  push("        beep 1047 for 0.3");
  push('        print ""');
  push('        print "  ███ YOU HOLD THE AMULET ███"');
  push('        print "  the run is WON. very few ever see this line."');
  push('        print "  CLICK to let someone else try."');
  push("      end");
  push("    end");

  // ---- the letters take their turn
  push("    if game == 0 then");
  push("      set m to 0");
  push(`      repeat ${NM}`);
  push("        if ma[m] == 1 then");
  push("          set adx to px - mx[m]");
  push("          set ady to py - my[m]");
  push("          if abs(adx) + abs(ady) == 1 then");
  // adjacent: teeth
  push("            set hp to hp - (1 + floor(rand(0, mtp[m] + 1)))");
  push("            beep 110 for 0.06");
  push("          else");
  // bats flap at random; the rest advance
  push("            set wdx to 0");
  push("            set wdy to 0");
  push("            if mtp[m] == 1 then");
  push("              set rr to floor(rand(0, 4))");
  push("              if rr == 0 then");
  push("                set wdx to 1");
  push("              end");
  push("              if rr == 1 then");
  push("                set wdx to -1");
  push("              end");
  push("              if rr == 2 then");
  push("                set wdy to 1");
  push("              end");
  push("              if rr == 3 then");
  push("                set wdy to -1");
  push("              end");
  push("            else");
  push("              if abs(adx) + abs(ady) < 11 then");
  push("                if abs(adx) > abs(ady) then");
  push("                  set wdx to max(-1, min(1, adx))");
  push("                else");
  push("                  set wdy to max(-1, min(1, ady))");
  push("                end");
  push("              end");
  push("            end");
  push("            set wx2 to mx[m] + wdx");
  push("            set wy2 to my[m] + wdy");
  push("            set free to 1");
  push(`            if tl[wy2 * ${GW} + wx2] == 0 then`);
  push("              set free to 0");
  push("            end");
  push("            if wx2 == px and wy2 == py then");
  push("              set free to 0");
  push("            end");
  push("            set k to 0");
  push(`            repeat ${NM}`);
  push("              if k != m and ma[k] == 1 and mx[k] == wx2 and my[k] == wy2 then");
  push("                set free to 0");
  push("              end");
  push("              set k to k + 1");
  push("            end");
  push("            if free == 1 then");
  push("              set mx[m] to wx2");
  push("              set my[m] to wy2");
  push("            end");
  push("          end");
  push("        end");
  push("        set m to m + 1");
  push("      end");
  // permadeath — the rule that made the legend
  push("      if hp <= 0 then");
  push("        set hp to 0");
  push("        set game to 2");
  push("        set endplay to 1");
  push("        beep 150 for 0.2");
  push("        beep 98 for 0.3");
  push('        print ""');
  push('        print "  ██ YOU DIED ON FLOOR " + dfloor + " ██"');
  push('        print "  permadeath is the point. this run is gone forever."');
  push('        print "  CLICK to start a life that will also end."');
  push("      end");
  push("    end");
  push("    if game == 0 then");
  push("      set needdraw to 1");
  push("    end");
  push("  end");

  // ---- the teletype draws the whole dungeon
  push("  if needdraw == 1 then");
  push("    set needdraw to 0");
  push("    clear");
  push('    print "ROGUE · FLOOR " + dfloor + " · HP " + hp + "/" + maxhp + " · GOLD " + gold + " · THE AMULET WAITS ON 5"');
  push("    set ry to 0");
  push(`    repeat ${GH}`);
  push('      set row to ""');
  push("      set rx to 0");
  push(`      repeat ${GW}`);
  push('        set ch to " "');
  push(`        if tl[ry * ${GW} + rx] == 1 then`);
  push('          set ch to "."');
  push("        end");
  push(`        if tl[ry * ${GW} + rx] == 2 then`);
  push('          set ch to "#"');
  push("        end");
  push("        if stx == rx and sty == ry then");
  push("          if dfloor == 5 then");
  push('            set ch to "&"');
  push("          else");
  push('            set ch to ">"');
  push("          end");
  push("        end");
  for (let g = 0; g < NGOLD; g++) {
    push(`        if gon[${g}] == 1 and gpx[${g}] == rx and gpy[${g}] == ry then`);
    push('          set ch to "*"');
    push("        end");
  }
  for (let p = 0; p < NPOT; p++) {
    push(`        if pon[${p}] == 1 and ppx[${p}] == rx and ppy[${p}] == ry then`);
    push('          set ch to "!"');
    push("        end");
  }
  push("        set m to 0");
  push(`        repeat ${NM}`);
  push("          if ma[m] == 1 and mx[m] == rx and my[m] == ry then");
  push("            set ch to ml[mtp[m]]");
  push("          end");
  push("          set m to m + 1");
  push("        end");
  push("        if px == rx and py == ry then");
  push('          set ch to "@"');
  push("        end");
  push("        set row to row + ch");
  push("        set rx to rx + 1");
  push("      end");
  push("      print row");
  push("      set ry to ry + 1");
  push("    end");
  push("  end");
  push("end");
  push("end");

  const brain = L.join("\n");

  // the letter table rides a start event of its own tiny object
  const letters = MLETTER.map((ch, i) => i ? `set ml[${i}] to "${ch}"` : "").filter(Boolean).join("\n");

  const objects = [
    {
      id: "rg_lt", name: "letters", type: "text",
      x: 0, y: 0, size: 1, color: "#7a8894", glow: 0, visible: 0, text: "",
      script: [{ event: "code", source: `when start\n${letters}\nend` }]
    },
    {
      id: "rg_ref", name: "referee", type: "text",
      x: 0, y: 0, size: 1, color: "#7a8894", glow: 0, visible: 0, text: "",
      script: [{ event: "code", source: brain }]
    },
  ];

  return { title: "Rogue (1980)", objects };
}

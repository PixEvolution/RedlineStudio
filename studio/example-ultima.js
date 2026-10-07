// example-ultima.js — ULTIMA I (1981), rebuilt in our studio.
//
// Richard Garriott's Apple II role-playing game — the first chapter of the
// longest-running RPG saga in gaming, and the game that fixed the SHAPE of
// the computer RPG: a tile world seen from above, towns that trade, a
// castle that heals, dungeons that descend, food that runs out, and a
// character who grows stronger the farther from safety he dares to walk.
// Garriott's own world and characters stayed his (he still plays his king
// in person), so our realm is an original one — what we keep is the DESIGN:
//
//   · a scrolling tile OVERWORLD — grass, forest, mountains, coast —
//     where danger scales with distance from the castle
//   · bump-to-fight, turn-based: the world moves only when YOU move
//   · FOOD ticks down as you walk; run dry and you starve. Towns sell
//     food, weapons and armor; the king heals for gold
//   · three DUNGEONS, dark past a torch's reach, each hiding a SIGIL
//   · three sigils open the DARK TOWER — and what waits inside ends
//     the game or you
//   · XP levels you up; gold + XP is your score at the end
//     (the real 1981 game ends in OUTER SPACE. We kept our feet down.)
//
//   WASD / arrows / stick walk a tile a step · 1-4 answer menus

const W = 480, H = 360;
const MW = 40, MH = 26;                 // the world in tiles
const VC = 15, VR = 10, CS = 28;        // the window onto it
const X0 = 44, Y0 = 44;
const NM = 8;                            // monster slots (slot 8 is HIS)
// tiles: 0 water 1 grass 2 forest 3 mountain 4 town 5 castle 6 dungeon
//        7 tower 8 dungeon wall 9 sigil chest 10 way out
const CASTLE = [19, 13];
const TOWNS = [[8, 7, "WESTON"], [31, 20, "EASTMARCH"], [11, 21, "SOUTHMERE"]];
const DUNGEONS = [[5, 15], [27, 5], [34, 22]];
const TOWER = [35, 5], TGAP = [35, 7], TBOSS = [34, 7];
const DMAPS = [
  [
    "###############",
    "#.....#.......#",
    "#.###.#.#####.#",
    "#.#.......#...#",
    "#.#.#####.#.#.#",
    "#...#...#.#.#.#",
    "###.#.C.#.#.#.#",
    "#.....###...#.#",
    "#E............#",
    "###############",
  ],
  [
    "###############",
    "#E....#....#..#",
    "#.##..#.##.#.##",
    "#..#.....#....#",
    "##.#.##.##.##.#",
    "#..#.#......#.#",
    "#.##.#.#.##.#.#",
    "#....#.#....#.#",
    "#.####.####.#C#",
    "###############",
  ],
  [
    "###############",
    "#E....#.......#",
    "###.#.#.#####.#",
    "#...#.#.#...#.#",
    "#.###.#.#.#.#.#",
    "#.#...#...#.#.#",
    "#.#.#######.#.#",
    "#.#.........#C#",
    "#.###########.#",
    "###############",
  ],
];
const DMONS = [
  [[7, 3, 3], [11, 5, 3], [3, 7, 4], [10, 7, 4]],
  [[4, 3, 3], [11, 3, 4], [4, 7, 3], [9, 7, 5]],
  [[8, 1, 3], [3, 7, 4], [10, 7, 4], [13, 5, 5]],
];
// the maps must stay sound if anyone edits them
for (const rows of DMAPS) {
  if (rows.length !== 10 || rows.some(r => r.length !== 15)) throw new Error("dungeon map is not 15x10");
}
DMONS.forEach((spots, d) => spots.forEach(([c, r]) => {
  if (DMAPS[d][r][c] !== ".") throw new Error("dungeon monster on a wall: " + d + " " + c + "," + r);
}));
const MONNAME = ["", "RAT", "BANDIT", "SKELETON", "ORC", "DRAKE", "THE SORCERER"];
const WNAMES = ["DAGGER", "SWORD", "GREATSWORD", "FLAMEBRAND"];
const WDMG = [2, 5, 9, 14], WCOST = [0, 60, 200, 500];
const ANAMES = ["CLOTH", "LEATHER", "CHAIN", "PLATE"];
const ADEF = [0, 1, 2, 4], ACOST = [0, 40, 150, 400];
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", PURPLE = "#b48cff";
const TILEGLYPH = ["≈", "·", "♣", "▲", "⌂", "♔", "Ω", "♜", "▓", "□", "◊"];
const TILECOLOR = ["#3f6fd0", "#4a7a4a", "#2e9158", "#8b95a8", GOLD, WHITE, PURPLE, RED, "#6a7488", GOLD, CYAN];
const MONGLYPH = ["", "r", "b", "k", "o", "D", "Ψ"];
const MONCOLOR = ["", "#b0a080", "#d8a04a", "#e8e8e8", "#9fb46a", "#ff8c5a", "#d070ff"];

// ---------- carve the realm (deterministic) ----------
let seed = 1981;
const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
const map = [];
for (let r = 0; r < MH; r++) {
  for (let c = 0; c < MW; c++) {
    const dx = (c - MW / 2 + 0.5) / (MW * 0.44), dy = (r - MH / 2 + 0.5) / (MH * 0.44);
    const coast = 1 + Math.sin(c * 0.9) * 0.06 + Math.sin(r * 1.3) * 0.06;
    map.push(dx * dx + dy * dy < coast ? 1 : 0);
  }
}
const at = (c, r) => map[r * MW + c];
const setT = (c, r, t) => { if (c >= 0 && c < MW && r >= 0 && r < MH) map[r * MW + c] = t; };
const blob = (cx, cy, rad, t) => {
  for (let r = cy - rad; r <= cy + rad; r++) for (let c = cx - rad; c <= cx + rad; c++) {
    if (c >= 1 && c < MW - 1 && r >= 1 && r < MH - 1 && at(c, r) === 1
      && (c - cx) * (c - cx) + (r - cy) * (r - cy) <= rad * rad + rnd() * 2) setT(c, r, t);
  }
};
// mountain ridges and forests
blob(13, 11, 2, 3); blob(24, 17, 2, 3); blob(8, 18, 2, 3); blob(29, 11, 2, 3);
blob(5, 10, 2, 2); blob(15, 20, 3, 2); blob(25, 8, 2, 2); blob(33, 15, 2, 2); blob(12, 5, 2, 2);
// the tower's mountain ring, gap to the south
for (let r = TOWER[1] - 2; r <= TOWER[1] + 2; r++) for (let c = TOWER[0] - 2; c <= TOWER[0] + 2; c++) {
  const edge = (Math.abs(c - TOWER[0]) === 2 || Math.abs(r - TOWER[1]) === 2);
  if (edge) setT(c, r, 3); else setT(c, r, 1);
}
setT(TGAP[0], TGAP[1] - 1, 1); setT(TGAP[0], TGAP[1], 1); setT(TBOSS[0], TBOSS[1], 1);
// stamp the places, then carve L-paths from the castle so all are reachable
const carve = (c1, r1, c2, r2) => {
  let c = c1, r = r1;
  while (c !== c2) { c += Math.sign(c2 - c); if (at(c, r) === 0 || at(c, r) === 3) setT(c, r, 1); }
  while (r !== r2) { r += Math.sign(r2 - r); if (at(c, r) === 0 || at(c, r) === 3) setT(c, r, 1); }
};
for (const [tc, tr] of TOWNS) carve(CASTLE[0], CASTLE[1], tc, tr);
for (const [dc, dr] of DUNGEONS) carve(CASTLE[0], CASTLE[1], dc, dr);
carve(CASTLE[0], CASTLE[1], TGAP[0], TGAP[1]);
setT(CASTLE[0], CASTLE[1], 5);
for (const [tc, tr] of TOWNS) setT(tc, tr, 4);
for (const [dc, dr] of DUNGEONS) setT(dc, dr, 6);
setT(TOWER[0], TOWER[1], 7);
// monster spawn spots: grass, spread out, typed by distance from the castle
const SPOTS = [];
let tries = 0;
while (SPOTS.length < 16 && tries++ < 4000) {
  const c = 2 + Math.floor(rnd() * (MW - 4)), r = 2 + Math.floor(rnd() * (MH - 4));
  const d = Math.abs(c - CASTLE[0]) + Math.abs(r - CASTLE[1]);
  if (at(c, r) === 1 && d > 9 && !SPOTS.some(([sc, sr]) => Math.abs(sc - c) + Math.abs(sr - r) < 5)) {
    SPOTS.push([c, r, Math.max(1, Math.min(5, Math.floor(d / 7) + 1))]);
  }
}
export const ULTIMA_MAP = map.slice();
export const ULTIMA_CONST = { MW, MH, CASTLE, TOWNS, DUNGEONS, TOWER, TGAP, DMAPS, SPOTS };

export function buildUltimaExample() {
  const L = [];
  const push = (s) => L.push(s);

  const dealWildMons = (pad) => {
    push(`${pad}set k to 0`);
    push(`${pad}repeat 7`);
    push(`${pad}  set mon[k] to 0`);
    push(`${pad}  set mrt[k] to 0`);
    push(`${pad}  set spi to floor(rand(0, ${SPOTS.length}))`);
    push(`${pad}  if k < 4 and abs(msx[spi] - pc) + abs(msy[spi] - pr) > 10 then`);
    push(`${pad}    set mon[k] to 1`);
    push(`${pad}    set mx[k] to msx[spi]`);
    push(`${pad}    set my[k] to msy[spi]`);
    push(`${pad}    set mtp[k] to msz[spi]`);
    push(`${pad}    set mhp[k] to msz[spi] * 6`);
    push(`${pad}  else`);
    push(`${pad}    set mrt[k] to 200 + floor(rand(0, 300))`);
    push(`${pad}  end`);
    push(`${pad}  set k to k + 1`);
    push(`${pad}end`);
    push(`${pad}set mon[7] to 0`);
  };

  const townMenu = (pad) => {
    push(`${pad}set menutitle.text to "THE TRADER OF " + townname`);
    push(`${pad}set menu1.text to "1) FOOD +20 — 10 GOLD"`);
    for (let t = 0; t < 3; t++) {
      push(`${pad}if wtier == ${t} then`);
      push(`${pad}  set menu2.text to "2) ${WNAMES[t + 1]} — ${WCOST[t + 1]} GOLD"`);
      push(`${pad}end`);
    }
    push(`${pad}if wtier == 3 then`);
    push(`${pad}  set menu2.text to "2) NO FINER BLADE EXISTS"`);
    push(`${pad}end`);
    for (let t = 0; t < 3; t++) {
      push(`${pad}if atier == ${t} then`);
      push(`${pad}  set menu3.text to "3) ${ANAMES[t + 1]} ARMOR — ${ACOST[t + 1]} GOLD"`);
      push(`${pad}end`);
    }
    push(`${pad}if atier == 3 then`);
    push(`${pad}  set menu3.text to "3) NO FINER ARMOR EXISTS"`);
    push(`${pad}end`);
    push(`${pad}set menu4.text to "4) LEAVE"`);
  };

  const castleMenu = (pad) => {
    push(`${pad}set menutitle.text to "THE CASTLE OF THE KING"`);
    push(`${pad}if sigils == 0 then`);
    push(`${pad}  set menu1.text to "FIND THE THREE SIGILS IN THE THREE DEPTHS"`);
    push(`${pad}end`);
    push(`${pad}if sigils == 1 or sigils == 2 then`);
    push(`${pad}  set menu1.text to sigils + " SIGIL(S) FOUND — " + (3 - sigils) + " REMAIN"`);
    push(`${pad}end`);
    push(`${pad}if sigils == 3 then`);
    push(`${pad}  set menu1.text to "THE TOWER GATE WILL OPEN. NORTHEAST. GO."`);
    push(`${pad}end`);
    push(`${pad}set menu2.text to "1) HEAL ALL WOUNDS — 20 GOLD"`);
    push(`${pad}set menu3.text to "2) LEAVE"`);
    push(`${pad}set menu4.text to ""`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 0`);
    push(`${pad}set mode to 0`);
    push(`${pad}set pc to ${CASTLE[0]}`);
    push(`${pad}set pr to ${CASTLE[1] + 1}`);
    push(`${pad}set hp to 20`);
    push(`${pad}set maxhp to 20`);
    push(`${pad}set level to 1`);
    push(`${pad}set xp to 0`);
    push(`${pad}set gold to 30`);
    push(`${pad}set food to 25`);
    push(`${pad}set wtier to 0`);
    push(`${pad}set atier to 0`);
    push(`${pad}set sigils to 0`);
    push(`${pad}set sg0 to 0`);
    push(`${pad}set sg1 to 0`);
    push(`${pad}set sg2 to 0`);
    push(`${pad}set bosson to 0`);
    push(`${pad}set moves to 0`);
    push(`${pad}set mvcool to 0`);
    push(`${pad}set i to 0`);
    push(`${pad}repeat ${MW * MH}`);
    push(`${pad}  set wmap[i] to owmap[i]`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    dealWildMons(pad);
    push(`${pad}set status.text to "THE KING WAITS IN HIS CASTLE. THE WILDS SCALE WITH DISTANCE."`);
  };

  // ======== start: lay the realm into the tables once
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set endplay to 0");
  push("set mode to 0");
  push("set i to 0");
  push(`repeat ${MW * MH}`);
  push("  set owmap[i] to 1");
  push("  set i to i + 1");
  push("end");
  for (let i = 0; i < map.length; i++) {
    if (map[i] !== 1) push(`set owmap[${i}] to ${map[i]}`);
  }
  push("set i to 0");
  push(`repeat ${MW * MH}`);
  push("  set wmap[i] to owmap[i]");
  push("  set i to i + 1");
  push("end");
  SPOTS.forEach(([c, r, z], i) => {
    push(`set msx[${i}] to ${c}`);
    push(`set msy[${i}] to ${r}`);
    push(`set msz[${i}] to ${z}`);
  });
  push("set k to 0");
  push(`repeat ${NM}`);
  push("  set mon[k] to 0");
  push("  set k to k + 1");
  push("end");
  push(`set pc to ${CASTLE[0]}`);
  push(`set pr to ${CASTLE[1] + 1}`);
  push('set status.text to ""');
  push("end");

  // ======== click
  push("when click");
  push("if game == 9 then");
  startMatch("  ");
  push("else");
  push("  if game == 2 then");
  push("    set game to 9");
  push('    set status.text to ""');
  push("  end");
  push("end");
  push("end");

  // ======== tick
  push("when tick");
  push("set bigtitle.visible to (game == 9)");
  push("set subline.visible to (game == 9)");
  push("set coinline.visible to (game == 9)");
  push("set playbtn.visible to (game == 9)");
  push("set help.visible to (game == 9)");
  push("set help2.visible to (game == 9)");
  push("set coinline.glow to 8 + sin(time() * 300) * 6");
  push("if arcade == 1 then");
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO SET FORTH ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO SET FORTH ◎"');
  push("end");

  push("if game == 0 then");
  push("  if mvcool > 0 then");
  push("    set mvcool to mvcool - 1");
  push("  end");

  // ---------- menus (the world holds its breath) ----------
  push("  if mode == 1 or mode == 3 then");
  push('    set k1 to keydown("1")');
  push('    set k2 to keydown("2")');
  push('    set k3 to keydown("3")');
  push('    set k4 to keydown("4")');
  push("    if mode == 1 then");
  push("      if k1 == 1 and k1p == 0 then");
  push("        if gold >= 10 then");
  push("          set gold to gold - 10");
  push("          set food to food + 20");
  push("          beep 659 for 0.06");
  push('          set status.text to "PROVISIONS BOUGHT"');
  push("        else");
  push('          set status.text to "NOT ENOUGH GOLD"');
  push("        end");
  townMenu("        ");
  push("      end");
  push("      if k2 == 1 and k2p == 0 and wtier < 3 then");
  push("        set bought to 0");
  for (let t = 0; t < 3; t++) {
    push(`        if bought == 0 and wtier == ${t} then`);
    push("          set bought to 1");
    push(`          if gold >= ${WCOST[t + 1]} then`);
    push(`            set gold to gold - ${WCOST[t + 1]}`);
    push("            set wtier to wtier + 1");
    push(`            set status.text to "THE ${WNAMES[t + 1]} IS YOURS"`);
    push("            beep 784 for 0.08");
    push("          else");
    push('            set status.text to "NOT ENOUGH GOLD"');
    push("          end");
    push("        end");
  }
  townMenu("        ");
  push("      end");
  push("      if k3 == 1 and k3p == 0 and atier < 3 then");
  push("        set bought to 0");
  for (let t = 0; t < 3; t++) {
    push(`        if bought == 0 and atier == ${t} then`);
    push("          set bought to 1");
    push(`          if gold >= ${ACOST[t + 1]} then`);
    push(`            set gold to gold - ${ACOST[t + 1]}`);
    push("            set atier to atier + 1");
    push(`            set status.text to "${ANAMES[t + 1]} ARMOR, FITTED"`);
    push("            beep 784 for 0.08");
    push("          else");
    push('            set status.text to "NOT ENOUGH GOLD"');
    push("          end");
    push("        end");
  }
  townMenu("        ");
  push("      end");
  push("      if k4 == 1 and k4p == 0 then");
  push("        set mode to 0");
  push("      end");
  push("    else");
  push("      if k1 == 1 and k1p == 0 then");
  push("        if gold >= 20 then");
  push("          set gold to gold - 20");
  push("          set hp to maxhp");
  push("          beep 659 for 0.06");
  push("          beep 784 for 0.1");
  push('          set status.text to "THE KING\'S HEALERS MEND YOU WHOLE"');
  push("        else");
  push('          set status.text to "NOT ENOUGH GOLD"');
  push("        end");
  castleMenu("        ");
  push("      end");
  push("      if k2 == 1 and k2p == 0 then");
  push("        set mode to 0");
  push("      end");
  push("    end");
  push("    set k1p to k1");
  push("    set k2p to k2");
  push("    set k3p to k3");
  push("    set k4p to k4");
  push("  else");

  // ---------- a turn of the world ----------
  push(`    set mvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push(`    set mvy to max(-1, min(1, keydown("s") + keydown("ArrowDown") - keydown("w") - keydown("ArrowUp") + sticky(1)))`);
  push("    set dxs to 0");
  push("    set dys to 0");
  push("    if mvx > 0.35 then");
  push("      set dxs to 1");
  push("    end");
  push("    if mvx < -0.35 then");
  push("      set dxs to -1");
  push("    end");
  push("    if dxs == 0 then");
  push("      if mvy > 0.35 then");
  push("        set dys to 1");
  push("      end");
  push("      if mvy < -0.35 then");
  push("        set dys to -1");
  push("      end");
  push("    end");
  push("    if (dxs != 0 or dys != 0) and mvcool <= 0 then");
  push("      set mvcool to 9");
  push("      set moves to moves + 1");
  push("      set tc to pc + dxs");
  push("      set tr to pr + dys");
  push("      set acted to 0");
  // ---- bump a monster: your blow lands
  for (let k = 0; k < NM; k++) {
    push(`      if acted == 0 and mon[${k}] == 1 and mx[${k}] == tc and my[${k}] == tr then`);
    push("        set acted to 1");
    push("        set dmg to wdmgv + floor(rand(0, level + 3))");
    push(`        set mhp[${k}] to mhp[${k}] - dmg`);
    push("        beep 220 for 0.04");
    push(`        if mhp[${k}] <= 0 then`);
    push(`          set mon[${k}] to 0`);
    push(`          explode monster${k + 1}`);
    push(`          set loot to mtp[${k}] * 3 + floor(rand(0, 6))`);
    push("          set gold to gold + loot");
    push(`          set xp to xp + mtp[${k}] * 5`);
    push("          beep 494 for 0.06");
    for (let t = 1; t <= 6; t++) {
      push(`          if mtp[${k}] == ${t} then`);
      push(`            set status.text to "${t === 6 ? "THE SORCERER FALLS" : `THE ${MONNAME[t]} FALLS`} — +" + loot + " GOLD"`);
      push("          end");
    }
    push(`          if mtp[${k}] == 6 then`);
    // ---------- THE DARK TOWER FALLS ----------
    push("            set game to 2");
    push("            set endplay to 1");
    push("            set score to xp + gold + 2000");
    push('            say "THE DARK TOWER FALLS." for 1.6');
    push('            set status.text to "THE REALM IS FREE — SCORE " + score + " — CLICK FOR A NEW AGE"');
    push("            beep 523 for 0.1");
    push("            beep 659 for 0.1");
    push("            beep 784 for 0.1");
    push("            beep 1047 for 0.25");
    push("          end");
    push(`          if mon[${k}] == 0 and game == 0 then`);
    push(`            set mrt[${k}] to 40 + floor(rand(0, 40))`);
    push("          end");
    push("        else");
    for (let t = 1; t <= 6; t++) {
      push(`          if mtp[${k}] == ${t} then`);
      push(`            set status.text to "YOU STRIKE THE ${MONNAME[t]} — " + dmg`);
      push("          end");
    }
    push("        end");
    push("      end");
  }
  // ---- or step / enter
  push("      if acted == 0 then");
  push(`        set tt to wmap[tr * ${MW} + tc]`);
  push("        set stepped to 0");
  push("        if tt == 1 or tt == 2 then");
  push("          set pc to tc");
  push("          set pr to tr");
  push("          set stepped to 1");
  push("        end");
  push("        if tt == 0 then");
  push('          set status.text to "THE SEA. YOU CANNOT SWIM IN MAIL."');
  push("        end");
  push("        if tt == 3 or tt == 8 then");
  push('          set status.text to "SOLID STONE."');
  push("        end");
  // towns
  for (let i = 0; i < TOWNS.length; i++) {
    push(`        if tt == 4 and tc == ${TOWNS[i][0]} and tr == ${TOWNS[i][1]} then`);
    push("          set pc to tc");
    push("          set pr to tr");
    push("          set mode to 1");
    push(`          set townname to "${TOWNS[i][2]}"`);
    townMenu("          ");
    push("          beep 523 for 0.05");
    push("        end");
  }
  // the castle
  push("        if tt == 5 then");
  push("          set pc to tc");
  push("          set pr to tr");
  push("          set mode to 3");
  castleMenu("          ");
  push("          beep 523 for 0.05");
  push("        end");
  // the dungeons
  for (let d = 0; d < 3; d++) {
    push(`        if tt == 6 and tc == ${DUNGEONS[d][0]} and tr == ${DUNGEONS[d][1]} then`);
    push("          set retc to tc");
    push("          set retr to tr");
    push("          set mode to 2");
    push(`          set dgn to ${d}`);
    const rows = DMAPS[d];
    let startC = 1, startR = 1;
    for (let r = 0; r < VR; r++) {
      for (let c = 0; c < VC; c++) {
        const ch = rows[r][c];
        let t = 1;
        if (ch === "#") t = 8;
        if (ch === "C") t = 9;
        if (ch === "E") { t = 10; startC = c; startR = r; }
        push(`          set wmap[${r * MW + c}] to ${t}`);
      }
    }
    push(`          set pc to ${startC}`);
    push(`          set pr to ${startR}`);
    push("          set k to 0");
    push(`          repeat ${NM}`);
    push("            set mon[k] to 0");
    push("            set k to k + 1");
    push("          end");
    DMONS[d].forEach(([mc, mr, mt], k) => {
      push(`          set mon[${k}] to 1`);
      push(`          set mx[${k}] to ${mc}`);
      push(`          set my[${k}] to ${mr}`);
      push(`          set mtp[${k}] to ${mt}`);
      push(`          set mhp[${k}] to ${mt * 6}`);
    });
    push('          set status.text to "THE DEPTHS — YOUR TORCH REACHES THREE PACES"');
    push("          beep 165 for 0.12");
    push("        end");
  }
  // the sigil chest
  push("        if tt == 9 then");
  push("          set pc to tc");
  push("          set pr to tr");
  push(`          set wmap[tr * ${MW} + tc] to 1`);
  push("          set got to 0");
  for (let d = 0; d < 3; d++) {
    push(`          if dgn == ${d} and sg${d} == 0 then`);
    push(`            set sg${d} to 1`);
    push("            set got to 1");
    push("          end");
  }
  push("          if got == 1 then");
  push("            set sigils to sigils + 1");
  push("            set gold to gold + 100");
  push("            set xp to xp + 50");
  push('            say "A SIGIL!" for 1');
  push('            set status.text to "A SIGIL — " + sigils + " OF 3 — AND 100 GOLD"');
  push("            beep 659 for 0.08");
  push("            beep 988 for 0.12");
  push("          end");
  push("        end");
  // the way out of a dungeon
  push("        if tt == 10 then");
  push("          set mode to 0");
  push("          set i to 0");
  push(`          repeat ${MW * MH}`);
  push("            set wmap[i] to owmap[i]");
  push("            set i to i + 1");
  push("          end");
  push("          set pc to retc");
  push("          set pr to retr");
  dealWildMons("          ");
  push('          set status.text to "DAYLIGHT."');
  push("        end");
  // the dark tower
  push("        if tt == 7 then");
  push("          if sigils < 3 then");
  push('            set status.text to "THE TOWER GATE HOLDS — " + (3 - sigils) + " SIGIL(S) REMAIN"');
  push("            beep 147 for 0.1");
  push("          else");
  push("            if bosson == 0 then");
  push("              set bosson to 1");
  push("              set mon[7] to 1");
  push(`              set mx[7] to ${TBOSS[0]}`);
  push(`              set my[7] to ${TBOSS[1]}`);
  push("              set mtp[7] to 6");
  push("              set mhp[7] to 60");
  push('              say "WHO DARES?" for 1.2');
  push('              set status.text to "THE SORCERER COMES DOWN TO MEET YOU"');
  push("              beep 98 for 0.2");
  push("              beep 98 for 0.2");
  push("            end");
  push("          end");
  push("        end");
  // food burns as you walk
  push("        if stepped == 1 then");
  push("          if moves % 3 == 0 then");
  push("            set food to max(0, food - 1)");
  push("          end");
  push("          if food <= 0 then");
  push("            set hp to hp - 2");
  push('            set status.text to "YOU ARE STARVING — FIND A TOWN"');
  push("          end");
  push("        end");
  push("      end");

  // ---- the world's turn: every monster answers your move
  push("      if game == 0 and mode != 1 and mode != 3 then");
  for (let k = 0; k < NM; k++) {
    push(`      if mon[${k}] == 1 then`);
    push(`        set adx to pc - mx[${k}]`);
    push(`        set ady to pr - my[${k}]`);
    push("        if abs(adx) + abs(ady) == 1 then");
    // its blow lands
    push(`          set mdmg to max(1, floor(rand(1, 3 + mtp[${k}] * 2)) - adefv)`);
    push("          set hp to hp - mdmg");
    push("          beep 175 for 0.05");
    for (let t = 1; t <= 6; t++) {
      push(`          if mtp[${k}] == ${t} then`);
      push(`            set status.text to "${t === 6 ? "THE SORCERER" : `THE ${MONNAME[t]}`} HITS YOU — " + mdmg`);
      push("          end");
    }
    push("        else");
    push(`          set hunt to 0`);
    push("          if abs(adx) + abs(ady) < 6 or mode == 2 then");
    push("            set hunt to 1");
    push("          end");
    push(`          if mtp[${k}] == 6 then`);
    push("            set hunt to 1");
    push("          end");
    push("          set sxv to 0");
    push("          set syv to 0");
    push("          if hunt == 1 then");
    push("            if abs(adx) > abs(ady) then");
    push("              set sxv to 1");
    push("              if adx < 0 then");
    push("                set sxv to -1");
    push("              end");
    push("            else");
    push("              set syv to 1");
    push("              if ady < 0 then");
    push("                set syv to -1");
    push("              end");
    push("            end");
    push("          else");
    push("            if moves % 2 == 0 then");
    push("              set rdir to floor(rand(0, 4))");
    push("              if rdir == 0 then");
    push("                set sxv to 1");
    push("              end");
    push("              if rdir == 1 then");
    push("                set sxv to -1");
    push("              end");
    push("              if rdir == 2 then");
    push("                set syv to 1");
    push("              end");
    push("              if rdir == 3 then");
    push("                set syv to -1");
    push("              end");
    push("            end");
    push("          end");
    push("          if sxv != 0 or syv != 0 then");
    push(`            set ntc to mx[${k}] + sxv`);
    push(`            set ntr to my[${k}] + syv`);
    push(`            set ntt to wmap[ntr * ${MW} + ntc]`);
    push("            set free to 0");
    push("            if ntt == 1 or ntt == 2 then");
    push("              set free to 1");
    push("            end");
    push("            if ntc == pc and ntr == pr then");
    push("              set free to 0");
    push("            end");
    for (let j = 0; j < NM; j++) {
      if (j !== k) {
        push(`            if mon[${j}] == 1 and mx[${j}] == ntc and my[${j}] == ntr then`);
        push("              set free to 0");
        push("            end");
      }
    }
    push("            if free == 1 then");
    push(`              set mx[${k}] to ntc`);
    push(`              set my[${k}] to ntr`);
    push("            end");
    push("          end");
    push("        end");
    push("      end");
    // the wilds refill behind you
    if (k < 7) {
      push(`      if mon[${k}] == 0 and mode == 0 and mrt[${k}] > 0 then`);
      push(`        set mrt[${k}] to mrt[${k}] - 1`);
      push(`        if mrt[${k}] <= 0 then`);
      push(`          set spi to floor(rand(0, ${SPOTS.length}))`);
      push("          if abs(msx[spi] - pc) + abs(msy[spi] - pr) > 6 then");
      push(`            set mon[${k}] to 1`);
      push(`            set mx[${k}] to msx[spi]`);
      push(`            set my[${k}] to msy[spi]`);
      push(`            set mtp[${k}] to msz[spi]`);
      push(`            set mhp[${k}] to msz[spi] * 6`);
      push("          else");
      push(`            set mrt[${k}] to 20`);
      push("          end");
      push("        end");
      push("      end");
    }
  }
  push("      end");
  push("    end");
  push("  end");

  // ---- the ledger of the self
  push("  set wdmgv to 0");
  for (let t = 0; t < 4; t++) {
    push(`  if wtier == ${t} then`);
    push(`    set wdmgv to ${WDMG[t]}`);
    push("  end");
  }
  push("  set adefv to 0");
  for (let t = 0; t < 4; t++) {
    push(`  if atier == ${t} then`);
    push(`    set adefv to ${ADEF[t]}`);
    push("  end");
  }
  push("  if xp >= level * 40 then");
  push("    set level to level + 1");
  push("    set maxhp to maxhp + 8");
  push("    set hp to maxhp");
  push('    say "LEVEL " + level + "!" for 1');
  push("    beep 659 for 0.08");
  push("    beep 784 for 0.08");
  push("    beep 988 for 0.12");
  push("  end");
  push("  if game == 0 then");
  push("    set score to xp + gold");
  push("  end");
  // ---- slain
  push("  if hp <= 0 and game == 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push("    set score to xp + gold");
  push("    explode wanderer");
  push("    beep 110 for 0.25");
  push("    beep 82 for 0.35");
  push('    set status.text to "SLAIN IN THE WILD — SCORE " + score + " — CLICK TO BE REBORN"');
  push("  end");

  // ---- camera and HUD
  push(`  set camc to max(0, min(${MW - VC}, pc - 7))`);
  push(`  set camr to max(0, min(${MH - VR}, pr - 5))`);
  push("  if mode == 2 then");
  push("    set camc to 0");
  push("    set camr to 0");
  push("  end");
  push('  set hptx.text to "HP " + hp + "/" + maxhp');
  push('  set goldtx.text to "GOLD " + gold');
  push('  set foodtx.text to "FOOD " + food');
  push('  set lvtx.text to "LV " + level + " · " + ("" + wdmgv) + "/" + adefv');
  push("end");
  push("set hptx.visible to (game != 9)");
  push("set goldtx.visible to (game != 9)");
  push("set foodtx.visible to (game != 9)");
  push("set lvtx.visible to (game != 9)");
  push("set menutitle.visible to (game == 0 and (mode == 1 or mode == 3))");
  push("set menu1.visible to (game == 0 and (mode == 1 or mode == 3))");
  push("set menu2.visible to (game == 0 and (mode == 1 or mode == 3))");
  push("set menu3.visible to (game == 0 and (mode == 1 or mode == 3))");
  push("set menu4.visible to (game == 0 and mode == 1)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game != 9)";

  // the window onto the world: one glyph per visible tile
  for (let r = 0; r < VR; r++) {
    for (let c = 0; c < VC; c++) {
      const lines = [
        "when tick",
        `set self.visible to ${inGame}`,
        `set tq to wmap[(camr + ${r}) * ${MW} + camc + ${c}]`,
        `if mode == 2 and abs(camc + ${c} - pc) + abs(camr + ${r} - pr) > 3 then`,
        "  set tq to -1",
        "end",
        'if tq < 0 then',
        '  set self.text to ""',
        "end",
      ];
      for (let t = 0; t <= 10; t++) {
        lines.push(`if tq == ${t} then`);
        lines.push(`  set self.text to "${TILEGLYPH[t]}"`);
        lines.push(`  set self.color to "${TILECOLOR[t]}"`);
        lines.push("end");
      }
      lines.push("end");
      objects.push({
        id: "u1_t" + (r * VC + c), name: "tile" + (r * VC + c), type: "text",
        x: X0 + c * CS, y: Y0 + r * CS, size: 16, color: DIM, glow: 2, visible: 0, text: "",
        script: [{ event: "code", source: lines.join("\n") }]
      });
    }
  }

  // the monsters of the hour
  for (let k = 0; k < NM; k++) {
    const lines = [
      "when tick",
      `set onscr to 0`,
      `if game == 0 and mon[${k}] == 1 and mode != 1 and mode != 3 then`,
      `  set sxp to mx[${k}] - camc`,
      `  set syp to my[${k}] - camr`,
      `  if sxp >= 0 and sxp <= ${VC - 1} and syp >= 0 and syp <= ${VR - 1} then`,
      "    set onscr to 1",
      `    set self.x to ${X0} + sxp * ${CS}`,
      `    set self.y to ${Y0} + syp * ${CS}`,
      "  end",
      `  if mode == 2 and abs(mx[${k}] - pc) + abs(my[${k}] - pr) > 3 then`,
      "    set onscr to 0",
      "  end",
      "end",
      "set self.visible to onscr",
    ];
    for (let t = 1; t <= 6; t++) {
      lines.push(`if mtp[${k}] == ${t} then`);
      lines.push(`  set self.text to "${MONGLYPH[t]}"`);
      lines.push(`  set self.color to "${MONCOLOR[t]}"`);
      lines.push("end");
    }
    lines.push("end");
    objects.push({
      id: "u1_m" + k, name: "monster" + (k + 1), type: "text",
      x: -50, y: -50, size: 16, color: RED, glow: 8, visible: 0, text: "r",
      script: [{ event: "code", source: lines.join("\n") }]
    });
  }

  // the wanderer (you)
  objects.push({
    id: "u1_p", name: "wanderer", type: "text",
    x: -50, y: -50, size: 17, color: WHITE, glow: 12, visible: 0, text: "♞",
    script: [{
      event: "code", source: `when tick
set self.visible to (game == 0)
set self.x to ${X0} + (pc - camc) * ${CS}
set self.y to ${Y0} + (pr - camr) * ${CS}
end` }]
  });

  // HUD
  objects.push({ id: "u1_hp", name: "hptx", type: "text", x: 70, y: 20, size: 12, color: GREEN, glow: 6, visible: 0, text: "HP 20/20", script: [] });
  objects.push({ id: "u1_go", name: "goldtx", type: "text", x: 185, y: 20, size: 12, color: GOLD, glow: 6, visible: 0, text: "GOLD 30", script: [] });
  objects.push({ id: "u1_fo", name: "foodtx", type: "text", x: 295, y: 20, size: 12, color: CYAN, glow: 5, visible: 0, text: "FOOD 25", script: [] });
  objects.push({ id: "u1_lv", name: "lvtx", type: "text", x: 410, y: 20, size: 12, color: DIM, glow: 4, visible: 0, text: "LV 1 · 2/0", script: [] });
  objects.push({ id: "u1_st", name: "status", type: "text", x: W / 2, y: 350, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // menus (over the world, which waits)
  objects.push({ id: "u1_mt", name: "menutitle", type: "text", x: W / 2, y: 120, size: 14, color: WHITE, glow: 12, visible: 0, text: "", script: [] });
  objects.push({ id: "u1_m1", name: "menu1", type: "text", x: W / 2, y: 158, size: 11, color: GOLD, glow: 9, visible: 0, text: "", script: [] });
  objects.push({ id: "u1_m2", name: "menu2", type: "text", x: W / 2, y: 184, size: 11, color: GOLD, glow: 9, visible: 0, text: "", script: [] });
  objects.push({ id: "u1_m3", name: "menu3", type: "text", x: W / 2, y: 210, size: 11, color: GOLD, glow: 9, visible: 0, text: "", script: [] });
  objects.push({ id: "u1_m4", name: "menu4", type: "text", x: W / 2, y: 236, size: 11, color: GREEN, glow: 9, visible: 0, text: "", script: [] });

  // attract
  objects.push({ id: "u1_big", name: "bigtitle", type: "text", x: W / 2, y: 104, size: 44, color: GOLD, glow: 18, visible: 1, text: "ULTIMA I", script: [] });
  objects.push({ id: "u1_sub", name: "subline", type: "text", x: W / 2, y: 138, size: 10, color: DIM, glow: 4, visible: 1, text: "RICHARD GARRIOTT 1981 · APPLE II · FIRST OF THE LONGEST-RUNNING RPG SAGA", script: [] });
  objects.push({ id: "u1_coin", name: "coinline", type: "text", x: W / 2, y: 170, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO SET FORTH ◎", script: [] });
  objects.push({ id: "u1_play", name: "playbtn", type: "text", x: W / 2, y: 208, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ SET FORTH ]", script: [] });
  objects.push({
    id: "u1_help", name: "help", type: "text",
    x: W / 2, y: 242, size: 9, color: DIM, glow: 3, visible: 1,
    text: "WASD WALKS A TILE A TURN · BUMP TO FIGHT · TOWNS TRADE · THE KING HEALS",
    script: []
  });
  objects.push({
    id: "u1_help2", name: "help2", type: "text",
    x: W / 2, y: 260, size: 9, color: DIM, glow: 3, visible: 1,
    text: "FOOD BURNS AS YOU WALK · THREE SIGILS OPEN THE DARK TOWER",
    script: []
  });

  objects.push({
    id: "u1_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "u1_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "WALK", script: [] });

  return { title: "Ultima I (1981)",
    display: "arcade8", hardware: "arcade8",   // the real machine's era
    objects };
}

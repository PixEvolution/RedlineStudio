// example-pitfall.js — PITFALL! (1982), rebuilt in our studio.
//
// David Crane crammed a 255-screen jungle into a 4KB Atari 2600 cartridge
// by STORING NONE OF IT: every screen is computed from one 8-bit polynomial
// counter. Walk right and the counter steps forward; walk left and it runs
// BACKWARD, so the same jungle unrolls in reverse. We built the same
// machine — our screens come out of the same kind of 8-bit register
// (x^8 + x^6 + x^5 + x^4 + 1, the maximal-length taps), stepped forward
// and backward as you run. Nothing is stored. The HUD shows the byte.
//
// The 1982 design, faithfully:
//   · run, jump, swing the VINE (jump into it, jump again to let go)
//   · tar pits swallow you · holes drop you to the TUNNEL below
//   · croc ponds: hop the heads, but only CLOSED jaws hold you
//   · rolling logs cost 100 points · cobras and campfires cost a life
//   · the tunnel passes THREE screens per flip — mind the walls and
//     the scorpions, and ladder back up where the holes are
//   · exactly 32 TREASURES hide in the 255 screens (the bits make it
//     exactly 32 — same as the cartridge) · 3:00 on the clock
//
//   A/D or arrows run · SPACE jumps + grabs · W/S climb the ladders

const W = 480, H = 360;
const SEED = 6;                        // start on a gentle screen
const GY = 258, UY = 328;              // feet: surface, tunnel
const GLINE = 270, ULINE = 342;        // the drawn ground and tunnel floor
const PITX0 = 205, PITX1 = 275;        // the tar pit
const HAX0 = 155, HAX1 = 195, HBX0 = 285, HBX1 = 325;  // the two holes
const WAT0 = 170, WAT1 = 310;          // the croc pond
const CROCX = [190, 240, 290];
const HAZX = 340, TREX = 420, LADX = 240;
const VPX = 240, VPY = 78, VLEN = 158;
const WHITE = "#ffffff", DIM = "#7a8894", GOLD = "#e8c84a", GREEN = "#7dff9e",
  CYAN = "#7ddfff", RED = "#ff6666", JUNGLE = "#3d8a4d", BROWN = "#a87a4a",
  TAR = "#6b4a2a", STEEL = "#8b95a8";
const TREGLYPH = ["$", "≡", "○", "◆"];
const TRECOLOR = [GOLD, GOLD, "#d8d8d8", CYAN];

export function buildPitfallExample() {
  const L = [];
  const push = (s) => L.push(s);

  // ---- the polynomial counter: one step right / one step left
  const lfsrFwd = (pad) => {
    push(`${pad}set b7 to floor(scr / 128) % 2`);
    push(`${pad}set b5 to floor(scr / 32) % 2`);
    push(`${pad}set b4 to floor(scr / 16) % 2`);
    push(`${pad}set b3 to floor(scr / 8) % 2`);
    push(`${pad}set scr to (scr * 2) % 256 + xor(xor(b7, b5), xor(b4, b3))`);
  };
  const lfsrBwd = (pad) => {
    push(`${pad}set n0 to scr % 2`);
    push(`${pad}set n6 to floor(scr / 64) % 2`);
    push(`${pad}set n5 to floor(scr / 32) % 2`);
    push(`${pad}set n4 to floor(scr / 16) % 2`);
    push(`${pad}set scr to floor(scr / 2) + 128 * xor(xor(n0, n6), xor(n5, n4))`);
  };

  const startMatch = (pad) => {
    push(`${pad}set game to 0`);
    push(`${pad}set endplay to 0`);
    push(`${pad}set score to 2000`);
    push(`${pad}set lives to 3`);
    push(`${pad}set got to 0`);
    push(`${pad}set tleft to 10800`);
    push(`${pad}set tik to 0`);
    push(`${pad}set i to 0`);
    push(`${pad}repeat 256`);
    push(`${pad}  set ttaken[i] to 0`);
    push(`${pad}  set i to i + 1`);
    push(`${pad}end`);
    push(`${pad}set scr to ${SEED}`);
    push(`${pad}set under to 0`);
    push(`${pad}set px to 40`);
    push(`${pad}set py to ${GY}`);
    push(`${pad}set pvy to 0`);
    push(`${pad}set pvx to 0`);
    push(`${pad}set swinging to 0`);
    push(`${pad}set vgrace to 0`);
    push(`${pad}set itim to 60`);
    push(`${pad}set lcool to 0`);
    push(`${pad}set dealflag to 1`);
    push(`${pad}set status.text to "32 TREASURES · 255 SCREENS · 3:00"`);
  };

  // ======== start
  push("when start");
  push("set game to 9");
  push("set score to 0");
  push("set lives to 0");
  push("set endplay to 0");
  push(`set scr to ${SEED}`);
  push("set under to 0");
  push("set tik to 0");
  push("set dealflag to 1");
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
  push('  set coinline.text to "◎ COIN ACCEPTED — CLICK TO RUN ◎"');
  push("else");
  push('  set coinline.text to "◎ INSERT COIN — CLICK TO RUN ◎"');
  push("end");

  push("if game == 0 then");
  push("  set tik to tik + 1");

  // ---- deal the screen the byte describes
  push("  if dealflag == 1 then");
  push("    set dealflag to 0");
  push("    set p to scr % 8");
  push("    set q to floor(scr / 8) % 8");
  push("    set u to floor(scr / 64) % 4");
  push("    set b6v to floor(scr / 64) % 2");
  // ground segments (gaps are the pits)
  for (let i = 0; i < 3; i++) push(`    set gon[${i}] to 0`);
  push("    if p <= 1 then");
  push(`      set gon[0] to 1`);
  push(`      set gsx[0] to 16`);
  push(`      set gsl[0] to ${PITX0 - 16}`);
  push(`      set gon[1] to 1`);
  push(`      set gsx[1] to ${PITX1}`);
  push(`      set gsl[1] to ${464 - PITX1}`);
  push("    end");
  push("    if p == 2 or p == 3 then");
  push(`      set gon[0] to 1`);
  push(`      set gsx[0] to 16`);
  push(`      set gsl[0] to ${HAX0 - 16}`);
  push(`      set gon[1] to 1`);
  push(`      set gsx[1] to ${HAX1}`);
  push(`      set gsl[1] to ${HBX0 - HAX1}`);
  push(`      set gon[2] to 1`);
  push(`      set gsx[2] to ${HBX1}`);
  push(`      set gsl[2] to ${464 - HBX1}`);
  push("    end");
  push("    if p == 4 or p == 5 then");
  push(`      set gon[0] to 1`);
  push(`      set gsx[0] to 16`);
  push(`      set gsl[0] to ${WAT0 - 16}`);
  push(`      set gon[1] to 1`);
  push(`      set gsx[1] to ${WAT1}`);
  push(`      set gsl[1] to ${464 - WAT1}`);
  push("    end");
  push("    if p >= 6 then");
  push(`      set gon[0] to 1`);
  push(`      set gsx[0] to 16`);
  push(`      set gsl[0] to 448`);
  push("    end");
  push("    set crocon to 0");
  push("    if p == 4 or p == 5 then");
  push("      set crocon to 1");
  push("    end");
  push("    set vineon to 0");
  push("    if b6v == 1 and (p <= 1 or crocon == 1) then");
  push("      set vineon to 1");
  push("    end");
  push("    set logn to 0");
  push("    if q == 0 then");
  push("      set logn to 1");
  push("    end");
  push("    if q == 1 then");
  push("      set logn to 2");
  push("    end");
  push("    set lgx[0] to 460");
  push("    set lgx[1] to 330");
  push("    set cobraon to 0");
  push("    if q == 3 or q == 6 then");
  push("      set cobraon to 1");
  push("    end");
  push("    set fireon to 0");
  push("    if q == 2 or q == 7 then");
  push("      set fireon to 1");
  push("    end");
  push("    set treon to 0");
  push("    set tkind to u");
  push("    if q == 4 and ttaken[scr] == 0 then");
  push("      set treon to 1");
  push("    end");
  push("    set ladder to 0");
  push("    if p == 2 or p == 3 then");
  push("      set ladder to 1");
  push("    end");
  push("    set uwallr to 0");
  push("    if u == 0 then");
  push("      set uwallr to 1");
  push("    end");
  push("    set uwalll to 0");
  push("    if u == 3 then");
  push("      set uwalll to 1");
  push("    end");
  push("    set scorpon to 0");
  push("    if u == 1 or u == 2 then");
  push("      set scorpon to 1");
  push("      set sx to 400");
  push("    end");
  push("  end");

  // ---- the clock
  push("  set tleft to tleft - 1");
  push("  if tleft <= 0 then");
  push("    set game to 2");
  push("    set endplay to 1");
  push('    set status.text to "TIME — " + got + " OF 32 TREASURES, SCORE " + score + " — CLICK TO RUN AGAIN"');
  push("    beep 147 for 0.15");
  push("    beep 110 for 0.25");
  push("  end");
  push("  if itim > 0 then");
  push("    set itim to itim - 1");
  push("  end");
  push("  if vgrace > 0 then");
  push("    set vgrace to vgrace - 1");
  push("  end");
  push("  if lcool > 0 then");
  push("    set lcool to lcool - 1");
  push("  end");

  // ---- the vine swings whether you ride it or not
  push("  set vang to sin(tik * 1.3) * 38");
  push(`  set vtx to ${VPX} - sin(vang) * ${VLEN}`);
  push(`  set vty to ${VPY} + cos(vang) * ${VLEN}`);

  // ---- the crocodiles' jaws keep their own time
  for (let k = 0; k < 3; k++) {
    push(`  set co${k} to 0`);
    push(`  if (tik + ${k * 45}) % 140 < 55 then`);
    push(`    set co${k} to 1`);
    push("  end");
  }

  // ---- input
  push(`  set mvx to max(-1, min(1, keydown("d") + keydown("ArrowRight") - keydown("a") - keydown("ArrowLeft") + stickx(1)))`);
  push("  set ix2 to 0");
  push("  if mvx > 0.35 then");
  push("    set ix2 to 1");
  push("  end");
  push("  if mvx < -0.35 then");
  push("    set ix2 to -1");
  push("  end");
  push(`  set jk to keydown("Space")`);
  push("  set pdie to 0");

  push("  if swinging == 1 then");
  // ---- riding the vine
  push("    set px to vtx");
  push("    set py to vty + 8");
  push("    if jk == 1 and jk0 == 0 then");
  push("      set swinging to 0");
  push("      set vgrace to 25");
  push("      set pvy to -2.5");
  push("      set pvx to 4");
  push(`      if vtx < ${VPX} then`);
  push("        set pvx to -4");
  push("      end");
  push("    end");
  push("  else");

  // ---- where is the floor under these feet?
  push("    set zone to 0");
  push("    if under == 0 then");
  push(`      if p <= 1 and px > ${PITX0} and px < ${PITX1} then`);
  push("        set zone to 1");
  push("      end");
  push(`      if (p == 2 or p == 3) and ((px > ${HAX0} and px < ${HAX1}) or (px > ${HBX0} and px < ${HBX1})) then`);
  push("        set zone to 2");
  push("      end");
  push(`      if crocon == 1 and px > ${WAT0} and px < ${WAT1} then`);
  push("        set zone to 3");
  push("      end");
  push("    end");
  push(`    set fl to ${GY}`);
  push("    if under == 1 then");
  push(`      set fl to ${UY}`);
  push("    end");
  push("    if zone == 1 or zone == 2 then");
  push("      set fl to 999");
  push("    end");
  push("    if zone == 3 then");
  push("      set fl to 999");
  for (let k = 0; k < 3; k++) {
    push(`      if abs(px - ${CROCX[k]}) < 13 and co${k} == 0 then`);
    push("        set fl to 252");
    push("      end");
  }
  push("    end");

  // ---- run and jump
  push("    change px by ix2 * 2.3 + pvx");
  push("    set pvx to pvx * 0.96");
  push("    if abs(pvx) < 0.2 then");
  push("      set pvx to 0");
  push("    end");
  push("    set ong to 0");
  push("    if py >= fl - 0.5 and pvy >= 0 and fl < 900 then");
  push("      set py to fl");
  push("      set pvy to 0");
  push("      set ong to 1");
  push("    else");
  push("      change py by pvy");
  push("      change pvy by 0.3");
  push("    end");
  push("    if ong == 1 and jk == 1 and jk0 == 0 then");
  push("      set pvy to -5.4");
  push("      set ong to 0");
  push("      beep 392 for 0.04");
  push("    end");

  // ---- grab the vine mid-air
  push("    if vineon == 1 and vgrace <= 0 and under == 0 and py < 248 then");
  push("      if abs(px - vtx) < 18 and abs(py - vty - 8) < 24 then");
  push("        set swinging to 1");
  push("        beep 523 for 0.05");
  push("      end");
  push("    end");

  // ---- what the depths do to you
  push("    if under == 0 then");
  push("      if zone == 1 and py > 272 then");
  push("        set pdie to 1");
  push('        set status.text to "THE TAR TAKES YOU"');
  push("      end");
  push("      if zone == 3 and py > 264 and py < 300 then");
  push("        set pdie to 1");
  push('        set status.text to "EATEN"');
  push("      end");
  push("      if zone == 2 and py > 300 then");
  push("        set under to 1");
  push("        beep 196 for 0.08");
  push('        set status.text to "THE TUNNEL — 3 SCREENS A FLIP"');
  push("      end");
  push("    end");
  push("  end");
  push("  set jk0 to jk");

  // ---- ladders between the layers
  push(`  if ladder == 1 and lcool <= 0 and abs(px - ${LADX}) < 14 then`);
  push(`    if under == 1 and keydown("w") + keydown("ArrowUp") - sticky(1) > 0.5 then`);
  push("      set under to 0");
  push(`      set py to ${GY}`);
  push("    set pvy to 0");
  push("      set lcool to 20");
  push("      beep 440 for 0.04");
  push("    end");
  push(`    if under == 0 and swinging == 0 and keydown("s") + keydown("ArrowDown") + sticky(1) > 0.5 then`);
  push("      set under to 1");
  push(`      set py to ${UY}`);
  push("      set pvy to 0");
  push("      set lcool to 20");
  push("      beep 330 for 0.04");
  push("    end");
  push("  end");

  // ---- rolling logs (they cost points, not lives)
  for (let i = 0; i < 2; i++) {
    push(`  if logn >= ${i + 1} then`);
    push(`    change lgx[${i}] by -1.7`);
    push(`    if lgx[${i}] < 20 then`);
    push(`      set lgx[${i}] to 460`);
    push("    end");
    push(`    if under == 0 and itim <= 0 and swinging == 0 and py > 246 and abs(px - lgx[${i}]) < 13 then`);
    push("      set score to max(0, score - 100)");
    push("      set itim to 60");
    push("      set pvx to -3.5");
    push("      beep 165 for 0.08");
    push('      set status.text to "ROLLED — MINUS 100"');
    push("    end");
    push("  end");
  }

  // ---- cobra and campfire
  push(`  if under == 0 and itim <= 0 and swinging == 0 and py > 246 and abs(px - ${HAZX}) < 11 then`);
  push("    if cobraon == 1 then");
  push("      set pdie to 1");
  push('      set status.text to "BITTEN"');
  push("    end");
  push("    if fireon == 1 then");
  push("      set pdie to 1");
  push('      set status.text to "BURNED"');
  push("    end");
  push("  end");

  // ---- treasure
  push(`  if treon == 1 and under == 0 and py > 246 and abs(px - ${TREX}) < 13 then`);
  push("    set treon to 0");
  push("    set ttaken[scr] to 1");
  push("    set got to got + 1");
  push("    set tval to 2000 + tkind * 1000");
  push("    change score by tval");
  push("    beep 659 for 0.06");
  push("    beep 784 for 0.06");
  push("    beep 988 for 0.1");
  push('    set status.text to "TREASURE +" + tval + " — " + got + " OF 32"');
  push("    if got >= 32 then");
  push("      change score by 10000");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "ALL 32! PERFECT RUN +10000 — SCORE " + score');
  push("      beep 523 for 0.1");
  push("      beep 659 for 0.1");
  push("      beep 784 for 0.1");
  push("      beep 1047 for 0.25");
  push("    end");
  push("  end");

  // ---- the scorpion keeps the tunnel
  push("  if scorpon == 1 then");
  push("    if px > sx then");
  push("      change sx by 0.85");
  push("    else");
  push("      change sx by -0.85");
  push("    end");
  push("    if under == 1 and itim <= 0 and abs(px - sx) < 11 then");
  push("      set pdie to 1");
  push('      set status.text to "STUNG"');
  push("    end");
  push("  end");

  // ---- tunnel walls
  push("  if under == 1 then");
  push("    if uwallr == 1 and px > 410 then");
  push("      set px to 410");
  push("    end");
  push("    if uwalll == 1 and px < 70 then");
  push("      set px to 70");
  push("    end");
  push("  end");

  // ---- the counter steps as you cross the edge
  push("  if swinging == 0 then");
  push("    if px > 466 then");
  push("      set px to 24");
  push("      set dealflag to 1");
  lfsrFwd("      ");
  push("      if under == 1 then");
  lfsrFwd("        ");
  lfsrFwd("        ");
  push("      end");
  push("    end");
  push("    if px < 14 then");
  push("      set px to 456");
  push("      set dealflag to 1");
  lfsrBwd("      ");
  push("      if under == 1 then");
  lfsrBwd("        ");
  lfsrBwd("        ");
  push("      end");
  push("    end");
  push("  end");

  // ---- a life lost
  push("  if pdie == 1 and game == 0 then");
  push("    set pdie to 0");
  push("    set lives to lives - 1");
  push("    explode runner");
  push("    beep 110 for 0.2");
  push("    beep 82 for 0.3");
  push("    if lives <= 0 then");
  push("      set game to 2");
  push("      set endplay to 1");
  push('      set status.text to "THE JUNGLE KEEPS YOU — " + got + " OF 32, SCORE " + score + " — CLICK TO RUN AGAIN"');
  push("    else");
  push("      set px to 40");
  push(`      set py to ${GY}`);
  push("      set under to 0");
  push("      set pvy to 0");
  push("      set pvx to 0");
  push("      set swinging to 0");
  push("      set itim to 90");
  push("      set dealflag to 1");
  push("    end");
  push("  end");

  // ---- HUD
  push('  set scoretx.text to "" + score');
  push("  set tmm to floor(tleft / 3600)");
  push("  set tss to floor(tleft / 60) % 60");
  push("  if tss < 10 then");
  push('    set timetx.text to tmm + ":0" + tss');
  push("  else");
  push('    set timetx.text to tmm + ":" + tss');
  push("  end");
  push('  set livestx.text to "RUNNERS " + lives');
  push('  set scenetx.text to "BYTE " + scr + " · " + got + "/32"');
  push("end");
  push("set scoretx.visible to (game != 9)");
  push("set timetx.visible to (game != 9)");
  push("set livestx.visible to (game != 9)");
  push("set scenetx.visible to (game != 9)");
  push("end");

  const brain = L.join("\n");

  // ---------- objects ----------
  const objects = [];
  const inGame = "(game == 0)";

  // jungle dressing: canopy and trunks
  objects.push({
    id: "pf_cn", name: "canopy", type: "line",
    x: 16, y: 40, size: 448, angle: 0, color: JUNGLE, glow: 3, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });
  [60, 180, 300, 420].forEach((tx, i) => {
    objects.push({
      id: "pf_tr" + i, name: "trunk" + (i + 1), type: "line",
      x: tx, y: 40, size: 56, angle: 90, color: "#2e5e3a", glow: 2, visible: 0, text: "",
      script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
    });
  });
  // the ground, in segments (its gaps are the danger)
  for (let i = 0; i < 3; i++) {
    objects.push({
      id: "pf_g" + i, name: "ground" + (i + 1), type: "line",
      x: 16, y: GLINE, size: 100, angle: 0, color: JUNGLE, glow: 3, visible: 0, text: "",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and gon[${i}] == 1)
set self.x to gsx[${i}]
set self.size to gsl[${i}]
end` }]
    });
  }
  // the tar pit shows its surface; the pond shows its water
  objects.push({
    id: "pf_tar", name: "tarpit", type: "line",
    x: PITX0, y: GLINE + 4, size: PITX1 - PITX0, angle: 0, color: TAR, glow: 2, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and p <= 1)\nend` }]
  });
  objects.push({
    id: "pf_wat", name: "water", type: "line",
    x: WAT0, y: GLINE + 4, size: WAT1 - WAT0, angle: 0, color: "#2a5a8c", glow: 3, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and crocon == 1)\nend` }]
  });
  // the tunnel floor
  objects.push({
    id: "pf_tf", name: "tunnelfloor", type: "line",
    x: 16, y: ULINE, size: 448, angle: 0, color: "#5a6470", glow: 2, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to ${inGame}\nend` }]
  });

  // crocodiles: closed jaws hold you, open jaws end you
  CROCX.forEach((cx, k) => {
    objects.push({
      id: "pf_c" + k, name: "croc" + (k + 1), type: "text",
      x: cx, y: 258, size: 14, color: GREEN, glow: 6, visible: 0, text: "▬",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and crocon == 1)
if co${k} == 1 then
  set self.text to "Λ"
  set self.color to "${RED}"
else
  set self.text to "▬"
  set self.color to "${GREEN}"
end
end` }]
    });
  });

  // rolling logs
  for (let i = 0; i < 2; i++) {
    objects.push({
      id: "pf_l" + i, name: "log" + (i + 1), type: "text",
      x: -50, y: 256, size: 14, color: BROWN, glow: 5, visible: 0, text: "◉",
      script: [{
        event: "code", source: `when tick
set self.visible to (${inGame} and logn >= ${i + 1})
set self.x to lgx[${i}]
set self.angle to lgx[${i}] * 4
end` }]
    });
  }
  // cobra and campfire share the same post
  objects.push({
    id: "pf_cb", name: "cobra", type: "text",
    x: HAZX, y: 254, size: 15, color: "#b8d84a", glow: 7, visible: 0, text: "S",
    script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and cobraon == 1)\nend` }]
  });
  objects.push({
    id: "pf_fi", name: "campfire", type: "text",
    x: HAZX, y: 254, size: 15, color: "#ff8c3a", glow: 10, visible: 0, text: "▲",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and fireon == 1)
set self.glow to 8 + sin(time() * 700) * 5
end` }]
  });
  // the treasure of this screen
  objects.push({
    id: "pf_t", name: "treasure", type: "text",
    x: TREX, y: 254, size: 15, color: GOLD, glow: 12, visible: 0, text: "$",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and treon == 1)
set self.glow to 10 + sin(time() * 400) * 4
${[0, 1, 2, 3].map(t => `if tkind == ${t} then\n  set self.text to "${TREGLYPH[t]}"\n  set self.color to "${TRECOLOR[t]}"\nend`).join("\n")}
end` }]
  });

  // the vine and its knot
  objects.push({
    id: "pf_v", name: "vine", type: "line",
    x: VPX, y: VPY, size: VLEN, angle: 90, color: "#6aa84a", glow: 4, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and vineon == 1)
set self.angle to 90 + vang
end` }]
  });
  objects.push({
    id: "pf_vk", name: "vineknot", type: "dot",
    x: VPX, y: VPY + VLEN, size: 4, color: "#6aa84a", glow: 6, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and vineon == 1)
set self.x to vtx
set self.y to vty
end` }]
  });
  // the ladder
  objects.push({
    id: "pf_ld", name: "ladderbar", type: "line",
    x: LADX, y: GLINE, size: ULINE - GLINE, angle: 90, color: CYAN, glow: 3, visible: 0, text: "",
    script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and ladder == 1)\nend` }]
  });
  // tunnel walls
  [[430, "uwallr"], [50, "uwalll"]].forEach(([wx, flag], i) => {
    for (let j = 0; j < 2; j++) {
      objects.push({
        id: "pf_w" + i + j, name: "brickwall" + (i * 2 + j + 1), type: "box",
        x: wx, y: 294 + j * 32, size: 28, color: STEEL, glow: 2, visible: 0, text: "",
        script: [{ event: "code", source: `when tick\nset self.visible to (${inGame} and ${flag} == 1)\nend` }]
      });
    }
  });
  // the scorpion
  objects.push({
    id: "pf_s", name: "scorpion", type: "text",
    x: -50, y: 326, size: 13, color: "#d87a7a", glow: 7, visible: 0, text: "Ж",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and scorpon == 1)
set self.x to sx
end` }]
  });

  // the runner (flickers through the grace)
  objects.push({
    id: "pf_p", name: "runner", type: "box",
    x: 40, y: GY, size: 11, color: WHITE, glow: 10, visible: 0, text: "",
    script: [{
      event: "code", source: `when tick
set self.visible to (${inGame} and (itim <= 0 or itim % 8 < 4))
set self.x to px
set self.y to py
end` }]
  });

  // HUD
  objects.push({ id: "pf_sc", name: "scoretx", type: "text", x: 58, y: 24, size: 20, color: WHITE, glow: 8, visible: 0, text: "2000", script: [] });
  objects.push({ id: "pf_tm", name: "timetx", type: "text", x: 170, y: 22, size: 13, color: GOLD, glow: 6, visible: 0, text: "3:00", script: [] });
  objects.push({ id: "pf_by", name: "scenetx", type: "text", x: 280, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "BYTE 6 · 0/32", script: [] });
  objects.push({ id: "pf_lv", name: "livestx", type: "text", x: 414, y: 22, size: 11, color: DIM, glow: 4, visible: 0, text: "RUNNERS 3", script: [] });
  objects.push({ id: "pf_st", name: "status", type: "text", x: W / 2, y: 354, size: 9, color: DIM, glow: 4, visible: 1, text: "", script: [] });

  // attract
  objects.push({ id: "pf_big", name: "bigtitle", type: "text", x: W / 2, y: 108, size: 42, color: GREEN, glow: 18, visible: 1, text: "PITFALL!", script: [] });
  objects.push({ id: "pf_sub", name: "subline", type: "text", x: W / 2, y: 140, size: 10, color: DIM, glow: 4, visible: 1, text: "ACTIVISION 1982 · 255 SCREENS, 1 BYTE", script: [] });
  objects.push({ id: "pf_coin", name: "coinline", type: "text", x: W / 2, y: 172, size: 12, color: WHITE, glow: 8, visible: 1, text: "◎ INSERT COIN — CLICK TO RUN ◎", script: [] });
  objects.push({ id: "pf_play", name: "playbtn", type: "text", x: W / 2, y: 210, size: 16, color: GREEN, glow: 12, visible: 1, text: "[ RUN ]", script: [] });
  objects.push({
    id: "pf_help", name: "help", type: "text",
    x: W / 2, y: 244, size: 9, color: DIM, glow: 3, visible: 1,
    text: "A·D RUN · SPACE JUMP+GRAB · W/S CLIMB",
    script: []
  });
  objects.push({
    id: "pf_help2", name: "help2", type: "text",
    x: W / 2, y: 262, size: 9, color: DIM, glow: 3, visible: 1,
    text: "32 TREASURES · THE WORLD LOOPS",
    script: []
  });

  objects.push({
    id: "pf_ref", name: "referee", type: "text",
    x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: brain }]
  });
  objects.push({ id: "pf_t1", name: "stick1tag", type: "text", x: 0, y: 0, size: 1, color: DIM, glow: 0, visible: 0, text: "RUN", script: [] });

  return { title: "Pitfall! (1982)",
    display: "tv2600", hardware: "tv2600",   // the real machine's era
    objects };
}

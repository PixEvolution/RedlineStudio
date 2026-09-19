// example-tennis.js — Tennis for Two (1958), rebuilt in our studio.
// William Higinbotham built it at Brookhaven National Laboratory to liven up a
// visitors' day: an analog computer drew a tennis court side-on onto an
// oscilloscope, and TWO players — this was multiplayer from day one — each had
// a knob for angle and a button to hit. Gravity bent every shot, the net was
// real, and the crowd lined up around the gym. Pong is its grandchild.
//
// This example debuts RedScript's trig: sin() and cos() (in degrees) turn each
// player's knob angle into a velocity, exactly what the analog computer did.
//
//   LEFT PLAYER:  W / S aim up-down · D hit        (green)
//   RIGHT PLAYER: ↑ / ↓ aim up-down · ← hit        (amber)
//   Hit any time the ball is on your side — even mid-air, like the original.
//   3 bounces on your side or out your back edge = point against you. First to 5.

const GROUND_Y = 300, NET_X = 240, NET_TOP = 258, SPEED = 4.6, GRAV = 0.13;

// generates the "someone scored a point" block (used in 3 places)
function scoreBlock(side /* 1 = left scores */, pad) {
  const who = side === 1 ? "LEFT" : "RIGHT";
  const scoreVar = side === 1 ? "lscore" : "rscore";
  const loser = side === 1 ? -1 : 1;
  const serveX = loser === 1 ? 120 : 360;
  return [
    `${pad}set ${scoreVar} to ${scoreVar} + 1`,
    `${pad}explode self`,
    `${pad}say "POINT ${who}" for 1.5`,
    `${pad}if ${scoreVar} >= 5 then`,
    `${pad}  set gameover to 1`,
    `${pad}  set status.text to "${who} WINS THE MATCH — CLICK TO RESET"`,
    `${pad}else`,
    `${pad}  set serving to 1`,
    `${pad}  set servesider to ${loser}`,
    `${pad}  set self.x to ${serveX}`,
    `${pad}  set self.y to 250`,
    `${pad}  set vx to 0`,
    `${pad}  set vy to 0`,
    `${pad}  set bounces to 0`,
    `${pad}  set leftlock to 0`,
    `${pad}  set rightlock to 0`,
    `${pad}  set status.text to "${loser === 1 ? "LEFT SERVES — PRESS D" : "RIGHT SERVES — PRESS ←"}"`,
    `${pad}end`
  ].join("\n");
}

function resetLines(pad) {
  return [
    `${pad}set langle to 45`,
    `${pad}set rangle to 45`,
    `${pad}set lscore to 0`,
    `${pad}set rscore to 0`,
    `${pad}set gameover to 0`,
    `${pad}set serving to 1`,
    `${pad}set servesider to 1`,
    `${pad}set self.x to 120`,
    `${pad}set self.y to 250`,
    `${pad}set vx to 0`,
    `${pad}set vy to 0`,
    `${pad}set bounces to 0`,
    `${pad}set hitcool to 0`,
    `${pad}set leftlock to 0`,
    `${pad}set rightlock to 0`,
    `${pad}set status.text to "LEFT SERVES — PRESS D"`
  ].join("\n");
}

function ballCode() {
  const L = [];
  const push = (s) => L.push(s);

  push("when start");
  push(resetLines(""));
  push("end");

  push("when tick");
  push("if gameover == 0 then");
  // ---- knobs (smooth while held) ----
  push('  if keydown("w") then');
  push("    set langle to min(80, langle + 1.6)");
  push("  end");
  push('  if keydown("s") then');
  push("    set langle to max(10, langle - 1.6)");
  push("  end");
  push('  if keydown("ArrowUp") then');
  push("    set rangle to min(80, rangle + 1.6)");
  push("  end");
  push('  if keydown("ArrowDown") then');
  push("    set rangle to max(10, rangle - 1.6)");
  push("  end");
  push("  set hitcool to hitcool - 1");
  // ---- LEFT hit (serve or any time the ball is on the left side) ----
  push('  if hitcool <= 0 and keydown("d") then');
  push("    set can to 0");
  push("    if serving == 1 and servesider == 1 then");
  push("      set can to 1");
  push("    end");
  push(`    if serving == 0 and self.x < ${NET_X} and leftlock == 0 then`);
  push("      set can to 1");
  push("    end");
  push("    if can == 1 then");
  push(`      set vx to cos(langle) * ${SPEED}`);
  push(`      set vy to 0 - sin(langle) * ${SPEED}`);
  push("      set serving to 0");
  push("      set bounces to 0");
  push("      set hitcool to 12");
  push("      set leftlock to 1");      // one hit per possession — no juggling!
  push('      set status.text to ""');
  push("    end");
  push("  end");
  // ---- RIGHT hit ----
  push('  if hitcool <= 0 and keydown("ArrowLeft") then');
  push("    set can to 0");
  push("    if serving == 1 and servesider == -1 then");
  push("      set can to 1");
  push("    end");
  push(`    if serving == 0 and self.x >= ${NET_X} and rightlock == 0 then`);
  push("      set can to 1");
  push("    end");
  push("    if can == 1 then");
  push(`      set vx to 0 - cos(rangle) * ${SPEED}`);
  push(`      set vy to 0 - sin(rangle) * ${SPEED}`);
  push("      set serving to 0");
  push("      set bounces to 0");
  push("      set hitcool to 12");
  push("      set rightlock to 1");     // one hit per possession — no juggling!
  push('      set status.text to ""');
  push("    end");
  push("  end");
  // ---- physics ----
  push("  if serving == 0 then");
  push("    set px to self.x");
  push("    change self.x by vx");
  push("    change self.y by vy");
  push(`    set vy to vy + ${GRAV}`);
  // ground bounce
  push(`    if self.y >= ${GROUND_Y} then`);
  push(`      set self.y to ${GROUND_Y}`);
  push("      set vy to 0 - vy * 0.72");
  push("      set bounces to bounces + 1");
  push("      set leftlock to 0");
  push("      set rightlock to 0");
  push("      if bounces >= 3 then");
  push(`        if self.x < ${NET_X} then`);
  push(scoreBlock(-1, "          "));   // died on the left → right scores
  push("        else");
  push(scoreBlock(1, "          "));    // died on the right → left scores
  push("        end");
  push("      end");
  push("    end");
  // net: crossing below the tape bounces you back; clearing it resets bounces
  push("    if gameover == 0 and serving == 0 then");
  push(`      if (px - ${NET_X}) * (self.x - ${NET_X}) < 0 then`);
  push(`        if self.y > ${NET_TOP} then`);
  push("          set self.x to px");
  push("          set vx to 0 - vx * 0.55");
  push("          set leftlock to 0");
  push("          set rightlock to 0");
  push('          say "NET!" for 0.7');
  push("        else");
  push("          set bounces to 0");
  push("          set leftlock to 0");
  push("          set rightlock to 0");
  push("        end");
  push("      end");
  // out the back edges
  push("      if self.x < 6 then");
  push(scoreBlock(-1, "        "));     // out the left edge → right scores
  push("      end");
  push("      if self.x > 474 then");
  push(scoreBlock(1, "        "));      // out the right edge → left scores
  push("      end");
  push("    end");
  push("  end");
  // ---- HUD + aim indicators (the "knobs") ----
  push('  set lhud.text to "LEFT " + lscore + "   ∠" + floor(langle)');
  push('  set rhud.text to "∠" + floor(rangle) + "   " + rscore + " RIGHT"');
  push("  set laim.x to 26 + cos(langle) * 26");
  push(`  set laim.y to ${GROUND_Y} - 2 - sin(langle) * 26`);
  push("  set raim.x to 454 - cos(rangle) * 26");
  push(`  set raim.y to ${GROUND_Y} - 2 - sin(rangle) * 26`);
  push("end");
  push("end");

  push("when click");
  push("if gameover == 1 then");
  push(resetLines("  "));
  push("end");
  push("end");

  return L.join("\n");
}

export function buildTennisExample() {
  const objects = [];

  // the court: a dotted ground line and the net, pure oscilloscope
  let g = 0;
  for (let x = 20; x <= 460; x += 12) {
    objects.push({
      id: "tn_g" + (g++), name: "gr" + g, type: "dot",
      x, y: GROUND_Y + 3, size: 3, color: "#1f8f3c", glow: 4, visible: 1, text: "", script: []
    });
  }
  for (let y = NET_TOP + 4; y <= GROUND_Y - 2; y += 9) {
    objects.push({
      id: "tn_n" + (g++), name: "nt" + g, type: "dot",
      x: NET_X, y, size: 3, color: "#39ff5e", glow: 8, visible: 1, text: "", script: []
    });
  }

  // the ball IS the game — all logic lives on it
  objects.push({
    id: "tn_ball", name: "ball", type: "dot",
    x: 120, y: 250, size: 8, color: "#b9ffcb", glow: 20, visible: 1, text: "",
    script: [{ event: "code", source: ballCode() }]
  });

  // aim indicator dots (the knob needles)
  objects.push({
    id: "tn_laim", name: "laim", type: "dot",
    x: 44, y: 280, size: 4, color: "#7dff9e", glow: 10, visible: 1, text: "", script: []
  });
  objects.push({
    id: "tn_raim", name: "raim", type: "dot",
    x: 436, y: 280, size: 4, color: "#ff9d4a", glow: 10, visible: 1, text: "", script: []
  });

  objects.push({
    id: "tn_lhud", name: "lhud", type: "text",
    x: 95, y: 32, size: 14, color: "#7dff9e", glow: 8, visible: 1, text: "LEFT 0   ∠45", script: []
  });
  objects.push({
    id: "tn_rhud", name: "rhud", type: "text",
    x: 385, y: 32, size: 14, color: "#ff9d4a", glow: 8, visible: 1, text: "∠45   0 RIGHT", script: []
  });
  objects.push({
    id: "tn_status", name: "status", type: "text",
    x: 240, y: 60, size: 13, color: "#2fdc55", glow: 8, visible: 1,
    text: "LEFT SERVES — PRESS D", script: []
  });
  objects.push({
    id: "tn_title", name: "title", type: "text",
    x: 240, y: 336, size: 11, color: "#1f8f3c", glow: 4, visible: 1,
    text: "TENNIS FOR TWO — BROOKHAVEN 1958 · LEFT: W/S + D · RIGHT: ↑/↓ + ← · FIRST TO 5",
    script: []
  });

  return { title: "Tennis for Two (1958)", objects };
}

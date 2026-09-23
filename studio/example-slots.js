// example-slots.js — REDLINE SLOTS, the platform's reference casino machine.
// This is the pattern every casino game is built on: THE MACHINE DOES THE
// SHOW, THE PLATFORM DOES THE MATH. The odds live in the engine where no
// script can touch them (see the Guide) — a machine's code only:
//
//   set bet to 1/5/10        pick a stake
//   set spin to 1            pull the lever
//   (the platform sets spin to 2 while the coins move, then back to 0)
//   read result / win        the multiplier that came up, coins paid
//   read coins / pool        live balances, for the readouts
//
// Everything else here — reels, animation, paytable, jackpot fanfare — is
// ordinary studio objects and scripts. Reskin it into anything.
//
//   In the Studio, ▶ Test runs it in FREE PLAY (pretend coins, same odds).
//   Published to the Casino floor, it plays for real coins from its pool.

const SYMS = ["○", "●", "▲", "◆", "★"];
const REEL_Y = 158, REEL_X = [158, 240, 322];
const WHITE = "#ffffff", DIM = "#7a8894", GREEN = "#7dff9e", AMBER = "#ff9d4a", RED = "#ff5a55";

function brainCode() {
  const L = [];
  const push = (s) => L.push(s);

  push("when start");
  SYMS.forEach((s, i) => push(`set sym[${i}] to "${s}"`));
  push("set bet to 1");
  push("set pulled to 0");
  push("set anim to 0");
  push("set idlecycle to 0");
  push('set msg.text to ""');
  push("end");

  push("when tick");
  // live readouts — straight from the platform's reserved vars
  push('set coinstx.text to "COINS " + coins');
  push('set pooltx.text to "POOL " + pool');
  push('set levertx.text to "[ PULL - BET " + bet + " ]"');
  push("if casino == 1 then");
  push('  set modetx.text to ""');
  push("else");
  push('  set modetx.text to "FREE PLAY - TEST MODE"');
  push("end");
  // bet buttons light up
  push(`set bet1.color to "${DIM}"`);
  push(`set bet5.color to "${DIM}"`);
  push(`set bet10.color to "${DIM}"`);
  push("if bet == 1 then");
  push(`  set bet1.color to "${GREEN}"`);
  push("end");
  push("if bet == 5 then");
  push(`  set bet5.color to "${GREEN}"`);
  push("end");
  push("if bet == 10 then");
  push(`  set bet10.color to "${GREEN}"`);
  push("end");

  push("if pulled == 1 then");
  // the reels turn while the platform settles the spin
  push("  if anim > 0 or spin != 0 then");
  push("    set anim to max(0, anim - 1)");
  push("    if anim % 3 == 0 then");
  push("      set reel1.text to sym[floor(rand(0, 5))]");
  push("      set reel2.text to sym[floor(rand(0, 5))]");
  push("      set reel3.text to sym[floor(rand(0, 5))]");
  push("    end");
  push("    if anim % 9 == 0 then");
  push("      beep 330 for 0.03");
  push("    end");
  push("  else");
  // the reveal — the platform already decided; we just dress the reels
  push("    set pulled to 0");
  push("    if result < 0 then");
  push('      set msg.text to "NOT ENOUGH COINS"');
  push("      beep 120 for 0.3");
  push("    else");
  push("      if result == 0 then");
  push('        set reel1.text to "○"');
  push('        set reel2.text to "●"');
  push('        set reel3.text to "▲"');
  push('        set msg.text to "NO WIN"');
  push("      end");
  push("      if result == 1 then");
  push('        set reel1.text to "●"');
  push('        set reel2.text to "●"');
  push('        set reel3.text to "○"');
  push('        set msg.text to "PUSH - BET BACK"');
  push("        beep 440 for 0.08");
  push("      end");
  push("      if result == 2 then");
  push('        set reel1.text to "●"');
  push('        set reel2.text to "●"');
  push('        set reel3.text to "●"');
  push("        beep 523 for 0.1");
  push("      end");
  push("      if result == 5 then");
  push('        set reel1.text to "▲"');
  push('        set reel2.text to "▲"');
  push('        set reel3.text to "▲"');
  push("        beep 659 for 0.12");
  push("      end");
  push("      if result == 10 then");
  push('        set reel1.text to "◆"');
  push('        set reel2.text to "◆"');
  push('        set reel3.text to "◆"');
  push("        beep 784 for 0.15");
  push("      end");
  push("      if result == 100 then");
  push('        set reel1.text to "★"');
  push('        set reel2.text to "★"');
  push('        set reel3.text to "★"');
  push('        say "JACKPOT!" for 3');
  push("        beep 523 for 0.12");
  push("        beep 784 for 0.2");
  push("        beep 1046 for 0.35");
  push("      end");
  push("      if result >= 2 then");
  push('        set msg.text to "WIN " + win + "!"');
  push("      end");
  push("    end");
  push("  end");
  push("else");
  // idle: a lazy attract shimmer (this is the live card too)
  push("  set idlecycle to idlecycle + 1");
  push("  if idlecycle % 50 == 0 then");
  push("    set reel2.text to sym[floor(rand(0, 5))]");
  push("  end");
  push("end");
  push("end");

  push("when click");
  push("if pulled == 0 then");
  // bet buttons
  push("  if abs(mousex() - 150) < 42 and abs(mousey() - 292) < 14 then");
  push("    set bet to 1");
  push("  end");
  push("  if abs(mousex() - 240) < 42 and abs(mousey() - 292) < 14 then");
  push("    set bet to 5");
  push("  end");
  push("  if abs(mousex() - 330) < 42 and abs(mousey() - 292) < 14 then");
  push("    set bet to 10");
  push("  end");
  // THE LEVER
  push("  if abs(mousex() - 240) < 90 and abs(mousey() - 250) < 16 then");
  push("    if coins >= bet then");
  push("      set pulled to 1");
  push("      set anim to 40");
  push("      set spin to 1");             // ask the platform for a spin
  push('      set msg.text to ""');
  push("      beep 262 for 0.06");
  push("    else");
  push('      set msg.text to "NOT ENOUGH COINS"');
  push("      beep 120 for 0.3");
  push("    end");
  push("  end");
  push("end");
  push("end");

  return L.join("\n");
}

export function buildSlotsExample() {
  const objects = [];

  // cabinet trim
  objects.push({
    id: "sl_big", name: "bigtitle", type: "text",
    x: 240, y: 46, size: 34, color: RED, glow: 16, visible: 1, text: "REDLINE SLOTS", script: []
  });
  objects.push({
    id: "sl_frame", name: "frame", type: "box",
    x: 240, y: REEL_Y - 12, size: 96, angle: 45, color: "#1f8f3c", glow: 4, visible: 0, text: "", script: []
  });

  // the reels
  REEL_X.forEach((x, i) => {
    objects.push({
      id: "sl_r" + (i + 1), name: "reel" + (i + 1), type: "text",
      x, y: REEL_Y, size: 46, color: WHITE, glow: 14, visible: 1, text: SYMS[i + 1], script: []
    });
  });

  objects.push({
    id: "sl_msg", name: "msg", type: "text",
    x: 240, y: 205, size: 14, color: AMBER, glow: 10, visible: 1, text: "", script: []
  });

  // the lever + bets (the brain rides on the lever)
  objects.push({
    id: "sl_lever", name: "levertx", type: "text",
    x: 240, y: 250, size: 18, color: GREEN, glow: 12, visible: 1, text: "[ PULL - BET 1 ]",
    script: [{ event: "code", source: brainCode() }]
  });
  objects.push({
    id: "sl_b1", name: "bet1", type: "text",
    x: 150, y: 292, size: 13, color: GREEN, glow: 8, visible: 1, text: "[ BET 1 ]", script: []
  });
  objects.push({
    id: "sl_b5", name: "bet5", type: "text",
    x: 240, y: 292, size: 13, color: DIM, glow: 8, visible: 1, text: "[ BET 5 ]", script: []
  });
  objects.push({
    id: "sl_b10", name: "bet10", type: "text",
    x: 330, y: 292, size: 13, color: DIM, glow: 8, visible: 1, text: "[ BET 10 ]", script: []
  });

  // readouts
  objects.push({
    id: "sl_coins", name: "coinstx", type: "text",
    x: 92, y: 326, size: 12, color: WHITE, glow: 8, visible: 1, text: "COINS 0", script: []
  });
  objects.push({
    id: "sl_pool", name: "pooltx", type: "text",
    x: 388, y: 326, size: 12, color: WHITE, glow: 8, visible: 1, text: "POOL 0", script: []
  });
  objects.push({
    id: "sl_mode", name: "modetx", type: "text",
    x: 240, y: 326, size: 11, color: DIM, glow: 4, visible: 1, text: "", script: []
  });

  // the odds, on the cabinet, public — the house edge hides from no one
  objects.push({
    id: "sl_pays", name: "paytable", type: "text",
    x: 240, y: 350, size: 10, color: DIM, glow: 3, visible: 1,
    text: "PAIR=1x · 3●=2x · 3▲=5x · 3◆=10x · 3★=100x · RETURNS 92%", script: []
  });

  return { title: "Redline Slots", objects };
}

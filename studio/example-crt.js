// example-crt.js — the Cathode-Ray Tube Amusement Device (1947), rebuilt in our
// own studio. The original: a glowing beam dot arcs across an oscilloscope
// screen; the player turns knobs to steer it into paper targets; a hit defocuses
// the beam into a blast. Here: Up/Down aims, Space fires, gravity bends the arc.
//
// It's built out of ordinary studio pieces — dot, rings, text, blocks and one
// code block — so it doubles as the reference example for how scripting works.

export function buildCrtExample() {
  const missile = {
    id: "ex_missile", name: "missile", type: "dot",
    x: 40, y: 300, size: 8, color: "#39ff5e", glow: 16, visible: 1, text: "",
    script: [
      {
        event: "start", body: [
          { k: "set", lhs: "aim", value: "-5" },
          { k: "set", lhs: "hits", value: "0" },
          { k: "set", lhs: "flying", value: "0" },
          { k: "set", lhs: "self.x", value: "40" },
          { k: "set", lhs: "self.y", value: "300" },
          { k: "say", value: '"AIM: UP/DOWN   FIRE: SPACE"', seconds: "4" }
        ]
      },
      {
        event: "key", key: "ArrowUp", body: [
          { k: "if", cond: "flying == 0", then: [{ k: "change", lhs: "aim", by: "-0.5" }], else: [] }
        ]
      },
      {
        event: "key", key: "ArrowDown", body: [
          { k: "if", cond: "flying == 0", then: [{ k: "change", lhs: "aim", by: "0.5" }], else: [] }
        ]
      },
      {
        event: "key", key: "Space", body: [
          { k: "if", cond: "flying == 0", then: [
            { k: "set", lhs: "flying", value: "1" },
            { k: "set", lhs: "vy", value: "aim" }
          ], else: [] }
        ]
      },
      {
        // The flight + hit logic lives in one Code block — same language, text form.
        event: "code",
        source: [
          'when tick',
          '  if flying == 1 then',
          '    change self.x by 4',
          '    change self.y by vy',
          '    set vy to vy + 0.12',
          '    if target1.visible == 1 and dist(self, target1) < 22 then',
          '      explode target1',
          '      set target1.visible to 0',
          '      set hits to hits + 1',
          '      say "HIT!" for 1',
          '      set flying to 2',
          '    end',
          '    if target2.visible == 1 and dist(self, target2) < 22 then',
          '      explode target2',
          '      set target2.visible to 0',
          '      set hits to hits + 1',
          '      say "HIT!" for 1',
          '      set flying to 2',
          '    end',
          '    if target3.visible == 1 and dist(self, target3) < 22 then',
          '      explode target3',
          '      set target3.visible to 0',
          '      set hits to hits + 1',
          '      say "HIT!" for 1',
          '      set flying to 2',
          '    end',
          '    if self.x > 490 or self.y > 370 or self.y < -10 then',
          '      set flying to 2',
          '    end',
          '  end',
          '  if flying == 2 then',
          '    set flying to 0',
          '    set self.x to 40',
          '    set self.y to 300',
          '  end',
          '  set hud.text to "AIM " + aim + "   HITS " + hits + "/3"',
          '  set aimline.y to 300 + aim * 6',
          '  if hits == 3 then',
          '    say "ALL TARGETS DESTROYED" for 3',
          '    set hits to 0',
          '    set target1.visible to 1',
          '    set target2.visible to 1',
          '    set target3.visible to 1',
          '  end',
          'end'
        ].join("\n")
      }
    ]
  };

  const mkTarget = (n, x, y) => ({
    id: "ex_t" + n, name: "target" + n, type: "ring",
    x, y, size: 14, color: "#8dffa9", glow: 10, visible: 1, text: "", script: []
  });

  const hud = {
    id: "ex_hud", name: "hud", type: "text",
    x: 240, y: 345, size: 14, color: "#2fdc55", glow: 6, visible: 1, text: "", script: []
  };

  const aimline = {
    id: "ex_aimline", name: "aimline", type: "dot",
    x: 60, y: 270, size: 3, color: "#1f8f3c", glow: 6, visible: 1, text: "", script: []
  };

  return {
    title: "CRT Amusement Device (1947)",
    objects: [missile, mkTarget(1, 300, 120), mkTarget(2, 380, 200), mkTarget(3, 430, 90), hud, aimline]
  };
}

// behaviors.js — game logic WITHOUT code: ready-made behaviors you attach to
// an object with one click. Each one inserts ordinary blocks into the object's
// script — the same blocks you could have built by hand — so nothing here is
// magic: open what it inserted, read it, change the numbers, make it yours.
// That's also how you learn: every behavior is a working lesson.

// Each behavior: { id, name, blurb, needsTarget?, build(target) -> events[] }
// build() returns script EVENTS ({event, body}) ready to append to o.script.

export const BEHAVIORS = [
  {
    id: "move4",
    name: "🕹 Move — keys + joystick",
    blurb: "WASD (or joystick 1) slides this object around. Change the 3s to go faster.",
    build: () => [{
      event: "tick", body: [
        { k: "set", lhs: "self.ax", value: 'max(-1, min(1, keydown("d") - keydown("a") + stickx(1)))' },
        { k: "set", lhs: "self.ay", value: 'max(-1, min(1, keydown("s") - keydown("w") + sticky(1)))' },
        { k: "change", lhs: "self.x", by: "self.ax * 3" },
        { k: "change", lhs: "self.y", by: "self.ay * 3" }
      ]
    }]
  },
  {
    id: "ship",
    name: "🚀 Fly like a ship",
    blurb: "A/D (or joystick 1) turns, W (or stick up) thrusts — it drifts like Spacewar!.",
    build: () => [{
      event: "tick", body: [
        { k: "change", lhs: "self.angle", by: 'max(-1, min(1, keydown("d") - keydown("a") + stickx(1))) * 3' },
        { k: "if", cond: 'keydown("w") or sticky(1) < -0.35', then: [
          { k: "change", lhs: "self.velx", by: "cos(self.angle) * 0.1" },
          { k: "change", lhs: "self.vely", by: "sin(self.angle) * 0.1" }
        ], else: [] },
        { k: "change", lhs: "self.x", by: "self.velx" },
        { k: "change", lhs: "self.y", by: "self.vely" }
      ]
    }]
  },
  {
    id: "bounce",
    name: "🏀 Bounce around the screen",
    blurb: "Drifts and bounces off the edges forever. The 470/350 walls match a classic screen — tune them to yours.",
    build: () => [
      { event: "start", body: [
        { k: "set", lhs: "self.velx", value: "rand(-3, 3)" },
        { k: "set", lhs: "self.vely", value: "rand(-3, 3)" }
      ]},
      { event: "tick", body: [
        { k: "change", lhs: "self.x", by: "self.velx" },
        { k: "change", lhs: "self.y", by: "self.vely" },
        { k: "if", cond: "self.x < 10 or self.x > 470", then: [
          { k: "set", lhs: "self.velx", value: "-self.velx" }
        ], else: [] },
        { k: "if", cond: "self.y < 10 or self.y > 350", then: [
          { k: "set", lhs: "self.vely", value: "-self.vely" }
        ], else: [] }
      ]}
    ]
  },
  {
    id: "chase",
    name: "🎯 Chase an object",
    blurb: "Creeps toward the object you name, every frame. Raise the 0.03 to hunt harder.",
    needsTarget: true,
    build: (target = "target1") => [{
      event: "tick", body: [
        { k: "change", lhs: "self.x", by: `(${target}.x - self.x) * 0.03` },
        { k: "change", lhs: "self.y", by: `(${target}.y - self.y) * 0.03` }
      ]
    }]
  },
  {
    id: "mouse",
    name: "🖱 Follow the mouse",
    blurb: "Glides after the pointer (or a touch). Raise the 0.2 to snap tighter.",
    build: () => [{
      event: "tick", body: [
        { k: "change", lhs: "self.x", by: "(mousex() - self.x) * 0.2" },
        { k: "change", lhs: "self.y", by: "(mousey() - self.y) * 0.2" }
      ]
    }]
  },
  {
    id: "collect",
    name: "⭐ Score on touch",
    blurb: "Touch the object you name → +1 score, a beep, and this object jumps somewhere new. Pair it with ⏱ for a real arcade game.",
    needsTarget: true,
    build: (target = "target1") => [{
      event: "tick", body: [
        { k: "if", cond: `touching(self, ${target})`, then: [
          { k: "change", lhs: "score", by: "1" },
          { k: "beep", value: "620", seconds: "0.08" },
          { k: "set", lhs: "self.x", value: "rand(30, 450)" },
          { k: "set", lhs: "self.y", value: "rand(30, 330)" }
        ], else: [] }
      ]
    }]
  },
  {
    id: "button",
    name: "🔘 Clickable button",
    blurb: "Click or tap ON this object → +1 score and a beep. Swap the inside for anything.",
    build: () => [{
      event: "click", body: [
        { k: "if", cond: "abs(mousex() - self.x) < self.size and abs(mousey() - self.y) < self.size", then: [
          { k: "change", lhs: "score", by: "1" },
          { k: "beep", value: "523", seconds: "0.06" },
          { k: "say", value: '"+1"', seconds: "0.5" }
        ], else: [] }
      ]
    }]
  },
  {
    id: "wrap",
    name: "🌀 Wrap around the edges",
    blurb: "Fly off one side, appear on the other — Spacewar! space. Tune 480/360 to your screen.",
    build: () => [{
      event: "tick", body: [
        { k: "if", cond: "self.x > 480", then: [{ k: "change", lhs: "self.x", by: "-480" }], else: [] },
        { k: "if", cond: "self.x < 0", then: [{ k: "change", lhs: "self.x", by: "480" }], else: [] },
        { k: "if", cond: "self.y > 360", then: [{ k: "change", lhs: "self.y", by: "-360" }], else: [] },
        { k: "if", cond: "self.y < 0", then: [{ k: "change", lhs: "self.y", by: "360" }], else: [] }
      ]
    }]
  },
  {
    id: "spin",
    name: "🌪 Spin forever",
    blurb: "Rotates two degrees a frame. Works on ships, boxes and lines (they draw along their angle).",
    build: () => [{
      event: "tick", body: [
        { k: "change", lhs: "self.angle", by: "2" }
      ]
    }]
  },
  {
    id: "timer",
    name: "⏱ Coin timer — a real arcade end",
    blurb: "60 seconds on the clock, then the play ENDS (endplay). With a score, that's the whole ★ high-score contract.",
    build: () => [
      { event: "start", body: [
        { k: "set", lhs: "endplay", value: "0" },
        { k: "set", lhs: "score", value: "0" },
        { k: "set", lhs: "timeleft", value: "3600" }
      ]},
      { event: "tick", body: [
        { k: "if", cond: "endplay == 0", then: [
          { k: "change", lhs: "timeleft", by: "-1" },
          { k: "if", cond: "timeleft <= 0", then: [
            { k: "say", value: '"TIME UP — SCORE " + score', seconds: "3" },
            { k: "beep", value: "150", seconds: "0.4" },
            { k: "set", lhs: "endplay", value: "1" }
          ], else: [] }
        ], else: [] }
      ]}
    ]
  }
];

export function getBehavior(id) {
  return BEHAVIORS.find(b => b.id === id) || null;
}

// Append a behavior's events to an object's script (never replaces anything).
export function applyBehavior(obj, id, target) {
  const b = getBehavior(id);
  if (!b) return false;
  obj.script = obj.script || [];
  obj.script.push(...b.build(target));
  return true;
}

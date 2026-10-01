// Headless test of mobile features: usedKeys detection + virtual key presses.
import { Engine } from "./js/engine.js";
import { buildCrtExample } from "./studio/example-crt.js";
import { buildBertieExample } from "./studio/example-bertie.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

console.log("usedKeys():");
const crt = new Engine(null, buildCrtExample().objects);
const keys = crt.usedKeys().sort();
check("CRT reports its keys (ArrowDown, ArrowUp, Space)",
  JSON.stringify(keys) === JSON.stringify(["ArrowDown", "ArrowUp", "Space"]));
const bertie = new Engine(null, buildBertieExample().objects);
check("Bertie is click-only (no keys → no touch buttons)", bertie.usedKeys().length === 0);

// keydown() calls inside expressions are detected too
const kd = new Engine(null, [{ id: "k", name: "k", type: "dot", x: 0, y: 0, size: 5, color: "#fff", glow: 0, visible: 1, text: "",
  script: [{ event: "tick", body: [{ k: "if", cond: 'keydown("z")', then: [{ k: "change", lhs: "self.x", by: "1" }], else: [] }] }] }]);
check("keydown() in an expression is detected", JSON.stringify(kd.usedKeys()) === JSON.stringify(["z"]));

console.log("Virtual keys (touch buttons):");
crt.runEvents("start");
crt.pressKey("ArrowUp"); crt.releaseKey("ArrowUp");
check("virtual ArrowUp aims", crt.vars.aim === -5.5);
crt.pressKey("Space");
check("virtual Space fires (Space→\" \" normalized)", crt.vars.flying === 1);
check("keys map updated while held", crt.keys[" "] === true);
crt.releaseKey("Space");
check("release clears the key", crt.keys[" "] === false);
crt.pressKey("z");
const held = kd; held.runEvents("start");
held.pressKey("z"); held.step(); held.step(); held.releaseKey("z"); held.step();
check("held virtual key drives keydown() polling", held.byName.k.x === 2);

console.log("Gamepads:");
const pad = (over) => ({ connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })), ...over });
const padA = (over) => { const p = pad(over); p.buttons[0].pressed = true; return p; };
const GPSCRIPT = [{ id: "g", name: "g", type: "dot", x: 0, y: 0, size: 5, color: "#fff", glow: 0, visible: 1, text: "",
  script: [{ event: "code", source: 'when key "Space"\n  set fired to fired + 1\nend\nwhen tick\n  if keydown("w") then\n    change self.x by 1\n  end\n  if keydown("ArrowUp") then\n    change self.y by 1\n  end\nend' }] }];
const mkGp = () => { const e = new Engine(null, JSON.parse(JSON.stringify(GPSCRIPT))); e.runEvents("start"); return e; };

// THE PHANTOM S FIX: sim pedals/wheels register as "gamepads" whose axes
// rest at full deflection. An untouched device must press NOTHING.
const gp = mkGp();
for (let i = 0; i < 30; i++) { gp.pollGamepads([pad({ axes: [0, 1] })]); gp.step(); }
check("untouched device presses nothing (phantom pedal fix)", !gp.gpKeys["s"] && !gp.gpKeys["ArrowDown"]);
check("no key events fired either", gp.errors.length === 0 && !gp.vars.fired);

// a real button press wakes the pad
gp.pollGamepads([padA()]);
check("pressing a button wakes the pad (face A fires Space)", gp.vars.fired === 1);
gp.pollGamepads([padA()]);
check("held button doesn't re-fire the event", gp.vars.fired === 1);
gp.pollGamepads([pad()]);                      // release; centered axes now trusted
gp.pollGamepads([pad({ axes: [0, -1] })]); gp.step();
check("awake pad stick-up presses w AND ArrowUp", gp.byName.g.x === 1 && gp.byName.g.y === 1);
gp.pollGamepads([pad()]);
gp.step(); const xAfter = gp.byName.g.x;
gp.step();
check("releasing the stick releases the keys", gp.byName.g.x === xAfter);

// an axis pegged since the start is ignored EVEN on an awake pad,
// until it proves it can rest at center (kills stuck pedals + drift)
const gpx = mkGp();
const pegged = pad({ axes: [0, 1] }); pegged.buttons[5].pressed = true;
gpx.pollGamepads([pegged]); gpx.step();
check("pegged axis on an awake pad stays ignored", !gpx.gpKeys["s"]);
gpx.pollGamepads([pad()]);                     // the axis centers once...
gpx.pollGamepads([pad({ axes: [0, 1] })]); gpx.step();
check("once it centers, the axis works normally", gpx.gpKeys["s"] === true);

// two pads: split into player 1 / player 2 clusters (both woken first)
const gp2 = mkGp();
gp2.pollGamepads([padA(), padA()]);
gp2.pollGamepads([pad(), pad()]);
gp2.pollGamepads([pad({ axes: [0, -1] }), pad()]);
gp2.step();
check("two pads: pad 1 is WASD only", gp2.byName.g.x === 1 && gp2.byName.g.y === 0);
gp2.pollGamepads([pad(), pad({ axes: [0, -1] })]);
gp2.step();
check("two pads: pad 2 is arrows only", gp2.byName.g.y === 1);
check("no gamepads is harmless headless", (new Engine(null, []).pollGamepads(), true));


// ---- per-button layouts (v2): every button moves and resizes on its own ----
const { layoutSlot, clampBtnScale, btnTransform, emptyLayout, pinchScale, shiftIntoBox } = await import("./js/touch-controls.js");
console.log("Per-button layouts:");
check("one saved layout per control SET (order doesn't matter)",
  layoutSlot(["w", "a", "Space"]) === layoutSlot(["Space", "a", "w"]));
check("different controls = a different saved layout",
  layoutSlot(["w", "a"]) !== layoutSlot(["w", "a", "Space"]));
check("button scale clamps to sane thumb sizes",
  clampBtnScale(0.1) === 0.5 && clampBtnScale(9) === 2.2 && clampBtnScale("x") === 1);
check("an untouched button sits exactly where the default puts it",
  btnTransform(emptyLayout(), "w") === "translate(0px, 0px) scale(1)");
check("a moved + resized button wears its saved transform",
  btnTransform({ scale: 1, btns: { w: { x: -30, y: 12, s: 1.5 } } }, "w") === "translate(-30px, 12px) scale(1.5)");
check("the global −/+ scale multiplies every button's own size",
  btnTransform({ scale: 2, btns: { w: { x: 0, y: 0, s: 1.1 } } }, "w") === "translate(0px, 0px) scale(2.2)");

console.log("Pinch to resize:");
check("fingers spreading to double the distance doubles the button",
  pinchScale(1, 100, 200) === 2);
check("fingers closing to half the distance halves it",
  pinchScale(1, 200, 100) === 0.5);
check("a pinch builds on the button's CURRENT size",
  pinchScale(1.5, 100, 110) === 1.65);
check("pinch respects the sane thumb-size clamps",
  pinchScale(1, 100, 1000) === 2.2 && pinchScale(1, 1000, 100) === 0.5);
check("degenerate pinches (zero distance) can't blow up",
  pinchScale(1, 0, 0) === 1 && isFinite(pinchScale(1, 0, 300)));

console.log("Joysticks (stickx/sticky):");
const STICKSCRIPT = [{ id: "j", name: "j", type: "dot", x: 0, y: 0, size: 5, color: "#fff", glow: 0, visible: 1, text: "",
  script: [{ event: "code", source: "when tick\n  change self.x by stickx(1) * 2\n  change self.y by sticky(1) * 2\n  set aim to stickx(2)\nend" }] }];
const mkStick = () => { const e = new Engine(null, JSON.parse(JSON.stringify(STICKSCRIPT))); e.runEvents("start"); return e; };
{
  const e = mkStick();
  check("scripts declare their sticks by reading them", JSON.stringify(e.usedSticks()) === "[1,2]");
  check("an untouched stick reads dead center", e.stickVal(1).x === 0 && e.stickVal(1).y === 0);
  e.step();
  check("…so nothing moves on its own", e.byName.j.x === 0 && e.byName.j.y === 0);
  e.setStick(1, 0.5, -1);
  e.step();
  check("the on-screen stick drives the game (analog: half push = half speed)",
    e.byName.j.x === 1 && e.byName.j.y === -2);
  e.setStick(1, 9, -9);
  check("stick values clamp to -1..1", e.stickVal(1).x === 1 && e.stickVal(1).y === -1);
  e.clearStick(1);
  e.step();
  check("letting go recenters instantly", e.stickVal(1).x === 0);
  check("games without sticks report none", new Engine(null, []).usedSticks().length === 0);
}
{
  // gamepad analog sticks feed the same numbers
  const e = mkStick();
  const wake = pad(); wake.buttons[9].pressed = true;
  e.pollGamepads([wake]);                                  // a press wakes the pad
  e.pollGamepads([pad({ axes: [0, 0, 0, 0] })]);           // axes prove they can center
  e.pollGamepads([pad({ axes: [0.8, -0.6, 0.3, 0] })]);
  check("pad 1's LEFT stick is stick 1", e.stickVal(1).x === 0.8 && e.stickVal(1).y === -0.6);
  check("pad 1's RIGHT stick is stick 2", e.stickVal(2).x === 0.3);
  e.step();
  check("…and it drives the game like the screen stick", e.byName.j.x === 1.6 && e.vars.aim === 0.3);
  e.setStick(1, -1, 0);
  check("a held SCREEN stick outranks the pad on its number", e.stickVal(1).x === -1);
  e.clearStick(1);
  check("…and hands back to the pad when released", e.stickVal(1).x === 0.8);
  e.pollGamepads([pad({ axes: [0.05, 0.05, 0, 0] })]);
  check("the deadzone swallows analog jitter", e.stickVal(1).x === 0 && e.stickVal(1).y === 0);
  // a game that reads sticks doesn't get its keys ghost-pressed by the axes
  const g = mkStick();
  const w2 = pad(); w2.buttons[9].pressed = true;
  g.pollGamepads([w2]); g.pollGamepads([pad()]);
  g.pollGamepads([pad({ axes: [0, -1, 0, 0] })]);
  check("on a stick game, pad axes are ANALOG — no phantom key presses",
    !g.gpKeys["w"] && !g.gpKeys["ArrowUp"] && g.stickVal(1).y === -1);
  // the phantom-pedal rule still guards analog sticks
  const ph = mkStick();
  const w3 = pad({ axes: [0, 1, 0, 0] }); w3.buttons[9].pressed = true;
  ph.pollGamepads([w3]);
  check("a pegged-from-birth axis stays dead until it proves it can center",
    ph.stickVal(1).y === 0);
  // two pads = four sticks
  const e2 = mkStick();
  const a1 = pad(); a1.buttons[9].pressed = true;
  const a2 = pad(); a2.buttons[9].pressed = true;
  e2.pollGamepads([a1, a2]);
  e2.pollGamepads([pad(), pad()]);
  e2.pollGamepads([pad({ axes: [0.5, 0, 0, 0] }), pad({ axes: [-0.7, 0, 0.2, 0.9] })]);
  check("pad 2's sticks are 3 and 4",
    e2.stickVal(3).x === -0.7 && e2.stickVal(4).x === 0.2 && e2.stickVal(4).y === 0.9
    && e2.stickVal(1).x === 0.5);
}
console.log("Sticks say WHOSE they are (stickNtag labels):");
{
  const GAMES = [
    ["spacewar", (await import("./studio/example-spacewar.js")).buildSpacewarExample],
    ["spacerace", (await import("./studio/example-spacerace.js")).buildSpaceraceExample],
    ["gotcha", (await import("./studio/example-gotcha.js")).buildGotchaExample],
    ["tank", (await import("./studio/example-tank.js")).buildTankExample],
    ["spasim", (await import("./studio/example-spasim.js")).buildSpasimExample],
    ["gunfight", (await import("./studio/example-gunfight.js")).buildGunfightExample],
  ];
  for (const [name, build] of GAMES) {
    const e = new Engine(null, build().objects);
    const ok = e.usedSticks().every(n => {
      const t = e.byName["stick" + n + "tag"];
      return t && String(t.text).trim().length > 0 && Number(t.visible) === 0;
    });
    check(`${name}: every stick wears a name tag (hidden object, not scenery)`, ok && e.usedSticks().length > 0);
  }
  const gf = new Engine(null, GAMES[5][1]().objects);
  check("gun fight's tags spell out the dual-stick cabinet",
    gf.byName.stick1tag.text === "P1 WALK" && gf.byName.stick2tag.text.includes("AIM")
    && gf.byName.stick3tag.text === "P2 WALK");
  const tk = new Engine(null, GAMES[3][1]().objects);
  check("tank's stick 2 says it belongs to PLAYER 2", tk.byName.stick2tag.text === "P2");
}

console.log("The on-screen stick's geometry:");
const { stickVector } = await import("./js/touch-controls.js");
check("center = no input", stickVector(0, 0, 50).x === 0 && stickVector(0, 0, 50).y === 0);
check("half a radius up = half throttle up", stickVector(0, -25, 50).y === -0.5);
check("full right = full right", stickVector(50, 0, 50).x === 1);
check("dragging past the rim clamps to the unit circle", (() => {
  const v = stickVector(200, -200, 50);
  return Math.abs(Math.hypot(v.x, v.y) - 1) < 0.02;
})());

console.log("Layouts survive screen changes:");
check("a button inside the box doesn't move",
  JSON.stringify(shiftIntoBox({ left: 40, right: 100, top: 40, bottom: 100 }, 400, 800)) === '{"dx":0,"dy":0}');
check("a button off the RIGHT edge (big phone → small phone) pulls back in",
  shiftIntoBox({ left: 380, right: 440, top: 40, bottom: 100 }, 400, 800).dx === -42);
check("a button off the LEFT edge pulls back in",
  shiftIntoBox({ left: -30, right: 30, top: 40, bottom: 100 }, 400, 800).dx === 32);
check("a button below the bottom (fullscreen) pulls UP",
  shiftIntoBox({ left: 40, right: 100, top: 790, bottom: 850 }, 400, 800).dy === -52);
check("an infinite box never clamps vertically (the page scrolls instead)",
  shiftIntoBox({ left: 40, right: 100, top: 790, bottom: 850 }, 400, Infinity).dy === 0);


// ---- the generated CONTROLS line (PC + gamepad players) ----
{
  const { describeControls } = await import("./js/touch-controls.js");
  const { Engine } = await import("./js/engine.js");
  const mk = (src) => new Engine(null, [{ id: "t", name: "t", type: "dot", x: 0, y: 0, size: 5, color: "#fff", glow: 0, visible: 1, text: "", script: [{ event: "code", source: src }] }]);
  console.log("The CONTROLS line:");
  const e1 = mk('when tick\nif keydown("w") then\n  change self.x by 1\nend\nif keydown("ArrowUp") then\n  change self.y by 1\nend\nif keydown("Space") or stickx(1) > 0 then\n  set self.size to 6\nend\nend\nwhen click\nset self.x to 0\nend');
  const line = describeControls(e1);
  check("lists the real keys, WASD-first, arrows pretty", line.startsWith("CONTROLS:") && line.indexOf("W") < line.indexOf("SPACE") && line.includes("↑"));
  check("names the stick and the mouse", line.includes("🕹 stick 1") && line.includes("🖱 click"));
  check("tells gamepad players they're welcome", line.includes("gamepad ready"));
  const e2 = mk("when tick\nchange self.x by 1\nend");
  check("a game with no inputs gets NO line (nothing to say)", describeControls(e2) === "");
  const e3 = mk('when answer\nset self.x to len(answer())\nend');
  check("a teletype game says to type", describeControls(e3).includes("type + ENTER"));
}


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

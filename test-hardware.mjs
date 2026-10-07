// Headless test: ERA SIMULATION — display hardware × engine hardware as two
// per-game settings. The palettes and clamps (pure), the per-frame hardware
// plan (flicker, beam dim), the engine's movement tracking and voice budgets,
// the render path applying it all, the .rlgame fields, the museum stamps,
// and the Studio/offline/play wiring.
import { DISPLAYS, HARDWARE, displayOf, hardwareOf, snapColor, clampSpriteFrame, planHardware, describeEra } from "./js/hardware.js";
import { Engine, drawFrame } from "./js/engine.js";
import { packGame, unpackGame } from "./js/gamefile.js";
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (f) => readFileSync(f, "utf8");

console.log("The eras:");
{
  check("five displays, five hardware profiles, each with a name and a story",
    Object.keys(DISPLAYS).length === 5 && Object.keys(HARDWARE).length === 5
    && Object.values(DISPLAYS).every(d => d.name && d.blurb)
    && Object.values(HARDWARE).every(h => h.name && h.blurb));
  check("unknown keys fall back to modern — old games never break",
    displayOf("vga") === "modern" && hardwareOf("") === "modern" && displayOf("tv2600") === "tv2600");
  check("the TIA palette is the real shape: 16 hues × 8 luminances = 128",
    DISPLAYS.tv2600.palette.length === 128 && new Set(DISPLAYS.tv2600.palette).size > 100);
  check("MODERN changes nothing: no palette, no pixels, no outline",
    DISPLAYS.modern.palette === null && DISPLAYS.modern.px === null && !DISPLAYS.modern.outline);
  check("describeEra tells the maker the one promise that matters",
    describeEra("tv2600", "arcade8").includes("logic never changes")
    && describeEra("modern", "modern") === "");
}

console.log("Color snapping (pure):");
{
  check("a color snaps to its era's nearest neighbor",
    DISPLAYS.arcade8.palette.includes(snapColor("#e5322d", DISPLAYS.arcade8.palette)));
  check("B&W TV makes every color a gray",
    /^#(..)\1\1$/.test(snapColor("#39ff5e", DISPLAYS.bw72.palette)));
  check("an exact palette color stays itself",
    snapColor("#0000fc", DISPLAYS.arcade8.palette) === "#0000fc");
  check("a non-hex color passes through unharmed", snapColor("red", DISPLAYS.bw72.palette) === "red");
  check("no palette = no change", snapColor("#123456", null) === "#123456");
}

console.log("Sprite color clamps (pure):");
{
  check("budget -1 is a silhouette: every lit pixel becomes slot 1",
    clampSpriteFrame("0a1b2c", -1) === "011111");
  check("a 2600 sprite shows ONE color", new Set(clampSpriteFrame("123456789", 1).split("")).size === 1);
  check("an 8-bit sprite keeps its 3 most-used colors",
    (() => { const out = clampSpriteFrame("111223450", 3); return new Set(out.replace(/0/g, "")).size === 3 && out.startsWith("11122"); })());
  check("a sprite already under budget is untouched", clampSpriteFrame("1122", 3) === "1122");
  check("budget 0 (modern) is a no-op", clampSpriteFrame("abc", 0) === "abc");
}

console.log("The per-frame hardware plan:");
{
  const sprites = (n, y = 100) => Array.from({ length: n }, (_, i) => ({ type: "sprite", visible: 1, x: i * 30, y }));
  check("MODERN plans nothing", (() => { const p = planHardware(sprites(20), 0, "modern"); return !p.skip && p.dim === 1 && p.notes.length === 0; })());
  const p = planHardware(sprites(10), 0, "arcade8");
  check("10 sprites on one 8-bit scan band: exactly 2 flicker out, and it's reported",
    p.skip.size === 2 && p.notes.length === 1 && p.notes[0].includes("flicker"));
  const p2 = planHardware(sprites(10), 1, "arcade8");
  check("the flicker ROTATES — different frames drop different sprites (no one vanishes)",
    JSON.stringify([...p.skip]) !== JSON.stringify([...p2.skip]));
  check("sprites on different bands don't crowd each other",
    !planHardware([...sprites(6, 40), ...sprites(6, 200)], 0, "arcade8").skip);
  // the 2600 counts MOVABLES (recently moved, or any sprite); still scenery is playfield
  const movers = Array.from({ length: 8 }, (_, i) => ({ type: "dot", visible: 1, x: i * 30, y: 50, _hwMoved: 5 }));
  const walls = Array.from({ length: 8 }, (_, i) => ({ type: "line", visible: 1, x: i * 30, y: 50 }));
  check("eight MOVING dots on a 2600 line: three past the budget of 5 flicker",
    planHardware(movers, 0, "tv2600").skip.size === 3);
  check("eight still WALLS are playfield — the 2600 draws them free",
    !planHardware(walls, 0, "tv2600").skip);
  // the vector beam dims past its stroke budget
  const strokes = Array.from({ length: 96 }, () => ({ type: "line", visible: 1, x: 0, y: 0 }));
  const pv = planHardware(strokes, 0, "vector79");
  check("96 strokes on a 48-stroke beam: the phosphor dims to half",
    pv.dim <= 0.5 && pv.dim >= 0.45 && pv.notes[0].includes("dims"));
  check("invisible objects never count",
    !planHardware(Array.from({ length: 20 }, () => ({ type: "sprite", visible: 0, y: 10 })), 0, "arcade8").skip);
}

console.log("The engine under era hardware:");
{
  const objs = [
    { id: "a", name: "mover", type: "dot", x: 10, y: 50, size: 8, color: "#fff", glow: 0, visible: 1, text: "", script: [{ event: "code", source: "when tick\nchange self.x by 2\nend" }] },
    { id: "b", name: "wall", type: "box", x: 200, y: 50, size: 20, color: "#fff", glow: 0, visible: 1, text: "", script: [] },
  ];
  const e = new Engine(null, objs, { hardware: "tv2600", display: "bw72" });
  check("the engine carries its era", e.hardware === "tv2600" && e.display === "bw72");
  e.runEvents("start");
  for (let i = 0; i < 3; i++) e.step();
  check("movement tracking: the mover is marked, the wall is playfield",
    e.byName.mover._hwMoved > 0 && !e.byName.wall._hwMoved);
  check("the tick counter drives the flicker", e.ticks === 3);
  const em = new Engine(null, objs, {});
  em.runEvents("start"); em.step();
  check("MODERN engines skip the tracking entirely", em.byName.mover._hwMoved === undefined);
  check("junk era opts fall back to modern", new Engine(null, [], { display: "crt9000", hardware: 7 }).display === "modern");

  // voice budgets: LOGIC '72 has ONE voice — the second beep steals it
  const beeper = [{ id: "c", name: "ref", type: "text", x: 0, y: 0, size: 1, color: "#fff", glow: 0, visible: 0, text: "", script: [{ event: "code", source: "when start\nbeep 440 for 1\nbeep 880 for 1\nend" }] }];
  const eb = new Engine(null, beeper, { hardware: "logic72" });
  const notes = [];
  eb.onHwNote = (m) => notes.push(m);
  eb.runEvents("start");
  check("two beeps on a one-voice chip: one live channel, and it's reported",
    eb._voices.length === 1 && notes.length === 1 && notes[0].includes("steals"));
  eb.runEvents("start");
  check("the same note is never nagged twice", notes.length === 1 && eb.hwNotes.size === 1);
  const eb2 = new Engine(null, beeper, {});
  eb2.runEvents("start");
  check("MODERN never touches the voices", eb2._voices.length === 0 && eb2.hwNotes.size === 0);
}

console.log("The render path applies it (stub canvas, headless):");
{
  const calls = { fills: [], rects: 0, arcs: 0 };
  const stub = new Proxy({}, {
    get: (t, k) => {
      if (k === "canvas") return undefined;              // not a real canvas: direct paint
      if (k === "fillStyle") return t.fillStyle;
      return (...a) => { if (k === "fillRect") calls.rects++; if (k === "arc") calls.arcs++; };
    },
    set: (t, k, v) => { if (k === "fillStyle") { t.fillStyle = v; calls.fills.push(v); } return true; },
  });
  const objs = Array.from({ length: 10 }, (_, i) => ({ id: "s" + i, type: "sprite", visible: 1, x: i * 30, y: 100, size: 16, color: "#fff", glow: 0, frame: 0, sprite: { s: 8, frames: ["1".repeat(64)] } }));
  const notes = [];
  drawFrame(stub, objs, { w: 480, h: 360, display: "bw72", hardware: "arcade8", tik: 0, onNote: (m) => notes.push(m) });
  check("every painted color is an era color (plus the era's own black)",
    calls.fills.length > 0 && calls.fills.every(c => DISPLAYS.bw72.palette.includes(c) || c === "#000000"));
  const rects0 = calls.rects;
  calls.rects = 0; calls.fills.length = 0;
  drawFrame(stub, objs, { w: 480, h: 360, display: "modern", hardware: "modern", tik: 0 });
  check("under flicker, fewer sprites actually paint than on MODERN", rects0 < calls.rects);
  check("…and the note reaches the listener", notes.length >= 1);
}

console.log("The .rlgame carries its era:");
{
  const G = { title: "Era Test", w: 480, h: 360, objects: [{ id: "a", name: "dot1", type: "dot", x: 1, y: 2, size: 5, color: "#fff", glow: 0, visible: 1, text: "", script: [] }] };
  const rt = unpackGame(packGame({ ...G, display: "tv2600", hardware: "arcade8" }));
  check("display and hardware survive save/open", rt.display === "tv2600" && rt.hardware === "arcade8");
  const plain = unpackGame(packGame(G));
  check("a modern game carries no era fields (old files stay identical)",
    plain.display === "modern" && plain.hardware === "modern" && !packGame(G).includes("display"));
  check("junk era values are cleaned at the border",
    unpackGame(packGame({ ...G, display: "vga", hardware: "<script>" })).display === "modern");
}

console.log("The museum wears its real eras:");
{
  const expect = {
    "example-pong.js": ["bw72", "logic72"],             // TTL logic on a B&W TV
    "example-asteroids.js": ["vector79", "vector79"],   // a true XY monitor
    "example-adventure2600.js": ["tv2600", "tv2600"],   // the 2600 at home
    "example-sweeper.js": ["arcade8", "arcade8"],       // Z80 raster arcade
    "example-gunfight.js": ["bw72", "arcade8"],         // first CPU, still B&W
    "example-tennis.js": ["vector79", "logic72"],       // an oscilloscope
  };
  let good = 0;
  for (const [f, [d, hw]] of Object.entries(expect)) {
    const s = src("studio/" + f);
    if (s.includes(`display: "${d}", hardware: "${hw}"`)) good++;
    else console.log("   mis-stamped:", f);
  }
  check("spot checks: six machines wear exactly their real hardware", good === 6);
  const { readdirSync } = await import("fs");
  const all = readdirSync("studio").filter(f => /^example-.*\.js$/.test(f));
  const stamped = all.filter(f => src("studio/" + f).includes('display: "'));
  check("52 machines are stamped; terminals and slots stay modern on purpose",
    stamped.length === 52
    && !src("studio/example-rogue.js").includes('display: "')
    && !src("studio/example-slots.js").includes('display: "'));
}

console.log("The Studio and the players' pages wear it:");
{
  const st = src("studio/studio.html");
  check("two era selects sit in the publish panel",
    st.includes('id="g-display"') && st.includes('id="g-hardware"'));
  check("flipping either select is non-destructive and undoable",
    st.includes('delete scenes.game[key]') && st.includes("MODERN reverts everything"));
  check("▶ Test runs the era and the debug panel narrates it",
    st.includes("display: scenes.game.display, hardware: scenes.game.hardware")
    && st.includes("engine.onHwNote"));
  check("examples load their authentic era", st.includes("if (ex.display) scenes.game.display = ex.display"));
  check("thumbnails render through the era display", st.includes("scenes.game.display || \"modern\")"));
  check("play.html runs published games in their era",
    (src("play.html").match(/display: game\.data\?\.display/g) || []).length >= 4);
  check("arcade cards show era-correct screens",
    src("js/cards.js").includes("card._display") && src("js/cardfields.js").includes("display:"));
  const off = src("js/export-studio.js");
  check("the offline Studio has both era selects and tests with them",
    off.includes('id="eradisplay"') && off.includes('id="erahw"')
    && off.includes("display: game.display, hardware: game.hardware"));
  check("offline ➕ Player seats inherit the era", off.includes("display: B.display, hardware: B.hardware"));
  check("hardware.js rides both bundles",
    src("js/export.js").includes('"js/hardware.js"') && off.includes('"js/hardware.js"'));
  check("downloaded standalone games keep their era",
    src("js/export.js").includes("display: GAME.display, hardware: GAME.hardware"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

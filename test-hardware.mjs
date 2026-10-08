// Headless test: ERA SIMULATION — display hardware × engine hardware as two
// per-game settings. The palettes and clamps (pure), the per-frame hardware
// plan (flicker, beam dim), the engine's movement tracking and voice budgets,
// the render path applying it all, the .rlgame fields, the museum stamps,
// and the Studio/offline/play wiring.
import { DISPLAYS, HARDWARE, HW_DEFAULT, displayOf, hardwareOf, snapColor, clampSpriteFrame, planHardware, describeEra, FONT5, FONT5_UNKNOWN } from "./js/hardware.js";
import { Engine, drawFrame } from "./js/engine.js";
import { packGame, unpackGame } from "./js/gamefile.js";
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (f) => readFileSync(f, "utf8");

console.log("The eras:");
{
  check("five displays; FOUR chips — real machines only, no fantasy board",
    Object.keys(DISPLAYS).length === 5 && Object.keys(HARDWARE).length === 4
    && Object.values(DISPLAYS).every(d => d.name && d.blurb)
    && Object.values(HARDWARE).every(h => h.name && h.blurb));
  check("EVERY chip has real limits — no tier is unlimited until the museum earns one",
    Object.values(HARDWARE).every(h => h.voices > 0 && (h.movables || h.sprPerBand || h.beam || h.sprColors)));
  check("the default chip is the museum's newest real board",
    HW_DEFAULT === "arcade8" && hardwareOf("") === "arcade8" && hardwareOf("modern") === "arcade8"
    && displayOf("vga") === "modern" && displayOf("tv2600") === "tv2600");
  check("the TIA palette is the real shape: 16 hues × 8 luminances = 128",
    DISPLAYS.tv2600.palette.length === 128 && new Set(DISPLAYS.tv2600.palette).size > 100);
  check("the default changes nothing: no palette, no pixels, no outline",
    DISPLAYS.modern.palette === null && DISPLAYS.modern.px === null && !DISPLAYS.modern.outline);
  check("the default display is honestly NAMED: CRT phosphor (true MODERN is a later era)",
    DISPLAYS.modern.name === "CRT" && displayOf("modern") === "modern");
  check("describeEra tells the maker the one promise that matters",
    describeEra("tv2600", "logic72").includes("logic never changes")
    && describeEra("modern", "arcade8") === "" && describeEra("modern", undefined) === "");
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
  check("no chip in play (\"none\": edit canvas, thumbnails) plans nothing",
    (() => { const p = planHardware(sprites(20), 0, "none"); return !p.skip && p.dim === 1 && p.notes.length === 0; })());
  check("…but an ENGINE's default chip is real and really plans",
    planHardware(sprites(20), 0, hardwareOf(undefined)).skip.size === 12);
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
  em.runEvents("start"); em.step(); em.step();
  check("even default engines track movement — the default chip is a real one",
    em.hardware === "arcade8" && em.byName.mover._hwMoved > 0);
  check("junk era opts fall back to the defaults",
    (() => { const j = new Engine(null, [], { display: "crt9000", hardware: 7 }); return j.display === "modern" && j.hardware === "arcade8"; })());

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
  check("the default board has 3 voices — two beeps both keep their channels",
    eb2._voices.length === 2 && eb2.hwNotes.size === 0);
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
  drawFrame(stub, objs, { w: 480, h: 360, display: "modern", hardware: "none", tik: 0 });
  check("under flicker, fewer sprites actually paint than with no chip", rects0 < calls.rects);
  check("…and the note reaches the listener", notes.length >= 1);
}

console.log("The character ROM (5×7 — solid text, like the real boards):");
{
  check("every glyph is exactly 35 on/off pixels",
    Object.values(FONT5).every(g => g.length === 35 && !/[^01]/.test(g))
    && FONT5_UNKNOWN.length === 35);
  // the ROM must cover every character the museum's games actually print —
  // collected at RUNTIME from the BUILT games (object text + every string in
  // the compiled RedScript sources), not by regexing raw source files, which
  // quote-escapes can scramble (that's how † and ✦ once slipped through)
  const { readdirSync } = await import("fs");
  const used = new Set();
  for (const f of readdirSync("studio").filter(f => /^example-.*\.js$/.test(f))) {
    const mod = await import("./studio/" + f);
    const ex = mod[Object.keys(mod).find(k => k.startsWith("build"))]();
    const feed = (str) => { for (const ch of String(str).toUpperCase()) if (ch.charCodeAt(0) > 31) used.add(ch); };
    for (const o of ex.objects) {
      feed(o.text || "");
      for (const ev of o.script || []) {
        for (const m of String(ev.source || "").matchAll(/"([^"]*)"/g)) feed(m[1]);
      }
    }
  }
  const missing = [...used].filter(ch => !(ch in FONT5));
  check(`the ROM covers all ${used.size} characters the museum actually renders (missing: ${missing.join(" ") || "none"})`,
    missing.length === 0);
  check("lowercase maps to CAPITALS — character ROMs had none", !("a" in FONT5) && ("A" in FONT5));

  // behavior: on a pixel display, text is fillRect blocks, never fillText
  const mkStub = () => {
    const calls = { rects: 0, texts: 0 };
    const stub = new Proxy({}, {
      get: (t, k) => {
        if (k === "canvas") return undefined;
        if (k === "fillStyle" || k === "shadowColor") return t[k];
        return (...a) => { if (k === "fillRect") calls.rects++; if (k === "fillText") calls.texts++; };
      },
      set: (t, k, v) => { t[k] = v; return true; },
    });
    return { stub, calls };
  };
  const txt = [{ id: "t", type: "text", visible: 1, x: 240, y: 100, size: 14, color: "#fff", glow: 0, text: "HI" }];
  const a = mkStub();
  drawFrame(a.stub, txt, { w: 480, h: 360, display: "tv2600" });
  const lit = (FONT5["H"].match(/1/g) || []).length + (FONT5["I"].match(/1/g) || []).length;
  check("on HOME TV '77, \"HI\" is exactly its ROM pixels — zero font smoothing",
    a.calls.texts === 0 && a.calls.rects >= lit && a.calls.rects <= lit + 130);  // + background scan rows
  const b = mkStub();
  drawFrame(b.stub, txt, { w: 480, h: 360, display: "modern" });
  check("on the CRT, text still uses the smooth font", b.calls.texts === 1);

  // a BIG TITLE that overflows steps DOWN a device pixel and stays SPACED —
  // it never falls into cramped lettering just because the snap rounded up
  const xs = [];
  const stub2 = new Proxy({}, {
    get: (t, k) => {
      if (k === "canvas") return undefined;
      return (...a) => { if (k === "fillRect") xs.push(a[0]); };
    },
    set: () => true,
  });
  drawFrame(stub2, [{ id: "t2", type: "text", visible: 1, x: 240, y: 100, size: 40, color: "#fff", glow: 0, text: "MISSILE COMMAND" }],
    { w: 480, h: 360, display: "arcade8" });
  const ux = [...new Set(xs)].sort((a, b) => a - b);
  const diffs = ux.slice(1).map((v, i) => v - ux[i]).filter(d => d > 0.01);
  const minD = Math.min(...diffs), maxD = Math.max(...diffs);
  check("a big title fits the screen AND keeps its letter gaps",
    ux[0] >= 0 && ux[ux.length - 1] <= 478 && maxD >= 1.9 * minD);   // a gap column exists
}

console.log("The .rlgame carries its era:");
{
  const G = { title: "Era Test", w: 480, h: 360, objects: [{ id: "a", name: "dot1", type: "dot", x: 1, y: 2, size: 5, color: "#fff", glow: 0, visible: 1, text: "", script: [] }] };
  const rt = unpackGame(packGame({ ...G, display: "tv2600", hardware: "arcade8" }));
  check("display and hardware survive save/open", rt.display === "tv2600" && rt.hardware === "arcade8");
  const plain = unpackGame(packGame(G));
  check("a default game carries no era fields (old files stay identical)",
    plain.display === "modern" && plain.hardware === "arcade8" && !packGame(G).includes("display")
    && !packGame({ ...G, hardware: "arcade8" }).includes("hardware"));
  check("junk era values are cleaned at the border — to the real defaults",
    (() => { const j = unpackGame(packGame({ ...G, display: "vga", hardware: "<script>" })); return j.display === "modern" && j.hardware === "arcade8"; })());
  check("a leftover 'modern' chip from older saves becomes the default board",
    unpackGame(packGame({ ...G, hardware: "modern" })).hardware === "arcade8");
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
    st.includes('delete scenes.game[key]') && st.includes("the defaults revert everything"));
  check("the WORKSPACE previews the era display live — no Test needed to see it",
    /drawFrame\(canvas\.getContext\("2d"\), scene\.objects, \{[^}]*display: scenes\.game\.display/s.test(st));
  check("…and the offline workspace previews it too",
    src("js/export-studio.js").includes("h: game.h, display: game.display })"));
  check("the selects: CRT default monitor, four REAL chips, 8-BIT the default board",
    st.includes("CRT · the Studio's phosphor (default)")
    && st.includes("ARCADE 8-BIT · the newest board (default)") && !st.includes("REDLINE"));
  check("▶ Test runs the era and the debug panel narrates it",
    st.includes("display: scenes.game.display, hardware: scenes.game.hardware")
    && st.includes("engine.onHwNote"));
  check("examples load their authentic era", st.includes("if (ex.display) scenes.game.display = ex.display"));
  check("thumbnails render through the era display", st.includes("scenes.game.display || \"modern\")"));
  check("play.html runs published games in their era",
    (src("play.html").match(/new Engine\([^)]*display: game\.data\?\.display/gs) || []).length >= 4);
  check("…and EVERY still frame too: pre-play screens and spectator snapshots",
    (src("play.html").match(/drawFrame\([^;]*display: game\.data\?\.display/gs) || []).length === 8);
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

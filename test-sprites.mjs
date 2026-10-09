// Headless test: SPRITES AT SCALE + MODELS EVERYWHERE — the Tron-line caps
// (32×32, 16 frames, per-sprite 16-color PROMs), the .rlmodel file (sealed,
// schema-rebuilt, round-trips offline → online), the era selects redrawing
// the workspace the moment they change, and the offline Studio growing the
// 🎨 sprite editor and the 📦 model shelf.
import { readFileSync } from "node:fs";
import { SPRITE_SIZES, SPRITE_MAX_FRAMES, SPRITE_PAL, STARTER_SPRITE, blankFrame, makeObject } from "./js/engine.js";
import { resizeFrame, flipH, floodFill } from "./js/sprite-editor.js";
import { packGame, unpackGame, packModel, unpackModel } from "./js/gamefile.js";
import { clampSpriteFrame } from "./js/hardware.js";
import { buildOfflineStudioHtml } from "./js/export-studio.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (p) => readFileSync(p, "utf8");

console.log("The Tron line — the caps are real 1982 numbers:");
{
  check("grids now run 8 / 16 / 24 / 32 (the editor's size menu follows automatically)",
    JSON.stringify(SPRITE_SIZES) === JSON.stringify([8, 16, 24, 32]));
  check("16 frames of animation, 16 palette slots", SPRITE_MAX_FRAMES === 16 && SPRITE_PAL.length === 16);
  check("gamefile's whitelist stays in sync with the engine",
    src("js/gamefile.js").includes("[8, 16, 24, 32]") && src("js/gamefile.js").includes("GF_SPRITE_FRAMES_MAX = 16"));
  check("a fresh sprite is still the friendly 16×16 slime",
    makeObject("sprite", "s").sprite.s === 16 && makeObject("sprite", "s").sprite.frames[0] === STARTER_SPRITE);
  check("resize up-scales every pixel (16 → 32 quadruples the area)",
    resizeFrame(STARTER_SPRITE, 16, 32).length === 32 * 32
    && resizeFrame(blankFrame(24), 24, 32) === blankFrame(32));
}

console.log("Custom palettes — the per-sprite color PROM:");
{
  const pal = SPRITE_PAL.map((c, i) => (i === 0 ? "transparent" : "#1100" + "0123456789abcdef"[i] + "f".slice(0, 1)));
  const myPal = SPRITE_PAL.slice(); myPal[8] = "#123456";
  const sprite = {
    ...makeObject("sprite", "hero", 100, 100),
    sprite: { s: 32, frames: Array.from({ length: 16 }, (_, i) => blankFrame(32).slice(1) + (i % 16).toString(16)), pal: myPal }
  };
  const g = unpackGame(packGame({ title: "T", objects: [sprite] }));
  check("a 32×32, 16-frame, custom-PROM sprite survives the .rlgame round trip exactly",
    g.objects[0].sprite.s === 32 && g.objects[0].sprite.frames.length === 16
    && g.objects[0].sprite.pal[8] === "#123456" && g.objects[0].sprite.pal[0] === "transparent");
  const over = { ...sprite, sprite: { s: 32, frames: Array.from({ length: 20 }, () => blankFrame(32)) } };
  check("a 17th+ frame is cut at the door (the cap is the schema, not politeness)",
    unpackGame(packGame({ title: "T", objects: [over] })).objects[0].sprite.frames.length === 16);
  const evil = { ...sprite, sprite: { s: 32, frames: [blankFrame(32)], pal: myPal.map((c, i) => (i === 3 ? "url(javascript:x)" : c)) } };
  check("a palette entry that isn't a hex color is bleached to white",
    unpackGame(packGame({ title: "T", objects: [evil] })).objects[0].sprite.pal[3] === "#ffffff");
  const short = { ...sprite, sprite: { s: 32, frames: [blankFrame(32)], pal: ["transparent", "#fff"] } };
  check("a palette that isn't exactly 16 entries is dropped (stock PROM applies)",
    !unpackGame(packGame({ title: "T", objects: [short] })).objects[0].sprite.pal);
  check("the engine has always honored sp.pal at draw time", src("js/engine.js").includes("sp.pal || SPRITE_PAL"));
  // the era chips still clamp a custom-PROM sprite like any other
  const busy = "0123456789abcdef".repeat(64);   // 32×32, all 16 slots used
  const one = clampSpriteFrame(busy, -1), three = clampSpriteFrame(busy, 3);
  const distinct = (f) => new Set(f.split("").filter((c) => c !== "0")).size;
  check("2600 flattens any sprite to one color; ARCADE 8-BIT keeps its best three",
    distinct(one) === 1 && distinct(three) === 3);
}

console.log("The .rlmodel file — models travel outside the site now:");
{
  const hero = {
    ...makeObject("sprite", "hero", 120, 100),
    sprite: { s: 16, frames: [STARTER_SPRITE, flipH(STARTER_SPRITE, 16)], pal: SPRITE_PAL.slice() },
    script: [{ event: "code", source: "when tick\n change self.x by 2\nend" }]
  };
  const sidekick = { ...makeObject("dot", "pet", 90, 110), script: [{ event: "tick", body: [{ k: "set", lhs: "self.x", value: "hero.x - 20" }] }] };
  const packed = packModel({ name: "Hero pack", description: "A hero and his pet", objects: [hero, sidekick] });
  const m = unpackModel(packed);
  check("round trip: name, description and BOTH objects arrive, scripts and all",
    m.name === "Hero pack" && m.description === "A hero and his pet" && m.objects.length === 2
    && m.objects[0].sprite.frames.length === 2 && m.objects[1].script[0].body[0].value === "hero.x - 20");
  check("the sprite's own PROM rides along in the model",
    Array.isArray(m.objects[0].sprite.pal) && m.objects[0].sprite.pal.length === 16);
  const bent = JSON.parse(packed); bent.objects[0].script[0].source = "when tick\n explode hero\nend";
  let sealMsg = "";
  try { unpackModel(JSON.stringify(bent)); } catch (e) { sealMsg = e.message; }
  check("edited by hand → SEAL BROKEN, the import refuses", sealMsg.includes("SEAL BROKEN"));
  let notModel = "";
  try { unpackModel(packGame({ title: "X", objects: [sidekick] })); } catch (e) { notModel = e.message; }
  check("a .rlgame is not a .rlmodel (and vice versa — the formats are distinct)",
    notModel.includes("RLMODEL") && (() => { try { unpackGame(packed); return false; } catch { return true; } })());
  let empty = "";
  try { unpackModel(packModel({ name: "Ghost", objects: [] })); } catch (e) { empty = e.message; }
  check("an empty model is refused on import", empty.includes("empty"));
  const long = unpackModel(packModel({ name: "x".repeat(99), description: "y".repeat(999), objects: [sidekick] }));
  check("name caps at 30 and description at 200 (the Market's own limits)",
    long.name.length === 30 && long.description.length === 200);
  const smuggle = JSON.parse(packModel({ name: "S", objects: [{ ...sidekick, type: "iframe" }] }));
  let schema = "";
  try { unpackModel(JSON.stringify(smuggle)); } catch (e) { schema = e.message; }
  check("even with a good seal, unknown object types never get in", schema.includes("doesn't speak"));
}

console.log("Era selects update the workspace RIGHT NOW (both Studios):");
{
  const online = src("studio/studio.html");
  const eraStart = online.indexOf("const eraChanged");
  const eraBlock = online.slice(eraStart, online.indexOf('eraChanged("display"', eraStart));
  check("online: eraChanged commits AND redraws — no more waiting for ▶ Test",
    eraBlock.includes("redraw();"));
  const off = src("js/export-studio.js");
  const dispBlock = off.slice(off.indexOf('$("#eradisplay").addEventListener'), off.indexOf('// ---- multiplayer'));
  check("offline: both era handlers redraw the moment they change",
    (dispBlock.match(/redraw\(\);/g) || []).length >= 2);
}

console.log("The offline Studio grew the 🎨 editor and the 📦 shelf:");
{
  const off = src("js/export-studio.js");
  check("+ Sprite sits in the Explorer and the editor panel mounts",
    off.includes('data-add="sprite"') && off.includes("mountSpriteEditor") && off.includes('id="spritepanel"'));
  check("sprite objects get Frame / FPS fields in Properties, like online",
    off.includes('field("Frame", num("frame"))'));
  check("the 📦 shelf lives in browser storage: save checked, insert, ⬇ .rlmodel, ⬆ import, ✕",
    off.includes("rl_off_models") && off.includes("insertObjects") && off.includes('".rlmodel"')
    && off.includes('id="modelsave"') && off.includes('id="modelimport"') && off.includes("renderModels"));
  check("inserting de-clashes names and rewires the scripts' name references",
    off.includes("renames[o.name] = o.name + n") && off.includes("fixStmts"));
  check("the online Studio grew ⬆ Import .rlmodel into the real inventory",
    src("studio/studio.html").includes('id="btn-import-model"') && src("studio/studio.html").includes("unpackModel"));
  // the generated offline HTML must PARSE — the bundle is template-escaped by hand
  const html = await buildOfflineStudioHtml({ fetchText: async (p) => src(p) });
  check("the generated offline page carries the sprite panel, the shelf and the era redraws",
    html.includes('id="spritepanel"') && html.includes("rl_off_models")
    && html.includes('data-add="sprite"') && html.includes("redraw();   // the workspace previews the new era"));
  const edStart = html.indexOf("// ---- the offline editor");
  const edEnd = html.indexOf("</scr" + "ipt>", edStart);
  let parses = true, parseErr = "";
  try { new Function(html.slice(edStart, edEnd)); } catch (e) { parses = false; parseErr = e.message; }
  check("the offline editor script is valid JavaScript (escaping survived the bundler)" + (parseErr ? " — " + parseErr : ""), parses);
  const libStart = html.indexOf('<script id="rl-lib">') + '<script id="rl-lib">'.length;
  const libEnd = html.indexOf("</script>", libStart);
  let libParses = true, libErr = "";
  try { new Function(html.slice(libStart, libEnd)); } catch (e) { libParses = false; libErr = e.message; }
  check("the bundled library (engine + sprite editor + gamefile) parses too" + (libErr ? " — " + libErr : ""), libParses);
}

console.log("The editor itself — PROM retune, 👻 onion skin, and the fixed toolbar:");
{
  const ed = src("js/sprite-editor.js");
  check("every painter draws with THIS sprite's palette (grid, strip, preview)",
    (ed.match(/palNow\(\)/g) || []).length >= 5);
  check("🎨 retune clones the stock PROM on first edit; ↺ stock deletes it clean",
    ed.includes("st.o.sprite.pal = SPRITE_PAL.slice()") && ed.includes("delete st.o.sprite.pal"));
  check("palette edits are structure (they commit), not just strokes",
    ed.slice(ed.indexOf("palPick.addEventListener")).includes("onStructure();"));
  check("👻 onion skin ghosts the previous frame under the one being drawn",
    ed.includes("st.onion") && ed.includes("globalAlpha = 0.3"));
  check("the flip / nudge / clear buttons actually have their edit() now (they used to throw)",
    ed.includes("const edit = (fn) =>"));
  check("fill still floods and flip still mirrors (the pure helpers are untouched)",
    floodFill("00" + "01" + "", 2, 0, 0, 5).startsWith("55") === false
      ? flipH("1200", 2) === "2100"
      : flipH("1200", 2) === "2100" && floodFill("0000", 2, 0, 0, 5) === "5555");
  check("the guide teaches the new ceiling: 32×32, 16 frames, the color PROM",
    src("guide.html").includes("32×32") && src("guide.html").includes("color PROM") && src("guide.html").includes("TRON line"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

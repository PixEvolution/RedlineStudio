// Headless test: the .rlgame file — the seal, the schema, the round trips.
// Import is the site's border checkpoint: only untouched, pure-Studio scene
// data gets through.
import { packGame, unpackGame, hashStr, embedInHtml, extractFromHtml } from "./js/gamefile.js";
import { buildStandaloneHtml } from "./js/export.js";
import { buildOfflineStudioHtml } from "./js/export-studio.js";
import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const throws = (fn, part) => { try { fn(); return false; } catch (e) { return String(e.message).includes(part); } };

const GAME = {
  title: "Border Test",
  w: 800, h: 600,
  objects: [
    { id: "a1", name: "hero", type: "dot", x: 40, y: 50, size: 10, angle: 0, color: "#fff", glow: 3, visible: 1, text: "",
      script: [
        { event: "tick", body: [
          { k: "if", cond: 'keydown("d")', then: [{ k: "change", lhs: "self.x", by: "3" }], else: [] },
          { k: "repeat", times: "2", body: [{ k: "beep", value: "440", seconds: "0.1" }] }
        ]},
        { event: "code", source: "when key \"Space\"\n  set score to score + 1\nend" }
      ]},
    { id: "a2", name: "hud", type: "text", x: 240, y: 20, size: 12, angle: 0, color: "#7dff9e", glow: 5, visible: 1,
      text: "watch out for </script> tags", script: [] }
  ],
  screen: { mode: "static", objects: [{ id: "s1", name: "shot", type: "ring", x: 1, y: 2, size: 9, angle: 0, color: "#fff", glow: 0, visible: 1, text: "", script: [] }] }
};

console.log("The seal:");
const packed = packGame(GAME);
const back = unpackGame(packed);
check("a saved game comes back whole — title, world, screen and all",
  back.title === "Border Test" && back.w === 800 && back.h === 600
  && back.objects.length === 2 && back.screen.objects.length === 1);
check("…scripts survive to the letter",
  back.objects[0].script[0].body[0].cond === 'keydown("d")'
  && back.objects[0].script[1].source.includes("set score"));
check("one character changed = SEAL BROKEN, import refused",
  throws(() => unpackGame(packed.replace('"x":40', '"x":41')), "SEAL BROKEN"));
check("random JSON is not a game file", throws(() => unpackGame('{"hello":1}'), "RLGAME"));
check("garbage is turned away politely", throws(() => unpackGame("<<<"), "parse"));
check("a future engine's file is refused, not mangled", (() => {
  const d = JSON.parse(packed); d.engine = "v9";
  const { sig, ...p } = d; d.sig = hashStr(JSON.stringify(p));
  return throws(() => unpackGame(JSON.stringify(d)), "engine version");
})());

console.log("The schema (even a VALID seal can't smuggle anything):");
const forge = (mutate) => {
  const d = JSON.parse(packed);
  delete d.sig;
  mutate(d);
  const sig = hashStr(JSON.stringify(d));
  return JSON.stringify({ ...d, sig });
};
check("an unknown object type is refused even with a perfect seal",
  throws(() => unpackGame(forge(d => { d.objects[0].type = "iframe"; })), "object types"));
check("an unknown script event is refused",
  throws(() => unpackGame(forge(d => { d.objects[0].script.push({ event: "onload", body: [] }); })), "script events"));
check("an unknown block kind is refused",
  throws(() => unpackGame(forge(d => { d.objects[0].script[0].body.push({ k: "eval", value: "x" }); })), "script blocks"));
check("junk fields are stripped at the border", (() => {
  const g = unpackGame(forge(d => { d.objects[0].payload = "smuggled"; d.objects[0].onclick = "alert(1)"; }));
  return !("payload" in g.objects[0]) && !("onclick" in g.objects[0]);
})());
check("an army of objects is refused",
  throws(() => unpackGame(forge(d => { for (let i = 0; i < 500; i++) d.objects.push({ ...d.objects[1], id: "x" + i }); })), "Too many"));

console.log("Round trip through a downloaded game HTML:");
const fsFetch = async (p) => readFileSync(p, "utf8");
const html = await buildStandaloneHtml(GAME, { fetchText: fsFetch });
check("the standalone game carries its sealed .rlgame inside", extractFromHtml(html) !== null);
const fromHtml = unpackGame(extractFromHtml(html));
check("…and it unpacks clean — download a game, import it back, publish",
  fromHtml.title === "Border Test" && fromHtml.objects.length === 2
  && fromHtml.objects[1].text.includes("</script>"));
check("a hostile </script> in a text object can't break the page",
  !extractFromHtml(html).includes("</script"));
writeFileSync("/tmp/claude-0/rl_standalone.js", /<script>\n([\s\S]*?)<\/script>/.exec(html)[1]);
let ok = true; try { execFileSync("node", ["--check", "/tmp/claude-0/rl_standalone.js"]); } catch { ok = false; }
check("the standalone's bundled script is valid JavaScript", ok);

console.log("The offline Studio (one file, the whole workshop):");
const studio = await buildOfflineStudioHtml({ fetchText: fsFetch });
check("it's one real file with the whole editor in it",
  studio.length > 50000 && ["id=\"workspace\"", "id=\"behsel\"", "Save .rlgame", "createHistory", "BEHAVIORS", "unpackGame"].every(s => studio.includes(s)));
check("no module plumbing survives the bundling", !/^\s*import\s/m.test(studio));
writeFileSync("/tmp/claude-0/rl_offstudio.js", /<script>\n([\s\S]*?)<\/script>/.exec(studio)[1]);
ok = true; try { execFileSync("node", ["--check", "/tmp/claude-0/rl_offstudio.js"]); } catch (e) { ok = false; console.log(String(e.stderr).slice(0, 400)); }
check("the offline Studio's editor script is valid JavaScript", ok);
writeFileSync("/tmp/claude-0/rl_offlib.js", /<script id="rl-lib">\n?([\s\S]*?)<\/script>/.exec(studio)[1]);
ok = true; try { execFileSync("node", ["--check", "/tmp/claude-0/rl_offlib.js"]); } catch (e) { ok = false; console.log(String(e.stderr).slice(0, 400)); }
check("…and so is the tagged library script that player windows inject", ok);

console.log("Offline casino FREE PLAY + ➕ Player multiplayer:");
check("casino machines test offline in FREE PLAY — pretend coins, the real odds",
  studio.includes("attachCasinoLoop(engine, localWallet(100, 1000))") && studio.includes("casino-odds"));
check("the Players select and the ➕ Player button are in the bar",
  studio.includes('id="seats"') && studio.includes('id="addplayer"'));
check("the local wire rides the bundle (same net contract as online)",
  studio.includes("attachLocalParty") && studio.includes("makeChannel: hubChannel"));
check("the hub replaces BroadcastChannel between file:// windows",
  studio.includes("window.__RLHUB") && studio.includes("function hubChannel"));
check("player windows get the library injected and boot their own engine",
  studio.includes("childBoot") && studio.includes('getElementById("rl-lib").textContent')
  && studio.includes("window.opener.__RLHUB"));
check("the injected page can't be broken by a </script> in the bundle or the game",
  studio.includes("<scr' + 'ipt>")               // the written tag is split
  && studio.includes("replace(/</g")             // …and the game JSON is escaped
  && studio.includes("u003c"));
check("stopping the test ends every player window", studio.includes("__RLSTOP"));
check("a duel-contract game with seats left at 1 still tests as a 2-seater",
  studio.includes("engine.usesDuel() ? 2 : 0"));

console.log("Seats travel in the .rlgame:");
{
  const mp = unpackGame(packGame({ ...GAME, seats: 4 }));
  check("a 4-player game remembers its seats through save/open", mp.seats === 4);
  const sp = unpackGame(packGame(GAME));
  check("a solo game carries no seats field (old files stay identical)",
    sp.seats === 1 && !packGame(GAME).includes('"seats"'));
  const wild = unpackGame(packGame({ ...GAME, seats: 99 }));
  check("seats are clamped at the border", wild.seats === 8);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

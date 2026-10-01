// Headless test: the blocks ⇄ RedScript two-way door. The gold standard:
// every machine in the museum must survive BOTH flips with its compiled
// program identical, node for node.
import { scriptToBlocks, scriptToCode, blocksToCode, compiledEqual } from "./js/convert.js";
import { readdirSync } from "fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

console.log("The printer (blocks → RedScript):");
const SCRIPT = [
  { event: "start", body: [{ k: "set", lhs: "score", value: "0" }] },
  { event: "tick", body: [
    { k: "if", cond: 'keydown("d") or stickx(1) > 0.3', then: [
      { k: "change", lhs: "self.x", by: "3" }
    ], else: [
      { k: "repeat", times: "2", body: [{ k: "beep", value: "440", seconds: "0.1" }] }
    ]},
    { k: "say", value: '"HI"', seconds: "1.5" },
    { k: "explode", target: "foe1" },
    { k: "print", value: '"ROOM " + pos' },
    { k: "clear" }
  ]},
  { event: "key", key: "Space", body: [{ k: "change", lhs: "score", by: "1" }] }
];
const code = blocksToCode(SCRIPT);
check("events print with when/end", code.includes("when start") && code.includes('when key "Space"'));
check("nesting prints with real indentation", code.includes("  if keydown") && code.includes("    change self.x by 3"));
check("else and repeat print", code.includes("  else") && code.includes("    repeat 2"));
check("every statement kind prints", ["say \"HI\" for 1.5", "explode foe1", "print \"ROOM \" + pos", "clear"].every(s => code.includes(s)));

console.log("The full circle:");
check("blocks → code → blocks = the SAME program", compiledEqual(SCRIPT, scriptToBlocks(scriptToCode(SCRIPT))));
check("to-code wraps everything in one 📜 section",
  scriptToCode(SCRIPT).length === 1 && scriptToCode(SCRIPT)[0].event === "code");
check("a broken conversion is DETECTED, never silently accepted",
  compiledEqual(SCRIPT, SCRIPT.slice(1)) === false);
check("the once-tricky corner now ROUND-TRIPS: a say string may contain ' for '", (() => {
  // the say parser takes the LAST " for " as the duration separator, so a
  // quoted message containing the word "for" converts both ways cleanly
  const s = [{ event: "tick", body: [{ k: "say", value: '"wait for it"', seconds: "2" }] }];
  return compiledEqual(s, scriptToBlocks(scriptToCode(s))) === true;
})());

console.log("The GOLD standard — every museum machine survives both flips:");
const files = readdirSync("studio").filter(f => /^example-.*\.js$/.test(f)).sort();
check("the whole museum is on the bench (24 machines + slots)", files.length >= 25);
for (const f of files) {
  const mod = await import("./studio/" + f);
  const build = Object.values(mod).find(v => typeof v === "function" && v.name.startsWith("build"));
  const { objects, title } = build();
  let ok = true, why = "";
  for (const o of objects) {
    if (!o.script || !o.script.length) continue;
    try {
      const asBlocks = scriptToBlocks(o.script);
      if (!compiledEqual(o.script, asBlocks)) { ok = false; why = o.name + ": blocks flip differs"; break; }
      if (!compiledEqual(o.script, scriptToCode(asBlocks))) { ok = false; why = o.name + ": code flip differs"; break; }
      if (!compiledEqual(o.script, scriptToBlocks(scriptToCode(asBlocks)))) { ok = false; why = o.name + ": round trip differs"; break; }
    } catch (err) { ok = false; why = o.name + ": " + err.message; break; }
  }
  check(`${title} flips clean, both ways`, ok);
  if (!ok) console.log("   ", why);
}

console.log("Behaviors flip too:");
const { BEHAVIORS } = await import("./js/behaviors.js");
let allB = true;
for (const b of BEHAVIORS) {
  const script = b.build("target1");
  if (!compiledEqual(script, scriptToBlocks(scriptToCode(script)))) { allB = false; console.log("   ", b.id); }
}
check("every ✨ behavior survives the round trip", allB);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

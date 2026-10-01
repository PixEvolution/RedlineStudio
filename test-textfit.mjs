// Headless test: no museum machine may draw a text line wider than its
// screen. (Rally-X's help line once ran off both edges of the cabinet.)
// Estimated width: chars × size × 0.6 for the mono CRT font, centered on x.
import { readdirSync } from "fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

console.log("Every text fits its cabinet:");
const files = readdirSync("./studio").filter(f => f.startsWith("example-") && f.endsWith(".js"));
check("the museum has machines to measure", files.length >= 38);

let widest = null, badList = [];
for (const f of files) {
  const mod = await import("./studio/" + f);
  const build = Object.values(mod).find(v => typeof v === "function");
  const ex = build();
  const w = ex.w || 480;
  for (const o of ex.objects) {
    if (o.type !== "text" || !o.text || o.size <= 2) continue;
    if (/^stick\d+tag$/.test(o.name)) continue;             // hidden stick labels, never drawn here
    if (o.x < 0 || o.x > w || o.y < 0 || o.y > (ex.h || 360)) continue;   // parked off-screen pools
    const est = String(o.text).length * o.size * 0.6;
    const left = o.x - est / 2, right = o.x + est / 2;
    if (left < -10 || right > w + 10) badList.push(`${f} "${String(o.text).slice(0, 40)}…" ${Math.round(est)}px wide on ${w}`);
    if (!widest || est > widest.est) widest = { est, f, t: o.text };
  }
}
check("no authored text runs off a screen edge", badList.length === 0);

// runtime-set LITERAL strings (set x.text to "...") measured the same way
let badRt = [];
for (const f of files) {
  const mod = await import("./studio/" + f);
  const build = Object.values(mod).find(v => typeof v === "function");
  const ex = build();
  const w = ex.w || 480;
  const byName = {};
  for (const o of ex.objects) byName[o.name] = o;
  for (const o of ex.objects) for (const sc of o.script || []) {
    for (const m of String(sc.source || "").matchAll(/set (\w+)\.text to "([^"]*)"\s*$/gm)) {
      const t = byName[m[1]];
      if (!t || t.type !== "text" || t.size <= 2) continue;
      if (t.x < 0 || t.x > w) continue;
      const est = m[2].length * t.size * 0.6;
      if (t.x - est / 2 < -10 || t.x + est / 2 > w + 10) badRt.push(`${f} ${m[1]} "${m[2].slice(0, 40)}" ${Math.round(est)}px`);
    }
  }
}
check("no runtime-set string runs off a screen edge either", badRt.length === 0);
if (badRt.length) for (const b of badRt.slice(0, 8)) console.log("   ", b);
if (badList.length) for (const b of badList.slice(0, 10)) console.log("   ", b);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

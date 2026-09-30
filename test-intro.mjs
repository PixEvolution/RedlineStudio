// Headless test: the REDLINE DIGITAL intro — the rpm curve, the synthesized
// V8, and that both offline exports carry and play it.
import { readFileSync } from "fs";
import { INTRO_TL, IDLE_RPM, REDLINE_RPM, rpmAt, buildEngineSignal } from "./js/intro.js";
import { buildStandaloneHtml } from "./js/export.js";
import { buildOfflineStudioHtml } from "./js/export-studio.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const fetchText = async (p) => readFileSync(p, "utf8");

console.log("The rpm curve (one truth for needle and exhaust):");
check("silent before the starter catches", rpmAt(0) === 0 && rpmAt(0.5) === 0);
check("the engine catches and settles to idle", Math.abs(rpmAt(INTRO_TL.IDLE_END) - IDLE_RPM) < 30);
check("the sweep reaches the redline", rpmAt(INTRO_TL.SWEEP_END) > REDLINE_RPM * 0.95);
check("the limiter chatters (not a flat line)", (() => {
  let lo = 1e9, hi = 0;
  for (let t = INTRO_TL.SWEEP_END; t < INTRO_TL.BOUNCE_END; t += 0.01) {
    const r = rpmAt(t); lo = Math.min(lo, r); hi = Math.max(hi, r);
  }
  return hi > lo && hi <= REDLINE_RPM * 1.01;
})());
check("decel falls all the way home to idle", Math.abs(rpmAt(INTRO_TL.DECEL_END) - IDLE_RPM) < 30 && Math.abs(rpmAt(INTRO_TL.DONE) - IDLE_RPM) < 1);
check("rpm never goes backward during the sweep", (() => {
  let prev = 0;
  for (let t = INTRO_TL.IDLE_END; t <= INTRO_TL.SWEEP_END; t += 0.02) {
    const r = rpmAt(t);
    if (r < prev - 1) return false;
    prev = r;
  }
  return true;
})());

console.log("The synthesized V8:");
{
  const SR = 22050;   // half rate keeps the test quick; the math is identical
  const sig = buildEngineSignal(SR);
  check("the note is exactly as long as the show", sig.length === Math.floor(INTRO_TL.DONE * SR));
  const rms = (a, b) => {
    let s = 0, n = 0;
    for (let i = Math.floor(a * SR); i < Math.min(sig.length, Math.floor(b * SR)); i++) { s += sig[i] * sig[i]; n++; }
    return Math.sqrt(s / Math.max(1, n));
  };
  check("silence before the engine fires", rms(0, INTRO_TL.STARTER_END - 0.05) < 0.001);
  check("the idle lopes, audibly", rms(1.5, 2.5) > 0.1);
  check("the redline roars at least as loud", rms(5.0, 5.4) >= rms(1.5, 2.5) * 0.8);
  check("the tail fades to nothing", rms(INTRO_TL.DONE - 0.02, INTRO_TL.DONE) < 0.05 && rms(INTRO_TL.DONE - 0.3, INTRO_TL.DONE) < rms(1.5, 2.5));
  let pk = 0;
  for (let i = 0; i < sig.length; i++) pk = Math.max(pk, Math.abs(sig[i]));
  check("never clips", pk <= 0.75);
  // pitch rises with rpm: zero-crossings per second, idle vs redline
  const zc = (a, b) => {
    let n = 0;
    for (let i = Math.floor(a * SR) + 1; i < Math.floor(b * SR); i++) if (sig[i - 1] < 0 && sig[i] >= 0) n++;
    return n / (b - a);
  };
  check("the exhaust note RISES with the revs", zc(4.9, 5.3) > zc(1.6, 2.4) * 1.4);
}

console.log("Both offline exports carry the brand:");
{
  const game = await buildStandaloneHtml({ title: "Test", objects: [] }, { fetchText });
  check("a downloaded game bundles the intro", game.includes("function playIntro") && game.includes("INTRO_TL"));
  check("…and plays it off the ▶ PLAY click, before the game boots",
    /startbtn[\s\S]*?await playIntro\(\)[\s\S]*?new Engine/.test(game));
  const studio = await buildOfflineStudioHtml({ fetchText });
  check("the offline Studio bundles the intro", studio.includes("function playIntro"));
  check("…and opens with it", studio.includes("playIntro()"));
  check("the intro module smuggles no imports into the bundles", !/^\s*import\s/m.test(readFileSync("js/intro.js", "utf8").split("\n").filter(l => /^\s*import\s/.test(l)).join("\n") || ""));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

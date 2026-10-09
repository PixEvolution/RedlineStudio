// Headless test: the October 2026 quality-of-life round — the guide's
// clickable contents (collapsible sections, deep links, ✓ read marks), the
// Studio's ⓘ guide links, ⌨ shortcuts card, 📖 RedScript reference card,
// and the plain-English error hints for the classic beginner mistakes.
import { readFileSync } from "node:fs";
import { errorHint, compileStmts, compileProgram } from "./js/redscript.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const guide = readFileSync("guide.html", "utf8");
const studio = readFileSync("studio/studio.html", "utf8");

console.log("The guide is a clickable book now:");
{
  const IDS = ["start", "big-idea", "objects", "sprites", "era", "events", "actions", "behaviors",
    "expressions", "variables", "recipes", "text-adventures", "studio", "coins", "floor",
    "casino", "online", "reserved", "rules"];
  check("every section carries its anchor (all 19)",
    IDS.every(id => guide.includes(`<div class="panel" id="${id}">`)));
  check("the contents build themselves, grouped the way the climb goes",
    guide.includes('g-toc') && guide.includes("EASY — start to finish, no code")
    && guide.includes("ADVANCED — casino, online, the contracts"));
  check("sections fold: panel-body wrap, chevron, closed class",
    guide.includes('body.className = "panel-body"')
    && guide.includes('.panel[id].closed .panel-body { display: none; }'));
  check("first visit opens exactly 'Start here'", guide.includes('new Set(["start"])'));
  check("✓ read marks + progress, per browser, best-effort storage",
    guide.includes("rl_guide_read") && guide.includes("of ${panels.length} read")
    && guide.includes("MARK READ"));
  check("deep links open the section and flash it (the Studio's ⓘ lands here)",
    guide.includes('window.addEventListener("hashchange", goHash)')
    && guide.includes("g-flash"));
  check("open/close-all buttons exist", guide.includes("Open all") && guide.includes("Close all"));
  check("📋 Copy guide: one button copies every section as one text block, code fenced",
    guide.includes("Copy guide") && guide.includes('out.push("```"')
    && guide.includes("navigator.clipboard.writeText") && guide.includes('execCommand("copy")'));
}

console.log("The Studio meets the guide:");
{
  check("ⓘ links deep-link panels into the guide (and never collapse the panel)",
    studio.includes('a.href = "../guide.html#" + anchor')
    && studio.includes("e.stopPropagation()")
    && ["objects", "sprites", "era", "online", "casino", "big-idea", "studio"]
       .every(a => studio.includes(`"${a}"`)));
  check("⌨ the shortcuts card lists the real keyboard",
    studio.includes('id="btn-keys"') && studio.includes("Ctrl+Z / Ctrl+Y")
    && studio.includes("Ctrl+Shift + arrows"));
  check("📖 the reference card exists, filterable, with every language group",
    studio.includes('id="btn-ref"') && studio.includes('id="ref-q"')
    && ["EVENTS", "ACTIONS", "EXPRESSIONS", "PROPERTIES", "VARIABLES & LISTS", "RESERVED"]
       .every(g => studio.includes(g)));
  check("…and the reference tells the whole truth: comments, flips, reserved names",
    studio.includes("# or //") && studio.includes("To blocks")
    && studio.includes("net1…net6") && studio.includes("bet · spin · result"));
  check("the Debug panel and the publish toasts carry 💡 hints",
    studio.includes("errorHint(msg)") && studio.includes("errsWithHint(check.errors)"));
}

console.log("💡 error hints — the classics, caught:");
{
  const hintOf = (src, program = false) => {
    try { program ? compileProgram(src) : compileStmts(src); return null; }
    catch (err) { return { msg: err.message, hint: errorHint(err.message) }; }
  };
  const h1 = hintOf("set x = 5");
  check('set x = 5 → "to", not "="', h1 && h1.hint.includes('"to", not "="'));
  const h2 = hintOf("if score > 5\nend");
  check("if without then → says so", h2 && h2.hint.includes('"then"'));
  const h3 = hintOf("if score > 5 then\nset x to 1");
  check("missing end → count the pairs", h3 && /missing "end"/.test(h3.msg) && h3.hint.includes("closes with its own"));
  const h4 = hintOf("set x to 1\nend");
  check("stray end → one too many", h4 && h4.hint.includes("one end too many"));
  const h5 = hintOf("set x to foo(3)");
  check("unknown function → points at the 📖 Reference", h5 && h5.hint.includes("Reference"));
  const h6 = hintOf("set x to 5", true);
  check('lines before any event → "code must start with when…" hint',
    h6 && h6.hint.includes("when start"));
  const h7 = hintOf("wait 2");
  check("wait → explains the timer idiom", h7 && h7.hint.includes("timer"));
  const h8 = hintOf("if x = 5 then\nend");
  check("= in a comparison → double equals", h8 && h8.hint.includes("=="));
  check("a clean error it doesn't recognize stays unhinted", errorHint("something exotic") === "");
  check("good code still compiles (hints changed nothing)",
    (() => { try { compileStmts("set x to 5\nif x == 5 then\nchange x by 1\nend"); return true; } catch { return false; } })());
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

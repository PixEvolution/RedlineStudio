// convert.js — the two-way door between blocks and RedScript.
// Blocks and text were ALWAYS the same language (they compile to the same
// program); these two buttons just let you look at any script from either
// side. 🧱 To blocks: every 📜 Code section becomes real, draggable blocks —
// the best way to READ the museum machines. 📜 To code: the whole script
// prints as clean RedScript text.
//
// A conversion is only accepted when the converted script COMPILES TO THE
// IDENTICAL PROGRAM as the original — checked node for node — so flipping
// views can never change what a game does.

import { compileProgram, compileStmts } from "./redscript.js";
import { Engine } from "./engine.js";

// ---- RedScript → blocks ----------------------------------------------------
// The language parser already builds block-shaped structure; conversion is
// unfolding every code section into it.
export function scriptToBlocks(script) {
  const out = [];
  for (const ev of script || []) {
    if (ev.event === "code") out.push(...compileProgram(ev.source || ""));
    else out.push({ ...ev, body: stmtsToBlocks(ev.body) });
  }
  return out;
}

function stmtsToBlocks(list) {
  const out = [];
  for (const s of list || []) {
    if (s.k === "code") out.push(...compileStmts(s.source || ""));
    else if (s.k === "if") out.push({ ...s, then: stmtsToBlocks(s.then), else: stmtsToBlocks(s.else) });
    else if (s.k === "repeat") out.push({ ...s, body: stmtsToBlocks(s.body) });
    else out.push({ ...s });
  }
  return out;
}

// ---- blocks → RedScript ----------------------------------------------------
export function blocksToCode(script) {
  const L = [];
  for (const ev of script || []) {
    if (ev.event === "code") {
      L.push(String(ev.source || "").trimEnd());
      L.push("");
      continue;
    }
    L.push(ev.event === "key" ? `when key "${ev.key || ""}"` : `when ${ev.event}`);
    printStmts(ev.body, 1, L);
    L.push("end", "");
  }
  return L.join("\n").trimEnd() + "\n";
}

function printStmts(list, d, L) {
  const pad = "  ".repeat(d);
  for (const s of list || []) {
    switch (s.k) {
      case "set": L.push(pad + `set ${s.lhs} to ${s.value}`); break;
      case "change": L.push(pad + `change ${s.lhs} by ${s.by}`); break;
      case "if":
        L.push(pad + `if ${s.cond} then`);
        printStmts(s.then, d + 1, L);
        if (s.else && s.else.length) { L.push(pad + "else"); printStmts(s.else, d + 1, L); }
        L.push(pad + "end");
        break;
      case "repeat":
        L.push(pad + `repeat ${s.times}`);
        printStmts(s.body, d + 1, L);
        L.push(pad + "end");
        break;
      case "say": L.push(pad + `say ${s.value} for ${s.seconds ?? "2"}`); break;
      case "explode": L.push(pad + `explode ${s.target || "self"}`); break;
      case "beep": L.push(pad + `beep ${s.value ?? "440"} for ${s.seconds ?? "0.1"}`); break;
      case "print": L.push(pad + `print ${s.value ?? '""'}`); break;
      case "clear": L.push(pad + "clear"); break;
      case "code":
        for (const raw of String(s.source || "").split("\n")) {
          const t = raw.trim();
          if (t) L.push(pad + t);
        }
        break;
    }
  }
}

// One code section holding the whole script — the "to code" view.
export function scriptToCode(script) {
  return [{ event: "code", source: blocksToCode(script) }];
}

// ---- the safety net --------------------------------------------------------
// Two scripts are interchangeable only if the engine compiles them to the
// exact same program. (Rare corner: an expression whose text confuses the
// line grammar — e.g. a string containing " for " — compiles differently
// when printed; this check catches it and the Studio refuses the flip.)
export function compiledEqual(scriptA, scriptB) {
  const rig = (script) => new Engine(null, [{
    id: "cv", name: "cv", type: "dot", x: 0, y: 0, size: 5,
    color: "#fff", glow: 0, visible: 1, text: "", script
  }]);
  const a = rig(scriptA), b = rig(scriptB);
  if (a.errors.length || b.errors.length) return false;
  return JSON.stringify(a.compiled[0].events) === JSON.stringify(b.compiled[0].events);
}

// gamefile.js — the .rlgame file: how games travel OUTSIDE the site and come
// back in. The offline Studio saves these; the online Studio imports them
// (and the standalone game HTML too, which carries one inside).
//
// THE PROMISE ON IMPORT: what comes in is scene data and nothing else.
//   1. The SEAL — every saved file carries a fingerprint of its contents.
//      Edited by hand, corrupted in transit, reordered, "improved"? The seal
//      breaks and the import refuses: re-save it in a Studio.
//   2. The SCHEMA — even with a good seal, the import rebuilds the game from
//      a strict whitelist: known object types, known script shapes, capped
//      sizes. No file can smuggle anything the engine doesn't already speak.
//   3. The ENGINE — never travels. A game file holds objects and scripts;
//      the site always runs its own engine, so "the engine was changed"
//      cannot happen by construction.

const GAME_FORMAT = "RLGAME1";
const MAX_OBJECTS = 400, MAX_EVENTS = 120, MAX_STMTS = 400;
const TYPES = ["dot", "ring", "box", "line", "text", "tri"];
const EVENTS = ["start", "tick", "click", "answer", "key", "code"];
const STMT_KS = ["set", "change", "if", "repeat", "say", "explode", "beep", "print", "clear", "code"];

// FNV-1a, hex — the seal. Not cryptography: an honesty check that catches
// every accidental or casual edit (the schema below catches everything else).
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

// ---- saving ---------------------------------------------------------------
export function packGame({ title, w, h, objects, screen }) {
  const payload = {
    format: GAME_FORMAT,
    engine: "v1",
    title: String(title || "Untitled Game").slice(0, 40),
    w: Number(w) || undefined,
    h: Number(h) || undefined,
    objects: objects || [],
    screen: screen && screen.objects ? { mode: screen.mode || "none", objects: screen.objects } : undefined
  };
  const canon = JSON.stringify(payload);
  return JSON.stringify({ ...payload, sig: hashStr(canon) });
}

// ---- loading --------------------------------------------------------------
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, cap) => String(v ?? "").slice(0, cap);

function cleanStmts(list, budget) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list) {
    if (budget.n++ > MAX_STMTS) throw new Error("This file's scripts are far too large to be a Studio game.");
    if (!s || typeof s !== "object" || !STMT_KS.includes(s.k)) {
      throw new Error("This file contains script blocks the Studio has never heard of — not a RedlineStudio game.");
    }
    const c = { k: s.k };
    if ("lhs" in s) c.lhs = str(s.lhs, 200);
    if ("value" in s) c.value = str(s.value, 2000);
    if ("by" in s) c.by = str(s.by, 2000);
    if ("cond" in s) c.cond = str(s.cond, 2000);
    if ("times" in s) c.times = str(s.times, 200);
    if ("seconds" in s) c.seconds = str(s.seconds, 200);
    if ("target" in s) c.target = str(s.target, 60);
    if ("source" in s) c.source = str(s.source, 40000);
    if (s.k === "if") { c.then = cleanStmts(s.then, budget); c.else = cleanStmts(s.else, budget); }
    if (s.k === "repeat") c.body = cleanStmts(s.body, budget);
    out.push(c);
  }
  return out;
}

function cleanObjects(objects) {
  if (!Array.isArray(objects)) throw new Error("No objects inside — not a RedlineStudio game.");
  if (objects.length > MAX_OBJECTS) throw new Error("Too many objects to be a Studio game.");
  let auto = 0;
  return objects.map((o) => {
    if (!o || typeof o !== "object" || !TYPES.includes(o.type)) {
      throw new Error("This file contains object types the engine doesn't speak — not a RedlineStudio game.");
    }
    const script = [];
    if (Array.isArray(o.script)) {
      if (o.script.length > MAX_EVENTS) throw new Error("This file's scripts are far too large to be a Studio game.");
      const budget = { n: 0 };
      for (const ev of o.script) {
        if (!ev || typeof ev !== "object" || !EVENTS.includes(ev.event)) {
          throw new Error("This file contains script events the Studio has never heard of — not a RedlineStudio game.");
        }
        const e = { event: ev.event };
        if (ev.event === "key") e.key = str(ev.key, 30);
        if (ev.event === "code") e.source = str(ev.source, 40000);
        else e.body = cleanStmts(ev.body, budget);
        script.push(e);
      }
    }
    return {
      id: str(o.id, 40) || "imp" + (auto++),
      name: str(o.name, 30) || "object" + auto,
      type: o.type,
      x: num(o.x), y: num(o.y),
      size: num(o.size, 10),
      angle: num(o.angle),
      color: str(o.color, 30) || "#e8e8ec",
      glow: num(o.glow),
      visible: Number(o.visible) === 0 ? 0 : 1,
      text: str(o.text, 500),
      script
    };
  });
}

export function unpackGame(text) {
  let d;
  try { d = JSON.parse(String(text)); } catch { throw new Error("That's not a game file — it doesn't even parse."); }
  if (!d || d.format !== GAME_FORMAT) throw new Error("Not a RedlineStudio game file (missing the RLGAME seal).");
  if (d.engine !== "v1") throw new Error("This game was made for an engine version this Studio doesn't have.");
  const { sig, ...payload } = d;
  if (hashStr(JSON.stringify(payload)) !== sig) {
    throw new Error("SEAL BROKEN — this file was changed after it left the Studio. Open it in the offline Studio and save it again.");
  }
  return {
    title: str(d.title, 40) || "Untitled Game",
    w: Number(d.w) || undefined,
    h: Number(d.h) || undefined,
    objects: cleanObjects(d.objects),
    screen: d.screen && Array.isArray(d.screen.objects)
      ? { mode: ["none", "static", "live"].includes(d.screen.mode) ? d.screen.mode : "static", objects: cleanObjects(d.screen.objects) }
      : undefined
  };
}

// ---- the standalone game HTML carries its .rlgame inside -------------------
const HTML_TAG_RE = /<script id="rl-game" type="application\/json">([\s\S]*?)<\/script>/;

export function embedInHtml(packed) {
  // escape < and > so no string inside can ever close the tag early —
  // it stays valid JSON, and JSON.parse restores the characters.
  // (The closing tag is split because THIS file also gets bundled inline.)
  const safe = String(packed).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return '<script id="rl-game" type="application/json">' + safe + "</scr" + "ipt>";
}

export function extractFromHtml(html) {
  const m = HTML_TAG_RE.exec(String(html));
  return m ? m[1] : null;
}

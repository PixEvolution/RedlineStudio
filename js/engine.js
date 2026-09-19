// engine.js — the game engine: compiles scripts (from blocks + code) and runs them
// on a canvas with a CRT/oscilloscope look. Used by BOTH the Studio (test mode)
// and the Play page, so games behave identically in both.
//
// Engine format "v1":
//   game.data = { objects: [ {id, name, type, x, y, size, color, glow, visible, text, script:[events]} ] }
//   event = {event:"start"|"tick"|"key", key?, body:[stmt]}  or  {event:"code", source}
//   stmt  = set/change/if/repeat/say/explode/code — all value fields are RedScript expression STRINGS.
//
// Old games keep working: each engine version keeps its renderer forever.

import { parseExpr, parseLhs, compileStmts, compileProgram } from "./redscript.js";

// ---------------------------------------------------------------------------
// Object defaults
// ---------------------------------------------------------------------------

export const CANVAS_W = 480;
export const CANVAS_H = 360;
export const PHOSPHOR = "#39ff5e"; // classic CRT green

export const OBJECT_TYPES = ["dot", "ring", "box", "text"];

let idCounter = 1;
export function makeObject(type, name, x = CANVAS_W / 2, y = CANVAS_H / 2) {
  return {
    id: "o" + Date.now().toString(36) + (idCounter++),
    name,
    type,
    x, y,
    size: type === "text" ? 16 : 14,
    color: PHOSPHOR,
    glow: 12,
    visible: 1,
    text: type === "text" ? "TEXT" : "",
    script: []
  };
}

// ---------------------------------------------------------------------------
// Compiling: turn stored script (expression strings + code blocks) into runnable AST
// ---------------------------------------------------------------------------

function compileStmtList(list, errors, where) {
  const out = [];
  for (const s of list || []) {
    try {
      switch (s.k) {
        case "set":
          out.push({ k: "set", lhs: parseLhs(s.lhs), value: parseExpr(s.value) }); break;
        case "change":
          out.push({ k: "change", lhs: parseLhs(s.lhs), by: parseExpr(s.by) }); break;
        case "if":
          out.push({
            k: "if", cond: parseExpr(s.cond),
            then: compileStmtList(s.then, errors, where),
            else: compileStmtList(s.else, errors, where)
          }); break;
        case "repeat":
          out.push({ k: "repeat", times: parseExpr(s.times), body: compileStmtList(s.body, errors, where) }); break;
        case "say":
          out.push({ k: "say", value: parseExpr(s.value), seconds: parseExpr(s.seconds || "2") }); break;
        case "explode":
          out.push({ k: "explode", target: s.target || "self" }); break;
        case "code":
          out.push(...compileStmtList(compileStmts(s.source || ""), errors, where)); break;
        default:
          throw new Error(`unknown block "${s.k}"`);
      }
    } catch (err) {
      errors.push(`${where}: ${err.message}`);
    }
  }
  return out;
}

// Returns {events, errors}. Never throws — bad blocks are skipped and reported.
export function compileObjectScript(objName, script) {
  const errors = [];
  const events = [];
  for (const ev of script || []) {
    const where = `${objName} → ${ev.event === "key" ? `key "${ev.key}"` : ev.event}`;
    if (ev.event === "code") {
      try {
        const compiled = compileProgram(ev.source || "");
        for (const ce of compiled) {
          events.push({ event: ce.event, key: ce.key, body: compileStmtList(ce.body, errors, `${objName} → code`) });
        }
      } catch (err) {
        errors.push(`${objName} → code: ${err.message}`);
      }
    } else {
      events.push({ event: ev.event, key: ev.key, body: compileStmtList(ev.body, errors, where) });
    }
  }
  return { events, errors };
}

// ---------------------------------------------------------------------------
// The Engine
// ---------------------------------------------------------------------------

export class Engine {
  // canvas may be null for headless testing
  constructor(canvas, sceneObjects) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.objects = JSON.parse(JSON.stringify(sceneObjects || []));
    this.byName = {};
    this.compiled = [];
    this.errors = [];
    this.vars = {};
    this.lists = {};   // name -> {index: value} — RedScript lists (board[i])
    this.keys = {};
    this.mouse = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    this.messages = [];
    this.effects = [];
    this.running = false;
    this.t0 = 0;

    for (const o of this.objects) this.byName[o.name] = o;
    for (const o of this.objects) {
      const { events, errors } = compileObjectScript(o.name, o.script);
      this.compiled.push({ obj: o, events });
      this.errors.push(...errors);
    }

    this._onKeyDown = (e) => {
      if (!this.running) return;
      this.keys[e.key] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      this.fireKey(e.key);
    };
    this._onKeyUp = (e) => { this.keys[e.key] = false; };
    this._onMouse = (e) => {
      if (!this.canvas) return;
      // Maps screen → game coords, including fullscreen letterboxing
      const r = this.canvas.getBoundingClientRect();
      const scale = Math.min(r.width / CANVAS_W, r.height / CANVAS_H) || 1;
      const ox = (r.width - CANVAS_W * scale) / 2;
      const oy = (r.height - CANVAS_H * scale) / 2;
      this.mouse.x = (e.clientX - r.left - ox) / scale;
      this.mouse.y = (e.clientY - r.top - oy) / scale;
    };
    this._onMouseDown = (e) => {
      if (!this.running) return;
      this._onMouse(e);
      this.runEvents("click");
    };
  }

  start() {
    this.running = true;
    this.t0 = performance.now();
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    if (this.canvas) {
      this.canvas.addEventListener("pointermove", this._onMouse);
      this.canvas.addEventListener("pointerdown", this._onMouseDown);
    }
    this.runEvents("start");
    const loop = () => {
      if (!this.running) return;
      this.step();
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener("pointermove", this._onMouse);
      this.canvas.removeEventListener("pointerdown", this._onMouseDown);
    }
  }

  // Simulate a click (used by tests; the browser path goes through _onMouseDown)
  fireClick(x, y) {
    this.mouse.x = x; this.mouse.y = y;
    this.runEvents("click");
  }

  now() { return (performance.now() - this.t0) / 1000; }

  // ---- running scripts ----

  step() { this.runEvents("tick"); }

  runEvents(kind, key) {
    for (const c of this.compiled) {
      for (const ev of c.events) {
        if (ev.event !== kind) continue;
        if (kind === "key" && !this.keyMatches(ev.key, key)) continue;
        this.budget = 200000;
        try { this.runStmts(ev.body, c.obj); }
        catch (err) { /* budget exceeded or runtime error — stop this event quietly */ }
      }
    }
  }

  fireKey(key) { this.runEvents("key", key); }

  keyMatches(want, got) {
    if (want === got) return true;
    if ((want === "Space" || want === "space") && got === " ") return true;
    if (want === " " && (got === "Space" || got === "space")) return true;
    return false;
  }

  // ---- virtual keys (on-screen touch controls call these) ----

  pressKey(key) {
    const k = (key === "Space" || key === "space") ? " " : key;
    this.keys[k] = true;
    this.fireKey(k);
  }

  releaseKey(key) {
    const k = (key === "Space" || key === "space") ? " " : key;
    this.keys[k] = false;
  }

  // Every key this game's scripts care about — "when key" events plus keydown() calls.
  // Touch controls are generated from this, so on-screen buttons always match the game.
  usedKeys() {
    const keys = new Set();
    const walkExpr = (x) => {
      if (!x || typeof x !== "object") return;
      if (x.e === "call" && x.fn === "keydown" && x.args?.[0]?.e === "str") keys.add(x.args[0].v);
      for (const f of ["a", "b", "i"]) walkExpr(x[f]);
      (x.args || []).forEach(walkExpr);
    };
    const walkStmts = (list) => (list || []).forEach(s => {
      for (const f of ["value", "by", "cond", "times", "seconds"]) walkExpr(s[f]);
      walkStmts(s.then); walkStmts(s.else); walkStmts(s.body);
    });
    for (const c of this.compiled) {
      for (const ev of c.events) {
        if (ev.event === "key" && ev.key) keys.add(ev.key);
        walkStmts(ev.body);
      }
    }
    // normalize " " → Space for display, dedupe
    const out = new Set();
    for (const k of keys) out.add(k === " " ? "Space" : k);
    return [...out];
  }

  resolveObj(name, self) {
    if (name === "self") return self;
    return this.byName[name] || null;
  }

  runStmts(list, self) {
    for (const s of list) {
      if (--this.budget < 0) throw new Error("script budget exceeded");
      switch (s.k) {
        case "set": {
          const v = this.evalExpr(s.value, self);
          if (s.lhs.kind === "var") this.vars[s.lhs.name] = v;
          else if (s.lhs.kind === "index") {
            const arr = this.lists[s.lhs.name] || (this.lists[s.lhs.name] = {});
            arr[Math.floor(Number(this.evalExpr(s.lhs.index, self)))] = v;
          }
          else {
            const o = this.resolveObj(s.lhs.target, self);
            if (o) o[s.lhs.prop] = (s.lhs.prop === "color" || s.lhs.prop === "text") ? String(v) : Number(v) || 0;
          }
          break;
        }
        case "change": {
          const by = Number(this.evalExpr(s.by, self)) || 0;
          if (s.lhs.kind === "var") this.vars[s.lhs.name] = (Number(this.vars[s.lhs.name]) || 0) + by;
          else if (s.lhs.kind === "index") {
            const arr = this.lists[s.lhs.name] || (this.lists[s.lhs.name] = {});
            const i = Math.floor(Number(this.evalExpr(s.lhs.index, self)));
            arr[i] = (Number(arr[i]) || 0) + by;
          }
          else {
            const o = this.resolveObj(s.lhs.target, self);
            if (o) o[s.lhs.prop] = (Number(o[s.lhs.prop]) || 0) + by;
          }
          break;
        }
        case "if":
          if (this.truthy(this.evalExpr(s.cond, self))) this.runStmts(s.then, self);
          else this.runStmts(s.else, self);
          break;
        case "repeat": {
          const n = Math.min(10000, Math.max(0, Math.floor(Number(this.evalExpr(s.times, self)) || 0)));
          for (let i = 0; i < n; i++) this.runStmts(s.body, self);
          break;
        }
        case "say": {
          const text = String(this.evalExpr(s.value, self));
          const secs = Number(this.evalExpr(s.seconds, self)) || 2;
          this.messages.push({ text, until: performance.now() + secs * 1000 });
          break;
        }
        case "explode": {
          const o = this.resolveObj(s.target, self);
          if (o) this.effects.push({ x: o.x, y: o.y, start: performance.now(), color: o.color });
          break;
        }
      }
    }
  }

  truthy(v) { return v !== 0 && v !== false && v !== "" && v != null; }

  evalExpr(x, self) {
    switch (x.e) {
      case "num": return x.v;
      case "str": return x.v;
      case "var": return this.vars[x.n] ?? 0;
      case "index": {
        const arr = this.lists[x.n];
        if (!arr) return 0;
        return arr[Math.floor(Number(this.evalExpr(x.i, self)))] ?? 0;
      }
      case "prop": {
        const o = this.resolveObj(x.target, self);
        return o ? o[x.prop] ?? 0 : 0;
      }
      case "un": {
        const a = this.evalExpr(x.a, self);
        return x.op === "neg" ? -Number(a) : (this.truthy(a) ? 0 : 1);
      }
      case "bin": {
        if (x.op === "and") return this.truthy(this.evalExpr(x.a, self)) ? (this.truthy(this.evalExpr(x.b, self)) ? 1 : 0) : 0;
        if (x.op === "or") return this.truthy(this.evalExpr(x.a, self)) ? 1 : (this.truthy(this.evalExpr(x.b, self)) ? 1 : 0);
        const a = this.evalExpr(x.a, self), b = this.evalExpr(x.b, self);
        switch (x.op) {
          case "+": return (typeof a === "string" || typeof b === "string") ? String(a) + String(b) : a + b;
          case "-": return Number(a) - Number(b);
          case "*": return Number(a) * Number(b);
          case "/": return Number(b) === 0 ? 0 : Number(a) / Number(b);
          case "%": return Number(b) === 0 ? 0 : Number(a) % Number(b);
          case "<": return a < b ? 1 : 0;
          case ">": return a > b ? 1 : 0;
          case "<=": return a <= b ? 1 : 0;
          case ">=": return a >= b ? 1 : 0;
          case "==": return a == b ? 1 : 0;
          case "!=": return a != b ? 1 : 0;
        }
        return 0;
      }
      case "call": {
        const args = x.args.map(a => this.evalExpr(a, self));
        switch (x.fn) {
          case "rand": return args[0] + Math.random() * (args[1] - args[0]);
          case "dist": {
            const a = this.resolveObj(String(args[0]), self), b = this.resolveObj(String(args[1]), self);
            if (!a || !b) return 99999;
            return Math.hypot(a.x - b.x, a.y - b.y);
          }
          case "keydown": return this.keys[args[0]] || (args[0] === "Space" && this.keys[" "]) ? 1 : 0;
          case "abs": return Math.abs(Number(args[0]));
          case "min": return Math.min(...args.map(Number));
          case "max": return Math.max(...args.map(Number));
          case "floor": return Math.floor(Number(args[0]));
          case "round": return Math.round(Number(args[0]));
          case "xor": return (Math.floor(Number(args[0])) ^ Math.floor(Number(args[1] ?? 0)));
          case "sin": return Math.sin(Number(args[0]) * Math.PI / 180);   // degrees
          case "cos": return Math.cos(Number(args[0]) * Math.PI / 180);   // degrees
          case "mousex": return this.mouse.x;
          case "mousey": return this.mouse.y;
          case "time": return this.now();
        }
        return 0;
      }
    }
    return 0;
  }

  // ---- rendering ----

  render() {
    if (!this.ctx) return;
    drawFrame(this.ctx, this.objects, { effects: this.effects, messages: this.messages });
  }
}

// ---------------------------------------------------------------------------
// Drawing (shared by engine + studio edit mode)
// ---------------------------------------------------------------------------

export function drawFrame(ctx, objects, { effects = [], messages = [], selectedIds = [] } = {}) {
  const now = performance.now();

  // CRT background
  ctx.save();
  ctx.fillStyle = "#03110a";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#39ff5e";
  for (let y = 0; y < CANVAS_H; y += 4) ctx.fillRect(0, y, CANVAS_W, 1);
  ctx.globalAlpha = 1;

  // objects
  for (const o of objects) {
    if (!o.visible || Number(o.visible) === 0) continue;
    ctx.shadowColor = o.color;
    ctx.shadowBlur = Number(o.glow) || 0;
    ctx.fillStyle = o.color;
    ctx.strokeStyle = o.color;
    const s = Number(o.size) || 10;
    switch (o.type) {
      case "dot":
        ctx.beginPath(); ctx.arc(o.x, o.y, s / 2, 0, Math.PI * 2); ctx.fill(); break;
      case "ring":
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(o.x, o.y, s, 0, Math.PI * 2); ctx.stroke(); break;
      case "box":
        ctx.fillRect(o.x - s / 2, o.y - s / 2, s, s); break;
      case "text":
        ctx.font = `${s}px "Courier New", monospace`;
        ctx.textAlign = "center";
        ctx.fillText(String(o.text ?? ""), o.x, o.y); break;
    }
    if (selectedIds.includes(o.id)) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ff5a55";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      const r = o.type === "ring" ? s + 6 : s + 8;
      ctx.strokeRect(o.x - r, o.y - r, r * 2, r * 2);
      ctx.setLineDash([]);
    }
  }

  // explosion effects (the 1947 "defocused beam" blast)
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    const t = (now - fx.start) / 900;
    if (t > 1) { effects.splice(i, 1); continue; }
    ctx.shadowColor = fx.color; ctx.shadowBlur = 25;
    ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 6 + t * 55, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 3 + t * 28, 0, Math.PI * 2); ctx.stroke();
    // flickering blob
    ctx.globalAlpha = (1 - t) * (0.5 + Math.random() * 0.5);
    ctx.fillStyle = fx.color;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + Math.random() * 10 * (1 - t), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // messages
  ctx.shadowBlur = 18;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (now > messages[i].until) { messages.splice(i, 1); continue; }
  }
  messages.forEach((msg, idx) => {
    ctx.shadowColor = "#39ff5e";
    ctx.fillStyle = "#b9ffcb";
    ctx.font = '20px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.fillText(msg.text, CANVAS_W / 2, 40 + idx * 26);
  });

  ctx.restore();
}

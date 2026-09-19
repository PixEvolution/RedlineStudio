// redscript.js — RedScript, the text scripting language.
//
// KEY IDEA: blocks and text are the SAME language.
//  - The block editor builds the script structure (events, if, repeat...) with UI.
//  - Every value field inside a block is a RedScript *expression* ("self.x + 2", 'rand(10,90)').
//  - A "Code" block holds full RedScript statements, and compiles into the same structure.
// So one interpreter (engine.js) runs everything, and blocks/text stay perfectly in sync.
//
// LANGUAGE (v1) --------------------------------------------------------------
//   when start            when tick            when key "ArrowUp"
//   set self.x to 30      set aim to aim - 1   change self.y by 2
//   if self.x > 400 then ... else ... end
//   repeat 10 ... end
//   say "HIT!" for 1
//   explode target1
//   # comments start with # or //
//
//   Expressions: numbers, "strings", variables, object.props (self.x, target1.y),
//   + - * / ( ), comparisons < > <= >= == !=, and or not,
//   functions: rand(a,b) dist(a,b) keydown("k") abs(x) min(a,b) max(a,b)
//              floor(x) round(x) mousex() mousey() time()

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const isId = c => /[A-Za-z0-9_]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === '"') {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== '"') { s += src[j]; j++; }
      if (j >= src.length) throw new Error('missing closing "');
      tokens.push({ t: "str", v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let j = i, n = "";
      while (j < src.length && /[0-9.]/.test(src[j])) { n += src[j]; j++; }
      tokens.push({ t: "num", v: parseFloat(n) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i, w = "";
      while (j < src.length && isId(src[j])) { w += src[j]; j++; }
      tokens.push({ t: "id", v: w }); i = j; continue;
    }
    const two = src.substr(i, 2);
    if (["<=", ">=", "==", "!="].includes(two)) { tokens.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/()<>,.%[]".includes(c)) { tokens.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Expression parser  →  AST nodes: num, str, var, prop, bin, un, call
// ---------------------------------------------------------------------------

// Functions whose arguments name OBJECTS (bare names become strings)
const OBJECT_ARG_FNS = new Set(["dist", "explode"]);
const KNOWN_FNS = new Set([
  "rand", "dist", "keydown", "abs", "min", "max", "floor", "round",
  "mousex", "mousey", "time", "xor", "sin", "cos"
]);

class ExprParser {
  constructor(tokens) { this.ts = tokens; this.p = 0; }
  peek() { return this.ts[this.p]; }
  next() { return this.ts[this.p++]; }
  expectOp(v) {
    const t = this.next();
    if (!t || t.t !== "op" || t.v !== v) throw new Error(`expected "${v}"`);
  }
  parse() {
    const e = this.parseOr();
    if (this.p < this.ts.length) throw new Error("unexpected extra input in expression");
    return e;
  }
  parseOr() {
    let a = this.parseAnd();
    while (this.peek()?.t === "id" && this.peek().v === "or") { this.next(); a = { e: "bin", op: "or", a, b: this.parseAnd() }; }
    return a;
  }
  parseAnd() {
    let a = this.parseNot();
    while (this.peek()?.t === "id" && this.peek().v === "and") { this.next(); a = { e: "bin", op: "and", a, b: this.parseNot() }; }
    return a;
  }
  parseNot() {
    if (this.peek()?.t === "id" && this.peek().v === "not") { this.next(); return { e: "un", op: "not", a: this.parseNot() }; }
    return this.parseCmp();
  }
  parseCmp() {
    let a = this.parseAdd();
    while (this.peek()?.t === "op" && ["<", ">", "<=", ">=", "==", "!="].includes(this.peek().v)) {
      const op = this.next().v; a = { e: "bin", op, a, b: this.parseAdd() };
    }
    return a;
  }
  parseAdd() {
    let a = this.parseMul();
    while (this.peek()?.t === "op" && ["+", "-"].includes(this.peek().v)) {
      const op = this.next().v; a = { e: "bin", op, a, b: this.parseMul() };
    }
    return a;
  }
  parseMul() {
    let a = this.parseUnary();
    while (this.peek()?.t === "op" && ["*", "/", "%"].includes(this.peek().v)) {
      const op = this.next().v; a = { e: "bin", op, a, b: this.parseUnary() };
    }
    return a;
  }
  parseUnary() {
    if (this.peek()?.t === "op" && this.peek().v === "-") { this.next(); return { e: "un", op: "neg", a: this.parseUnary() }; }
    return this.parsePrimary();
  }
  parsePrimary() {
    const t = this.next();
    if (!t) throw new Error("expression ended unexpectedly");
    if (t.t === "num") return { e: "num", v: t.v };
    if (t.t === "str") return { e: "str", v: t.v };
    if (t.t === "op" && t.v === "(") {
      const inner = this.parseOr(); this.expectOp(")"); return inner;
    }
    if (t.t === "id") {
      // function call?
      if (this.peek()?.t === "op" && this.peek().v === "(") {
        this.next();
        const args = [];
        if (!(this.peek()?.t === "op" && this.peek().v === ")")) {
          args.push(this.parseOr());
          while (this.peek()?.t === "op" && this.peek().v === ",") { this.next(); args.push(this.parseOr()); }
        }
        this.expectOp(")");
        if (!KNOWN_FNS.has(t.v)) throw new Error(`unknown function "${t.v}"`);
        // dist(self, target1): bare names mean object names → strings
        const finalArgs = OBJECT_ARG_FNS.has(t.v)
          ? args.map(a => a.e === "var" ? { e: "str", v: a.n } : a)
          : args;
        return { e: "call", fn: t.v, args: finalArgs };
      }
      // list access: board[i]
      if (this.peek()?.t === "op" && this.peek().v === "[") {
        this.next();
        const idx = this.parseOr();
        this.expectOp("]");
        return { e: "index", n: t.v, i: idx };
      }
      // object.prop?
      if (this.peek()?.t === "op" && this.peek().v === ".") {
        this.next();
        const p = this.next();
        if (!p || p.t !== "id") throw new Error("expected a property name after .");
        return { e: "prop", target: t.v, prop: p.v };
      }
      return { e: "var", n: t.v };
    }
    throw new Error(`unexpected "${t.v}" in expression`);
  }
}

export function parseExpr(src) {
  if (typeof src !== "string" || src.trim() === "") throw new Error("empty value");
  return new ExprParser(tokenize(src)).parse();
}

// LHS of set/change: "aim" (variable), "self.x" (object property) or "board[i]" (list slot)
export function parseLhs(src) {
  const ts = tokenize(String(src).trim());
  if (ts.length === 1 && ts[0].t === "id") return { kind: "var", name: ts[0].v };
  if (ts.length === 3 && ts[0].t === "id" && ts[1].v === "." && ts[2].t === "id")
    return { kind: "prop", target: ts[0].v, prop: ts[2].v };
  if (ts.length >= 4 && ts[0].t === "id" && ts[1].t === "op" && ts[1].v === "[" &&
      ts[ts.length - 1].t === "op" && ts[ts.length - 1].v === "]") {
    const index = new ExprParser(ts.slice(2, -1)).parse();
    return { kind: "index", name: ts[0].v, index };
  }
  throw new Error(`"${src}" isn't a variable, object.property or list[index]`);
}

// ---------------------------------------------------------------------------
// Statement / program parser (line based)
// ---------------------------------------------------------------------------

function stripComment(raw) {
  // Remove # / // comments — but never inside "strings" (colors like "#ff5a55"!)
  let out = "";
  let inStr = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') { inStr = !inStr; out += c; continue; }
    if (!inStr && (c === "#" || (c === "/" && raw[i + 1] === "/"))) break;
    out += c;
  }
  return out;
}

function cleanLines(source) {
  return String(source).split("\n").map((raw, idx) => {
    return { line: stripComment(raw).trim(), num: idx + 1 };
  }).filter(l => l.line !== "");
}

function sliceExprSrc(line, fromWord, toWord) {
  // helper: grab text between keywords in a line (string-safe enough for v1)
  return null; // (not used — we parse by tokens below)
}

// Parse one statement line into an IR stmt (bodies filled by caller)
function parseStmtLine(line) {
  const m = (re) => line.match(re);
  let r;
  if ((r = m(/^set\s+(.+?)\s+to\s+(.+)$/i))) {
    parseLhs(r[1]); parseExpr(r[2]); // validate now
    return { k: "set", lhs: r[1].trim(), value: r[2].trim() };
  }
  if ((r = m(/^change\s+(.+?)\s+by\s+(.+)$/i))) {
    parseLhs(r[1]); parseExpr(r[2]);
    return { k: "change", lhs: r[1].trim(), by: r[2].trim() };
  }
  if ((r = m(/^if\s+(.+?)\s+then$/i))) {
    parseExpr(r[1]);
    return { k: "if", cond: r[1].trim(), then: [], else: [] };
  }
  if ((r = m(/^repeat\s+(.+)$/i))) {
    parseExpr(r[1]);
    return { k: "repeat", times: r[1].trim(), body: [] };
  }
  if ((r = m(/^say\s+(.+?)\s+for\s+(.+)$/i))) {
    parseExpr(r[1]); parseExpr(r[2]);
    return { k: "say", value: r[1].trim(), seconds: r[2].trim() };
  }
  if ((r = m(/^say\s+(.+)$/i))) {
    parseExpr(r[1]);
    return { k: "say", value: r[1].trim(), seconds: "2" };
  }
  if ((r = m(/^explode\s+([A-Za-z_][A-Za-z0-9_]*)$/i))) {
    return { k: "explode", target: r[1] };
  }
  throw new Error(`can't understand: "${line}"`);
}

// Compile statements-only code (a Code block INSIDE an event)
export function compileStmts(source) {
  const lines = cleanLines(source);
  const root = [];
  const stack = [{ body: root }];
  for (const { line, num } of lines) {
    try {
      const top = stack[stack.length - 1];
      if (/^when\b/i.test(line)) throw new Error(`"when" isn't allowed inside an event's code — use a top-level Code section`);
      if (/^end$/i.test(line)) {
        if (stack.length === 1) throw new Error(`"end" with nothing to close`);
        stack.pop(); continue;
      }
      if (/^else$/i.test(line)) {
        const blk = stack[stack.length - 1];
        if (!blk.stmt || blk.stmt.k !== "if" || blk.inElse) throw new Error(`"else" without a matching if`);
        blk.inElse = true; blk.body = blk.stmt.else; continue;
      }
      const stmt = parseStmtLine(line);
      top.body.push(stmt);
      if (stmt.k === "if") stack.push({ stmt, body: stmt.then, inElse: false });
      if (stmt.k === "repeat") stack.push({ stmt, body: stmt.body });
    } catch (err) {
      throw new Error(`line ${num}: ${err.message}`);
    }
  }
  if (stack.length !== 1) throw new Error(`missing "end" (${stack.length - 1} block(s) still open)`);
  return root;
}

// Compile a full program (a top-level Code section: contains "when" events)
export function compileProgram(source) {
  const lines = cleanLines(source);
  const events = [];
  let stack = null; // stmt stack inside current event
  let current = null;
  for (const { line, num } of lines) {
    try {
      let r;
      if ((r = line.match(/^when\s+start$/i)) || (r = line.match(/^when\s+tick$/i)) ||
          (r = line.match(/^when\s+click$/i)) || (r = line.match(/^when\s+key\s+"(.*)"$/i))) {
        if (stack && stack.length > 1) throw new Error(`missing "end" before next "when"`);
        current = /start$/i.test(line) ? { event: "start", body: [] }
                : /tick$/i.test(line) ? { event: "tick", body: [] }
                : /click$/i.test(line) ? { event: "click", body: [] }
                : { event: "key", key: r[1], body: [] };
        events.push(current);
        stack = [{ body: current.body }];
        continue;
      }
      if (!current) throw new Error(`code must start with "when start", "when tick", "when click" or "when key \\"...\\""`);
      if (/^end$/i.test(line)) {
        if (stack.length === 1) { current = null; stack = null; continue; } // closing the event itself
        stack.pop(); continue;
      }
      if (/^else$/i.test(line)) {
        const blk = stack[stack.length - 1];
        if (!blk.stmt || blk.stmt.k !== "if" || blk.inElse) throw new Error(`"else" without a matching if`);
        blk.inElse = true; blk.body = blk.stmt.else; continue;
      }
      const stmt = parseStmtLine(line);
      stack[stack.length - 1].body.push(stmt);
      if (stmt.k === "if") stack.push({ stmt, body: stmt.then, inElse: false });
      if (stmt.k === "repeat") stack.push({ stmt, body: stmt.body });
    } catch (err) {
      throw new Error(`line ${num}: ${err.message}`);
    }
  }
  if (stack && stack.length > 1) throw new Error(`missing "end" at end of code`);
  return events;
}

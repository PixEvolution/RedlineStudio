// blocks.js — the block script editor. Builds the SAME script structure that
// RedScript code compiles to, so blocks and code are interchangeable.
//
// createBlockEditor(container, script, { onChange }) — edits `script` in place.

const EVENT_LABELS = {
  start: "⚡ When game starts",
  tick: "🔁 Every frame",
  key: "⌨️ When key pressed",
  click: "🖱 When clicked",
  answer: "💬 When answered (terminal)",
  code: "📜 Code section"
};

const STMT_DEFS = {
  set:     { label: "Set",     make: () => ({ k: "set", lhs: "self.x", value: "0" }) },
  change:  { label: "Change",  make: () => ({ k: "change", lhs: "self.x", by: "1" }) },
  if:      { label: "If",      make: () => ({ k: "if", cond: "self.x > 100", then: [], else: [] }) },
  repeat:  { label: "Repeat",  make: () => ({ k: "repeat", times: "10", body: [] }) },
  say:     { label: "Say",     make: () => ({ k: "say", value: '"Hello"', seconds: "2" }) },
  explode: { label: "Explode", make: () => ({ k: "explode", target: "self" }) },
  beep:    { label: "Beep",    make: () => ({ k: "beep", value: "440", seconds: "0.1" }) },
  print:   { label: "Print",   make: () => ({ k: "print", value: '"HELLO"' }) },
  clear:   { label: "Clear",   make: () => ({ k: "clear" }) },
  code:    { label: "📜 Code block", make: () => ({ k: "code", source: 'set self.x to self.x + 1' }) }
};

export function createBlockEditor(container, script, { onChange = () => {} } = {}) {
  function changed() { onChange(); }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function exprInput(obj, field, placeholder, cls = "blk-in") {
    const input = el("input", cls);
    input.type = "text";
    input.value = obj[field] ?? "";
    input.placeholder = placeholder || "";
    input.spellcheck = false;
    input.addEventListener("input", () => { obj[field] = input.value; changed(); });
    return input;
  }

  function rowButtons(list, index, rerenderList) {
    const wrap = el("span", "blk-btns");
    const up = el("button", "blk-mini", "↑");
    const down = el("button", "blk-mini", "↓");
    const del = el("button", "blk-mini blk-del", "✕");
    up.addEventListener("click", () => {
      if (index > 0) { [list[index - 1], list[index]] = [list[index], list[index - 1]]; changed(); rerenderList(); }
    });
    down.addEventListener("click", () => {
      if (index < list.length - 1) { [list[index + 1], list[index]] = [list[index], list[index + 1]]; changed(); rerenderList(); }
    });
    del.addEventListener("click", () => { list.splice(index, 1); changed(); rerenderList(); });
    wrap.append(up, down, del);
    return wrap;
  }

  function addStmtPicker(list, rerenderList) {
    const sel = el("select", "blk-add");
    sel.append(new Option("+ Add action…", ""));
    for (const [k, def] of Object.entries(STMT_DEFS)) sel.append(new Option(def.label, k));
    sel.addEventListener("change", () => {
      if (!sel.value) return;
      list.push(STMT_DEFS[sel.value].make());
      sel.value = "";
      changed();
      rerenderList();
    });
    return sel;
  }

  function renderStmtList(mount, list) {
    const rerender = () => renderStmtList(mount, list);
    mount.innerHTML = "";
    list.forEach((s, i) => mount.appendChild(renderStmt(s, list, i, rerender)));
    mount.appendChild(addStmtPicker(list, rerender));
  }

  function renderStmt(s, list, index, rerenderList) {
    const row = el("div", `blk blk-${s.k}`);
    const head = el("div", "blk-head");

    switch (s.k) {
      case "set":
        head.append(el("span", "blk-kw", "set"), exprInput(s, "lhs", "self.x or aim", "blk-in blk-lhs"),
          el("span", "blk-kw", "to"), exprInput(s, "value", "value or expression"));
        break;
      case "change":
        head.append(el("span", "blk-kw", "change"), exprInput(s, "lhs", "self.x or aim", "blk-in blk-lhs"),
          el("span", "blk-kw", "by"), exprInput(s, "by", "amount"));
        break;
      case "if":
        head.append(el("span", "blk-kw", "if"), exprInput(s, "cond", 'e.g. dist(self, target1) < 20'),
          el("span", "blk-kw", "then"));
        break;
      case "repeat":
        head.append(el("span", "blk-kw", "repeat"), exprInput(s, "times", "how many times", "blk-in blk-lhs"));
        break;
      case "say":
        head.append(el("span", "blk-kw", "say"), exprInput(s, "value", '"text in quotes"'),
          el("span", "blk-kw", "for"), exprInput(s, "seconds", "seconds", "blk-in blk-lhs"),
          el("span", "blk-kw", "sec"));
        break;
      case "explode":
        head.append(el("span", "blk-kw", "explode"), exprInput(s, "target", "self or object name", "blk-in blk-lhs"));
        break;
      case "beep":
        head.append(el("span", "blk-kw", "beep"), exprInput(s, "value", "frequency (Hz)", "blk-in blk-lhs"),
          el("span", "blk-kw", "for"), exprInput(s, "seconds", "seconds", "blk-in blk-lhs"),
          el("span", "blk-kw", "sec"));
        break;
      case "print":
        head.append(el("span", "blk-kw", "print"), exprInput(s, "value", '"a line for the terminal"'));
        break;
      case "clear":
        head.append(el("span", "blk-kw", "clear"), el("span", "blk-kw", "(wipe the terminal)"));
        break;
      case "code": {
        head.append(el("span", "blk-kw", "📜 code"));
        break;
      }
    }

    head.appendChild(rowButtons(list, index, rerenderList));
    row.appendChild(head);

    if (s.k === "if") {
      const thenMount = el("div", "blk-body");
      renderStmtList(thenMount, s.then);
      row.appendChild(thenMount);
      row.appendChild(el("div", "blk-kw blk-else", "else"));
      const elseMount = el("div", "blk-body");
      s.else = s.else || [];
      renderStmtList(elseMount, s.else);
      row.appendChild(elseMount);
    }
    if (s.k === "repeat") {
      const bodyMount = el("div", "blk-body");
      renderStmtList(bodyMount, s.body);
      row.appendChild(bodyMount);
    }
    if (s.k === "code") {
      const ta = el("textarea", "blk-code");
      ta.value = s.source || "";
      ta.rows = Math.max(3, (s.source || "").split("\n").length + 1);
      ta.spellcheck = false;
      ta.addEventListener("input", () => {
        s.source = ta.value;
        ta.rows = Math.max(3, ta.value.split("\n").length + 1);
        changed();
      });
      row.appendChild(wireCodeEditor(ta, () => ta.value, (v) => {
        ta.value = v;
        s.source = v;
        ta.rows = Math.max(3, v.split("\n").length + 1);
        changed();
      }));
    }

    return row;
  }

  function renderEvent(ev, index) {
    const panel = document.createElement("div");
    panel.className = "blk-event";

    const head = document.createElement("div");
    head.className = "blk-event-head";

    const sel = document.createElement("select");
    sel.className = "blk-add";
    for (const [k, label] of Object.entries(EVENT_LABELS)) sel.append(new Option(label, k));
    sel.value = ev.event;
    sel.addEventListener("change", () => {
      const to = sel.value;
      if (to === "code" && ev.event !== "code") { ev.source = ev.source || 'when tick\n  # your code here\nend'; delete ev.body; }
      if (to !== "code" && ev.event === "code") { ev.body = []; delete ev.source; }
      if (to === "key" && ev.key == null) ev.key = "ArrowUp";
      ev.event = to;
      changed();
      render();
    });
    head.appendChild(sel);

    if (ev.event === "key") {
      const keyIn = document.createElement("input");
      keyIn.className = "blk-in blk-lhs";
      keyIn.value = ev.key ?? "";
      keyIn.placeholder = 'ArrowUp, a, Space…';
      keyIn.spellcheck = false;
      keyIn.addEventListener("input", () => { ev.key = keyIn.value; changed(); });
      head.appendChild(keyIn);
      const capture = document.createElement("button");
      capture.className = "blk-mini";
      capture.textContent = "press a key…";
      capture.addEventListener("click", () => {
        capture.textContent = "press now";
        const h = (e) => {
          e.preventDefault();
          ev.key = e.key === " " ? "Space" : e.key;
          keyIn.value = ev.key;
          capture.textContent = "press a key…";
          window.removeEventListener("keydown", h, true);
          changed();
        };
        window.addEventListener("keydown", h, true);
      });
      head.appendChild(capture);
    }

    head.appendChild(rowButtons(script, index, render));
    panel.appendChild(head);

    if (ev.event === "code") {
      const ta = document.createElement("textarea");
      ta.className = "blk-code";
      ta.value = ev.source || "";
      ta.rows = Math.max(5, (ev.source || "").split("\n").length + 1);
      ta.spellcheck = false;
      ta.addEventListener("input", () => {
        ev.source = ta.value;
        ta.rows = Math.max(5, ta.value.split("\n").length + 1);
        changed();
      });
      panel.appendChild(wireCodeEditor(ta, () => ta.value, (v) => {
        ta.value = v;
        ev.source = v;
        ta.rows = Math.max(5, v.split("\n").length + 1);
        changed();
      }));
    } else {
      ev.body = ev.body || [];
      const bodyMount = document.createElement("div");
      bodyMount.className = "blk-body";
      renderStmtList(bodyMount, ev.body);
      panel.appendChild(bodyMount);
    }

    return panel;
  }

  function render() {
    container.innerHTML = "";
    script.forEach((ev, i) => container.appendChild(renderEvent(ev, i)));

    const addSel = document.createElement("select");
    addSel.className = "blk-add blk-add-event";
    addSel.append(new Option("+ Add event…", ""));
    for (const [k, label] of Object.entries(EVENT_LABELS)) addSel.append(new Option(label, k));
    addSel.addEventListener("change", () => {
      if (!addSel.value) return;
      const k = addSel.value;
      script.push(k === "code"
        ? { event: "code", source: 'when start\n  set self.x to 240\nend' }
        : { event: k, key: k === "key" ? "ArrowUp" : undefined, body: [] });
      addSel.value = "";
      changed();
      render();
    });
    container.appendChild(addSel);
  }

  render();
  return { render };
}

// ---- code-editor comfort, the way real editors behave (Roblox Studio and
// friends): Enter keeps the line's indentation and goes one level deeper
// after "then" / "else" / "when …" / "repeat …" — and a BLOCK OPENER TYPES
// ITS OWN `end` (only when one is actually missing, so it never doubles up).
// Tab indents two spaces instead of leaving the box; quotes and parens
// auto-close around the cursor (or around a selection), and typing the
// closer just steps over one that's already there.
export function wireCodeKeys(ta, getValue, setValue) {
  ta.addEventListener("keydown", (e) => {
    const a = ta.selectionStart, b = ta.selectionEnd;
    // auto-close pairs: " → "", ( → () — wrap the selection if there is one
    if (e.key === '"' || e.key === "(") {
      e.preventDefault();
      if (e.key === '"' && a === b && ta.value[a] === '"') { ta.selectionStart = ta.selectionEnd = a + 1; return; }
      const close = e.key === '"' ? '"' : ")";
      const sel = ta.value.slice(a, b);
      setValue(ta.value.slice(0, a) + e.key + sel + close + ta.value.slice(b));
      ta.selectionStart = a + 1; ta.selectionEnd = a + 1 + sel.length;
      return;
    }
    if (e.key === ")" && a === b && ta.value[a] === ")") {
      e.preventDefault();
      ta.selectionStart = ta.selectionEnd = a + 1;
      return;
    }
    // backspacing the open half of an empty pair takes both
    if (e.key === "Backspace" && a === b && a > 0) {
      const pair = ta.value.slice(a - 1, a + 1);
      if (pair === '""' || pair === "()") {
        e.preventDefault();
        setValue(ta.value.slice(0, a - 1) + ta.value.slice(a + 1));
        ta.selectionStart = ta.selectionEnd = a - 1;
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setValue(ta.value.slice(0, a) + "  " + ta.value.slice(b));
      ta.selectionStart = ta.selectionEnd = a + 2;
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const before = ta.value.slice(0, a);
    const line = before.slice(before.lastIndexOf("\n") + 1);
    let indent = (line.match(/^[ ]*/) || [""])[0];
    const t = line.trim();
    const opens = /\bthen$/.test(t) || /^when\b/.test(t) || /^repeat\b/.test(t);
    if (opens || t === "else") indent += "  ";
    let ins = "\n" + indent;
    // AUTO-END: when the line above opened a block and the program is short an
    // `end`, write it on the next line — cursor lands indented inside the block
    if (opens) {
      const whole = before + ta.value.slice(b);
      const need = (whole.match(/^[^\n]*\bthen[ ]*$/gm) || []).length
        + (whole.match(/^[ ]*when\b/gm) || []).length
        + (whole.match(/^[ ]*repeat\b/gm) || []).length;
      const have = (whole.match(/^[ ]*end[ ]*$/gm) || []).length;
      if (need > have) ins += "\n" + indent.slice(2) + "end";
    }
    setValue(before + ins + ta.value.slice(b));
    ta.selectionStart = ta.selectionEnd = a + 1 + indent.length;
  });
}

// ---- the IDE chrome: line numbers down the side and live syntax coloring,
// drawn by the classic overlay trick — a colored <pre> sits exactly under a
// transparent-text textarea, so the caret and selection are real while the
// letters come from the highlighter. Shared by the online AND offline Studio
// (the styles inject themselves, so the offline bundle carries them too).
const IDE_CSS = `
.code-ide{display:flex;border:1px solid #2a2a31;border-radius:8px;background:#0d1117;overflow:hidden;margin:4px 0}
.code-gut{flex:0 0 2.6em;text-align:right;padding:8px 6px 8px 0;color:#49535f;user-select:none;overflow:hidden;white-space:pre;font:12px/1.5 "Courier New",monospace}
.code-box{position:relative;flex:1;min-width:0}
.code-hl{position:absolute;inset:0;margin:0;padding:8px;pointer-events:none;overflow:hidden;white-space:pre;color:#8dffa9;font:12px/1.5 "Courier New",monospace}
.code-ide .code-ta{position:relative;display:block;width:100%;box-sizing:border-box;background:transparent;border:0;outline:none;color:transparent;caret-color:#8dffa9;padding:8px;white-space:pre;overflow:auto;resize:none;font:12px/1.5 "Courier New",monospace;border-radius:0}
.code-ide .code-ta::selection{background:rgba(57,255,94,.28)}
.code-hl .k{color:#ff9d4a}.code-hl .s{color:#ffd75e}.code-hl .n{color:#7ddfff}.code-hl .c{color:#7a8894;font-style:italic}.code-hl .f{color:#b48cff}`;
function ensureIdeCss() {
  if (document.getElementById("rl-ide-css")) return;
  const st = document.createElement("style");
  st.id = "rl-ide-css";
  st.textContent = IDE_CSS;
  document.head.appendChild(st);
}

const KEYWORDS = "when|if|then|else|end|set|change|to|by|repeat|times|and|or|not|for|say|explode|beep|print|clear";
const TOKEN_RE = new RegExp(
  '(#[^\\n]*)|("(?:[^"\\\\\\n]|\\\\.)*"?)|\\b(\\d+(?:\\.\\d+)?)\\b|\\b(' + KEYWORDS + ')\\b|([A-Za-z_]\\w*)(?=\\()', "g");

export function highlightCode(src) {
  const safe = String(src).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return safe.replace(TOKEN_RE, (m, com, str, num, kw, fn) => {
    const cls = com ? "c" : str ? "s" : num ? "n" : kw ? "k" : "f";
    return `<span class="${cls}">${m}</span>`;
  });
}

export function wireCodeEditor(ta, getValue, setValue) {
  ensureIdeCss();
  const wrap = document.createElement("div"); wrap.className = "code-ide";
  const gut = document.createElement("div"); gut.className = "code-gut";
  const box = document.createElement("div"); box.className = "code-box";
  const hl = document.createElement("pre"); hl.className = "code-hl";
  hl.setAttribute("aria-hidden", "true");
  ta.classList.add("code-ta");
  ta.setAttribute("wrap", "off");
  box.append(hl, ta);
  wrap.append(gut, box);
  const sync = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; };
  const paint = () => {
    hl.innerHTML = highlightCode(ta.value) + "\n";
    const n = ta.value.split("\n").length;
    let g = ""; for (let i = 1; i <= n; i++) g += i + "\n";
    gut.textContent = g;
    sync();
  };
  wireCodeKeys(ta, getValue, (v) => { setValue(v); paint(); });
  ta.addEventListener("input", paint);
  ta.addEventListener("scroll", sync);
  paint();
  return wrap;
}

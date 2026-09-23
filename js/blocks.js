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
      row.appendChild(ta);
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
      panel.appendChild(ta);
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

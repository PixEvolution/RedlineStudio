// touch-controls.js — on-screen buttons for phones/tablets.
// The buttons are GENERATED from whatever keys the game's scripts actually use
// (engine.usedKeys()), so every game automatically gets the right controls.
//
// Players can make them their own: the ✥ button opens edit mode — drag a
// cluster anywhere on the screen (even over the game), resize with − / +,
// and the layout is remembered on this device for every game.

const LABELS = {
  ArrowUp: "▲", ArrowDown: "▼", ArrowLeft: "◀", ArrowRight: "▶",
  Space: "SPACE", Enter: "ENTER", Shift: "SHIFT", Escape: "ESC"
};

const ARROWS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];
const LAYOUT_KEY = "rl_ctl_layout_v1";

export function isTouchDevice() {
  return window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { scale: 1, dpad: { x: 0, y: 0 }, act: { x: 0, y: 0 } };
}

function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
}

// The long-press copy/paste killer. CSS user-select alone doesn't stop every
// browser's callout, so we also block the events themselves. touchstart is
// prevented ONLY on game surfaces (buttons, canvas) — never on real buttons
// like fullscreen, or their taps would die too.
function muzzle(el, { blockTouch = false } = {}) {
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("selectstart", (e) => e.preventDefault());
  if (blockTouch) el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
}

// Creates the controls inside `container`. Returns { destroy }.
export function createTouchControls(engine, container) {
  const keys = engine.usedKeys();

  // the game canvas is a game surface — no long-press menu, no text callout
  const canvas = container.querySelector?.("canvas");
  if (canvas) muzzle(canvas, { blockTouch: true });
  muzzle(container);   // context menu / selection off everywhere in the stage

  if (keys.length === 0) {
    // Click-only game — no buttons needed, the canvas itself is the controller.
    return { destroy() {} };
  }

  const wrap = document.createElement("div");
  wrap.className = "touch-controls";
  const layout = loadLayout();
  let editing = false;

  const makeBtn = (key) => {
    const b = document.createElement("button");
    b.className = "touch-btn";
    b.textContent = LABELS[key] || (key.length === 1 ? key.toUpperCase() : key);
    b.setAttribute("aria-label", key);
    let repeat = null;
    const down = (e) => {
      if (editing) return;               // edit mode: buttons don't fire
      e.preventDefault();
      b.classList.add("held");
      engine.pressKey(key);
      clearInterval(repeat);
      repeat = setInterval(() => engine.pressKey(key), 130); // hold = auto-repeat, like a keyboard
    };
    const up = () => {
      b.classList.remove("held");
      clearInterval(repeat);
      repeat = null;
      engine.releaseKey(key);
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
    muzzle(b, { blockTouch: true });
    return b;
  };

  // ---- clusters -------------------------------------------------------
  const clusters = [];   // [{ el, slot: "dpad"|"act" }]

  const place = (el, slot) => {
    el.style.transform = `translate(${layout[slot].x}px, ${layout[slot].y}px) scale(${layout.scale})`;
  };

  const makeDraggable = (el, slot) => {
    el.addEventListener("pointerdown", (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
      const sx = e.clientX - layout[slot].x, sy = e.clientY - layout[slot].y;
      el.setPointerCapture?.(e.pointerId);
      const move = (ev) => {
        layout[slot].x = ev.clientX - sx;
        layout[slot].y = ev.clientY - sy;
        place(el, slot);
      };
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        saveLayout(layout);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  };

  // Arrow keys form a D-pad on the left; everything else is an action button on the right.
  const usedArrows = ARROWS.filter(a => keys.includes(a));
  const others = keys.filter(k => !ARROWS.includes(k));

  if (usedArrows.length > 0) {
    const pad = document.createElement("div");
    pad.className = "touch-dpad touch-cluster";
    const slot = (area, key) => {
      if (!keys.includes(key)) { const s = document.createElement("span"); s.style.gridArea = area; pad.appendChild(s); return; }
      const b = makeBtn(key);
      b.style.gridArea = area;
      pad.appendChild(b);
    };
    slot("up", "ArrowUp");
    slot("left", "ArrowLeft");
    slot("down", "ArrowDown");
    slot("right", "ArrowRight");
    wrap.appendChild(pad);
    clusters.push({ el: pad, slot: "dpad" });
  }

  if (others.length > 0) {
    const actions = document.createElement("div");
    actions.className = "touch-actions touch-cluster";
    for (const k of others) actions.appendChild(makeBtn(k));
    wrap.appendChild(actions);
    clusters.push({ el: actions, slot: "act" });
  }

  for (const c of clusters) { place(c.el, c.slot); makeDraggable(c.el, c.slot); }

  // ---- the ✥ layout editor -------------------------------------------
  const editBtn = document.createElement("button");
  editBtn.className = "ctl-edit-btn";
  editBtn.textContent = "✥";
  editBtn.title = "Move / resize controls";
  muzzle(editBtn, { blockTouch: false });

  const bar = document.createElement("div");
  bar.className = "ctl-edit-bar";
  const mk = (label, fn) => {
    const b = document.createElement("button");
    b.className = "btn btn-small btn-ghost";
    b.textContent = label;
    b.addEventListener("click", fn);
    bar.appendChild(b);
    return b;
  };
  const rescale = (d) => {
    layout.scale = Math.max(0.6, Math.min(1.8, Math.round((layout.scale + d) * 10) / 10));
    for (const c of clusters) place(c.el, c.slot);
    saveLayout(layout);
  };
  mk("−", () => rescale(-0.1));
  mk("+", () => rescale(0.1));
  mk("Reset", () => {
    layout.scale = 1; layout.dpad = { x: 0, y: 0 }; layout.act = { x: 0, y: 0 };
    for (const c of clusters) place(c.el, c.slot);
    saveLayout(layout);
  });
  mk("Done", () => setEditing(false));

  function setEditing(on) {
    editing = on;
    wrap.classList.toggle("editing", on);
    bar.style.display = on ? "flex" : "none";
  }
  editBtn.addEventListener("click", () => setEditing(!editing));
  bar.style.display = "none";

  wrap.appendChild(editBtn);
  wrap.appendChild(bar);
  container.appendChild(wrap);

  return {
    destroy() { wrap.remove(); }
  };
}

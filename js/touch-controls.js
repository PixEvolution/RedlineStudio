// touch-controls.js — on-screen buttons for phones/tablets.
// The buttons are GENERATED from whatever keys the game's scripts actually use
// (engine.usedKeys()), so every game automatically gets the right controls.

const LABELS = {
  ArrowUp: "▲", ArrowDown: "▼", ArrowLeft: "◀", ArrowRight: "▶",
  Space: "SPACE", Enter: "ENTER", Shift: "SHIFT", Escape: "ESC"
};

const ARROWS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];

export function isTouchDevice() {
  return window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
}

// Creates the controls inside `container`. Returns { destroy }.
export function createTouchControls(engine, container) {
  const keys = engine.usedKeys();
  const wrap = document.createElement("div");
  wrap.className = "touch-controls";

  if (keys.length === 0) {
    // Click-only game — no buttons needed, the canvas itself is the controller.
    return { destroy() {} };
  }

  const makeBtn = (key) => {
    const b = document.createElement("button");
    b.className = "touch-btn";
    b.textContent = LABELS[key] || (key.length === 1 ? key.toUpperCase() : key);
    b.setAttribute("aria-label", key);
    let repeat = null;
    const down = (e) => {
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
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    return b;
  };

  // Arrow keys form a D-pad on the left; everything else is an action button on the right.
  const usedArrows = ARROWS.filter(a => keys.includes(a));
  const others = keys.filter(k => !ARROWS.includes(k));

  if (usedArrows.length > 0) {
    const pad = document.createElement("div");
    pad.className = "touch-dpad";
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
  }

  if (others.length > 0) {
    const actions = document.createElement("div");
    actions.className = "touch-actions";
    for (const k of others) actions.appendChild(makeBtn(k));
    wrap.appendChild(actions);
  }

  container.appendChild(wrap);
  return {
    destroy() { wrap.remove(); }
  };
}

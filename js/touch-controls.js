// touch-controls.js — on-screen buttons for phones/tablets.
// The buttons are GENERATED from whatever keys the game's scripts actually use
// (engine.usedKeys()), so every game automatically gets the right controls.
//
// Players can make them their own: the ✥ button opens edit mode, where EVERY
// INDIVIDUAL BUTTON can be dragged anywhere and resized by its ◢ corner
// handle. − / + scale everything at once, Reset puts the defaults back, and
// the layout is saved on this device PER CONTROL SET — games that share the
// same keys share the layout, games with different controls get their own.

const LABELS = {
  ArrowUp: "▲", ArrowDown: "▼", ArrowLeft: "◀", ArrowRight: "▶",
  Space: "SPACE", Enter: "ENTER", Shift: "SHIFT", Escape: "ESC"
};

const ARROWS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];

export function isTouchDevice() {
  return window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
}

// ---- the layout store (pure, testable) ------------------------------------

// One saved layout per SET of controls, so your Tank layout never fights
// your Pong layout, while every 4-way+fire game shares one.
export function layoutSlot(keys) {
  return "rl_ctl_v2:" + [...keys].sort().join(",");
}

export function clampBtnScale(s) {
  const v = Number(s);
  if (!v || !isFinite(v)) return 1;
  return Math.max(0.5, Math.min(2.2, Math.round(v * 100) / 100));
}

export function emptyLayout() {
  return { scale: 1, btns: {} };
}

// A button's own transform: its saved offset + size on top of the default spot.
export function btnTransform(layout, key) {
  const b = layout?.btns?.[key] || {};
  const x = Number(b.x) || 0, y = Number(b.y) || 0;
  const s = clampBtnScale(b.s || 1) * clampBtnScale(layout?.scale || 1);
  return `translate(${x}px, ${y}px) scale(${s})`;
}

function loadLayout(slot) {
  try {
    const raw = localStorage.getItem(slot);
    if (raw) {
      const l = JSON.parse(raw);
      if (l && typeof l === "object") return { scale: l.scale || 1, btns: l.btns || {} };
    }
  } catch {}
  return emptyLayout();
}

function saveLayout(slot, layout) {
  try { localStorage.setItem(slot, JSON.stringify(layout)); } catch {}
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
  const slot = layoutSlot(keys);
  let layout = loadLayout(slot);
  let editing = false;

  const buttons = [];   // [{ el, key }]

  const place = (el, key) => {
    el.style.transform = btnTransform(layout, key);
  };
  const placeAll = () => { for (const b of buttons) place(b.el, b.key); };
  const btnState = (key) => (layout.btns[key] = layout.btns[key] || { x: 0, y: 0, s: 1 });

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

    // ---- edit mode: drag the button itself to MOVE it -------------------
    b.addEventListener("pointerdown", (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
      const st = btnState(key);
      const sx = e.clientX - st.x, sy = e.clientY - st.y;
      b.setPointerCapture?.(e.pointerId);
      const move = (ev) => {
        st.x = ev.clientX - sx;
        st.y = ev.clientY - sy;
        place(b, key);
      };
      const up2 = () => {
        b.removeEventListener("pointermove", move);
        b.removeEventListener("pointerup", up2);
        b.removeEventListener("pointercancel", up2);
        saveLayout(slot, layout);
      };
      b.addEventListener("pointermove", move);
      b.addEventListener("pointerup", up2);
      b.addEventListener("pointercancel", up2);
    });

    // ---- ...and its ◢ corner handle to RESIZE it -------------------------
    const rsz = document.createElement("span");
    rsz.className = "touch-rsz";
    rsz.textContent = "◢";
    rsz.addEventListener("pointerdown", (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
      const st = btnState(key);
      const s0 = st.s || 1, ox = e.clientX, oy = e.clientY;
      rsz.setPointerCapture?.(e.pointerId);
      const move = (ev) => {
        const d = (ev.clientX - ox) + (ev.clientY - oy);   // drag out = bigger
        st.s = clampBtnScale(s0 * (1 + d / 120));
        place(b, key);
      };
      const up2 = () => {
        rsz.removeEventListener("pointermove", move);
        rsz.removeEventListener("pointerup", up2);
        rsz.removeEventListener("pointercancel", up2);
        saveLayout(slot, layout);
      };
      rsz.addEventListener("pointermove", move);
      rsz.addEventListener("pointerup", up2);
      rsz.addEventListener("pointercancel", up2);
    });
    b.appendChild(rsz);

    buttons.push({ el: b, key });
    return b;
  };

  // Arrow keys form a D-pad on the left; everything else is an action button
  // on the right. Those are just the DEFAULT spots — every button then wears
  // its own saved offset and size.
  const usedArrows = ARROWS.filter(a => keys.includes(a));
  const others = keys.filter(k => !ARROWS.includes(k));

  if (usedArrows.length > 0) {
    const pad = document.createElement("div");
    pad.className = "touch-dpad touch-cluster";
    const slotBtn = (area, key) => {
      if (!keys.includes(key)) { const sp = document.createElement("span"); sp.style.gridArea = area; pad.appendChild(sp); return; }
      const b = makeBtn(key);
      b.style.gridArea = area;
      pad.appendChild(b);
    };
    slotBtn("up", "ArrowUp");
    slotBtn("left", "ArrowLeft");
    slotBtn("down", "ArrowDown");
    slotBtn("right", "ArrowRight");
    wrap.appendChild(pad);
  }

  if (others.length > 0) {
    const actions = document.createElement("div");
    actions.className = "touch-actions touch-cluster";
    for (const k of others) actions.appendChild(makeBtn(k));
    wrap.appendChild(actions);
  }

  placeAll();

  // ---- the ✥ layout editor -------------------------------------------
  const editBtn = document.createElement("button");
  editBtn.className = "ctl-edit-btn";
  editBtn.textContent = "✥";
  editBtn.title = "Move / resize the buttons";
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
    layout.scale = clampBtnScale((layout.scale || 1) + d);
    placeAll();
    saveLayout(slot, layout);
  };
  mk("−", () => rescale(-0.1));
  mk("+", () => rescale(0.1));
  mk("Reset", () => {
    layout = emptyLayout();
    placeAll();
    saveLayout(slot, layout);
  });
  mk("Done", () => setEditing(false));

  const tip = document.createElement("span");
  tip.className = "ctl-edit-tip";
  tip.textContent = "drag a button to move it · drag its ◢ corner to resize";
  bar.appendChild(tip);

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

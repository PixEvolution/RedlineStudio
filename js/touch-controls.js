// touch-controls.js — on-screen buttons AND joysticks.
// The buttons are GENERATED from whatever keys the game's scripts actually use
// (engine.usedKeys()), and on-screen joysticks from whatever sticks they read
// (engine.usedSticks() — stickx(n)/sticky(n)), so every game automatically
// gets the right controls. Buttons are for touch screens; STICKS render on
// every device — on a desktop the mouse flies them — and a gamepad's analog
// sticks drive the same numbers, so one script serves thumb, mouse and pad.
//
// Players can make them their own: the ✥ button opens edit mode, where EVERY
// INDIVIDUAL BUTTON can be dragged anywhere, PINCHED bigger or smaller with
// two fingers, or resized by its ◢ corner handle. − / + scale everything at
// once, Reset puts the defaults back, and the layout is saved on this device
// PER CONTROL SET — games that share the same keys share the layout, games
// with different controls get their own. Every game calls for its own layout,
// so nothing here is fixed: any button, any spot, any size.
//
// Phone friendliness: the buttons sit ABOVE the phone's home-bar gesture zone
// (safe-area padding, so dragging a button never swipes the app away), the
// edit toolbar lives at the TOP of the screen where no controls ever go, and
// a layout saved on one screen is pulled back into view on a smaller one.

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

// Two fingers on a button: its size follows the spread of the fingers.
export function pinchScale(s0, d0, d1) {
  return clampBtnScale((Number(s0) || 1) * (Math.max(1, Number(d1) || 1) / Math.max(1, Number(d0) || 1)));
}

// A joystick's reading: finger offset from the base's center, clamped to the
// unit circle. Screen convention — up is -1, right is +1. Pure, testable.
export function stickVector(dx, dy, r) {
  r = Math.max(1, Number(r) || 1);
  let x = (Number(dx) || 0) / r, y = (Number(dy) || 0) / r;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

// A layout saved on one screen, opened on a smaller one: how far a button's
// rect must shift to come back into the visible box. Pure, so it's testable.
export function shiftIntoBox(rect, boxW, boxH, pad = 2) {
  let dx = 0, dy = 0;
  if (rect.left < pad) dx = pad - rect.left;
  else if (rect.right > boxW - pad) dx = (boxW - pad) - rect.right;
  if (rect.top < pad) dy = pad - rect.top;
  else if (rect.bottom > boxH - pad) dy = (boxH - pad) - rect.bottom;
  return { dx, dy };
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
// Safe to call on ANY device: phones get buttons + sticks, desktops get
// on-screen sticks only (their keyboard beats buttons, but a mouse flies a
// stick as well as a thumb does). Nothing to show = it renders nothing.
export function createTouchControls(engine, container) {
  const keys = engine.usedKeys();
  const sticks = (typeof engine.usedSticks === "function") ? engine.usedSticks() : [];
  const touch = isTouchDevice();

  // the game canvas is a game surface — no long-press menu, no text callout
  const canvas = container.querySelector?.("canvas");
  if (canvas) muzzle(canvas, { blockTouch: true });
  muzzle(container);   // context menu / selection off everywhere in the stage

  if ((touch ? keys.length + sticks.length : sticks.length) === 0) {
    // nothing to draw — the canvas/keyboard is the whole controller here
    return { destroy() {} };
  }

  const wrap = document.createElement("div");
  wrap.className = "touch-controls";
  const slot = layoutSlot([...keys, ...sticks.map(n => "stick" + n)]);
  let layout = loadLayout(slot);
  let editing = false;

  const buttons = [];   // [{ el, key }]

  const place = (el, key) => {
    el.style.transform = btnTransform(layout, key);
  };
  const placeAll = () => { for (const b of buttons) place(b.el, b.key); };
  const btnState = (key) => (layout.btns[key] = layout.btns[key] || { x: 0, y: 0, s: 1 });

  // A layout saved on a big screen must still work on a small one: any button
  // that landed outside the glass gets pulled back into view.
  function clampAll() {
    const vw = window.innerWidth, vh = window.innerHeight;
    // vertical clamping only makes sense in fullscreen, where the viewport IS
    // the whole world — in the page the controls may scroll, and that's fine
    const fs = container.classList?.contains("fs-on") || container.classList?.contains("fs-fallback");
    for (const { el, key } of buttons) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const { dx, dy } = shiftIntoBox(r, vw, fs ? vh : Infinity, 4);
      if (dx || (fs && dy)) {
        const st = btnState(key);
        st.x += dx;
        if (fs) st.y += dy;
        place(el, key);
      }
    }
  }
  const onResize = () => { clampAll(); };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

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

    wireEditing(b, key);
    buttons.push({ el: b, key });
    return b;
  };

  // ---- edit mode, shared by buttons AND sticks: one finger MOVES the
  // control, two fingers PINCH it, and the ◢ corner handle also resizes ----
  function wireEditing(el, key) {
    const pts = new Map();          // live pointers on this control
    let dragBase = null, pinchBase = null;
    const spread = () => {
      const [p1, p2] = [...pts.values()];
      return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    };
    el.addEventListener("pointerdown", (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const st = btnState(key);
      if (pts.size === 1) {
        dragBase = { sx: e.clientX - st.x, sy: e.clientY - st.y };
      } else if (pts.size === 2) {
        dragBase = null;            // second finger down = resizing, not moving
        pinchBase = { s0: st.s || 1, d0: spread() };
      }
    });
    const editMove = (e) => {
      if (!editing || !pts.has(e.pointerId)) return;
      e.preventDefault();
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const st = btnState(key);
      if (pts.size >= 2 && pinchBase) {
        st.s = pinchScale(pinchBase.s0, pinchBase.d0, spread());
      } else if (dragBase) {
        st.x = e.clientX - dragBase.sx;
        st.y = e.clientY - dragBase.sy;
      }
      place(el, key);
    };
    const editEnd = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      pinchBase = null;
      if (pts.size === 1) {         // one finger stays → it takes over the drag
        const st = btnState(key);
        const p = [...pts.values()][0];
        dragBase = { sx: p.x - st.x, sy: p.y - st.y };
      } else {
        dragBase = null;
      }
      if (pts.size === 0 && editing) { clampAll(); saveLayout(slot, layout); }
    };
    el.addEventListener("pointermove", editMove);
    el.addEventListener("pointerup", editEnd);
    el.addEventListener("pointercancel", editEnd);

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
        place(el, key);
      };
      const up2 = () => {
        rsz.removeEventListener("pointermove", move);
        rsz.removeEventListener("pointerup", up2);
        rsz.removeEventListener("pointercancel", up2);
        clampAll();
        saveLayout(slot, layout);
      };
      rsz.addEventListener("pointermove", move);
      rsz.addEventListener("pointerup", up2);
      rsz.addEventListener("pointercancel", up2);
    });
    el.appendChild(rsz);
  }

  // ---- the on-screen JOYSTICK: a base ring and a knob that follows your
  // finger — or your mouse — and reads back through stickx(n)/sticky(n).
  // A game can NAME its sticks: a (hidden) text object called stick1tag,
  // stick2tag, … labels that stick — "P1", "AIM ↕", "WEDGE" — so nobody has
  // to guess which stick is whose. No tag object = the plain number.
  const makeStick = (n) => {
    const base = document.createElement("div");
    base.className = "touch-stick";
    base.setAttribute("aria-label", "joystick " + n);
    const knob = document.createElement("div");
    knob.className = "touch-knob";
    const tag = document.createElement("span");
    tag.className = "touch-stick-num";
    const named = engine.byName && engine.byName["stick" + n + "tag"];
    tag.textContent = (named && String(named.text || "").trim()) || String(n);
    base.append(knob, tag);
    muzzle(base, { blockTouch: true });

    let driving = null;   // the one pointer flying this stick
    const fly = (e) => {
      const r = base.getBoundingClientRect();
      const v = stickVector(
        e.clientX - (r.left + r.width / 2),
        e.clientY - (r.top + r.height / 2),
        r.width / 2
      );
      engine.setStick(n, v.x, v.y);
      knob.style.transform =
        `translate(calc(-50% + ${(v.x * r.width * 0.3).toFixed(1)}px), calc(-50% + ${(v.y * r.height * 0.3).toFixed(1)}px))`;
      base.classList.add("held");
    };
    const land = () => {
      driving = null;
      engine.clearStick(n);
      knob.style.transform = "translate(-50%, -50%)";
      base.classList.remove("held");
    };
    base.addEventListener("pointerdown", (e) => {
      if (editing || driving !== null) return;
      e.preventDefault();
      driving = e.pointerId;
      base.setPointerCapture?.(e.pointerId);
      fly(e);
    });
    base.addEventListener("pointermove", (e) => {
      if (editing || e.pointerId !== driving) return;
      e.preventDefault();
      fly(e);
    });
    const up = (e) => { if (e.pointerId === driving) land(); };
    base.addEventListener("pointerup", up);
    base.addEventListener("pointercancel", up);

    wireEditing(base, "stick" + n);
    buttons.push({ el: base, key: "stick" + n });
    return base;
  };

  // Layout: odd sticks + the D-pad on the left, action buttons + even sticks
  // on the right. Those are just the DEFAULT spots — every control then wears
  // its own saved offset and size. Key BUTTONS only appear on touch devices
  // (a desktop has the real keys); STICKS appear everywhere they're read.
  const leftBox = document.createElement("div");
  leftBox.className = "touch-side touch-cluster";
  const rightBox = document.createElement("div");
  rightBox.className = "touch-side touch-cluster";

  for (const n of sticks) (n % 2 ? leftBox : rightBox).appendChild(makeStick(n));

  const usedArrows = touch ? ARROWS.filter(a => keys.includes(a)) : [];
  const others = touch ? keys.filter(k => !ARROWS.includes(k)) : [];

  if (usedArrows.length > 0) {
    const pad = document.createElement("div");
    pad.className = "touch-dpad";
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
    leftBox.appendChild(pad);
  }

  if (others.length > 0) {
    const actions = document.createElement("div");
    actions.className = "touch-actions";
    for (const k of others) actions.appendChild(makeBtn(k));
    rightBox.insertBefore(actions, rightBox.firstChild);
  }

  if (leftBox.children.length) wrap.appendChild(leftBox);
  if (rightBox.children.length) wrap.appendChild(rightBox);

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
  tip.textContent = "drag a button to move · pinch it (or drag its ◢ corner) to resize";
  bar.appendChild(tip);

  function setEditing(on) {
    editing = on;
    wrap.classList.toggle("editing", on);
    container.classList?.toggle("ctl-editing", on);
    bar.style.display = on ? "flex" : "none";
  }
  editBtn.addEventListener("click", () => setEditing(!editing));
  bar.style.display = "none";

  wrap.appendChild(editBtn);
  // the toolbar lives at the TOP of the stage — the bottom belongs to buttons
  container.appendChild(bar);
  container.appendChild(wrap);
  requestAnimationFrame?.(() => clampAll());   // a big-screen layout on a small screen

  return {
    destroy() {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      for (const n of sticks) { try { engine.clearStick(n); } catch {} }
      container.classList?.remove("ctl-editing");
      bar.remove();
      wrap.remove();
    }
  };
}

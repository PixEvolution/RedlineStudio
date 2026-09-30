// studio-panels.js — workflow upgrades for the Studio's panels.
// Every panel gets a clickable header: click to COLLAPSE it (remembered per
// device), and on desktop drag the ⠿ handle to POP THE PANEL OUT into a
// floating window you can park anywhere — click ⟲ (or its empty slot) to
// dock it back. On phones (portrait) floating is off; collapsing still works.

const memo = (k) => "rl_panel_" + k;

export function setupPanel(panel, { key, title, float = true } = {}) {
  if (!panel) return null;

  // ---- build the header out of the panel's first heading ----
  const h = panel.querySelector("h3, h2");
  const head = document.createElement("div");
  head.className = "panel-head";

  const drag = document.createElement("span");
  drag.className = "drag";
  drag.textContent = "⠿";
  drag.title = "Drag to float this panel";

  const label = h || document.createElement("h3");
  if (!h) label.textContent = title || "Panel";

  const tw = document.createElement("span");
  tw.className = "tw";

  if (float) head.appendChild(drag);
  head.append(label, tw);
  panel.insertBefore(head, panel.firstChild);

  // ---- collapse (remembered) ----
  const setCollapsed = (on) => {
    panel.classList.toggle("collapsed", on);
    tw.textContent = on ? "▸" : "▾";
    try { localStorage.setItem(memo(key), on ? "1" : "0"); } catch {}
  };
  let saved = null;
  try { saved = localStorage.getItem(memo(key)); } catch {}
  setCollapsed(saved === "1");
  head.addEventListener("click", (e) => {
    if (e.target === drag || panel.classList.contains("dragging")) return;
    setCollapsed(!panel.classList.contains("collapsed"));
  });

  // ---- float (desktop only) ----
  if (!float) return { setCollapsed };
  let placeholder = null, dockBtn = null, resz = null, moved = false;

  // a floated panel is RESIZABLE (◢ corner, like the touch buttons) —
  // wide Explorer, wide Properties, real names at last. Size is remembered.
  const sizeKey = memo(key) + "_wh";
  const applySavedSize = () => {
    try {
      const s = JSON.parse(localStorage.getItem(sizeKey) || "null");
      if (s && s.w) { panel.style.width = s.w + "px"; }
      if (s && s.h) { panel.style.height = s.h + "px"; panel.style.maxHeight = s.h + "px"; }
    } catch {}
  };

  const dock = () => {
    if (!placeholder) return;
    placeholder.replaceWith(panel);
    placeholder = null;
    panel.classList.remove("floating");
    panel.style.left = panel.style.top = panel.style.width = "";
    panel.style.height = panel.style.maxHeight = "";
    if (dockBtn) { dockBtn.remove(); dockBtn = null; }
    if (resz) { resz.disconnect(); resz = null; }
  };

  drag.addEventListener("pointerdown", (e) => {
    if (window.innerWidth <= 950) return;   // portrait: no floating
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    moved = false;

    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.className = "float-placeholder";
      placeholder.textContent = `${label.textContent} is floating — click here to dock it`;
      placeholder.addEventListener("click", dock);
      panel.replaceWith(placeholder);
      document.body.appendChild(panel);
      panel.classList.add("floating");
      panel.style.width = Math.max(240, r.width) + "px";

      dockBtn = document.createElement("span");
      dockBtn.className = "dock";
      dockBtn.textContent = "⟲";
      dockBtn.title = "Dock this panel back";
      dockBtn.addEventListener("click", (ev) => { ev.stopPropagation(); dock(); });
      head.appendChild(dockBtn);

      // native resize grip (CSS resize: both) — remember the chosen size
      applySavedSize();
      let saveTimer = null;
      resz = new ResizeObserver(() => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          if (!panel.classList.contains("floating")) return;
          const r2 = panel.getBoundingClientRect();
          panel.style.maxHeight = "none";   // the user's size wins over the 80vh cap
          try { localStorage.setItem(sizeKey, JSON.stringify({ w: Math.round(r2.width), h: Math.round(r2.height) })); } catch {}
        }, 300);
      });
      resz.observe(panel);
    }
    const place = (ev) => {
      panel.style.left = Math.max(4, Math.min(window.innerWidth - 80, ev.clientX - ox)) + "px";
      panel.style.top = Math.max(4, Math.min(window.innerHeight - 40, ev.clientY - oy)) + "px";
    };
    place(e);
    panel.classList.add("dragging");

    const onMove = (ev) => { moved = true; place(ev); };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setTimeout(() => panel.classList.remove("dragging"), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  return { setCollapsed };
}

// studio-panels.js — workflow upgrades for the Studio's panels.
// Every panel gets a clickable header: click to COLLAPSE it (remembered per
// device), and on desktop drag the ⠿ handle to POP THE PANEL OUT into a
// floating window you can park anywhere — click ⟲ (or its empty slot) to
// dock it back. On phones (portrait) floating is off; collapsing still works.

const memo = (k) => "rl_panel_" + k;

export function setupPanel(panel, { key, title, float = true } = {}) {
  if (!panel) return;

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
  if (!float) return;
  let placeholder = null, dockBtn = null, moved = false;

  const dock = () => {
    if (!placeholder) return;
    placeholder.replaceWith(panel);
    placeholder = null;
    panel.classList.remove("floating");
    panel.style.left = panel.style.top = panel.style.width = "";
    if (dockBtn) { dockBtn.remove(); dockBtn = null; }
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
}

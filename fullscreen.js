// fullscreen.js — optional fullscreen for a game stage.
// Uses the real Fullscreen API where it exists; iPhones don't allow it,
// so there's a CSS "fill the whole viewport" fallback that looks the same.
// Either way we drive the styling with our own .fs-on class, so the layout
// is identical no matter which path the browser took.

export function isFullscreen(el) {
  return document.fullscreenElement === el || el.classList.contains("fs-fallback");
}

function setOn(el, on) {
  el.classList.toggle("fs-on", on);
  document.body.classList.toggle("fs-lock", on);
}

export async function toggleFullscreen(el) {
  if (isFullscreen(el)) {
    if (document.fullscreenElement === el) {
      await document.exitFullscreen().catch(() => {});
    }
    el.classList.remove("fs-fallback");
    setOn(el, false);
    return false;
  }
  try {
    await el.requestFullscreen();
  } catch {
    el.classList.add("fs-fallback");     // iOS / anything without the API
  }
  setOn(el, true);
  return true;
}

// Wires a ⛶ button to a stage element and keeps its label right
// (including when the user exits with the Esc key).
export function attachFullscreenButton(btn, el) {
  const sync = () => {
    // Esc key exits native fullscreen without telling our button — resync here
    if (!document.fullscreenElement && !el.classList.contains("fs-fallback")) {
      setOn(el, false);
    }
    btn.textContent = isFullscreen(el) ? "✕ Exit fullscreen" : "⛶ Fullscreen";
  };
  btn.addEventListener("click", async () => { await toggleFullscreen(el); sync(); });
  document.addEventListener("fullscreenchange", sync);
  sync();
}

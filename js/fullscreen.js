// fullscreen.js — optional fullscreen for a game stage.
// Uses the real Fullscreen API where it exists; iPhones don't allow it,
// so there's a CSS "fill the whole viewport" fallback that looks the same.

export function isFullscreen(el) {
  return document.fullscreenElement === el || el.classList.contains("fs-fallback");
}

export async function toggleFullscreen(el) {
  if (isFullscreen(el)) {
    if (document.fullscreenElement === el) {
      await document.exitFullscreen().catch(() => {});
    }
    el.classList.remove("fs-fallback");
    document.body.classList.remove("fs-lock");
    return false;
  }
  try {
    await el.requestFullscreen();
  } catch {
    el.classList.add("fs-fallback");     // iOS / anything without the API
    document.body.classList.add("fs-lock");
  }
  return true;
}

// Wires a ⛶ button to a stage element and keeps its label right
// (including when the user exits with the Esc key).
export function attachFullscreenButton(btn, el) {
  const sync = () => {
    const on = isFullscreen(el);
    btn.textContent = on ? "✕ Exit fullscreen" : "⛶ Fullscreen";
    if (!document.fullscreenElement && !el.classList.contains("fs-fallback")) {
      document.body.classList.remove("fs-lock");
    }
  };
  btn.addEventListener("click", async () => { await toggleFullscreen(el); sync(); });
  document.addEventListener("fullscreenchange", sync);
  sync();
}

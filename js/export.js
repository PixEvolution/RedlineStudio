// export.js — "⬇ Download": turns a game into ONE standalone HTML file.
// The engine, the language and the touch controls are bundled in, so the file
// runs offline by double-click — upload it to itch.io as a playable browser
// game, or wrap it with Electron/Tauri to ship a desktop build.
// Built on RedlineStudio, published anywhere.

// Our modules only import each other, so bundling = strip the module plumbing
// and concatenate in dependency order inside one <script>.
function stripModules(source) {
  return source
    .split("\n")
    .filter(line => !/^\s*import\s/.test(line) && !/^\}\s*from\s+"/.test(line))
    .map(line => line.replace(/^export\s+(?=(const|let|var|function|class)\b)/, ""))
    .join("\n");
}

const BUNDLE_FILES = ["js/redscript.js", "js/engine.js", "js/touch-controls.js", "js/terminal.js", "js/casino-odds.js"];

export async function buildStandaloneHtml({ title, objects, w, h }, { rootPath = "", fetchText } = {}) {
  const get = fetchText || (async (path) => {
    const res = await fetch(rootPath + path);
    if (!res.ok) throw new Error("Couldn't read " + path);
    return res.text();
  });

  const sources = [];
  for (const f of BUNDLE_FILES) sources.push(stripModules(await get(f)));

  // <, > and the closing script tag must never appear raw inside the JSON
  const gameJson = JSON.stringify({ title, objects, w, h })
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const safeTitle = String(title || "My Game").replace(/&/g, "&amp;").replace(/</g, "&lt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; min-height: 100dvh; background: #0b0b0e; color: #e8e8ec;
         font-family: "Courier New", monospace; display: flex; flex-direction: column;
         align-items: center; justify-content: center; gap: 10px; padding: 12px; box-sizing: border-box; }
  h1 { font-size: 18px; margin: 0; color: #8dffa9; text-shadow: 0 0 10px rgba(57,255,94,.4); }
  .stage { position: relative; width: 100%; max-width: 640px; display: flex; flex-direction: column; }
  canvas { width: 100%; aspect-ratio: 4 / 3; display: block; border: 2px solid #123c24; border-radius: 12px;
           background: #03110a; object-fit: contain; }
  .stage, .stage * { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
                     -webkit-tap-highlight-color: transparent; }
  .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
             background: rgba(0,0,0,.45); border-radius: 12px; }
  .fsbtn { position: absolute; top: 8px; right: 8px; z-index: 10; width: 38px; height: 34px;
           border-radius: 8px; border: 1px solid #1f8f3c; background: rgba(0,0,0,.5);
           color: #8dffa9; font-size: 16px; cursor: pointer; font-family: inherit; }
  .fsbtn:hover { background: rgba(57,255,94,.2); }
  .stage.fs { position: fixed; inset: 0; z-index: 50; max-width: none; background: #0b0b0e;
              padding: 8px; box-sizing: border-box; }
  .stage.fs canvas { flex: 1 1 auto; min-height: 0; width: 100%; height: 100%;
                     aspect-ratio: auto; object-fit: contain; border: none; }
  .stage.fs .touch-controls, .stage.fs .term-row { flex: 0 0 auto; }
  body.fslock { overflow: hidden; }
  .coin-btn { font-family: inherit; font-size: 18px; font-weight: 800; padding: 14px 26px; cursor: pointer;
              border-radius: 14px; border: 2px solid #1f8f3c; background: rgba(57,255,94,.12); color: #8dffa9; }
  .coin-btn:hover { background: rgba(57,255,94,.25); }
  .touch-controls { position: relative; display: flex; align-items: flex-end; justify-content: space-between;
                    gap: 16px; margin-top: 10px; }
  .touch-cluster { position: relative; z-index: 20; transform-origin: bottom center; touch-action: none; }
  .touch-side { display: flex; align-items: flex-end; gap: 14px; }
  .touch-controls.editing .touch-btn { opacity: .6; }
  .touch-stick { position: relative; width: 104px; height: 104px; border-radius: 50%;
                 border: 2px solid #1f8f3c; background: rgba(57,255,94,.05); touch-action: none;
                 cursor: pointer; flex: 0 0 auto; }
  .touch-knob { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; border-radius: 50%;
                border: 2px solid #39ff5e; background: rgba(57,255,94,.18);
                transform: translate(-50%,-50%); pointer-events: none; }
  .touch-stick.held .touch-knob { background: rgba(57,255,94,.4); box-shadow: 0 0 14px rgba(57,255,94,.5); }
  .touch-stick-num { position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%);
                     color: #57b06f; font-size: 10px; font-weight: 800; white-space: nowrap;
                     background: rgba(3,17,10,.8); padding: 0 5px; border-radius: 6px; pointer-events: none; }
  .touch-controls.editing .touch-stick { outline: 1px dashed #ff9d4a; outline-offset: 2px; opacity: .7; }
  .touch-btn { position: relative; }
  .touch-rsz { display: none; position: absolute; right: -13px; bottom: -13px; width: 34px; height: 34px;
               align-items: center; justify-content: center; font-size: 15px; color: #ff9d4a;
               background: rgba(0,0,0,.55); border: 1px solid #ff9d4a; border-radius: 50%;
               touch-action: none; z-index: 5; }
  .touch-controls.editing .touch-rsz { display: flex; }
  .touch-controls.editing .touch-btn { outline: 1px dashed #ff9d4a; outline-offset: 2px; }
  .ctl-edit-tip { color: #7a8894; font-size: 11px; align-self: center; }
  .touch-dpad { display: grid; grid-template-areas: ". up ." "left down right"; gap: 6px; }
  .touch-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
  .touch-btn { min-width: 58px; min-height: 58px; padding: 8px 14px; border-radius: 14px; border: 2px solid #1f8f3c;
               background: rgba(57,255,94,.08); color: #8dffa9; font-size: 18px; font-weight: 800;
               font-family: inherit; cursor: pointer; touch-action: none; }
  .touch-btn.held { background: rgba(57,255,94,.3); box-shadow: 0 0 14px rgba(57,255,94,.5); }
  .ctl-edit-btn { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%); z-index: 25;
                  width: 34px; height: 34px; border-radius: 50%; border: 1px solid #2a2a31;
                  background: rgba(0,0,0,.45); color: #9aa; font-size: 16px; cursor: pointer; }
  .ctl-edit-bar { position: absolute; left: 50%; bottom: 42px; transform: translateX(-50%); z-index: 25;
                  display: flex; gap: 6px; padding: 6px 8px; background: rgba(0,0,0,.7);
                  border: 1px solid #2a2a31; border-radius: 10px; }
  .ctl-edit-bar button { font-family: inherit; background: #17171c; color: #e8e8ec; border: 1px solid #2a2a31;
                         border-radius: 8px; padding: 4px 10px; cursor: pointer; }
  .term-row { display: flex; gap: 8px; margin-top: 8px; }
  .term-input { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid #1f8f3c;
                background: #03110a; color: #8dffa9; font-family: inherit; font-size: 15px;
                user-select: text !important; -webkit-user-select: text !important; }
  .term-input:focus { outline: none; border-color: #39ff5e; }
  .term-send { font-family: inherit; font-weight: 800; padding: 8px 16px; border-radius: 10px;
               border: 2px solid #1f8f3c; background: rgba(57,255,94,.12); color: #8dffa9; cursor: pointer; }
  .credit { font-size: 12px; color: #7a8894; }
  .credit a { color: #ff8f8c; }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
<div class="stage" id="stage">
  <canvas id="screen" width="480" height="360"></canvas>
  <button class="fsbtn" id="fsbtn" title="Fullscreen">⛶</button>
  <div class="overlay" id="overlay"><button class="coin-btn" id="startbtn">▶ PLAY</button></div>
</div>
<p class="credit">Made with <a href="https://redlinestudio.dev" target="_blank" rel="noopener">RedlineStudio</a></p>
<script>
${sources.join("\n\n")}

// ---- boot -----------------------------------------------------------------
const GAME = ${gameJson};
document.title = GAME.title || document.title;
const _stage = document.getElementById("stage");
const _canvas = document.getElementById("screen");
// the game's own world size (default = the classic 480×360), rendered at
// double resolution so the glass stays crisp at any display size
const _W = Number(GAME.w) || 480, _H = Number(GAME.h) || 360;
_canvas.width = _W * 2; _canvas.height = _H * 2;
_canvas.getContext("2d").setTransform(2, 0, 0, 2, 0, 0);
_canvas.style.aspectRatio = _W + " / " + _H;
const _overlay = document.getElementById("overlay");
// fullscreen: real fullscreen where the browser allows it, and the stage
// fills the window either way (works from file:// and on iPhones)
const _fsbtn = document.getElementById("fsbtn");
function _setFs(on) {
  _stage.classList.toggle("fs", on);
  document.body.classList.toggle("fslock", on);
  _fsbtn.textContent = on ? "✕" : "⛶";
}
_fsbtn.addEventListener("click", () => {
  const on = !_stage.classList.contains("fs");
  _setFs(on);
  try {
    if (on && _stage.requestFullscreen) _stage.requestFullscreen().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch {}
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && _stage.classList.contains("fs")) _setFs(false);
});

document.getElementById("startbtn").addEventListener("click", () => {
  _overlay.remove();
  const engine = new Engine(_canvas, GAME.objects || [], { w: _W, h: _H });
  if (engine.usesCasino()) attachCasinoLoop(engine, localWallet(100, 1000));  // offline = free play
  engine.start();
  createTouchControls(engine, _stage);   // buttons on touch, sticks everywhere
  attachTerminalInput(engine, _stage);
});
</script>
</body>
</html>`;
}

// Browser-side helper: build the file and hand it to the user as a download.
export async function downloadStandalone(game, rootPath = "") {
  const html = await buildStandaloneHtml(game, { rootPath });
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (String(game.title || "my-game").replace(/[\\/:*?"<>|]/g, "_") || "my-game") + ".html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

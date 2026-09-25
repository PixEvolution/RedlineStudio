// export-studio.js — "📦 Offline Studio": bundles the EDITOR into one HTML
// file that runs from a double-click with no internet at all. Same engine,
// same blocks, same behaviors, same undo — build on a plane, save a signed
// .rlgame file, then ⬆ Import it in the online Studio to publish.
// (Publishing, models, the arcade floor and the example museum stay online —
// they need the site. The offline file is the WORKSHOP, not the arcade.)

import { stripModules } from "./export.js";

const STUDIO_BUNDLE = [
  "js/redscript.js", "js/engine.js", "js/blocks.js", "js/behaviors.js",
  "js/studio-tools.js", "js/gamefile.js", "js/touch-controls.js",
  "js/terminal.js", "js/casino-odds.js"
];

export async function buildOfflineStudioHtml({ rootPath = "", fetchText } = {}) {
  const get = fetchText || (async (path) => {
    const res = await fetch(rootPath + path);
    if (!res.ok) throw new Error("Couldn't read " + path);
    return res.text();
  });
  const sources = [];
  for (const f of STUDIO_BUNDLE) sources.push(stripModules(await get(f)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RedlineStudio — Offline</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; background: #0b0b0e; color: #e8e8ec;
         font-family: "Courier New", monospace; padding: 12px; box-sizing: border-box; }
  h1 { font-size: 16px; margin: 0; color: #8dffa9; text-shadow: 0 0 10px rgba(57,255,94,.4); white-space: nowrap; }
  .bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  .bar input[type=text] { flex: 1; min-width: 140px; padding: 8px 12px; border-radius: 10px; border: 1px solid #2a2a31;
         background: #17171c; color: #e8e8ec; font-family: inherit; font-size: 15px; }
  button, select { font-family: inherit; background: #17171c; color: #e8e8ec; border: 1px solid #2a2a31;
         border-radius: 8px; padding: 7px 12px; cursor: pointer; font-size: 13px; }
  button:hover { border-color: #1f8f3c; }
  button:disabled { opacity: .35; cursor: default; }
  .go { background: rgba(57,255,94,.12); border-color: #1f8f3c; color: #8dffa9; font-weight: 800; }
  .grid { display: grid; grid-template-columns: 200px 1fr 210px; gap: 12px; align-items: start; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .panel { background: #101014; border: 1px solid #2a2a31; border-radius: 12px; padding: 12px; }
  .panel h3 { margin: 0 0 8px; font-size: 13px; color: #8dffa9; }
  .stage { position: relative; display: flex; flex-direction: column; }
  canvas { width: 100%; display: block; border: 2px solid #123c24; border-radius: 12px; background: #03110a; object-fit: contain; }
  .stage, .stage * { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
  .hint { color: #7a8894; font-size: 11px; }
  .row { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 8px; cursor: pointer; }
  .row.sel { background: rgba(57,255,94,.1); }
  .row .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
  .row .ty { color: #7a8894; font-size: 10px; }
  .mini { padding: 1px 7px; font-size: 11px; }
  label { display: block; color: #7a8894; font-size: 11px; margin: 8px 0 3px; }
  .panel input { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 8px; border: 1px solid #2a2a31;
         background: #17171c; color: #e8e8ec; font-family: inherit; font-size: 13px; }
  .addrow, .layerrow { display: flex; gap: 5px; flex-wrap: wrap; }
  .colorrow { display: flex; gap: 6px; }
  .colorrow input[type=color] { width: 40px; height: 32px; padding: 2px; background: #17171c; border: 1px solid #2a2a31; border-radius: 8px; }
  #blocks { margin-top: 12px; }
  /* the block editor + touch controls styles it expects */
  .blk-add { font-family: inherit; background: #17171c; color: #e8e8ec; border: 1px solid #2a2a31; border-radius: 8px; padding: 6px 10px; }
  .blk-mini { font-family: inherit; background: #17171c; color: #e8e8ec; border: 1px solid #2a2a31; border-radius: 6px; padding: 1px 7px; cursor: pointer; font-size: 11px; }
  .blk-del { color: #ff8f8c; }
  .blk-ev { border: 1px solid #2a2a31; border-radius: 10px; padding: 8px; margin: 8px 0; background: #0d0d11; }
  .blk-kw { color: #ff9d4a; font-size: 12px; margin: 0 4px; }
  .blk-in { font-family: inherit; background: #17171c; color: #8dffa9; border: 1px solid #2a2a31; border-radius: 6px; padding: 3px 6px; font-size: 12px; }
  .blk-body { margin-left: 16px; border-left: 1px dashed #2a2a31; padding-left: 8px; }
  .blk-row { margin: 4px 0; }
  .blk-head { display: flex; align-items: center; flex-wrap: wrap; gap: 3px; }
  textarea { font-family: inherit; background: #17171c; color: #8dffa9; border: 1px solid #2a2a31; border-radius: 8px; width: 100%; box-sizing: border-box; font-size: 12px; }
  .touch-controls { position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-top: 10px; }
  .touch-cluster { position: relative; touch-action: none; }
  .touch-side { display: flex; align-items: flex-end; gap: 14px; }
  .touch-dpad { display: grid; grid-template-areas: ". up ." "left down right"; gap: 6px; touch-action: none; }
  .touch-actions { display: flex; gap: 10px; flex-wrap: wrap; touch-action: none; }
  .touch-btn { min-width: 52px; min-height: 52px; border-radius: 14px; border: 2px solid #1f8f3c; background: rgba(57,255,94,.08);
               color: #8dffa9; font-size: 16px; font-weight: 800; font-family: inherit; touch-action: none; position: relative; }
  .touch-btn.held { background: rgba(57,255,94,.3); }
  .touch-stick { position: relative; width: 96px; height: 96px; border-radius: 50%; border: 2px solid #1f8f3c;
                 background: rgba(57,255,94,.05); touch-action: none; flex: 0 0 auto; }
  .touch-knob { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; border-radius: 50%;
                border: 2px solid #39ff5e; background: rgba(57,255,94,.18); transform: translate(-50%,-50%); pointer-events: none; }
  .touch-stick.held .touch-knob { background: rgba(57,255,94,.4); }
  .touch-stick-num { position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%); color: #57b06f;
                     font-size: 10px; font-weight: 800; white-space: nowrap; background: rgba(3,17,10,.8); padding: 0 5px; border-radius: 6px; pointer-events: none; }
  .touch-rsz, .ctl-edit-btn, .ctl-edit-bar { display: none !important; }
  .term-row { display: flex; gap: 8px; margin-top: 8px; }
  .term-input { flex: 1; padding: 8px 12px; border-radius: 10px; border: 1px solid #1f8f3c; background: #03110a;
                color: #8dffa9; font-family: inherit; user-select: text !important; -webkit-user-select: text !important; }
  .term-send { font-family: inherit; font-weight: 800; padding: 8px 14px; border-radius: 10px; border: 2px solid #1f8f3c;
               background: rgba(57,255,94,.12); color: #8dffa9; cursor: pointer; }
  .credit { font-size: 11px; color: #7a8894; margin-top: 14px; }
  .credit a { color: #ff8f8c; }
</style>
</head>
<body>
<div class="bar">
  <h1>REDLINE<span style="color:#e5322d">STUDIO</span> <span class="hint">offline</span></h1>
  <input type="text" id="title" maxlength="40" placeholder="Untitled Game">
  <button id="undo" title="Undo (Ctrl+Z)">↶</button><button id="redo" title="Redo (Ctrl+Y)">↷</button>
  <select id="worldsize">
    <option value="480x360">480×360 · classic</option>
    <option value="640x360">640×360 · wide</option>
    <option value="800x600">800×600 · large</option>
    <option value="960x540">960×540 · widescreen</option>
    <option value="360x480">360×480 · portrait</option>
  </select>
  <button id="new">New</button>
  <button id="open">📂 Open</button>
  <button id="save">💾 Save .rlgame</button>
  <button id="test" class="go">▶ Test</button>
</div>
<div class="grid">
  <div class="panel">
    <h3>Explorer</h3>
    <div class="addrow">
      <button class="mini" data-add="dot">+ Dot</button><button class="mini" data-add="ring">+ Ring</button>
      <button class="mini" data-add="box">+ Box</button><button class="mini" data-add="line">+ Line</button>
      <button class="mini" data-add="text">+ Text</button><button class="mini" data-add="tri">+ Ship</button>
    </div>
    <div id="objlist" style="margin-top:8px"></div>
  </div>
  <div>
    <div class="stage" id="stage"><canvas id="workspace" width="960" height="720"></canvas></div>
    <p class="hint" id="wshint">Click an object · drag to move · arrows nudge · Del deletes · Ctrl+D duplicates · ⌗ <button class="mini" id="snap"></button></p>
  </div>
  <div class="panel">
    <h3>Properties</h3>
    <div id="props" class="hint">Select an object.</div>
  </div>
</div>
<div class="panel" id="blocks">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
    <h3 id="scripttitle">Script</h3>
    <select id="behsel"><option value="">✨ Add behavior…</option></select>
  </div>
  <div id="scripted" class="hint">Select an object to edit its script.</div>
</div>
<p class="credit">The offline workshop. Save a <b>.rlgame</b> file, then ⬆ Import it in the online Studio at
<a href="https://redlinestudio.dev/studio/studio.html" target="_blank" rel="noopener">redlinestudio.dev</a> to publish —
the import verifies the file's seal, so save with 💾 here rather than editing the file by hand.</p>
<input type="file" id="filein" accept=".rlgame,.json,.html" style="display:none">
<script>
${sources.join("\n\n")}

// ---- the offline editor -----------------------------------------------------
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var canvas = $("#workspace"), stage = $("#stage");
  var game = { title: "", w: 480, h: 360, objects: [] };
  var selectedId = null, engine = null, controls = null, term = null, casino = null, clip = null;
  var dragging = null, snapOn = false;
  try { snapOn = localStorage.getItem("rl_off_snap") === "1"; } catch (e) {}

  var hist = createHistory(60);
  var snap = function () { return JSON.stringify({ o: game.objects, w: game.w, h: game.h, sel: selectedId }); };
  var commitTimer = null;
  function saveDraft() {
    try { localStorage.setItem("rl_off_draft", packGame(game)); } catch (e) {}
  }
  function syncUndo() { $("#undo").disabled = !hist.canUndo(); $("#redo").disabled = !hist.canRedo(); }
  function commit() { hist.commit(snap()); saveDraft(); syncUndo(); }
  function commitSoon() { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 500); }
  function applySnap(s) {
    var st = JSON.parse(s);
    game.objects = st.o; game.w = st.w; game.h = st.h;
    selectedId = st.sel;
    applyDims(); renderAll(); saveDraft(); syncUndo();
  }
  function undo() { if (engine) return; var s = hist.undo(snap()); if (s) applySnap(s); }
  function redo() { if (engine) return; var s = hist.redo(snap()); if (s) applySnap(s); }
  $("#undo").addEventListener("click", undo);
  $("#redo").addEventListener("click", redo);

  function selObj() { for (var i = 0; i < game.objects.length; i++) if (game.objects[i].id === selectedId) return game.objects[i]; return null; }
  function uniqueName(base) {
    var names = {}; game.objects.forEach(function (o) { names[o.name] = 1; });
    var n = 1; while (names[base + n]) n++; return base + n;
  }
  function applyDims() {
    canvas.width = game.w * 2; canvas.height = game.h * 2;
    canvas.getContext("2d").setTransform(2, 0, 0, 2, 0, 0);
    canvas.style.aspectRatio = game.w + " / " + game.h;
    $("#worldsize").value = game.w + "x" + game.h;
  }
  function redraw() {
    if (engine) return;
    drawFrame(canvas.getContext("2d"), game.objects, { selectedIds: selectedId ? [selectedId] : [], w: game.w, h: game.h });
    var ctx = canvas.getContext("2d");
    if (snapOn) {
      ctx.save(); ctx.fillStyle = "rgba(57,255,94,0.18)";
      for (var gx = GRID; gx < game.w; gx += GRID) for (var gy = GRID; gy < game.h; gy += GRID) ctx.fillRect(gx - 0.5, gy - 0.5, 1.5, 1.5);
      ctx.restore();
    }
    if (game.objects.length === 0) {
      ctx.save(); ctx.font = '13px "Courier New", monospace'; ctx.textAlign = "center"; ctx.fillStyle = "#3f7a52";
      ctx.fillText("THIS IS YOUR GAME SCREEN — add objects on the left", game.w / 2, game.h / 2);
      ctx.restore();
    }
  }
  function renderExplorer() {
    var list = $("#objlist"); list.innerHTML = "";
    game.objects.forEach(function (o) {
      var row = document.createElement("div");
      row.className = "row" + (o.id === selectedId ? " sel" : "");
      var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = o.name;
      var ty = document.createElement("span"); ty.className = "ty"; ty.textContent = o.type;
      var dup = document.createElement("button"); dup.className = "blk-mini"; dup.textContent = "⧉";
      dup.addEventListener("click", function (e) { e.stopPropagation(); addCopy(o); });
      var del = document.createElement("button"); del.className = "blk-mini blk-del"; del.textContent = "✕";
      del.addEventListener("click", function (e) { e.stopPropagation(); deleteObj(o); });
      row.appendChild(nm); row.appendChild(ty); row.appendChild(dup); row.appendChild(del);
      row.addEventListener("click", function () { select(o.id); });
      list.appendChild(row);
    });
    if (!game.objects.length) list.innerHTML = '<p class="hint">No objects yet.</p>';
  }
  function renderProps() {
    var body = $("#props"); var o = selObj();
    if (!o) { body.className = "hint"; body.textContent = "Select an object."; return; }
    body.className = ""; body.innerHTML = "";
    function field(lab, input) { var l = document.createElement("label"); l.textContent = lab; body.appendChild(l); body.appendChild(input); }
    function num(prop) {
      var i = document.createElement("input"); i.type = "number"; i.value = o[prop];
      i.addEventListener("input", function () { o[prop] = Number(i.value) || 0; redraw(); commitSoon(); });
      return i;
    }
    function txt(prop) {
      var i = document.createElement("input"); i.type = "text"; i.value = o[prop] == null ? "" : o[prop]; i.spellcheck = false;
      i.addEventListener("input", function () { o[prop] = i.value; renderExplorer(); redraw(); commitSoon(); });
      return i;
    }
    field("Name", txt("name")); field("X", num("x")); field("Y", num("y"));
    field("Size", num("size")); field("Angle", num("angle"));
    var cr = document.createElement("div"); cr.className = "colorrow";
    var ct = txt("color"); ct.style.flex = "1";
    var cp = document.createElement("input"); cp.type = "color";
    cp.value = /^#[0-9a-fA-F]{6}$/.test(String(o.color)) ? o.color : "#39ff5e";
    cp.addEventListener("input", function () { o.color = cp.value; ct.value = cp.value; redraw(); commitSoon(); });
    cr.appendChild(ct); cr.appendChild(cp);
    field("Color", cr);
    field("Glow", num("glow"));
    if (o.type === "text") field("Text", txt("text"));
    var lr = document.createElement("div"); lr.className = "layerrow";
    function mv(lab, fn) {
      var b = document.createElement("button"); b.className = "mini"; b.textContent = lab;
      b.addEventListener("click", function () { fn(); renderAll(); commit(); });
      lr.appendChild(b);
    }
    var idx = function () { return game.objects.indexOf(o); };
    mv("⤒", function () { game.objects.splice(idx(), 1); game.objects.push(o); });
    mv("↑", function () { var i = idx(); if (i < game.objects.length - 1) { game.objects.splice(i, 1); game.objects.splice(i + 1, 0, o); } });
    mv("↓", function () { var i = idx(); if (i > 0) { game.objects.splice(i, 1); game.objects.splice(i - 1, 0, o); } });
    mv("⤓", function () { game.objects.splice(idx(), 1); game.objects.unshift(o); });
    mv("⌖", function () { o.x = Math.round(game.w / 2); o.y = Math.round(game.h / 2); });
    field("Layer & position", lr);
  }
  function renderScript() {
    var mount = $("#scripted"); var o = selObj();
    if (!o) { $("#scripttitle").textContent = "Script"; mount.className = "hint"; mount.textContent = "Select an object to edit its script."; return; }
    $("#scripttitle").textContent = "Script — " + o.name;
    mount.className = ""; mount.innerHTML = "";
    o.script = o.script || [];
    createBlockEditor(mount, o.script, { onChange: commitSoon });
  }
  function renderAll() { renderExplorer(); renderProps(); renderScript(); redraw(); }
  function select(id) { selectedId = id; renderAll(); }

  function addCopy(src) {
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = "o" + Date.now().toString(36) + Math.floor(Math.random() * 1e6);
    copy.name = uniqueName(copy.name.replace(/\\d+$/, "") || copy.type);
    copy.x = Math.min((Number(copy.x) || 0) + 24, game.w - 10);
    copy.y = Math.min((Number(copy.y) || 0) + 18, game.h - 10);
    game.objects.push(copy); select(copy.id); commit();
  }
  function deleteObj(o) {
    game.objects = game.objects.filter(function (x) { return x.id !== o.id; });
    if (selectedId === o.id) selectedId = null;
    renderAll(); commit();
  }

  document.querySelectorAll("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var o = makeObject(btn.dataset.add, uniqueName(btn.dataset.add), game.w / 2, game.h / 2);
      game.objects.push(o); select(o.id); commit();
    });
  });

  // canvas: click-select + drag (with snap)
  function canvasPos(e) {
    var r = canvas.getBoundingClientRect();
    var scale = Math.min(r.width / game.w, r.height / game.h) || 1;
    return { x: (e.clientX - r.left - (r.width - game.w * scale) / 2) / scale,
             y: (e.clientY - r.top - (r.height - game.h * scale) / 2) / scale };
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (engine) return;
    e.preventDefault();
    var p = canvasPos(e);
    for (var i = game.objects.length - 1; i >= 0; i--) {
      var o = game.objects[i];
      if (Math.hypot(o.x - p.x, o.y - p.y) <= Math.max(14, Number(o.size) || 10)) {
        select(o.id); dragging = { obj: o, dx: o.x - p.x, dy: o.y - p.y }; return;
      }
    }
    select(null);
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging || engine) return;
    var p = canvasPos(e);
    dragging.obj.x = snapCoord(p.x + dragging.dx, snapOn);
    dragging.obj.y = snapCoord(p.y + dragging.dy, snapOn);
    renderProps(); redraw();
  });
  window.addEventListener("pointerup", function () { if (dragging) { dragging = null; commit(); } });

  var snapBtn = $("#snap");
  function syncSnap() { snapBtn.textContent = snapOn ? "snap on" : "snap off"; }
  snapBtn.addEventListener("click", function () {
    snapOn = !snapOn; try { localStorage.setItem("rl_off_snap", snapOn ? "1" : "0"); } catch (e) {}
    syncSnap(); redraw();
  });
  syncSnap();

  // keyboard: undo/redo/dup/copy/paste/delete/nudge
  window.addEventListener("keydown", function (e) {
    if (engine) return;
    var tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), o = selObj();
    if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && k === "d") { if (o) { e.preventDefault(); addCopy(o); } return; }
    if (mod && k === "c") { if (o) clip = JSON.parse(JSON.stringify(o)); return; }
    if (mod && k === "v") { if (clip) { e.preventDefault(); addCopy(clip); } return; }
    if ((e.key === "Delete" || e.key === "Backspace") && o) { e.preventDefault(); deleteObj(o); return; }
    if (o && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) >= 0) {
      e.preventDefault();
      var step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") o.x -= step;
      if (e.key === "ArrowRight") o.x += step;
      if (e.key === "ArrowUp") o.y -= step;
      if (e.key === "ArrowDown") o.y += step;
      renderProps(); redraw(); commitSoon();
    }
  });

  // behaviors
  var behsel = $("#behsel");
  BEHAVIORS.forEach(function (b) {
    var opt = document.createElement("option"); opt.value = b.id; opt.textContent = b.name; behsel.appendChild(opt);
  });
  behsel.addEventListener("change", function () {
    var id = behsel.value; behsel.value = "";
    if (!id || engine) return;
    var o = selObj();
    if (!o) { alert("Select an object first."); return; }
    var b = getBehavior(id), target;
    if (b.needsTarget) {
      var others = game.objects.filter(function (x) { return x.id !== o.id; }).map(function (x) { return x.name; });
      target = prompt('Which object should "' + o.name + '" aim at?', others[0] || "target1");
      if (target == null) return;
      target = target.trim() || others[0] || "target1";
    }
    applyBehavior(o, id, target);
    renderScript(); commit();
  });

  // world size
  $("#worldsize").addEventListener("change", function () {
    if (engine) { applyDims(); return; }
    var p = $("#worldsize").value.split("x");
    game.w = Number(p[0]); game.h = Number(p[1]);
    applyDims(); redraw(); commit();
  });

  // ▶ Test
  $("#test").addEventListener("click", function () {
    if (engine) {
      engine.stop(); engine = null;
      if (controls) { controls.destroy(); controls = null; }
      if (term) { term.destroy(); term = null; }
      if (casino) { casino.destroy(); casino = null; }
      $("#test").textContent = "▶ Test";
      applyDims(); redraw(); return;
    }
    engine = new Engine(canvas, game.objects, { w: game.w, h: game.h });
    if (engine.errors.length) alert("Script problems:\\n" + engine.errors.slice(0, 4).join("\\n"));
    if (engine.usesCasino()) casino = attachCasinoLoop(engine, localWallet(100, 1000));
    engine.start();
    controls = createTouchControls(engine, stage);
    term = attachTerminalInput(engine, stage);
    $("#test").textContent = "■ Stop";
  });

  // 💾 Save (.rlgame, sealed) / 📂 Open (.rlgame or an exported game .html)
  $("#save").addEventListener("click", function () {
    game.title = $("#title").value || "Untitled Game";
    var blob = new Blob([packGame(game)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (game.title.replace(/[^\\w\\- ]+/g, "").trim() || "my-game") + ".rlgame";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("#open").addEventListener("click", function () { $("#filein").click(); });
  $("#filein").addEventListener("change", function () {
    var f = $("#filein").files[0];
    $("#filein").value = "";
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var text = String(rd.result);
        if (/^\\s*</.test(text)) {
          var inner = extractFromHtml(text);
          if (!inner) throw new Error("That HTML file doesn't carry a RedlineStudio game inside.");
          text = inner;
        }
        var g = unpackGame(text);
        game = { title: g.title, w: g.w || 480, h: g.h || 360, objects: g.objects };
        $("#title").value = game.title;
        selectedId = game.objects[0] ? game.objects[0].id : null;
        applyDims(); renderAll();
        hist.seed(snap()); syncUndo(); saveDraft();
      } catch (err) { alert(err.message); }
    };
    rd.readAsText(f);
  });
  $("#new").addEventListener("click", function () {
    if (!confirm("Start a new empty game? (↶ undo can bring this one back.)")) return;
    game = { title: "", w: 480, h: 360, objects: [] };
    $("#title").value = ""; selectedId = null;
    applyDims(); renderAll(); commit();
  });
  $("#title").addEventListener("input", function () { game.title = $("#title").value; saveDraft(); });

  // recover the autosaved draft
  try {
    var d = localStorage.getItem("rl_off_draft");
    if (d) {
      var g0 = unpackGame(d);
      game = { title: g0.title, w: g0.w || 480, h: g0.h || 360, objects: g0.objects };
      $("#title").value = game.title === "Untitled Game" ? "" : game.title;
      selectedId = game.objects[0] ? game.objects[0].id : null;
    }
  } catch (e) {}
  applyDims();
  hist.seed(snap()); syncUndo();
  renderAll();
})();
</script>
</body>
</html>`;
}

export async function downloadOfflineStudio(rootPath = "") {
  const html = await buildOfflineStudioHtml({ rootPath });
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "RedlineStudio-offline.html";
  a.click();
  URL.revokeObjectURL(a.href);
}

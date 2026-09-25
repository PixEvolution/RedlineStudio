// tour.js — the 🎓 Studio tutorial: a guided walk through every panel, written
// for someone who has never touched game development. Each step spotlights one
// piece of the Studio and says what it's for in plain words. Skippable any
// time, restartable forever from the 🎓 button.

export const TOUR_STEPS = [
  {
    sel: "#workspace",
    title: "This is your game's screen",
    text: "Everything you make happens on this glass. A game is just objects on this screen plus little scripts that move them. You'll have something moving here in about a minute."
  },
  {
    sel: ".add-obj-row",
    title: "Add your first object",
    text: "Games are made of objects: dots, rings, boxes, lines, text and ships. Click any of these to drop one onto the screen. (After the tour, start with + Dot.)"
  },
  {
    sel: "#obj-list",
    title: "The Explorer",
    text: "Every object you add is listed here. Click one to select it, ✕ deletes it, ⧉ duplicates it, and the checkboxes gather objects to save together as a Model."
  },
  {
    sel: "#props",
    title: "Properties",
    text: "The selected object's dials: where it is (x/y), how big, what color, how much CRT glow. Change a number and watch the screen — nothing here can break."
  },
  {
    sel: "#script-panel",
    title: "Scripts — where objects come alive",
    text: "A script is a list of WHEN this happens → DO that. You build it from blocks — no typing, no code. Anything blocks can do, typed code can also do (they're the same language), but you never need to type a line."
  },
  {
    sel: "#sel-behavior",
    title: "Behaviors — instant game logic",
    text: "The fastest start: pick a ready-made behavior — Move with keys, Bounce, Chase, Score on touch — and it drops working blocks into the selected object. Open them, read them, change the numbers. That's how you learn."
  },
  {
    sel: "#btn-test",
    title: "Test — play it right now",
    text: "▶ Test runs your game on the spot; press it again to stop and keep editing. Test constantly — tweak a number, Test, tweak, Test. That's the whole craft."
  },
  {
    sel: "#sel-example",
    title: "Steal from the masters",
    text: "The Studio ships with the entire prehistory of video games, 1947–1974, rebuilt from these same blocks. Load Pong, click its objects, read its scripts — every trick in every machine is yours to take."
  },
  {
    sel: "#btn-toblocks",
    title: "One language, two views",
    text: "Blocks and code are the SAME language, and these buttons prove it: 🧱 To blocks unfolds any script's code into real blocks, 📜 To code prints blocks as text. Load an example, select its brain object, hit 🧱 — and read a real 1970s machine as blocks you can drag."
  },
  {
    sel: "#game-settings",
    title: "Game settings",
    text: "Your game's card description, its price per play (coins go to YOU), its screen size, how many players share the machine (2–8 = online multiplayer), and its arcade screen."
  },
  {
    sel: "#btn-publish",
    title: "Save & publish",
    text: "💾 Save puts your game on the Games page for everyone, live in seconds. Pick Unlisted in the settings to keep it private while you build across days."
  },
  {
    sel: "#btn-download",
    title: "Yours to keep",
    text: "⬇ Download bundles your game into ONE file that runs offline anywhere — even on itch.io. Games you publish here also earn ★ high-score tables and coins automatically."
  },
  {
    sel: "#btn-undo",
    title: "Impossible to break",
    text: "↶ ↷ undo and redo every change (Ctrl+Z / Ctrl+Y). Arrow keys nudge the selected object, Delete removes it, Ctrl+D duplicates, Ctrl+C/V copies — and the Studio autosaves a draft as you work, so a closed tab loses nothing. Experiment fearlessly."
  },
  {
    sel: null,
    title: "That's the whole Studio",
    text: "Now make something: add a Dot, give it 🕹 Move, hit ▶ Test. When you want more, the Coding Guide starts from absolute zero and goes all the way to online 3D — it's in the top menu. Replay this tour any time with 🎓."
  }
];

export function startTour(onDone) {
  // one spotlight hole (its giant shadow dims everything else) + one bubble
  const hole = document.createElement("div");
  hole.className = "tour-hole";
  const bubble = document.createElement("div");
  bubble.className = "tour-bubble";
  document.body.append(hole, bubble);
  let i = 0;

  const finish = () => {
    hole.remove();
    bubble.remove();
    window.removeEventListener("resize", position);
    try { localStorage.setItem("rl_tour_done", "1"); } catch {}
    if (onDone) onDone();
  };

  const stepTarget = () => {
    const s = TOUR_STEPS[i];
    if (!s.sel) return null;
    const el = document.querySelector(s.sel);
    return (el && el.getBoundingClientRect().width) ? el : null;
  };

  const position = () => {
    const el = stepTarget();
    if (el) {
      const r = el.getBoundingClientRect();
      hole.style.display = "block";
      hole.style.left = (r.left - 6) + "px";
      hole.style.top = (r.top - 6) + "px";
      hole.style.width = (r.width + 12) + "px";
      hole.style.height = (r.height + 12) + "px";
      // bubble below the target, or above when there's no room
      const below = r.bottom + 190 < window.innerHeight;
      bubble.style.left = Math.max(8, Math.min(window.innerWidth - 328, r.left)) + "px";
      bubble.style.top = (below ? r.bottom + 14 : Math.max(8, r.top - bubble.offsetHeight - 14)) + "px";
    } else {
      hole.style.display = "none";
      bubble.style.left = Math.max(8, (window.innerWidth - 320) / 2) + "px";
      bubble.style.top = Math.max(8, window.innerHeight * 0.3) + "px";
    }
  };

  const show = () => {
    if (i < 0) i = 0;
    if (i >= TOUR_STEPS.length) { finish(); return; }
    const s = TOUR_STEPS[i];
    bubble.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = s.title;
    const p = document.createElement("p");
    p.textContent = s.text;
    const row = document.createElement("div");
    row.className = "tour-row";
    const count = document.createElement("span");
    count.className = "tour-count";
    count.textContent = `${i + 1} / ${TOUR_STEPS.length}`;
    const mk = (label, fn, cls = "btn btn-small btn-ghost") => {
      const b = document.createElement("button");
      b.className = cls;
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    };
    row.appendChild(count);
    if (i > 0) row.appendChild(mk("← Back", () => { i--; show(); }));
    row.appendChild(mk(i === TOUR_STEPS.length - 1 ? "Done ✓" : "Next →", () => { i++; show(); }, "btn btn-small"));
    row.appendChild(mk("✕ Skip", finish));
    bubble.append(h, p, row);
    const el = stepTarget();
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    position();
    setTimeout(position, 350);   // again once the smooth scroll settles
  };

  window.addEventListener("resize", position);
  show();
  return { stop: finish };
}

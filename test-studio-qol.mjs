// Headless test: studio quality of life — the undo/redo history and grid
// snapping (pure logic in studio-tools.js), plus the Studio wiring.
import { createHistory, snapCoord, GRID } from "./js/studio-tools.js";
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

console.log("Undo / redo (the history):");
{
  const h = createHistory();
  h.seed("A");
  check("a fresh project has nothing to undo", !h.canUndo() && !h.canRedo() && h.undo("A") === null);
  check("a no-op 'change' records nothing", h.commit("A") === false && !h.canUndo());
  h.commit("B"); h.commit("C");
  check("changes stack up", h.canUndo() && h.depth() === 2);
  check("undo steps back exactly one change", h.undo("C") === "B");
  check("undo again reaches the beginning", h.undo("B") === "A" && !h.canUndo());
  check("redo walks forward again", h.redo("A") === "B" && h.redo("B") === "C");
  check("…and stops at the newest state", h.redo("C") === null);
  h.undo("C");
  h.commit("D");
  check("a new change after undo orphans the redo line", !h.canRedo() && h.undo("D") === "B");
}
{
  const h = createHistory(3);   // tiny cap
  h.seed("s0");
  for (let i = 1; i <= 9; i++) h.commit("s" + i);
  check("the cap forgets the OLDEST steps, keeps the newest", h.depth() === 3);
  check("undo still walks the kept steps in order",
    h.undo("s9") === "s8" && h.undo("s8") === "s7" && h.undo("s7") === "s6" && h.undo("s6") === null);
}

console.log("Snap to grid:");
check(`snap lands on the ${GRID}px grid`, snapCoord(33, true) === 40 && snapCoord(9, true) === 0 && snapCoord(50, true) === 60);
check("snap off = plain pixel rounding", snapCoord(33.4, false) === 33 && snapCoord(33.6, false) === 34);
check("garbage in, zero out", snapCoord("x", true) === 0);

console.log("Unique ids (selection is BY id — duplicates select together):");
{
  const { ensureUniqueIds, poolShare } = await import("./js/studio-tools.js");
  const objs = [
    { id: "a", name: "dot1" }, { id: "a", name: "dot2" },   // duplicate id
    { name: "dot3" },                                        // missing id
    { id: "b", name: "dot4" }
  ];
  const fixed = ensureUniqueIds(objs);
  const ids = objs.map(o => o.id);
  check("two broken ids were healed", fixed === 2);
  check("every id is unique afterward", new Set(ids).size === 4);
  check("intact ids stay put", ids[0] === "a" && ids[3] === "b");
  check("names never change (names MAY repeat, ids may not)",
    objs.map(o => o.name).join() === "dot1,dot2,dot3,dot4");
  check("a clean list is untouched", ensureUniqueIds(objs) === 0);
  check("garbage in, zero out", ensureUniqueIds(null) === 0 && ensureUniqueIds([null, 7]) === 0);

  console.log("The owner's till percentages:");
  check("25/50/75% of a pool floor correctly",
    poolShare(101, 25) === 25 && poolShare(101, 50) === 50 && poolShare(101, 75) === 75 && poolShare(4, 25) === 1);
  check("empty or garbage pools give 0", poolShare(0, 50) === 0 && poolShare("x", 75) === 0 && poolShare(-40, 25) === 0);

  console.log("🧩 Player-made behaviors:");
  const { scriptStats, applyBehaviorScript } = await import("./js/studio-tools.js");
  const script = [
    { event: "tick", body: [
      { k: "if", cond: "x > 1", then: [{ k: "set", lhs: "y", value: "2" }], else: [{ k: "set", lhs: "y", value: "3" }] },
      { k: "change", lhs: "self.x", by: "1" }
    ] },
    { event: "code", source: "when start\nset z to 0\nend" }
  ];
  const st = scriptStats(script);
  check("scriptStats counts events and blocks, nested included",
    st.events === 2 && st.blocks === 5 && st.summary === "2 events · 5 blocks");
  check("an empty script is honestly empty", scriptStats([]).events === 0 && scriptStats(null).events === 0);
  const target = { name: "dot1", script: [{ event: "start", body: [] }] };
  const n = applyBehaviorScript(target, script);
  check("applying APPENDS the chunk to the object's script", n === 2 && target.script.length === 3 && target.script[0].event === "start");
  script[0].body[0].cond = "TAMPERED";
  check("…as a deep copy — the saved behavior can't be mutated from outside",
    target.script[1].body[0].cond === "x > 1");
  const bare = { name: "dot2" };
  applyBehaviorScript(bare, script);
  check("an object with no script yet grows one", bare.script.length === 2);
  check("no object = a quiet no-op", applyBehaviorScript(null, script) === 0);
}

console.log("The Studio wears it all:");
const studio = readFileSync("studio/studio.html", "utf8");
for (const [what, needle] of [
  ["↶ ↷ undo/redo buttons", 'id="btn-undo"'],
  ["⌗ snap button", 'id="btn-snap"'],
  ["keyboard shortcuts (Ctrl+Z and friends)", 'addEventListener("keydown"'],
  ["autosaved drafts", "rl_draft_v1"],
  ["the color picker", "prop-color"],
  ["layer ordering", "layer-row"],
  ["copy/paste clipboard", "Ctrl+C"],
  ["☑ All / ☐ None in the Explorer", 'id="btn-check-all"'],
  ["arrow keys walk the Explorer", "walk the Explorer list"],
  ["id healing on every bulk load", "healIds()"],
  ["the 🐞 Debug panel", 'id="debug-log"'],
  ["runtime errors reach the log", "engine.onError"],
  ["casino = fixed 18+ and 1 seat", 'id="casino-fixed"'],
  ["the rating-rules gate before a first publish", "confirmRatingRules"],
  ["the ack is stored on the ACCOUNT", "ratingsAck"],
  ["🧩 Save as behavior lives in the Script panel", 'id="btn-save-behavior"'],
  ["saved behaviors join the ✨ menu", '"my:" + m.id'],
  ["…and apply as editable script chunks", "applyBehaviorScript"],
]) check(what, studio.includes(needle));
check("the Market knows a 🧩 behavior card from a model card",
  readFileSync("market.html", "utf8").includes('m.kind === "behavior"'));
check("behaviors travel through buying like models do",
  readFileSync("js/models.js", "utf8").includes("saveBehavior")
  && readFileSync("js/models.js", "utf8").includes('kind: model.kind || "model"'));
check("the studio heals ids at every entry door (edit, import, example, draft, page)",
  (studio.match(/healIds\(\)/g) || []).length >= 5);
check("every mutation commits to history", (studio.match(/commit\(\)/g) || []).length >= 10);

// ROOMS: accounts publish without limit; search and sort rank the WHOLE
// arcade first, and only then is the result cut into rooms of 24
{
  const games = readFileSync("js/games.js", "utf8");
  check("no machine limit — accounts publish freely",
    !games.includes("MAX_GAMES") && !games.includes("Machine limit reached"));
  check("the whole public arcade is fetched in cursor batches",
    games.includes("export async function listAllPublic") && games.includes("startAfter(cur)")
    && games.includes("export const ROOM_SIZE = 24"));
  const idx = readFileSync("index.html", "utf8");
  check("the Games page sorts globally, THEN slices into rooms",
    idx.includes("listAllPublic") && idx.includes("applyFilter(all, search, sort")
    && idx.indexOf("applyFilter") < idx.indexOf(".slice((roomNum - 1) * ROOM_SIZE"));
  check("door buttons walk ROOM 1 / N with both edges honest",
    idx.includes('"◀ ROOM "') && idx.includes('" / "') && idx.includes("roomNum >= last"));
  check("a new search or sort starts back at Room 1",
    idx.includes("roomNum = 1;                  // a new ranking starts at the front door"));
  check("one lonely room shows no doors at all", idx.includes("if (last <= 1) continue;"));
  check("the guide no longer claims a machine limit",
    !readFileSync("guide.html", "utf8").includes("25 machines"));
}

// the global ordering itself: thumbs-down sorts BEHIND every unrated game
{
  const { applyFilter } = await import("./js/filterbar.js");
  const list = [
    { title: "down", likes: 0, dislikes: 1 },
    { title: "fresh1" }, { title: "fresh2" },
    { title: "up", likes: 1, dislikes: 0 },
  ];
  const ranked = applyFilter(list, "", "rated", ["title"]);
  check("Top rated: thumbs-up first, unrated middle, thumbs-down dead last",
    ranked[0].title === "up" && ranked[3].title === "down");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

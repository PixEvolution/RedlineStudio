// Headless test: the COURSES system — the roadmap registry and unlock chain,
// Course 1 (CRT Amusement Device) end to end against synthetic workspaces
// (typed-code AND block form, since checks must survive 🧱 To blocks), the
// Studio's course mode, the hub, the rules, and every entry link.
import { readFileSync, existsSync } from "node:fs";
import { COURSES, courseIndex, isUnlocked } from "./js/courses.js";
import { course } from "./js/course-crt.js";
import { levelFrom } from "./js/level.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (p) => readFileSync(p, "utf8");

console.log("The roadmap:");
{
  check("58 courses: the 57 museum machines + the casino shop class", COURSES.length === 58);
  check("ids are unique and every one has a real example file on disk",
    new Set(COURSES.map(c => c.id)).size === COURSES.length
    && COURSES.every(c => existsSync(`studio/example-${c.id}.js`)));
  check("museum order holds: 1947 first, the casino last",
    COURSES[0].id === "crt" && COURSES[0].year === "1947" && COURSES.at(-1).id === "slots");
  check("exactly course 1 is written so far", COURSES.filter(c => c.ready).length === 1 && COURSES[0].ready);
  check("the chain: course 1 open to all, course 2 locked until course 1 is done",
    isUnlocked("crt", {}) && !isUnlocked("bertie", {})
    && isUnlocked("bertie", { crt: 1 }) && !isUnlocked("nimrod", { crt: 1 })
    && isUnlocked("nimrod", { crt: 1, bertie: 1 }));
  check("courseIndex finds by id", courseIndex("crt") === 0 && courseIndex("nope") === -1);
}

console.log("Course 1, second edition — shape:");
{
  check("ten chapters, no cliffs: welcome → history → no-computer → studio tour → play → brain×2 → build×2 → finish",
    course.id === "crt" && course.chapters.length === 10);
  const sc = course.chapters.filter(c => c.steps);
  check("THREE hands-on chapters (play, things, rules) with 4+4+6 verified steps",
    sc.length === 3 && sc.map(c => c.steps.length).join(",") === "4,4,6"
    && sc.every(c => c.steps.every(st => st.text && typeof st.check === "function")));
  const all = course.chapters.map(c => (c.html || "") + (c.steps || []).map(st => st.text).join("")).join("");
  check("the history is in it: Goldsmith, Mann, overlays, the defocus blast, 'no computer'",
    ["Goldsmith", "Mann", "plastic", "defocus", "no computer"].every(k => all.includes(k)));
  check("every idea gets surface AND under-the-hood: variable=box, velocity, the mood/state pattern, dist circle",
    ["Under the hood", "labeled box", "velocity", "state machine", "dist(self, target1)", "keydown"].every(k => all.includes(k)));
  check("📚 Go deeper boxes link the guide and trusted outside sources",
    all.includes("Go deeper") && all.includes("khanacademy.org") && all.includes("wikipedia.org")
    && all.includes("guide.html#recipes"));
  check("the assignment: build YOUR OWN shooter — the genre is given, the design is theirs",
    all.includes("build your own shooter") && all.includes("no single correct shooter")
    && all.includes("nothing to copy") && all.includes("now you apply it"));
  check("pattern cards show the SHAPE with the museum's numbers — no dictated program, no 'copy exactly'",
    all.includes("pattern card") && !all.includes("exactly this") && !all.includes("Replace the WHOLE"));
  check("the five shooter rules all point back at the brain chapters (apply, don't learn new)",
    all.includes("A shooter is five rules") && all.includes("keydown") && all.includes("rand(")
    && all.includes("chapters 6 and 7"));
  check("the Stop button is called what it is (▶ Test turns into ■ Stop)",
    all.includes("■ Stop") && !all.includes("(or ✕)"));
  check("the finish line: two-outfits flip, tune-one-number, the publish lap",
    all.includes("To blocks") && all.includes("Publish it") && all.includes("Bertie the Brain"));
}

console.log("Course 1 — the checks, against real workspaces:");
{
  const steps = (i) => course.chapters[i].steps;
  const PLAY = 4, THINGS = 7, RULES = 8;
  // chapter 5 (play): the museum machine, poked like the lesson asks
  const museum = {
    fresh: false, testCount: 1, published: false,
    objects: [
      { name: "missile", type: "dot", x: 40, y: 300, size: 14, color: "#ff44aa", script: [] },
      { name: "target1", type: "ring", x: 300, y: 120, script: [] }
    ]
  };
  check("PLAY: load, test, recolor, resize — all four verify on the poked museum machine",
    steps(PLAY).every(st => st.check(museum)));
  check("PLAY: the untouched museum green doesn't count as 'you recolored it'",
    !steps(PLAY)[2].check({ ...museum, objects: [{ name: "missile", type: "dot", size: 14, color: "#39ff5e" }, { name: "target1", type: "ring", y: 100 }] }));
  // A finished ORIGINAL build (the steps check ideas, not any one game):
  // "a cannon that slides, trying to hit target1" — typed code
  const codeCannon = {
    name: "cannon", type: "dot", x: 240, y: 320, color: "#ff9d4a",
    script: [{ event: "code", source: 'when start\n set flying to 0\n set score to 0\nend\nwhen key "Space"\n if flying == 0 then\n set flying to 1\n end\nend\nwhen tick\n if keydown("a") then\n change self.x by -4\n end\n if flying == 1 then\n if dist(self, target1) < 22 then\n explode target1\n change score by 1\n set target1.x to rand(60, 420)\n end\n end\nend' }]
  };
  // the same brain after 🧱 To blocks
  const blockCannon = {
    name: "cannon", type: "dot", x: 250, y: 300,
    script: [{ event: "tick", body: [
      { k: "if", cond: 'keydown("a") and flying == 0', then: [{ k: "change", lhs: "self.x", by: "-4" }], else: [] },
      { k: "if", cond: "dist(self, target1) < 22", then: [
        { k: "explode", target: "target1" },
        { k: "change", lhs: "score", by: "1" },
        { k: "set", lhs: "target1.x", value: "rand(60, 420)" }
      ], else: [] }
    ] }]
  };
  const rest = [
    { name: "title", type: "text", text: "MOON SHOT", x: 240, y: 30,
      script: [{ event: "tick", body: [{ k: "set", lhs: "endplay", value: "1" }] }] },
    { name: "target1", type: "ring", x: 300, y: 120, script: [] }
  ];
  const built = (cannon, extra = {}) => ({ objects: [...rest, cannon], fresh: true, testCount: 3, published: false, ...extra });
  check("THINGS + RULES: all 10 build steps pass on the finished build (typed code)",
    steps(THINGS).every(st => st.check(built(codeCannon)))
    && steps(RULES).every(st => st.check(built(codeCannon))));
  check("…and still pass after 🧱 To blocks (block form)",
    steps(RULES).every(st => st.check(built(blockCannon))));
  check("an empty workspace passes nothing but 'start fresh'",
    steps(THINGS).filter(st => st.check({ objects: [], fresh: true, testCount: 0 })).length === 1
    && steps(RULES).filter(st => st.check({ objects: [], fresh: true, testCount: 0 })).length === 0);
  check("naming matters: default names (dot1, ring1) don't count as a cast, and 'TEXT' isn't a title",
    !steps(THINGS)[2].check({ objects: [{ name: "title", type: "text", text: "ZAP" }, { name: "ring1", type: "ring" }, { name: "dot2", type: "dot" }], fresh: true, testCount: 0 })
    && !steps(THINGS)[1].check({ objects: [{ name: "title", type: "text", text: "TEXT" }], fresh: true, testCount: 0 })
    && steps(THINGS)[2].check({ objects: [{ name: "title", type: "text", text: "ZAP" }, { name: "frog", type: "dot" }, { name: "car1", type: "box" }], fresh: true, testCount: 0 }));
  check("the steps verify IDEAS, so a completely different take still passes (no hidden answer key)",
    (() => {
      const frog = { name: "frog", type: "dot", color: "#7dff9e",
        script: [{ event: "tick", body: [
          { k: "if", cond: 'keydown("w")', then: [{ k: "change", lhs: "self.y", by: "-3" }], else: [] },
          { k: "if", cond: "touching(self, bank)", then: [
            { k: "change", lhs: "score", by: "1" },
            { k: "set", lhs: "self.y", value: "340" },
            { k: "set", lhs: "car1.x", value: "rand(0, 480)" }
          ], else: [] }
        ] }] };
      const world = { objects: [
        { name: "title", type: "text", text: "FROG RUN" },
        { name: "bank", type: "box", script: [] },
        { name: "car1", type: "box", script: [{ event: "tick", body: [{ k: "set", lhs: "endplay", value: "timer > 60" }] }] },
        frog
      ], fresh: true, testCount: 3 };
      return steps(THINGS).every(st => st.check(world)) && steps(RULES).every((st, i) => st.check(world));
    })());
  check("ingredient ② demands the real pieces (a meeting AND a score)",
    !steps(RULES)[2].check(built({ name: "cannon", type: "dot", y: 320, x: 240, color: "#ff9d4a",
      script: [{ event: "code", source: "when tick\n change self.x by 1\nend" }] })));
  check("the test steps count real ▶ Test runs (1, 2, then 3)",
    !steps(RULES)[1].check(built(codeCannon, { testCount: 1 }))
    && steps(RULES)[5].check(built(codeCannon, { testCount: 3 })));
  check("the ending step looks for endplay on ANY object (the ⏱ behavior)",
    !steps(RULES)[4].check({ objects: [codeCannon], fresh: true, testCount: 3 }));
}

console.log("The lesson window + the Studio's course mode:");
{
  const studio = src("studio/studio.html");
  check("?course= runs the Studio on its OWN draft (normal work untouched)",
    studio.includes('get("course")') && studio.includes('"rl_draft_course_" + courseId'));
  check("the Studio obeys the lesson's commands over storage events",
    studio.includes('window.addEventListener("storage"')
    && studio.includes('"load-example"') && studio.includes('"start-fresh"')
    && studio.includes("runCmd(localStorage.getItem(CMD_KEY))"));
  check("the Studio counts ▶ Tests into the shared flags",
    studio.includes("testCount: (Number(flags().testCount) || 0) + 1"));
  check("a slim bar reopens the lesson window — no docked panel anywhere",
    studio.includes("Open the lesson window") && !studio.includes("course-panel"));
  check("the 🎒 button opens the hub from the normal studio (and hides in a course)",
    studio.includes('id="btn-courses"') && studio.includes('$("#btn-courses").style.display = "none"'));

  const win = src("course.html");
  check("course.html exists: compact, chapters, steps, its own scroll — not the Studio's",
    win.includes("lesson-nav") && win.includes("course-step") && win.includes("#lesson-body"));
  check("it verifies against the REAL workspace: the course draft + flags from storage",
    win.includes('"rl_draft_course_" + id') && win.includes("d?.scenes?.game?.objects")
    && win.includes('window.addEventListener("storage"'));
  check("its buttons steer the Studio: open/focus the named window, then queue the command",
    win.includes("rl_course_studio_") && win.includes("sendCmd") && win.includes("openStudio();"));
  check("focusing an open Studio never RELOADS it (the triple-click bug)",
    win.includes("studioWin && !studioWin.closed"));
  check("progress LATCHES (a passed step stays passed) and the chapter is remembered",
    win.includes("rl_course_steps2_") && win.includes("rl_course_ch_")
    && win.includes("STAYS passed"));
  check("steps unlock strictly IN ORDER — leftovers can't pre-tick later steps",
    win.includes("!latched.has(stepKey(ci, i - 1))"));
  check("▶ Test steps are RELATIVE: only tests after the previous step count",
    win.includes("st.needsTest") && win.includes("c.testCount > base")
    && (src("js/course-crt.js").match(/needsTest: true/g) || []).length === 3);
  const blk = src("js/blocks.js");
  check("the code editor types like one: Enter keeps indentation, Tab indents",
    blk.includes("wireCodeKeys") && blk.includes('e.key === "Tab"') && blk.includes("bthen$"));
  check("a block opener types its own `end` — only when one is missing (auto-end)",
    blk.includes("AUTO-END") && blk.includes("need > have"));
  check("quotes and parens auto-close, step over, and backspace as a pair",
    blk.includes("auto-close pairs") && blk.includes("pair === '\"\"' || pair === \"()\""));
  check("the IDE chrome: line numbers + live syntax coloring over a real textarea, both studios",
    blk.includes("wireCodeEditor") && blk.includes("highlightCode")
    && blk.includes("code-gut") && blk.includes("rl-ide-css")
    && blk.includes("row.appendChild(wireCodeEditor(ta")
    && blk.includes("panel.appendChild(wireCodeEditor(ta"));
  check("completion spans every hands-on chapter, not just one",
    win.includes("stepChapters.every"));
  check("the Studio runs lesson commands without background confirm() popups",
    src("studio/studio.html").includes("ask: false") && !src("studio/studio.html").includes("Clear the workspace? (The museum"));
  check("completion lands on the account from the lesson window",
    win.includes("progApi.markDone(id)"));
  check("the chapter reads aloud with the site's voice settings",
    win.includes('wireSpeaker($("#les-speak")'));
}

console.log("The hub, the rules, the doors in:");
{
  const hub = src("courses.html");
  check("the hub renders the ladder with the chain honest",
    hub.includes("isUnlocked") && hub.includes("finish the one before") && hub.includes("being written"));
  check("Start opens the lesson in its own little window",
    hub.includes('window.open("course.html?c="'));
  const rules = src("firestore.rules");
  check("rules: /progress is owner-written, one shape, world-readable",
    rules.includes("match /progress/{uid}")
    && rules.includes("hasOnly(['courses'])")
    && rules.includes("request.resource.data.courses is map"));
  check("all three doors exist: Studio 🎒, Guide, Museum (twice)",
    src("guide.html").includes("courses.html")
    && (src("museum.html").match(/courses\.html/g) || []).length >= 2);
  check("the privacy policy discloses course progress", src("privacy.html").includes("Course progress"));
  check("the sitemap carries courses.html", src("sitemap.xml").includes("/courses.html"));
}

console.log("⭐ Player level — the courses ARE the leveling game:");
{
  check("level = 1 + courses completed: everyone starts at 1, course 1 makes you level 2",
    levelFrom(null) === 1 && levelFrom({}) === 1 && levelFrom({ crt: 1 }) === 2
    && levelFrom({ crt: 1, bertie: 1, nimrod: 1 }) === 4);
  check("the full ladder tops out at level " + (COURSES.length + 1) + " — and grows with every course written",
    levelFrom(Object.fromEntries(COURSES.map(c => [c.id, 1]))) === COURSES.length + 1);
  const lvl = src("js/level.js");
  check("the level is COMPUTED from /progress, never stored — two public reads, so it can't be faked",
    lvl.includes('doc(db, "users"') && lvl.includes('doc(db, "progress"') && !lvl.includes("setDoc"));
  check("lookups cache per page and ten minutes in the browser",
    lvl.includes("inflight") && lvl.includes("rl_lvl_") && lvl.includes("10 * 60 * 1000"));
  check("unknown user / offline shows NOTHING rather than a guess",
    lvl.includes("return 0") && lvl.includes("if (!n) return;"));
  check("the format is Victor's: username, space, number (the number a shade dimmer)",
    lvl.includes('" " + n') && lvl.includes("opacity:.75"));
  const WIRED = [
    ["js/ui.js", "the nav bar's own name"],
    ["js/social.js", "comment authors"],
    ["js/scores.js", "high-score tables"],
    ["forums.html", "forum threads and posts"],
    ["profiles.html", "the players directory"],
    ["profile.html", "the profile page itself"],
    ["play.html", "the game's owner"],
    ["market.html", "market listings"],
    ["account.html", "the account page"]
  ];
  for (const [f, what] of WIRED) check(`levels ride beside names: ${what}`, src(f).includes("wireLevel"));
  check("forums tag all three name spots (thread list, thread head, every post)",
    (src("forums.html").match(/wireLevel\(/g) || []).length >= 3);
  const hub = src("courses.html");
  check("the hub says your level and what the next course makes you",
    hub.includes("You're level") && hub.includes("to reach level") && hub.includes("→ level"));
  check("the hub teaches the rule: +1 per course, no shortcuts",
    hub.includes("leveling game") && hub.includes("+1 level"));
  check("finishing a course is a ⭐ LEVEL UP in the lesson window",
    src("course.html").includes("LEVEL UP — you're level") && src("course.html").includes("levelFrom"));
  check("the privacy policy discloses the public level", src("privacy.html").includes("player level"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

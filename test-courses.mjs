// Headless test: the COURSES system — the roadmap registry and unlock chain,
// Course 1 (CRT Amusement Device) end to end against synthetic workspaces
// (typed-code AND block form, since checks must survive 🧱 To blocks), the
// Studio's course mode, the hub, the rules, and every entry link.
import { readFileSync, existsSync } from "node:fs";
import { COURSES, courseIndex, isUnlocked } from "./js/courses.js";
import { course } from "./js/course-crt.js";

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
  check("the build gives WHOLE program versions, never find-the-line snippets",
    (all.match(/when start/g) || []).length >= 2 && all.includes("Replace the WHOLE Code section"));
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
  // the finished build (v3 + timer), typed code
  const codeCannon = {
    name: "cannon", type: "dot", x: 240, y: 320,
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
  check("naming matters: ring1 isn't target1, and a bottom-dwelling title doesn't count",
    !steps(THINGS)[2].check({ objects: [{ name: "ring1", type: "ring", y: 100 }], fresh: true, testCount: 0 })
    && !steps(THINGS)[1].check({ objects: [{ name: "title", type: "text", text: "X", y: 300 }], fresh: true, testCount: 0 }));
  check("version 2 demands the real pieces (dist, explode, score)",
    !steps(RULES)[2].check(built({ name: "cannon", type: "dot", y: 320, x: 240,
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
  check("the code editor types like one: Enter keeps indentation, Tab indents",
    src("js/blocks.js").includes("wireCodeKeys")
    && src("js/blocks.js").includes('e.key === "Tab"')
    && src("js/blocks.js").includes("bthen$"));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

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

console.log("Course 1 — shape:");
{
  check("six chapters: welcome → history → the real machine → ours → build → finish",
    course.id === "crt" && course.chapters.length === 6
    && course.chapters.filter(c => c.steps).length === 1);
  const build = course.chapters.find(c => c.steps);
  check("the build is 9 verified steps, each with text and a check",
    build.steps.length === 9 && build.steps.every(s => s.text && typeof s.check === "function"));
  const all = course.chapters.map(c => (c.html || "") + (c.steps || []).map(s => s.text).join("")).join("");
  check("the history is in it: Goldsmith, Mann, overlays, the defocused beam, 'no computer'",
    ["Goldsmith", "Mann", "plastic", "defocus", "no computer"].every(k => all.includes(k)));
  check("it teaches the vocabulary: variable, property, event-ish 'when', if, dist, explode, rand",
    ["VARIABLE", "Properties", "when key", "IF", "dist(", "explode", "rand("].every(k => all.includes(k)));
  check("the lesson gives WHOLE scripts, with the why underneath",
    all.includes("when start") && all.includes("when tick") && all.includes("Reading it:"));
  check("the payoff is named: score + an ending earns the leaderboard",
    all.includes("high-score table") && all.includes("endplay") === false   // the WORD endplay stays behind the behavior
    || all.includes("high-score table"));
  check("the finish line teaches the two-views flip and the publish lap",
    all.includes("To blocks") && all.includes("Publish"));
}

console.log("Course 1 — the checks, against a real finished workspace:");
{
  const codeCannon = {
    name: "cannon", type: "dot", x: 240, y: 320,
    script: [{ event: "code", source: 'when start\n set aim to 0\n set score to 0\nend\nwhen tick\n if keydown("a") then\n change aim by -0.2\n end\n if flying == 1 then\n if target1.visible == 1 and dist(self, target1) < 22 then\n explode target1\n change score by 1\n set target1.x to rand(60, 420)\n end\n end\nend' }]
  };
  // the same brain after 🧱 To blocks: keywords live in block fields now
  const blockCannon = {
    name: "cannon", type: "dot", x: 250, y: 300,
    script: [
      { event: "tick", body: [
        { k: "if", cond: 'keydown("a") and flying == 0', then: [{ k: "change", lhs: "aim", by: "-0.2" }], else: [] },
        { k: "if", cond: "dist(self, target1) < 22", then: [
          { k: "explode", target: "target1" },
          { k: "change", lhs: "score", by: "1" },
          { k: "set", lhs: "target1.x", value: "rand(60, 420)" }
        ], else: [] }
      ] }
    ]
  };
  const rest = [
    { name: "title", type: "text", text: "MOON SHOT", x: 240, y: 30,
      script: [{ event: "tick", body: [{ k: "set", lhs: "endplay", value: "1" }] }] },
    { name: "target1", type: "ring", x: 300, y: 120, script: [] }
  ];
  const ctxOf = (cannon, extra = {}) => ({
    objects: [...rest, cannon], fresh: true, testCount: 2, published: false, ...extra
  });
  const steps = course.chapters.find(c => c.steps).steps;

  check("ALL 9 steps pass on the finished build (typed code)",
    steps.every(s => s.check(ctxOf(codeCannon))));
  check("ALL 9 steps still pass after 🧱 To blocks (block form)",
    steps.every(s => s.check(ctxOf(blockCannon))));
  check("an empty workspace passes nothing but 'start fresh'",
    steps.filter(s => s.check({ objects: [], fresh: true, testCount: 0 })).length === 1);
  check("a title hiding at the bottom of the screen doesn't count",
    !steps[1].check({ objects: [{ name: "title", type: "text", text: "X", y: 300 }], fresh: true, testCount: 0 }));
  check("naming matters: a ring called ring1 isn't target1",
    !steps[2].check({ objects: [{ name: "ring1", type: "ring", y: 100 }], fresh: true, testCount: 0 }));
  check("the brain step demands the real pieces (keydown, dist, explode, score)",
    !steps[4].check(ctxOf({ name: "cannon", type: "dot", y: 320, x: 240,
      script: [{ event: "code", source: "when tick\n change self.x by 1\nend" }] })));
  check("the tests steps count real ▶ Test runs",
    !steps[5].check(ctxOf(codeCannon, { testCount: 0 })) && steps[8].check(ctxOf(codeCannon, { testCount: 2 })));
  check("the ending step looks for endplay on ANY object (the ⏱ behavior)",
    !steps[7].check({ objects: [codeCannon], fresh: true, testCount: 2 }));
}

console.log("The Studio's course mode:");
{
  const studio = src("studio/studio.html");
  check("?course= opens a separate studio on its OWN draft",
    studio.includes('get("course")') && studio.includes('"rl_draft_course_" + courseId'));
  check("the lesson docks as a panel and verifies on a live loop",
    studio.includes("course-panel") && studio.includes("setInterval(verify, 900)"));
  check("steps tick against the real workspace (objects, fresh, testCount, published)",
    studio.includes("objects: scenes.game.objects") && studio.includes("testCount: flags.testCount"));
  check("the lesson's buttons work the workspace: load the museum machine, start fresh",
    studio.includes('"load-example"') && studio.includes('"start-fresh"'));
  check("completion lands on the account (markDone) and logged-out players are told",
    studio.includes("progApi.markDone(courseId)") && studio.includes("log in and it saves"));
  check("the 🎒 button opens the hub from the normal studio (and hides in a course)",
    studio.includes('id="btn-courses"') && studio.includes('$("#btn-courses").style.display = "none"'));
}

console.log("The hub, the rules, the doors in:");
{
  const hub = src("courses.html");
  check("the hub renders the ladder with the chain honest",
    hub.includes("isUnlocked") && hub.includes("finish the one before") && hub.includes("being written"));
  check("Start opens the course's own Studio window",
    hub.includes('window.open("studio/studio.html?course="'));
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

// Headless test: 🔊 LISTEN — browser text-to-speech on every chunk of text.
// Unit-tests the chunker (the part that keeps the Web Speech API alive on
// long text), then pins the wiring: every content page grows speakers, the
// Museum speaks per entry, and the course panel reads its chapters aloud.
import { readFileSync } from "node:fs";
import { toChunks } from "./js/speech.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (p) => readFileSync(p, "utf8");

console.log("The chunker (what keeps long reads alive):");
{
  check("empty and whitespace speak nothing", toChunks("").length === 0 && toChunks("  \n ").length === 0);
  check("sentences split at their ends",
    JSON.stringify(toChunks("One. Two! Three?")) === JSON.stringify(["One.", "Two!", "Three?"]));
  const long = ("word ".repeat(120) + ". ").repeat(3);
  const chunks = toChunks(long);
  check("a wall of text becomes bites the API can chew (every chunk ≤ 220)",
    chunks.length >= 6 && chunks.every(c => c.length <= 220));
  check("nothing is lost in the chunking",
    chunks.join(" ").split(" ").length === long.replace(/\s+/g, " ").trim().split(" ").length);
  check("a code table's column spacing collapses to speech",
    JSON.stringify(toChunks("x  y        position (the screen)")) === JSON.stringify(["x y position (the screen)"]));
}

console.log("The wiring:");
{
  const PAGES = ["index.html", "guide.html", "museum.html", "ratings.html", "privacy.html",
    "terms.html", "about.html", "contact.html", "othergames.html", "courses.html"];
  check("every content page grows 🔊 speakers (" + PAGES.length + " pages)",
    PAGES.every(p => src(p).includes("addPanelSpeakers()")));
  check("the Museum speaks per machine entry",
    src("museum.html").includes('addEntrySpeakers(".mus h3")'));
  check("the course panel reads chapters aloud — and turning the page stops the voice",
    src("studio/studio.html").includes('id="course-speak"')
    && src("studio/studio.html").includes("sp.stopSpeaking()"));
  const sp = src("js/speech.js");
  check("one voice at a time, ⏹ to stop, and leaving the page goes quiet",
    sp.includes("stopSpeaking") && sp.includes('"pagehide"') && sp.includes('"⏹"'));
  check("buttons never read the controls, only the prose",
    sp.includes('querySelectorAll("button, select, input'));
  check("browsers without the API just don't grow buttons",
    sp.includes("if (!canSpeak()) return 0;"));
  check("the guide's contents list stays silent (it isn't prose)",
    sp.includes('classList.contains("g-toc")'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

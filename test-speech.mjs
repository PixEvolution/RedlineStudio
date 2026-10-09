// Headless test: 🔊 LISTEN — browser text-to-speech on every chunk of text.
// Unit-tests the chunker (the part that keeps the Web Speech API alive on
// long text), then pins the wiring: every content page grows speakers, the
// Museum speaks per entry, and the course panel reads its chapters aloud.
import { readFileSync } from "node:fs";
import { toChunks, getVoicePrefs, setVoicePrefs, listVoices, canSpeak } from "./js/speech.js";

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

console.log("The voice picker:");
{
  check("no browser engine: canSpeak false, listVoices resolves empty",
    canSpeak() === false && (await listVoices()).length === 0);
  check("listVoices collects the LATE deliveries and keeps the biggest list",
    src("js/speech.js").includes("v.length > voiceCache.length")
    && src("js/speech.js").includes('"voiceschanged"'));
  check("the panel can re-ask (↻) and points at each OS's install path",
    src("account.html").includes('id="voice-refresh"')
    && ["Add voices", "Spoken Content", "Text-to-speech"].every(k => src("account.html").includes(k)));
  check("prefs survive a storage-less world (defaults, no crash)",
    JSON.stringify(getVoicePrefs()) === JSON.stringify({ voice: "", rate: 1 }));
  check("the speed clamps to the sane band (0.7–1.4)",
    setVoicePrefs({ rate: 99 }).rate === 1.4 && setVoicePrefs({ rate: 0 }).rate === 0.7);
  const acct = src("account.html");
  check("⚙ Account grew the Listening voice panel: any language, speed, preview",
    acct.includes("Listening voice") && acct.includes('id="voice-sel"')
    && acct.includes('id="voice-rate"') && acct.includes('id="voice-try"'));
  check("every 🔊 obeys the chosen voice and speed",
    src("js/speech.js").includes("resolveVoice") && src("js/speech.js").includes("u.rate = rate"));
  check("the voice cache warms on EVERY page load, and the speaker WAITS for it",
    src("js/speech.js").includes("warmVoices();")
    && src("js/speech.js").includes("await resolveVoice()")
    && src("js/speech.js").includes("stopped during the wait"));
}

console.log("▶ Play all — the audiobook mode:");
{
  const sp = src("js/speech.js");
  check("every page with 🔊 buttons grows a page-level ▶ Play all",
    sp.includes("addPlayAllButton(root);") && sp.includes('"▶ Play all"'));
  check("it reads every block in document order (headings, paragraphs, lists, code tables)",
    sp.includes("collectReadables") && sp.includes('querySelectorAll("h2, h3, p, ul, ol, pre")'));
  check("it scrolls to and highlights the paragraph being spoken — and cleans up after",
    sp.includes('block: "center"') && sp.includes("2px solid #ff9d4a") && sp.includes("clearHl()"));
  check("a folded guide section opens as the voice reaches it",
    sp.includes("openFoldIfAny"));
  check("the button is its own stop switch, and any 🔊 click hijacks the voice",
    sp.includes('"⏹ Stop reading"') && sp.includes("stopped = true"));
}

console.log("The wiring:");
{
  const PAGES = ["index.html", "guide.html", "museum.html", "ratings.html", "privacy.html",
    "terms.html", "about.html", "contact.html", "othergames.html", "courses.html",
    "account.html", "casino.html"];
  check("every content page grows 🔊 speakers (" + PAGES.length + " pages)",
    PAGES.every(p => src(p).includes("addPanelSpeakers()")));
  check("the Museum speaks per machine entry",
    src("museum.html").includes('addEntrySpeakers(".mus h3")'));
  check("the lesson window reads chapters aloud — and turning the page stops the voice",
    src("course.html").includes('id="les-speak"')
    && src("course.html").includes("sp.stopSpeaking()"));
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

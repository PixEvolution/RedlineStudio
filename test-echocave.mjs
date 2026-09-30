// Headless test: Echo Cave — the two-word parser (word()!), the lantern and
// the dark, every puzzle gate, and a complete perfect-500 walkthrough.
import { Engine } from "./js/engine.js";
import { buildEchocaveExample } from "./studio/example-echocave.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const out = (e) => e.termLines.join("\n");
const say = (e, t) => { e.submitAnswer(t); e.step(); e.step(); };   // answer, then the room reporter tick
const fresh = () => {
  const e = new Engine(null, buildEchocaveExample().objects);
  e.runEvents("start"); e.step(); e.step();
  return e;
};

console.log("word() — the trick this machine taught the engine:");
{
  const e = new Engine(null, [{
    id: "t", name: "t", type: "text", x: 0, y: 0, size: 1, color: "#fff", glow: 0, visible: 0, text: "",
    script: [{ event: "code", source: 'when answer\nset v to word(answer(), 1)\nset n to word(answer(), 2)\nset z to word(answer(), 9)\nend' }]
  }]);
  check("the parser compiles", e.errors.length === 0);
  e.submitAnswer("  get   brass lamp ");
  check("word(a,1) is the verb", e.vars.v === "get");
  check("word(a,2) is the noun (extra spaces ignored)", e.vars.n === "brass");
  check("past the end = empty string", e.vars.z === "");
}

console.log("Echo Cave:");
let eng = fresh();
check("compiles with zero errors", eng.errors.length === 0);
if (eng.errors.length) console.log(eng.errors.slice(0, 6));
check("this is a terminal game", eng.usesTerminal() === true);
check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
check("opens at the trailhead, banner up", out(eng).includes("ECHO CAVE") && out(eng).includes("TRAILHEAD"));
check("title card hides once the teletype starts", Number(eng.byName.title1.visible) === 0);

console.log("The parser:");
say(eng, "dance");
check("nonsense gets the two-word hint", out(eng).includes("I DON'T UNDERSTAND"));
say(eng, "go east");
check("GO EAST works (the cabin)", eng.vars.pos === 2 && out(eng).includes("RANGER CABIN"));
say(eng, "w");
check("bare single letters work too", eng.vars.pos === 1);
say(eng, "north");
check("blocked directions are refused", eng.vars.pos === 1 && out(eng).includes("CAN'T GO THAT WAY"));

console.log("Doors, dark, and the lantern:");
{
  const e = fresh();
  say(e, "s"); say(e, "s");
  check("the sinkhole and its iron door", e.vars.pos === 4 && out(e).includes("IRON DOOR"));
  say(e, "d");
  check("the locked door holds", e.vars.pos === 4);
  say(e, "unlock door");
  check("…and without the key it stays locked", e.vars.dooropen === 0 && out(e).includes("NO KEY"));
  // fetch key + lantern, come back, open up
  say(e, "n"); say(e, "n"); say(e, "e");
  say(e, "get key"); say(e, "get lamp");
  check("GET LAMP takes the lantern (synonyms work)", e.lists.iloc[1] === 99);
  say(e, "w"); say(e, "s"); say(e, "s");
  say(e, "open door");
  check("the key opens the iron door", e.vars.dooropen === 1);
  say(e, "d");
  check("below, without light, it's pitch dark", e.vars.pos === 5 && out(e).includes("PITCH DARK"));
  say(e, "light lamp");
  check("LIGHT LAMP: the stair appears", e.vars.lit === 1 && out(e).includes("STONE STAIR"));
  say(e, "off");
  // stumbling in the dark eventually kills
  let dead = false;
  for (let i = 0; i < 80 && !dead; i++) {
    say(e, i % 2 ? "s" : "n");
    if (e.vars.dead === 1) dead = true;
  }
  check("blind wandering finds the unseen ledge", dead && Number(e.vars.endplay) === 1);
  say(e, "restart");
  check("RESTART deals a fresh cave", e.vars.dead === 0 && e.vars.pos === 1);
}

console.log("The perfect 500 (full walkthrough):");
{
  const e = fresh();
  const go = (...cmds) => { for (const c of cmds) say(e, c); };
  go("e", "get key", "get lamp", "get honey", "w",          // outfit at the cabin
     "s", "s", "unlock door", "d", "light lamp", "n");      // into the echo hall
  check("the wall teaches the magic word", out(e).includes("REDLINE") && e.vars.sawword === 1);
  go("w", "get plank", "get amber");                        // the grotto
  check("plank and amber in hand", e.lists.iloc[3] === 99 && e.lists.iloc[4] === 99);
  go("s");                                                   // the tangle
  check("the tangle reads the same everywhere", out(e).includes("EACH ONE LIKE THE LAST"));
  go("s", "e", "get pearl", "w", "n", "u");                  // pearl, and out
  check("the pearl came out of the tangle", e.lists.iloc[7] === 99 && e.vars.pos === 7);
  go("e", "e", "drop plank");                                // bridge the chasm
  check("the plank becomes the bridge", e.vars.planked === 1);
  go("e", "get crown", "w", "w");                            // the crown
  go("n", "get opal", "w");                                  // lakeshore, bear den
  check("the bear guards the idol", out(e).includes("BEAR"));
  say(e, "get idol");
  check("…and takes no nonsense", e.lists.iloc[6] === 10 && out(e).includes("BAD IDEA"));
  say(e, "give honey");
  check("honey buys the bear off", e.vars.bear === 0);
  go("get idol", "e", "s");                                  // back to the hall
  say(e, "redline");
  check("the magic word blinks you to the cabin", e.vars.pos === 2);
  go("drop amber", "drop pearl", "drop crown", "drop opal");
  check("four treasures banked = 400", e.vars.score === 400 && e.vars.banked === 4);
  say(e, "drop idol");
  check("the fifth ends it: a perfect 500, endplay fires",
    e.vars.score === 500 && Number(e.vars.endplay) === 1 && out(e).includes("PERFECT 500"));
  say(e, "n");
  check("after the end, the teletype only offers RESTART", out(e).includes("TYPE RESTART"));
}

console.log("Odds and ends:");
{
  const e = fresh();
  say(e, "e"); say(e, "get lamp"); say(e, "inv");
  check("INV lists what you carry", out(e).includes("A BRASS LANTERN"));
  say(e, "score");
  check("SCORE reports the arrangement", out(e).includes("OF 500"));
  say(e, "redline");
  check("the magic word does nothing before you've read the wall", out(e).includes("NOTHING HAPPENS") && e.vars.pos === 2);
  say(e, "quit");
  check("QUIT ends the play with the score on record", Number(e.vars.endplay) === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

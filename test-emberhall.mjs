// Headless test: Emberhall (1980 style) — the two-object parser, the
// container, the kiln transform, the lock, double-scoring treasures, ranks,
// and a complete perfect-400 walkthrough.
import { Engine } from "./js/engine.js";
import { buildEmberhallExample } from "./studio/example-emberhall.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

const fresh = () => {
  const e = new Engine(null, buildEmberhallExample().objects);
  e.runEvents("start"); e.step();
  return e;
};
const say = (e, t) => { e.submitAnswer(t); e.step(); };
const out = (e) => e.termLines.join("\n");

console.log("Emberhall (1980 style):");
{
  const ex = buildEmberhallExample();
  const eng = new Engine(null, ex.objects);
  check("compiles with zero errors", eng.errors.length === 0);
  if (eng.errors.length) console.log(eng.errors.slice(0, 6));
  check("speaks the arcade contract (score + endplay)", eng.usesScoreboard());
  check("a teletype game through and through", eng.usesTerminal());
  const e = fresh();
  check("introduces itself as an ORIGINAL in the 1980 style",
    out(e).includes("EMBERHALL") && out(e).includes("ORIGINAL TEXT ADVENTURE")
    && out(e).includes("PUT THE OIL IN THE LAMP"));
  check("wakes in the foyer", e.vars.pos === 1);
}

console.log("The 1980 parser:");
{
  const e = fresh();
  say(e, "GO NORTH");
  check("GO NORTH and N both walk", e.vars.pos === 2);
  say(e, "TAKE THE BRASS LAMP");
  check("articles and adjectives step aside", e.lists.iloc[0] === 99);
  say(e, "DANCE");
  check("nonsense gets manners, not a crash", out(e).length > 0 && e.vars.pos === 2);
  // the two-object line, fully dressed
  say(e, "E");
  say(e, "TAKE FLASK");
  check("items answer to their aliases", e.lists.iloc[1] === 99);
  say(e, "PUT THE OIL IN THE LAMP");
  check("PUT X IN Y parses with every article in place", e.vars.oiled === 1
    && e.lists.iloc[1] === 0);
  say(e, "PUT SAND IN KILN");
  check("…and refuses politely when you lack the thing", out(e).includes("AREN'T CARRYING"));
}

console.log("Light is a two-step earn:");
{
  const e = fresh();
  say(e, "N");
  say(e, "D");
  check("the dark cellar bounces the lampless", e.vars.pos === 2
    && out(e).includes("PITCH DARK"));
  say(e, "TAKE LAMP");
  say(e, "LIGHT LAMP");
  check("a dry wick refuses the flame", e.vars.lit === 0 && out(e).includes("NEEDS OIL"));
  say(e, "E"); say(e, "TAKE OIL"); say(e, "PUT OIL IN LAMP"); say(e, "W");
  say(e, "LIGHT LAMP");
  check("oiled, it lights", e.vars.lit === 1);
  say(e, "D");
  check("…and the cellar opens", e.vars.pos === 9);
}

console.log("Treasures score twice, never thrice:");
{
  const e = fresh();
  say(e, "N"); say(e, "E"); say(e, "N");      // kitchen → garden
  say(e, "TAKE BEAD");
  check("taking a treasure pays its value once", e.vars.score === 15);
  say(e, "DROP BEAD");
  say(e, "TAKE BEAD");
  check("…and never again on a re-take", e.vars.score === 15);
  say(e, "SCORE");
  check("SCORE hands you the ledger and a RANK", out(e).includes("SCORE 15 OF 400")
    && out(e).includes("RANK: VISITOR"));
}

console.log("The container, the lock:");
{
  const e = fresh();
  say(e, "N"); say(e, "N");                   // library
  say(e, "N");
  say(e, "UNLOCK VAULT");
  check("no key, no vault", e.vars.vaultopen === 0);
  say(e, "N");
  check("…and the door does not argue, it just holds", e.vars.pos === 11);
  say(e, "S"); say(e, "E");                   // study
  say(e, "TAKE KEY");
  check("the key hides until the box opens", out(e).includes("DON'T SEE THAT"));
  say(e, "OPEN BOX");
  check("OPEN BOX reveals it", e.lists.iloc[4] === 6 && out(e).includes("IRON KEY"));
  say(e, "TAKE KEY"); say(e, "W"); say(e, "N");
  say(e, "UNLOCK VAULT");
  check("the key turns the lock", e.vars.vaultopen === 1);
  say(e, "N");
  check("…and the vault opens its shelves", e.vars.pos === 12);
}

console.log("The perfect 400:");
{
  const e = fresh();
  const run = ["N", "TAKE LAMP", "E", "TAKE OIL", "PUT OIL IN LAMP",
    "N", "TAKE BEAD", "E", "TAKE FIGURINE", "W", "S", "W",
    "LIGHT LAMP", "D", "TAKE SAND", "N", "PUT SAND IN KILN", "TAKE ROSE",
    "S", "U", "N", "E", "OPEN BOX", "TAKE KEY", "W", "N", "UNLOCK VAULT",
    "N", "TAKE ALL", "S", "S", "S", "W", "W", "TAKE HARP", "E"];
  for (const c of run) say(e, c);
  check("the kiln turned sand into the glass rose on the way", e.vars.kilned === 1);
  check("all six treasures in hand: the taking half banked",
    e.vars.score === 180 && e.vars.pos === 3);
  say(e, "PUT THE AMBER BEAD IN THE DISPLAY CASE");
  check("the fully-dressed deposit lands in its hollow", e.vars.ncase === 1
    && e.vars.score === 195);
  for (const c of ["PUT FIGURINE IN CASE", "PUT ROSE IN CASE", "PUT CROWN IN CASE", "PUT RING IN CASE"]) say(e, c);
  check("five hollows filled, the ledger climbing", e.vars.ncase === 5 && e.vars.score === 330);
  say(e, "PUT HARP IN CASE");
  check("the sixth lights the case: 400 of 400, endplay, the top rank",
    e.vars.score === 400 && Number(e.vars.endplay) === 1
    && out(e).includes("FINAL SCORE: 400 OF 400")
    && out(e).includes("RANK: MASTER OF EMBERHALL"));
}

console.log("RESTART:");
{
  const e = fresh();
  say(e, "N"); say(e, "TAKE LAMP");
  say(e, "RESTART");
  check("the house resets itself", e.vars.pos === 1 && e.vars.score === 0
    && e.lists.iloc[0] === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

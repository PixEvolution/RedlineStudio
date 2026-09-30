// Headless test: content ratings + the age gate, and the account-page wiring.
import { RATINGS, cleanRating, ratingInfo, bracketFromBirthdate, bracketAge, canPlay, canLinkEmail } from "./js/ratings.js";
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

console.log("The ratings:");
check("four ratings, E through Adult", RATINGS.length === 4 && RATINGS[0].id === "E" && RATINGS[3].id === "A18");
check("garbage ratings become E — never accidentally adult", cleanRating("XXX") === "E" && cleanRating(undefined) === "E");
check("only 18+ demands the verified email", RATINGS.filter(r => r.needsEmail).length === 1 && ratingInfo("A18").needsEmail);

console.log("Birth dates become brackets (and the date is discarded):");
const NOW = new Date("2026-09-25T12:00:00");
check("an adult is 18", bracketFromBirthdate("2000-01-01", NOW) === "18");
check("seventeen is 16+ — not adult", bracketFromBirthdate("2009-01-01", NOW) === "16");
check("the birthday itself counts", bracketFromBirthdate("2008-09-25", NOW) === "18"
  && bracketFromBirthdate("2008-09-26", NOW) === "16");
check("fourteen is 13+", bracketFromBirthdate("2012-05-05", NOW) === "13");
check("ten is under 13", bracketFromBirthdate("2016-05-05", NOW) === "u13");
check("nonsense dates are refused", bracketFromBirthdate("yesterday", NOW) === null
  && bracketFromBirthdate("2030-01-01", NOW) === null
  && bracketFromBirthdate("1800-01-01", NOW) === null
  && bracketFromBirthdate("2000-13-40", NOW) === null);

console.log("The gate:");
check("everyone plays E — even guests with no account", canPlay("E", null, false).ok && canPlay("E", "u13", false).ok);
check("teens content is open by default (all-ages platform)", canPlay("T13", null, false).ok);
check("…but a declared under-13 is honestly kept out of it", canPlay("T13", "u13", false).ok === false);
check("16+ without a declared age = declare first", canPlay("M16", null, false).why === "declare");
check("16+ at sixteen opens, no email needed", canPlay("M16", "16", false).ok);
check("18+ at eighteen but unverified = verify first", canPlay("A18", "18", false).why === "verify");
check("18+ verified adult walks in", canPlay("A18", "18", true).ok);
check("a sixteen-year-old with a verified email is STILL not eighteen", canPlay("A18", "16", true).why === "age");
check("email linking is 13+ only", !canLinkEmail("u13") && !canLinkEmail(null) && canLinkEmail("13") && canLinkEmail("18"));
check("bracket ages line up", bracketAge("u13") === 0 && bracketAge("13") === 13 && bracketAge(null) === null);

console.log("The wiring is really there:");
const has = (f, ...needles) => needles.every(n => readFileSync(f, "utf8").includes(n));
check("⚙ Account: delete, email, password, age", has("account.html",
  'id="btn-delete"', 'id="btn-email"', 'id="btn-pass"', 'id="btn-age"', "verifyPassword"));
check("account deletion proves the password BEFORE erasing", (() => {
  const s = readFileSync("account.html", "utf8");
  return s.indexOf("verifyPassword($(\"#del-pass\")") < s.indexOf("deleteGame(g.id)");
})());
check("auth grew the whole account API", has("js/auth.js",
  "changePassword", "linkEmail", "sendPasswordResetEmail", "deleteUser", "reauthenticateWithCredential"));
check("login page: forgot-password + terms agreement", has("login.html", 'id="forgot"', "terms.html"));
check("the Studio has the rating picker", has("studio/studio.html", 'id="g-rating"', '"A18"'));
check("games carry their rating to the database", has("js/games.js", "cleanRating"));
check("the play page gates at the door and wears the badge", has("play.html", "canPlay", "rate-badge", "gate-block"));
check("…and has the ⚑ report button", has("play.html", '"reports"'));
check("the casino announces its 18+ door", has("casino.html", "gate-block"));
check("terms of service exist and cover the load-bearing parts", has("terms.html",
  "virtual play tokens", "18+", "Michigan", "Report", "Redline Digital LLC"));
check("the rating requirements page exists and is linked where it matters", (() => {
  const r = readFileSync("ratings.html", "utf8");
  return r.includes("Rated the worst moment") || r.includes("rate UP")
    ? has("terms.html", "ratings.html") && has("js/ui.js", "ratings.html") && has("guide.html", "ratings.html")
    : false;
})());
check("the casino door: hidden nav button + hard gate on the page", has("js/ui.js", "adultCleared", "nav-casino")
  && has("casino.html", "adultCleared", "casino-wall")
  && !readFileSync("play.html", "utf8").includes('href="account.html">⚙ Account</a> to enter'));
check("privacy covers email, age brackets, children, self-serve deletion", has("privacy.html",
  "optional", "age bracket", "Children", "delete your"));
check("every page grew the legal footer", has("js/ui.js", "site-foot", "terms.html"));
check("the database enforces: age set once, self-delete allowed, reports fenced", has("firestore.rules",
  "ageBracket", "isMod() || (signedIn() && resource.data.get('uid', '') == request.auth.uid)", "/reports/"));

console.log("Moderation:");
check("mod status lives in a console-only collection", has("firestore.rules",
  "function isMod()", "match /mods/{uid}", "allow create, update, delete: if false;"));
check("mods can delete games, models, comments, threads, posts", (() => {
  const r = readFileSync("firestore.rules", "utf8");
  return (r.match(/isMod\(\) \|\| \(signedIn/g) || []).length >= 5;
})());
check("a mod's game edit is fenced to unlist + re-rate only", has("firestore.rules",
  "isMod() && changedKeys().hasOnly(['unlisted', 'rating'])"));
check("mods read and resolve reports; cheated scores can be struck", has("firestore.rules",
  "allow read: if isMod();", "// striking a cheated score"));
check("the Mod Desk exists and guards its own door", has("mods.html", "amIMod", "resolveReport", "index.html"));
check("game pages grow the 🛡 row for mods", has("play.html", "modUnlistGame", "modRateGame", "MOD DELETE"));
check("comments and forums grow the mod ✕", has("js/social.js", "amIMod") && has("forums.html", "amIMod"));
check("⚙ Account shows the uid a mod doc needs", has("account.html", "acc-uid"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

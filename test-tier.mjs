// Headless test: the October 2026 policy round — the ALL-AGES model (Victor's
// call: kids use the same open platform, Roblox-style, with quick-chat as the
// child filter and reactive moderation), the grow-up month, the bracket
// migration, the contact form, no ads for declared children, and the policy
// wording pass (dates, honest 18+ wording, rating names, realism guidance,
// response times).
import { readFileSync } from "node:fs";
import { growsFromBirthdate, growsDue, bracketFromBirthdate, canUseFreeText } from "./js/ratings.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (p) => readFileSync(p, "utf8");

console.log("Growing up — the turns-13 month, never the date:");
{
  const now = new Date("2026-10-08T12:00:00Z");
  check("a 2015 kid gets the month AFTER the 13th birthday",
    bracketFromBirthdate("2015-03-15", now) === "u13"
    && growsFromBirthdate("2015-03-15", now) === 202804);
  check("born on the 1st: that very month counts whole",
    growsFromBirthdate("2013-11-01", now) === 202611);
  check("a December birthday rolls into January",
    growsFromBirthdate("2015-12-25", now) === 202901);
  check("not a child → no month stored at all",
    growsFromBirthdate("2010-01-01", now) === null
    && growsFromBirthdate("1990-01-01", now) === null);
  check("growsDue: arrived months fire, future ones wait, junk never does",
    growsDue(202610, now) && growsDue(202501, now)
    && !growsDue(202611, now) && !growsDue(undefined, now) && !growsDue("202610", now));
  const age = src("js/age.js");
  check("age.js stores the grows month on u13 declarations only",
    age.includes('bracket === "u13" && Number.isFinite(grows)')
    && age.includes("{ ageBracket: bracket }"));
  check("age.js upgrades u13 → 13 by itself when the month arrives",
    age.includes("growsDue(a.data().grows)") && age.includes('ageBracket: "13"'));
}

console.log("The all-ages model — open floor, quick-chat as the child filter:");
{
  check("typed text is 13+; under-13 and undeclared use quick-chat",
    !canUseFreeText("u13") && !canUseFreeText(null) && canUseFreeText("13"));
  check("live.js broadcasts every seated player the same way (no age gate)",
    !src("js/live.js").includes("myBracket"));
  const floor = src("js/floor.js");
  check("floor.js: the chat panel and seat snapshot have no age gate beyond quick-chat",
    !floor.includes("playOnly") && floor.includes("freeTextAllowed"));
  check("comments, forums, market and profile pages carry no under-13 locks",
    !src("js/social.js").includes("isPlayOnly")
    && !src("forums.html").includes("play-only")
    && !src("market.html").includes("play-only")
    && !src("profile.html").includes("u13"));
  check("the Studio publishes for every account (rules too)",
    !src("studio/studio.html").includes("canPublish")
    && !src("firestore.rules").includes("isU13"));
  check("…but a declared child still sees NO ads at all",
    src("js/ads.js").includes('!== "u13"') && src("js/ads.js").includes("setAdGate"));
}

console.log("The database rules (needles):");
{
  const rules = src("firestore.rules");
  check("ages: u13 declarations may carry the grows month (int)",
    rules.includes("hasOnly(['ageBracket', 'grows'])") && rules.includes("grows is int"));
  check("ages: the ONE allowed update is u13 → 13, on the SERVER clock",
    rules.includes("resource.data.ageBracket == 'u13'")
    && rules.includes("request.time.year() * 100 + request.time.month()")
    && rules.includes("request.resource.data.ageBracket == '13'"));
  check("ages: a mod can create records for the migration",
    rules.includes("|| (isMod()\n            && request.resource.data.keys().hasOnly(['ageBracket'])"));
  check("users: the mod migration conserves the bracket in the same batch",
    rules.includes("isMod() && changedKeys().hasOnly(['ageBracket'])")
    && rules.includes("ages/$(resource.data.uid)).data.ageBracket == resource.data.ageBracket"));
  check("the inbox: anyone writes (even logged out), only mods read",
    rules.includes("match /inbox/{msgId}")
    && rules.includes("allow read: if isMod();")
    && !/inbox[\s\S]{0,400}?create: if signedIn/.test(rules)
    && rules.includes("request.resource.data.text.size() <= 1000"));
}

console.log("The migration and the inbox, in Mod Desk:");
{
  const mod = src("js/mod.js");
  check("migrateBrackets moves, clears, and counts the unmovable",
    mod.includes("export async function migrateBrackets")
    && mod.includes("deleteField()") && mod.includes("skipped++"));
  check("listInbox / resolveInbox exist",
    mod.includes("export async function listInbox") && mod.includes("export async function resolveInbox"));
  const desk = src("mods.html");
  check("Mod Desk grew the migration button and the contact inbox",
    desk.includes("btn-ages") && desk.includes("inbox-list") && desk.includes("migrateBrackets"));
}

console.log("The contact form:");
{
  const c = src("contact.html");
  check("contact.html exists, needs no account, writes /inbox",
    c.includes('addDoc(collection(db, "inbox")') && c.includes("no account needed"));
  check("it promises the policy's response times (30 / 14 days)",
    c.includes("30 days") && c.includes("14 days"));
  check("every topic the policies point here for is a choice",
    ["parent request", "privacy request", "appeal", "misrated game", "copyright"].every(t => c.includes(`value="${t}"`)));
}

console.log("The policy pass (October 2026):");
{
  const priv = src("privacy.html"), terms = src("terms.html"), rat = src("ratings.html");
  check("both documents date honestly: effective Oct 8, LLC formed Sept 28",
    priv.includes("Effective October 8, 2026") && terms.includes("Effective October 8, 2026")
    && priv.includes("September 28, 2026") && terms.includes("September 28, 2026"));
  check("'verified adult' is gone from the whole site",
    ![priv, terms, rat, src("casino.html"), src("play.html")].some(s => /verified adult/i.test(s)));
  check("18+ is stated plainly: self-declared birth date + verified email",
    priv.includes("self-declared") && terms.includes("self-declared") && rat.includes("self-declared"));
  check("the Terms name the ratings the way the site does (E · 13+ · 16+ · 18+)",
    terms.includes("E · 13+ · 16+ · 18+") && !terms.includes("M (Mature") && !terms.includes("A (Adult"));
  check("the Terms admit parental permission can't be checked — and route parents somewhere real",
    terms.includes("no way to check that permission") && terms.includes("contact.html"));
  check("the policies describe the OPEN model, not locks: no play-only tier anywhere",
    !priv.includes("play-only") && !terms.includes("play-only"));
  check("the privacy policy keeps the real safeguards: no child email, quick-chat, no child ads, grows month",
    priv.includes("cannot link an email")
    && priv.includes("fixed list of phrases")
    && priv.includes("no ads at all")
    && priv.includes("upgrades itself at 13"));
  check("…and says plainly that a child's account is public by design",
    priv.includes("a child's account is public by design"));
  check("watchers-can-be-minors is said where players read it",
    terms.includes("watchers can be any age, including minors")
    && priv.includes("watchers can be any age, including minors"));
  check("the casino clause states facts, not a legal conclusion",
    terms.includes("cannot be cashed out or exchanged for money")
    && !terms.includes("not gambling for anything of"));
  check("appeals: 14 days; parent and privacy requests: 30",
    terms.includes("appeals within 14 days") && priv.includes("within 30 days"));
  check("the DMCA section stops over-claiming and reminds the operator to register",
    terms.includes("following the\n      process of the Digital Millennium Copyright Act")
    && terms.includes("dmca.copyright.gov"));
  check("the minors line sits next to the liability cap",
    terms.includes("If you are a minor"));
  check("the ratings page: no 'ideally', realism guidance, Death Race placed",
    !rat.includes("ideally") && rat.includes("Realism is the dial") && rat.includes("Death Race"));
  check("16+ answers alcohol/smoking and draws the gore line",
    rat.includes("Alcohol and smoking may appear") && rat.includes("detailed enough to study"));
  check("16+ and 18+ carry examples like E and 13+ do",
    rat.includes("war story where hits draw red") && rat.includes("standing 18+ example"));
  check("the ratings page links report AND appeal routes",
    rat.includes("See a misrated game") && rat.includes("contact.html"));
  check("protected characters are on the always-banned list",
    rat.includes("protected characters, names and logos"));
  check("the account page discloses the under-13 unlock month",
    src("account.html").includes("month you turn 13"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

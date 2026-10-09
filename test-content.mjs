// Headless test: the static-content round for the AdSense "low value content"
// verdict — the Museum page (57 machines of real history, crawler-visible),
// the static intro on the Games page, ad code only on content pages, and the
// sitemap. Also pins the museum's one rule: mechanics are history, trademarks
// are not ours — no protected character names anywhere on the page.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (p) => readFileSync(p, "utf8");
const museum = src("museum.html");

console.log("The Museum page:");
{
  const entries = (museum.match(/<h3>/g) || []).length;
  check("57 entries covering every machine (the two Wumpuses share one)", entries === 57);
  check("every era section is anchored",
    ["before", "coinop", "cpu", "golden", "peak", "casino"].every(id => museum.includes(`id="${id}"`)));
  const names = ["CRT Amusement Device", "Bertie the Brain", "NIMROD", "Draughts", "OXO",
    "Tennis for Two", "Mouse in the Maze", "Spacewar!", "Computer Space", "Pong",
    "Hunt the Wumpus", "Gran Trak 10", "Tank", "Maze War", "Spasim", "Western Gun",
    "Gun Fight", "Breakout", "Death Race", "Echo Cave", "Night Driver", "Combat",
    "Undervault", "Space Invaders", "Galaxian", "Lunar Lander", "Asteroids", "Adventure",
    "Star Raiders", "Rally-X", "Sweeper", "Missile Command", "Battlezone", "Berzerk",
    "Rogue", "Defender", "Emberhall", "Scrapyard Climb", "Galaga", "Frogger",
    "Castle Wolfenstein", "Ultima I", "Pitfall!", "Dig Dug", "Robotron: 2084", "Cubit",
    "Pole Position", "Zaxxon", "Tron", "Redline Slots"];
  check("every machine is written up by name (" + names.length + " spot-checked)",
    names.every(n => museum.includes(n)));
  check("real substance: the page runs past 2,500 words of original text",
    museum.replace(/<[^>]*>/g, " ").split(/\s+/).length > 2500);
  check("the history is dated: 1947, 1962, 1972, 1978, 1982 all present",
    ["1947", "1962", "1972", "1978", "1982"].every(y => museum.includes(y)));
  check("protected characters stay unnamed — mechanics, not trademarks",
    !/Pac-?Man|Donkey Kong|Mario\b|Jumpman|Q\*bert|Qbert|Evil Otto|Ms\.\s?Pac|Colossal Cave|\bZork\b|Crazy Otto|\bJaws\b/i.test(museum));
  check("…while real owners may be credited where the site already does",
    museum.includes("Nintendo's") && museum.includes("Disney's") && museum.includes("Gottlieb's"));
  check("it links the Studio, the Games page and the Guide",
    museum.includes('href="studio/studio.html"') && museum.includes('href="index.html"')
    && museum.includes('href="guide.html"'));
  check("SEO head: title, description, canonical",
    museum.includes("<title>RedlineStudio — The Museum") && museum.includes('rel="canonical"')
    && museum.includes('name="description"'));
  check("the nav knows the Museum", src("js/ui.js").includes('museum.html">Museum'));
  check("the sitemap carries museum.html and contact.html",
    src("sitemap.xml").includes("/museum.html") && src("sitemap.xml").includes("/contact.html"));
}

console.log("The Games page is never blank to a crawler:");
{
  const index = src("index.html");
  check("a static intro paragraph sits above the live grid",
    index.includes("free browser arcade and a game-making studio in one")
    && index.includes('href="museum.html"'));
}

console.log("Ad code lives only on content pages:");
{
  const CONTENT = ["index.html", "museum.html", "guide.html", "about.html", "othergames.html",
    "privacy.html", "ratings.html", "terms.html"];
  const APP = ["play.html", "market.html", "forums.html", "profiles.html", "profile.html",
    "login.html", "casino.html", "contact.html", "mods.html", "account.html"];
  check("content pages carry the AdSense tag + the bottom slot",
    CONTENT.every(p => src(p).includes("adsbygoogle.js") && src(p).includes("footAd")));
  check("app-shell pages carry NO ad code at all (" + APP.length + " pages)",
    APP.every(p => { const s = src(p); return !s.includes("adsbygoogle") && !s.includes("footAd"); }));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

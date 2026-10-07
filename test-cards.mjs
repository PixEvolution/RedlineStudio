// Headless test: the CARDS collection — the light mirror that makes phone
// lists instant. The pure card shape (caps, live-screen rules), plus source
// needles pinning every sync point: publish/update/delete batches, play and
// vote and pool mirroring, mod mirroring, the backfill, the list fallback,
// the thumbnail path, and the security rules block.
import { cardFields, THUMB_CAP, LIVE_CAP } from "./js/cardfields.js";
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const src = (f) => readFileSync(f, "utf8");

console.log("Cards collection:");

// ---- the pure card shape
{
  const c = cardFields({
    title: "  My Game  ", owner: "victor", ownerUid: "u1", description: "d",
    price: "25", seats: 4, rating: "13", data: { w: 360, h: 480, objects: [{}, {}] },
    screen: { mode: "static", objects: [{ type: "box" }] }, thumb: "data:image/jpeg;base64,abc"
  });
  check("a card carries only card things — never the game's data",
    !("data" in c) && c.title === "My Game" && c.w === 360 && c.h === 480 && c.price === 25 && c.seats === 4);
  check("a STATIC screen ships as a thumbnail, not objects",
    c.screen.mode === "none" && c.screen.objects.length === 0 && c.thumb.startsWith("data:image/"));
  const live = cardFields({ title: "t", owner: "v", screen: { mode: "live", objects: [{ type: "box" }] } });
  check("a LIVE screen keeps its objects on the card", live.screen.mode === "live" && live.screen.objects.length === 1);
  const fat = cardFields({ title: "t", owner: "v", screen: { mode: "live", objects: [{ pad: "x".repeat(LIVE_CAP) }] } });
  check("an oversized live screen is downgraded (no card smuggles a game)", fat.screen.mode === "none");
  const badThumb = cardFields({ title: "t", owner: "v", thumb: "javascript:alert(1)" });
  check("a thumb must be a data:image URL", badThumb.thumb === "");
  const fatThumb = cardFields({ title: "t", owner: "v", thumb: "data:image/jpeg;base64," + "a".repeat(THUMB_CAP) });
  check("an oversized thumb is dropped, not stored", fatThumb.thumb === "");
  const cas = cardFields({ title: "t", owner: "v", casino: true, rating: "E" });
  check("casino cards are always adult-rated", cas.casino === true && cas.rating === "A18");
  const upd = cardFields({ title: "t", description: "x" });
  check("an update without owner leaves the card's owner alone", !("owner" in upd));
}

// ---- games.js: the sync points
{
  const g = src("js/games.js");
  check("publish writes game + card in ONE batch",
    g.includes("writeBatch(db)") && g.includes('batch.set(doc(db, CARDS, ref.id)') && g.includes("await batch.commit()"));
  check("update mirrors onto the card with merge (counters survive)",
    g.includes("batch.set(doc(db, CARDS, gameId)") && g.includes("{ merge: true }"));
  check("delete takes the card with the game",
    g.includes("batch.delete(doc(db, CARDS, gameId))"));
  check("deleting a CASINO machine collects its whole pool to the owner first",
    g.includes("await collectPool(gameId, g.owner, pool)")
    && g.indexOf("collectPool") < g.indexOf("batch.delete(doc(db, GAMES, gameId))")
    && g.includes("return collected"));
  check("…and the Studio tells the owner the coins came home",
    src("studio/studio.html").includes("the machine's pool came home"));
  check("countPlay increments both counters",
    g.includes('updateDoc(doc(db, CARDS, gameId), { plays: increment(1) })'));
  check("the lists read CARDS first and fall back to games pre-backfill",
    g.includes("scanPublic(CARDS, casino, cap)") && g.includes("return scanPublic(GAMES, casino, cap)"));
  check("profile pages get light per-player cards with the same fallback",
    g.includes("export async function listCardsBy") && g.includes("return listGamesBy(owner)"));
  check("the studio's My Games still gets full docs (it edits them)",
    g.includes("export async function listGamesBy"));
}

// ---- mirrors elsewhere
{
  check("votes mirror onto the card, fire-and-forget",
    src("js/social.js").includes('updateDoc(doc(db, "cards", id), { likes: out.likes, dislikes: out.dislikes }).catch'));
  const cas = src("js/casino.js");
  check("every pool move mirrors onto the card (the Biggest-pool sort lives)",
    (cas.match(/mirrorPool\(gameId, r\.pool\)/g) || []).length === 3 && cas.includes(".catch(() => {})"));
  const m = src("js/mod.js");
  check("mod unlist/re-rate mirror onto the card",
    m.includes('updateDoc(doc(db, "cards", gameId), { unlisted: !!unlisted }).catch') &&
    m.includes('updateDoc(doc(db, "cards", gameId), { rating }).catch'));
  check("the one-time backfill exists, batched and idempotent",
    m.includes("export async function backfillCards") && m.includes("writeBatch") && m.includes("renderThumb"));
  check("the Mod Desk carries the backfill button",
    src("mods.html").includes("backfillCards") && src("mods.html").includes("btn-backfill"));
}

// ---- the card face
{
  const c = src("js/cards.js");
  check("cards render the thumbnail when there are no live objects",
    c.includes("g.thumb") && c.includes('img.className = "card-screen"'));
  check("card dims read the card's own w/h (data.w stays as fallback)",
    c.includes("Number(g.w) || Number(g.data?.w)"));
  check("renderThumb is shared (studio publish + backfill use one renderer)",
    c.includes("export function renderThumb"));
  check("the studio sends a thumb with every publish",
    src("studio/studio.html").includes("payload.thumb = renderThumb(thumbSrc"));
}

// ---- the rules
{
  const r = src("firestore.rules");
  check("firestore.rules has the cards block", r.includes("match /cards/{gameId}"));
  check("card creation follows the game's owner (getAfter — same-batch safe) or a mod",
    r.includes("getAfter(/databases/$(database)/documents/games/$(gameId)).data.ownerUid == request.auth.uid"));
  check("plays update by anyone; counters by signed-in; the rest by owner/mod",
    r.includes("changedKeys().hasOnly(['plays'])") &&
    r.includes("changedKeys().hasOnly(['likes', 'dislikes', 'pool'])"));
  check("a PRE-RULES game (no ownerUid) deletes its card like it deletes itself",
    (() => {
      const cards = r.slice(r.indexOf("match /cards/"), r.indexOf("match /models/"));
      const del = cards.slice(cards.indexOf("allow delete"));
      return del.includes("!('ownerUid' in get(") && del.includes("games/$(gameId)).data)");
    })());
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

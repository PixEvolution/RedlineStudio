# Site ↔ PC Racer ↔ Emergence — reconciliation (Oct 30)

## EMERGENCE — fully matched ✓
Checked every point of the Emergence spec against the attached site files:
- **Universes**: card fields, ready flag, ≤36 parts × 200 KB, public reads, downloads +1 by anyone — the
  attached universes.js and rules section match the spec exactly. ✓
- **Sprite packs**: packs/packParts, ≤32 parts, ready flag, downloads +1 — ✓. The site's packs.js already
  validates the NEW categories too (creatures, hand items, buildings), so the expanded packs upload fine. ✓
- **Server list** (`servers`): the hash-chain design in the attached rules section is sound — each update
  must present the secret whose fingerprint the previous write published, so only the real host can update;
  anyone can clean a 15-minute-dead entry. Two practical notes: (1) creates are open to anyone by design,
  so junk entries are possible — they're size-capped and die in 15 minutes, acceptable; (2) the game must
  write `updated` as a SERVER timestamp (REST fieldTransform REQUEST_TIME), not its own clock, or every
  write is rejected.
- **Reports** from both pages → existing reports collection ✓ (Mod Desk already routes universe:/pack:).
- **Updater/downloads**: matches the new downloads.js approach (below).

## DOWNLOADS — new system adopted, two pages still on the old one
The new js/downloads.js (GitHub API, newest copy of the named exe regardless of tag) is the right design
and matches both games' updaters. Status per page:
- othergames.html ✓ · universes.html ✓ · **packs.html FIXED in this delivery** (was still a hardcoded
  "latest" link with no script).
- **pcracer.html and mods.html still carry the OLD Firestore-settings system** — pcracer.html's Get PC Racer
  button is pinned to V1.4 and its old import now fails silently; Mod Desk's "⬇ Download links" panel is dead
  (the module it used no longer exists). Attach both files and I'll switch pcracer.html to
  `data-asset="PC_Racer.exe"` + the script, and remove the obsolete Mod Desk panel. The old
  `config/downloads` rules block is harmless and can stay or go.

## PC RACER — matched, changed, and three open questions

**Matched already ✓**
- Login scheme, users doc (`username`, `uid`, `coins`), queryable by uid (automatic).
- pcrTimes: public top-25 reads, own-entry-only writes, updates must LOWER ms — all enforced.
- pcrParts fields incl. listed/ready/price/seal/parts; downloads +1 without login, exactly +1, nothing else.
- pcrPartParts: free = public read; priced = owner/buyers/mods only (game shows "buy it on the site" on 403). ✓
- pcrOwned: **now private as requested** — readable only by its owner (and mods); query by uid with the token.
- Part pages: pcracer.html?id=<partId> ✓.

**Changed in pcracer_rules_section.txt (replace the whole PC Racer region, pcrTimes → pcrOwned):**
1. Board ids now accept the game's new scheme: `drag_<feet>`, `wp_<class>_<feet>` (classes pinned),
   `track_<slug>_<laps>`. Old names (eighth/quarter/…) no longer accepted — ship these rules together with
   the exe that writes the new ids.
2. pcrOwned reads tightened from public to owner+mod.

**Site page/module updates still needed once files are attached:** the leaderboard pickers on pcracer.html
read their board ids from js/pcracer.js — those constants must become the new ids. Swap in js/pcracer.js:
```js
export const DRAG_TRACKS = [
  ["drag_1320", "¼ mile · 1320 ft"],
  ["drag_660", "⅛ mile · 660 ft"],
  ["drag_1000", "1000 ft"],
  ["drag_2640", "½ mile · 2640 ft"],
  ["drag_5280", "1 mile · 5280 ft"]
];
```
(wp/track picker code stays; track ids already build as track_<slug>_<laps>.)

**OPEN QUESTIONS — paste these to the PC Racer chat:**
1. **Part kinds — this one blocks the parts store.** The site validates uploads hard: `kind` must be
   `body` / `rim` / `tire`, body = 160×64 pixels map + front/rear + drive, rim = diameter 15–22 + spokes +
   base + pixels, tire = diameter + profile + base + pixels, seal = sha256 of the part JSON's literal bytes,
   first 32 hex. Your spec says "cars, wheels, exhausts." Send the EXACT `kind` strings and the exact shape
   of each (especially anything new like exhausts), and the site's checker + rules get updated to match.
   Until then, only body/rim/tire files upload.
2. **The exact drag feet list and track slugs** the game writes, so the site's leaderboard pickers list
   every real board (the rules accept the whole pattern either way — this is just so no board is invisible
   on the site).
3. **The listed+ready composite index**: equality-only queries often work without one. Run the store query
   once from the game; if Firestore refuses, the error message contains a one-click index-creation link —
   send it to Victor to click. No guessing needed.
4. **pcrServers** (multiplayer): not built yet, as you said. When ready it'll copy the Emergence `servers`
   hash-chain rules with pcr field names — say the word.

## SHIP SET for this round
1. Paste **pcracer_rules_section.txt** over the PC Racer region of the rules (pcrTimes through pcrOwned) in
   the Firebase console.
2. Upload **packs.html** (fixed download button).
3. Attach to the site chat: **museum.html** (the stuck-navigation bug), **pcracer.html**, **mods.html**,
   **js/pcracer.js** — the remaining fixes land on those.

# RedlineStudio

A game platform by Redline Digital — players make accounts, build games in the Studio, and publish them for everyone to play.

**Live site:** https://redlinestudio.dev

## How it's organized (keep it modular!)

| File | Job |
|---|---|
| `js/firebase.js` | Database connection — nothing else |
| `js/auth.js` | Accounts via Firebase Authentication (v2) — login, sessions |
| `js/games.js` | Publish, list, load, update games |
| `js/engine.js` | The game engine — compiles + runs scripts on a CRT-style canvas |
| `js/redscript.js` | RedScript — the text scripting language (blocks compile to the same thing) |
| `js/blocks.js` | The block script editor UI |
| `js/models.js` | Models: save (with snapshot + description), inventory, insert, sealed market buy/sell |
| `js/economy.js` | Coins + daily claim |
| `js/profiles.js` | Player profiles + saving the custom page |
| `js/cards.js` | Game cards with live/static arcade screens + like counts |
| `js/social.js` | Likes/dislikes + comments (games, players, models) |
| `js/forum.js` | Forums: threads and replies |
| `js/touch-controls.js` | Auto-generated on-screen buttons for phones (from each game's keys) |
| (engine) | Gamepad support: 1 controller drives any game, 2 controllers = P1/P2 |
| `js/fullscreen.js` | Optional fullscreen for testing and playing |
| `js/screen-size.js` | 🖥 screen size button (S/M/L/MAX, remembered) + double-res crisp canvas |
| `js/studio-panels.js` | Studio panels: collapsible headers + floatable windows (desktop) |
| `js/filterbar.js` | Search + sort bar for the Games, Market and Players lists |
| `js/export.js` | ⬇ Download: bundles a game into one standalone offline HTML file |
| `js/terminal.js` | The teletype input row for text-adventure games |
| `js/casino-odds.js` | THE HOUSE RULES — fixed public odds (92% RTP) + the casino loop |
| `js/casino.js` | Casino money: atomic spin/fund/collect transactions on machine pools |
| `js/scores.js` | ★ High scores: personal-best leaderboards on games with points + an end |
| `js/rtdb.js` | The FAST database connection (Realtime Database) — the live wire |
| `js/live.js` | 🔴 LIVE watching: the player broadcasts frames, watchers see near-live |
| `js/duel.js` | ⚔ Online duels: the net contract (net1-6/foe1-6/netev/duel/netslot) |
| `js/party.js` | Multi-seat rooms: the net contract for 2–8 players at one machine |
| `js/floor-rules.js` | The arcade floor's pure rules: seats, staleness, the line, snapshots |
| `js/floor.js` | The arcade floor live: one player per machine, queue, watch window, chat |
| `js/ui.js` | Shared nav bar, toasts, helpers |
| `css/style.css` | All styling |
| `index.html` | Home — the public games list |
| `login.html` | Log in / create account |
| `play.html` | Plays a published game (one renderer per engine version) |
| `market.html` | Model market + inventory + coins |
| `casino.html` | The Casino floor — player-built machines, platform-run odds |
| `profiles.html` | Players — every account on the platform |
| `profile.html` | One player: stats, games, custom page, likes + comment wall |
| `forums.html` | Forums — threads and replies |
| `guide.html` | The Coding Guide — full RedScript + Studio reference |
| `privacy.html` | Privacy policy (required for ads; linked under every ad) |
| `js/ads.js` | Advertising, off until AD_CONFIG is filled in — bottom-of-page slots only |
| `othergames.html` | More Games — Redline Digital's GPS games + future downloads |
| `about.html` | About the platform |
| `studio/studio.html` | The Studio (game mode + `?mode=page` Page Studio for profiles) |
|  `studio/example-*.js` | Reference examples: CRT Amusement Device (1947), Bertie the Brain (1950), NIMROD (1951), Draughts (1951), OXO (1952), Tennis for Two (1958), Mouse in the Maze (1959), Tic-Tac-Toe on TX-0 (1959), Spacewar! (1962), Computer Space (1971), Odyssey Table Tennis (1972), Pong (1972), Space Race (1973), Gotcha (1973), Hunt the Wumpus (Map + Teletype, 1973), Gran Trak 10 (1974), Tank (1974), Maze War (1974), Maze War Arena (1974, 4P online), Redline Slots |

**Rules of the road:** one file, one job. New features get new files. Every game is saved with a `version` and `engine` field so old games keep working as the Studio evolves — each engine version keeps its renderer forever.

## The scripting system (v1)

Blocks and text are the **same language** (RedScript):
- The block editor builds structure (events, if, repeat...) with UI
- Every value field in a block is a RedScript expression: `self.x + 2`, `rand(10,90)`, `dist(self, target1) < 20`
- A 📜 Code block holds full RedScript and compiles into the same structure
- One interpreter (`engine.js`) runs everything

Events: `when start`, `when tick`, `when click`, `when answer`, `when key "..."` (tick is a fixed 60Hz on every screen) · Actions: `set`, `change`, `if/else`, `repeat`, `say`, `explode`, `beep freq for secs`, `print`, `clear` · Math: `+ - * / %`, `xor(a,b)`, `sin(deg)` `cos(deg)`, comparisons, `and or not`, unary minus, `touching(a,b)`, `answer()` `upper()` `len()` · Lists: `board[i]` read/write anywhere · Objects: dot, ring, box, line (vector segment along its angle), text, tri (ship) with angle/rotation and x/y/size/color/glow/visible/text.

## Models & Market (v1)

- Check objects in the Explorer → save as a Model (objects + scripts travel together)
- Models live in your inventory, insert into any game fully editable
- List models on the Market for free or coins; coins: 100 to start + 100 daily claim

## Account rules (v1)

- Username: 1–10 characters, any character, caps matter, must be unique
- Password: 1–10 characters, any character, caps matter
- No email. Logins go through Firebase Authentication (v2) — passwords are stored only by Firebase Auth, never in our database. Old v1 accounts upgrade themselves on their next login.

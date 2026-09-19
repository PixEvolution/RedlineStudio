# RedlineStudio

A game platform by Redline Digital — players make accounts, build games in the Studio, and publish them for everyone to play.

**Live site:** https://pixevolution.github.io/RedlineStudio/

## How it's organized (keep it modular!)

| File | Job |
|---|---|
| `js/firebase.js` | Database connection — nothing else |
| `js/auth.js` | Accounts, login, sessions |
| `js/games.js` | Publish, list, load, update games |
| `js/engine.js` | The game engine — compiles + runs scripts on a CRT-style canvas |
| `js/redscript.js` | RedScript — the text scripting language (blocks compile to the same thing) |
| `js/blocks.js` | The block script editor UI |
| `js/models.js` | Models: save groups, inventory, insert, market buy/sell |
| `js/economy.js` | Coins + daily claim |
| `js/profiles.js` | Player profiles + saving the custom page |
| `js/touch-controls.js` | Auto-generated on-screen buttons for phones (from each game's keys) |
| `js/fullscreen.js` | Optional fullscreen for testing and playing |
| `js/ui.js` | Shared nav bar, toasts, helpers |
| `css/style.css` | All styling |
| `index.html` | Home — the public games list |
| `login.html` | Log in / create account |
| `play.html` | Plays a published game (one renderer per engine version) |
| `market.html` | Model market + inventory + coins |
| `profiles.html` | Players — every account on the platform |
| `profile.html` | One player: stats, games, and their custom scripted page |
| `studio/studio.html` | The Studio (game mode + `?mode=page` Page Studio for profiles) |
|  `studio/example-*.js` | Reference examples: CRT Amusement Device (1947), Bertie the Brain (1950) |

**Rules of the road:** one file, one job. New features get new files. Every game is saved with a `version` and `engine` field so old games keep working as the Studio evolves — each engine version keeps its renderer forever.

## The scripting system (v1)

Blocks and text are the **same language** (RedScript):
- The block editor builds structure (events, if, repeat...) with UI
- Every value field in a block is a RedScript expression: `self.x + 2`, `rand(10,90)`, `dist(self, target1) < 20`
- A 📜 Code block holds full RedScript and compiles into the same structure
- One interpreter (`engine.js`) runs everything

Events: `when start`, `when tick`, `when click`, `when key "..."` · Actions: `set`, `change`, `if/else`, `repeat`, `say`, `explode` · Objects: dot, ring, box, text with x/y/size/color/glow/visible/text.

## Models & Market (v1)

- Check objects in the Explorer → save as a Model (objects + scripts travel together)
- Models live in your inventory, insert into any game fully editable
- List models on the Market for free or coins; coins: 100 to start + 100 daily claim

## Account rules (v1)

- Username: 1–10 characters, any character, caps matter, must be unique
- Password: 1–10 characters, any character, caps matter
- No email. Passwords are hashed (SHA-256) before saving — never stored readable.

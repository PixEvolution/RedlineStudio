# RedlineStudio

A game platform by Redline Digital — players make accounts, build games in the Studio, and publish them for everyone to play.

**Live site:** https://pixevolution.github.io/RedlineStudio/

## How it's organized (keep it modular!)

| File | Job |
|---|---|
| `js/firebase.js` | Database connection — nothing else |
| `js/auth.js` | Accounts, login, sessions |
| `js/games.js` | Publish, list, load, update games |
| `js/ui.js` | Shared nav bar, toasts, helpers |
| `css/style.css` | All styling |
| `index.html` | Home — the public games list |
| `login.html` | Log in / create account |
| `play.html` | Plays a published game |
| `studio/` | The Studio — this folder grows into the full editor |

**Rules of the road:** one file, one job. New features get new files. Every game is saved with a `version` and `engine` field so old games keep working as the Studio evolves.

## Account rules (v1)

- Username: 1–10 characters, any character, caps matter, must be unique
- Password: 1–10 characters, any character, caps matter
- No email. Passwords are hashed (SHA-256) before saving — never stored readable.

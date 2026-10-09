// ui.js — shared UI helpers: the top nav bar, toasts, small utilities.
// Every page calls renderNav() so login state shows everywhere consistently.

import { currentUser, logout, auth, authReady } from "./auth.js";
import { getCoins } from "./economy.js";
import { myBracket } from "./age.js";
import { wireLevel } from "./level.js";

export const COIN = "◎";   // the coin symbol — renders on every platform (the coin emoji does not on Windows)

export const $ = (sel, root = document) => root.querySelector(sel);

// rootPath is the relative path back to the site root ("" on root pages, "../" inside /studio)
export function renderNav(rootPath = "") {
  const user = currentUser();
  const nav = document.createElement("nav");
  nav.className = "topnav";
  nav.innerHTML = `
    <a class="brand" href="${rootPath}index.html">
      <span class="brand-red">REDLINE</span>STUDIO
    </a>
    <div class="nav-links">
      <a href="${rootPath}index.html">Games</a>
      <a href="${rootPath}museum.html">Museum</a>
      <a href="${rootPath}studio/studio.html">Studio</a>
      <a href="${rootPath}market.html">Market</a>
      <a href="${rootPath}casino.html" class="nav-casino" style="display:none">Casino</a>
      <a href="${rootPath}profiles.html">Players</a>
      <a href="${rootPath}forums.html">Forums</a>
      <a href="${rootPath}othergames.html">More Games</a>
      <a href="${rootPath}guide.html">Guide</a>
      <span class="nav-user"></span>
    </div>
  `;

  const userSlot = nav.querySelector(".nav-user");
  if (user) {
    // coin balance, top right — click it to visit the Market
    const coins = document.createElement("a");
    coins.className = "nav-coins";
    coins.id = "nav-coins";
    coins.href = rootPath + "market.html";
    coins.title = "Your coins — earn more on the Market";
    coins.textContent = COIN + " …";
    userSlot.append(coins);
    getCoins(user)
      .then(n => { coins.textContent = COIN + " " + n; })
      .catch(() => { coins.textContent = COIN; });

    const name = document.createElement("a");
    name.className = "nav-username";
    name.textContent = user; // textContent = safe for any character
    name.href = rootPath + "profile.html?u=" + encodeURIComponent(user);
    name.title = user + " — my profile";
    wireLevel(name, user);   // "name N" — the player level, earned one course at a time
    const gear = document.createElement("a");
    gear.href = rootPath + "account.html";
    gear.textContent = "⚙";
    gear.title = "Account settings — password, email, age, delete";
    const out = document.createElement("a");
    out.href = "#";
    out.textContent = "Log out";
    out.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
      window.location.href = rootPath + "index.html";
    });
    userSlot.append(name, gear, out);
  } else {
    const login = document.createElement("a");
    login.href = rootPath + "login.html";
    login.className = "btn btn-small";
    login.textContent = "Log in";
    userSlot.append(login);
  }

  document.body.prepend(nav);

  // THE CASINO DOOR ISN'T ON THE MAP: the nav button only exists for a
  // logged-in, declared-18+, email-verified player. Everyone else — kids,
  // guests, undeclared accounts — never sees it. (casino.html itself checks
  // again at the door, so a shared link grants nothing.)
  maybeShowCasino(nav.querySelector(".nav-casino"), user);

  // the legal footer, on every page
  const foot = document.createElement("footer");
  foot.className = "site-foot";
  foot.innerHTML = `<a href="${rootPath}terms.html">Terms of Service</a> ·
    <a href="${rootPath}privacy.html">Privacy</a> ·
    <a href="${rootPath}ratings.html">Content Ratings</a> ·
    <a href="${rootPath}about.html">About</a> · © Redline Digital LLC`;
  document.body.appendChild(foot);
}

// Is this player cleared for the 18+ side? (declared 18 bracket + verified
// email). The answer is cached per browser session so most pages pay nothing;
// account.html clears the cache when age or email changes.
export async function adultCleared() {
  if (!currentUser()) return false;
  try {
    const cached = sessionStorage.getItem("rl_adult_ok");
    if (cached === "1") return true;
    if (cached === "0") return false;
  } catch {}
  let ok = false;
  try {
    await authReady;
    const u = auth.currentUser;
    const verified = !!(u && u.email && !u.email.endsWith("@users.redlinestudio.dev") && u.emailVerified);
    ok = verified && (await myBracket()) === "18";
  } catch {}
  try { sessionStorage.setItem("rl_adult_ok", ok ? "1" : "0"); } catch {}
  return ok;
}

async function maybeShowCasino(link, user) {
  if (!link || !user) return;
  if (await adultCleared()) link.style.display = "";
}

let toastTimer = null;
export function toast(message, isError = false) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = isError ? "toast error show" : "toast show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

export function fmtDate(ts) {
  if (!ts?.seconds) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString();
}

// Update the nav coin chip after a balance change (claiming daily, buying, paying to play).
export function setNavCoins(n) {
  const chip = document.getElementById("nav-coins");
  if (chip) chip.textContent = COIN + " " + n;
}

// ui.js — shared UI helpers: the top nav bar, toasts, small utilities.
// Every page calls renderNav() so login state shows everywhere consistently.

import { currentUser, logout } from "./auth.js";
import { getCoins } from "./economy.js";

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
      <a href="${rootPath}studio/studio.html">Studio</a>
      <a href="${rootPath}market.html">Market</a>
      <a href="${rootPath}casino.html">Casino</a>
      <a href="${rootPath}profiles.html">Players</a>
      <a href="${rootPath}forums.html">Forums</a>
      <a href="${rootPath}guide.html">Guide</a>
      <a href="${rootPath}about.html">About</a>
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
    const out = document.createElement("a");
    out.href = "#";
    out.textContent = "Log out";
    out.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
      window.location.href = rootPath + "index.html";
    });
    userSlot.append(name, out);
  } else {
    const login = document.createElement("a");
    login.href = rootPath + "login.html";
    login.className = "btn btn-small";
    login.textContent = "Log in";
    userSlot.append(login);
  }

  document.body.prepend(nav);
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

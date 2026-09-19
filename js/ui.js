// ui.js — shared UI helpers: the top nav bar, toasts, small utilities.
// Every page calls renderNav() so login state shows everywhere consistently.

import { currentUser, logout } from "./auth.js";

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
      <span class="nav-user"></span>
    </div>
  `;

  const userSlot = nav.querySelector(".nav-user");
  if (user) {
    const name = document.createElement("span");
    name.className = "nav-username";
    name.textContent = user; // textContent = safe for any character
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

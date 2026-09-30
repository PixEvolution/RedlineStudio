// Headless test: the ad plumbing — completely dormant until configured,
// correct AdSense markup once it is, bottom-of-page slots only.
import { AD_CONFIG, renderAd, footAd } from "./js/ads.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };

// a tiny fake DOM
const el = (tag) => ({
  tag, children: [], attrs: {}, style: {}, className: "", innerHTML: "", id: "",
  parent: null,
  setAttribute(k, v) { this.attrs[k] = v; },
  appendChild(c) { c.parent = this; this.children.push(c); return c; },
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
});
const main = el("main");
const head = el("head");
global.document = {
  createElement: (t) => el(t),
  querySelector: (sel) => (sel === "main" ? main : null),
  head
};

// the site now SHIPS configured (Victor's real publisher + slot ids) —
// remember them, prove the dormant path still exists, then restore
const LIVE = { client: AD_CONFIG.client, slot: AD_CONFIG.slot };
check("the live config carries the real publisher id", /^ca-pub-\d{16}$/.test(LIVE.client));
check("the live config carries a slot id", /^\d{8,12}$/.test(LIVE.slot));

console.log("Dormant when unconfigured (the kill switch still works):");
AD_CONFIG.client = ""; AD_CONFIG.slot = "";
check("no config: renderAd does nothing", renderAd(el("div")) === false);
check("no config: footAd leaves the page untouched", footAd() === false && main.children.length === 0);
check("no config: no ad script is loaded", head.children.length === 0);

console.log("Configured:");
AD_CONFIG.client = LIVE.client;
AD_CONFIG.slot = LIVE.slot;
check("footAd mounts the bottom slot", footAd() === true && main.children.length === 1);
const box = main.children[0].children[0];
const ins = box.children.find(c => c.className === "adsbygoogle");
check("the AdSense unit carries the right ids",
  ins && ins.attrs["data-ad-client"] === LIVE.client
      && ins.attrs["data-ad-slot"] === LIVE.slot
      && ins.attrs["data-ad-format"] === "auto");
check("the ad script loads once, from Google, with the client id",
  head.children.length === 1 && head.children[0].src.includes("adsbygoogle.js?client=" + LIVE.client));
check("every slot links the privacy policy",
  box.children.some(c => c.className === "ad-cap" && c.innerHTML.includes("privacy.html")));
footAd();
check("a second page slot reuses the one script", main.children.length === 2 && head.children.length === 1);
check("each slot announces itself to AdSense", globalThis.adsbygoogle.length === 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

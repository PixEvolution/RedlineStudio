// ads.js — the site's advertising, in one file, OFF until configured.
//
// HOW TO TURN ADS ON (Google AdSense):
//   1. Sign up at adsense.google.com with the Google account that should get
//      paid, and add the site  redlinestudio.dev  there.
//   2. In AdSense → Ads → By ad unit → create ONE "Display ad" (responsive).
//      That gives you two ids: your publisher id (ca-pub-…) and the ad
//      unit's slot id (a number).
//   3. Paste both into AD_CONFIG below and upload this file. Every page's
//      bottom ad slot switches on at once.
//   4. Create a file called  ads.txt  in the ROOT of the site (next to
//      index.html) containing exactly one line, with your own pub number:
//        google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
//   5. In AdSense → Privacy & messaging, turn ON the consent message for
//      European visitors (Google runs it — no code needed here).
//
// While AD_CONFIG is empty, every slot renders nothing and the site is
// exactly as it was. Ads are placed at the BOTTOM of pages only — never
// beside the screen or the controls, so misclicks can't happen (misclick
// farming is the #1 way arcade sites get banned from AdSense).

export const AD_CONFIG = {
  client: "ca-pub-2208639648972390",   // RedlineStudio's AdSense publisher id
  slot: ""      // ← your responsive Display ad unit's id, e.g. "1234567890"
};

let scriptAdded = false;

// Renders one responsive ad into `mount`. Returns true if an ad went in.
export function renderAd(mount) {
  if (!AD_CONFIG.client || !AD_CONFIG.slot || typeof document === "undefined" || !mount) return false;
  try {
    // pages carry the AdSense script in their <head> (that's also how the
    // site is verified) — only inject it here if a page somehow lacks it
    if (!scriptAdded && !document.querySelector('script[src*="adsbygoogle.js"]')) {
      scriptAdded = true;
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CONFIG.client;
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
    scriptAdded = true;
    const box = document.createElement("div");
    box.className = "ad-box";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", AD_CONFIG.client);
    ins.setAttribute("data-ad-slot", AD_CONFIG.slot);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    const cap = document.createElement("p");
    cap.className = "ad-cap";
    cap.innerHTML = 'ads keep the arcade free · <a href="privacy.html">privacy</a>';
    box.appendChild(ins);
    box.appendChild(cap);
    mount.appendChild(box);
    (globalThis.adsbygoogle = globalThis.adsbygoogle || []).push({});
    return true;
  } catch (err) {
    console.warn("ads:", err);
    return false;
  }
}

// One call per page: the bottom-of-page ad slot. Does nothing until
// AD_CONFIG is filled in, so it's safe to ship everywhere ahead of time.
export function footAd() {
  if (typeof document === "undefined") return false;
  const main = document.querySelector("main");
  if (!main) return false;
  const mount = document.createElement("div");
  mount.id = "ad-foot";
  main.appendChild(mount);
  if (!renderAd(mount)) { mount.remove(); return false; }
  return true;
}

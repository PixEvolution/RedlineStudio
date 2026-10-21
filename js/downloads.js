// downloads.js — the DOWNLOAD buttons for Redline Digital's desktop games.
// Each button names the game's file (data-asset="PC_Racer.exe") and always gets
// the most recently uploaded copy of that file from GitHub Releases, whatever
// the release's tag is. (Several games share one repo, so GitHub's own
// "latest release" link could point at the wrong game.) If GitHub can't be
// reached, the button just opens the Releases page instead.

const REPO = "PixEvolution/RedlineStudio";

async function newest(name) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=50`);
  if (!r.ok) return null;
  let best = null;
  for (const rel of await r.json()) {
    if (rel.draft || rel.prerelease) continue;
    for (const a of rel.assets || []) {
      if (String(a.name).toLowerCase() === name.toLowerCase() && (!best || a.updated_at > best.updated_at)) best = a;
    }
  }
  return best ? best.browser_download_url : null;
}

export function wireDownloads(root = document) {
  root.querySelectorAll("a[data-asset]").forEach(a => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      let url = null;
      try { url = await newest(a.dataset.asset); } catch { url = null; }
      window.location.href = url || `https://github.com/${REPO}/releases`;
    });
  });
}

wireDownloads();

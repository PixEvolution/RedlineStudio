// filterbar.js — the search box + sort dropdown used by the Games list,
// the Market and the Players page. Lists load once; searching and sorting
// happen instantly in the browser.

export function createFilterBar(mount, { sorts, placeholder = "Search…", onChange }) {
  const bar = document.createElement("div");
  bar.className = "filter-bar";

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = placeholder;
  input.className = "filter-search";

  const sel = document.createElement("select");
  sel.className = "blk-add filter-sort";
  for (const [value, label] of sorts) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    sel.appendChild(o);
  }

  bar.append(input, sel);
  mount.appendChild(bar);

  const fire = () => onChange(input.value.trim().toLowerCase(), sel.value);
  let t = null;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(fire, 150); });
  sel.addEventListener("change", fire);
  return { fire };
}

// Shared sort orders. Every list re-sorts a copy — never the original.
export const SORTERS = {
  recent:   (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
  rated:    (a, b) => ((Number(b.likes) || 0) - (Number(b.dislikes) || 0)) -
                      ((Number(a.likes) || 0) - (Number(a.dislikes) || 0)),
  cheapest: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
  played:   (a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0),
  pool:     (a, b) => (Number(b.pool) || 0) - (Number(a.pool) || 0)
};

export function applyFilter(list, search, sortKey, searchFields = ["title", "owner"]) {
  let out = list;
  if (search) {
    out = out.filter(item => searchFields.some(f => String(item[f] ?? "").toLowerCase().includes(search)));
  }
  out = [...out].sort(SORTERS[sortKey] || SORTERS.recent);
  return out;
}

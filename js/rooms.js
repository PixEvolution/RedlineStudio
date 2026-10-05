// rooms.js — the ◀ ROOM / PAGE ▶ doors, shared by every long list.
//
// The same idea as the Games page: a list is fetched ONCE, searched and
// sorted across ALL of it, and only then cut into rooms (Casino) or pages
// (Market, Players). Nothing is ever cut off — it just lives further back.
//
//   const pager = createPager({ mounts: [topEl, bottomEl], size: 24, word: "ROOM", onChange: render });
//   pager.reset(shown.length);   // a new search/sort: back to the front door
//   pager.slice(shown)           // the items for the current room/page

export function createPager({ mounts, size = 24, word = "ROOM", onChange = () => {} }) {
  let n = 1;
  let total = 0;
  const count = () => Math.max(1, Math.ceil(total / size));

  function go(k) {
    const was = n;
    n = Math.max(1, Math.min(count(), k));
    draw();
    onChange();
    if (n !== was) window.scrollTo({ top: 0 });
  }

  function draw() {
    const last = count();
    for (const mount of mounts) {
      if (!mount) continue;
      mount.innerHTML = "";
      if (last <= 1) continue;                    // one room/page — no doors needed
      const prev = document.createElement("button");
      prev.className = "btn";
      prev.textContent = "◀ " + word + " " + (n - 1);
      prev.disabled = n <= 1;
      prev.addEventListener("click", () => go(n - 1));
      const label = document.createElement("span");
      label.className = "room-label";
      label.textContent = word + " " + n + " / " + last;
      const next = document.createElement("button");
      next.className = "btn";
      next.textContent = word + " " + (n + 1) + " ▶";
      next.disabled = n >= last;
      next.addEventListener("click", () => go(n + 1));
      mount.append(prev, label, next);
    }
  }

  return {
    // a new ranking (search or sort changed): start at room/page 1
    reset(len) { total = len; n = 1; draw(); },
    // same ranking, list changed size (e.g. something was unlisted): stay put if possible
    update(len) { total = len; n = Math.min(n, count()); draw(); },
    slice(list) { return list.slice((n - 1) * size, n * size); },
    get page() { return n; }
  };
}

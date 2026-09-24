// localwire.js — the LOCAL test wire: the same multi-seat net contract as
// party.js, but between windows of ONE browser instead of over the internet.
//
// This is how the Studio tests multiplayer games (like Roblox Studio's local
// server): each extra player window is a real seat with its own keyboard,
// talking over a BroadcastChannel — no login, no publish, no network at all.
//
// The contract is IDENTICAL to the real wire (party.js), on purpose: a game
// that works on the local wire works online, because the scripts can't tell
// the difference — netslot, net1..6, fon/f1..f6/fev, pcount, nettgt/netev
// targeted hits, and the duel-compat mirrors all behave the same.

const RATE_MS = 150;      // outgoing state, ~7×/second — same beat as party.js
const FRESH_MS = 3000;    // silence this long = that window is gone
                          // (shorter than online: local silence means closed)

export function attachLocalParty(engine, channelName, slot, seats, username, opts = {}) {
  const rateMs = opts.rateMs || RATE_MS;
  const freshMs = opts.freshMs || FRESH_MS;
  const bc = new BroadcastChannel(channelName);
  engine.vars.netslot = slot;
  engine.vars.hits = 0;

  // the room, as heard on the channel: slot -> last state + local receipt time
  const room = {};
  const lastEv = {};    // slot -> last event counter we processed
  const users = {};     // slot -> player label

  // outgoing: my net vars + the targeted-event fields (party.js field names)
  const send = () => {
    const v = engine.vars;
    try {
      bc.postMessage({
        k: "state", slot, user: username || "", at: Date.now(),
        n1: Number(v.net1) || 0, n2: Number(v.net2) || 0, n3: Number(v.net3) || 0,
        n4: Number(v.net4) || 0, n5: Number(v.net5) || 0, n6: Number(v.net6) || 0,
        ev: Number(v.netev) || 0, tgt: Number(v.nettgt) || 0
      });
    } catch {}
  };
  const pub = setInterval(send, rateMs);
  send();   // announce the seat right away — no first-beat wait

  const apply = () => {
    const now = Date.now();
    let count = 1, firstOther = 0;
    const fon = {}, f1 = {}, f2 = {}, f3 = {}, f4 = {}, f5 = {}, f6 = {}, fev = {};
    for (let s = 1; s <= seats; s++) {
      if (s === slot) continue;
      const node = room[s];
      const fresh = node && now - node.rx < freshMs;
      fon[s] = fresh ? 1 : 0;
      if (!fresh) continue;
      count++;
      if (!firstOther) firstOther = s;
      users[s] = String(node.user || "");
      f1[s] = Number(node.n1) || 0; f2[s] = Number(node.n2) || 0; f3[s] = Number(node.n3) || 0;
      f4[s] = Number(node.n4) || 0; f5[s] = Number(node.n5) || 0; f6[s] = Number(node.n6) || 0;
      fev[s] = Number(node.ev) || 0;
      // targeted events: their counter advanced while aiming at MY seat
      if (lastEv[s] === undefined) lastEv[s] = fev[s];
      if (fev[s] !== lastEv[s]) {
        if ((Number(node.tgt) || 0) === slot) {
          engine.vars.hits = (Number(engine.vars.hits) || 0) + 1;
        }
        lastEv[s] = fev[s];
      }
    }
    engine.lists.fon = fon;
    engine.lists.f1 = f1; engine.lists.f2 = f2; engine.lists.f3 = f3;
    engine.lists.f4 = f4; engine.lists.f5 = f5; engine.lists.f6 = f6;
    engine.lists.fev = fev;
    engine.vars.pcount = count;
    // duel-compat mirrors from the lowest live other seat — same as party.js
    engine.vars.duel = firstOther ? 1 : 0;
    if (firstOther) {
      engine.vars.foe1 = f1[firstOther]; engine.vars.foe2 = f2[firstOther];
      engine.vars.foe3 = f3[firstOther]; engine.vars.foe4 = f4[firstOther];
      engine.vars.foe5 = f5[firstOther]; engine.vars.foe6 = f6[firstOther];
      engine.vars.foeev = fev[firstOther];
    }
  };

  bc.onmessage = (e) => {
    const m = e.data;
    if (!m || m.slot === slot) return;
    if (m.k === "state") { room[m.slot] = { ...m, rx: Date.now() }; apply(); }
    if (m.k === "bye") { delete room[m.slot]; apply(); }
  };
  const fresher = setInterval(apply, Math.min(1000, freshMs / 2));
  apply();

  const bye = () => { try { bc.postMessage({ k: "bye", slot }); } catch {} };
  const onUnload = () => bye();
  if (typeof window !== "undefined") window.addEventListener("beforeunload", onUnload);

  return {
    who: (s) => users[s] || "",
    destroy() {
      clearInterval(pub);
      clearInterval(fresher);
      bye();
      if (typeof window !== "undefined") window.removeEventListener("beforeunload", onUnload);
      try { bc.close(); } catch {}
      engine.vars.duel = 0;
      engine.vars.pcount = 1;
    }
  };
}

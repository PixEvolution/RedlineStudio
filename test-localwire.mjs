// Headless test: the LOCAL wire (localwire.js) — the Studio's multiplayer
// test mode. Real BroadcastChannels, real engines, no mocks: this is two
// "windows" playing each other, including a full Maze War Arena duel.
import { Engine } from "./js/engine.js";
import { attachLocalParty } from "./js/localwire.js";
import { buildMazewar2Example } from "./studio/example-mazewar2.js";

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗ FAIL:", n); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FAST = { rateMs: 15, freshMs: 250 };
const room = () => "rl_wire_test_" + Math.random().toString(36).slice(2);

console.log("The contract (two bare engines on one channel):");
{
  const ch = room();
  const e1 = new Engine(null, []), e2 = new Engine(null, []);
  const w1 = attachLocalParty(e1, ch, 1, 4, "P1", FAST);
  const w2 = attachLocalParty(e2, ch, 2, 4, "P2", FAST);
  e1.vars.net1 = 11; e1.vars.net2 = 22; e1.vars.net6 = 66;
  e2.vars.net1 = 77;
  await sleep(120);
  check("each window is a seat the other can see",
    e1.lists.fon?.[2] === 1 && e2.lists.fon?.[1] === 1);
  check("net vars ride the wire into the f-lists",
    e2.lists.f1[1] === 11 && e2.lists.f2[1] === 22 && e2.lists.f6[1] === 66
    && e1.lists.f1[2] === 77);
  check("both windows count 2 players", e1.vars.pcount === 2 && e2.vars.pcount === 2);
  check("seats are handed out, not guessed", e1.vars.netslot === 1 && e2.vars.netslot === 2);
  check("the duel-compat mirrors fill from the other seat",
    e2.vars.duel === 1 && e2.vars.foe1 === 11 && e1.vars.foe1 === 77);
  check("the wire knows who's sitting where", w1.who(2) === "P2" && w2.who(1) === "P1");

  // targeted events: exactly the party.js semantics
  e1.vars.nettgt = 2; e1.vars.netev = 1;
  await sleep(80);
  check("a targeted event lands as a hit on THAT seat", e2.vars.hits === 1);
  const h1 = e1.vars.hits;
  e2.vars.nettgt = 0; e2.vars.netev = 5;   // broadcast pulse, aimed at nobody
  await sleep(80);
  check("a broadcast pulse hits nobody", e1.vars.hits === h1 && e1.lists.fev[2] === 5);
  e1.vars.nettgt = 3; e1.vars.netev = 2;   // aimed at an EMPTY seat
  await sleep(80);
  check("an event aimed elsewhere isn't my hit", e2.vars.hits === 1);

  // a third window joins mid-test
  const e3 = new Engine(null, []);
  const w3 = attachLocalParty(e3, ch, 3, 4, "P3", FAST);
  await sleep(120);
  check("a third player fills the next seat on everyone's board",
    e1.vars.pcount === 3 && e2.lists.fon[3] === 1 && e3.vars.pcount === 3);
  check("duel mirrors stay on the LOWEST other seat", e2.vars.foe1 === 11);

  // closing a window says goodbye — the seat empties at once
  w3.destroy();
  await sleep(80);
  check("a closed window's seat empties immediately",
    e1.lists.fon[3] === 0 && e1.vars.pcount === 2);
  w1.destroy(); w2.destroy();
  check("destroy resets my own duel state", e1.vars.duel === 0 && e1.vars.pcount === 1);
}

console.log("The hub channel (the offline Studio's file:// wire):");
{
  // BroadcastChannel can't be trusted between file:// windows, so the
  // offline Studio relays through a hub of direct function calls — the
  // EXACT hub it ships. Same contract, zero BroadcastChannels.
  const hub = (() => {
    const subs = [];
    return {
      join(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
      post(msg, from) { for (let i = subs.length - 1; i >= 0; i--) { if (subs[i] !== from) { try { subs[i](msg); } catch {} } } }
    };
  })();
  const hubChannel = () => {
    const me = { onmessage: null, closed: false };
    const recv = (msg) => { if (!me.closed && me.onmessage) me.onmessage({ data: msg }); };
    const leave = hub.join(recv);
    me.postMessage = (msg) => { if (!me.closed) hub.post(msg, recv); };
    me.close = () => { me.closed = true; leave(); };
    return me;
  };
  const OPTS = { ...FAST, makeChannel: hubChannel };
  const e1 = new Engine(null, []), e2 = new Engine(null, []), e3 = new Engine(null, []);
  const w1 = attachLocalParty(e1, "off", 1, 3, "P1", OPTS);
  const w2 = attachLocalParty(e2, "off", 2, 3, "P2", OPTS);
  e1.vars.net1 = 5; e2.vars.net1 = 8;
  await sleep(100);
  check("two seats see each other over the hub — no BroadcastChannel at all",
    e1.lists.fon?.[2] === 1 && e2.lists.fon?.[1] === 1 && e1.lists.f1[2] === 8 && e2.lists.f1[1] === 5);
  check("pcount and the duel mirrors flow the same",
    e1.vars.pcount === 2 && e2.vars.duel === 1 && e2.vars.foe1 === 5);
  const w3 = attachLocalParty(e3, "off", 3, 3, "P3", OPTS);
  await sleep(100);
  check("a third hub seat joins mid-test", e1.vars.pcount === 3 && e3.lists.f1[1] === 5);
  e1.vars.nettgt = 3; e1.vars.netev = 1;
  await sleep(80);
  check("targeted hits land through the hub", e3.vars.hits === 1 && (Number(e2.vars.hits) || 0) === 0);
  w3.destroy();
  await sleep(80);
  check("a closed hub seat says goodbye and empties at once",
    e1.lists.fon[3] === 0 && e1.vars.pcount === 2);
  w1.destroy(); w2.destroy();
  check("destroying every seat leaves the hub silent", e1.vars.pcount === 1 && e2.vars.pcount === 1);
}

console.log("Staleness (a crashed window sends no goodbye):");
{
  // a hand-rolled silent peer: one state message, then nothing ever again
  const ch = room();
  const e1 = new Engine(null, []);
  const w1 = attachLocalParty(e1, ch, 1, 2, "P1", { rateMs: 15, freshMs: 120 });
  const ghost = new BroadcastChannel(ch);
  ghost.postMessage({ k: "state", slot: 2, user: "GHOST", at: Date.now(), n1: 9, n2: 0, n3: 0, n4: 0, n5: 0, n6: 0, ev: 0, tgt: 0 });
  await sleep(60);
  check("one beat is enough to be seen", e1.lists.fon?.[2] === 1 && e1.lists.f1[2] === 9);
  await sleep(220);
  check("silence past the freshness window = the seat is GONE",
    e1.lists.fon[2] === 0 && e1.vars.pcount === 1);
  ghost.close();
  w1.destroy();
}

console.log("Full game over the wire — Maze War Arena, two real players:");
{
  const ch = room();
  const mk = () => {
    const e = new Engine(null, buildMazewar2Example().objects);
    e.runEvents("start"); e.step();
    return e;
  };
  const e1 = mk(), e2 = mk();
  const w1 = attachLocalParty(e1, ch, 1, 4, "P1", FAST);
  const w2 = attachLocalParty(e2, ch, 2, 4, "P2", FAST);
  const both = async (ticks, perBeat = 6) => {
    for (let t = 0; t < ticks; t += perBeat) {
      for (let i = 0; i < perBeat; i++) { e1.step(); e2.step(); }
      await sleep(20);
    }
  };
  // both players drop their coin
  e1.fireClick(240, 210); e2.fireClick(240, 210);
  await both(12);
  check("two coins in = a match forms on BOTH screens",
    e1.vars.pcount === 2 && e2.vars.pcount === 2
    && String(e1.byName.roundtx.text).includes("MATCH FOUND"));
  await both(200);
  check("round 1 starts for both, both alive, on their own corners",
    e1.vars.round === 1 && e2.vars.round === 1
    && e1.vars.alive === 1 && e2.vars.alive === 1
    && !(e1.vars.px === e2.vars.px && e1.vars.py === e2.vars.py));
  await both(24);
  check("each player is a live eyeball in the OTHER window",
    e1.lists.f5[2] === 1 && e1.lists.f6[2] === 1 && e2.lists.f5[1] === 1);

  // P2 steps into P1's line of fire; P1 pulls the trigger
  e2.vars.px = 3; e2.vars.py = 1;
  e1.vars.px = 1; e1.vars.py = 1; e1.vars.face = 1;
  await both(18);
  e1.fireKey("Space"); e1.step();
  check("P1's shot lands", e1.vars.score === 1 && e1.vars.nettgt === 2);
  await both(30);
  const b2 = String(e2.byName.roundtx.text);
  check("...and P2 falls in HIS OWN window — a real hit over the wire",
    e2.vars.alive === 0 && (b2.includes("ELIMINATED") || b2.includes("OVER")));
  await both(60);
  check("P1 takes the round, both windows agree the round turned",
    e1.vars.wins === 1 && e1.vars.inter > 0);
  await both(300);
  check("round 2 deals BOTH back in", e1.vars.round === 2 && e2.vars.round === 2
    && e1.vars.alive === 1 && e2.vars.alive === 1);

  // P2's window closes mid-match
  w2.destroy();   // headless engines were never start()ed — nothing to stop
  await both(60);
  check("the survivor drops back to the lobby, clock frozen",
    e1.vars.round === 0 && String(e1.byName.roundtx.text).includes("WAITING"));
  w1.destroy();
  check("no script errors across the whole online match",
    e1.errors.length === 0 && e2.errors.length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

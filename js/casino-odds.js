// casino-odds.js — THE HOUSE RULES, in platform code where no game script
// can touch them. Every casino machine on the platform pays out from this
// one table. Machine owners build the visuals and features; the chances are
// the engine's, and they are public:
//
//   multiplier   chance      contribution to return
//   0x           58.7%       0
//   1x           25%         0.25
//   2x           10%         0.20
//   5x           5%          0.25
//   10x          1.2%        0.12
//   100x         0.1%        0.10
//                            ------
//   RETURN TO PLAYER         0.92   (92 coins back per 100 bet, long run)
//
// The 8% house edge goes to the machine's pool — that's the owner's take.
// Payouts are capped by what's actually in the pool: a machine can never
// pay out coins it doesn't hold, just like a real cabinet.

export const ODDS = [
  [0, 0.587],
  [1, 0.25],
  [2, 0.10],
  [5, 0.05],
  [10, 0.012],
  [100, 0.001]
];

export const RTP = ODDS.reduce((s, [m, p]) => s + m * p, 0);   // 0.92
export const MIN_BET = 1, MAX_BET = 10;

export function rollMultiplier(r = Math.random()) {
  let acc = 0;
  for (const [mult, p] of ODDS) {
    acc += p;
    if (r < acc) return mult;
  }
  return 0;
}

export function clampBet(bet) {
  return Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(Number(bet) || MIN_BET)));
}

// One spin against a pool, pure math (no money moves here):
// the bet goes INTO the pool, the win comes OUT, capped by what's there.
export function settleSpin(pool, bet, mult) {
  const poolAfterBet = (Number(pool) || 0) + bet;
  const win = Math.min(mult * bet, poolAfterBet);
  return { win, pool: poolAfterBet - win };
}

// THE CASINO LOOP — the counterpart of the arcade contract. A machine's
// script talks to the platform through reserved vars:
//   casino  = 1 while running with a real wallet (0 in Studio test = free play)
//   bet     — the machine sets it (1–10) before asking to spin
//   spin    — set it to 1 to pull the lever; the platform sets it to 2 while
//             the spin settles, then back to 0 when the results are in
//   result  — the multiplier that came up (0, 1, 2, 5, 10, 100; -1 = no coins)
//   win     — coins paid out this spin
//   coins   — the player's live balance
//   pool    — the machine's live pool
// The script NEVER computes a payout — it reads result/win and draws them.
export function attachCasinoLoop(engine, wallet, { interval = 200, real = false } = {}) {
  engine.vars.casino = real ? 1 : 0;
  engine.vars.spin = 0;
  engine.vars.result = 0;
  engine.vars.win = 0;
  engine.vars.coins = wallet.coins();
  engine.vars.pool = wallet.pool();

  let busy = false;
  const timer = setInterval(async () => {
    if (!engine.running && real) return;
    engine.vars.coins = wallet.coins();
    engine.vars.pool = wallet.pool();
    if (busy || Number(engine.vars.spin) !== 1) return;
    busy = true;
    engine.vars.spin = 2;                     // reels are turning
    const bet = clampBet(engine.vars.bet);
    engine.vars.bet = bet;
    try {
      const out = await wallet.spin(bet);     // the only place money moves
      engine.vars.result = out.mult;
      engine.vars.win = out.win;
      engine.vars.coins = out.coins;
      engine.vars.pool = out.pool;
    } catch (err) {
      engine.vars.result = -1;                // no coins / no connection
      engine.vars.win = 0;
    }
    engine.vars.spin = 0;
    busy = false;
  }, interval);

  return { destroy() { clearInterval(timer); } };
}

// Free-play wallet: Studio testing and exported standalone machines.
// Same odds, pretend coins.
export function localWallet(startCoins = 100, startPool = 1000) {
  let coins = startCoins, poolAmt = startPool;
  return {
    coins: () => coins,
    pool: () => poolAmt,
    async spin(bet) {
      if (coins < bet) throw new Error("Not enough coins.");
      coins -= bet;
      const mult = rollMultiplier();
      const s = settleSpin(poolAmt, bet, mult);
      poolAmt = s.pool;
      coins += s.win;
      return { mult, win: s.win, coins, pool: poolAmt };
    }
  };
}

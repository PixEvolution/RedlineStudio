// intro.js — the REDLINE DIGITAL intro, ported from the studio's own
// pygame original (PC Racer's opening): a dark tachometer, the starter
// cranks, the V8 catches and sweeps to redline — flash, shake, sparks —
// then REDLINE DIGITAL lands as the revs fall away.
//
// It plays OUTSIDE the site, where the brand has to carry itself:
//   · downloaded standalone games — after ▶ PLAY (a real click, so the
//     engine AUDIO is allowed), before the game boots
//   · the offline Studio — when it opens
// Any key or click skips it instantly. No dependencies; bundles clean.
//
// The audio isn't a recording: it's the same additive V8 synthesis as the
// pygame original — harmonics of the firing rate, phase-accumulated per
// sample, tanh-saturated — generated from the ONE rpm curve the needle uses.

export const INTRO_TL = {
  STARTER_END: 0.65,
  IDLE_END: 2.80,
  SWEEP_END: 5.40,
  BOUNCE_END: 6.20,
  DECEL_END: 9.20,
  FADE_OUT: 10.20,
  DONE: 11.00
};
export const IDLE_RPM = 560, REDLINE_RPM = 6200;

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const easeOut = (t, p = 2.8) => 1 - Math.pow(1 - clamp(t), p);
const lerp = (a, b, t) => a + (b - a) * clamp(t);

// the ONE rpm-vs-time curve — needle and exhaust both read it
export function rpmAt(t) {
  const tl = INTRO_TL;
  if (t < tl.STARTER_END) return 0;
  if (t < tl.STARTER_END + 0.25) {
    return easeOut((t - tl.STARTER_END) / 0.25, 0.40) * IDLE_RPM * 1.30;
  }
  if (t < tl.IDLE_END) {
    const ph = (t - tl.STARTER_END - 0.25) / (tl.IDLE_END - tl.STARTER_END - 0.25);
    return lerp(IDLE_RPM * 1.30, IDLE_RPM, easeOut(ph, 3.0));
  }
  if (t < tl.SWEEP_END) {
    const ph = (t - tl.IDLE_END) / (tl.SWEEP_END - tl.IDLE_END);
    return IDLE_RPM + easeOut(ph, 0.48) * (REDLINE_RPM - IDLE_RPM);
  }
  if (t < tl.BOUNCE_END) {
    const ph = (t - tl.SWEEP_END) / (tl.BOUNCE_END - tl.SWEEP_END);
    const osc = Math.sin(ph * Math.PI * 14) * (1 - ph) * 0.030;
    return REDLINE_RPM * (0.970 + osc);
  }
  if (t < tl.DECEL_END) {
    const ph = (t - tl.BOUNCE_END) / (tl.DECEL_END - tl.BOUNCE_END);
    const top = REDLINE_RPM * 0.970;
    return top + (IDLE_RPM - top) * easeOut(ph, 1.8);
  }
  return IDLE_RPM;
}

// the V8, synthesized: mono Float32Array, DONE seconds long. Pure math —
// no browser APIs — so the tests can hold the exhaust note to account.
export function buildEngineSignal(sampleRate = 44100) {
  const tl = INTRO_TL;
  const N = Math.floor(tl.DONE * sampleRate);
  const sig = new Float32Array(N);
  // harmonics of the combined firing rate (idle fund ≈ 37 Hz, we start at 2×)
  const H = [[2, 1.00], [3, 0.55], [4, 0.28], [5, 0.13], [6, 0.06]];
  const phase = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const rpm = Math.max(rpmAt(t), 50);
    // pitch compression (pow 0.35): redline roars without getting shrill
    const fund = (IDLE_RPM / 15) * Math.pow(rpm / IDLE_RPM, 0.35);
    let s = 0;
    for (let k = 0; k < H.length; k++) {
      phase[k] = (phase[k] + fund * H[k][0] / sampleRate) % 1;
      s += Math.sin(2 * Math.PI * phase[k]) * H[k][1];
    }
    s = Math.tanh(s * 2.8);
    // silent until the engine fires; fade away at the end
    s *= clamp((t - tl.STARTER_END) / 0.15);
    s *= clamp((tl.DONE - t) / 0.55);
    sig[i] = s;
  }
  // normalize to a healthy but unclipped level
  let pk = 0;
  for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(sig[i]));
  if (pk > 1e-6) for (let i = 0; i < N; i++) sig[i] = sig[i] / pk * 0.72;
  return sig;
}

// ---- the show -------------------------------------------------------------
// playIntro() covers the page with its own canvas, runs the timeline, and
// resolves when it ends or the player skips (any key / click / tap).
export function playIntro({ sound = true } = {}) {
  if (typeof document === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const tl = INTRO_TL;
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:#0b0b0f;cursor:pointer;";
    const cv = document.createElement("canvas");
    cv.style.cssText = "width:100%;height:100%;display:block;";
    overlay.appendChild(cv);
    document.body.appendChild(overlay);

    const DPR = Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
    let W = 0, H = 0;
    const size = () => {
      W = overlay.clientWidth; H = overlay.clientHeight;
      cv.width = Math.max(1, Math.floor(W * DPR));
      cv.height = Math.max(1, Math.floor(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    const ctx = cv.getContext("2d");
    size();
    window.addEventListener("resize", size);

    // audio (a click got us here in the exports, so this is allowed there;
    // anywhere autoplay is blocked, the show simply runs silent)
    let ac = null, src = null;
    if (sound) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ac = new AC();
        if (ac.state === "suspended") ac.resume().catch(() => {});
        const mono = buildEngineSignal(ac.sampleRate);
        const buf = ac.createBuffer(2, mono.length, ac.sampleRate);
        buf.getChannelData(0).set(mono);
        buf.getChannelData(1).set(mono);
        src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start();
      } catch { ac = null; }
    }

    const RED = "#d71c1c", RED_HOT = "#ff4b28", AMBER = "#ff9b00",
      TEAL = "#00b9a2", CYAN = "#2dd2ff", WHITE = "#ffffff", MID = "#4b4f5c";

    // sparks
    const sparks = [];
    let sparksSpawned = false;
    const spawnSparks = (cx, cy) => {
      for (let i = 0; i < 220; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 150 + Math.random() * 500;
        sparks.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - (100 + Math.random() * 180),
          max: 0.30 + Math.random() * 0.90, life: 0,
          col: [RED, RED_HOT, AMBER, WHITE, WHITE][Math.floor(Math.random() * 5)]
        });
        sparks[sparks.length - 1].life = sparks[sparks.length - 1].max;
      }
    };

    const gaugeFace = (R) => {
      const S = R * 2 + 4;
      const g = document.createElement("canvas");
      g.width = S * DPR; g.height = S * DPR;
      const c = g.getContext("2d");
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cx = S / 2, cy = S / 2, START = 225, SWEEP = 270;
      c.fillStyle = "#0e0e12";
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
      c.lineWidth = 5; c.strokeStyle = "#414450";
      c.beginPath(); c.arc(cx, cy, R - 2, 0, 7); c.stroke();
      c.lineWidth = 2; c.strokeStyle = "#232530";
      c.beginPath(); c.arc(cx, cy, R - 7, 0, 7); c.stroke();
      // zones: teal → amber → red
      for (const [lo, hi, col] of [[0, 0.60, "#009180"], [0.60, 0.82, AMBER], [0.82, 1, RED]]) {
        const steps = Math.max(6, Math.floor((hi - lo) * SWEEP * 2));
        c.strokeStyle = col; c.lineWidth = 3;
        for (let s = 0; s < steps; s++) {
          const a = (START + (lo + s / steps * (hi - lo)) * SWEEP) * Math.PI / 180;
          c.beginPath();
          c.moveTo(cx + (R - 19) * Math.cos(a), cy + (R - 19) * Math.sin(a));
          c.lineTo(cx + (R - 5) * Math.cos(a), cy + (R - 5) * Math.sin(a));
          c.stroke();
        }
      }
      // ticks and the 0…6k labels
      c.font = "700 13px 'Courier New', monospace";
      c.textAlign = "center"; c.textBaseline = "middle";
      for (let i = 0; i <= 30; i++) {
        const frac = i / 30, major = i % 5 === 0;
        const a = (START + frac * SWEEP) * Math.PI / 180;
        const inner = R - (major ? 26 : 12);
        c.strokeStyle = major ? "#cdd0da" : "#414450";
        c.lineWidth = major ? 2 : 1;
        c.beginPath();
        c.moveTo(cx + inner * Math.cos(a), cy + inner * Math.sin(a));
        c.lineTo(cx + (R - 7) * Math.cos(a), cy + (R - 7) * Math.sin(a));
        c.stroke();
        if (major) {
          const v = Math.round(REDLINE_RPM * frac / 1000);
          c.fillStyle = "#9497a5";
          c.fillText(v ? v + "k" : "0", cx + (R - 44) * Math.cos(a), cy + (R - 44) * Math.sin(a));
        }
      }
      return g;
    };

    let face = null, faceR = 0;
    const start = performance.now();
    let last = start, raf = 0, done = false;

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      window.removeEventListener("keydown", finish, true);
      overlay.removeEventListener("pointerdown", finish);
      try { if (src) src.stop(); } catch {}
      try { if (ac) ac.close(); } catch {}
      overlay.remove();
      resolve();
    };
    window.addEventListener("keydown", finish, true);
    overlay.addEventListener("pointerdown", finish);

    const frame = (now) => {
      if (done) return;
      const t = (now - start) / 1000;
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      if (t >= tl.DONE) { finish(); return; }

      const R = Math.max(90, Math.min(175, Math.min(W, H) * 0.24));
      if (!face || faceR !== R) { face = gaugeFace(R); faceR = R; }
      const GCX = W / 2, GCY = H / 2 - Math.min(60, H * 0.10);
      const rpm = rpmAt(t);

      // shake + flash around the redline hit
      let shx = 0, shy = 0, flash = 0;
      const se = tl.SWEEP_END;
      if (t >= se && t <= se + 0.12) { shx = (Math.random() * 48 - 24); shy = (Math.random() * 30 - 15); }
      else if (t > se + 0.12 && t <= se + 0.55) {
        const i = Math.max(0, 1 - (t - se - 0.12) / 0.43);
        shx = (Math.random() * 2 - 1) * 16 * i; shy = (Math.random() * 2 - 1) * 10 * i;
      }
      if (t >= se && t <= se + 0.06) flash = 1;
      else if (t > se + 0.06 && t <= se + 0.32) flash = Math.max(0, 1 - (t - se - 0.06) / 0.26);
      if (!sparksSpawned && t >= se) { sparksSpawned = true; spawnSparks(GCX, GCY); }

      // ---- paint
      if (flash > 0.95) {
        ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = "#0b0b0f"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#121217"; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < W; x += 20) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = 0; y < H; y += 20) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        if (flash > 0) { ctx.fillStyle = `rgba(255,20,10,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
      }

      // gauge: dark until the engine fires, then lit
      const lit = t < tl.STARTER_END ? 0 : clamp((t - tl.STARTER_END) / 0.30);
      ctx.save();
      ctx.globalAlpha = 0.12 + 0.88 * easeOut(lit, 1.8);
      ctx.drawImage(face, GCX + shx - R - 2, GCY + shy - R - 2, R * 2 + 4, R * 2 + 4);
      ctx.restore();

      // the needle
      const frac = clamp(rpm / REDLINE_RPM);
      const a = (225 + frac * 270) * Math.PI / 180;
      const nx = GCX + shx + (R - 28) * Math.cos(a), ny = GCY + shy + (R - 28) * Math.sin(a);
      if (frac > 0.82) {
        const inten = easeOut((frac - 0.82) / 0.18);
        ctx.strokeStyle = `rgba(255,20,10,${inten * 0.6})`;
        ctx.lineWidth = inten * 14 + 5;
        ctx.beginPath(); ctx.moveTo(GCX + shx, GCY + shy); ctx.lineTo(nx, ny); ctx.stroke();
      }
      ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(GCX + shx + 2, GCY + shy + 2); ctx.lineTo(nx + 2, ny + 2); ctx.stroke();
      ctx.strokeStyle = frac > 0.96 ? RED_HOT : frac > 0.82 ? RED : frac > 0.60 ? AMBER : WHITE;
      ctx.beginPath(); ctx.moveTo(GCX + shx, GCY + shy); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.fillStyle = "#242630"; ctx.beginPath(); ctx.arc(GCX + shx, GCY + shy, 13, 0, 7); ctx.fill();
      ctx.fillStyle = "#cdd0dc"; ctx.beginPath(); ctx.arc(GCX + shx, GCY + shy, 7, 0, 7); ctx.fill();

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.vy += 500 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.life -= dt;
        if (sp.life <= 0) { sparks.splice(i, 1); continue; }
        const f = sp.life / sp.max;
        ctx.globalAlpha = Math.sqrt(f);
        ctx.fillStyle = sp.col;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(1, f * 4), 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // REDLINE DIGITAL — lands as the revs fall
      const rf = clamp((t - tl.BOUNCE_END - 0.10) / 0.80);
      const df = clamp((t - tl.BOUNCE_END - 0.70) / 0.80);
      if (rf > 0.001) {
        const big = Math.max(40, Math.min(82, W * 0.085));
        ctx.font = `800 ${big}px 'Courier New', monospace`;
        ctx.textBaseline = "top";
        const word = "REDLINE";
        const widths = [...word].map(ch => ctx.measureText(ch).width);
        const total = widths.reduce((x, y) => x + y, 0);
        let x0 = (W - total) / 2;
        const ty = GCY + R + Math.max(28, H * 0.05) + 80 * (1 - easeOut(rf * 2.5, 2.5));
        const ca = clamp(1 - rf * 4) * 0.55;
        [...word].forEach((ch, i) => {
          if (ca > 0.03) {
            ctx.globalAlpha = ca; ctx.fillStyle = RED_HOT; ctx.fillText(ch, x0 - 4, ty - 2);
            ctx.globalAlpha = ca / 2; ctx.fillStyle = CYAN; ctx.fillText(ch, x0 + 4, ty + 2);
          }
          ctx.globalAlpha = clamp(rf * 3);
          ctx.fillStyle = i < 3 ? RED : WHITE;
          ctx.fillText(ch, x0, ty);
          ctx.globalAlpha = 1;
          x0 += widths[i];
        });
        if (df > 0.001) {
          const med = Math.max(24, Math.min(46, W * 0.048));
          ctx.font = `800 ${med}px 'Courier New', monospace`;
          ctx.textAlign = "center";
          ctx.globalAlpha = clamp(df * 2.5);
          ctx.fillStyle = TEAL;
          ctx.fillText("DIGITAL", W / 2, ty + big + 6 + 50 * (1 - easeOut(df * 3, 2.0)));
          ctx.globalAlpha = 1;
          ctx.textAlign = "left";
        }
      }

      // the closing fade
      if (t > tl.FADE_OUT) {
        ctx.fillStyle = `rgba(0,0,0,${clamp((t - tl.FADE_OUT) / (tl.DONE - tl.FADE_OUT))})`;
        ctx.fillRect(0, 0, W, H);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

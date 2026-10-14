"""
EMERGENCE - you don't build a universe. You discover one.

Every universe begins as a single point of matter with one random law.
Space expands. Every 1 to 1000 seconds of universe time a brand-new law of
nature is born at random, and space grows a little more each time.
Laws are never removed and never change once born. Nothing is scripted.

How it LOOKS is decided by the universe too: colors, shapes, glow, trails,
bloom, the backdrop... all rolled at birth and permanent. Bonds, scent fog,
heat haze, gravity wells, starlight and the rest only appear once the laws
that create them are born.

Install:  pip install numpy scipy pygame numba
Run:      python emergence.py

Your space agency: a paycheck arrives every minute of universe time. Buy
ships, launch them from the wall of the universe, and let real physics carry
them. Land on a world to found a colony; colonies mine it (that matter is
gone for good) and earn money - until the universe's own laws kill them.

Some universes also hold alien civilizations (rolled at birth, like everything
else). They arrive from the walls, colonize, mine, and - depending on their
nature - go to war. Warships and colony turrets fight automatically.
AUTO mode buys a random affordable item every 1-1000 seconds so you can just watch.

Controls (in a universe):
  SPACE pause   + / - time speed   J fast-forward to next law
  B agency (ships + upgrades)   click a world/colony/ship to inspect it
  L law history   I constants of nature   H hide HUD   C re-center camera
  F5 save   ESC menu (settings, saves, main menu)
  mouse: drag to pan, wheel to zoom, right-click cancels
"""
import sys
import os
import math
import time
import json
import pickle
import colorsys
import datetime
import importlib.util

import numpy as np


# --------------------------------------------------------------------------
# folders (next to the exe / script, or in AppData if that isn't writable)
# --------------------------------------------------------------------------
def base_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def data_dir():
    """Saves, settings and the physics cache all live in ONE folder in the user's AppData
    (%LOCALAPPDATA%\\Redline Digital\\Emergence) - the game never drops files next to the .exe."""
    if os.name == "nt":
        root = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
        d = os.path.join(root, "Redline Digital", "Emergence")
    else:
        d = os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share"),
                         "Redline Digital", "Emergence")
    os.makedirs(d, exist_ok=True)
    # one-time move of saves/settings from older versions (they used to sit next to the game)
    try:
        import shutil
        old = base_dir()
        for name in ("saves", "config.json"):
            src, dst = os.path.join(old, name), os.path.join(d, name)
            if os.path.exists(src) and not os.path.exists(dst):
                shutil.move(src, dst)
        oc = os.path.join(old, "cache")
        if os.path.isdir(oc):
            shutil.rmtree(oc, ignore_errors=True)
    except Exception:
        pass
    return d


DATA = data_dir()
SAVE_DIR = os.path.join(DATA, "saves")
CONFIG_PATH = os.path.join(DATA, "config.json")


def load_config():
    cfg = {"reduce_flash": False, "music": 60, "gpu": True, "fullscreen": False, "max_sim": True}
    try:
        with open(CONFIG_PATH) as fh:
            cfg.update(json.load(fh))
    except Exception:
        pass
    return cfg


def save_config(cfg):
    try:
        with open(CONFIG_PATH, "w") as fh:
            json.dump(cfg, fh)
    except Exception:
        pass
CACHE_DIR = os.path.join(DATA, "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
os.environ.setdefault("NUMBA_CACHE_DIR", CACHE_DIR)

import pygame  # noqa: E402

MUSIC_END = pygame.USEREVENT + 7
MUSIC_FILES = ["Deep_Space.mp3", "Deep_Space_1.mp3"]
MUSIC_OPTS = [0, 10, 25, 40, 60, 80, 100]


def find_music():
    """Every mp3/ogg in an assets folder (inside the .exe or next to it), or next to the game itself."""
    roots = [getattr(sys, "_MEIPASS", None), base_dir(), os.path.dirname(os.path.abspath(__file__))]
    found = []
    seen = set()
    for r in roots:
        if not r:
            continue
        for folder in (os.path.join(r, "assets"), os.path.join(r, "music"), r):
            if not os.path.isdir(folder):
                continue
            for fn in sorted(os.listdir(folder), key=lambda f: os.path.splitext(f)[0].lower()):
                if fn.lower().endswith((".mp3", ".ogg", ".wav")) and fn.lower() not in seen:
                    seen.add(fn.lower())
                    found.append(os.path.join(folder, fn))
    return found


def asset_path(name):
    """Find a bundled file: inside the .exe, in an assets folder, or next to the game."""
    roots = [getattr(sys, "_MEIPASS", None), base_dir(), os.path.dirname(os.path.abspath(__file__))]
    for r in roots:
        if not r:
            continue
        for p in (os.path.join(r, "assets", name), os.path.join(r, name)):
            if os.path.exists(p):
                return p
    return None

try:
    from scipy.spatial import cKDTree
except Exception:
    cKDTree = None

W, H = 1280, 800
NB = 96                 # force curve resolution
KMAX = 12               # kinds of matter
TPS = 30                # universe ticks per second of game time at x1 (lower = calmer, slower motion)
PHYS_TPS = 60           # ticks per second the physics was tuned for (ship fuel etc. stay fair)
FS = 80                 # scent field resolution
GS = 48                 # gravity / heat grid resolution
LET = "ABCDEFGHIJKL"
DAY = 86400.0
COS_PER_TICK = DAY / 30  # universe seconds one physics step stands for (default speed = 1 day per real second)
# speed ladder, in universe seconds per real second (like Universe Sandbox)
RATES = [1.0, 60.0, 600.0, 3600.0, 6 * 3600.0, DAY, 2 * DAY, 4 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 60 * DAY,
         120 * DAY, 182 * DAY, 365.25 * DAY, 730.5 * DAY]
DEFAULT_RATE = RATES.index(DAY)
SPEEDS = [r / DAY for r in RATES]          # as multiples of the default speed


def fmt_rate(r):
    """Universe seconds per real second -> '1 day / sec'."""
    if r < 1.5:
        return "real time (1 sec / sec)"
    if r < 3600:
        return "%g min / sec" % round(r / 60, 1)
    if r < DAY:
        return "%g hour%s / sec" % (round(r / 3600, 1), "" if r < 5400 else "s")
    if r < 30 * DAY:
        d = r / DAY
        if abs(d - 7) < 0.6 or abs(d - 14) < 0.6:
            return "%d week%s / sec" % (round(d / 7), "" if d < 10 else "s")
        return "%g day%s / sec" % (round(d, 1), "" if d < 1.5 else "s")
    if r < 365 * DAY:
        mo = r / (30 * DAY)
        return "%g month%s / sec" % (round(mo), "" if mo < 1.5 else "s")
    y = r / (365.25 * DAY)
    return "%g year%s / sec" % (round(y, 1), "" if y < 1.5 else "s")
BIGKEY = 1 << 24
X = (np.arange(NB) + 0.5) / NB
MATTER_OPTS = ["Auto", 1000, 2000, 3000, 5000, 8000, 12000, 20000, "Unlimited"]
QUALITY_OPTS = ["Low", "Medium", "High"]
KN_MULT = {"Low": 0.45, "Medium": 0.7, "High": 1.0}


# ==========================================================================
# FAST PHYSICS KERNELS (Numba). Written to a real file so the compiled code
# can be cached between launches - even inside the .exe.
# ==========================================================================
KERNEL_SRC = r'''
import numpy as np
from numba import njit, prange


@njit(cache=True, nogil=True)
def _cell_sort(pos, cs, nc, cell, start):
    N = pos.shape[0]
    for i in range(N):
        cx = int(pos[i, 0] / cs)
        cy = int(pos[i, 1] / cs)
        if cx >= nc:
            cx = nc - 1
        if cy >= nc:
            cy = nc - 1
        if cx < 0:
            cx = 0
        if cy < 0:
            cy = 0
        cell[i] = cx * nc + cy
    for c in range(nc * nc + 1):
        start[c] = 0
    for i in range(N):
        start[cell[i] + 1] += 1
    for c in range(nc * nc):
        start[c + 1] += start[c]
    # counting sort (much faster than argsort)
    fill = start[:-1].copy()
    order = np.empty(N, np.int64)
    for i in range(N):
        c = cell[i]
        order[fill[c]] = i
        fill[c] += 1
    return order


@njit(cache=True, parallel=True, fastmath=True, nogil=True)
def neighbors(pos, L, rmax, kn, idx, dd):
    """k nearest neighbours within rmax. Fine grid + ring-by-ring search that stops as soon as
    no closer particle can exist, so dense planets cost about the same as empty space."""
    N = pos.shape[0]
    # cell size follows the crowd: ~2 particles per cell on average (dense universes get fine
    # cells), at least 4 cells per force range, at most 16, never more than ~4 cells per particle
    nc = int(max(L / (rmax / 4.0), np.sqrt(N / 2.0)))
    hi = int(min(L / (rmax / 16.0), 2.0 * np.sqrt(N) + 3))
    if nc > hi:
        nc = hi
    if nc > 4096:
        nc = 4096
    if nc < 3:
        nc = 1
    cs = L / nc
    R = int(np.ceil(rmax / cs))
    if 2 * R + 1 > nc:            # tiny universe: just look at every cell once
        nc = 1
        cs = L
        R = 0
    cell = np.empty(N, np.int64)
    start = np.empty(nc * nc + 1, np.int64)
    order = _cell_sort(pos, cs, nc, cell, start)
    sp = np.empty((N, 2))
    for q in range(N):            # positions in cell order: neighbours sit next to each other in memory
        sp[q, 0] = pos[order[q], 0]
        sp[q, 1] = pos[order[q], 1]
    r2 = rmax * rmax
    h = 0.5 * L
    for i in prange(N):
        for m in range(kn):
            idx[i, m] = -1
            dd[i, m] = 1e30
        cnt = 0
        px = pos[i, 0]
        py = pos[i, 1]
        cx = cell[i] // nc
        cy = cell[i] % nc
        for r in range(R + 1):
            if r >= 2:
                lim = (r - 1) * cs
                lim2 = lim * lim
                if lim2 >= r2:
                    break
                if cnt == kn and lim2 >= dd[i, kn - 1]:
                    break
            for ox in range(-r, r + 1):
                edge_x = ox == -r or ox == r
                for oy in range(-r, r + 1):
                    if not edge_x and oy != -r and oy != r:
                        continue
                    c = ((cx + ox) % nc) * nc + (cy + oy) % nc
                    for q in range(start[c], start[c + 1]):
                        j = order[q]
                        if j == i:
                            continue
                        dx = sp[q, 0] - px
                        if dx > h:
                            dx -= L
                        elif dx < -h:
                            dx += L
                        dy = sp[q, 1] - py
                        if dy > h:
                            dy -= L
                        elif dy < -h:
                            dy += L
                        d2 = dx * dx + dy * dy
                        if d2 >= r2:
                            continue
                        if cnt < kn:
                            m = cnt
                            cnt += 1
                        elif d2 < dd[i, kn - 1]:
                            m = kn - 1
                        else:
                            continue
                        while m > 0 and dd[i, m - 1] > d2:
                            idx[i, m] = idx[i, m - 1]
                            dd[i, m] = dd[i, m - 1]
                            m -= 1
                        idx[i, m] = j
                        dd[i, m] = d2
        for m in range(cnt):
            dd[i, m] = np.sqrt(dd[i, m])


@njit(cache=True, parallel=True, fastmath=True, nogil=True)
def forces(pos, types, idx, dd, L, rmax, nb, Tout, Tin, Tperp, crowd, sat, ax, ay, cnt):
    N = idx.shape[0]
    kn = idx.shape[1]
    h = 0.5 * L
    for i in prange(N):
        fx = 0.0
        fy = 0.0
        cx = 0.0
        cy = 0.0
        n = 0
        ti = types[i]
        for m in range(kn):
            j = idx[i, m]
            if j < 0:
                break
            n += 1
            dx = pos[j, 0] - pos[i, 0]
            if dx > h:
                dx -= L
            elif dx < -h:
                dx += L
            dy = pos[j, 1] - pos[i, 1]
            if dy > h:
                dy -= L
            elif dy < -h:
                dy += L
            d = dd[i, m] + 1e-9
            ux = dx / d
            uy = dy / d
            b = int(d / rmax * nb)
            if b > nb - 1:
                b = nb - 1
            tj = types[j]
            f = Tout[ti, tj, b]
            p = Tperp[ti, tj, b]
            c = Tin[ti, tj, b]
            fx += f * ux - p * uy
            fy += f * uy + p * ux
            cx += c * ux
            cy += c * uy
        damp = (1.0 + n / crowd) ** (-sat)
        ax[i] = fx * damp * 2.0 + cx
        ay[i] = fy * damp * 2.0 + cy
        cnt[i] = n


@njit(cache=True, parallel=True, fastmath=True, nogil=True)
def refresh(pos, L, rmax, idx, dd):
    """Reuse last tick's neighbour lists: just re-measure the distances and drop anyone out of range."""
    N = idx.shape[0]
    kn = idx.shape[1]
    h = 0.5 * L
    for i in prange(N):
        w = 0
        for m in range(kn):
            j = idx[i, m]
            if j < 0:
                break
            dx = pos[j, 0] - pos[i, 0]
            if dx > h:
                dx -= L
            elif dx < -h:
                dx += L
            dy = pos[j, 1] - pos[i, 1]
            if dy > h:
                dy -= L
            elif dy < -h:
                dy += L
            d = np.sqrt(dx * dx + dy * dy)
            if d < rmax:
                idx[i, w] = j
                dd[i, w] = d
                w += 1
        for m in range(w, kn):
            idx[i, m] = -1
            dd[i, m] = 1e30


@njit(cache=True, parallel=True, fastmath=True, nogil=True)
def school(types, idx, heading, k, s, out):
    """Swimmers of kind k turn toward the average heading of same-kind neighbours."""
    N = idx.shape[0]
    kn = idx.shape[1]
    for i in prange(N):
        out[i] = heading[i]
        if types[i] != k:
            continue
        cx = 0.0
        cy = 0.0
        n = 0
        for m in range(kn):
            j = idx[i, m]
            if j < 0:
                break
            if types[j] == k:
                cx += np.cos(heading[j])
                cy += np.sin(heading[j])
                n += 1
        if n > 0:
            want = np.arctan2(cy, cx)
            diff = (want - heading[i] + np.pi) % (2 * np.pi) - np.pi
            out[i] = heading[i] + diff * s


@njit(cache=True, parallel=True, fastmath=True, nogil=True)
def steer(pos, vel, types, idx, dd, L, hunts, flocks, vx, vy):
    """Hunting/fleeing and flocking, straight from each particle's neighbour list."""
    N = idx.shape[0]
    kn = idx.shape[1]
    h = 0.5 * L
    for i in prange(N):
        ti = types[i]
        for q in range(hunts.shape[0]):
            if ti != int(hunts[q, 0]):
                continue
            tb = int(hunts[q, 1])
            rng = hunts[q, 3]
            sx = 0.0
            sy = 0.0
            for m in range(kn):
                j = idx[i, m]
                if j < 0:
                    break
                if types[j] != tb or dd[i, m] >= rng:
                    continue
                dx = pos[j, 0] - pos[i, 0]
                if dx > h:
                    dx -= L
                elif dx < -h:
                    dx += L
                dy = pos[j, 1] - pos[i, 1]
                if dy > h:
                    dy -= L
                elif dy < -h:
                    dy += L
                w = 1.0 / (dd[i, m] + 1e-9)
                sx += dx * w
                sy += dy * w
            mag = np.sqrt(sx * sx + sy * sy)
            if mag > 0:
                vx[i] += hunts[q, 2] * sx / mag
                vy[i] += hunts[q, 2] * sy / mag
        for q in range(flocks.shape[0]):
            if ti != int(flocks[q, 0]):
                continue
            c = 0
            mx = 0.0
            my = 0.0
            for m in range(kn):
                j = idx[i, m]
                if j < 0:
                    break
                if types[j] != ti:
                    continue
                c += 1
                mx += vel[j, 0]
                my += vel[j, 1]
            if c > 0:
                vx[i] += flocks[q, 1] * (mx / c - vel[i, 0])
                vy[i] += flocks[q, 1] * (my / c - vel[i, 1])


@njit(cache=True, parallel=True, nogil=True)
def touching(types, idx, dd, a, cat, radius, out):
    """How many neighbours of kind cat each particle of kind a is touching."""
    N = idx.shape[0]
    kn = idx.shape[1]
    for i in prange(N):
        c = 0
        if types[i] == a:
            for m in range(kn):
                j = idx[i, m]
                if j < 0:
                    break
                if types[j] == cat and dd[i, m] < radius:
                    c += 1
        out[i] = c


@njit(cache=True, fastmath=True, nogil=True)
def bonds(pos, bi, bj, rest, k, brk, L, ax, ay, keep):
    h = 0.5 * L
    for b in range(bi.shape[0]):
        i = bi[b]
        j = bj[b]
        dx = pos[j, 0] - pos[i, 0]
        if dx > h:
            dx -= L
        elif dx < -h:
            dx += L
        dy = pos[j, 1] - pos[i, 1]
        if dy > h:
            dy -= L
        elif dy < -h:
            dy += L
        d = np.sqrt(dx * dx + dy * dy) + 1e-9
        f = k[b] * (d - rest[b])
        fx = f * dx / d
        fy = f * dy / d
        ax[i] += fx
        ay[i] += fy
        ax[j] -= fx
        ay[j] -= fy
        keep[b] = d < rest[b] * brk[b]
'''

KERNELS = None


def _compile_kernels():
    path = os.path.join(CACHE_DIR, "emergence_kernels.py")
    old = None
    if os.path.exists(path):
        with open(path) as fh:
            old = fh.read()
    if old != KERNEL_SRC:
        with open(path, "w") as fh:
            fh.write(KERNEL_SRC)
    spec = importlib.util.spec_from_file_location("emergence_kernels", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["emergence_kernels"] = mod
    if CACHE_DIR not in sys.path:
        sys.path.insert(0, CACHE_DIR)
    spec.loader.exec_module(mod)
    # warm up (compiles on first launch, loads from cache afterwards)
    n = 16
    pos = np.random.default_rng(0).uniform(0, 100, (n, 2))
    types = np.zeros(n, np.int64)
    idx = np.empty((n, 4), np.int64)
    dd = np.empty((n, 4))
    mod.neighbors(pos, 100.0, 30.0, 4, idx, dd)
    T = np.zeros((KMAX, KMAX, NB))
    ax, ay, cnt = np.zeros(n), np.zeros(n), np.zeros(n, np.int64)
    mod.forces(pos, types, idx, dd, 100.0, 30.0, NB, T, T, T, 10.0, 0.5, ax, ay, cnt)
    bi = np.array([0], np.int64)
    bj = np.array([1], np.int64)
    one = np.ones(1)
    keep = np.ones(1, np.bool_)
    mod.bonds(pos, bi, bj, one, one, one * 2, 100.0, ax, ay, keep)
    mod.steer(pos, np.zeros((n, 2)), types, idx, dd, 100.0, np.zeros((1, 4)), np.zeros((1, 2)), ax, ay)
    mod.touching(types, idx, dd, 0, 0, 1.0, cnt)
    mod.refresh(pos, 100.0, 30.0, idx, dd)
    mod.school(types, idx, np.zeros(n), 0, 0.1, np.zeros(n))
    return mod


def _clear_kernel_cache():
    for root, _, files in os.walk(CACHE_DIR):
        for fn in files:
            if fn.endswith((".nbi", ".nbc")) or fn.startswith("emergence_kernels"):
                try:
                    os.remove(os.path.join(root, fn))
                except Exception:
                    pass
    sys.modules.pop("emergence_kernels", None)


def load_kernels():
    """Compile (or load cached) Numba kernels. Falls back to numpy if Numba is missing."""
    global KERNELS
    try:
        import numba  # noqa: F401
    except Exception as ex:
        print("Numba not installed, using slower numpy physics:", ex)
        KERNELS = None
        return None
    for attempt in range(2):
        try:
            KERNELS = _compile_kernels()
            return KERNELS
        except Exception as ex:
            print("Numba kernel load failed (attempt %d): %s" % (attempt + 1, ex))
            _clear_kernel_cache()
    KERNELS = None
    return None


def np_neighbors(pos, L, rmax, kn):
    N = len(pos)
    k = min(kn + 1, N)
    dd, idx = cKDTree(pos, boxsize=L).query(pos, k=k, distance_upper_bound=rmax, workers=-1)
    dd = np.asarray(dd).reshape(N, k)[:, 1:]
    idx = np.asarray(idx).reshape(N, k)[:, 1:]
    idx = np.where(idx < N, idx, -1)
    if idx.shape[1] < kn:
        pad = kn - idx.shape[1]
        idx = np.hstack([idx, np.full((N, pad), -1)])
        dd = np.hstack([dd, np.full((N, pad), 1e30)])
    return idx.astype(np.int64), dd


def wrapd(d, L):
    h = L * 0.5
    d = np.where(d > h, d - L, d)
    return np.where(d < -h, d + L, d)


def fmt_time(ticks):
    """A span of universe time (ticks) in universe units: years, days, hours."""
    s = int(ticks * COS_PER_TICK)
    y, s = divmod(s, int(365.25 * DAY))
    d, s = divmod(s, int(DAY))
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    if y:
        return "%dy %03dd" % (y, d)
    if d:
        return "%dd %02dh" % (d, h)
    if h:
        return "%dh %02dm" % (h, m)
    return "%dm %02ds" % (m, s)


def K_(k):
    return (LET[k], k)


def T_(s):
    return (s, -1)


RESERVE_FRAC = 0.95          # births, fountains and the vacuum stop here; the last 5% is kept for new laws

LAW_NAMES = {
    "matter": "new matter", "force": "forces", "spin": "spin", "charge": "charge", "bond": "bonds",
    "light": "light & stars", "motor": "swimming", "scent": "scents", "currents": "cosmic currents",
    "blackhole": "black holes", "wormhole": "wormholes", "heat": "heat", "freeze": "freezing",
    "flock": "flocking", "vacuum": "creation from nothing", "gravity": "gravity", "reaction": "chemistry",
    "decay": "decay", "feed": "feeding", "phase": "phase changes", "aging": "aging", "hunt": "hunting",
    "split": "life", "mutate": "mutation", "heredity": "genes", "partner": "partners", "share": "energy sharing",
    "signal": "signals", "starmove": "moving stars", "supernova": "supernovas", "cycle": "day & seasons",
    "temperature": "changing temperature", "friction": "changing friction", "lightspeed": "changing speed of light",
    "reach": "changing force range", "inflation": "inflation", "magnet": "magnetism", "coriolis": "universal spin",
    "tunnel": "tunneling", "antigrav": "antigravity", "tides": "tides", "storm": "storms",
    "thick": "thick regions", "barrier": "barriers", "symbiosis": "symbiosis", "fission": "fission",
    "align": "schooling", "size": "swelling & shrinking", "mass": "changing mass", "volatile": "volatile matter",
    "fountain": "fountains", "shock": "shockwaves", "lightning": "lightning", "thrust": "energy into speed",
    "bondmod": "brittle & strong bonds", "infect": "infection", "bounce": "bounciness", "fertile": "fertility",
}

PARTICLE_ARRAYS = ["pos", "vel", "types", "energy", "heading", "genes", "born", "sig", "uid", "pid", "clu", "wcd"]
WARP_COOLDOWN = 3 * TPS        # after going through a wormhole, matter can't enter another one for a moment


# ==========================================================================
# THE UNIVERSE
# ==========================================================================
class Universe:
    def __init__(self, seed):
        self.seed = int(seed)
        g = np.random.default_rng(self.seed)
        self.lawrng = np.random.default_rng(g.integers(2 ** 62))
        self.chance = np.random.default_rng(g.integers(2 ** 62))

        # ---- constants of nature (wide, uneven ranges so extreme universes really happen) ----
        def lu(lo, hi):
            return float(np.exp(g.uniform(math.log(lo), math.log(hi))))
        self.rmax = lu(20, 100)
        self.rmax0 = self.rmax
        self.Lmax = self.rmax * lu(20, 140)
        self.L0 = self.rmax * float(g.uniform(3, 6))
        self.L = self.L0
        self.boost = 1.0                                   # extra space gained from laws
        self.inflation = float(g.uniform(0.05, 0.8))
        self.tau_inf = lu(300, 9000)
        self.tau = lu(30000, 900000)
        self.friction = 1 - lu(0.005, 0.35)
        self.maxspeed = self.rmax * lu(0.01, 0.07)
        self.temperature = lu(0.01, 0.6) if g.random() < 0.5 else 0.0
        self.repulsion = lu(0.5, 8)
        self.force_scale = lu(0.02, 0.8)
        self.kn = int(g.integers(6, 41))
        self.crowd = lu(4, 80)
        self.saturation = float(g.uniform(0, 1.2))
        self.huebase = float(g.random())
        # ---- personality: this universe's own odds for every kind of law, and laws it can never have ----
        pg = np.random.default_rng([self.seed, 777])
        self.lawbias = {n: float(np.exp(pg.normal(0, 1.0))) for n in LAW_NAMES}
        self.forbidden = sorted(n for n in LAW_NAMES if n not in ("matter", "force") and pg.random() < 1 / 6)
        self.ensure()

        # ---- the big bang ----
        k = self._add_kind()
        n0 = int(g.integers(40, 250))
        c = np.array([self.L / 2, self.L / 2])
        ang = g.uniform(0, 2 * np.pi, n0)
        p = c + g.normal(0, self.L * 0.02, (n0, 2))
        v = np.stack([np.cos(ang), np.sin(ang)], 1) * (self.maxspeed * g.uniform(0.3, 1.0, n0))[:, None]
        self._spawn(k, p, v)
        # law #1 is written at the moment of birth (at real-time speed the first step is 48 minutes away)
        self._new_law()
        self.next_law = int(self.lawrng.uniform(1, 100) * TPS)

    # ------------------------------------------------- state / compatibility
    def __getstate__(self):
        d = self.__dict__.copy()
        for k in ("_nb", "_cur", "_lc"):          # caches - rebuilt on the fly, no need to save them
            d.pop(k, None)
        return d

    def ensure(self):
        """Fill in any missing state (also upgrades saves from older versions)."""
        N = len(getattr(self, "types", []))
        d = {
            "K": 0, "mass": np.ones(KMAX), "radius": np.full(KMAX, 0.1),
            "Tforce": None, "Tq": np.zeros((KMAX, KMAX, NB)), "Tperp": np.zeros((KMAX, KMAX, NB)),
            "Tin": np.zeros((KMAX, KMAX, NB)), "charge": np.zeros(KMAX), "mobility": np.ones(KMAX),
            "dark": [], "pos": np.zeros((0, 2)), "vel": np.zeros((0, 2)), "types": np.zeros(0, np.int64),
            "energy": np.zeros(N), "heading": np.zeros(N), "genes": None, "born": np.zeros(N, np.int64),
            "sig": np.zeros(N), "pairs": 0, "laws": [], "new_laws": [], "events": [],
            "reactions": [], "decays": [], "vacuum": [], "lights": [], "feeds": [], "motors": [],
            "splits": {}, "mutations": {}, "hered": {}, "fields": [], "bond_laws": [],
            "bi": np.zeros(0, np.int64), "bj": np.zeros(0, np.int64), "bl": np.zeros(0, np.int64),
            "gravity": 0.0, "currents": [], "blackholes": [], "wormholes": [], "heat": None,
            "phases": [], "cycles": [], "aging": [], "hunts": [], "flocks": [], "shares": [], "signals": [],
            "age": 0, "next_law": 0, "boost": 1.0, "Lmax": getattr(self, "L", 1000.0) * 2,
            "settings": {"matter": "Auto", "quality": "High", "graphics": "High"},
            "auto_limit": 4000.0, "temp": None, "gfx": None, "gfy": None, "gpot": None,
            "idx": None, "dd": None, "cnt": np.zeros(N, np.int64),
            "civ": None, "novas": [], "next_uid": 0,
            "rmax0": getattr(self, "rmax", 50.0), "lawbias": {}, "forbidden": [], "name": "",
            "magnets": {}, "coriolis": 0.0, "tunnels": {}, "antigrav": [], "tides": [], "storms": [],
            "visc": None, "walls": [], "symb": [], "fissions": {}, "aligns": {},
            "resized": [], "massed": [], "volatile": {}, "fountains": [], "shocks": [], "lightning": {},
            "thrust": {}, "bondmods": [], "bounce": {}, "bolt_fx": [], "share": np.ones(KMAX), "fertile": [],
        }
        for k, v in d.items():
            if not hasattr(self, k):
                setattr(self, k, v)
        if getattr(self, "Tforce", None) is None:
            self.Tforce = self.Tout.copy() if hasattr(self, "Tout") else np.zeros((KMAX, KMAX, NB))
        self.Tout = self.Tforce + self.Tq
        N = len(self.types)
        if self.genes is None or len(self.genes) != N:
            self.genes = np.ones((N, 5))
            self.genes[:, 4] = 0
        for name in ("energy", "heading", "sig"):
            if len(getattr(self, name)) != N:
                setattr(self, name, np.zeros(N))
        if len(self.born) != N:
            self.born = np.zeros(N, np.int64)
        if not hasattr(self, "uid") or len(self.uid) != N:
            self.uid = np.arange(N, dtype=np.int64)
            self.next_uid = N
        if not hasattr(self, "pid") or len(self.pid) != N:
            self.pid = np.full(N, -1, np.int64)
        if not hasattr(self, "clu") or len(self.clu) != N:
            self.clu = np.full(N, -1, np.int64)
        if not hasattr(self, "wcd") or len(self.wcd) != N:
            self.wcd = np.full(N, -10 ** 9, np.int64)
        for k, v in list(self.splits.items()):
            if not isinstance(v, dict):
                self.splits[k] = {"thr": float(v), "mode": "solo"}
        for lt in self.lights:
            lt.setdefault("svel", None)
            lt.setdefault("orbit", 0.0)
            lt.setdefault("nova", None)
        for fd in self.fields:
            fd.setdefault("toxin", [])
        if self.bond_laws:
            self._bond_arrays()

    # ------------------------------------------------------------- helpers
    def _size(self, t):
        a = self.inflation
        f = a * (1 - math.exp(-t / self.tau_inf)) + (1 - a) * (1 - math.exp(-t / self.tau))
        return (self.L0 + (self.Lmax - self.L0) * f) * self.boost

    def _wrap(self, p):
        p = np.mod(p, self.L)
        p[p >= self.L] = 0.0
        return p

    def limit(self):
        m = self.settings.get("matter", "Auto")
        if m == "Unlimited":
            return float("inf")
        if m == "Auto":
            return self.auto_limit
        return float(m)

    def kn_eff(self):
        return max(4, int(round(self.kn * KN_MULT.get(self.settings.get("quality", "High"), 1.0))))

    def _ev(self, kind, pts, k):
        if len(self.events) > 600 or len(pts) == 0:
            return
        if len(pts) > 6:
            pts = pts[self.chance.choice(len(pts), 6, replace=False)]
        for p in pts:
            self.events.append((kind, float(p[0]), float(p[1]), int(k)))

    def _spawn(self, kinds, p, v, e=None, genes=None):
        room = self.limit() - len(self.types)
        n = int(min(len(p), max(room, 0)))
        if n <= 0:
            return 0
        kinds = np.broadcast_to(np.asarray(kinds, np.int64), (len(p),))[:n]
        if genes is None:
            genes = np.ones((n, 5))
            genes[:, 4] = 0
        self.pos = np.concatenate([self.pos, self._wrap(np.array(p[:n], float))])
        self.vel = np.concatenate([self.vel, np.array(v[:n], float)])
        self.types = np.concatenate([self.types, kinds])
        self.energy = np.concatenate([self.energy, np.zeros(n) if e is None else np.array(e[:n], float)])
        self.heading = np.concatenate([self.heading, self.chance.uniform(0, 2 * np.pi, n)])
        self.genes = np.concatenate([self.genes, np.array(genes[:n], float)])
        self.born = np.concatenate([self.born, np.full(n, self.age, np.int64)])
        self.sig = np.concatenate([self.sig, np.zeros(n)])
        self.wcd = np.concatenate([self.wcd, np.full(n, -10 ** 9, np.int64)])
        self.uid = np.concatenate([self.uid, np.arange(self.next_uid, self.next_uid + n, dtype=np.int64)])
        self.next_uid += n
        self.pid = np.concatenate([self.pid, np.full(n, -1, np.int64)])
        self.clu = np.concatenate([self.clu, np.full(n, -1, np.int64)])
        return n

    def remove_matter(self, idx):
        """Destroy particles (unused by nature - reserved for civilizations)."""
        keep = np.ones(len(self.types), bool)
        keep[np.asarray(idx, np.int64)] = False
        remap = np.cumsum(keep) - 1
        for name in PARTICLE_ARRAYS:
            setattr(self, name, getattr(self, name)[keep])
        ok = keep[self.bi] & keep[self.bj]
        self.bi, self.bj, self.bl = remap[self.bi[ok]], remap[self.bj[ok]], self.bl[ok]
        self.idx = None
        self._nb = None
        self.cnt = np.zeros(len(self.types), np.int64)

    def _allow(self, k, n):
        """How many new particles of kind k nature may create right now.
        Natural creation stops at 95% of the matter limit (the rest is kept for new laws), and
        each kind stops growing at its own random share of the universe."""
        lim = self.limit()
        if lim == float("inf") or n <= 0:
            return int(max(n, 0))
        N = len(self.types)
        room = lim * RESERVE_FRAC - N
        have = int(np.count_nonzero(self.types == k)) if N else 0
        mine = self.share[k] * lim - have
        return int(max(0, min(n, room, mine)))

    def _add_kind(self, dark=False):
        r = self.lawrng
        k = self.K
        self.K += 1
        self.share[k] = float(r.uniform(0.15, 0.9))     # how much of the universe this kind may ever fill
        if r.random() < 0.7:
            self.mass[k] = r.uniform(0.3, 3.0)
        self.radius[k] = r.uniform(0.06, 0.18)
        if dark:
            self.dark.append(k)
        for o in range(self.K):
            self._set_contact(k, o)
            self._set_contact(o, k)
        return k

    def _bright(self):
        return [k for k in range(self.K) if k not in self.dark] or [0]

    def _pick(self):
        b = self._bright()
        return int(b[int(self.lawrng.integers(len(b)))])

    def _other(self, a):
        return int((a + self.lawrng.integers(1, self.K)) % self.K)

    def gainers(self):
        return sorted({lt["k"] for lt in self.lights} | {fd["a"] for fd in self.feeds} |
                      {x["a"] for x in getattr(self, "symb", [])} | {x["b"] for x in getattr(self, "symb", [])})

    def has_stars(self):
        return [n for n, lt in enumerate(self.lights) if lt["stars"] is not None]

    def _rebuild_T(self):
        self.Tout = self.Tforce + self.Tq

    def _curve(self, c, bumps=(1, 4)):
        r = self.lawrng
        f = np.zeros(NB)
        for _ in range(int(r.integers(*bumps))):
            f += r.normal(0, 1) * np.exp(-((X - r.uniform(c, 1)) / r.uniform(0.04, 0.35)) ** 2)
        if r.random() < 0.2:
            f += r.normal(0, 0.5) * np.sin(X * r.uniform(2, 16) * np.pi + r.uniform(0, 2 * np.pi))
        f *= np.clip((1 - X) * 4, 0, 1)
        inner = X < c
        f[inner] *= X[inner] / c
        return f

    @staticmethod
    def _describe(f, c, pos="pulled", neg="pushed"):
        thr = 0.15 * (np.abs(f).max() + 1e-12)
        edges = np.linspace(c, 1, 4)
        words = []
        for name, lo, hi in (("close", edges[0], edges[1]), ("mid", edges[1], edges[2]), ("far", edges[2], edges[3])):
            sel = (X >= lo) & (X < hi)
            m = f[sel].mean() if sel.any() else 0
            if m > thr:
                words.append("%s %s" % (pos, name))
            elif m < -thr:
                words.append("%s %s" % (neg, name))
        return ", ".join(words) if words else "faint ripples"

    # =============================================================== LAWS
    def _new_law(self):
        r = self.lawrng
        K = self.K
        o = {"force": 6.0, "spin": 2.0, "charge": 1.5, "bond": 2.0, "light": 2.0, "motor": 1.5,
             "scent": 1.5, "currents": 1.0, "blackhole": 0.7, "wormhole": 0.6, "heat": 1.0, "freeze": 0.8,
             "flock": 1.2, "vacuum": 1.2, "gravity": 2.0 if self.gravity == 0 else 0.6}
        if K < KMAX:
            o["matter"] = 6.0 if K < 3 else 2.5
        if K >= 2:
            o.update(reaction=2.0, decay=0.8, feed=1.2, phase=2.0, aging=1.2, hunt=1.5)
        if [k for k in self.gainers() if k not in self.splits]:
            o["split"] = 3.0
        if self.splits and K >= 2:
            o["mutate"] = 1.2
        if [k for k in self.splits if k not in self.hered]:
            o["heredity"] = 2.0
        if [k for k, s in self.splits.items() if s["mode"] == "solo"]:
            o["partner"] = 0.8
        if self.bond_laws:
            o.update(share=1.0, signal=1.0)
        if self.has_stars():
            o.update(starmove=0.8, supernova=0.8)
        if self.lights and len(self.cycles) < 3:
            o["cycle"] = 1.0
        o.update(temperature=0.8, friction=0.8, lightspeed=0.7, reach=0.6, inflation=0.5,
                 magnet=1.2, coriolis=0.5, tunnel=0.9, tides=0.6, storm=0.7, thick=0.6, barrier=0.8,
                 symbiosis=1.2)
        if self.gravity > 0:
            o["antigrav"] = 0.7
        if self.gainers() and K >= 2:
            o["fission"] = 1.0
        if self.motors:
            o["align"] = 0.8
        o.update(size=0.9, mass=0.8, volatile=0.8, fountain=0.7, shock=0.6, bounce=0.7, fertile=0.5)
        if K >= 2:
            o["infect"] = 0.9
        if self.gainers():
            o.update(lightning=0.8, thrust=0.8)
        if self.bond_laws:
            o["bondmod"] = 0.8
        # this universe's personality: its own odds, and laws it can never have
        o = {n: v * self.lawbias.get(n, 1.0) for n, v in o.items() if n not in self.forbidden}
        # never repeat a law: every type only gets picked if it still has something NEW to say
        self._lc = lc = self._law_cands()
        o = {n: v for n, v in o.items() if n not in lc or len(lc[n]) > 0}
        if self.laws and len(o) > 1:
            o.pop(self.laws[-1]["type"], None)               # never the same kind of law twice in a row
        if not o:                                            # nothing new left anywhere - space just grows
            self.boost *= 1 + r.uniform(0.01, 0.025)
            return
        names = list(o)
        w = np.array([o[n] for n in names])
        kind = names[int(r.choice(len(names), p=w / w.sum()))]
        parts = getattr(self, "_law_" + kind)()
        self.boost *= 1 + r.uniform(0.01, 0.025)             # space grows a little with every law
        law = {"n": len(self.laws) + 1, "tick": self.age, "type": kind, "parts": parts}
        self.laws.append(law)
        self.new_laws.append(law)

    def _law_cands(self):
        """Everything each law type could still do without repeating an existing law."""
        K = self.K
        B = self._bright()
        allk = range(K)
        nz = lambda T, a, b: bool(np.any(T[a, b] != 0))
        ntype = lambda t: sum(1 for l in self.laws if l["type"] == t)
        c = {}
        c["force"] = [(a, b) for a in B for b in B if not nz(self.Tforce, a, b)]
        c["spin"] = [(a, b) for a in B for b in B if not nz(self.Tperp, a, b)]
        c["charge"] = [k for k in B if self.charge[k] == 0]
        c["freeze"] = [k for k in B if self.mobility[k] == 1.0]
        c["gravity"] = [1] if ntype("gravity") < 3 else []
        c["currents"] = [1] if not self.currents else []
        c["blackhole"] = [1] if len(self.blackholes) < 3 else []
        c["wormhole"] = [1] if len(self.wormholes) < 3 else []
        c["share"] = [1] if not self.shares else []
        c["vacuum"] = [k for k in allk if k not in {v[0] for v in self.vacuum}]
        c["signal"] = [k for k in allk if k not in {s["k"] for s in self.signals}]
        c["light"] = [k for k in allk if k not in {lt["k"] for lt in self.lights}]
        c["motor"] = [k for k in allk if k not in {m["k"] for m in self.motors}]
        c["flock"] = [k for k in allk if k not in {f["k"] for f in self.flocks}]
        hot = {e[0] for e in self.heat["emit"]} if self.heat is not None else set()
        c["heat"] = [k for k in allk if k not in hot]
        pairs = [(a, b) for a in allk for b in allk if a != b]
        rx = {(x[0], x[1], x[2]) for x in self.reactions}
        c["reaction"] = [(a, cat, b) for (a, b) in pairs for cat in allk if (a, cat, b) not in rx]
        dc = {frozenset((x[0], x[1])) for x in self.decays}
        ag = {frozenset((x[0], x[1])) for x in self.aging}
        dec = {(x[0], x[1]) for x in self.decays}
        c["decay"] = [p for p in pairs if p not in dec and frozenset(p) not in dc]
        aged = {x[0] for x in self.aging}
        c["aging"] = [p for p in pairs if p[0] not in aged and frozenset(p) not in ag]
        fd = {frozenset((x["a"], x["b"])) for x in self.feeds}
        c["feed"] = [p for p in pairs if frozenset(p) not in fd]
        hu = {frozenset((x["a"], x["b"])) for x in self.hunts}
        c["hunt"] = [p for p in pairs if frozenset(p) not in hu]
        ph = {(x["a"], x["b"], x["cond"]) for x in self.phases}
        conds = ["hot", "cold", "crowded", "lonely", "fast", "slow"] + (["energetic", "starving"] if self.gainers() else [])
        c["phase"] = [(a, b, cd) for (a, b) in pairs for cd in conds if (a, b, cd) not in ph]
        bd = {tuple(sorted((x["a"], x["b"]))) for x in self.bond_laws}
        c["bond"] = [(a, b) for a in allk for b in allk if a <= b and (a, b) not in bd]
        c["mutate"] = [(a, b) for a in sorted(self.splits) for b in allk
                       if b != a and b not in {m[0] for m in self.mutations.get(a, [])}]
        sp = {frozenset((fd["emit"][0][0], (fd["sense"] or fd["toxin"])[0][0])) for fd in self.fields
              if fd["emit"] and (fd["sense"] or fd["toxin"])}
        self._scent_new = [(a, b) for a in allk for b in allk if frozenset((a, b)) not in sp]
        self._scent_add = [(fi, k, m) for fi, fd in enumerate(self.fields) for k in allk for m, used in
                           (("emit", {e[0] for e in fd["emit"]}), ("sense", {e[0] for e in fd["sense"]})) if k not in used]
        c["scent"] = self._scent_new + self._scent_add
        stars = self.has_stars()
        free = [s for s in stars if self.lights[s]["orbit"] == 0 and self.lights[s]["svel"] is None]
        modes = [m for m, used in (("orbit", any(self.lights[s]["orbit"] != 0 for s in stars)),
                                   ("drift", any(self.lights[s]["svel"] is not None for s in stars))) if not used]
        c["starmove"] = [(s, m) for s in free for m in modes]
        c["supernova"] = [s for s in stars if self.lights[s]["nova"] is None]
        for t, cap in (("temperature", 4), ("friction", 4), ("lightspeed", 4), ("reach", 3), ("inflation", 3)):
            c[t] = [1] if self._count(t) < cap else []
        c["magnet"] = [k for k in allk if k not in self.magnets]
        c["coriolis"] = [1] if not self.coriolis else []
        c["tunnel"] = [k for k in allk if k not in self.tunnels]
        c["antigrav"] = [k for k in allk if k not in self.antigrav]
        c["tides"] = [1] if len(self.tides) < 2 else []
        c["storm"] = [1] if len(self.storms) < 3 else []
        c["thick"] = [1] if self._count("thick") < 2 else []
        c["barrier"] = [k for k in allk if sum(1 for w in self.walls if w["k"] == k) < 2] if len(self.walls) < 6 else []
        c["align"] = [k for k in {m["k"] for m in self.motors} if k not in self.aligns]
        sy = {frozenset((x["a"], x["b"])) for x in self.symb}
        c["symbiosis"] = [(a, b) for a in allk for b in allk if a <= b and frozenset((a, b)) not in sy]
        c["fission"] = [(a, b) for a in self.gainers() for b in allk if a != b and a not in self.fissions]
        c["size"] = [k for k in allk if k not in self.resized]
        c["mass"] = [k for k in allk if k not in self.massed]
        c["volatile"] = [k for k in allk if k not in self.volatile]
        c["fountain"] = [k for k in allk if sum(1 for f in self.fountains if f["k"] == k) < 1] if len(self.fountains) < 3 else []
        c["shock"] = [1] if len(self.shocks) < 2 else []
        c["lightning"] = [k for k in self.gainers() if k not in self.lightning]
        c["thrust"] = [k for k in self.gainers() if k not in self.thrust]
        c["bondmod"] = [i for i in range(len(self.bond_laws)) if i not in self.bondmods]
        rx2 = {(x[0], x[1], x[2]) for x in self.reactions}
        c["infect"] = [(a, b) for a in allk for b in allk if a != b and (b, a, a) not in rx2]
        c["bounce"] = [k for k in allk if k not in self.bounce]
        c["fertile"] = [k for k in allk if self.fertile.count(k) < 2]
        return c

    def _lpick(self, kind):
        lst = self._lc[kind]
        return lst[int(self.lawrng.integers(len(lst)))]

    # ---- matter ----
    def _law_matter(self):
        r = self.lawrng
        N = len(self.types)
        dark = self.K >= 2 and r.random() < 0.15
        k = self._add_kind(dark)
        room = self.limit() - N
        mode = ["cloud", "scatter", "transmute"][int(r.integers(3))]
        if room < 10 and N > 0:
            mode = "transmute"
        label = "Dark matter: " if dark else "New matter: "
        tail = " (it only feels gravity and touch)" if dark else ""
        if mode == "transmute" and N > 0:
            src = int(self.types[r.integers(N)])
            frac = r.uniform(0.05, 0.5)
            m = (self.types == src) & (r.random(N) < frac)
            self.types[m] = k
            return [T_(label), K_(k), T_(" is born out of %d%% of " % round(frac * 100)), K_(src), T_(tail)]
        n = int(min(int(r.integers(20, 300)), max(room, 0)))
        if mode == "cloud":
            p = r.uniform(0, self.L, 2) + r.normal(0, self.L * r.uniform(0.01, 0.08), (n, 2))
        else:
            p = r.uniform(0, self.L, (n, 2))
        n = self._spawn(k, p, r.normal(0, self.maxspeed * 0.3, (n, 2)))
        where = "as a cloud" if mode == "cloud" else "scattered across space"
        return [T_(label), K_(k), T_(" appears %s (%d particles)%s" % (where, n, tail))]

    # ---- forces ----
    def _law_force(self):
        r = self.lawrng
        a, b = self._lpick("force")
        c = self.radius[a] + self.radius[b]
        f = self._curve(c)
        desc = self._describe(f, c)
        f *= self.force_scale * self._wild()
        sym = a != b and r.random() < 0.3 and not np.any(self.Tforce[b, a] != 0)
        self.Tforce[a, b] += f
        if sym:
            self.Tforce[b, a] += f
        self._rebuild_T()
        if a == b:
            return [K_(a), T_(" feels its own kind: " + desc)]
        if sym:
            return [K_(a), T_(" and "), K_(b), T_(" feel each other: " + desc)]
        return [K_(a), T_(" feels "), K_(b), T_(": " + desc + " (one-way)")]

    def _law_spin(self):
        a, b = self._lpick("spin")
        c = self.radius[a] + self.radius[b]
        f = self._curve(c, (1, 3))
        self.Tperp[a, b] += f * self.force_scale * self._wild()
        return [T_("Spin: "), K_(a), T_(" is pushed sideways around "), K_(b), T_(" - swirls and orbits")]

    def _law_charge(self):
        r = self.lawrng
        k = self._lpick("charge")
        q = float(r.uniform(0.5, 1.5) * (1 if r.random() < 0.5 else -1)) * min(self._wild(), 4.0)
        self.charge[k] += q
        curve = np.exp(-X * r.uniform(2, 5)) * np.clip((1 - X) * 4, 0, 1) * self.force_scale * r.uniform(0.6, 1.4)
        for a in range(self.K):
            for b in range(self.K):
                c = self.radius[a] + self.radius[b]
                cv = curve.copy()
                cv[X < c] *= X[X < c] / c
                self.Tq[a, b] = -self.charge[a] * self.charge[b] * cv
        self._rebuild_T()
        sign = "positive" if self.charge[k] > 0 else "negative"
        return [T_("Charge: "), K_(k), T_(" becomes %s - like charges repel, opposites attract" % sign)]

    def _law_gravity(self):
        r = self.lawrng
        first = self.gravity == 0
        self.gravity += float(r.uniform(0.3, 1.0)) * self._wild()
        if first:
            return [T_("GRAVITY awakens: all matter now attracts across the whole universe")]
        if sum(1 for l in self.laws if l["type"] == "gravity") < 2:
            return [T_("Gravity grows stronger")]
        return [T_("Gravity grows stronger still - it has reached its full strength")]

    def _law_currents(self):
        r = self.lawrng
        modes = []
        for _ in range(int(r.integers(2, 6))):
            modes.append((int(r.integers(-3, 4)), int(r.integers(1, 4)), float(r.normal(0, 1)),
                          float(r.uniform(0, 2 * np.pi)), float(r.normal(0, 0.0005))))
        self.currents.append({"modes": modes, "strength": float(r.uniform(0.1, 0.6)) * self._wild()})
        return [T_("Cosmic currents begin to flow through space")]

    def _law_blackhole(self):
        r = self.lawrng
        self.blackholes.append({"c": r.uniform(0, 1, 2), "s": float(r.uniform(0.2, 1.0)) * min(self._wild(), 5.0),
                                "r": float(r.uniform(0.03, 0.1))})
        nth = ["A BLACK HOLE forms", "A second black hole forms", "A third black hole forms"][min(len(self.blackholes) - 1, 2)]
        return [T_(nth + ", pulling matter into orbit")]

    def _law_wormhole(self):
        r = self.lawrng
        a = r.uniform(0, 1, 2)
        b = r.uniform(0, 1, 2)
        for _ in range(20):                      # keep the two mouths well apart
            if np.hypot(*wrapd(b - a, 1.0)) > 0.25:
                break
            b = r.uniform(0, 1, 2)
        self.wormholes.append({"a": a, "b": b,
                               "rad": float(self.rmax * r.uniform(0.6, 1.6))})
        nth = ["A WORMHOLE opens", "A second wormhole opens", "A third wormhole opens"][min(len(self.wormholes) - 1, 2)]
        return [T_(nth + " - matter entering one mouth leaves the other")]

    # ---- chemistry / transformation ----
    def _law_reaction(self):
        r = self.lawrng
        a, cat, b = self._lpick("reaction")
        self.reactions.append((a, cat, b, float(self.rmax * r.uniform(0.15, 0.7)),
                               float(min(10 ** r.uniform(-4, -1) * self._wild(), 0.5))))
        return [T_("Chemistry: "), K_(a), T_(" touching "), K_(cat), T_(" turns into "), K_(b)]

    def _law_decay(self):
        r = self.lawrng
        a, b = self._lpick("decay")
        self.decays.append((a, b, float(min(10 ** r.uniform(-6, -3.5) * self._wild(), 0.01))))
        return [K_(a), T_(" slowly decays into "), K_(b)]

    def _metric(self, cond):
        N = len(self.types)
        if cond in ("hot", "cold"):
            if self.temp is None:
                self._update_grids(force=True)
            if self.temp is None:
                return np.zeros(N)
            gx, gy = self._cells(GS)
            return self.temp[gx, gy]
        if cond in ("crowded", "lonely"):
            return self.cnt.astype(float) if len(self.cnt) == N else np.zeros(N)
        if cond in ("energetic", "starving"):
            return self.energy
        return np.hypot(self.vel[:, 0], self.vel[:, 1])

    def _law_phase(self):
        r = self.lawrng
        a, b, cond = self._lpick("phase")
        above = cond in ("hot", "crowded", "energetic", "fast")
        m = self._metric(cond)
        sel = m[self.types == a] if len(m) else m
        if len(sel) == 0:
            sel = m if len(m) else np.array([1.0])
        thr = float(np.percentile(sel, r.uniform(65, 95) if above else r.uniform(5, 35)))
        self.phases.append({"a": a, "b": b, "cond": cond, "above": above, "thr": thr,
                            "p": float(10 ** r.uniform(-3, -1.3))})
        word = {"hot": "gets hot", "cold": "gets cold", "crowded": "gets crowded", "lonely": "is alone",
                "energetic": "is full of energy", "starving": "runs low on energy", "fast": "moves fast",
                "slow": "sits still"}[cond]
        return [T_("Phase change: "), K_(a), T_(" turns into "), K_(b), T_(" when it " + word)]

    def _law_freeze(self):
        r = self.lawrng
        k = self._lpick("freeze")
        if r.random() < 0.5:
            self.mobility[k] = 0.0
            return [K_(k), T_(" crystallizes - it can never move again")]
        self.mobility[k] *= float(r.uniform(0.1, 0.4))
        return [K_(k), T_(" becomes heavy and sluggish")]

    def _law_aging(self):
        r = self.lawrng
        a, b = self._lpick("aging")
        life = float(r.uniform(20, 900) * TPS)
        self.aging.append((a, b, life))
        return [T_("Aging: "), K_(a), T_(" grows old after ~%s and becomes " % fmt_time(life)), K_(b)]

    def _law_vacuum(self):
        r = self.lawrng
        k = self._lpick("vacuum")
        rate = float(10 ** r.uniform(-2.5, -0.5)) * self._wild()
        self.vacuum.append((k, rate))
        return [T_("Empty space creates "), K_(k), T_(" from nothing (~%.2g per second)" % (rate * TPS))]

    # ---- structure ----
    def _law_bond(self):
        r = self.lawrng
        a, b = self._lpick("bond")
        c = self.radius[a] + self.radius[b]
        form = c * r.uniform(1.05, 1.8)
        law = {"a": a, "b": b, "form": float(form), "rest": float(form * r.uniform(0.7, 1.1)),
               "k": float(r.uniform(0.01, 0.15)), "brk": float(r.uniform(1.4, 3.5)), "max": int(r.integers(1, 7))}
        self.bond_laws.append(law)
        self._bond_arrays()
        if a == b:
            return [K_(a), T_(" can bond to its own kind (up to %d bonds each)" % law["max"])]
        return [K_(a), T_(" and "), K_(b), T_(" can bond together (up to %d bonds each)" % law["max"])]

    def _bond_arrays(self):
        fs = self.force_scale * 4
        self.b_k = np.array([bl["k"] for bl in self.bond_laws]) * fs
        self.b_rest = np.array([bl["rest"] for bl in self.bond_laws])
        self.b_brk = np.array([bl["brk"] for bl in self.bond_laws])

    def _law_share(self):
        r = self.lawrng
        self.shares.append(float(10 ** r.uniform(-3, -1)))
        return [T_("Bonded matter now shares its energy with its partners")]

    def _law_signal(self):
        r = self.lawrng
        k = self._lpick("signal")
        thr = float(10 ** r.uniform(-1, 1)) if self.gainers() else 0.0
        self.signals.append({"k": k, "thr": thr, "kick": float(self.maxspeed * r.uniform(0.2, 1.0)),
                             "p": float(10 ** r.uniform(-3, -1.5))})
        return [T_("Signals: "), K_(k), T_(" can fire pulses that race along its bonds")]

    # ---- energy & stars ----
    def _law_light(self):
        r = self.lawrng
        k = self._lpick("light")
        rate = float(10 ** r.uniform(-3.5, -1.5)) * self._wild()
        lt = {"k": k, "rate": rate, "stars": None, "svel": None, "orbit": 0.0, "nova": None}
        self.lights.append(lt)
        if r.random() < 0.4:
            return [K_(k), T_(" absorbs energy from the background glow of space")]
        n = int(r.integers(1, 6))
        lt["stars"] = (r.uniform(0, 1, (n, 2)), r.uniform(0.03, 0.2, n))
        return [T_("%d star%s ignite%s - " % (n, "s" if n > 1 else "", "" if n > 1 else "s")), K_(k),
                T_(" absorbs their light as energy")]

    def _law_cycle(self):
        r = self.lawrng
        period = float(r.uniform(30, 1200) * TPS)
        self.cycles.append((period, float(r.uniform(0.3, 0.95)), float(r.uniform(0, 2 * np.pi))))
        name = ["Day and night", "Seasons", "Great ages"][min(len(self.cycles) - 1, 2)]
        return [T_("%s: light rises and falls every %s" % (name, fmt_time(period)))]

    def _law_starmove(self):
        r = self.lawrng
        si, mode = self._lpick("starmove")
        lt = self.lights[si]
        if mode == "orbit":
            lt["orbit"] += float(r.normal(0, 0.0004))
            return [T_("Stars begin to orbit the center of the universe")]
        n = len(lt["stars"][0])
        lt["svel"] = r.normal(0, 0.00015, (n, 2))
        return [T_("Stars begin to drift through space")]

    def _law_supernova(self):
        r = self.lawrng
        first = not any(l["type"] == "supernova" for l in self.laws)
        lt = self.lights[self._lpick("supernova")]
        n = len(lt["stars"][0])
        period = float(r.uniform(120, 1800) * TPS)
        lt["nova"] = {"period": period, "next": self.age + r.uniform(0.3, 1.0, n) * period,
                      "kind": int(r.integers(self.K)), "n": int(r.integers(20, 120))}
        head = "SUPERNOVAS: stars now explode" if first else "More stars turn unstable - they explode"
        return [T_(head + " about every %s, seeding new " % fmt_time(period)),
                K_(lt["nova"]["kind"])]

    def _law_feed(self):
        r = self.lawrng
        a, b = self._lpick("feed")
        self.feeds.append({"a": a, "b": b, "rate": float(10 ** r.uniform(-3, -1)) * self._wild(),
                           "rad": float((self.radius[a] + self.radius[b]) * r.uniform(1.0, 2.5) * self.rmax)})
        return [K_(a), T_(" drains energy from "), K_(b), T_(" when they touch")]

    def _law_heat(self):
        r = self.lawrng
        k = self._lpick("heat")
        if self.heat is None:
            self.heat = {"G": np.zeros((GS, GS)), "emit": [], "kick": float(r.uniform(0.2, 1.0)),
                         "diff": float(r.uniform(0.05, 0.22)), "decay": float(10 ** r.uniform(-3, -1.5))}
            first = [T_("HEAT exists: hot regions shake matter - ")]
        else:
            first = []
        self.heat["emit"].append((k, float(r.uniform(0.02, 0.4))))
        return first + [K_(k), T_(" gives off heat")]

    # ---- life ----
    def _law_split(self):
        r = self.lawrng
        cand = [k for k in self.gainers() if k not in self.splits]
        k = int(cand[int(r.integers(len(cand)))])
        thr = float(10 ** r.uniform(0, 1.5))
        mode = "pair" if r.random() < 0.25 else "solo"
        self.splits[k] = {"thr": thr, "mode": mode}
        if mode == "pair":
            return [T_("Life? "), K_(k), T_(" reproduces with a partner once both gather %.1f energy" % thr)]
        return [T_("Life? "), K_(k), T_(" divides in two once it gathers %.1f energy" % thr)]

    def _law_partner(self):
        r = self.lawrng
        cand = sorted(k for k, s in self.splits.items() if s["mode"] == "solo")
        k = int(cand[int(r.integers(len(cand)))])
        self.splits[k]["mode"] = "pair"
        return [K_(k), T_(" now needs a partner to reproduce")]

    def _law_mutate(self):
        r = self.lawrng
        a, b = self._lpick("mutate")
        p = float(10 ** r.uniform(-3, -0.5))
        self.mutations.setdefault(a, []).append((b, p))
        return [T_("Mutation: when "), K_(a), T_(" reproduces, %.1f%% of children are born as " % (p * 100)), K_(b)]

    def _law_heredity(self):
        r = self.lawrng
        cand = sorted(k for k in self.splits if k not in self.hered)
        k = int(cand[int(r.integers(len(cand)))])
        self.hered[k] = float(r.uniform(0.02, 0.15))
        return [T_("GENES: "), K_(k), T_(" passes its traits to its children, with small mutations - evolution begins")]

    def _law_motor(self):
        r = self.lawrng
        k = self._lpick("motor")
        cost = 0.0 if r.random() < 0.4 else float(10 ** r.uniform(-4, -2))
        self.motors.append({"k": k, "thrust": float(self.maxspeed * r.uniform(0.05, 0.4) * min(self._wild(), 4.0)),
                            "turn": float(r.uniform(0.02, 0.6)), "cost": cost})
        return [K_(k), T_(" can swim on its own" + (", burning energy" if cost else ""))]

    def _law_hunt(self):
        r = self.lawrng
        a, b = self._lpick("hunt")
        toward = r.random() < 0.6
        self.hunts.append({"a": a, "b": b, "s": float(self.maxspeed * r.uniform(0.05, 0.3) * (1 if toward else -1)) * min(self._wild(), 4.0),
                           "range": float(self.rmax * r.uniform(0.4, 1.0))})
        return [K_(a), T_(" hunts " if toward else " flees from "), K_(b)]

    def _law_flock(self):
        r = self.lawrng
        k = self._lpick("flock")
        self.flocks.append({"k": k, "s": float(min(r.uniform(0.02, 0.2) * self._wild(), 0.9))})
        return [K_(k), T_(" moves in flocks, matching its neighbors")]

    def _law_scent(self):
        r = self.lawrng
        opts, newp = self._scent_add, self._scent_new
        new = bool(newp) and (not opts or r.random() < 0.5)
        if new:
            em, fo = newp[int(r.integers(len(newp)))]
            mode = ["follow", "flee", "toxin"][int(r.choice(3, p=[0.5, 0.3, 0.2]))]
            st = float(self.maxspeed * r.uniform(0.05, 0.3) * (-1 if mode == "flee" else 1))
            fd = {"G": np.zeros((FS, FS)), "decay": float(10 ** r.uniform(-3, -1)), "diff": float(r.uniform(0.02, 0.24)),
                  "emit": [(em, float(r.uniform(0.05, 1.0)))], "sense": [], "toxin": [], "color": em}
            if mode == "toxin":
                fd["toxin"].append((fo, float(10 ** r.uniform(-4, -2))))
            else:
                fd["sense"].append((fo, st))
            self.fields.append(fd)
            n = len(self.fields)
            what = {"follow": " is drawn to it", "flee": " flees from it", "toxin": " is poisoned by it"}[mode]
            return [K_(em), T_(" leaves scent #%d - " % n), K_(fo), T_(what)]
        fi, k, m = opts[int(r.integers(len(opts)))]
        fd = self.fields[fi]
        if m == "emit":
            fd["emit"].append((k, float(r.uniform(0.05, 1.0))))
            return [K_(k), T_(" also leaves scent #%d" % (fi + 1))]
        st = float(self.maxspeed * r.uniform(0.05, 0.3) * (1 if r.random() < 0.6 else -1))
        fd["sense"].append((k, st))
        return [K_(k), T_((" follows" if st > 0 else " flees") + " scent #%d" % (fi + 1))]

    # ============================================================ the newer laws
    def _wild(self):
        """Most laws are ordinary, a few are feeble, and now and then one is enormous."""
        r = self.lawrng
        u = r.random()
        if u < 0.06:
            return float(np.exp(r.uniform(math.log(0.05), math.log(0.3))))
        if u < 0.88:
            return float(np.exp(r.uniform(math.log(0.6), math.log(1.6))))
        if u < 0.97:
            return float(np.exp(r.uniform(math.log(2.0), math.log(5.0))))
        return float(np.exp(r.uniform(math.log(5.0), math.log(15.0))))

    def _count(self, kind):
        return sum(1 for l in self.laws if l["type"] == kind)

    # ---- constants of nature that change ----
    def _law_temperature(self):
        r = self.lawrng
        old = self.temperature
        if old > 0 and r.random() < 0.2:
            self.temperature = 0.0
            return [T_("ABSOLUTE ZERO: the universe goes perfectly cold - all thermal jitter stops")]
        if old <= 0:
            self.temperature = float(np.exp(r.uniform(math.log(0.01), math.log(0.4))))
        else:
            self.temperature = float(np.clip(old * np.exp(r.uniform(-1.6, 1.6)), 0.003, 1.0))
        word = "heats up" if self.temperature > old else "cools"
        return [T_("The universe %s: temperature %.3f -> %.3f" % (word, old, self.temperature))]

    def _law_friction(self):
        r = self.lawrng
        old = 1 - self.friction
        new = float(np.clip(old * np.exp(r.uniform(-1.4, 1.4)), 0.002, 0.5))
        self.friction = 1 - new
        word = "thickens - everything slows down" if new > old else "thins - motion carries further"
        return [T_("Space %s (friction %.3f -> %.3f)" % (word, old, new))]

    def _law_lightspeed(self):
        r = self.lawrng
        old = self.maxspeed
        self.maxspeed = float(np.clip(old * np.exp(r.uniform(-0.9, 0.9)), self.rmax0 * 0.004, self.rmax0 * 0.15))
        word = "rises" if self.maxspeed > old else "falls"
        return [T_("The speed of light %s: %.2f -> %.2f" % (word, old, self.maxspeed))]

    def _law_reach(self):
        r = self.lawrng
        old = self.rmax
        self.rmax = float(np.clip(old * np.exp(r.uniform(-0.5, 0.5)), self.rmax0 * 0.4, self.rmax0 * 2.5))
        word = "reach farther" if self.rmax > old else "grow short-ranged"
        return [T_("All forces %s: range %.1f -> %.1f" % (word, old, self.rmax))]

    def _law_inflation(self):
        r = self.lawrng
        f = float(r.uniform(1.2, 2.0))
        self.boost *= f
        return [T_("INFLATION: space suddenly balloons to %.1fx its size" % f)]

    # ---- motion ----
    def _law_magnet(self):
        r = self.lawrng
        k = self._lpick("magnet")
        w = float(np.exp(r.uniform(math.log(0.004), math.log(0.06)))) * (1 if r.random() < 0.5 else -1)
        self.magnets[k] = w
        side = "left" if w < 0 else "right"
        return [T_("Magnetism: "), K_(k), T_(" curves to the %s as it moves - spirals and loops" % side)]

    def _law_coriolis(self):
        r = self.lawrng
        self.coriolis = float(np.exp(r.uniform(math.log(0.001), math.log(0.012)))) * (1 if r.random() < 0.5 else -1)
        return [T_("The universe itself starts to spin - everything that moves drifts %s" %
                   ("clockwise" if self.coriolis > 0 else "counter-clockwise"))]

    def _law_tunnel(self):
        r = self.lawrng
        k = self._lpick("tunnel")
        self.tunnels[k] = (float(10 ** r.uniform(-4, -2)), float(r.uniform(0.5, 3.0)))
        return [T_("Tunneling: "), K_(k), T_(" can vanish and reappear a short distance away")]

    def _law_antigrav(self):
        k = self._lpick("antigrav")
        self.antigrav.append(k)
        return [T_("Antigravity: "), K_(k), T_(" is pushed away by gravity instead of pulled")]

    def _law_tides(self):
        r = self.lawrng
        self.tides.append({"amp": float(r.uniform(0.05, 0.25)) * self._wild(), "per": float(r.uniform(60, 900) * TPS),
                           "n": int(r.integers(1, 4)), "ph": float(r.uniform(0, 2 * np.pi)),
                           "ang": float(r.uniform(0, np.pi))})
        nth = "TIDES" if len(self.tides) == 1 else "A second tide"
        return [T_("%s: space stretches and squeezes every %s" % (nth, fmt_time(self.tides[-1]["per"])))]

    def _law_storm(self):
        r = self.lawrng
        self.storms.append({"c": r.uniform(0, 1, 2), "v": r.normal(0, 0.0004, 2), "r": float(r.uniform(0.05, 0.18)),
                            "s": float(r.uniform(0.2, 0.8)) * (1 if r.random() < 0.5 else -1) * min(self._wild(), 3.0)})
        nth = ["A STORM", "A second storm", "A third storm"][min(len(self.storms) - 1, 2)]
        return [T_("%s begins to wander the universe, stirring everything it passes" % nth)]

    def _law_thick(self):
        r = self.lawrng
        n = 16
        g = np.zeros((n, n))
        for _ in range(int(r.integers(2, 7))):
            c = r.uniform(0, n, 2)
            w = r.uniform(1.0, 4.0)
            xx, yy = np.mgrid[0:n, 0:n]
            dx = np.minimum(np.abs(xx - c[0]), n - np.abs(xx - c[0]))
            dy = np.minimum(np.abs(yy - c[1]), n - np.abs(yy - c[1]))
            g += np.exp(-(dx ** 2 + dy ** 2) / w ** 2)
        g = np.clip(g / (g.max() + 1e-9), 0, 1) * float(r.uniform(0.05, 0.3))
        self.visc = g if self.visc is None else np.maximum(self.visc, g)
        return [T_("Thick regions: patches of space turn to syrup and slow everything inside")]

    def _law_barrier(self):
        r = self.lawrng
        k = self._lpick("barrier")
        a = r.uniform(0, 1, 2)
        ang = r.uniform(0, np.pi)
        ln = r.uniform(0.15, 0.45)
        b = a + ln * np.array([math.cos(ang), math.sin(ang)])
        self.walls.append({"a": a, "b": b, "k": k})
        return [T_("An invisible barrier appears - "), K_(k), T_(" can never cross it")]

    def _law_align(self):
        r = self.lawrng
        k = self._lpick("align")
        self.aligns[k] = float(r.uniform(0.05, 0.4))
        return [K_(k), T_(" swims in schools - it turns to face the way its neighbours face")]

    # ---- energy & matter ----
    def _law_symbiosis(self):
        r = self.lawrng
        a, b = self._lpick("symbiosis")
        self.symb.append({"a": a, "b": b, "rate": float(10 ** r.uniform(-3, -1.3)) * self._wild(),
                          "rad": float((self.radius[a] + self.radius[b]) * r.uniform(1.0, 2.5))})
        if a == b:
            return [T_("Community: "), K_(a), T_(" gains energy whenever it touches its own kind")]
        return [T_("Symbiosis: "), K_(a), T_(" and "), K_(b), T_(" both gain energy when they touch")]

    def _law_fission(self):
        r = self.lawrng
        a, b = self._lpick("fission")
        thr = float(10 ** r.uniform(0, 1.5))
        self.fissions[a] = {"b": b, "thr": thr}
        return [T_("Fission: "), K_(a), T_(" splits into two "), K_(b), T_(" once it gathers %.1f energy" % thr)]

    # ---- applying them every tick ----
    def _apply_motion_laws(self, P, types, vx, vy, L, N):
        if self.tides:
            pn = P / L * 2 * np.pi
            for td in self.tides:
                s = td["amp"] * self.maxspeed * 0.2 * math.sin(2 * np.pi * self.age / td["per"] + td["ph"])
                ca, sa = math.cos(td["ang"]), math.sin(td["ang"])
                proj = pn[:, 0] * ca + pn[:, 1] * sa
                f = s * np.sin(td["n"] * proj)
                vx += f * ca
                vy += f * sa
        for st in self.storms:
            st["c"] = (st["c"] + st["v"]) % 1.0
            d = wrapd(P - st["c"] * L, L)
            dist = np.hypot(d[:, 0], d[:, 1]) + 1e-9
            rr = st["r"] * L
            mag = st["s"] * self.maxspeed * 0.25 * np.exp(-(dist / rr) ** 2)
            vx += -d[:, 1] / dist * mag
            vy += d[:, 0] / dist * mag
        if self.aligns and self.idx is not None and len(self.idx) == N and KERNELS is not None \
                and hasattr(KERNELS, "school"):
            out = np.empty(N)
            for k, s in self.aligns.items():
                KERNELS.school(types, self.idx, self.heading, int(k), float(s), out)
                self.heading[:] = out
        elif self.aligns and self.idx is not None and len(self.idx) == N:
            for k, s in self.aligns.items():
                sel = np.nonzero(types == k)[0]
                if not len(sel):
                    continue
                nb = self.idx[sel]
                ok = nb >= 0
                nbc = np.where(ok, nb, 0)
                ok &= types[nbc] == k
                h = self.heading[nbc]
                cx = (np.cos(h) * ok).sum(1)
                cy = (np.sin(h) * ok).sum(1)
                go = ok.any(1)
                if go.any():
                    want = np.arctan2(cy, cx)
                    diff = (want - self.heading[sel] + np.pi) % (2 * np.pi) - np.pi
                    self.heading[sel] += np.where(go, diff * s, 0.0)

    def _apply_velocity_laws(self, v, types, P, L):
        if self.magnets or self.coriolis:
            ang = np.full(len(types), self.coriolis)
            for k, w in self.magnets.items():
                ang[types == k] += w
            c, s = np.cos(ang), np.sin(ang)
            vx = v[:, 0] * c - v[:, 1] * s
            vy = v[:, 0] * s + v[:, 1] * c
            v[:, 0], v[:, 1] = vx, vy
        if self.visc is not None:
            n = self.visc.shape[0]
            gx = (P[:, 0] / L * n).astype(np.int64) % n
            gy = (P[:, 1] / L * n).astype(np.int64) % n
            v *= (1 - self.visc[gx, gy])[:, None]
        return v

    def _apply_walls(self, P, v, types, L):
        """Particles of a wall's kind bounce off it instead of crossing."""
        for w in self.walls:
            sel = np.nonzero(types == w["k"])[0]
            if not len(sel):
                continue
            a = w["a"] * L
            e = (w["b"] - w["a"]) * L
            p0 = wrapd(P[sel] - a, L)
            dv = v[sel]
            den = dv[:, 0] * e[1] - dv[:, 1] * e[0]
            ok = np.abs(den) > 1e-12
            den = np.where(ok, den, 1.0)
            t = (p0[:, 1] * e[0] - p0[:, 0] * e[1]) / den           # along the particle's step
            s = (p0[:, 1] * dv[:, 0] - p0[:, 0] * dv[:, 1]) / den    # along the wall
            hit = ok & (t >= 0) & (t <= 1) & (s >= 0) & (s <= 1)
            if hit.any():
                h = sel[hit]
                nrm = np.array([-e[1], e[0]]) / (np.hypot(*e) + 1e-12)
                dot = v[h] @ nrm
                v[h] -= 2 * dot[:, None] * nrm[None, :]
        return v

    def _apply_tunnels(self, P, types, L):
        ch = self.chance
        for k, (p, dist) in self.tunnels.items():
            hit = np.nonzero((types == k) & (ch.random(len(types)) < p))[0]
            if len(hit):
                ang = ch.uniform(0, 2 * np.pi, len(hit))
                jump = self.rmax * dist
                P[hit] += np.stack([np.cos(ang), np.sin(ang)], 1) * jump
                self._ev("warp", P[hit] % L, k)
        return P

    def _apply_energy_laws(self, types, E, idx, dd, N):
        if not self.symb or idx is None or len(idx) != N:
            return
        tc = np.empty(N, np.int64)
        for sy in self.symb:
            rad = sy["rad"] * self.rmax
            for a, b in ((sy["a"], sy["b"]), (sy["b"], sy["a"])):
                if KERNELS is not None and hasattr(KERNELS, "touching"):
                    KERNELS.touching(types, idx, dd, int(a), int(b), float(rad), tc)
                else:
                    ok = (idx >= 0)
                    nb = np.where(ok, idx, 0)
                    tc = ((types[nb] == b) & ok & (dd < rad)).sum(1) * (types == a)
                E += tc * sy["rate"]
                if a == b:
                    break

    def _apply_fission(self):
        ch = self.chance
        for a, fi in self.fissions.items():
            room = self._allow(fi["b"], 10 ** 9)
            ready = np.nonzero((self.types == a) & (self.energy >= fi["thr"]))[0]
            if not len(ready):
                continue
            n = int(min(len(ready), max(room, 0)))
            self.types[ready] = fi["b"]
            self.energy[ready] *= 0.5
            self._ev("spark", self.pos[ready], fi["b"])
            if n > 0:
                par = ready[:n]
                off = ch.normal(0, 1, (n, 2))
                off /= np.hypot(off[:, 0], off[:, 1])[:, None] + 1e-9
                self._spawn(fi["b"], self.pos[par] + off * self.rmax * self.radius[fi["b"]] * 2,
                            self.vel[par] - off * self.maxspeed * 0.3, self.energy[par])

    # ---- the third wave of laws ----
    def _set_contact(self, a, b):
        """Touch repulsion between kinds a and b (stronger if a is bouncy)."""
        c = self.radius[a] + self.radius[b]
        xi = X / c
        f = getattr(self, "bounce", {}).get(a, 1.0)
        self.Tin[a, b] = np.where(X < c, -self.repulsion * f * np.minimum(1 / xi - 1, 25), 0.0) * self.force_scale

    def _law_size(self):
        r = self.lawrng
        k = self._lpick("size")
        f = float(np.exp(r.uniform(math.log(0.45), math.log(2.2))))
        self.radius[k] = float(np.clip(self.radius[k] * f, 0.03, 0.4))
        self.resized.append(k)
        for o in range(self.K):
            self._set_contact(k, o)
            self._set_contact(o, k)
        if f > 1:
            return [K_(k), T_(" swells to %.1fx its size" % f)]
        return [K_(k), T_(" shrinks to %.0f%% of its size" % (f * 100))]

    def _law_mass(self):
        r = self.lawrng
        k = self._lpick("mass")
        f = float(np.exp(r.uniform(math.log(0.25), math.log(4.0))))
        self.mass[k] *= f
        self.massed.append(k)
        if f > 1:
            return [K_(k), T_(" grows %.1fx heavier - harder to push around" % f)]
        return [K_(k), T_(" becomes %.1fx lighter - easily pushed around" % (1 / f))]

    def _law_volatile(self):
        r = self.lawrng
        k = self._lpick("volatile")
        self.volatile[k] = {"thr": int(r.integers(4, 14)), "p": float(10 ** r.uniform(-3, -1.3)),
                            "kick": float(r.uniform(0.5, 1.0))}
        return [T_("Volatile: "), K_(k), T_(" bursts apart when it is packed too tightly - worlds of it can blow up")]

    def _law_fountain(self):
        r = self.lawrng
        k = self._lpick("fountain")
        self.fountains.append({"c": r.uniform(0, 1, 2), "k": k, "rate": float(10 ** r.uniform(-1.5, 0)) * self._wild(),
                               "ang": float(r.uniform(0, 2 * np.pi)), "spread": float(r.uniform(0.1, np.pi)),
                               "spin": float(r.normal(0, 0.003))})
        nth = "A FOUNTAIN" if len(self.fountains) == 1 else "Another fountain"
        return [T_("%s opens in space, pouring out " % nth), K_(k)]

    def _law_shock(self):
        r = self.lawrng
        per = float(r.uniform(30, 600) * TPS)
        self.shocks.append({"per": per, "next": self.age + per * r.uniform(0.3, 1.0), "R": float(r.uniform(0.08, 0.3)),
                            "s": float(r.uniform(0.5, 1.5)) * min(self._wild(), 3.0)})
        nth = "SHOCKWAVES" if len(self.shocks) == 1 else "A second kind of shockwave"
        return [T_("%s: blasts ripple out from random places every ~%s" % (nth, fmt_time(per)))]

    def _law_lightning(self):
        r = self.lawrng
        k = self._lpick("lightning")
        self.lightning[k] = {"thr": float(10 ** r.uniform(-0.5, 1)), "p": float(10 ** r.uniform(-3, -1.5))}
        return [T_("Lightning: energized "), K_(k), T_(" arcs to its neighbours, passing its energy along")]

    def _law_thrust(self):
        r = self.lawrng
        k = self._lpick("thrust")
        self.thrust[k] = float(self.maxspeed * 10 ** r.uniform(-3, -1.5))
        return [K_(k), T_(" turns its energy into speed - the more it has, the faster it goes")]

    def _law_bondmod(self):
        r = self.lawrng
        li = self._lpick("bondmod")
        bl = self.bond_laws[li]
        strong = r.random() < 0.5
        if strong:
            bl["brk"] *= float(r.uniform(1.4, 2.2))
            bl["k"] *= float(r.uniform(1.2, 2.0))
        else:
            bl["brk"] = max(1.05, bl["brk"] * float(r.uniform(0.45, 0.75)))
        self.bondmods.append(li)
        self._bond_arrays()
        a, b = bl["a"], bl["b"]
        word = "grow stronger and much harder to break" if strong else "become brittle and snap easily"
        if a == b:
            return [T_("Bonds between "), K_(a), T_(" " + word)]
        return [T_("Bonds between "), K_(a), T_(" and "), K_(b), T_(" " + word)]

    def _law_infect(self):
        r = self.lawrng
        a, b = self._lpick("infect")
        self.reactions.append((b, a, a, float(self.rmax * r.uniform(0.2, 0.6)), float(min(10 ** r.uniform(-2.5, -1) * self._wild(), 0.5))))
        return [T_("Infection: "), K_(a), T_(" turns any "), K_(b), T_(" it touches into more "), K_(a)]

    def _law_bounce(self):
        r = self.lawrng
        k = self._lpick("bounce")
        self.bounce[k] = float(r.uniform(2.0, 6.0))
        for o in range(self.K):
            self._set_contact(k, o)
        return [K_(k), T_(" becomes bouncy - it rebounds hard off anything it hits")]

    def _law_fertile(self):
        r = self.lawrng
        k = self._lpick("fertile")
        old = self.share[k]
        new = float(r.uniform(0.15, 0.95))
        if abs(new - old) < 0.1:
            new = float(np.clip(old + (0.25 if old < 0.5 else -0.25), 0.1, 0.95))
        self.share[k] = new
        self.fertile.append(k)
        word = "more fertile" if new > old else "less fertile"
        return [K_(k), T_(" becomes %s - it can now fill up to %d%% of the universe (was %d%%)"
                          % (word, round(new * 100), round(old * 100)))]

    def _apply_wave3(self, P, types, E, N, L):
        """Per-tick effects of the third-wave laws (velocity changes go straight into self.vel)."""
        ch = self.chance
        v = self.vel
        for k, vo in self.volatile.items():
            if len(self.cnt) != N:
                break
            hit = np.nonzero((types == k) & (self.cnt >= vo["thr"]) & (ch.random(N) < vo["p"]))[0]
            if len(hit):
                ang = ch.uniform(0, 2 * np.pi, len(hit))
                v[hit] += np.stack([np.cos(ang), np.sin(ang)], 1) * self.maxspeed * vo["kick"]
                self._ev("spark", P[hit], k)
        for k, sp in self.thrust.items():
            sel = np.nonzero(types == k)[0]
            if len(sel) and sp > 0:
                s = np.hypot(v[sel, 0], v[sel, 1]) + 1e-9
                push = np.minimum(E[sel], 10.0) * sp
                v[sel] += v[sel] / s[:, None] * push[:, None]
                E[sel] *= 0.995
        if self.lightning and self.idx is not None and len(self.idx) == N:
            for k, lg in self.lightning.items():
                hit = np.nonzero((types == k) & (E >= lg["thr"]) & (ch.random(N) < lg["p"]))[0]
                for i in hit[:40].tolist():
                    nb = self.idx[i]
                    nb = nb[nb >= 0]
                    if not len(nb):
                        continue
                    j = int(nb[int(ch.integers(len(nb)))])
                    give = E[i] * 0.5
                    E[i] -= give
                    E[j] += give
                    if len(self.bolt_fx) < 200:
                        self.bolt_fx.append((float(P[i, 0]), float(P[i, 1]), float(P[j, 0]), float(P[j, 1]), int(k)))
        for sh in self.shocks:
            if self.age >= sh["next"]:
                sh["next"] = self.age + sh["per"] * ch.uniform(0.6, 1.4)
                c = ch.uniform(0, L, 2)
                d = wrapd(P - c, L)
                dist = np.hypot(d[:, 0], d[:, 1]) + 1e-9
                R = sh["R"] * L
                near = dist < R
                if near.any():
                    f = (1 - dist[near] / R) * self.maxspeed * sh["s"]
                    v[near] += d[near] / dist[near][:, None] * f[:, None]
                self.events.append(("shock", float(c[0]), float(c[1]), int(R)))

    def _apply_fountains(self):
        ch = self.chance
        for fo in self.fountains:
            n = self._allow(fo["k"], int(ch.poisson(fo["rate"])))
            fo["ang"] += fo["spin"]
            if n <= 0:
                continue
            a = fo["ang"] + ch.uniform(-fo["spread"], fo["spread"], n)
            dirs = np.stack([np.cos(a), np.sin(a)], 1)
            c = fo["c"] * self.L
            self._spawn(fo["k"], c + dirs * self.rmax * 0.3, dirs * self.maxspeed * ch.uniform(0.4, 1.0, n)[:, None])

    # ============================================================= grids
    def _cells(self, n):
        gx = (self.pos[:, 0] / self.L * n).astype(np.int64) % n
        gy = (self.pos[:, 1] / self.L * n).astype(np.int64) % n
        return gx, gy

    def _update_grids(self, force=False):
        N = len(self.types)
        if N == 0:
            return
        gx, gy = self._cells(GS)
        cell = gx * GS + gy
        if self.gravity > 0:
            rho = np.bincount(cell, self.mass[self.types], GS * GS).reshape(GS, GS)
            rk = np.fft.fft2(rho - rho.mean())
            kf = np.fft.fftfreq(GS) * 2 * np.pi
            kx, ky = np.meshgrid(kf, kf, indexing="ij")
            k2 = kx ** 2 + ky ** 2
            k2[0, 0] = 1
            phik = -rk / k2 * np.exp(-k2 * 0.8)
            phik[0, 0] = 0
            fx = np.real(np.fft.ifft2(-1j * kx * phik))
            fy = np.real(np.fft.ifft2(-1j * ky * phik))
            scale = np.percentile(np.hypot(fx, fy), 95) + 1e-12
            s = self.gravity * self.maxspeed * 0.06 / scale
            self.gfx, self.gfy = fx * s, fy * s
            self.gpot = np.real(np.fft.ifft2(phik))
        if self.heat is not None or self.phases or force:
            sp2 = (self.vel[:, 0] ** 2 + self.vel[:, 1] ** 2) / (self.maxspeed ** 2 + 1e-12)
            cnt = np.bincount(cell, minlength=GS * GS)
            kin = (np.bincount(cell, sp2, GS * GS) / np.maximum(cnt, 1)).reshape(GS, GS)
            if self.heat is not None:
                Hh = self.heat["G"]
                for k, rate in self.heat["emit"]:
                    sel = self.types == k
                    if sel.any():
                        Hh += np.bincount(cell[sel], minlength=GS * GS).reshape(GS, GS) * rate * 4
                for _ in range(2):
                    Hh += self.heat["diff"] * (np.roll(Hh, 1, 0) + np.roll(Hh, -1, 0) + np.roll(Hh, 1, 1)
                                               + np.roll(Hh, -1, 1) - 4 * Hh)
                Hh *= (1 - self.heat["decay"]) ** 4
                self.temp = kin + Hh * 0.1
            else:
                self.temp = kin

    def _light_mult(self):
        m = 1.0
        for period, depth, ph in self.cycles:
            m *= 1 - depth * (0.5 - 0.5 * math.cos(2 * math.pi * self.age / period + ph))
        return m

    # ============================================================ ONE TICK
    def step(self):
        while self.age >= self.next_law:
            self._new_law()
            # the window grows 100 s with every law: young universes change fast, old ones slowly
            self.next_law = self.age + int(self.lawrng.uniform(1, 100 * max(len(self.laws), 1)) * TPS)
        if len(self.events) > 800:
            del self.events[:-400]

        newL = self._size(self.age + 1)
        if newL != self.L:
            if self.civ is not None:
                self.civ.rescale(newL / self.L)
            self.pos *= newL / self.L
            self.L = newL
        L, rmax, ch = self.L, self.rmax, self.chance
        self.pos = self._wrap(self.pos)
        P, types = self.pos, self.types
        N = len(types)
        if N == 0:
            if self.civ is not None:
                self.civ.step(self)
            self.age += 1
            return
        kn = self.kn_eff()

        # ---- neighbors and pair forces ----
        if N >= 2:
            if KERNELS is not None:
                # full neighbour search only when matter has moved enough to matter; otherwise
                # reuse the lists and just re-measure distances (a big saving in calm universes)
                nb = getattr(self, "_nb", None)
                fresh = (nb is None or nb["N"] != N or nb["kn"] != kn or nb["L"] != L or nb["rmax"] != rmax
                         or self.age - nb["age"] >= 8 or not hasattr(KERNELS, "refresh"))
                if not fresh:
                    mv = wrapd(P - nb["P"], L)
                    skin = {"High": 0.04, "Medium": 0.08, "Low": 0.12}.get(self.settings.get("quality", "High"), 0.04)
                    fresh = float(np.max(np.abs(mv))) > skin * rmax
                if fresh:
                    idx = np.empty((N, kn), np.int64)
                    dd = np.empty((N, kn))
                    KERNELS.neighbors(P, L, rmax, kn, idx, dd)
                    self._nb = {"N": N, "kn": kn, "L": L, "rmax": rmax, "age": self.age, "P": P.copy(),
                                "idx": idx}
                else:
                    idx = nb["idx"].copy()
                    dd = np.empty((N, kn))
                    KERNELS.refresh(P, L, rmax, idx, dd)
                ax, ay, cnt = np.zeros(N), np.zeros(N), np.zeros(N, np.int64)
                KERNELS.forces(P, types, idx, dd, L, rmax, NB, self.Tout, self.Tin, self.Tperp,
                               self.crowd, self.saturation, ax, ay, cnt)
            else:
                idx, dd = np_neighbors(P, L, rmax, kn)
                ax, ay, cnt = self._np_forces(idx, dd)
        else:
            idx = np.full((N, kn), -1, np.int64)
            dd = np.full((N, kn), 1e30)
            ax, ay, cnt = np.zeros(N), np.zeros(N), np.zeros(N, np.int64)
        self.idx, self.dd, self.cnt = idx, dd, cnt
        self.pairs = int(cnt.sum())
        cache = {}

        def pairs():
            if not cache:
                ok = idx >= 0
                i = np.nonzero(ok)[0]
                j = idx[ok]
                cache.update(i=i, j=j, d=dd[ok], ti=types[i], tj=types[j])
            return cache["i"], cache["j"], cache["d"], cache["ti"], cache["tj"]

        # ---- bonds ----
        if len(self.bi):
            rest = self.b_rest[self.bl] * rmax
            keep = np.ones(len(self.bi), bool)
            if KERNELS is not None:
                KERNELS.bonds(P, self.bi, self.bj, rest, self.b_k[self.bl], self.b_brk[self.bl], L, ax, ay, keep)
            else:
                bd = wrapd(P[self.bj] - P[self.bi], L)
                bl = np.hypot(bd[:, 0], bd[:, 1]) + 1e-9
                f = self.b_k[self.bl] * (bl - rest)
                fx, fy = f * bd[:, 0] / bl, f * bd[:, 1] / bl
                ax += np.bincount(self.bi, fx, N) - np.bincount(self.bj, fx, N)
                ay += np.bincount(self.bi, fy, N) - np.bincount(self.bj, fy, N)
                keep = bl < rest * self.b_brk[self.bl]
            self.bi, self.bj, self.bl = self.bi[keep], self.bj[keep], self.bl[keep]

        m = self.mass[types]
        vx, vy = ax / m, ay / m
        E = self.energy
        G = self.genes

        # ---- swimming ----
        for mo in self.motors:
            sel = types == mo["k"]
            if mo["cost"] > 0:
                sel &= E >= mo["cost"]
            n = int(sel.sum())
            if n:
                self.heading[sel] += ch.normal(0, mo["turn"], n) * G[sel, 1]
                th = mo["thrust"] * G[sel, 0]
                vx[sel] += th * np.cos(self.heading[sel])
                vy[sel] += th * np.sin(self.heading[sel])
                E[sel] -= mo["cost"]

        # ---- scent fields ----
        if self.fields:
            gx, gy = self._cells(FS)
            for fd in self.fields:
                Gf = fd["G"]
                for k, rate in fd["emit"]:
                    sel = types == k
                    if sel.any():
                        Gf += np.bincount(gx[sel] * FS + gy[sel], minlength=FS * FS).reshape(FS, FS) * rate
                Gf += fd["diff"] * (np.roll(Gf, 1, 0) + np.roll(Gf, -1, 0) + np.roll(Gf, 1, 1)
                                    + np.roll(Gf, -1, 1) - 4 * Gf)
                Gf *= 1 - fd["decay"]
                for k, st in fd["sense"]:
                    sel = types == k
                    if sel.any():
                        a, b = gx[sel], gy[sel]
                        grx = Gf[(a + 1) % FS, b] - Gf[(a - 1) % FS, b]
                        gry = Gf[a, (b + 1) % FS] - Gf[a, (b - 1) % FS]
                        mag = np.hypot(grx, gry)
                        go = mag > 1e-6
                        mag[~go] = 1
                        vx[sel] += st * grx / mag * go
                        vy[sel] += st * gry / mag * go
                for k, rate in fd["toxin"]:
                    sel = types == k
                    if sel.any():
                        top = Gf.max() + 1e-12
                        E[sel] -= rate * Gf[gx[sel], gy[sel]] / top

        # ---- gravity / currents / black holes ----
        if self.age % 4 == 0:
            self._update_grids()
        if self.gravity > 0 and self.gfx is not None:
            gx, gy = self._cells(GS)
            if self.antigrav:
                gs = np.ones(KMAX)
                gs[self.antigrav] = -1.0
                gsel = gs[types]
                vx += self.gfx[gx, gy] * gsel
                vy += self.gfy[gx, gy] * gsel
            else:
                vx += self.gfx[gx, gy]
                vy += self.gfy[gx, gy]
        if self.currents:
            # the flow is smooth, so work it out on a grid every few ticks and look it up
            if self.age % 4 == 0 or getattr(self, "_cur", None) is None:
                CG = 64
                gxs = (np.arange(CG) + 0.5) / CG * 2 * np.pi
                ga, gb = np.meshgrid(gxs, gxs, indexing="ij")
                tfx = np.zeros((CG, CG))
                tfy = np.zeros((CG, CG))
                for cu in self.currents:
                    fx = np.zeros((CG, CG))
                    fy = np.zeros((CG, CG))
                    norm = 0.0
                    for kx, ky, amp, ph, om in cu["modes"]:
                        c = np.cos(kx * ga + ky * gb + ph + om * self.age)
                        fx += amp * ky * c
                        fy -= amp * kx * c
                        norm += abs(amp) * max(abs(kx), abs(ky), 1)
                    s = cu["strength"] * self.maxspeed * 0.15 / (norm + 1e-9)
                    tfx += fx * s
                    tfy += fy * s
                self._cur = (tfx, tfy)
            gx, gy = self._cells(64)
            vx += self._cur[0][gx, gy]
            vy += self._cur[1][gx, gy]
        for bh in self.blackholes:
            d = wrapd(bh["c"] * L - P, L)
            dist = np.hypot(d[:, 0], d[:, 1]) + 1e-9
            mag = bh["s"] * self.maxspeed * 0.3 / (1 + (dist / (bh["r"] * L)) ** 2)
            ux, uy = d[:, 0] / dist, d[:, 1] / dist
            vx += mag * (ux - 0.4 * uy)
            vy += mag * (uy + 0.4 * ux)

        self._apply_motion_laws(P, types, vx, vy, L, N)

        # ---- hunting & flocking ----
        if (self.hunts or self.flocks) and KERNELS is not None and hasattr(KERNELS, "steer"):
            ha = np.array([[hu["a"], hu["b"], hu["s"], hu["range"]] for hu in self.hunts], float).reshape(-1, 4)
            fa = np.array([[fl["k"], fl["s"]] for fl in self.flocks], float).reshape(-1, 2)
            KERNELS.steer(P, self.vel, types, idx, dd, L, ha, fa, vx, vy)
        elif self.hunts or self.flocks:
            i, j, dist, ti, tj = pairs()
            if len(i):
                d = wrapd(P[j] - P[i], L)
                for hu in self.hunts:
                    sel = (ti == hu["a"]) & (tj == hu["b"]) & (dist < hu["range"])
                    if sel.any():
                        ii = i[sel]
                        w = 1 / (dist[sel] + 1e-9)
                        sx = np.bincount(ii, d[sel, 0] * w, N)
                        sy = np.bincount(ii, d[sel, 1] * w, N)
                        mag = np.hypot(sx, sy)
                        go = mag > 0
                        mag[~go] = 1
                        vx += hu["s"] * sx / mag * go
                        vy += hu["s"] * sy / mag * go
                for fl in self.flocks:
                    sel = (ti == fl["k"]) & (tj == fl["k"])
                    if sel.any():
                        ii, jj = i[sel], j[sel]
                        c = np.bincount(ii, minlength=N).astype(float)
                        mx = np.bincount(ii, self.vel[jj, 0], N)
                        my = np.bincount(ii, self.vel[jj, 1], N)
                        go = c > 0
                        c[~go] = 1
                        vx += fl["s"] * (mx / c - self.vel[:, 0]) * go
                        vy += fl["s"] * (my / c - self.vel[:, 1]) * go

        # ---- signals ----
        if self.signals:
            for sg in self.signals:
                fire = (types == sg["k"]) & (E >= sg["thr"]) & (self.sig < 0.05) & (ch.random(N) < sg["p"])
                if fire.any():
                    self.sig[fire] = 1.0
                    E[fire] -= sg["thr"] * 0.2
                    vx[fire] += sg["kick"] * np.cos(self.heading[fire])
                    vy[fire] += sg["kick"] * np.sin(self.heading[fire])
                    self._ev("spark", P[fire], sg["k"])
            if len(self.bi):
                hot = self.sig > 0.75
                cold = self.sig < 0.05
                go = np.zeros(N, bool)
                go[self.bj[hot[self.bi] & cold[self.bj]]] = True
                go[self.bi[hot[self.bj] & cold[self.bi]]] = True
                self.sig *= 0.8
                self.sig[go] = 1.0
            else:
                self.sig *= 0.8

        # ---- integrate ----
        v = self.vel * self.friction + np.stack([vx, vy], 1)
        v = self._apply_velocity_laws(v, types, P, L)
        if self.temperature > 0:
            v += ch.normal(0, self.temperature * self.maxspeed * 0.1, v.shape)
        if self.heat is not None and self.temp is not None:
            gx, gy = self._cells(GS)
            hot = np.clip(self.temp[gx, gy], 0, 4)
            v += ch.normal(0, 1, v.shape) * (hot * self.heat["kick"] * self.maxspeed * 0.05)[:, None]
        sp = np.hypot(v[:, 0], v[:, 1])
        over = sp > self.maxspeed
        v[over] *= (self.maxspeed / sp[over])[:, None]
        v *= self.mobility[types][:, None]
        if self.walls:
            v = self._apply_walls(P, v, types, L)
        self.vel = v
        P = P + v
        if self.tunnels:
            P = self._apply_tunnels(P, types, L)
        P = self._wrap(P)

        # ---- wormholes ----
        for wh in self.wormholes:
            for a, b in ((wh["a"], wh["b"]), (wh["b"], wh["a"])):
                d = wrapd(P - a * L, L)
                dist = np.hypot(d[:, 0], d[:, 1])
                enter = (dist < wh["rad"]) & ((d[:, 0] * v[:, 0] + d[:, 1] * v[:, 1]) < 0) & \
                        (self.age - self.wcd > WARP_COOLDOWN)
                if enter.any():
                    self.wcd[enter] = self.age
                    sp = np.hypot(v[enter, 0], v[enter, 1]) + 1e-9
                    P[enter] = b * L + v[enter] / sp[:, None] * wh["rad"] * 1.15
                    self._ev("warp", P[enter], int(types[enter][0]))
            P = self._wrap(P)
        self.pos = P

        # ---- energy ----
        if self.lights:
            mult = self._light_mult()
            for lt in self.lights:
                sel = types == lt["k"]
                if not sel.any():
                    continue
                if lt["stars"] is None:
                    light = np.ones(int(sel.sum()))
                else:
                    pn = P[sel] / L
                    light = np.zeros(int(sel.sum()))
                    for c, w in zip(*lt["stars"]):
                        d = wrapd(pn - c, 1.0)
                        light += np.exp(-(d[:, 0] ** 2 + d[:, 1] ** 2) / w ** 2)
                E[sel] += lt["rate"] * light * mult * G[sel, 3]
        if self.feeds:
            i, j, dist, ti, tj = pairs()
            for fd in self.feeds:
                sel = (ti == fd["a"]) & (tj == fd["b"]) & (dist < fd["rad"])
                if sel.any():
                    ii, jj = i[sel], j[sel]
                    want = np.bincount(jj, minlength=N) * fd["rate"]
                    got = np.minimum(want, E)
                    frac = np.where(want > 0, got / np.maximum(want, 1e-12), 0)
                    E -= got
                    E += np.bincount(ii, fd["rate"] * frac[jj], N)
        self._apply_energy_laws(types, E, idx, dd, N)
        if self.volatile or self.thrust or self.lightning or self.shocks:
            self._apply_wave3(P, types, E, N, L)
        if self.shares and len(self.bi):
            rate = min(0.45, sum(self.shares))
            flow = rate * (E[self.bi] - E[self.bj])
            E -= np.bincount(self.bi, flow, N)
            E += np.bincount(self.bj, flow, N)
        np.clip(E, 0, 1e4, out=E)

        # ---- transformations (matter changes kind, never vanishes) ----
        if (self.reactions or self.decays) and self.age % 2 == 0:
            new = types.copy()
            if self.reactions and KERNELS is not None and hasattr(KERNELS, "touching"):
                tc = np.empty(N, np.int64)
                for a, cat, b, radius, prob in self.reactions:
                    KERNELS.touching(types, idx, dd, int(a), int(cat), float(radius), tc)
                    cand = np.nonzero(tc)[0]
                    if len(cand):
                        # each touching catalyst is its own chance to react
                        hit = cand[ch.random(len(cand)) < 1 - (1 - min(prob * 2, 1.0)) ** tc[cand]]
                        if len(hit):
                            new[hit] = b
                            self._ev("spark", P[hit], b)
            elif self.reactions:
                i, j, dist, ti, tj = pairs()
                for a, cat, b, radius, prob in self.reactions:
                    cand = i[(dist < radius) & (ti == a) & (tj == cat)]
                    if len(cand):
                        hit = cand[ch.random(len(cand)) < prob * 2]
                        if len(hit):
                            new[hit] = b
                            self._ev("spark", P[hit], b)
            for a, b, prob in self.decays:
                new[(types == a) & (ch.random(N) < prob * 2)] = b
            self.types = types = new
        if self.phases and self.age % 4 == 0:
            for ph in self.phases:
                sel = types == ph["a"]
                if not sel.any():
                    continue
                met = self._metric(ph["cond"])
                hit = sel & ((met > ph["thr"]) if ph["above"] else (met < ph["thr"])) & (ch.random(N) < ph["p"] * 4)
                if hit.any():
                    types[hit] = ph["b"]
                    self._ev("spark", P[hit], ph["b"])
        if self.aging and self.age % 8 == 0:
            spread = 0.6 + 0.8 * ((np.arange(N) * 0.6180339887) % 1)
            old = self.age - self.born
            for a, b, life in self.aging:
                hit = (types == a) & (old > life * spread)
                if hit.any():
                    types[hit] = b
                    self.born[hit] = self.age
                    self._ev("spark", P[hit], b)

        # ---- bonds forming ----
        if self.bond_laws and self.age % 4 == 0:
            i, j, dist, ti, tj = pairs()
            if len(i):
                counts = np.bincount(self.bi, minlength=N) + np.bincount(self.bj, minlength=N)
                ekeys = np.minimum(self.bi, self.bj) * BIGKEY + np.maximum(self.bi, self.bj)
                near = np.nonzero(dist < max(bl["form"] for bl in self.bond_laws) * rmax)[0]
                ni, nj, nti, ntj, nd = i[near], j[near], ti[near], tj[near], dist[near]
                for li, bl in enumerate(self.bond_laws):
                    a, b = bl["a"], bl["b"]
                    sel = (nd < bl["form"] * rmax) & (((nti == a) & (ntj == b)) | ((nti == b) & (ntj == a)))
                    if not sel.any():
                        continue
                    lo = np.minimum(ni[sel], nj[sel])
                    hi = np.maximum(ni[sel], nj[sel])
                    keys, first = np.unique(lo * BIGKEY + hi, return_index=True)
                    lo, hi = lo[first], hi[first]
                    okb = ~np.isin(keys, ekeys) & (counts[lo] < bl["max"]) & (counts[hi] < bl["max"])
                    lo, hi, keys = lo[okb], hi[okb], keys[okb]
                    _, f1 = np.unique(lo, return_index=True)
                    lo, hi, keys = lo[f1], hi[f1], keys[f1]
                    _, f2 = np.unique(hi, return_index=True)
                    lo, hi, keys = lo[f2], hi[f2], keys[f2]
                    busy = np.isin(lo, hi)
                    lo, hi, keys = lo[~busy], hi[~busy], keys[~busy]
                    if len(lo):
                        self.bi = np.concatenate([self.bi, lo])
                        self.bj = np.concatenate([self.bj, hi])
                        self.bl = np.concatenate([self.bl, np.full(len(lo), li, np.int64)])
                        counts += np.bincount(lo, minlength=N) + np.bincount(hi, minlength=N)
                        ekeys = np.concatenate([ekeys, keys])

        # ---- reproduction ----
        for a in sorted(self.splits):
            sp_ = self.splits[a]
            room = self._allow(a, 10 ** 9)
            if room < 1:
                continue                                 # this kind is full; others may still grow
            Nn = len(self.types)
            ready = (self.types == a) & (self.energy >= sp_["thr"] * self.genes[:, 2])
            if not ready.any():
                continue
            if sp_["mode"] == "solo":
                par = np.nonzero(ready)[0]
                if room < len(par):
                    par = par[:int(room)]
                g = self.genes[par].copy()
                e = self.energy[par] * 0.5
                self.energy[par] *= 0.5
                off = ch.normal(0, 1, (len(par), 2))
                off /= np.hypot(off[:, 0], off[:, 1])[:, None] + 1e-9
                cpos = self.pos[par] + off * self.rmax * self.radius[a] * 2
                cvel = self.vel[par]
            else:
                i, j, dist, ti, tj = pairs()
                ok_ = (i < Nn) & (j < Nn)
                i, j, dist = i[ok_], j[ok_], dist[ok_]
                c = (self.radius[a] * 2 * self.rmax) * 1.8
                sel = ready[i] & ready[j] & (dist < c) & (i < j)
                if not sel.any():
                    continue
                pi_, pj_ = i[sel], j[sel]
                _, f1 = np.unique(pi_, return_index=True)
                pi_, pj_ = pi_[f1], pj_[f1]
                _, f2 = np.unique(pj_, return_index=True)
                pi_, pj_ = pi_[f2], pj_[f2]
                busy = np.isin(pi_, pj_)
                pi_, pj_ = pi_[~busy], pj_[~busy]
                n = int(min(len(pi_), room))
                if n <= 0:
                    continue
                pi_, pj_ = pi_[:n], pj_[:n]
                pick = ch.random((n, 5)) < 0.5
                g = np.where(pick, self.genes[pi_], self.genes[pj_])
                e = (self.energy[pi_] + self.energy[pj_]) * 0.25
                self.energy[pi_] *= 0.5
                self.energy[pj_] *= 0.5
                dpos = wrapd(self.pos[pj_] - self.pos[pi_], self.L)
                cpos = self.pos[pi_] + dpos * 0.5 + ch.normal(0, self.rmax * self.radius[a], (n, 2))
                cvel = (self.vel[pi_] + self.vel[pj_]) * 0.5
            if a in self.hered:
                s = self.hered[a]
                g[:, :4] = np.clip(g[:, :4] * np.exp(ch.normal(0, s, (len(g), 4))), 0.2, 5.0)
                g[:, 4] = np.clip(g[:, 4] + ch.normal(0, s * 2, len(g)), -1, 1)
            kids = np.full(len(g), a, np.int64)
            for b, p in self.mutations.get(a, []):
                kids[ch.random(len(g)) < p] = b
            self._ev("birth", cpos, a)
            self._spawn(kids, cpos, cvel, e, g)

        if self.fissions:
            self._apply_fission()
        if self.fountains:
            self._apply_fountains()

        # ---- creation from the vacuum ----
        for k, rate in self.vacuum:
            n = self._allow(k, int(ch.poisson(rate)))
            if n:
                self._spawn(k, ch.uniform(0, self.L, (n, 2)), ch.normal(0, self.maxspeed * 0.2, (n, 2)))

        # ---- stars move and explode ----
        for lt in self.lights:
            if lt["stars"] is None:
                continue
            cs, ws = lt["stars"]
            if lt["svel"] is not None:
                cs[:] = (cs + lt["svel"]) % 1.0
            if lt["orbit"]:
                a = lt["orbit"]
                d = cs - 0.5
                cs[:] = (0.5 + np.stack([d[:, 0] * math.cos(a) - d[:, 1] * math.sin(a),
                                         d[:, 0] * math.sin(a) + d[:, 1] * math.cos(a)], 1)) % 1.0
            nv = lt["nova"]
            if nv is not None:
                for s in np.nonzero(self.age >= nv["next"])[0]:
                    c = cs[s] * self.L
                    n = nv["n"]
                    ang = ch.uniform(0, 2 * np.pi, n)
                    dirs = np.stack([np.cos(ang), np.sin(ang)], 1)
                    self._spawn(nv["kind"], c + dirs * self.rmax * 0.5, dirs * self.maxspeed, np.full(n, 5.0))
                    d = wrapd(self.pos - c, self.L)
                    near = np.hypot(d[:, 0], d[:, 1]) < ws[s] * self.L
                    self.energy[near] += 10.0
                    self.events.append(("nova", float(c[0]), float(c[1]), nv["kind"]))
                    self.novas.append(np.array(c, float))
                    cs[s] = ch.uniform(0, 1, 2)
                    nv["next"][s] = self.age + nv["period"] * ch.uniform(0.6, 1.4)

        if self.civ is not None:
            self.civ.step(self)
        self.novas = []
        self.age += 1

    def _np_forces(self, idx, dd):
        P, types, L, rmax = self.pos, self.types, self.L, self.rmax
        N = len(types)
        ok = idx >= 0
        i = np.nonzero(ok)[0]
        j = idx[ok]
        dist = dd[ok] + 1e-9
        d = wrapd(P[j] - P[i], L)
        ux, uy = d[:, 0] / dist, d[:, 1] / dist
        bins = np.minimum((dist / rmax * NB).astype(np.int64), NB - 1)
        ti, tj = types[i], types[j]
        f = self.Tout[ti, tj, bins]
        p = self.Tperp[ti, tj, bins]
        c = self.Tin[ti, tj, bins]
        cnt = ok.sum(axis=1)
        damp = (1.0 + cnt / self.crowd) ** -self.saturation
        ax = np.bincount(i, f * ux - p * uy, N) * damp * 2 + np.bincount(i, c * ux, N)
        ay = np.bincount(i, f * uy + p * ux, N) * damp * 2 + np.bincount(i, c * uy, N)
        return ax, ay, cnt.astype(np.int64)


# ==========================================================================
# CIVILIZATION - your space agency, alien civilizations, and their wars
# ==========================================================================
MIN_PLANET = 10            # particles needed to count as a landable world
PAY_TICKS = 60 * TPS       # paycheck every 60 seconds of universe time
SCAN_EVERY = 30
COLONY_EVERY = 10
MARKET_DEPTH = 150.0         # particles of one kind you can sell before its price halves
MARKET_RECOVER = 90 * TPS    # how long the market takes to recover (ticks)
PLANET_FLOOR_FRAC = 0.10      # colonies stop mining a world when it is down to 10% of its biggest size...
PLANET_FLOOR_MIN = 8          # ...or 8 particles, whichever is more
LAND_RADIUS = 4.0            # a colony can reach matter within this many force-ranges
POP_CEILING = 150.0          # hard population ceiling (raised by Life Support)
SHIP_TYPES = {
    "probe": {"name": "Scout Probe", "cost": 120, "speed": 0.75, "pop": 0, "hull": 40, "mine": 0.0,
              "desc": "Fast and cheap. Scans every world it passes. Can't land."},
    "colony": {"name": "Colony Ship", "cost": 400, "speed": 0.5, "pop": 10, "hull": 100, "mine": 1.0,
               "desc": "Lands on a world and starts mining it."},
    "hauler": {"name": "Heavy Hauler", "cost": 1500, "speed": 0.35, "pop": 40, "hull": 220, "mine": 2.0,
               "desc": "Huge colony, mines twice as fast. Slow and hard to stop."},
    "fighter": {"name": "Fighter", "cost": 400, "speed": 0.95, "pop": 0, "hull": 60, "mine": 0.0, "war": True,
                "shield": 30, "dmg": 6.0, "range": 6.0, "cool": 18, "bolt": 2.4, "spread": 0.07, "agile": 0.06,
                "desc": "Fast and cheap. Hunts enemy ships, dies quickly."},
    "frigate": {"name": "Frigate", "cost": 1200, "speed": 0.6, "pop": 0, "hull": 220, "mine": 0.0, "war": True,
                "shield": 120, "dmg": 14.0, "range": 9.0, "cool": 30, "bolt": 2.0, "spread": 0.045, "agile": 0.035,
                "desc": "Balanced warship. Guards your colonies."},
    "dread": {"name": "Dreadnought", "cost": 5000, "speed": 0.35, "pop": 0, "hull": 900, "mine": 0.0, "war": True,
              "shield": 500, "dmg": 40.0, "range": 12.0, "cool": 55, "bolt": 1.7, "spread": 0.03, "agile": 0.015,
              "desc": "Slow fortress with huge guns. Can level a colony."},
}
SHIP_TYPES["harvester"] = {"name": "Harvester", "cost": 2500, "speed": 0.55, "pop": 0, "hull": 150, "mine": 0.0,
                           "desc": "Collects one material, leaves the universe to sell it, then comes back for more. "
                                   "Slow, steady income that never stops."}
HARV_CARGO = 20                  # particles a new harvester can carry
HARV_AWAY = 180.0                # seconds away selling its cargo (Fast Turnaround cuts this)
HARV_SEARCH = 120 * PHYS_TPS          # longest it will search before heading home
SHIP_ORDER = ["probe", "colony", "hauler"]
WAR_ORDER = ["fighter", "frigate", "dread"]
UPGRADES = [
    ("funding", "Funding", 800, "Bigger paycheck from home"),
    ("engines", "Engines", 300, "Ships steer toward known worlds and brake harder"),
    ("fuel", "Fuel Tanks", 200, "Ships survive longer in deep space"),
    ("shields", "Shields", 400, "Softer landings, stronger ship shields, survive supernovas"),
    ("scanners", "Scanners", 300, "Reveal worlds from farther away (max = see all)"),
    ("nav", "Navigation", 150, "Longer predicted flight path"),
    ("mining", "Mining Tech", 500, "Every colony mines faster"),
    ("life", "Life Support", 300, "Colonies grow bigger and heal faster"),
    ("cargo", "Cargo Holds", 1200, "Harvesters carry 50% more per level"),
    ("beam", "Tractor Beams", 900, "Harvesters reach farther and pull faster"),
    ("turnaround", "Fast Turnaround", 1500, "Harvesters spend less time away selling"),
    ("hazard", "Hazard Gear", 600, "Every colony takes 15% less damage from heat, toxins and hostile life"),
]
SHELTER = 60                  # seconds a brand-new colony is sheltered from its world's hazards
UP_MAX = 5
COLONY_UPS = [
    ("pad", "Launch Pad", 800, 1, "Launch ships from this colony"),
    ("defense", "Defenses", 500, 3, "Turrets shoot enemies; resist heat, toxins and hostile life"),
    ("refinery", "Refinery", 600, 3, "+50% money per mined particle"),
    ("pods", "Escape Pods", 300, 1, "If this colony falls, survivors return home"),
    ("factory", "Factory", 1000, 3, "Builds warships here (needs a Launch Pad). Lv1 Fighters, Lv2 Frigates, Lv3 Dreadnoughts"),
]
FACTORY_COSTS = [1000, 2500, 6000]
SYL = ["ka", "ve", "ra", "to", "mi", "sol", "an", "or", "el", "ix", "du", "ne", "tha", "ri", "zen", "ul",
       "co", "va", "pe", "lun", "gar", "os", "ty", "bre", "qua", "mor", "si", "dra", "ke", "ion", "ash", "vel"]
SUFFIX = ["", "", "", "", " Prime", " Minor", " Major", " II", " III", " IV", " VII"]
ALIEN_SYL = ["vor", "kai", "zhe", "xul", "tir", "qua", "nyx", "oro", "ish", "vex", "rak", "sae", "ulm", "dra", "khe", "yth"]
STANCES = ["peaceful", "territorial", "hostile"]
ALIEN_SHAPES = ["dart", "disc", "crescent", "spike"]
STANCE_DESC = {"peaceful": "peaceful - fights only if attacked",
               "territorial": "territorial - attacks anything near its worlds",
               "hostile": "hostile - attacks everyone"}
PLAYER = 0


def fmt_money(x):
    a = abs(x)
    if a >= 1e9:
        s = "%.2fB" % (a / 1e9)
    elif a >= 1e6:
        s = "%.2fM" % (a / 1e6)
    elif a >= 1e4:
        s = "%.1fK" % (a / 1e3)
    else:
        s = "%d" % round(a)
    return ("-$" if x < 0 else "$") + s


def components(n, i, j):
    """Connected components of an undirected graph with n nodes."""
    try:
        from scipy.sparse import coo_matrix
        from scipy.sparse.csgraph import connected_components
        m = coo_matrix((np.ones(len(i), np.int8), (i, j)), shape=(n, n))
        return connected_components(m, directed=False)[1].astype(np.int64)
    except Exception:
        lab = np.arange(n)
        for _ in range(300):
            a = np.minimum(lab[i], lab[j])
            new = lab.copy()
            np.minimum.at(new, i, a)
            np.minimum.at(new, j, a)
            new = new[new]
            if np.array_equal(new, lab):
                break
            lab = new
        return np.unique(lab, return_inverse=True)[1].astype(np.int64)


class Civ:
    def __init__(self, u):
        self.rng = np.random.default_rng([u.seed, 515])
        self.money = 600.0
        self.rep = 0.0
        self.up = {k: 0 for k, *_ in UPGRADES}
        self.ships = []
        self.colonies = []
        self.log = []
        self.lognum = 0
        self.next_pay = u.age + PAY_TICKS
        self.earn = []
        self.planets = {}
        self.plist = []
        self.csize = np.zeros(0, np.int64)
        self.next_pid = 0
        self.values = {}
        self.fx = []
        self.stats = {"launched": 0, "landed": 0, "lost": 0, "mined": 0, "earned": 0.0, "colonies_lost": 0}
        self.stance = "peaceful"           # everyone starts peaceful
        self.angry = []                    # factions that attacked you - your forces fight them back
        self.stance_next = 0
        self.sold = np.zeros(KMAX)
        self.ship_n = 0
        self.say(u, "Your space agency is founded. Funding: %s every %s." % (fmt_money(self.paycheck()), fmt_time(PAY_TICKS)),
                 (255, 230, 140))
        self.upgrade_state(u)

    def upgrade_state(self, u):
        """Adds anything newer versions need (also upgrades old saves)."""
        if not hasattr(self, "sold"):
            self.sold = np.zeros(KMAX)
        if not hasattr(self, "bolts"):
            self.bolts = []
        if not hasattr(self, "booms"):
            self.booms = []
        if not hasattr(self, "auto"):
            self.auto = False
            self.auto_next = 0
        if not hasattr(self, "factions"):
            self.factions = self.roll_factions(u)
        for s in self.ships:
            s.setdefault("owner", PLAYER)
        for c in self.colonies:
            c.setdefault("owner", PLAYER)
        if not hasattr(self, "harvesters"):
            self.harvesters = []
            self.harv_n = 0
        for k, *_ in UPGRADES:
            self.up.setdefault(k, 0)
            for f in getattr(self, "factions", []):
                f["up"].setdefault(k, 0)

    # ------------------------------------------------------------- factions
    def roll_factions(self, u):
        """Whether anyone else lives in this universe is decided by the universe itself."""
        g = np.random.default_rng([u.seed, 4040])
        n = int(g.choice(4, p=[0.3, 0.35, 0.25, 0.10]))
        out = []
        for i in range(n):
            syl = int(g.integers(2, 4))
            name = "".join(ALIEN_SYL[int(g.integers(len(ALIEN_SYL)))] for _ in range(syl))
            name = name.capitalize()
            if g.random() < 0.5:
                name = name[:len(name) // 2] + "'" + name[len(name) // 2:]
            hue = ([0.93, 0.05, 0.14][i] + g.uniform(-0.025, 0.025)) % 1.0   # never cyan/green like you
            col = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(hue, g.uniform(0.6, 0.95), 1.0))
            # aliens are players exactly like you - same money, same upgrades, same prices - but they
            # can only play on auto mode
            out.append({"name": "the " + name, "short": name, "stance": "peaceful", "stance_next": 0,
                        "color": col, "shape": ALIEN_SHAPES[int(g.integers(len(ALIEN_SHAPES)))],
                        "up": {k: 0 for k, *_ in UPGRADES}, "rep": 0.0, "auto_last": None, "next_pay": 0,
                        "money": 0.0, "arrive": int(g.uniform(60, 1500) * TPS + u.age), "arrived": False,
                        "next_think": 0, "angry": [], "ship_n": 0, "kills": 0, "earned": 0.0})
        return out

    def faction(self, owner):
        return self.factions[owner - 1] if owner > 0 else None

    def owner_name(self, owner):
        return "your agency" if owner == PLAYER else self.factions[owner - 1]["name"]

    def U(self, owner, key):
        if owner == PLAYER:
            return self.up[key]
        return self.factions[owner - 1]["up"].get(key, 0)

    def stance_of(self, owner):
        return self.stance if owner == PLAYER else self.factions[owner - 1]["stance"]

    def angry_of(self, owner):
        return self.angry if owner == PLAYER else self.factions[owner - 1]["angry"]

    def wants_attack(self, a, b, pos=None, u=None):
        """Does owner a want to attack owner b (at position pos)? Same rules for you and the aliens."""
        if a == b:
            return False
        if b in self.angry_of(a):
            return True
        st = self.stance_of(a)
        if st == "hostile":
            return True
        if st == "territorial" and pos is not None and u is not None:
            reach = u.rmax * 12
            for c in self.colonies:
                if c["owner"] == a and math.hypot(*wrapd(np.array(c["p"]) - np.array(pos), u.L)) < reach:
                    return True
        return False

    def engage(self, a, b, pos=None, u=None):
        return self.wants_attack(a, b, pos, u) or self.wants_attack(b, a, pos, u)

    def credit(self, u, owner, amount):
        if owner == PLAYER:
            self.money += amount
            self.earn.append((u.age, amount))
            self.stats["earned"] += amount
            self.rep += 0.002 * max(amount, 0) ** 0.5
        else:
            f = self.factions[owner - 1]
            f["money"] += amount
            f["earned"] += amount
            f["rep"] += 0.002 * max(amount, 0) ** 0.5

    # ---------------------------------------------------------------- basics
    def say(self, u, text, color=(220, 220, 235)):
        self.lognum += 1
        self.log.append((self.lognum, u.age, text, color))
        del self.log[:-80]

    def value(self, u, k):
        """What one particle of kind k is worth - rolled by the universe, permanent."""
        if k not in self.values:
            g = np.random.default_rng([u.seed, 31337, k])
            if k in u.dark:
                v = g.uniform(25, 90)
            elif g.random() < 0.2:
                v = g.uniform(0.3, 2.5)
            else:
                v = float(np.exp(g.normal(math.log(15), 0.8)))
            self.values[k] = round(float(v), 1)
        return self.values[k]

    def market(self, k):
        """Price multiplier for kind k: flooding the market with one kind drives its price down."""
        return 1.0 / (1.0 + self.sold[k] / MARKET_DEPTH)

    def price(self, u, k):
        return self.value(u, k) * self.market(k)

    def value_arr(self, u):
        return np.array([self.value(u, k) for k in range(max(u.K, 1))])

    def paycheck(self, owner=PLAYER):
        rep = self.rep if owner == PLAYER else self.factions[owner - 1]["rep"]
        return 10.0 * (1 + 0.4 * self.U(owner, "funding")) * (1 + 0.02 * rep)

    def add_rep(self, owner, n):
        if owner == PLAYER:
            self.rep += n
        else:
            self.factions[owner - 1]["rep"] += n

    def income_per_min(self, u):
        cut = u.age - PAY_TICKS
        self.earn = [e for e in self.earn if e[0] >= cut]
        return sum(e[1] for e in self.earn) + self.paycheck()

    def up_cost(self, key, owner=PLAYER):
        base = dict((k, c) for k, _, c, _ in UPGRADES)[key]
        return base * (1.9 ** self.U(owner, key))

    def name(self):
        r = self.rng
        n = int(r.integers(2, 4))
        s = "".join(SYL[int(r.integers(len(SYL)))] for _ in range(n)).capitalize()
        return s + SUFFIX[int(r.integers(len(SUFFIX)))]

    def rescale(self, f):
        for s in self.ships:
            s["p"] = [s["p"][0] * f, s["p"][1] * f]
            s["trail"] = [(x * f, y * f) for x, y in s["trail"]]
        for c in self.colonies:
            c["p"] = [c["p"][0] * f, c["p"][1] * f]
        for pl in self.plist:
            pl["c"] = pl["c"] * f
            pl["r"] *= f
        for b in getattr(self, "bolts", []):
            b["p"] = [b["p"][0] * f, b["p"][1] * f]
        self.booms = [(b[0] * f, b[1] * f) + tuple(b[2:]) for b in getattr(self, "booms", [])]

    # -------------------------------------------------------------- planets
    def scan(self, u):
        N = len(u.types)
        if N == 0 or u.idx is None or len(u.idx) != N:
            return
        ok = u.idx >= 0
        i = np.nonzero(ok)[0]
        j = u.idx[ok]
        d = u.dd[ok]
        rad = u.radius[u.types] * u.rmax
        touch = d < (rad[i] + rad[j]) * 1.6
        i, j = i[touch], j[touch]
        if len(u.bi):
            i = np.concatenate([i, u.bi])
            j = np.concatenate([j, u.bj])
        lab = components(N, i, j)
        nl = int(lab.max()) + 1
        size = np.bincount(lab, minlength=nl)
        u.clu = lab
        self.csize = size
        L = u.L
        ang = u.pos / L * 2 * np.pi
        cxs = np.arctan2(np.bincount(lab, np.sin(ang[:, 0]), nl), np.bincount(lab, np.cos(ang[:, 0]), nl))
        cys = np.arctan2(np.bincount(lab, np.sin(ang[:, 1]), nl), np.bincount(lab, np.cos(ang[:, 1]), nl))
        cen = (np.stack([cxs, cys], 1) / (2 * np.pi) * L) % L
        dp = wrapd(u.pos - cen[lab], L)
        r = np.sqrt(np.bincount(lab, (dp ** 2).sum(1), nl) / np.maximum(size, 1)) * 1.25 + u.rmax * 0.2
        vals = self.value_arr(u)
        worth = np.bincount(lab, vals[np.minimum(u.types, len(vals) - 1)], nl)
        comp = np.bincount(lab * KMAX + u.types, minlength=nl * KMAX).reshape(nl, KMAX)
        pvx = np.bincount(lab, u.vel[:, 0], nl) / np.maximum(size, 1)
        pvy = np.bincount(lab, u.vel[:, 1], nl) / np.maximum(size, 1)
        big = np.nonzero(size >= MIN_PLANET)[0]
        big = big[np.argsort(-size[big])]
        order = np.argsort(lab, kind="stable")
        starts = np.concatenate([[0], np.cumsum(size)])
        newpid = np.full(N, -1, np.int64)
        claimed = set()
        plist = []
        for l in big.tolist():
            mem = order[starts[l]:starts[l + 1]]
            prev = u.pid[mem]
            prev = prev[prev >= 0]
            pid = -1
            if len(prev):
                vals_, cnts = np.unique(prev, return_counts=True)
                for v in vals_[np.argsort(-cnts)].tolist():
                    if v not in claimed:
                        pid = int(v)
                        break
            if pid < 0:
                pid = self.next_pid
                self.next_pid += 1
                self.planets[pid] = {"name": self.name(), "scanned": False, "found": u.age}
            claimed.add(pid)
            newpid[mem] = pid
            plist.append({"id": pid, "c": cen[l].copy(), "r": float(r[l]), "size": int(size[l]),
                          "comp": comp[l, :u.K].copy(), "worth": float(worth[l]), "label": l,
                          "v": np.array([pvx[l], pvy[l]])})
        u.pid = newpid
        self.plist = plist
        # reveal worlds near your ships and colonies
        lvl = self.up["scanners"]
        if lvl >= UP_MAX:
            for pl in plist:
                self.planets[pl["id"]]["scanned"] = True
            return
        eyes = [(s["p"], u.rmax * (6 + 6 * lvl) * (2.0 if s["type"] == "probe" else 1.0))
                for s in self.ships if s["owner"] == PLAYER]
        eyes += [(c["p"], u.rmax * (8 + 6 * lvl)) for c in self.colonies if c["owner"] == PLAYER]
        if not eyes or not plist:
            return
        cs = np.array([pl["c"] for pl in plist])
        for p, rng_ in eyes:
            dd = wrapd(cs - np.array(p), L)
            near = np.nonzero(np.hypot(dd[:, 0], dd[:, 1]) < rng_)[0]
            for n in near.tolist():
                rec = self.planets[plist[n]["id"]]
                if not rec["scanned"]:
                    rec["scanned"] = True
                    if self.stats["launched"]:
                        self.say(u, "Scanned a new world: %s (%d)" % (rec["name"], plist[n]["size"]), (150, 200, 255))

    def planet_by_id(self, pid):
        for pl in self.plist:
            if pl["id"] == pid:
                return pl
        return None

    def hazards(self, u, x, y, radius=0.0, exclude=None):
        """Dangers (and blessings) at a spot, as decided by this universe's laws."""
        out = []
        L = u.L
        if u.heat is not None and u.temp is not None:
            t = float(u.temp[int(x / L * GS) % GS, int(y / L * GS) % GS])
            if t > 1.2:
                out.append(("Extreme heat", min((t - 1.0) / 1.5, 3.0), -1))
        for fd in u.fields:
            if fd["toxin"]:
                top = fd["G"].max()
                if top > 0:
                    c = float(fd["G"][int(x / L * FS) % FS, int(y / L * FS) % FS] / top)
                    if c > 0.25:
                        out.append(("Toxic clouds", c, -1))
        for bh in u.blackholes:
            d = wrapd(np.array([x, y]) - bh["c"] * L, L)
            if math.hypot(*d) < bh["r"] * L * 1.2:
                out.append(("Black hole nearby", 1.0, -1))
        for lt in u.lights:
            if lt["stars"] is None:
                continue
            for c, w in zip(*lt["stars"]):
                d = wrapd(np.array([x, y]) - c * L, L)
                dist = math.hypot(*d)
                if dist < w * L * 1.2:
                    out.append(("Starlight (solar power)", 1.0, 1))
                    if lt["nova"] is not None:
                        out.append(("Unstable star - supernova risk", 1.0, -1))
        hunters = sorted({h["a"] for h in u.hunts if h["s"] > 0} & ({m["k"] for m in u.motors} | {h["a"] for h in u.hunts}))
        if hunters and len(u.types):
            sel = np.isin(u.types, hunters)
            if exclude is not None:
                sel &= u.pid != exclude
            if sel.any():
                d = wrapd(u.pos[sel] - np.array([x, y]), L)
                n = int((np.hypot(d[:, 0], d[:, 1]) < radius + u.rmax * 1.5).sum())
                if n > 3:
                    out.append(("Hostile life (%d)" % n, n, -1))
        seen = set()
        res = []
        for h in out:
            if h[0] not in seen:
                seen.add(h[0])
                res.append(h)
        return res

    def danger(self, u, hz, owner=PLAYER):
        """Rough rating of a world for a fresh colony: Safe, Risky or Deadly."""
        gear = max(0.0, 1 - 0.15 * self.U(owner, "hazard"))
        heal = 1.5 * (1 + 0.3 * self.U(owner, "life"))
        hurt = 0.0
        bad = False
        for name, sev, sign in hz:
            if sign > 0:
                continue
            if name == "Extreme heat":
                hurt += 1.6 * sev * gear
            elif name.startswith("Hostile life"):
                hurt += min(8.0, 0.25 * sev) * gear
            elif name == "Toxic clouds":
                hurt += 0.6 * sev * gear
            else:
                bad = True                            # black holes, unstable stars
        if hurt > heal * 1.5:
            return "Deadly", (255, 110, 100)
        if hurt > heal * 0.6 or bad:
            return "Risky", (255, 200, 110)
        return "Safe", (140, 240, 160)

    # ---------------------------------------------------------------- ships
    def field_accel(self, u, x, y):
        ax = ay = 0.0
        L = u.L
        if u.gravity > 0 and u.gfx is not None:
            gx, gy = int(x / L * GS) % GS, int(y / L * GS) % GS
            ax += u.gfx[gx, gy]
            ay += u.gfy[gx, gy]
        h = L / 2
        for bh in u.blackholes:
            dx = bh["c"][0] * L - x
            dy = bh["c"][1] * L - y
            dx = dx - L if dx > h else (dx + L if dx < -h else dx)
            dy = dy - L if dy > h else (dy + L if dy < -h else dy)
            dist = math.hypot(dx, dy) + 1e-9
            mag = bh["s"] * u.maxspeed * 0.3 / (1 + (dist / (bh["r"] * L)) ** 2)
            ux, uy = dx / dist, dy / dist
            ax += mag * (ux - 0.4 * uy)
            ay += mag * (uy + 0.4 * ux)
        if u.currents:
            px, py = x / L * 2 * math.pi, y / L * 2 * math.pi
            for cu in u.currents:
                fx = fy = norm = 0.0
                for kx, ky, amp, ph, om in cu["modes"]:
                    c = math.cos(kx * px + ky * py + ph + om * u.age)
                    fx += amp * ky * c
                    fy -= amp * kx * c
                    norm += abs(amp) * max(abs(kx), abs(ky), 1)
                s = cu["strength"] * u.maxspeed * 0.15 / (norm + 1e-9) * 0.5
                ax += fx * s
                ay += fy * s
        return ax, ay

    def launch(self, u, kind, start, direction, origin=None, owner=PLAYER, free=False, quiet=False):
        st = SHIP_TYPES[kind]
        if not free:
            if owner == PLAYER:
                if self.money < st["cost"]:
                    return False
                self.money -= st["cost"]
            else:
                f = self.factions[owner - 1]
                if f["money"] < st["cost"]:
                    return False
                f["money"] -= st["cost"]
        d = np.array(direction, float)
        d /= np.linalg.norm(d) + 1e-12
        sp = u.maxspeed * st["speed"]
        if owner == PLAYER:
            self.ship_n += 1
            name = "%s %d" % (st["name"].split()[-1], self.ship_n)
        else:
            f = self.factions[owner - 1]
            f["ship_n"] += 1
            name = "%s %s %d" % (f["short"], st["name"].split()[-1], f["ship_n"])
        sh = st.get("shield", 0) * (1 + 0.25 * self.U(owner, "shields"))
        self.ships.append({"type": kind, "name": name, "owner": owner,
                           "p": [float(start[0]) % u.L, float(start[1]) % u.L],
                           "v": [float(d[0] * sp), float(d[1] * sp)], "hull": float(st["hull"]),
                           "maxhull": float(st["hull"]), "shield": float(sh), "maxshield": float(sh),
                           "dir": [float(d[0]), float(d[1])], "cruise": float(sp), "cool": 0, "tgt": None,
                           "life": int(PHYS_TPS * (150 + 75 * self.U(owner, "fuel"))), "pop": st["pop"],
                           "ignore": 90 if origin is not None else 0, "trail": [], "age": 0})
        if owner == PLAYER:
            self.stats["launched"] += 1
            if not quiet:
                where = "from %s" % origin if origin else "from the edge of the universe"
                self.say(u, "%s launched %s." % (name, where), (180, 220, 255))
        return True

    def step_ships(self, u):
        if not self.ships:
            return
        P, L, ms = u.pos, u.L, u.maxspeed
        N = len(P)
        rad = u.radius[u.types] * u.rmax if N else np.zeros(0)
        keep = []
        taken = None
        take = set()                                   # particles harvesters pulled in this tick
        for s in self.ships:
            if s["type"] == "harvester":
                self.step_harvester(u, s, P, L, ms, take)
                if "dead" in s:
                    if s.get("left"):
                        continue
                    rec = s.get("hrec")
                    if rec in self.harvesters:
                        self.harvesters.remove(rec)
                    if s["owner"] == PLAYER:
                        self.stats["lost"] += 1
                        self.say(u, "%s %s - its cargo is lost." % (s["name"], s["dead"]), (255, 140, 120))
                    if s.get("killed"):
                        self.explode(u, s["p"], s["maxhull"], s["owner"])
                    continue
                keep.append(s)
                continue
            st = SHIP_TYPES[s["type"]]
            war = st.get("war", False)
            eng = self.U(s["owner"], "engines")
            if not war:
                s["life"] -= 1
            s["age"] += 1
            if s["ignore"] > 0:
                s["ignore"] -= 1
            if war and s["maxshield"] > 0:
                s["shield"] = min(s["maxshield"], s["shield"] + s["maxshield"] * 0.002)
            x, y = s["p"]
            vx, vy = s["v"]
            ax, ay = self.field_accel(u, x, y)
            if s["type"] in ("hauler", "dread"):
                ax, ay = ax * 0.7, ay * 0.7
            if war:
                ax, ay = ax * 0.4, ay * 0.4             # warships have strong engines
            if s.get("approach"):
                ax, ay = 0.0, 0.0                      # landing thrusters cancel outside forces
            # guidance toward the best known, unclaimed world
            if not war and eng > 0 and s["type"] != "probe" and self.plist and s["age"] % 6 == 0:
                if taken is None:
                    taken = {c.get("pid", -1) for c in self.colonies}
                best, bd = None, u.rmax * (5 + 5 * eng)
                for pl in self.plist:
                    known = s["owner"] != PLAYER or self.planets[pl["id"]]["scanned"]
                    if not known or pl["id"] in taken:
                        continue
                    d = wrapd(pl["c"] - np.array([x, y]), L)
                    dist = math.hypot(*d)
                    if dist < bd:
                        best, bd = d / (dist + 1e-9), dist
                s["steer"] = None if best is None else (float(best[0]), float(best[1]))
            if s.get("steer"):
                turn = (st.get("agile", 0.01 * eng) if war else 0.01 * eng) * (0.5 if s["type"] == "hauler" else 1.0)
                dx_, dy_ = s["dir"]
                dx_ += (s["steer"][0] - dx_) * turn
                dy_ += (s["steer"][1] - dy_) * turn
                nn = math.hypot(dx_, dy_) + 1e-9
                s["dir"] = [dx_ / nn, dy_ / nn]
            vx += ax
            vy += ay
            if not s.get("approach"):
                # autopilot holds course and cruising speed against outside forces
                hold = st.get("agile", 0.012 * (1 + 0.6 * eng)) if war else 0.012 * (1 + 0.6 * eng)
                hold *= 0.6 if s["type"] == "hauler" else 1.0
                vx += (s["dir"][0] * s["cruise"] - vx) * hold
                vy += (s["dir"][1] * s["cruise"] - vy) * hold
            sp = math.hypot(vx, vy)
            if sp > ms:
                vx, vy = vx / sp * ms, vy / sp * ms
            x, y = (x + vx) % L, (y + vy) % L
            for bh in u.blackholes:
                d = wrapd(np.array([x, y]) - bh["c"] * L, L)
                if math.hypot(*d) < bh["r"] * L * 0.12:
                    s["dead"] = "was torn apart by a black hole"
            for wh in u.wormholes:
                for a, b in ((wh["a"], wh["b"]), (wh["b"], wh["a"])):
                    d = wrapd(np.array([x, y]) - a * L, L)
                    if math.hypot(*d) < wh["rad"] and d[0] * vx + d[1] * vy < 0 and \
                            s["age"] - s.get("warp_t", -10 ** 9) > WARP_COOLDOWN:
                        s["warp_t"] = s["age"]
                        sp = math.hypot(vx, vy) + 1e-9
                        x = (b[0] * L + vx / sp * wh["rad"] * 1.15) % L
                        y = (b[1] * L + vy / sp * wh["rad"] * 1.15) % L
                        if s["owner"] == PLAYER:
                            self.say(u, "%s fell through a wormhole!" % s["name"], (200, 160, 255))
                        break
            s["p"], s["v"] = [x, y], [vx, vy]
            if s["age"] % 3 == 0:
                s["trail"].append((x, y))
                del s["trail"][:-40]
            # contact with matter (warships and probes fly over it)
            if N and not war and s["type"] != "probe" and s["ignore"] <= 0 and "dead" not in s:
                d = wrapd(P - np.array([x, y]), L)
                dist = np.hypot(d[:, 0], d[:, 1])
                gap = dist - rad * 1.3
                k = int(np.argmin(gap))
                lab = int(u.clu[k]) if k < len(u.clu) else -1
                csz = int(self.csize[lab]) if 0 <= lab < len(self.csize) else 1
                # nearest real world, and the world we are closing in on
                near, ndist, ndir = None, 1e30, None
                tgt, tdist, tdir = None, 1e30, None
                for pl in self.plist:
                    dc = wrapd(pl["c"] - np.array([x, y]), L)
                    dn = math.hypot(*dc)
                    dd_ = dn - pl["r"]
                    if dd_ < ndist:
                        near, ndist, ndir = pl, dd_, dc
                    if dd_ < u.rmax * 3 + pl["r"] * 0.6 and dd_ < tdist:
                        nv = dc / (dn + 1e-9)
                        if (vx - pl["v"][0]) * nv[0] + (vy - pl["v"][1]) * nv[1] > 0:
                            tgt, tdist, tdir = pl, dd_, nv
                s["approach"] = tgt is not None
                if tgt is not None:
                    # retro-burn: ease toward the surface at a safe landing speed
                    brake = (0.045 + 0.025 * eng) * (0.6 if s["type"] == "hauler" else 1.0)
                    pv = tgt["v"]
                    tx, ty = tdir[0] * ms * 0.12, tdir[1] * ms * 0.12
                    rx, ry = vx - pv[0], vy - pv[1]
                    rx += (tx - rx) * brake
                    ry += (ty - ry) * brake
                    s["v"] = [pv[0] + rx, pv[1] + ry]
                if near is not None and ndist < -near["r"] * 0.4:
                    hit = np.nonzero(u.pid == near["id"])[0]
                    if len(hit):
                        dh = wrapd(P[hit] - np.array([x, y]), L)
                        kk = int(hit[np.argmin(np.hypot(dh[:, 0], dh[:, 1]))])
                        dk = wrapd(P[kk] - np.array([x, y]), L)
                        self.touch(u, s, kk, dk, math.hypot(*dk))
                elif gap[k] <= 0 and csz >= 2:
                    self.touch(u, s, k, d[k], dist[k])
            if s["life"] <= 0 and "dead" not in s:
                s["dead"] = "ran out of fuel and was lost in deep space"
            if "dead" in s:
                if s.get("landed"):
                    continue
                if s["owner"] == PLAYER:
                    self.stats["lost"] += 1
                    self.say(u, "%s %s." % (s["name"], s["dead"]), (255, 140, 120))
                if s.get("killed"):
                    self.explode(u, s["p"], s["maxhull"], s["owner"])
                continue
            keep.append(s)
        self.ships = keep
        if take:
            u.remove_matter(np.fromiter(take, np.int64))

    def touch(self, u, s, k, d, dist):
        ms = u.maxspeed
        owner = s["owner"]
        lab = int(u.clu[k]) if k < len(u.clu) else -1
        pl = self.planet_by_id(int(u.pid[k])) if k < len(u.pid) else None
        ref = pl["v"] if pl is not None else u.vel[k]
        rel = math.hypot(s["v"][0] - ref[0], s["v"][1] - ref[1])
        size = int(self.csize[lab]) if 0 <= lab < len(self.csize) else 1
        sh = self.U(owner, "shields")
        n = d / (dist + 1e-9)

        def bounce(damage, what):
            s["hull"] -= damage
            if s["hull"] <= 0:
                s["dead"] = what
                return
            vr = np.array(s["v"]) - u.vel[k]
            vn = float(vr @ n)
            if vn > 0:
                vr -= 2 * vn * n
            s["v"] = list(u.vel[k] + vr * 0.6)
            s["p"] = list((np.array(s["p"]) - n * u.rmax * 0.3) % u.L)

        if size < MIN_PLANET:
            bounce(8 + 30 * rel / ms * (1 - 0.12 * sh), "was destroyed hitting an asteroid")
            return
        limit = ms * (0.22 + 0.1 * sh) * (0.8 if s["type"] == "hauler" else 1.0)
        if rel > limit:
            bounce(120 * rel / ms * (1 - 0.12 * sh), "crashed on landing")
            if "dead" not in s and owner == PLAYER:
                self.say(u, "%s came in too fast and bounced off! Hull %d%%" % (s["name"], s["hull"]), (255, 200, 120))
            return
        pid = int(u.pid[k]) if k < len(u.pid) else -1
        rec = self.planets.get(pid)
        pname = rec["name"] if rec else self.name()
        if rec and owner == PLAYER:
            rec["scanned"] = True
        n_same = sum(1 for c in self.colonies if c["pname"] == pname and c["owner"] == owner)
        if owner == PLAYER:
            cname = pname + ("" if n_same == 0 else " Base %d" % (n_same + 1))
        else:
            cname = "%s %s" % (self.factions[owner - 1]["short"], pname) + ("" if n_same == 0 else " %d" % (n_same + 1))
        ups = {"pad": 0, "defense": 0, "refinery": 0, "pods": 0, "factory": 0}
        self.colonies.append({"name": cname, "pname": pname, "uid": int(u.uid[k]), "p": list(u.pos[k]),
                              "pop": float(s["pop"]), "health": 100.0, "acc": 0.0, "mined": 0, "earned": 0.0,
                              "born": u.age, "mine": SHIP_TYPES[s["type"]]["mine"], "cost": SHIP_TYPES[s["type"]]["cost"],
                              "up": ups, "beam": [], "owner": owner, "cool": 0, "pid": pid})
        s["dead"] = "landed"
        s["landed"] = True
        if owner == PLAYER:
            self.stats["landed"] += 1
            self.rep += 1
            self.say(u, "%s landed on %s! A colony is founded." % (s["name"], pname), (140, 255, 170))
        else:
            f = self.factions[owner - 1]
            f["rep"] += 1
            self.say(u, "%s founded a colony on %s." % (("The " + f["short"]), pname), f["color"])

    # ------------------------------------------------------------- colonies
    def colony_index(self, u, c):
        hit = np.nonzero(u.uid == c["uid"])[0]
        return int(hit[0]) if len(hit) else -1

    def colony_planet(self, c):
        return c.get("pid", -1)

    def step_colonies(self, u, novas):
        if not self.colonies:
            return
        L, N = u.L, len(u.types)
        vals = self.value_arr(u)
        remove = set()
        keep = []
        hz_tick = u.age % (COLONY_EVERY * 3) == 0
        if not hasattr(self, "planet_peak"):
            self.planet_peak = {}
        taken_from = {}                                 # particles mined from each world this tick
        okp = u.pid >= 0
        world_n = np.bincount(u.pid[okp]) if okp.any() else np.zeros(0, np.int64)
        for c in self.colonies:
            if c.get("dead"):
                continue
            o = c["owner"]
            k = self.colony_index(u, c)
            if k < 0 and N:
                d = wrapd(u.pos - np.array(c["p"]), L)
                dist = np.hypot(d[:, 0], d[:, 1])
                if remove:
                    dist[list(remove)] = 1e30
                kk = int(np.argmin(dist))
                if dist[kk] < u.rmax * 0.8:
                    k = kk
                    c["uid"] = int(u.uid[k])
            if k < 0:
                self.lose(u, c, "lost - its world is gone")
                continue
            c["p"] = list(u.pos[k])
            lab = int(u.clu[k])
            size = int(self.csize[lab]) if 0 <= lab < len(self.csize) else 1
            c["pid"] = int(u.pid[k])
            c["size"] = size
            if size < 5 and u.age - c["born"] > 600:
                if c["mined"] > 0:
                    self.lose(u, c, "has mined its world down to nothing and was abandoned", soft=True)
                else:
                    self.lose(u, c, "lost its world - it broke apart", soft=True)
                continue
            mem = np.nonzero(u.clu == lab)[0] if lab >= 0 else np.array([k])
            # population
            sun = 1.0
            hz = self.hazards(u, c["p"][0], c["p"][1], u.rmax, c["pid"]) if hz_tick else c.get("hz", [])
            if hz_tick:
                c["hz"] = hz
            if any(h[2] > 0 for h in hz):
                sun = 1.5
            life = self.U(o, "life")
            # population is limited by the land within reach, shared with nearby colonies
            reach = u.rmax * LAND_RADIUS
            if len(mem) > 1:
                dl = wrapd(u.pos[mem] - u.pos[k], L)
                land = int((np.hypot(dl[:, 0], dl[:, 1]) < reach).sum())
            else:
                land = 1
            neighbours = sum(1 for oc in self.colonies if oc is not c and oc.get("pid", -2) == c["pid"]
                             and math.hypot(*wrapd(np.array(oc["p"]) - np.array(c["p"]), L)) < reach * 2)
            land = land / (1 + neighbours)
            c["land"] = land
            ceiling = POP_CEILING * (1 + 0.5 * life)
            cap = max(5.0, min(land * 1.5 * (1 + 0.3 * life), ceiling))
            c["cap"] = cap
            c["pop"] += 0.004 * c["pop"] * (1 - c["pop"] / cap) * sun * (1 + 0.2 * life) + 0.01
            c["pop"] = max(0.0, min(c["pop"], cap * 1.05))
            # mining - paused by the player, or resting so the world never gets mined to death
            pid = c["pid"]
            wsize = int(world_n[pid]) if 0 <= pid < len(world_n) else size
            # remember the world's biggest size (kept by the colony too, so it survives the world being re-labelled)
            peak = max(self.planet_peak.get(pid, 0), wsize, c.get("peak", 0))
            self.planet_peak[pid] = peak
            c["peak"] = peak
            floor = max(PLANET_FLOOR_MIN, int(PLANET_FLOOR_FRAC * peak))
            room = min(wsize, size) - floor - taken_from.get(pid, 0)
            was = c.get("resting", False)
            c["resting"] = room <= 0 and not c.get("paused")
            if c["resting"] and not was:
                c["rest_since"] = u.age
                if o == PLAYER and u.age - c.get("rest_msg", -10 ** 9) > 300 * TPS:   # don't spam the feed
                    c["rest_msg"] = u.age
                    self.say(u, "%s stopped mining to save its world - it mines only new matter from now on."
                             % c["name"], (255, 210, 140))
            rate = 0.05 * math.sqrt(max(c["pop"], 0)) * (1 + 0.5 * self.U(o, "mining")) * c["mine"]
            if c.get("paused") or room <= 0:
                c["acc"] = min(c["acc"], 1.0)
                cand = []
            else:
                c["acc"] += rate * COLONY_EVERY / TPS
                cand = [m for m in mem.tolist() if m != k and m not in remove]
            while c["acc"] >= 1 and cand and room > 0:
                room -= 1
                taken_from[pid] = taken_from.get(pid, 0) + 1
                c["acc"] -= 1
                w = vals[np.minimum(u.types[cand], len(vals) - 1)] ** 2 + 1e-3
                pick = cand.pop(int(self.rng.choice(len(cand), p=w / w.sum())))
                kind = int(u.types[pick])
                money = self.price(u, kind) * (1 + 0.5 * c["up"]["refinery"])
                self.sold[kind] += 1
                self.credit(u, o, money)
                c["mined"] += 1
                c["earned"] += money
                if o == PLAYER:
                    self.stats["mined"] += 1
                remove.add(pick)
                self.fx.append((float(u.pos[k, 0]), float(u.pos[k, 1]), float(u.pos[pick, 0]), float(u.pos[pick, 1]), kind, u.age))
            # dangers
            de = c["up"]["defense"]
            sh = self.U(o, "shields")
            sheltered = u.age - c["born"] < SHELTER * TPS
            gear = max(0.0, 1 - 0.15 * self.U(o, "hazard"))      # Hazard Gear: -15% per level
            if hz_tick and not sheltered:
                for name, sev, sign in hz:
                    if sign > 0:
                        continue
                    if name == "Extreme heat":
                        c["health"] -= 1.6 * sev * (1 - 0.25 * de) * gear
                        c["cause"] = "burned up in the heat"
                    elif name == "Toxic clouds":
                        c["pop"] *= 1 - 0.04 * sev * (1 - 0.25 * de) * gear
                    elif name.startswith("Hostile life"):
                        c["health"] -= min(8.0, 0.25 * sev) * (1 - 0.28 * de) * gear
                        c["cause"] = "was overrun by hostile life"
                c["health"] = min(100.0, c["health"] + 1.5 * (1 + 0.3 * life))
            for bh in u.blackholes:
                d = wrapd(np.array(c["p"]) - bh["c"] * L, L)
                if math.hypot(*d) < bh["r"] * L * 0.15:
                    c["health"] = -1
                    c["cause"] = "was swallowed by a black hole"
            for nv in novas:
                d = wrapd(np.array(c["p"]) - nv, L)
                dist = math.hypot(*d)
                if dist < L * 0.12:
                    dmg = 90 * (1 - dist / (L * 0.12)) * (1 - 0.15 * sh)
                    c["health"] -= dmg
                    c["cause"] = "was wiped out by a supernova"
                    if o == PLAYER:
                        self.say(u, "A supernova hit %s! (-%d health)" % (c["name"], dmg), (255, 180, 100))
            if c["health"] <= 0:
                self.lose(u, c, c.get("cause", "collapsed"))
                continue
            if c["pop"] < 0.5 and u.age - c["born"] > 600:
                self.lose(u, c, "died out")
                continue
            keep.append(c)
        self.colonies = keep
        if remove:
            u.remove_matter(sorted(remove))
        self.fx = [f for f in self.fx if u.age - f[5] < 90][-200:]

    def lose(self, u, c, why, soft=False):
        c["dead"] = True
        o = c["owner"]
        if o == PLAYER:
            msg = "%s %s." % (c["name"], why)
            if c["up"]["pods"] or soft:
                back = c["cost"] * (0.5 if soft else 0.3)
                self.money += back
                msg += " Survivors returned home (+%s)." % fmt_money(back)
            self.say(u, msg, (255, 150, 130) if not soft else (230, 210, 150))
            self.stats["colonies_lost"] += 1
        else:
            self.say(u, "The %s colony %s %s." % (self.factions[o - 1]["short"], c["name"], why), (200, 200, 210))
        self.colonies = [x for x in self.colonies if x is not c]
        if o == PLAYER and not any(x["owner"] == PLAYER for x in self.colonies) \
                and not any(s["owner"] == PLAYER for s in self.ships):
            self.say(u, "No colonies remain. Your funding continues - try again.", (255, 230, 140))

    def buy_upgrade(self, u, key, owner=PLAYER):
        if self.U(owner, key) >= UP_MAX:
            return False
        cost = self.up_cost(key, owner)
        if owner == PLAYER:
            if self.money < cost:
                return False
            self.money -= cost
            self.up[key] += 1
            name = dict((k, n) for k, n, _, _ in UPGRADES)[key]
            self.say(u, "Upgraded %s to level %d." % (name, self.up[key]), (180, 220, 255))
        else:
            f = self.factions[owner - 1]
            if f["money"] < cost:
                return False
            f["money"] -= cost
            f["up"][key] += 1
        return True

    def colony_up_cost(self, c, key):
        if key == "factory":
            return FACTORY_COSTS[min(c["up"].get("factory", 0), 2)]
        base = dict((k, b) for k, _, b, _, _ in COLONY_UPS)[key]
        return base * (1.8 ** c["up"][key])

    def colony_up_ok(self, c, key):
        """The factory can only be built on a colony that already has a launch pad."""
        return key != "factory" or bool(c["up"]["pad"])

    def can_build(self, c, kind):
        """Can this colony's factory build this warship?"""
        return c["up"].get("factory", 0) >= WAR_ORDER.index(kind) + 1

    def colony_pos(self, u, c):
        k = self.colony_index(u, c)
        return np.array(u.pos[k] if k >= 0 else c["p"], float)

    def launch_from_colony(self, u, kind, c, direction, quiet=False):
        """Ships leave from the colony's pad, nudged clear of its own world."""
        d = np.array(direction, float)
        d /= np.linalg.norm(d) + 1e-12
        start = self.colony_pos(u, c) + d * u.rmax * 0.6
        return self.launch(u, kind, start, d, origin=c["name"], owner=c["owner"], quiet=quiet)

    def buy_colony_upgrade(self, u, c, key):
        mx = dict((k, m) for k, _, _, m, _ in COLONY_UPS)[key]
        c["up"].setdefault(key, 0)
        if c["up"][key] >= mx or not self.colony_up_ok(c, key):
            return False
        cost = self.colony_up_cost(c, key)
        o = c["owner"]
        if o == PLAYER:
            if self.money < cost:
                return False
            self.money -= cost
        else:
            f = self.factions[o - 1]
            if f["money"] < cost:
                return False
            f["money"] -= cost
        c["up"][key] += 1
        if o == PLAYER:
            self.say(u, "%s built: %s." % (c["name"], dict((k, n) for k, n, _, _, _ in COLONY_UPS)[key]), (180, 220, 255))
        return True

    # --------------------------------------------------------------- combat
    def explode(self, u, p, size, owner):
        """A destroyed ship becomes a burst of real matter."""
        self.boom_n = getattr(self, "boom_n", 0) + 1
        self.booms.append((float(p[0]), float(p[1]), u.age, float(size), owner, self.boom_n))
        del self.booms[:-60]
        if len(u.types) and u.K:
            counts = np.bincount(u.types, minlength=u.K).astype(float) + 1
            kind = int(self.rng.choice(u.K, p=counts / counts.sum()))
            n = int(min(14, 2 + size / 70))
            ang = self.rng.uniform(0, 2 * np.pi, n)
            dirs = np.stack([np.cos(ang), np.sin(ang)], 1)
            u._spawn(kind, np.array(p) + dirs * u.rmax * 0.2, dirs * u.maxspeed * self.rng.uniform(0.2, 0.7, (n, 1)))

    def step_combat(self, u):
        ships = self.ships
        cols = self.colonies
        warships = [s for s in ships if SHIP_TYPES[s["type"]].get("war")]
        armed = [c for c in cols if c["up"]["defense"] > 0]
        if not warships and not armed and not self.bolts:
            return
        L, rm, ms = u.L, u.rmax, u.maxspeed
        ents = [("s", s) for s in ships] + [("c", c) for c in cols]
        if ents:
            E = np.array([e[1]["p"] for e in ents], float)
            EO = np.array([e[1]["owner"] for e in ents])
        # --- warship AI: pick targets, move, shoot
        for s in warships:
            st = SHIP_TYPES[s["type"]]
            rng_ = st["range"] * rm
            if s["age"] % 15 == 0 or s["tgt"] is None or s["tgt"].get("dead") \
                    or (s["tgt"] not in ships and s["tgt"] not in cols):
                s["tgt"] = None
                best, bd = None, rng_ * 3.0
                d = wrapd(E - np.array(s["p"]), L)
                dist = np.hypot(d[:, 0], d[:, 1])
                for n in np.argsort(dist).tolist():
                    if dist[n] > bd:
                        break
                    kind_, e = ents[n]
                    if e is s or EO[n] == s["owner"]:
                        continue
                    if self.engage(s["owner"], int(EO[n]), e["p"], u):
                        best = e
                        break
                s["tgt"] = best
            t = s["tgt"]
            if t is not None:
                d = wrapd(np.array(t["p"]) - np.array(s["p"]), L)
                dist = math.hypot(*d) + 1e-9
                ux, uy = d[0] / dist, d[1] / dist
                if dist > rng_ * 0.75:
                    s["steer"] = (ux, uy)
                else:                                         # strafe around the target
                    side = 1 if (s["age"] // 240) % 2 == 0 else -1
                    s["steer"] = (-uy * side + ux * 0.2, ux * side + uy * 0.2)
                s["cool"] -= 1
                if s["cool"] <= 0 and dist < rng_:
                    tv = np.array(t.get("v", [0.0, 0.0]))
                    bs = st["bolt"] * ms
                    lead = d + tv * (dist / bs)
                    ang = math.atan2(lead[1], lead[0]) + self.rng.normal(0, st["spread"])
                    self.bolts.append({"p": list(s["p"]), "v": [math.cos(ang) * bs, math.sin(ang) * bs],
                                       "owner": s["owner"], "dmg": st["dmg"], "life": int(rng_ * 1.3 / bs) + 2})
                    s["cool"] = st["cool"]
            else:
                s["cool"] = max(0, s["cool"] - 1)
                # patrol around a friendly colony, or wander
                if s["age"] % 120 == 0:
                    home = [c for c in cols if c["owner"] == s["owner"]]
                    if home:
                        c = home[int(self.rng.integers(len(home)))]
                        d = wrapd(np.array(c["p"]) - np.array(s["p"]), L)
                        dist = math.hypot(*d) + 1e-9
                        if dist > rm * 6:
                            s["steer"] = (d[0] / dist, d[1] / dist)
                        else:
                            a = self.rng.uniform(0, 2 * np.pi)
                            s["steer"] = (math.cos(a), math.sin(a))
                    else:
                        a = self.rng.uniform(0, 2 * np.pi)
                        s["steer"] = (math.cos(a), math.sin(a))
        # --- colony turrets
        for c in armed:
            c["cool"] = c.get("cool", 0) - 1
            if c["cool"] > 0 or not ents:
                continue
            rng_ = rm * (5 + c["up"]["defense"])
            d = wrapd(E - np.array(c["p"]), L)
            dist = np.hypot(d[:, 0], d[:, 1])
            for n in np.argsort(dist).tolist():
                if dist[n] > rng_:
                    break
                kind_, e = ents[n]
                if kind_ != "s" or EO[n] == c["owner"]:
                    continue
                if not self.engage(c["owner"], int(EO[n]), e["p"], u):
                    continue
                bs = 2.0 * ms
                lead = d[n] + np.array(e["v"]) * (dist[n] / bs)
                ang = math.atan2(lead[1], lead[0]) + self.rng.normal(0, 0.05)
                self.bolts.append({"p": list(c["p"]), "v": [math.cos(ang) * bs, math.sin(ang) * bs],
                                   "owner": c["owner"], "dmg": 5.0 * c["up"]["defense"], "life": int(rng_ * 1.3 / bs) + 2})
                c["cool"] = 40
                break
        # --- bolts fly and hit
        if not self.bolts:
            return
        B = np.array([b["p"] for b in self.bolts], float) + np.array([b["v"] for b in self.bolts], float)
        B %= L
        alive = []
        hit_r = np.array([(rm * 0.7 if k_ == "c" else (rm * 0.4 if e["type"] in ("dread", "hauler") else rm * 0.25))
                          for k_, e in ents]) if ents else np.zeros(0)
        for bi, b in enumerate(self.bolts):
            b["p"] = [float(B[bi, 0]), float(B[bi, 1])]
            b["life"] -= 1
            if ents:
                d = wrapd(E - B[bi], L)
                dist = np.hypot(d[:, 0], d[:, 1])
                cand = np.nonzero((dist < hit_r) & (EO != b["owner"]))[0]
                if len(cand):
                    n = int(cand[np.argmin(dist[cand])])
                    kind_, e = ents[n]
                    self.damage(u, kind_, e, b["dmg"], b["owner"])
                    continue
            if b["life"] > 0:
                alive.append(b)
        self.bolts = alive[-1500:]

    def damage(self, u, kind_, e, dmg, attacker):
        victim = e["owner"]
        if attacker != victim and attacker not in self.angry_of(victim):
            self.angry_of(victim).append(attacker)
        if kind_ == "s":
            if e.get("dead"):
                return
            sh = e.get("shield", 0.0)
            take = min(sh, dmg)
            e["shield"] = sh - take
            e["hull"] -= (dmg - take)
            if e["hull"] <= 0:
                e["dead"] = "was destroyed by %s" % self.owner_name(attacker)
                e["killed"] = True
                if attacker == PLAYER and victim != PLAYER:
                    self.rep += 1
                    self.say(u, "Your forces destroyed %s." % e["name"], (140, 255, 170))
                elif attacker != PLAYER:
                    self.factions[attacker - 1]["kills"] += 1
                    if victim != attacker:
                        self.factions[attacker - 1]["rep"] += 1
        else:
            if e.get("dead"):
                return
            e["health"] -= dmg * (0.35 if e["up"]["defense"] else 0.5)
            e["cause"] = "was destroyed by %s" % self.owner_name(attacker)
            if e["health"] <= 0:
                if attacker == PLAYER and victim != PLAYER:
                    loot = 150 + 0.25 * e["earned"]
                    self.money += loot
                    self.rep += 3
                    self.say(u, "Your forces destroyed %s! Salvage +%s" % (e["name"], fmt_money(loot)), (140, 255, 170))
                elif attacker != PLAYER and victim != attacker:
                    f = self.factions[attacker - 1]
                    f["money"] += 150 + 0.25 * e["earned"]
                    f["rep"] += 3
                self.explode(u, e["p"], 400, victim)
                self.lose(u, e, e["cause"])

    # ------------------------------------------------------------ aliens AI
    def random_wall(self, u):
        side = int(self.rng.integers(4))
        t = float(self.rng.uniform(0, u.L))
        return np.array([(0.0, t), (u.L - 1e-6, t), (t, 0.0), (t, u.L - 1e-6)][side])

    def step_factions(self, u):
        """Aliens play exactly like you, except they only ever run on auto mode."""
        for i, f in enumerate(self.factions):
            o = i + 1
            if not f["arrived"]:
                if u.age >= f["arrive"]:
                    f["arrived"] = True
                    f["money"] = 600.0                     # a brand-new agency, same as yours
                    f["next_pay"] = u.age + PAY_TICKS
                    f["next_think"] = u.age + int(self.rng.uniform(1, 1000) * TPS)
                    f["stance_next"] = u.age + int(self.rng.uniform(1, 10000) * TPS)
                    self.say(u, "UNKNOWN SHIPS DETECTED: %s have entered the universe (%s)." % (
                        f["name"], STANCE_DESC[f["stance"]]), f["color"])
                continue
            if u.age >= f["next_pay"]:
                f["money"] += self.paycheck(o)
                f["next_pay"] += PAY_TICKS
            if u.age >= f["next_think"]:
                self.auto_buy(u, o)
                f["next_think"] = u.age + int(self.rng.uniform(1, 1000) * TPS)
            if u.age >= f["stance_next"]:
                self.auto_stance(u, o)
                f["stance_next"] = u.age + int(self.rng.uniform(1, 10000) * TPS)

    # ------------------------------------------------------------ harvesters
    def harv_cap(self, owner):
        return int(round(HARV_CARGO * 1.5 ** self.U(owner, "cargo")))

    def harv_away(self, owner):
        return HARV_AWAY * 0.78 ** self.U(owner, "turnaround")

    def buy_harvester(self, u, kind, owner=PLAYER, quiet=False):
        """A harvester collects one material forever: in, grab, out, sell, back."""
        cost = SHIP_TYPES["harvester"]["cost"]
        if owner == PLAYER:
            if self.money < cost:
                return False
            self.money -= cost
        else:
            f = self.factions[owner - 1]
            if f["money"] < cost:
                return False
            f["money"] -= cost
        self.harv_n += 1
        if owner == PLAYER:
            name = "Harvester %d" % self.harv_n
        else:
            name = "%s Harvester %d" % (self.factions[owner - 1]["short"], self.harv_n)
        rec = {"name": name, "owner": owner, "kind": int(kind), "state": "in", "cargo": 0, "trips": 0,
               "last": 0.0, "earned": 0.0, "back": 0, "ship": None}
        self.harvesters.append(rec)
        self.harv_enter(u, rec)
        if owner == PLAYER and not quiet:
            self.say(u, "%s bought - it will collect %s." % (name, LET[int(kind)]), (180, 220, 255))
        return True

    def harv_enter(self, u, rec):
        start = self.random_wall(u)
        aim = wrapd(np.array([u.L / 2, u.L / 2]) - start, u.L)
        self.launch(u, "harvester", start, aim, owner=rec["owner"], free=True, quiet=True)
        s = self.ships[-1]
        s["name"] = rec["name"]
        s["hrec"] = rec
        s["mode"] = "hunt"
        s["t0"] = u.age
        s["life"] = 10 ** 9
        s["beam"] = []
        rec.update(state="in", cargo=0, ship=s)

    def step_harvester(self, u, s, P, L, ms, take):
        rec = s["hrec"]
        o = s["owner"]
        k = rec["kind"]
        s["age"] += 1
        x, y = s["p"]
        vx, vy = s["v"]
        lvl = self.U(o, "beam")
        reach = u.rmax * (1.2 + 0.5 * lvl)
        cap = self.harv_cap(o)
        cruise = ms * SHIP_TYPES["harvester"]["speed"]
        want = None
        if s["mode"] == "hunt":
            if s["age"] % 8 == 1 or s.get("tgt_p") is None:
                cand = np.nonzero(u.types == k)[0] if len(P) else np.zeros(0, np.int64)
                if take:
                    cand = cand[~np.isin(cand, np.fromiter(take, np.int64))]
                if not len(cand):
                    s["mode"] = "leave"
                else:
                    d = wrapd(P[cand] - np.array([x, y]), L)
                    dist = np.hypot(d[:, 0], d[:, 1])
                    j = int(np.argmin(dist))
                    s["tgt_p"] = (float(d[j, 0]), float(d[j, 1]), float(dist[j]))
            if s["mode"] == "hunt" and s.get("tgt_p"):
                dx, dy, dist = s["tgt_p"]
                want = (dx / (dist + 1e-9), dy / (dist + 1e-9))
                slow = min(1.0, dist / (reach * 1.5) + 0.25)
                want = (want[0] * cruise * slow, want[1] * cruise * slow)
            # tractor beam: pull in nearby matter of its kind
            if s["mode"] == "hunt" and s["age"] % max(2, 8 - lvl) == 0 and len(P):
                cand = np.nonzero(u.types == k)[0]
                if len(cand):
                    d = wrapd(P[cand] - np.array([x, y]), L)
                    dist = np.hypot(d[:, 0], d[:, 1])
                    near = cand[dist < reach]
                    if len(near):
                        near = near[np.argsort(dist[dist < reach])]
                        got = [int(i) for i in near if int(i) not in take][:1 + lvl // 2]
                        got = got[:max(0, cap - rec["cargo"])]
                        for i in got:
                            take.add(i)
                        if got:
                            rec["cargo"] += len(got)
                            s["beam"] = [(float(P[i, 0]), float(P[i, 1])) for i in got]
                            s["beam_t"] = u.age
                            s["tgt_p"] = None
            if rec["cargo"] >= cap or u.age - s["t0"] > HARV_SEARCH:
                s["mode"] = "leave"
        if s["mode"] == "leave":
            # head for the nearest wall and leave the universe
            opts = [(x, (-1.0, 0.0)), (L - x, (1.0, 0.0)), (y, (0.0, -1.0)), (L - y, (0.0, 1.0))]
            _, dvec = min(opts, key=lambda q: q[0])
            want = (dvec[0] * cruise * 1.3, dvec[1] * cruise * 1.3)
        if want is not None:
            vx += (want[0] - vx) * 0.08
            vy += (want[1] - vy) * 0.08
        sp = math.hypot(vx, vy)
        if sp > ms:
            vx, vy = vx / sp * ms, vy / sp * ms
        nx, ny = x + vx, y + vy
        if s["mode"] == "leave" and (nx < 0 or ny < 0 or nx >= L or ny >= L):
            s["dead"] = "left"
            s["left"] = True
            rec.update(state="away", ship=None, back=u.age + int(self.harv_away(o) * TPS))
            return
        s["p"], s["v"] = [nx % L, ny % L], [vx, vy]
        if abs(vx) + abs(vy) > 1e-9:
            s["dir"] = [vx / (sp + 1e-9), vy / (sp + 1e-9)]
        if s["age"] % 3 == 0:
            s["trail"].append((s["p"][0], s["p"][1]))
            del s["trail"][:-40]

    def step_harvest_returns(self, u):
        for rec in list(self.harvesters):
            if rec["state"] != "away" or u.age < rec["back"]:
                continue
            k, n, o = rec["kind"], rec["cargo"], rec["owner"]
            pay = 0.0
            for _ in range(n):                         # each particle sold pushes its price down a little
                pay += self.price(u, k)
                self.sold[k] += 1
            self.credit(u, o, pay)
            rec["last"] = pay
            rec["earned"] += pay
            rec["trips"] += 1
            if o == PLAYER:
                self.say(u, "%s came back with %d %s: +%s" % (rec["name"], n, LET[k], fmt_money(pay)), (140, 255, 170))
            self.harv_enter(u, rec)

    # ------------------------------------------------------------ auto mode
    def set_stance(self, u, owner, stance, auto=False):
        if owner == PLAYER:
            self.stance = stance
            self.say(u, "%sYour agency is now %s." % ("AUTO: " if auto else "", STANCE_DESC[stance]), (255, 230, 140))
        else:
            f = self.factions[owner - 1]
            f["stance"] = stance
            self.say(u, "%s are now %s." % ("The " + f["short"], STANCE_DESC[stance]), f["color"])

    def auto_stance(self, u, owner):
        """Auto mode picks a new stance (always a different one) every 1-10000 seconds."""
        cur = self.stance_of(owner)
        opts = [s_ for s_ in STANCES if s_ != cur]
        self.set_stance(u, owner, opts[int(self.rng.integers(len(opts)))], auto=True)

    def set_auto(self, u, on):
        self.auto = on
        if on:
            self.stance_next = u.age + int(self.rng.uniform(1, 10000) * TPS)
            self.auto_next = u.age + int(self.rng.uniform(1, 1000) * TPS)
            self.say(u, "AUTO MODE ON: the agency will buy something every 1-1000 seconds.", (255, 230, 140))
        else:
            self.say(u, "Auto mode off.", (200, 200, 210))

    def auto_buy(self, u, owner=PLAYER):
        f = None if owner == PLAYER else self.factions[owner - 1]
        money = self.money if f is None else f["money"]
        items = []
        mine = [c for c in self.colonies if c["owner"] == owner]
        for k in SHIP_ORDER:
            if SHIP_TYPES[k]["cost"] <= money:
                items.append(("ship", k))
        if SHIP_TYPES["harvester"]["cost"] <= money and u.K:
            have = np.bincount(u.types, minlength=u.K) if len(u.types) else np.zeros(u.K)
            for k in range(u.K):
                if have[k] > 0:
                    items.append(("harv", k, "harvester"))
        for k in WAR_ORDER:                          # warships only from a colony whose factory can build them
            if SHIP_TYPES[k]["cost"] <= money and any(self.can_build(c, k) for c in mine):
                items.append(("war", k))
        for k, *_ in UPGRADES:
            if self.U(owner, k) < UP_MAX and self.up_cost(k, owner) <= money:
                items.append(("up", k))
        for c in self.colonies:
            if c["owner"] != owner:
                continue
            for k, _, _, mx, _ in COLONY_UPS:
                if c["up"].get(k, 0) < mx and self.colony_up_ok(c, k) and self.colony_up_cost(c, k) <= money:
                    items.append(("colup", c, k))
        # never the same thing twice in a row; "the same thing" = same ship type / same upgrade
        # (a colony upgrade counts by its type, whichever colony gets it)
        last = getattr(self, "auto_last", None) if f is None else f.get("auto_last")

        def ident(it):
            return (it[0], it[-1])

        items = [it for it in items if ident(it) != last]
        if not items:
            if f is None:
                self.say(u, "AUTO: nothing new affordable this time.", (160, 160, 175))
            return                                   # auto_last stays as the last real purchase
        it = items[int(self.rng.integers(len(items)))]
        ok = False
        if it[0] in ("ship", "war"):
            a = self.rng.uniform(0, 2 * np.pi)
            d = (math.cos(a), math.sin(a))
            if it[0] == "war":
                yards = [c for c in mine if self.can_build(c, it[1])]
            else:
                yards = [c for c in mine if c["up"]["pad"]]      # use a launch pad if there is one
            if yards:
                c = yards[int(self.rng.integers(len(yards)))]
                ok = self.launch_from_colony(u, it[1], c, d, quiet=True)
                where = "from " + c["name"]
            else:
                ok = self.launch(u, it[1], self.random_wall(u), d, owner=owner, quiet=True)
                where = "from the edge of the universe"
            if ok and f is None:
                self.say(u, "AUTO: launched a %s %s in a random direction." % (SHIP_TYPES[it[1]]["name"], where),
                         (255, 230, 140))
        elif it[0] == "harv":
            ok = self.buy_harvester(u, it[1], owner=owner, quiet=True)
            if ok and f is None:
                self.say(u, "AUTO: bought a Harvester to collect %s." % LET[it[1]], (255, 230, 140))
        elif it[0] == "up":
            ok = self.buy_upgrade(u, it[1], owner=owner)
        else:
            ok = self.buy_colony_upgrade(u, it[1], it[2])
        if ok:
            if f is None:
                self.auto_last = ident(it)
            else:
                f["auto_last"] = ident(it)

    # ----------------------------------------------------------------- tick
    def step(self, u):
        if not hasattr(self, "factions"):
            self.upgrade_state(u)
        if u.age % COLONY_EVERY == 0:
            self.sold *= math.exp(-COLONY_EVERY / MARKET_RECOVER)
        if u.age >= self.next_pay:
            pay = self.paycheck()
            self.money += pay
            self.next_pay += PAY_TICKS
            self.say(u, "Funding received: +%s" % fmt_money(pay), (255, 230, 140))
        if self.auto and u.age >= self.auto_next:
            self.auto_buy(u)
            self.auto_next = u.age + int(self.rng.uniform(1, 1000) * TPS)
        if self.auto and u.age >= self.stance_next:
            self.auto_stance(u, PLAYER)
            self.stance_next = u.age + int(self.rng.uniform(1, 10000) * TPS)
        if u.age % SCAN_EVERY == 0:
            self.scan(u)
        if self.factions and u.age % 30 == 0:
            self.step_factions(u)
        self.step_combat(u)
        self.step_ships(u)
        if self.harvesters:
            self.step_harvest_returns(u)
        novas = list(u.novas)
        if u.age % COLONY_EVERY == 0 or novas:
            self.step_colonies(u, novas)

    # ------------------------------------------------------------ prediction
    def predict(self, u, start, vel, steps, tree=None, hauler=False, war=False):
        x, y = float(start[0]) % u.L, float(start[1]) % u.L
        vx, vy = float(vel[0]), float(vel[1])
        cruise = math.hypot(vx, vy)
        dx_, dy_ = vx / (cruise + 1e-12), vy / (cruise + 1e-12)
        hold = 0.012 * (1 + 0.6 * self.up["engines"]) * (0.6 if hauler else 1.0)
        pts = []
        ms = u.maxspeed
        for t in range(steps):
            ax, ay = self.field_accel(u, x, y)
            if hauler:
                ax, ay = ax * 0.7, ay * 0.7
            if war:
                ax, ay = ax * 0.4, ay * 0.4
            vx += ax
            vy += ay
            vx += (dx_ * cruise - vx) * hold
            vy += (dy_ * cruise - vy) * hold
            sp = math.hypot(vx, vy)
            if sp > ms:
                vx, vy = vx / sp * ms, vy / sp * ms
            x, y = (x + vx) % u.L, (y + vy) % u.L
            pts.append((x, y))
        pts = np.array(pts)
        hit = None
        if tree is not None and len(pts) and not war:
            d, idx = tree.query(pts, distance_upper_bound=u.rmax * 0.4)
            ok = np.isfinite(d)
            if ok.any():
                kk = np.where(ok, idx, 0)
                big = ok & (u.pid[kk] >= 0)
                if big.any():
                    first = int(np.argmax(big))
                    hit = (first, int(idx[first]))
                    pts = pts[:first + 1]
        return pts, hit


# ==========================================================================
# APPEARANCE - chosen by the universe, permanent
# ==========================================================================
SHAPES = ["dot", "ring", "square", "cross", "spark", "blob", "triangle", "diamond", "hexagon", "star", "petal", "core"]
LEVELS = 8


class Look:
    def __init__(self, u):
        g = np.random.default_rng([u.seed, 7777])
        self.seed = u.seed
        hsv = colorsys.hsv_to_rgb
        self.bg = tuple(int(c * 255) for c in hsv(g.random(), g.uniform(0.2, 0.8), g.uniform(0.0, 0.07)))
        self.hue = g.random()
        self.spread = g.uniform(0.08, 1.0)
        self.sat_lo = g.uniform(0.15, 0.9)
        self.sat_hi = min(1.0, self.sat_lo + g.uniform(0, 0.5))
        self.val_lo = g.uniform(0.55, 1.0)
        self.falloff = g.uniform(0.6, 2.0)
        self.halo = g.uniform(0.0, 0.5)
        self.size = g.uniform(0.7, 1.4)
        slip = 1 - u.friction
        self.fade = 255 if g.random() < 0.25 else int(np.clip(4 + slip * g.uniform(200, 900), 3, 255))
        self.bond_style = ["line", "glow", "membrane"][int(g.integers(3))]
        self.bond_w = int(g.integers(1, 3))
        self.bond_glow = g.uniform(0.35, 0.9)
        self.fog = g.uniform(0.35, 1.0)
        self.star = tuple(int(c * 255) for c in hsv(g.random(), g.uniform(0.1, 0.7), 0.28))
        self.streak = g.uniform(3, 10)
        self.arrows = g.random() < 0.4
        self.bloom = g.uniform(0.1, 0.7) if g.random() < 0.7 else 0.0
        self.vignette = g.uniform(0.2, 0.7) if g.random() < 0.6 else 0.0
        self.n_stars = int(g.integers(0, 500)) if g.random() < 0.7 else 0
        self.nebula = g.uniform(0.2, 1.0) if g.random() < 0.6 else 0.0
        self.neb_hue = g.random()
        self.edge = g.random() < 0.5
        self.edge_col = tuple(int(c * 255) for c in hsv(g.random(), g.uniform(0.3, 0.9), 0.45))
        self.heat_col = np.array(hsv(g.uniform(0.0, 0.12), g.uniform(0.6, 1.0), 1.0)) * 255
        self.flow_col = tuple(int(c * 255) for c in hsv(g.random(), g.uniform(0.2, 0.6), 0.35))
        self.bh_col = tuple(int(c * 255) for c in hsv(g.uniform(0.0, 0.15), g.uniform(0.5, 1.0), 1.0))
        self.wh_col = tuple(int(c * 255) for c in hsv(g.random(), g.uniform(0.4, 1.0), 1.0))
        self.spark = g.uniform(0.4, 1.0)
        # ---- extra visual traits, each universe gets its own mix (some get none) ----
        v = np.random.default_rng([u.seed, 8888])
        self.theme = ["natural", "neon", "pastel", "infrared", "mono", "gold"][
            int(v.choice(6, p=[0.5, 0.12, 0.1, 0.1, 0.1, 0.08]))]
        if self.theme == "neon":
            self.sat_lo, self.sat_hi, self.val_lo = 0.9, 1.0, 0.9
            self.bg = (2, 2, 6)
        elif self.theme == "pastel":
            self.sat_lo, self.sat_hi, self.val_lo = 0.15, 0.4, 0.85
        elif self.theme == "infrared":
            self.hue, self.spread = float(v.uniform(0.97, 1.03)) % 1, 0.16
            self.sat_lo, self.sat_hi = 0.75, 1.0
        elif self.theme == "mono":
            self.spread, self.sat_lo, self.sat_hi, self.val_lo = 0.02, 0.25, 0.7, 0.35
        elif self.theme == "gold":
            self.hue, self.spread, self.sat_lo, self.sat_hi, self.val_lo = 0.11, 0.06, 0.55, 0.9, 0.6
            self.bg = (3, 2, 0)
        self.grid = v.random() < 0.25                       # spacetime grid that bends with gravity
        self.grid_col = tuple(int(c * 255) for c in hsv(v.random(), v.uniform(0.2, 0.5), 0.38))
        self.lensing = v.random() < 0.6                     # black holes bend the light behind them
        self.speedcol = v.random() < 0.3                    # fast matter glows hotter
        self.speed_tint = tuple(int(c * 255) for c in hsv(v.choice([0.58, 0.08, 0.0, 0.75]), 0.5, 1.0))
        self.spikes = v.random() < 0.5                      # diffraction spikes + twinkle on stars
        self.streaks = v.random() < 0.15                    # matter drawn as streaks along its motion
        self.drift = (tuple(v.normal(0, 4, 2)) if v.random() < 0.5 else (0.0, 0.0))   # nebula drifts (px/s)
        self.ehalo = v.random() < 0.3                       # energized matter gets a soft halo
        self.kinds = {}
        self.backdrop = {}

    def kind(self, k, dark=False):
        if k not in self.kinds:
            g = np.random.default_rng([self.seed, 9000 + k])
            h = (self.hue + self.spread * (((k * 0.618034 + g.uniform(-0.08, 0.08)) % 1) - 0.5)) % 1
            c = colorsys.hsv_to_rgb(h, g.uniform(self.sat_lo, self.sat_hi), g.uniform(self.val_lo, 1.0))
            if dark:
                c = tuple(x * 0.28 for x in c)
            self.kinds[k] = {"color": tuple(int(x * 255) for x in c),
                             "shape": SHAPES[int(g.integers(len(SHAPES)))], "size": float(g.uniform(0.6, 1.6)),
                             "pulse": float(g.uniform(0.15, 2.0)) if g.random() < 0.5 else 0.0,
                             "depth": float(g.uniform(0.2, 0.6)), "liquid": bool(g.random() < 0.18 and not dark)}
        return self.kinds[k]

    def tinted(self, k, tint):
        kd = self.kinds[k]
        if tint == 0:
            return kd["color"]
        r, gg, b = [c / 255 for c in kd["color"]]
        h, s, v = colorsys.rgb_to_hsv(r, gg, b)
        c = colorsys.hsv_to_rgb((h + tint * 0.045) % 1, min(1, s + 0.1), v)
        return tuple(int(x * 255) for x in c)

    def get_backdrop(self, size, quality):
        key = (size, quality)
        if key in self.backdrop:
            return self.backdrop[key]
        sw, sh = size
        g = np.random.default_rng([self.seed, 4242])
        surf = pygame.Surface((sw, sh))
        surf.fill(self.bg)
        if self.nebula > 0 and quality != "Low":
            shape = (sw // 8 + 1, sh // 8 + 1)
            arr = np.zeros(shape)
            for octave in (4, 8, 16):
                small = g.random((max(2, sw // (8 * octave)) + 1, max(2, sh // (8 * octave)) + 1))
                s = pygame.surfarray.make_surface((np.stack([small] * 3, -1) * 255).astype(np.uint8))
                s = pygame.transform.smoothscale(s, shape)
                arr += pygame.surfarray.array3d(s)[..., 0] / 255.0 / octave * 4
            arr = np.clip((arr / (arr.max() + 1e-9)) ** 2.5, 0, 1)
            col = np.array(colorsys.hsv_to_rgb(self.neb_hue, 0.7, 1.0)) * 255 * 0.22 * self.nebula
            neb = pygame.surfarray.make_surface((arr[..., None] * col).astype(np.uint8))
            surf.blit(pygame.transform.smoothscale(neb, (sw, sh)), (0, 0), special_flags=pygame.BLEND_ADD)
        for _ in range(self.n_stars):
            x, y = int(g.integers(sw)), int(g.integers(sh))
            v = int(g.uniform(40, 170))
            surf.set_at((x, y), (v, v, min(255, v + 20)))
        self.backdrop[key] = surf
        return surf


def make_sprite(color, r, shape="dot", falloff=1.2, halo=0.25, peak=1.0):
    R = max(2, int(r * 3))
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1].astype(float)
    rr = max(r, 0.5)
    ax_, ay_ = np.abs(xx) / rr, np.abs(yy) / rr
    d = np.sqrt(ax_ ** 2 + ay_ ** 2)
    th = np.arctan2(yy, xx)

    def poly(n, rot=0.0):
        a = (th + rot) % (2 * np.pi / n) - np.pi / n
        return d * math.cos(math.pi / n) / np.maximum(np.cos(a), 1e-3)

    if shape == "ring":
        core = np.exp(-((d - 1.0) / 0.35) ** 2)
    elif shape == "square":
        core = np.exp(-np.maximum(ax_, ay_) ** 6 * falloff)
    elif shape == "cross":
        core = np.exp(-(np.minimum(ax_, ay_) / 0.3) ** 2) * np.exp(-(np.maximum(ax_, ay_) / 1.6) ** 2)
    elif shape == "spark":
        core = np.exp(-(ax_ * ay_) / 0.12) * np.exp(-d ** 2 * 0.35)
    elif shape == "blob":
        core = 0.6 * np.exp(-d ** 2 * 0.4)
    elif shape == "triangle":
        core = np.exp(-poly(3, -np.pi / 2) ** 6 * falloff)
    elif shape == "diamond":
        core = np.exp(-poly(4, np.pi / 4) ** 6 * falloff)
    elif shape == "hexagon":
        core = np.exp(-poly(6) ** 6 * falloff)
    elif shape == "star":
        rad = 1 - 0.5 * (0.5 + 0.5 * np.cos(5 * th + np.pi / 2))
        core = np.exp(-(d / rad) ** 6 * falloff)
    elif shape == "petal":
        rad = 0.35 + 0.75 * np.abs(np.cos(2 * th))
        core = np.exp(-(d / rad) ** 4 * falloff)
    elif shape == "core":
        core = np.maximum(np.exp(-((d - 1.1) / 0.25) ** 2), np.exp(-d ** 2 * 3))
    else:
        core = np.exp(-d ** 2 * falloff)
    edge = np.clip(1 - (xx ** 2 + yy ** 2) / float(R * R), 0, 1)
    inten = np.clip((core + halo * np.exp(-d ** 2 * 0.15)) * peak * edge, 0, 1)
    arr = (np.array(color, float)[None, None, :] * inten[:, :, None]).astype(np.uint8)
    return pygame.surfarray.make_surface(arr.transpose(1, 0, 2)), R


def make_icon(size):
    """The Emergence icon: a glowing 'E' at the heart of a tiny universe."""
    S = max(size, 16) * 4                                   # draw big, then shrink smoothly
    surf = pygame.Surface((S, S), pygame.SRCALPHA)
    yy, xx = np.mgrid[0:S, 0:S].astype(float)
    c = (S - 1) / 2
    d = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / (S / 2)
    # rounded-square plate, deep space with a red core glow
    r = S * 0.2
    qx = np.maximum(np.abs(xx - c) - (S / 2 - r), 0)
    qy = np.maximum(np.abs(yy - c) - (S / 2 - r), 0)
    inside = np.sqrt(qx ** 2 + qy ** 2) <= r
    glow = np.exp(-(d / 0.55) ** 2)
    rgb = np.stack([10 + 120 * glow, 8 + 18 * glow, 22 + 50 * glow], -1)
    if size >= 32:                                           # a few stars and an orbit ring on bigger icons
        g = np.random.default_rng(7)
        for _ in range(int(S * 0.06)):
            x0, y0 = g.integers(0, S, 2)
            rgb[max(0, y0 - 1):y0 + 1, max(0, x0 - 1):x0 + 1] += g.uniform(60, 160)
        ring = np.exp(-((d - 0.78) / 0.025) ** 2)
        rgb += ring[..., None] * np.array([90, 150, 255]) * 0.8
    a = inside * 255.0
    arr = np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)
    pygame.surfarray.pixels3d(surf)[:] = arr[..., :3].transpose(1, 0, 2)
    pygame.surfarray.pixels_alpha(surf)[:] = arr[..., 3].T
    # the E: a spine and three bars
    w = S * (0.095 if size >= 48 else 0.14)
    x0, x1 = S * 0.31, S * 0.71
    y0, y1 = S * 0.23, S * 0.77
    bars = [(x0, y0, w, y1 - y0), (x0, y0, x1 - x0, w), (x0, (y0 + y1) / 2 - w / 2, (x1 - x0) * 0.85, w),
            (x0, y1 - w, x1 - x0, w)]
    halo = 1.0 if size >= 48 else 0.4
    for spread, col in ((S * 0.035 * halo, (255, 40, 60, 60)), (S * 0.015 * halo, (255, 70, 80, 110)),
                        (0, (255, 246, 246, 255))):
        layer = pygame.Surface((S, S), pygame.SRCALPHA)
        for bx, by, bw, bh in bars:
            pygame.draw.rect(layer, col, pygame.Rect(int(bx - spread), int(by - spread),
                                                     int(bw + 2 * spread), int(bh + 2 * spread)),
                             border_radius=int(spread + w * 0.15))
        surf.blit(layer, (0, 0))
    return pygame.transform.smoothscale(surf, (size, size))


def uname(u):
    """A universe's name: the one the player gave it, or its number."""
    n = getattr(u, "name", "") or ""
    return n if n else "Universe #%d" % u.seed


def write_icon(path):
    """Write a Windows .ico (PNG entries, 16-256 px) using only pygame."""
    import struct
    import tempfile
    sizes = [16, 24, 32, 48, 64, 128, 256]
    blobs = []
    for sz in sizes:
        tmp = os.path.join(tempfile.gettempdir(), "emergence_icon_%d.png" % sz)
        pygame.image.save(make_icon(sz), tmp)
        with open(tmp, "rb") as fh:
            blobs.append(fh.read())
        os.remove(tmp)
    out = struct.pack("<HHH", 0, 1, len(sizes))
    off = 6 + 16 * len(sizes)
    for sz, b in zip(sizes, blobs):
        out += struct.pack("<BBBBHHII", sz % 256, sz % 256, 0, 0, 1, 32, len(b), off)
        off += len(b)
    with open(path, "wb") as fh:
        fh.write(out + b"".join(blobs))


GAME_VERSION = (1, 0, 0, 0)
CAM_NAMES = {"universe": "whole universe", "matter": "random matter", "planet": "random world", "free": "free",
             "agency": "random ship / colony", "follow": "following"}
CAM_ORDER = ["free", "universe", "matter", "planet", "agency"]

TUTORIAL = [
    ("Welcome to Emergence", [
        "You don't build this universe - you discover it.",
        "It starts as a single dot with one law of nature. New random laws appear on their own, forever: "
        "matter, forces, stars, chemistry, life.",
        "No two universes are alike. Some explode with life, some stay quiet for ages.",
        "There is no goal. Watch, experiment, and see what grows.",
    ]),
    ("Watching your universe", [
        "SPACE pauses.  + and - change how fast time flows (1 day per second is normal).",
        "J fast-forwards to the next new law.",
        "Drag to move the camera, scroll to zoom.  C switches camera modes (follow planets, ships, matter...).",
        "V flies the camera to big events.  G shows gravity.  H hides everything for a clean view.",
        "L shows every law so far.  I shows this universe's constants and personality.",
        "Every key is also a button along the bottom of the screen.",
    ]),
    ("Your space agency  (B)", [
        "You get funding every 60 days. Spend it in the Agency panel.",
        "Launch ships from the walls: Probes scan worlds, Colony Ships and Haulers land on planets and mine "
        "them for money.",
        "Click a planet first - it shows what it's made of, what it's worth, and if it's Safe, Risky or Deadly.",
        "Come in slow. Ships that hit a world too fast bounce off or crash.",
    ]),
    ("Colonies", [
        "Click a colony to upgrade it: Defenses, Refinery (more money), Escape Pods, a Launch Pad, and a "
        "Factory that builds warships.",
        "New colonies get a short landing shelter - use it to buy Defenses on dangerous worlds.",
        "Eating a world too fast? Pause its mining. Colonies also stop on their own before a planet dies.",
    ]),
    ("No planets?  No problem", [
        "Some universes take a long time to form worlds - and some never do.",
        "Fast-forward (J) to the next law and see what it changes. Everything can still happen.",
        "Or buy HARVESTERS: they fly in, collect one material you pick, leave, and come back with money. "
        "They work even with no planets at all.",
        "Upgrade them with Cargo Holds, Tractor Beams and Fast Turnaround.",
    ]),
    ("Aliens and war", [
        "Up to three alien species may show up later. They play by the same rules as you - on autopilot.",
        "Choose your stance: Peaceful, Territorial or Hostile. Warships fight on their own.",
        "Shoot someone and they hold a grudge. Click any ship or colony - even alien ones - and FOLLOW it.",
    ]),
    ("Let it play itself", [
        "Turn on AUTO in the agency box and it buys things for you every so often - perfect for leaving it running.",
        "Save with F5. Your universes are under My Universes on the main menu.",
        "Every universe is one of a kind. You are its first witness - have fun.",
    ]),
]
ADMIN_CODE = "0627"
PUBLISHER = "Redline Digital LLC"


def write_version_file(path):
    """Windows file properties for the .exe: publisher, product name, version, copyright."""
    v = GAME_VERSION
    vs = ".".join(str(x) for x in v)
    txt = """VSVersionInfo(
  ffi=FixedFileInfo(filevers=%(t)s, prodvers=%(t)s, mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1,
                    subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('040904B0', [
      StringStruct('CompanyName', '%(pub)s'),
      StringStruct('FileDescription', 'Emergence'),
      StringStruct('FileVersion', '%(vs)s'),
      StringStruct('InternalName', 'Emergence'),
      StringStruct('LegalCopyright', 'Copyright (c) 2026 %(pub)s. All rights reserved.'),
      StringStruct('OriginalFilename', 'Emergence.exe'),
      StringStruct('ProductName', 'Emergence'),
      StringStruct('ProductVersion', '%(vs)s')])]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
""" % {"t": repr(tuple(v)), "pub": PUBLISHER, "vs": vs}
    with open(path, "w") as fh:
        fh.write(txt)


def new_seed():
    return int(np.random.SeedSequence().entropy % 1_000_000_000)


# ==========================================================================
# SHARING - .emergence files, safe to swap with strangers
# ==========================================================================
# Your own saves (.emg) are pickles: fast, but a pickle can run code when it
# loads, so they are only ever read from YOUR disk. A shared universe travels
# as a .emergence file instead - plain JSON - and comes back in three gates:
#   1. the SEAL: a fingerprint of the whole file. Edited or damaged -> refused.
#   2. the REBUILD: only numbers, text, lists, number arrays and the game's own
#      Universe/Civ objects can be built. Nothing else exists in the format.
#   3. the CHECK: every array is compared with a freshly born universe
#      (types, shapes, particle counts, index ranges), then it must survive a
#      few trial steps. A bad file can only fail to import - never run code.
import base64, hashlib, zlib, io, urllib.request, urllib.parse  # noqa: E402

SHARE_FORMAT = "EMERGENCE1"
SHARE_EXT = ".emergence"
SHARE_DTYPES = ("float64", "float32", "int64", "int32", "int16", "int8",
                "uint64", "uint32", "uint16", "uint8", "bool")
SHARE_MAX_FILE = 48 * 1024 * 1024        # a .emergence file on disk
SHARE_MAX_RAW = 512 * 1024 * 1024        # the universe once unpacked
SHARE_PART = 200_000                     # characters per website part (keep in sync with js/universes.js PART)
SHARE_MAX_PARTS = 36                     # so ~7 MB of universe per upload
FIREBASE_PROJECT = "redlinestudio-d23eb"
SITE_UNIVERSES = "https://redlinestudio.dev/universes.html"
FS_BASE = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % FIREBASE_PROJECT


class ShareError(Exception):
    pass


def share_dir():
    for d in (os.path.join(os.path.expanduser("~"), "Documents", "Emergence Universes"),
              os.path.join(DATA, "exports")):
        try:
            os.makedirs(d, exist_ok=True)
            return d
        except Exception:
            continue
    return DATA


def share_seal(f):
    """SHA-256 over the file's fields, in a fixed order. universes.html computes the exact same thing."""
    parts = [f["format"], f["name"], f["seed"], f["age"], f["laws"], f["matter"], f["kinds"], f["colonies"],
             f["thumb"], f["data"]]
    return hashlib.sha256("\n".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:32]


def _share_classes():
    return {"Universe": Universe, "Civ": Civ}


def _share_encode(root, compact=False):
    """Object graph -> JSON tree. Shared objects are written once and referenced after."""
    classes = {v: k for k, v in _share_classes().items()}
    count, ids, out_id = {}, {}, [0]

    def state(o):
        d = o.__getstate__() if hasattr(o, "__getstate__") else o.__dict__
        d = dict(d) if isinstance(d, dict) else dict(o.__dict__)
        if isinstance(o, Universe):
            for k in ("events", "new_laws", "bolt_fx"):    # moment-to-moment effects, not the universe
                if k in d:
                    d[k] = []
            d.pop("Tout", None)                            # = Tforce + Tq, rebuilt on import
        return d

    def enc(o):
        t = type(o)
        if o is None or t is bool or t is str:
            return o
        if t is int:
            return o if abs(o) < 2 ** 53 else {"$I": str(o)}
        if t is float:
            return o if math.isfinite(o) else {"$f": repr(o)}
        if isinstance(o, np.generic):
            dt = o.dtype.name
            if dt not in SHARE_DTYPES:
                raise ShareError("can't share a number of type %s" % dt)
            return {"$n": dt, "v": enc(o.item())}
        if isinstance(o, tuple):
            return {"$t": [enc(v) for v in o]}
        if isinstance(o, frozenset):
            return {"$fs": [enc(v) for v in o]}
        if isinstance(o, np.random.Generator):
            st = o.bit_generator.state
            if st.get("bit_generator") != "PCG64":
                raise ShareError("unknown random generator")
            return {"$g": enc(st)}
        shared = count.get(id(o), 0) > 1
        if shared and id(o) in ids:
            return {"$r": ids[id(o)]}
        if shared:
            ids[id(o)] = out_id[0]
            out_id[0] += 1
        if isinstance(o, np.ndarray):
            dt = o.dtype.name
            if dt not in SHARE_DTYPES:
                raise ShareError("can't share an array of type %s" % dt)
            a = np.ascontiguousarray(o)
            v = {"$a": dt, "s": list(a.shape)}
            if compact and dt == "float64" and a.size > 2048:
                a = a.astype(np.float32)
                v["$a"], v["to"] = "float32", "float64"
            v["b"] = base64.b64encode(a.astype(a.dtype.newbyteorder("<"), copy=False).tobytes()).decode("ascii")
        elif t is list:
            v = [enc(x) for x in o]
        elif t is set:
            v = {"$s": [enc(x) for x in o]}
        elif t is dict:
            if all(type(k) is str and not k.startswith("$") for k in o):
                v = {k: enc(x) for k, x in o.items()}
            else:
                v = {"$d": [[enc(k), enc(x)] for k, x in o.items()]}
        elif t in classes:
            v = {"$o": classes[t], "d": enc(statecache[id(o)])}
        else:
            raise ShareError("can't share a %s" % t.__name__)
        if shared:
            return {"$id": ids[id(o)], "$v": v}
        return v

    # object states are made once so scan and encode see the same dicts
    statecache = {}
    stack = [root]
    seen = set()
    while stack:
        o = stack.pop()
        if id(o) in seen:
            continue
        seen.add(id(o))
        if type(o) in classes:
            statecache[id(o)] = state(o)
            stack.append(statecache[id(o)])
        elif isinstance(o, dict):
            stack.extend(o.values())
        elif isinstance(o, (list, tuple, set, frozenset)):
            stack.extend(o)

    def scan2(o, depth=0):
        if depth > 400:
            raise ShareError("this universe is nested too deeply to share")
        if isinstance(o, (dict, list, set, np.ndarray)) or type(o) in classes:
            n = count.get(id(o), 0)
            count[id(o)] = n + 1
            if n:
                return
        if isinstance(o, dict):
            for k, v in o.items():
                scan2(k, depth + 1)
                scan2(v, depth + 1)
        elif isinstance(o, (list, tuple, set, frozenset)):
            for v in o:
                scan2(v, depth + 1)
        elif type(o) in classes:
            scan2(statecache[id(o)], depth + 1)

    old = sys.getrecursionlimit()
    sys.setrecursionlimit(max(old, 5000))
    try:
        scan2(root)
        return enc(root)
    finally:
        sys.setrecursionlimit(old)


def _share_decode(tree):
    """JSON tree -> objects, building ONLY the whitelisted kinds of thing."""
    classes = _share_classes()
    refs = {}
    budget = [0]

    def bad(why):
        raise ShareError("not a valid universe file (%s)" % why)

    def hashable(k):
        if isinstance(k, (str, int, float, bool, type(None), np.generic)):
            return k
        if isinstance(k, (tuple, frozenset)):
            for x in k:
                hashable(x)
            return k
        bad("bad dictionary key")

    def dec(v, depth=0):
        if depth > 400:
            bad("nested too deeply")
        if v is None or isinstance(v, (bool, str)):
            return v
        if isinstance(v, (int, float)):
            return v
        if isinstance(v, list):
            return [dec(x, depth + 1) for x in v]
        if not isinstance(v, dict):
            bad("unknown value")
        if "$id" in v:
            if set(v) != {"$id", "$v"} or not isinstance(v["$id"], int) or v["$id"] in refs:
                bad("bad reference")
            rid, body = v["$id"], v["$v"]
            # containers are registered BEFORE their contents, so loops rebuild correctly
            if isinstance(body, list):
                obj = []
                refs[rid] = obj
                obj.extend(dec(x, depth + 1) for x in body)
                return obj
            if isinstance(body, dict) and "$o" in body:
                obj = _new_obj(body)
                refs[rid] = obj
                _fill_obj(obj, body, depth)
                return obj
            if isinstance(body, dict) and not any(k.startswith("$") for k in body):
                obj = {}
                refs[rid] = obj
                for k, x in body.items():
                    obj[k] = dec(x, depth + 1)
                return obj
            if isinstance(body, dict) and set(body) == {"$d"}:
                obj = {}
                refs[rid] = obj
                for pair in body["$d"]:
                    if not isinstance(pair, list) or len(pair) != 2:
                        bad("bad dictionary")
                    obj[hashable(dec(pair[0], depth + 1))] = dec(pair[1], depth + 1)
                return obj
            obj = dec(body, depth + 1)
            refs[rid] = obj
            return obj
        if "$r" in v:
            if v["$r"] not in refs:
                bad("dangling reference")
            return refs[v["$r"]]
        keys = [k for k in v if k.startswith("$")]
        if not keys:
            return {k: dec(x, depth + 1) for k, x in v.items()}
        tag = keys[0]
        if tag == "$I":
            s = v["$I"]
            if not isinstance(s, str) or len(s) > 80 or not s.lstrip("-").isdigit():
                bad("bad big number")
            return int(s)
        if tag == "$f":
            if v["$f"] not in ("nan", "inf", "-inf"):
                bad("bad number")
            return float(v["$f"])
        if tag == "$n":
            if v["$n"] not in SHARE_DTYPES:
                bad("bad number type")
            x = dec(v["v"], depth + 1)
            if not isinstance(x, (int, float, bool)):
                bad("bad number")
            return np.dtype(v["$n"]).type(x)
        if tag == "$t":
            return tuple(dec(x, depth + 1) for x in _lst(v["$t"]))
        if tag == "$s":
            return set(hashable(dec(x, depth + 1)) for x in _lst(v["$s"]))
        if tag == "$fs":
            return frozenset(hashable(dec(x, depth + 1)) for x in _lst(v["$fs"]))
        if tag == "$d":
            out = {}
            for pair in _lst(v["$d"]):
                if not isinstance(pair, list) or len(pair) != 2:
                    bad("bad dictionary")
                out[hashable(dec(pair[0], depth + 1))] = dec(pair[1], depth + 1)
            return out
        if tag == "$a":
            dt, shape, b = v.get("$a"), v.get("s"), v.get("b")
            to = v.get("to", dt)
            if dt not in SHARE_DTYPES or to not in SHARE_DTYPES or not isinstance(b, str) or not isinstance(shape, list):
                bad("bad array")
            if len(shape) > 4 or not all(isinstance(n, int) and 0 <= n <= 50_000_000 for n in shape):
                bad("bad array shape")
            size = int(np.prod(shape)) if shape else 1
            raw = base64.b64decode(b, validate=True)
            item = np.dtype(dt).itemsize
            if len(raw) != size * item:
                bad("array size doesn't match its shape")
            budget[0] += len(raw)
            if budget[0] > SHARE_MAX_RAW:
                bad("too large")
            a = np.frombuffer(raw, dtype=np.dtype(dt).newbyteorder("<")).astype(np.dtype(to)).reshape(shape)
            return a.copy()
        if tag == "$g":
            st = dec(v["$g"], depth + 1)
            if not isinstance(st, dict) or st.get("bit_generator") != "PCG64":
                bad("bad random generator")
            g = np.random.Generator(np.random.PCG64())
            try:
                g.bit_generator.state = st
            except Exception:
                bad("bad random generator")
            return g
        if tag == "$o":
            obj = _new_obj(v)
            _fill_obj(obj, v, depth)
            return obj
        bad("unknown tag %s" % tag[:12])

    def _lst(x):
        if not isinstance(x, list):
            bad("expected a list")
        return x

    def _new_obj(body):
        cls = classes.get(body.get("$o"))
        if cls is None:
            bad("unknown object")
        return cls.__new__(cls)

    def _fill_obj(obj, body, depth):
        d = dec(body.get("d"), depth + 1)
        if not isinstance(d, dict) or not all(isinstance(k, str) and k.isidentifier() and not k.startswith("__")
                                              for k in d):
            bad("bad object fields")
        obj.__dict__.update(d)

    old = sys.getrecursionlimit()
    sys.setrecursionlimit(max(old, 5000))
    try:
        return dec(tree)
    finally:
        sys.setrecursionlimit(old)


_SHARE_REF = []


def _share_check(u):
    """Compare an imported universe with a newborn one. Anything off -> refused."""
    if not isinstance(u, Universe):
        raise ShareError("there's no universe inside")
    if not isinstance(getattr(u, "seed", None), int) or not (0 <= u.seed < 2 ** 63):
        raise ShareError("bad universe number")
    if u.__dict__.get("civ") is not None and not isinstance(u.civ, Civ):
        raise ShareError("bad civilization")
    for k in ("L", "Lmax", "rmax"):
        x = u.__dict__.get(k)
        if x is not None and not (isinstance(x, (int, float, np.floating)) and math.isfinite(x) and x > 0):
            raise ShareError("bad universe size")
    u.ensure()
    if not _SHARE_REF:
        ref = Universe(1)
        ref.ensure()
        _SHARE_REF.append(ref)
    ref = _SHARE_REF[0]
    N, Nr = len(u.types), len(ref.types)
    if not (0 <= u.K <= KMAX):
        raise ShareError("bad number of matter kinds")
    per = ("born", "clu", "cnt", "energy", "genes", "heading", "pid", "pos", "sig", "types", "uid", "vel", "wcd")
    for k in ("idx", "dd"):
        u.__dict__[k] = None                            # neighbor caches are rebuilt from scratch
    for k, rv in ref.__dict__.items():
        if not isinstance(rv, np.ndarray) or k in ("idx", "dd"):
            continue
        v = u.__dict__.get(k)
        if v is None and k not in per and k not in ("bi", "bj", "bl", "mass", "radius", "charge", "mobility", "share"):
            continue
        if not isinstance(v, np.ndarray) or v.dtype.kind != rv.dtype.kind or v.ndim != rv.ndim:
            raise ShareError("damaged field: %s" % k)
        if k in per:
            if v.shape[0] != N or v.shape[1:] != rv.shape[1:]:
                raise ShareError("damaged particle field: %s" % k)
        elif k not in ("bi", "bj", "bl") and v.shape != rv.shape:
            raise ShareError("damaged table: %s" % k)
    if N and (u.types.min() < 0 or u.types.max() >= KMAX):
        raise ShareError("matter of an impossible kind")
    if u.pos.shape != (N, 2) or u.vel.shape != (N, 2) or not np.isfinite(u.pos).all():
        raise ShareError("damaged positions")
    nb = len(u.bi)
    if len(u.bj) != nb or len(u.bl) != nb or (nb and (min(u.bi.min(), u.bj.min()) < 0 or max(u.bi.max(), u.bj.max()) >= N)):
        raise ShareError("damaged bonds")
    for k in ("_nb", "_cur", "_lc"):
        u.__dict__.pop(k, None)
    s = u.settings if isinstance(u.settings, dict) else {}
    u.settings = {"matter": s.get("matter") if s.get("matter") in MATTER_OPTS else "Auto",
                  "quality": s.get("quality") if s.get("quality") in QUALITY_OPTS else "High",
                  "graphics": s.get("graphics") if s.get("graphics") in QUALITY_OPTS else "High"}
    if not (isinstance(u.auto_limit, (int, float)) and math.isfinite(u.auto_limit)):
        u.auto_limit = 4000.0
    u.name = clean_name(getattr(u, "name", ""))
    # the last gate: it has to actually run
    trial = pickle.loads(pickle.dumps(u, protocol=pickle.HIGHEST_PROTOCOL))
    try:
        if trial.civ is not None:
            trial.civ.upgrade_state(trial)
        for _ in range(3):
            trial.step()
    except Exception as ex:
        raise ShareError("this universe doesn't run (%s)" % type(ex).__name__)
    return u


def clean_name(s):
    s = "".join(ch for ch in str(s or "") if ch.isprintable())
    return s.strip()[:40]


def png_ok(b, maxw=640, maxh=400):
    """A thumbnail from someone else: a real PNG, small file, sane size (no decompression bombs)."""
    if not isinstance(b, bytes) or len(b) < 24 or len(b) > 400_000 or not b.startswith(b"\x89PNG\r\n\x1a\n"):
        return False
    w, h = int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")
    return 0 < w <= maxw and 0 < h <= maxh


def pick_file():
    """The Windows open-file box. Returns a path or ''."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askopenfilename(title="Import a universe", parent=root,
                                          filetypes=[("Emergence universe", "*" + SHARE_EXT), ("All files", "*.*")])
        root.destroy()
        return path or ""
    except Exception:
        return ""


def share_pack(u, thumb_png=b""):
    """A universe -> the text of a .emergence file. Too big for the website -> packed tighter."""
    for compact in (False, True):
        tree = _share_encode(u, compact=compact)
        raw = json.dumps(tree, separators=(",", ":"), allow_nan=False).encode("utf-8")
        data = base64.b64encode(zlib.compress(raw, 9)).decode("ascii")
        if len(data) <= SHARE_PART * SHARE_MAX_PARTS:
            break
    civ = u.civ
    f = {"format": SHARE_FORMAT, "name": clean_name(getattr(u, "name", "")), "seed": int(u.seed),
         "age": int(u.age), "laws": len(u.laws), "matter": len(u.types), "kinds": int(u.K),
         "colonies": len(civ.colonies) if civ is not None else 0,
         "thumb": base64.b64encode(thumb_png).decode("ascii") if thumb_png else "", "data": data}
    f["seal"] = share_seal(f)
    return json.dumps(f, separators=(",", ":")), len(data) <= SHARE_PART * SHARE_MAX_PARTS


def share_unpack(f):
    """A .emergence file (text or already-parsed) -> a checked Universe, plus its thumbnail bytes."""
    if isinstance(f, (bytes, str)):
        if len(f) > SHARE_MAX_FILE:
            raise ShareError("that file is far too big to be a universe")
        try:
            f = json.loads(f)
        except Exception:
            raise ShareError("that isn't a universe file")
    if not isinstance(f, dict) or f.get("format") != SHARE_FORMAT:
        raise ShareError("that isn't an Emergence universe file")
    for k in ("name", "thumb", "data", "seal"):
        if not isinstance(f.get(k), str):
            raise ShareError("that universe file is missing pieces")
    for k in ("seed", "age", "laws", "matter", "kinds", "colonies"):
        if not isinstance(f.get(k), int) or isinstance(f.get(k), bool):
            raise ShareError("that universe file is missing pieces")
    if share_seal(f) != f["seal"]:
        raise ShareError("the seal is broken - this file was edited or damaged")
    try:
        packed = base64.b64decode(f["data"], validate=True)
        z = zlib.decompressobj()
        raw = z.decompress(packed, SHARE_MAX_RAW)
        if z.unconsumed_tail:
            raise ShareError("that universe is too large to open")
        tree = json.loads(raw)
    except ShareError:
        raise
    except Exception:
        raise ShareError("that universe file is damaged")
    u = _share_check(_share_decode(tree))
    u.name = clean_name(f["name"])
    thumb = b""
    if f["thumb"]:
        try:
            thumb = base64.b64decode(f["thumb"], validate=True)
        except Exception:
            thumb = b""
        if not png_ok(thumb):
            thumb = b""
    return u, thumb


# ---- RedlineStudio's shared shelf (read-only from the game; uploads happen on the site)
def _fs_val(v):
    if not isinstance(v, dict):
        return None
    for k in ("stringValue", "booleanValue", "doubleValue"):
        if k in v:
            return v[k]
    if "integerValue" in v:
        try:
            return int(v["integerValue"])
        except Exception:
            return 0
    if "timestampValue" in v:
        return v["timestampValue"]
    return None


def _fs_get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Emergence/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read(SHARE_MAX_FILE + 1)
    if len(body) > SHARE_MAX_FILE:
        raise ShareError("the website sent too much")
    return json.loads(body)


def online_list(order="createdAt", token=None):
    q = {"pageSize": "24", "orderBy": order + " desc"}
    if token:
        q["pageToken"] = token
    data = _fs_get(FS_BASE + "/universes?" + urllib.parse.urlencode(q, quote_via=urllib.parse.quote))
    out = []
    for d in data.get("documents", []) or []:
        fields = {k: _fs_val(v) for k, v in (d.get("fields") or {}).items()}
        if fields.get("unlisted") or fields.get("ready") is False:
            continue                             # hidden, or still uploading
        fields["id"] = d.get("name", "").rsplit("/", 1)[-1]
        out.append(fields)
    return out, data.get("nextPageToken")


def online_fetch(meta):
    """Download one shared universe (its meta came from online_list) -> file dict."""
    uid = str(meta.get("id", ""))
    if not uid or not all(c.isalnum() or c in "-_" for c in uid):
        raise ShareError("bad universe id")
    parts = int(meta.get("parts") or 0)
    if not (1 <= parts <= SHARE_MAX_PARTS):
        raise ShareError("that upload is incomplete")
    chunks = []
    for n in range(parts):
        doc = _fs_get(FS_BASE + "/universeParts/%s_%d" % (uid, n))
        chunk = _fs_val((doc.get("fields") or {}).get("data"))
        if not isinstance(chunk, str):
            raise ShareError("that upload is incomplete")
        chunks.append(chunk)
    f = {"format": SHARE_FORMAT}
    for k in ("name", "thumb", "seal"):
        f[k] = str(meta.get(k) or "")
    for k in ("seed", "age", "laws", "matter", "kinds", "colonies"):
        try:
            f[k] = int(meta.get(k) or 0)
        except Exception:
            f[k] = 0
    f["data"] = "".join(chunks)
    try:                                          # count the download (the site's rules allow +1 only)
        body = json.dumps({"writes": [{"transform": {
            "document": "projects/%s/databases/(default)/documents/universes/%s" % (FIREBASE_PROJECT, uid),
            "fieldTransforms": [{"fieldPath": "downloads", "increment": {"integerValue": "1"}}]}}]}).encode()
        req = urllib.request.Request(FS_BASE.rsplit("/documents", 1)[0] + "/documents:commit", data=body,
                                     headers={"Content-Type": "application/json", "User-Agent": "Emergence/1.0"})
        urllib.request.urlopen(req, timeout=8).read()
    except Exception:
        pass
    return f


# ==========================================================================
# GPU DRAWING (OpenGL through moderngl) - the world is drawn on the graphics card,
# menus and text are still drawn by pygame and laid over the top.
# ==========================================================================
try:
    import moderngl
except Exception:
    moderngl = None

_GL_SPRITE_VS = """
#version 330
uniform vec2 res;
in vec2 corner;
in vec2 i_pos; in float i_R; in float i_r; in vec3 i_col; in vec4 i_par;
out vec2 v_loc;
flat out float v_R; flat out float v_r; flat out vec3 v_col; flat out vec4 v_par;
void main() {
    vec2 loc = corner * (i_R + 1.0);
    vec2 p = i_pos + loc;
    gl_Position = vec4(p.x / res.x * 2.0 - 1.0, 1.0 - p.y / res.y * 2.0, 0.0, 1.0);
    v_loc = loc; v_R = i_R; v_r = i_r; v_col = i_col; v_par = i_par;
}
"""
# same maths as make_sprite(), done per pixel on the GPU
_GL_SPRITE_FS = """
#version 330
in vec2 v_loc;
flat in float v_R; flat in float v_r; flat in vec3 v_col; flat in vec4 v_par;
out vec4 f;
const float PI = 3.14159265;
float sq(float x) { return x * x; }
float poly(float d, float th, float n, float rot) {
    float a = mod(th + rot, 2.0 * PI / n) - PI / n;
    return d * cos(PI / n) / max(cos(a), 1e-3);
}
void main() {
    int shape = int(v_par.x + 0.5);
    vec2 q = v_loc;
    if (shape == 12) {                       // circle outline, width in v_par.y
        if (abs(length(q) - v_r) > v_par.y * 0.5 + 0.35) discard;
        f = vec4(v_col, 1.0); return;
    }
    if (shape == 13) {                       // filled disc
        if (length(q) > v_r) discard;
        f = vec4(v_col, 1.0); return;
    }
    float falloff = v_par.y, halo = v_par.z, peak = v_par.w;
    float rr = max(v_r, 0.5);
    float ax = abs(q.x) / rr, ay = abs(q.y) / rr;
    float d = length(q) / rr;
    float th = atan(q.y, q.x);
    float core;
    if (shape == 1) core = exp(-sq((d - 1.0) / 0.35));
    else if (shape == 2) core = exp(-pow(max(ax, ay), 6.0) * falloff);
    else if (shape == 3) core = exp(-sq(min(ax, ay) / 0.3)) * exp(-sq(max(ax, ay) / 1.6));
    else if (shape == 4) core = exp(-(ax * ay) / 0.12) * exp(-d * d * 0.35);
    else if (shape == 5) core = 0.6 * exp(-d * d * 0.4);
    else if (shape == 6) core = exp(-pow(poly(d, th, 3.0, -PI / 2.0), 6.0) * falloff);
    else if (shape == 7) core = exp(-pow(poly(d, th, 4.0, PI / 4.0), 6.0) * falloff);
    else if (shape == 8) core = exp(-pow(poly(d, th, 6.0, 0.0), 6.0) * falloff);
    else if (shape == 9) { float rad = 1.0 - 0.5 * (0.5 + 0.5 * cos(5.0 * th + PI / 2.0));
                           core = exp(-pow(d / rad, 6.0) * falloff); }
    else if (shape == 10) { float rad = 0.35 + 0.75 * abs(cos(2.0 * th));
                            core = exp(-pow(d / rad, 4.0) * falloff); }
    else if (shape == 11) core = max(exp(-sq((d - 1.1) / 0.25)), exp(-d * d * 3.0));
    else if (shape == 14) core = exp(-sq(min(ax, ay) / 0.07)) * exp(-max(ax, ay) / 1.3) + 0.5 * exp(-d * d * 2.0);
    else core = exp(-d * d * falloff);
    float edge = clamp(1.0 - dot(q, q) / (v_R * v_R), 0.0, 1.0);
    float inten = clamp((core + halo * exp(-d * d * 0.15)) * peak * edge, 0.0, 1.0);
    f = vec4(v_col * inten, 1.0);
}
"""
_GL_LINE_VS = """
#version 330
uniform vec2 res;
in vec2 pos; in vec4 col;
out vec4 v_col;
void main() {
    gl_Position = vec4(pos.x / res.x * 2.0 - 1.0, 1.0 - pos.y / res.y * 2.0, 0.0, 1.0);
    v_col = col;
}
"""
_GL_LINE_FS = """
#version 330
in vec4 v_col;
out vec4 f;
void main() { f = v_col; }
"""
_GL_QUAD_VS = """
#version 330
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }
"""
_GL_POST_FS = """
#version 330
uniform sampler2D tex;
uniform vec2 res;        // size of the target in pixels
uniform vec2 tsize;      // size of a pygame texture
uniform vec2 offset;
uniform int mode;        // 0 pygame texture, 1 gpu texture, 2 field, 3 liquid, 4 vignette, 5 flat colour
uniform vec4 mul;
uniform float lod;
uniform vec2 cam; uniform float zoom; uniform float L; uniform int clip; uniform vec3 outside;
uniform float gain;
uniform float vig;
uniform int nbh;
uniform vec3 bh[3];
uniform float lens;
out vec4 f;
void main() {
    vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
    if (mode == 0) {
        vec2 q = px;
        for (int n = 0; n < nbh; n++) {                // gravitational lensing around black holes
            vec2 d = q - bh[n].xy;
            float r2 = dot(d, d) + 1.0;
            float R = bh[n].z;
            if (r2 < R * R * 0.49) { f = vec4(0.0, 0.0, 0.0, 1.0); return; }
            q -= d * (R * R * lens / r2);
        }
        vec2 uv = (q - offset) / tsize;
        uv = 1.0 - abs(mod(uv, 2.0) - 1.0);             // mirrored tiling: no seams when it drifts
        f = texture(tex, uv) * mul;
    } else if (mode == 1) {
        f = vec4(textureLod(tex, gl_FragCoord.xy / res, lod).rgb * mul.rgb, 1.0);
    } else if (mode == 2) {
        vec2 w = cam + (px - res * 0.5) / zoom;
        vec3 v = texture(tex, w / L).rgb;
        if (clip == 1 && (w.x < 0.0 || w.x > L || w.y < 0.0 || w.y > L)) v = outside;
        f = vec4(clamp(v, 0.0, 1.0), 1.0);
    } else if (mode == 3) {
        vec3 a = texture(tex, gl_FragCoord.xy / res).rgb * 255.0;
        float lum = max(a.r, max(a.g, a.b));
        float al = clamp((lum - 55.0) / 25.0, 0.0, 1.0);
        vec3 col = a / (lum + 1e-3) * 235.0;
        float rim = clamp(1.0 - abs(lum - 62.0) / 14.0, 0.0, 1.0) * 0.7;
        vec3 o = col * al * 0.8 + 255.0 * rim * al;
        f = vec4(clamp(o * gain, 0.0, 255.0) / 255.0, 1.0);
    } else if (mode == 7) {                            // canvas moved by an offset (camera panning)
        vec2 uv = (gl_FragCoord.xy - offset) / res;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) f = vec4(0.0, 0.0, 0.0, 1.0);
        else f = vec4(textureLod(tex, uv, 0.0).rgb, 1.0);
    } else if (mode == 4) {
        vec2 c = (px - res * 0.5) / (res * 0.5);
        float d = clamp(length(c) / 1.42, 0.0, 1.0);
        float v = 1.0 - vig * d * d;
        f = vec4(v, v, v, 1.0);
    } else {
        f = mul;
    }
}
"""


_img_tobytes = getattr(pygame.image, "tobytes", None) or pygame.image.tostring
_img_frombytes = getattr(pygame.image, "frombytes", None) or pygame.image.fromstring


class GLDraw:
    """Owns the OpenGL context and everything drawn with it."""

    def __init__(self):
        ctx = moderngl.create_context()
        self.ctx = ctx
        self.sprite_prog = ctx.program(vertex_shader=_GL_SPRITE_VS, fragment_shader=_GL_SPRITE_FS)
        self.line_prog = ctx.program(vertex_shader=_GL_LINE_VS, fragment_shader=_GL_LINE_FS)
        self.post = ctx.program(vertex_shader=_GL_QUAD_VS, fragment_shader=_GL_POST_FS)
        self.quad = ctx.buffer(np.array([-1, -1, 1, -1, -1, 1, 1, 1], "f4").tobytes())
        self.post_vao = ctx.vertex_array(self.post, [(self.quad, "2f", "corner")])
        self.size = None
        self.canvas = self.canvas_fb = None
        self.liq = self.liq_fb = None
        self.overlay = None
        self.last = self.last_fb = None
        self.tmp = self.tmp_fb = None
        self.scr_fb = ctx.screen
        self.fields = {}
        self.backdrop = (None, None)
        self.drew = False

    # ---- housekeeping
    def resize(self, size):
        if size == self.size:
            return
        self.size = size
        ctx = self.ctx
        for obj in (self.canvas, self.canvas_fb, self.liq, self.liq_fb, self.overlay):
            if obj is not None:
                obj.release()
        w, h = size
        self.canvas = ctx.texture((w, h), 4)
        self.canvas.filter = (moderngl.LINEAR_MIPMAP_LINEAR, moderngl.LINEAR)
        self.canvas_fb = ctx.framebuffer(color_attachments=[self.canvas])
        self.liq = ctx.texture((w // 3 + 1, h // 3 + 1), 4)
        self.liq.filter = (moderngl.LINEAR, moderngl.LINEAR)
        self.liq_fb = ctx.framebuffer(color_attachments=[self.liq])
        self.overlay = ctx.texture((w, h), 4)
        self.overlay.filter = (moderngl.NEAREST, moderngl.NEAREST)
        if self.last is not None:
            self.last_fb.release()
            self.last.release()
        self.last = ctx.texture((w, h), 3)
        self.last_fb = ctx.framebuffer(color_attachments=[self.last])
        self.scr_fb = ctx.detect_framebuffer()
        self.canvas_fb.clear(0, 0, 0, 1)

    def shift_canvas(self, dx, dy):
        """Slide the trail canvas by (dx, dy) screen pixels so trails stay glued to the world."""
        w, h = self.size
        if self.tmp is None or self.tmp.size != (w, h):
            if self.tmp is not None:
                self.tmp_fb.release()
                self.tmp.release()
            self.tmp = self.ctx.texture((w, h), 4)
            self.tmp_fb = self.ctx.framebuffer(color_attachments=[self.tmp])
        self.tmp_fb.use()
        self.canvas.use(0)
        self._set(self.post, res=(float(w), float(h)), mode=7, tex=0, offset=(dx, -dy))
        self.blend("none")
        self.post_vao.render(moderngl.TRIANGLE_STRIP)
        self.ctx.copy_framebuffer(self.canvas_fb, self.tmp_fb)

    def blend(self, mode):
        ctx = self.ctx
        if mode == "none":
            ctx.disable(moderngl.BLEND)
            return
        ctx.enable(moderngl.BLEND)
        ctx.blend_equation = moderngl.FUNC_REVERSE_SUBTRACT if mode == "sub" else moderngl.FUNC_ADD
        ctx.blend_func = {"add": (moderngl.ONE, moderngl.ONE), "sub": (moderngl.ONE, moderngl.ONE),
                          "alpha": (moderngl.SRC_ALPHA, moderngl.ONE_MINUS_SRC_ALPHA),
                          "mult": (moderngl.DST_COLOR, moderngl.ZERO)}[mode]

    def target(self, which):
        if which == "screen":
            fb = self.scr_fb
            fb.use()
            fb.viewport = (0, 0) + tuple(self.size)
            return self.size
        fb = {"canvas": self.canvas_fb, "liq": self.liq_fb}[which]
        fb.use()
        return fb.size

    @staticmethod
    def _set(prog, **kw):
        for k, v in kw.items():
            if k in prog:
                prog[k].value = v

    # ---- primitives
    def sprites(self, which, x, y, r, col, shape=0, falloff=1.2, halo=0.25, peak=1.0, blend="add"):
        """Glowing sprites. col is (n,3) 0-255; everything else a scalar or an array."""
        n = len(x)
        if n == 0:
            return
        res = self.target(which)
        r = np.broadcast_to(np.asarray(r, "f4"), (n,))
        R = np.maximum(2, np.floor(r * 3)).astype("f4")
        data = np.empty((n, 11), "f4")
        data[:, 0] = x
        data[:, 1] = y
        data[:, 2] = R
        data[:, 3] = r
        data[:, 4:7] = np.asarray(col, "f4").reshape(-1, 3) / 255.0
        data[:, 7] = shape
        data[:, 8] = falloff
        data[:, 9] = halo
        data[:, 10] = peak
        self._set(self.sprite_prog, res=tuple(float(v) for v in res))
        buf = self.ctx.buffer(data.tobytes())
        vao = self.ctx.vertex_array(self.sprite_prog, [(self.quad, "2f", "corner"),
                                                       (buf, "2f 1f 1f 3f 4f/i", "i_pos", "i_R", "i_r", "i_col", "i_par")])
        self.blend(blend)
        vao.render(moderngl.TRIANGLE_STRIP, vertices=4, instances=n)
        vao.release()
        buf.release()

    def rings(self, which, x, y, rad, col, width=1.0):
        self.sprites(which, x, y, rad, col, shape=12, falloff=width, blend="none")

    def disc(self, which, x, y, rad, col):
        self.sprites(which, [x], [y], [rad], [col], shape=13, blend="none")

    def lines(self, which, x1, y1, x2, y2, col, width=1.0, alpha=1.0, blend="none"):
        """Thick line segments, built as two triangles each. col is (n,3) or (3,) 0-255."""
        x1, y1, x2, y2 = (np.asarray(v, "f4") for v in (x1, y1, x2, y2))
        n = len(x1)
        if n == 0:
            return
        res = self.target(which)
        dx, dy = x2 - x1, y2 - y1
        ln = np.sqrt(dx * dx + dy * dy) + 1e-6
        hw = max(float(width), 1.0) * 0.5
        nx, ny = -dy / ln * hw, dx / ln * hw
        v = np.empty((n, 6, 6), "f4")
        pts = [(x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x2 + nx, y2 + ny),
               (x2 + nx, y2 + ny), (x1 - nx, y1 - ny), (x2 - nx, y2 - ny)]
        for i, (px, py) in enumerate(pts):
            v[:, i, 0] = px
            v[:, i, 1] = py
        c = np.broadcast_to(np.asarray(col, "f4").reshape(-1, 3) / 255.0, (n, 3))
        v[:, :, 2:5] = c[:, None, :]
        v[:, :, 5] = alpha
        self.tris(which, v.reshape(-1, 6), blend, res)

    def tris(self, which, verts, blend="alpha", res=None):
        """verts: (m,6) x, y, r, g, b, a  (colours 0-1)."""
        if len(verts) == 0:
            return
        if res is None:
            res = self.target(which)
        self._set(self.line_prog, res=tuple(float(v) for v in res))
        buf = self.ctx.buffer(np.ascontiguousarray(verts, "f4").tobytes())
        vao = self.ctx.vertex_array(self.line_prog, [(buf, "2f 4f", "pos", "col")])
        self.blend(blend)
        vao.render(moderngl.TRIANGLES)
        vao.release()
        buf.release()

    def full(self, which, mode, blend, tex=None, **kw):
        res = self.target(which)
        if tex is not None:
            tex.use(0)
            kw["tex"] = 0
        self._set(self.post, res=tuple(float(v) for v in res), mode=mode, **kw)
        self.blend(blend)
        self.post_vao.render(moderngl.TRIANGLE_STRIP)

    # ---- textures
    def field(self, name, img):
        """Upload an (n,n,3) grid (0-1) indexed [x, y] as a wrapping, smoothly filtered texture."""
        n = img.shape[0]
        tex = self.fields.get(name)
        if tex is None or tex.size != (n, n):
            if tex is not None:
                tex.release()
            tex = self.ctx.texture((n, n), 3, dtype="f4")
            tex.filter = (moderngl.LINEAR, moderngl.LINEAR)
            tex.repeat_x = tex.repeat_y = True
            self.fields[name] = tex
        tex.write(np.ascontiguousarray(img.transpose(1, 0, 2), "f4").tobytes())
        return tex

    def backdrop_tex(self, surf):
        if self.backdrop[0] is not surf:
            if self.backdrop[1] is not None:
                self.backdrop[1].release()
            data = _img_tobytes(surf, "RGB")
            tex = self.ctx.texture(surf.get_size(), 3, data)
            tex.repeat_x = tex.repeat_y = True
            self.backdrop = (surf, tex)
        return self.backdrop[1]

    def upload_overlay(self, surf):
        tex = self.overlay
        w, h = surf.get_size()
        if surf.get_bitsize() == 32 and surf.get_pitch() == w * 4 and \
                surf.get_masks() == (0xff0000, 0xff00, 0xff, 0xff000000):
            tex.swizzle = "BGRA"                     # copy the raw pixels, no conversion
            tex.write(surf.get_buffer())
        else:
            tex.swizzle = "RGBA"
            tex.write(_img_tobytes(surf, "RGBA"))

    def present(self, overlay_surf):
        if not self.drew:
            self.target("screen")
            self.scr_fb.clear(0, 0, 0, 1)
        else:
            self.ctx.copy_framebuffer(self.last_fb, self.scr_fb)    # the universe alone, for save thumbnails
        self.upload_overlay(overlay_surf)
        self.full("screen", 0, "alpha", tex=self.overlay, tsize=tuple(float(v) for v in self.size),
                  offset=(0.0, 0.0), mul=(1.0, 1.0, 1.0, 1.0), nbh=0)
        pygame.display.flip()
        self.drew = False

    def snapshot(self):
        data = self.last.read()
        return _img_frombytes(data, self.last.size, "RGB", True)


# ==========================================================================
# MAX SIMULATION: the universe runs on its own thread, the screen stays smooth
# ==========================================================================
import threading


def REAL(u):
    """The real universe behind a drawing snapshot (or the universe itself)."""
    return getattr(u, "_real", u)


class USnap:
    """A frozen copy of everything the screen needs from the universe, taken between physics steps.
    Anything not copied here is read straight from the real universe."""
    ARRAYS = ("pos", "vel", "types", "energy", "heading", "genes", "sig", "uid", "pid", "clu", "born", "bi", "bj")

    def __init__(self, u):
        self._real = u
        for name in self.ARRAYS:
            a = getattr(u, name, None)
            if a is not None:
                setattr(self, name, a.copy())
        for name in ("L", "age", "K", "rmax", "maxspeed", "gravity", "boost", "Lmax", "temp", "gpot", "gfx", "gfy"):
            setattr(self, name, getattr(u, name, None))
        # one-shot effects are handed over to the screen (and cleared in the universe)
        self.events, u.events = u.events, []
        self.bolt_fx, u.bolt_fx = getattr(u, "bolt_fx", []), []
        self.new_laws, u.new_laws = u.new_laws, []

    def __getattr__(self, name):
        return getattr(self._real, name)


class SimWorker(threading.Thread):
    """Steps the game universe as fast as asked (and as fast as the CPU allows), never waiting for drawing."""

    def __init__(self, app):
        super().__init__(daemon=True)
        self.app = app
        self.lock = threading.Lock()
        self.want = False          # the screen wants the lock (to read a snapshot or apply a click)
        self.steps = 0             # physics steps done, ever
        self.error = None
        self.acc = 0.0
        self.alive = True
        self.snap = None           # latest snapshot for the screen (published by this thread)
        self.snap_wanted = True    # the screen has used the last one

    def active(self):
        a = self.app
        return (self.error is None and a.cfg.get("max_sim", True) and a.screen_name == "game"
                and not a.paused and a.game is not None and REAL(a.u) is a.game)

    def run(self):
        last = time.perf_counter()
        while self.alive:
            now = time.perf_counter()
            dt = min(now - last, 0.25)
            last = now
            if not self.active():
                self.acc = 0.0
                time.sleep(0.004)
                continue
            a = self.app
            mult = SPEEDS[-1] if a.ff else SPEEDS[a.speed_i]
            self.acc = min(self.acc + mult * TPS * dt, mult * TPS * 0.5 + 1)
            if self.acc < 1:
                time.sleep(0.002)
                continue
            try:
                with self.lock:
                    u = a.game
                    laws0 = len(u.laws)
                    t0 = time.perf_counter()
                    u.step()
                    a.tune((time.perf_counter() - t0) * 1000)
                    if a.ff and len(u.laws) > laws0:
                        a.ff = False
                        self.acc = 0.0
                    if self.snap_wanted:             # hand the screen a fresh, consistent copy
                        self.snap = USnap(u)
                        self.snap_wanted = False
                self.acc -= 1
                self.steps += 1
            except Exception as ex:
                self.error = ex
                print("Max Simulation stopped, falling back to normal mode:", ex)
            # a click is waiting for the universe: let it in before the next step
            t_wait = time.perf_counter()
            while self.want and time.perf_counter() - t_wait < 0.2:
                time.sleep(0.0005)

    def grab(self, block=False):
        """Take the universe for a moment (clicks, saves). Blocking waits for the current step to end."""
        if not block:
            return self.lock.acquire(blocking=False)
        self.want = True
        try:
            return self.lock.acquire(blocking=True, timeout=0.5)
        finally:
            self.want = False

    def release(self):
        self.lock.release()


# ==========================================================================
# THE APP
# ==========================================================================
class App:
    def __init__(self):
        try:
            pygame.mixer.pre_init(44100, -16, 2, 1024)
        except Exception:
            pass
        pygame.init()
        self.track = 0
        try:
            pygame.display.set_icon(make_icon(64))
        except Exception:
            pass
        self.screen = pygame.display.set_mode((W, H), pygame.RESIZABLE)
        self.gl = None
        pygame.display.set_caption("Emergence - Redline Digital")
        mono = "consolas,menlo,dejavusansmono,monospace"
        self.font = pygame.font.SysFont(mono, 15)
        self.big = pygame.font.SysFont(mono, 20, bold=True)
        self.huge = pygame.font.SysFont(mono, 64, bold=True)
        self.mid = pygame.font.SysFont(mono, 26, bold=True)
        self.clock = pygame.time.Clock()
        self.canvas = pygame.Surface(self.screen.get_size())
        self.u = None
        self.look = None
        self.game = None                   # the player's universe
        self.bgu = None                    # title screen universe
        self.screen_name = "title"
        self.speed_i, self.paused, self.ff = DEFAULT_RATE, False, False
        self.start_rate = DEFAULT_RATE
        self.auto_cam, self.cam, self.zoom = True, np.zeros(2), 1.0
        self.hud, self.panel, self.scroll = True, None, 0
        self.toasts = []
        self.fx = []
        self.sprites = {}
        self.buttons = []
        self.thumbs = {}
        self.menu_scroll = 0
        self.pending_delete = None
        self.flash, self.flash_t = "", 0
        self.tps = 0.0
        self.tick_ms = 5.0
        self.dragging = False
        self.last_autosave = time.time()
        self.clear = True
        self.intro_t = 0.0
        self.vign = {}
        self.cfg = load_config()

    # ----------------------------------------------------------- universes
    def show(self, u):
        self.u = u
        self.look = Look(u)
        for k in range(u.K):
            self.look.kind(k, k in u.dark)
        self.sprites.clear()
        self.auto_cam = True
        self.cam_mode = "universe"
        self.cam_target = None
        self.cam_next = 0.0
        self.cam_event = None
        self.zoom_mult = 1.0
        self.follow_obj = None
        self.toasts, self.fx = [], []
        self.ff = False
        self.clear = True
        u.new_laws = []
        u.events = []

    def start_game(self, u, intro=False):
        self.game = u
        if u.civ is None:
            u.civ = Civ(u)
        u.civ.upgrade_state(u)
        self.launch = None
        self.sel = None
        self.feed = []
        self.logseen = u.civ.lognum
        self.pred = None
        self.show(u)
        self.screen_name = "game"
        sw_, sh_ = self.screen.get_size()
        self.cam_mode = "free"                          # free camera is the default
        self.auto_cam = False
        self.cam = np.array([u.L / 2, u.L / 2])
        self.zoom = min(sw_, sh_) * 0.92 / max(u.L * 1.15, u.Lmax * u.boost * 0.35)
        self.clear = True
        self.paused = False
        self.speed_i = getattr(self, "start_rate", DEFAULT_RATE) if intro else DEFAULT_RATE
        self.panel = None
        self.intro_t = time.time() if intro else 0.0

    def color(self, k):
        return self.look.kind(k, k in self.u.dark)["color"]

    def sprite(self, key, color, r, **kw):
        if key not in self.sprites:
            if len(self.sprites) > 4000:
                self.sprites.clear()
            self.sprites[key] = make_sprite(color, r, **kw)
        return self.sprites[key]

    def say(self, s):
        self.flash, self.flash_t = s, 240

    # --------------------------------------------------------------- saves
    def save(self, auto=False):
        u = self.game
        if u is None:
            return
        os.makedirs(SAVE_DIR, exist_ok=True)
        name = "autosave" if auto else "universe_%d_%s" % (u.seed, datetime.datetime.now().strftime("%Y%m%d_%H%M%S"))
        base = os.path.join(SAVE_DIR, name)
        try:
            ev = u.events
            u.events = []
            with open(base + ".tmp", "wb") as fh:
                pickle.dump(u, fh, protocol=pickle.HIGHEST_PROTOCOL)
            u.events = ev
            os.replace(base + ".tmp", base + ".emg")
            if self.u is u:
                pygame.image.save(pygame.transform.smoothscale(self.snapshot(), (240, 150)), base + ".png")
            meta = {"seed": u.seed, "name": getattr(u, "name", ""), "age": u.age, "laws": len(u.laws), "matter": len(u.types), "kinds": u.K,
                    "saved": datetime.datetime.now().strftime("%b %d %Y  %I:%M %p"), "auto": auto,
                    "money": u.civ.money if u.civ is not None else 0, "colonies": len(u.civ.colonies) if u.civ is not None else 0}
            with open(base + ".json", "w") as fh:
                json.dump(meta, fh)
            if not auto:
                self.say("Saved! Find it under My Universes")
        except Exception as ex:
            self.say("Save failed: %s" % ex)

    def list_saves(self, auto=False):
        if not os.path.isdir(SAVE_DIR):
            return []
        out = []
        for fn in os.listdir(SAVE_DIR):
            if not fn.endswith(".json"):
                continue
            base = os.path.join(SAVE_DIR, fn[:-5])
            is_auto = fn.startswith("autosave")
            if is_auto != auto or not os.path.exists(base + ".emg"):
                continue
            try:
                with open(base + ".json") as fh:
                    meta = json.load(fh)
            except Exception:
                continue
            meta["base"] = base
            meta["mtime"] = os.path.getmtime(base + ".emg")
            out.append(meta)
        out.sort(key=lambda m: -m["mtime"])
        return out

    def load(self, base):
        try:
            with open(base + ".emg", "rb") as fh:
                u = pickle.load(fh)
            u.ensure()
            self.start_game(u)
            self.say("Welcome back to universe #%d" % u.seed)
        except Exception as ex:
            self.say("Couldn't load that save: %s" % ex)

    # ------------------------------------------------------------ sharing
    def write_local_save(self, u, prefix, thumb_png=b"", extra=None):
        """Put a universe into My Universes (used by imports and downloads)."""
        os.makedirs(SAVE_DIR, exist_ok=True)
        base = os.path.join(SAVE_DIR, "%s_%d_%s" % (prefix, u.seed, datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")))
        with open(base + ".tmp", "wb") as fh:
            pickle.dump(u, fh, protocol=pickle.HIGHEST_PROTOCOL)
        os.replace(base + ".tmp", base + ".emg")
        if thumb_png:
            with open(base + ".png", "wb") as fh:
                fh.write(thumb_png)
        civ = u.civ
        meta = {"seed": u.seed, "name": getattr(u, "name", ""), "age": int(u.age), "laws": len(u.laws),
                "matter": len(u.types), "kinds": int(u.K), "auto": False,
                "saved": datetime.datetime.now().strftime("%b %d %Y  %I:%M %p"),
                "money": civ.money if civ is not None else 0, "colonies": len(civ.colonies) if civ is not None else 0}
        meta.update(extra or {})
        with open(base + ".json", "w") as fh:
            json.dump(meta, fh)
        return base

    def export_save(self, base):
        try:
            self.loading("PACKING YOUR UNIVERSE", "making a file you can share...")
            with open(base + ".emg", "rb") as fh:
                u = pickle.load(fh)                     # your own save, from your own disk
            u.ensure()
            thumb = b""
            if os.path.exists(base + ".png"):
                with open(base + ".png", "rb") as fh:
                    thumb = fh.read()
                if not png_ok(thumb):
                    thumb = b""
            txt, fits = share_pack(u, thumb)
            nm = clean_name(getattr(u, "name", "")) or "Universe"
            safe = "".join(c if (c.isalnum() or c in " -_") else "_" for c in nm).strip() or "Universe"
            path = os.path.join(share_dir(), "%s %d%s" % (safe, u.seed, SHARE_EXT))
            with open(path + ".tmp", "w", encoding="utf-8") as fh:
                fh.write(txt)
            os.replace(path + ".tmp", path)
            if fits:
                self.say("Exported to %s  -  upload it at redlinestudio.dev/universes.html" % path)
            else:
                self.say("Exported to %s  -  but it's %.1f MB, too big for the website (7 MB max)" % (path, len(txt) / 1e6))
            if sys.platform == "win32":
                try:
                    import subprocess
                    subprocess.Popen(["explorer", "/select,", path])
                except Exception:
                    pass
        except ShareError as ex:
            self.say("Couldn't export: %s" % ex)
        except Exception as ex:
            self.say("Couldn't export (%s: %s)" % (type(ex).__name__, ex))

    def import_file(self, path=None):
        if path is None:
            if self.cfg.get("fullscreen"):
                self.say("Leave fullscreen (F11) to use the file box  -  or just drag the .emergence file onto the game")
                return
            path = pick_file()
            if not path:
                return
        try:
            if os.path.getsize(path) > SHARE_MAX_FILE:
                raise ShareError("that file is far too big to be a universe")
            with open(path, "rb") as fh:
                text = fh.read()
            self.loading("OPENING A UNIVERSE", "checking its seal and rebuilding it piece by piece...")
            u, thumb = share_unpack(text)
            self.write_local_save(u, "imported", thumb)
            if self.screen_name in ("title", "saves", "online", "newgame"):
                self.screen_name = "saves"
                self.menu_scroll = 0
            self.say("Imported %s  -  it's in My Universes" % uname(u))
        except ShareError as ex:
            self.say("Couldn't import: %s" % ex)
        except Exception as ex:
            self.say("Couldn't import that file (%s)" % type(ex).__name__)

    def online_load(self, more=False):
        net = self.net
        if net["busy"]:
            return
        net["busy"], net["err"] = True, ""
        order, token = net["order"], (net["token"] if more else None)
        if not more:
            net["items"], net["token"] = [], None

        def run():
            try:
                items, tok = online_list(order, token)
                for it in items:
                    try:
                        png = base64.b64decode(str(it.get("thumb") or ""), validate=True)
                    except Exception:
                        png = b""
                    it["_png"] = png if png_ok(png) else b""
                net["items"] = net["items"] + items
                net["token"] = tok
            except Exception as ex:
                net["err"] = "Couldn't reach RedlineStudio (%s). Check your internet and try REFRESH." % (
                    getattr(ex, "reason", None) or type(ex).__name__)
            net["busy"] = False

        threading.Thread(target=run, daemon=True).start()

    def online_get(self, it):
        net = self.net
        if net.get("dl"):
            return
        net["dl"] = clean_name(it.get("name")) or "a universe"

        def run():
            who = clean_name(it.get("owner"))[:20]
            try:
                f = online_fetch(it)
                u, thumb = share_unpack(f)
                self.write_local_save(u, "imported", thumb, {"by": who} if who else None)
                net["done"] = "Downloaded %s%s  -  it's in My Universes" % (uname(u), (" by " + who) if who else "")
            except ShareError as ex:
                net["done"] = "Couldn't download: %s" % ex
            except Exception as ex:
                net["done"] = "Couldn't download (%s)" % (getattr(ex, "reason", None) or type(ex).__name__)
            net["dl"] = None

        threading.Thread(target=run, daemon=True).start()

    def delete_save(self, base):
        for ext in (".emg", ".json", ".png"):
            try:
                os.remove(base + ext)
            except Exception:
                pass
        self.thumbs.pop(base, None)

    # ---------------------------------------------------------- loading UI
    def loading(self, title, sub, frac=None):
        s = self.screen
        sw, sh = s.get_size()
        s.fill((4, 4, 10))
        img = self.mid.render(title, True, (235, 235, 245))
        s.blit(img, ((sw - img.get_width()) // 2, sh // 2 - 50))
        img = self.font.render(sub, True, (140, 140, 160))
        s.blit(img, ((sw - img.get_width()) // 2, sh // 2))
        if frac is not None:
            pygame.draw.rect(s, (40, 40, 60), (sw // 2 - 200, sh // 2 + 40, 400, 6))
            pygame.draw.rect(s, (170, 170, 230), (sw // 2 - 200, sh // 2 + 40, int(400 * frac), 6))
        self.present()
        pygame.event.pump()

    def make_title_universe(self):
        u = Universe(new_seed())
        u.settings["matter"] = 1600
        total = 900
        for t in range(total):
            u.next_law = min(u.next_law, u.age + 40)
            u.step()
            if t % 30 == 0:
                self.loading("EMERGENCE", "a universe is forming...", t / total)
        u.next_law = u.age + int(u.lawrng.uniform(20, 120) * TPS)
        return u

    # ------------------------------------------------------------- input
    def start_music(self):
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(44100, -16, 2, 1024)
            tracks = find_music()
            if not tracks:
                return
            self.tracks = tracks
            pygame.mixer.music.load(tracks[self.track % len(tracks)])
            pygame.mixer.music.set_volume(self.cfg.get("music", 60) / 100.0)
            pygame.mixer.music.set_endevent(MUSIC_END)
            pygame.mixer.music.play(fade_ms=3000)
        except Exception as ex:
            print("Music unavailable:", ex)

    def next_track(self):
        if getattr(self, "tracks", None):
            self.track = (self.track + 1) % len(self.tracks)
            try:
                pygame.mixer.music.load(self.tracks[self.track])
                pygame.mixer.music.set_volume(self.cfg.get("music", 60) / 100.0)
                pygame.mixer.music.play(fade_ms=2000)
            except Exception:
                pass

    def set_fullscreen(self, on):
        """Borderless fullscreen at desktop resolution (keeps the OpenGL context alive).
        Leaving it always comes back to a normal, centered, movable window."""
        try:
            from pygame._sdl2.video import Window
            win = Window.from_display_module()
            if on:
                win.set_fullscreen(desktop=True)
            else:
                win.set_windowed()
                dw, dh = pygame.display.get_desktop_sizes()[0]
                w, h = min(W, dw - 80), min(H, dh - 120)
                if w < 200 or h < 200:
                    w, h = W, H
                win.size = (w, h)
                win.position = ((dw - w) // 2, max(30, (dh - h) // 2))
        except Exception:
            try:
                if bool(pygame.display.get_surface().get_flags() & pygame.FULLSCREEN) != on:
                    pygame.display.toggle_fullscreen()
            except Exception as ex:
                print("Fullscreen not available:", ex)
        self.after_resize()

    def after_resize(self):
        """The window changed size: fit every drawing surface to it."""
        size = pygame.display.get_window_size()
        if size[0] <= 0 or size[1] <= 0:
            return
        if self.gl is None:
            self.screen = pygame.display.get_surface()
        else:
            try:
                self.gl.resize(size)
            except Exception:
                pass
            if self.screen.get_size() != size:
                self.screen = pygame.Surface(size, pygame.SRCALPHA)
        self.canvas = pygame.Surface(self.screen.get_size())
        self.clear = True

    def handle(self, e):
        if e.type == pygame.QUIT:
            return False
        if e.type == pygame.MOUSEMOTION:
            self.last_motion = time.time()
        if e.type == getattr(pygame, "DROPFILE", -12345):
            path = str(getattr(e, "file", "") or "")
            if path.lower().endswith(SHARE_EXT):
                self.import_file(path)
            elif path.lower().endswith(".emg"):
                self.say("That's a private save file. To share a universe, use EXPORT in My Universes (it makes a .emergence file)")
            else:
                self.say("Drop a .emergence file on the game to import a universe")
            return True
        t = getattr(self, "typing", None)
        if t is not None and e.type == pygame.KEYDOWN:
            if e.key in (pygame.K_RETURN, pygame.K_KP_ENTER):
                if t["target"] == "rename" and self.game is not None:
                    self.game.name = t["text"].strip()[:40]
                else:
                    self.new_name = t["text"].strip()[:40]
                self.typing = None
            elif e.key == pygame.K_ESCAPE:
                self.typing = None
            elif e.key == pygame.K_BACKSPACE:
                t["text"] = t["text"][:-1]
            elif getattr(e, "unicode", "") and e.unicode.isprintable() and len(t["text"]) < 40:
                t["text"] += e.unicode
            return True
        if e.type == pygame.KEYDOWN:
            # hidden admin mode: type the code on any screen
            ch_ = getattr(e, "unicode", "") or ""
            if ch_.isdigit():
                self.code_buf = (getattr(self, "code_buf", "") + ch_)[-4:]
                if self.code_buf == ADMIN_CODE:
                    self.admin = not getattr(self, "admin", False)
                    self.code_buf = ""
                    self.say("ADMIN MODE %s" % ("ON - money buttons are in the Agency panel (B)" if self.admin else "OFF"))
        if e.type == MUSIC_END:
            self.next_track()
            return True
        if e.type == pygame.VIDEORESIZE or e.type == getattr(pygame, "WINDOWSIZECHANGED", -12346):
            self.after_resize()
            return True
        if e.type == pygame.KEYDOWN and e.key == pygame.K_F11:
            self.cfg["fullscreen"] = not self.cfg.get("fullscreen", False)
            save_config(self.cfg)
            self.set_fullscreen(self.cfg["fullscreen"])
            return True
        if e.type == pygame.MOUSEBUTTONDOWN and e.button in (1, 3) and self.screen_name != "game":
            for rect, action in self.buttons:
                if rect.collidepoint(e.pos):
                    return self.click(action, e.button)
            return True
        if e.type == pygame.KEYDOWN and self.screen_name == "tutorial":
            if e.key in (pygame.K_RIGHT, pygame.K_RETURN, pygame.K_SPACE, pygame.K_KP_ENTER):
                return self.click(("tut", 1))
            if e.key == pygame.K_LEFT:
                return self.click(("tut", -1))
            if e.key == pygame.K_ESCAPE:
                return self.click(("tut", 99))
        if e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE:
            if self.screen_name == "title":
                return False
            if self.screen_name == "game" and self.launch:
                self.launch = None
                return True
            if self.screen_name == "game" and self.sel:
                self.sel = None
                return True
            if self.screen_name == "game" and self.panel:
                self.panel = None
                return True
            back = {"game": "pause", "pause": "game", "settings": "pause", "saves": "title", "newgame": "title", "online": "saves"}
            self.screen_name = back.get(self.screen_name, "title")
            if self.screen_name == "title":
                self.show(self.bgu)
            return True
        if e.type == pygame.MOUSEWHEEL and self.screen_name in ("saves", "online"):
            self.menu_scroll = max(0, self.menu_scroll - e.y * 60)
            return True
        if self.screen_name == "game":
            return self.handle_game(e)
        return True

    def click(self, action, button=1):
        kind = action[0]
        if kind == "key":
            return self.handle(pygame.event.Event(pygame.KEYDOWN, key=action[1], mod=0, unicode="", scancode=0))
        if kind == "typename":
            cur = getattr(self, "new_name", "") if action[1] == "new" else getattr(self.game, "name", "")
            self.typing = {"target": action[1], "text": cur}
            return True
        if getattr(self, "typing", None) and kind != "typename":
            txt = self.typing["text"].strip()[:40]      # clicking elsewhere keeps what was typed
            if self.typing["target"] == "new":
                self.new_name = txt
            elif self.game is not None:
                self.game.name = txt
            self.typing = None
        if kind == "tutorial":
            self.tut_i = 0
            self.tut_back = self.screen_name
            self.screen_name = "tutorial"
            return True
        if kind == "tut":
            step = action[1]
            if step == 99 or (step > 0 and getattr(self, "tut_i", 0) >= len(TUTORIAL) - 1):
                self.screen_name = getattr(self, "tut_back", "newgame")
            else:
                self.tut_i = int(np.clip(getattr(self, "tut_i", 0) + step, 0, len(TUTORIAL) - 1))
            return True
        if kind == "new":
            self.screen_name = "newgame"
            self.new_name = ""
            self.start_rate = DEFAULT_RATE
            self.newgame_t = time.time()
        elif kind in ("startrate", "begin") and time.time() - getattr(self, "newgame_t", 0) < 0.5:
            return True                                 # ignore the second half of a double-click
        elif kind == "startrate":
            self.start_rate = action[1]
        elif kind == "begin":
            self.save(auto=True)
            nu = Universe(new_seed())
            nu.name = getattr(self, "new_name", "")[:40]
            self.new_name = ""
            self.start_game(nu, intro=True)
        elif kind == "continue":
            if self.game is not None:
                self.start_game(self.game)
            else:
                saves = self.list_saves(auto=True)
                if saves:
                    self.load(saves[0]["base"])
        elif kind == "saves":
            self.screen_name = "saves"
            self.menu_scroll = 0
            self.pending_delete = None
        elif kind == "load":
            if button == 3:
                if self.pending_delete == action[1]:
                    self.delete_save(action[1])
                    self.pending_delete = None
                    self.say("Deleted.")
                else:
                    self.pending_delete = action[1]
                    self.say("Right-click again to delete that universe forever")
            else:
                self.save(auto=True)
                self.load(action[1])
        elif kind == "export":
            if button == 1:
                self.export_save(action[1])
        elif kind == "importfile":
            self.import_file()
        elif kind == "online":
            if not hasattr(self, "net"):
                self.net = {"items": [], "token": None, "busy": False, "err": "", "order": "createdAt", "dl": None}
            self.screen_name = "online"
            self.menu_scroll = 0
            if not self.net["items"] and not self.net["busy"]:
                self.online_load()
        elif kind == "online_order":
            self.net["order"] = action[1]
            self.menu_scroll = 0
            self.online_load()
        elif kind == "online_more":
            self.online_load(more=True)
        elif kind == "online_get":
            if button == 1:
                self.online_get(action[1])
        elif kind == "resume":
            self.screen_name = "game"
        elif kind == "save":
            self.save()
            self.screen_name = "game"
        elif kind == "settings":
            self.screen_name = "settings"
        elif kind == "title":
            self.save(auto=True)
            self.screen_name = "title"
            self.show(self.bgu)
        elif kind == "back":
            self.screen_name = action[1]
        elif kind == "quit":
            return False
        elif kind == "buyship":
            self.launch = {"type": action[1], "stage": 1}
            self.cam_mode = "universe"
            self.cam_event = None
            self.zoom_mult = 1.0
            self.auto_cam = True
            self.clear = True
            self.sel = None
        elif kind == "upgrade":
            self.game.civ.buy_upgrade(self.game, action[1])
        elif kind == "colup":
            self.game.civ.buy_colony_upgrade(self.game, action[1], action[2])
        elif kind == "follow":
            obj = action[1]
            if getattr(self, "cam_mode", "") == "follow" and getattr(self, "follow_obj", None) is obj:
                self.set_cam_mode("free")
            else:
                self.cam_mode = "follow"
                self.follow_obj = obj
                self.zoom_mult = 1.0
                self.cam_event = None
                self.say("Camera: following %s (drag the view or press C to stop)" % obj.get("name", "it"))
        elif kind == "minetoggle":
            c = action[1]
            c["paused"] = not c.get("paused", False)
        elif kind == "admin_money":
            if getattr(self, "admin", False) and self.game is not None and self.game.civ is not None:
                self.game.civ.money += action[1]
        elif kind == "buyharv":
            if not self.game.civ.buy_harvester(self.game, action[1]):
                self.say("Not enough money for a Harvester.")
        elif kind == "stance":
            civ = self.game.civ
            if civ.stance != action[1]:
                civ.set_stance(self.game, PLAYER, action[1])
        elif kind == "buywar":
            c = action[1]
            self.launch = {"type": action[2], "stage": 2, "start": self.game.civ.colony_pos(self.game, c),
                           "origin": c["name"], "colony": c}
            self.cam_mode = "universe"
            self.cam_event = None
            self.zoom_mult = 1.0
            self.auto_cam = True
            self.clear = True
            self.sel = None
        elif kind == "auto":
            self.game.civ.set_auto(self.game, not self.game.civ.auto)
        elif kind == "agency":
            self.panel = None if self.panel == "agency" else "agency"
        elif kind == "cfgset":
            key, opts, d = action[1], action[2], action[3]
            cur = self.cfg.get(key, opts[0])
            i = opts.index(cur) if cur in opts else 0
            self.cfg[key] = opts[max(0, min(len(opts) - 1, i + d))]
            save_config(self.cfg)
            try:
                pygame.mixer.music.set_volume(self.cfg.get("music", 60) / 100.0)
            except Exception:
                pass
        elif kind == "cfg":
            self.cfg[action[1]] = not self.cfg.get(action[1], False)
            save_config(self.cfg)
            if action[1] == "fullscreen":
                self.set_fullscreen(self.cfg["fullscreen"])
            self.sprites.clear()
            self.fx = []
        elif kind == "set":
            key, opts, d = action[1], action[2], action[3]
            cur = self.game.settings.get(key, opts[0])
            i = opts.index(cur) if cur in opts else 0
            self.game.settings[key] = opts[(i + d) % len(opts)]
            if key == "matter" and self.game.settings[key] == "Auto":
                self.game.auto_limit = max(len(self.game.types) + 200.0, 2000.0)
            self.clear = True
        return True

    def handle_game(self, e):
        u = self.u
        if e.type == pygame.KEYDOWN:
            k = e.key
            if k == pygame.K_SPACE:
                self.paused = not self.paused
            elif k == pygame.K_PERIOD and self.paused:
                u.step()
            elif k in (pygame.K_EQUALS, pygame.K_PLUS, pygame.K_KP_PLUS, pygame.K_RIGHTBRACKET):
                self.speed_i = min(self.speed_i + 1, len(SPEEDS) - 1)
            elif k in (pygame.K_MINUS, pygame.K_KP_MINUS, pygame.K_LEFTBRACKET):
                self.speed_i = max(self.speed_i - 1, 0)
            elif k == pygame.K_j:
                self.ff = not self.ff
                self.paused = False
            elif k == pygame.K_l:
                self.panel = None if self.panel == "laws" else "laws"
                self.scroll = 0
            elif k == pygame.K_i:
                self.panel = None if self.panel == "consts" else "consts"
            elif k == pygame.K_h:
                self.hud = not self.hud
            elif k == pygame.K_c:
                order = CAM_ORDER
                cur = getattr(self, "cam_mode", "free")
                nxt = order[(order.index(cur) + 1) % len(order)] if cur in order else "universe"
                self.set_cam_mode(nxt)
            elif k == pygame.K_g:
                self.cfg["grid"] = not self.cfg.get("grid", False)
                save_config(self.cfg)
                self.say("Gravity grid %s" % ("ON - the grid sinks where gravity pulls hardest"
                                              if self.cfg["grid"] else "OFF"))
            elif k == pygame.K_v:
                self.cam_events = not getattr(self, "cam_events", False)
                self.say("Event camera %s" % ("ON - it will fly to supernovas, shockwaves and battles"
                                              if self.cam_events else "OFF"))
            elif k == pygame.K_F5:
                self.save()
            elif k == pygame.K_b:
                self.panel = None if self.panel == "agency" else "agency"
        elif e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
            for rect, action in self.buttons:
                if rect.collidepoint(e.pos):
                    return self.click(action, 1)
            self.dragging = True
            self.moved = False
            self.down = e.pos
        elif e.type == pygame.MOUSEBUTTONDOWN and e.button == 3:
            if self.launch:
                self.launch = None
            else:
                self.sel = None
        elif e.type == pygame.MOUSEBUTTONUP and e.button == 1:
            if self.dragging and not getattr(self, "moved", True):
                self.game_click(e.pos)
            self.dragging = False
        elif e.type == pygame.MOUSEMOTION and self.dragging:
            if not self.moved and math.hypot(e.pos[0] - self.down[0], e.pos[1] - self.down[1]) < 5:
                return True
            if self.launch and self.launch["stage"] == 1:
                return True                       # stay on the whole-universe view while picking a wall
            self.moved = True
            self.auto_cam = False
            if getattr(self, "cam_mode", "free") != "free":
                self.cam_mode = "free"
                self.follow_obj = None
            self.cam_event = None
            self.cam = (self.cam - np.array(e.rel) / self.zoom) % u.L
            self.clear = True
        elif e.type == pygame.MOUSEWHEEL:
            if self.panel == "laws":
                self.scroll = max(0, self.scroll + e.y)
                return True
            if self.launch and self.launch["stage"] == 1:
                return True
            if self.panel == "agency" and pygame.mouse.get_pos()[0] > self.free_width():
                self.ascroll = int(np.clip(getattr(self, "ascroll", 0) - e.y * 40, 0, getattr(self, "ascroll_max", 0)))
                return True
            if getattr(self, "cam_mode", "free") != "free":
                self.zoom_mult = float(np.clip(getattr(self, "zoom_mult", 1.0) * (1.15 ** e.y), 0.05, 60.0))
                return True
            sw, sh = self.screen.get_size()
            m = np.array(pygame.mouse.get_pos(), float) - (sw / 2, sh / 2)
            world = self.cam + m / self.zoom
            self.auto_cam = False
            self.cam_mode = "free"
            self.cam_event = None
            zmax = min(sw, sh) / (u.rmax * 1.5)
            self.zoom = float(np.clip(self.zoom * (1.15 ** e.y), 0.02, zmax))
            self.cam = (world - m / self.zoom) % u.L
            self.clear = True
        return True

    # ------------------------------------------------------------ drawing
    def text(self, s, pos, color=(230, 230, 230), font=None, center=False):
        font = font or self.font
        img = font.render(s, True, color)
        x, y = pos
        if center:
            x -= img.get_width() // 2
        self.screen.blit(font.render(s, True, (0, 0, 0)), (x + 1, y + 1))
        self.screen.blit(img, (x, y))
        return img.get_width()

    def wrap(self, s, font, maxw):
        """Split text into lines that fit within maxw pixels."""
        lines, cur = [], ""
        for w in s.split(" "):
            t = (cur + " " + w) if cur else w
            if font.size(t)[0] <= maxw or not cur:
                cur = t
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
        return lines

    def text_wrap(self, s, pos, maxw, color=(230, 230, 230), font=None, center=False, lh=None):
        """Draw wrapped text; returns the height used."""
        font = font or self.font
        lh = lh or font.get_linesize()
        x, y = pos
        lines = self.wrap(s, font, maxw)
        for n, ln in enumerate(lines):
            self.text(ln, (x, y + n * lh), color, font, center)
        return len(lines) * lh

    def rich_lines(self, parts, font, maxw):
        """Word-wrap colored text parts into lines of parts."""
        lines, cur, curw = [], [], 0
        space = font.size(" ")[0]
        for s, k in parts:
            words = s.split(" ")
            for i, w in enumerate(words):
                lead = i > 0 or (s.startswith(" ") and i == 0)
                if w == "":
                    if i > 0:
                        cur.append((" ", k))
                        curw += space
                    continue
                piece = w
                ww = font.size(piece)[0]
                if curw + ww > maxw and cur:
                    while cur and cur[-1][0] == " ":
                        cur.pop()
                    lines.append(cur)
                    cur, curw = [], 0
                elif lead and cur and cur[-1][0] != " ":
                    cur.append((" ", k))
                    curw += space
                cur.append((piece, k))
                curw += ww
        if cur:
            lines.append(cur)
        return lines or [[]]

    def rich_wrap(self, x, y, parts, maxw, font=None, lh=None, dim=(200, 200, 210)):
        font = font or self.font
        lh = lh or font.get_linesize()
        lines = self.rich_lines(parts, font, maxw)
        for n, ln in enumerate(lines):
            self.rich(x, y + n * lh, ln, font, dim)
        return len(lines) * lh

    def rich(self, x, y, parts, font=None, dim=(200, 200, 210)):
        font = font or self.font
        for s, k in parts:
            img = font.render(s, True, self.color(k) if k >= 0 else dim)
            self.screen.blit(img, (x, y))
            x += img.get_width()
        return x

    def button(self, rect, label, action, sub=None, enabled=True, font=None):
        mouse = pygame.mouse.get_pos()
        hover = rect.collidepoint(mouse) and enabled
        box = pygame.Surface(rect.size, pygame.SRCALPHA)
        box.fill((30, 30, 55, 220) if hover else (12, 12, 26, 190))
        self.screen.blit(box, rect.topleft)
        pygame.draw.rect(self.screen, (130, 130, 200) if hover else (60, 60, 95), rect, 1, border_radius=6)
        col = (255, 255, 255) if enabled else (90, 90, 105)
        img = (font or self.big).render(label, True, col)
        cy = rect.centery - (img.get_height() // 2 if sub is None else img.get_height())
        self.screen.blit(img, (rect.centerx - img.get_width() // 2, cy))
        if sub:
            img = self.font.render(sub, True, (140, 140, 165))
            self.screen.blit(img, (rect.centerx - img.get_width() // 2, rect.centery + 2))
        if enabled:
            self.buttons.append((rect, action))

    def world_to_screen(self, pts):
        u, z = self.u, self.zoom
        sw, sh = self.screen.get_size()
        rel = (pts - self.cam + u.L / 2) % u.L - u.L / 2
        return rel[:, 0] * z + sw / 2, rel[:, 1] * z + sh / 2

    def grid_surface(self, img, outside=0):
        """Sample an (n,n,3) field at screen resolution (cost doesn't depend on zoom)."""
        u = self.u
        sw, sh = self.screen.get_size()
        n = img.shape[0]
        step = 6
        gw, gh = sw // step + 2, sh // step + 2
        px = np.arange(gw) * step
        py = np.arange(gh) * step
        wx = self.cam[0] + (px - sw / 2) / self.zoom
        wy = self.cam[1] + (py - sh / 2) / self.zoom
        cell = u.L / n
        fx = wx / cell - 0.5
        fy = wy / cell - 0.5
        ix = np.floor(fx).astype(np.int64)
        iy = np.floor(fy).astype(np.int64)
        tx = (fx - ix)[:, None, None]
        ty = (fy - iy)[None, :, None]
        a0, a1 = ix % n, (ix + 1) % n
        b0, b1 = iy % n, (iy + 1) % n
        top = img[a0][:, b0] * (1 - tx) + img[a1][:, b0] * tx
        bot = img[a0][:, b1] * (1 - tx) + img[a1][:, b1] * tx
        out = top * (1 - ty) + bot * ty
        surf = pygame.surfarray.make_surface(np.clip(out, 0, 255).astype(np.uint8))
        big = pygame.transform.smoothscale(surf, (gw * step, gh * step))
        return big, [(0, 0)]

    # ---------------------------------------------------------------- camera
    def set_cam_mode(self, mode):
        self.cam_mode = mode
        self.follow_obj = None
        self.zoom_mult = 1.0
        self.cam_target = None
        self.cam_next = 0.0
        self.cam_event = None
        self.auto_cam = mode == "universe"
        self.clear = True
        self.say("Camera: %s" % CAM_NAMES[mode])

    def follow_button(self, obj, x, y):
        on = getattr(self, "cam_mode", "") == "follow" and getattr(self, "follow_obj", None) is obj
        r = pygame.Rect(x, y, 92, 24)
        self.button(r, "FOLLOWING" if on else "FOLLOW", ("follow", obj), font=self.font)
        if on:
            pygame.draw.rect(self.screen, (255, 230, 140), r, 1, border_radius=6)

    def update_camera(self):
        """Follow modes and the event camera. The whole-universe view is handled by draw_world."""
        u = self.u
        now = time.time()
        sw, sh = self.screen.get_size()
        civ = u.civ
        # space grows: keep the camera pointed at the same place as everything spreads out
        last = getattr(self, "_camL", None)
        if last is not None and last[0] is REAL(u) and last[1] != u.L:
            self.cam = (self.cam * (u.L / last[1])) % u.L
        self._camL = (REAL(u), u.L)
        # --- event camera: fly to big moments as they happen
        if getattr(self, "cam_events", False) and not self.launch:
            found = None
            for kind, x, y, k in u.events:
                if kind == "nova":
                    found = ((x, y), u.L * 0.18)
                elif kind == "shock":
                    found = ((x, y), max(k * 2.6, u.rmax * 6))
            if civ is not None:
                seen = getattr(self, "cam_boom_seen", 0)
                for b in civ.booms:
                    if len(b) > 5 and b[5] > seen:
                        seen = b[5]
                        if b[3] >= 100:
                            found = ((b[0], b[1]), u.rmax * 10)
                self.cam_boom_seen = seen
            busy = self.cam_event is not None and now - self.cam_event["t0"] < 3.0
            if found is not None and not busy:
                self.cam_event = {"p": np.array(found[0], float), "span": found[1], "t0": now, "until": now + 7.0}
        if self.cam_event is not None and now > self.cam_event["until"]:
            self.cam_event = None
            if self.cam_mode == "universe":
                self.clear = True
        target, span = None, None
        if self.cam_event is not None:
            target, span = self.cam_event["p"], self.cam_event["span"]
        mode = self.cam_mode
        if mode == "planet" and (civ is None or not civ.plist):
            mode = "matter"                             # no worlds yet: follow matter instead
        if self.cam_event is not None:
            pass
        elif mode == "matter" and len(u.types):
            k = None
            if self.cam_target is not None and now < self.cam_next:
                hit = np.nonzero(u.uid == self.cam_target)[0]
                k = int(hit[0]) if len(hit) else None
            if k is None:
                k = int(np.random.randint(len(u.types)))
                self.cam_target = int(u.uid[k])
                self.cam_next = now + np.random.uniform(1, 100)
            target, span = u.pos[k], u.rmax * 16
        elif mode == "planet":
            pl = None
            if civ is not None and civ.plist:
                if self.cam_target is not None and now < self.cam_next:
                    pl = civ.planet_by_id(self.cam_target)
                if pl is None:
                    pl = civ.plist[int(np.random.randint(len(civ.plist)))]
                    self.cam_target = pl["id"]
                    self.cam_next = now + np.random.uniform(1, 100)
            if pl is not None:
                target, span = np.array(pl["c"], float), max(pl["r"] * 5, u.rmax * 8)
        elif mode == "agency" and civ is not None:
            # a random ship or colony - yours or any alien's
            obj = self.cam_target if (self.cam_target is not None and now < self.cam_next) else None
            if obj is not None and obj not in civ.ships and obj not in civ.colonies:
                obj = None
            if obj is None:
                pool = list(civ.ships) + list(civ.colonies)
                if pool:
                    obj = pool[int(np.random.randint(len(pool)))]
                    self.cam_next = now + np.random.uniform(1, 100)
                self.cam_target = obj
            if obj is not None:
                target = civ.colony_pos(u, obj) if obj in civ.colonies else np.array(obj["p"], float)
                span = u.rmax * (14 if obj in civ.colonies else 12)
        elif mode == "follow" and civ is not None:
            obj = getattr(self, "follow_obj", None)
            if obj is not None and obj in civ.colonies:
                target, span = civ.colony_pos(u, obj), u.rmax * 14
            elif obj is not None and obj in civ.ships:
                target, span = np.array(obj["p"], float), u.rmax * 12
            else:
                self.say("Lost track - it's gone. Camera is free.")
                self.cam_mode = "free"
                self.follow_obj = None
                return
        if target is None:
            if self.cam_mode == "universe":
                self.auto_cam = True
            return
        self.auto_cam = False
        span = span / getattr(self, "zoom_mult", 1.0)               # the player's own zoom, in any mode
        tz = float(np.clip(min(sw, sh) / max(span, 1e-6), 0.02, min(sw, sh) / (u.rmax * 1.5)))
        d = wrapd(np.array(target, float) - self.cam, u.L)
        self.cam = (self.cam + d * 0.08) % u.L
        self.zoom = float(self.zoom * (tz / self.zoom) ** 0.06)

    # ---------------------------------------------------------- GPU plumbing
    def init_gl(self):
        """Switch the window to OpenGL so the world is drawn by the graphics card (falls back to CPU)."""
        self.gl = None
        if moderngl is None or not self.cfg.get("gpu", True):
            return
        size = (W, H) if self.cfg.get("fullscreen") else self.screen.get_size()
        try:
            pygame.display.set_mode(size, pygame.OPENGL | pygame.DOUBLEBUF | pygame.RESIZABLE)
            self.gl = GLDraw()
            self.gl.resize(size)
            self.screen = pygame.Surface(size, pygame.SRCALPHA)     # menus and text are drawn here
        except Exception as ex:
            print("GPU drawing unavailable, using the CPU instead:", ex)
            self.gl = None
            self.screen = pygame.display.set_mode(size, pygame.RESIZABLE)

    def frame_begin(self):
        if self.gl is None:
            return
        size = pygame.display.get_window_size()
        if size != self.screen.get_size() and size[0] > 0 and size[1] > 0:
            self.screen = pygame.Surface(size, pygame.SRCALPHA)
            self.clear = True
        self.screen.fill((0, 0, 0, 0))

    def present(self):
        if self.gl is not None:
            self.gl.resize(self.screen.get_size())
            self.gl.present(self.screen)
        else:
            pygame.display.flip()

    def snapshot(self):
        if self.gl is not None:
            return self.gl.snapshot()
        return getattr(self, "_world_copy", None) or self.screen

    def draw_world(self):
        if self.gl is not None:
            return self.draw_world_gl()
        u, lk = self.u, self.look
        scr = self.screen
        sw, sh = scr.get_size()
        gq = u.settings.get("graphics", "High")
        if self.canvas.get_size() != (sw, sh):
            self.canvas = pygame.Surface((sw, sh))
            self.clear = True
        backdrop_mode = u is self.bgu and self.screen_name in ("title", "saves", "newgame", "tutorial", "online")
        if self.auto_cam:
            if backdrop_mode:
                newzoom = max(sw, sh) * 1.02 / u.L          # title universe fills the whole screen
            else:
                newzoom = min(sw, sh) * 0.92 / max(u.L * 1.15, u.Lmax * u.boost * 0.35) * getattr(self, "zoom_mult", 1.0)
            if abs(newzoom - self.zoom) / self.zoom > 0.05:     # only big jumps wipe the trails
                self.clear = True
            self.cam = np.array([u.L / 2, u.L / 2])
            self.zoom = newzoom
        z = self.zoom
        prev = getattr(self, "_cvcam", None)
        if prev is not None and (abs(z / prev[1] - 1) > 0.05 or
                                 float(np.abs(wrapd(self.cam - prev[0], u.L)).max()) * z > 3.0):
            self.clear = True
        self._cvcam = (self.cam.copy(), z, u.L)
        cv = self.canvas
        ADD = pygame.BLEND_ADD
        now = time.time()
        if self.clear or lk.fade >= 255:
            cv.fill((0, 0, 0))
        else:
            cv.fill((lk.fade,) * 3, special_flags=pygame.BLEND_SUB)
        self.clear = False

        types = u.types
        N = len(types)
        # at very slow speeds, slide matter smoothly between physics steps
        frac = 0.0
        if REAL(u) is self.game and self.screen_name == "game" and not self.paused and not self.ff \
                and SPEEDS[self.speed_i] * TPS < 60:
            frac = float(np.clip(getattr(self, "tick_acc", 0.0), 0, 1))
        dpos = u.pos + u.vel * frac if (N and frac > 0) else u.pos
        sx, sy = self.world_to_screen(dpos) if N else (np.zeros(0), np.zeros(0))
        vis = (sx > -80) & (sx < sw + 80) & (sy > -80) & (sy < sh + 80)
        lim = min(sw / 3, u.L * z / 2)

        # backdrop
        bd = lk.get_backdrop((sw, sh), gq)
        if self.auto_cam:
            scr.blit(bd, (0, 0))
        else:
            ox = int(-self.cam[0] * z * 0.03) % sw
            oy = int(-self.cam[1] * z * 0.03) % sh
            for dx in (-sw, 0):
                for dy in (-sh, 0):
                    scr.blit(bd, (ox + dx, oy + dy))

        # gravity wells darken space
        if u.gravity > 0 and u.gpot is not None and gq != "Low":
            p = u.gpot
            well = np.clip((p - p.min()) / (np.ptp(p) + 1e-12), 0, 1)
            shade = (255 * (0.55 + 0.45 * well))[..., None].repeat(3, -1)
            big, spots = self.grid_surface(shade, outside=255)
            for spot in spots:
                scr.blit(big, spot, special_flags=pygame.BLEND_MULT)
        # heat haze
        if u.heat is not None and u.temp is not None:
            t = np.clip(u.temp / (np.percentile(u.temp, 99) + 1e-9), 0, 1) ** 1.5
            big, spots = self.grid_surface(t[..., None] * lk.heat_col * 0.22)
            for spot in spots:
                scr.blit(big, spot, special_flags=ADD)
        # scent fog
        if u.fields:
            img = np.zeros((FS, FS, 3))
            for fd in u.fields:
                top = fd["G"].max()
                if top > 0:
                    img += np.sqrt(fd["G"] / top)[..., None] * np.array(self.color(fd["color"])) * 0.3 * lk.fog
            big, spots = self.grid_surface(img)
            for spot in spots:
                scr.blit(big, spot, special_flags=ADD)
        # cosmic currents are invisible - you only see matter being carried along
        if self.cfg.get("grid"):
            gl_ = self.spacetime_grid()
            if gl_ is not None:
                for x1, y1, x2, y2 in zip(*gl_):
                    pygame.draw.line(scr, lk.grid_col, (x1, y1), (x2, y2), 1)
        # stars
        for lt in u.lights:
            if lt["stars"] is None:
                continue
            for c, w in zip(*lt["stars"]):
                px, py = self.world_to_screen(c[None] * u.L)
                rad = int(np.clip(w * u.L * z * 0.5, 2, 300))
                spr, R = self.sprite(("star", rad), lk.star, rad, falloff=1.0, halo=0.4)
                scr.blit(spr, (int(px[0]) - R, int(py[0]) - R), special_flags=ADD)
        # black holes
        for bh in u.blackholes:
            px, py = self.world_to_screen(bh["c"][None] * u.L)
            rad = int(np.clip(bh["r"] * u.L * z * 0.35, 3, 300))
            spr, R = self.sprite(("bh", rad), lk.bh_col, rad, shape="ring", falloff=1.0, halo=0.3, peak=0.8)
            scr.blit(spr, (int(px[0]) - R, int(py[0]) - R), special_flags=ADD)
            pygame.draw.circle(scr, (0, 0, 0), (int(px[0]), int(py[0])), max(2, int(rad * 0.7)))
        # wormholes are invisible - you only see matter vanish and reappear

        # bonds (and membranes)
        if len(u.bi):
            bvis = vis[u.bi]
            bi, bj = u.bi[bvis], u.bj[bvis]
            glow = lk.bond_glow * min(1.0, (400.0 / max(len(bi), 1)) ** 0.5)
            if lk.bond_style == "membrane" and gq == "High" and len(bi):
                memb = pygame.Surface((sw, sh), pygame.SRCALPHA)
                u_ = np.concatenate([bi, bj])
                v_ = np.concatenate([bj, bi])
                order = np.argsort(u_, kind="mergesort")
                u_, v_ = u_[order], v_[order]
                tri = np.nonzero(u_[1:] == u_[:-1])[0][:2500]
                for t in tri.tolist():
                    a, b, c = u_[t], v_[t], v_[t + 1]
                    xs, ys = (sx[a], sx[b], sx[c]), (sy[a], sy[b], sy[c])
                    if max(xs) - min(xs) < lim and max(ys) - min(ys) < lim:
                        pygame.draw.polygon(memb, self.color(types[a]) + (38,), list(zip(xs, ys)))
                scr.blit(memb, (0, 0))
            # bond lines are not drawn - bonded matter shows itself by how it holds together

        # swimmers' wakes and heading arrows
        swimmers = {mo["k"] for mo in u.motors}
        if swimmers and N:
            sel = np.nonzero(vis & np.isin(types, list(swimmers)))[0]
            k = lk.streak * z
            for a in sel[:4000].tolist():
                c = self.color(types[a])
                x, y = sx[a], sy[a]
                pygame.draw.line(cv, (c[0] // 2, c[1] // 2, c[2] // 2), (x, y),
                                 (x - u.vel[a, 0] * k, y - u.vel[a, 1] * k), 1)
                if lk.arrows:
                    h = u.heading[a]
                    pygame.draw.line(cv, c, (x, y), (x + math.cos(h) * 5, y + math.sin(h) * 5), 1)

        # matter
        if N:
            if u.lights or u.feeds:
                E = u.energy
                top = self.smooth_top(max(float(np.percentile(E, 95)), 1e-6))
                en = np.clip(E / top, 0, 1)
                bright = np.where(E > 1e-9, 0.45 + 0.55 * en, 0.28)
                sizeb = np.minimum((en * 3).astype(np.int64), 2)
            else:
                bright = np.ones(N)
                sizeb = np.zeros(N, np.int64)
            phase = (np.arange(N) * 0.6180339887) % 1 * 2 * np.pi
            pulse = np.ones(N)
            for k in range(u.K):
                kd = lk.kind(k, k in u.dark)
                if kd["pulse"] > 0 and not self.cfg.get("reduce_flash"):
                    sel = types == k
                    pulse[sel] = 1 - kd["depth"] * 0.5 * (1 + np.sin(2 * np.pi * kd["pulse"] * now + phase[sel]))
            lvl = np.clip((bright * pulse * LEVELS).astype(np.int64), 0, LEVELS - 1)
            if u.hered:
                tint = np.clip(np.round(u.genes[:, 4] * 3), -3, 3).astype(np.int64)
            else:
                tint = np.zeros(N, np.int64)
            world_px = min((u.L * z) ** 2, sw * sh)
            rs = [max(1, round(u.rmax * u.radius[k] * 0.6 * z * lk.size * lk.kind(k, k in u.dark)["size"]))
                  for k in range(u.K)]
            layers = 1.0 if lk.fade >= 255 else 1.0 + min(16.0, 90.0 / lk.fade)
            cover = max(int(vis.sum()), 1) * math.pi * (np.mean(rs) * 1.4) ** 2 * layers / max(world_px, 1)
            gain = float(np.clip(1.0 / max(cover, 1e-6), 0.02, 1.0))
            gain = round(gain, 1) if gain >= 0.1 else round(gain, 2)
            liquid = np.array([lk.kind(k, k in u.dark)["liquid"] and gq != "Low" for k in range(u.K)])
            isliq = liquid[types]
            code = ((types * 7 + (tint + 3)) * 3 + sizeb) * LEVELS + lvl
            solid = vis & ~isliq
            sp = {}
            for c in np.unique(code[solid]).tolist():
                rest, l = divmod(c, LEVELS)
                rest, sb = divmod(rest, 3)
                k, tt = divmod(rest, 7)
                kd = lk.kind(k, k in u.dark)
                r = int(np.clip(round(rs[k] * (1 + 0.25 * sb)), 1, 48))
                col = tuple(int(v * (l + 1) / LEVELS) for v in lk.tinted(k, tt - 3))
                sp[c] = self.sprite(("p", c, r, gain), col, r, shape=kd["shape"], falloff=lk.falloff,
                                    halo=lk.halo * gain, peak=gain)
            cv.blits([(sp[c][0], (int(x) - sp[c][1], int(y) - sp[c][1]), None, ADD)
                      for c, x, y in zip(code[solid].tolist(), sx[solid].tolist(), sy[solid].tolist())],
                     doreturn=False)

            # liquid kinds
            lsel = vis & isliq
            if lsel.any():
                f = 3
                buf = pygame.Surface((sw // f + 1, sh // f + 1))
                buf.fill((0, 0, 0))
                lsp = {}
                for k in np.unique(types[lsel]).tolist():
                    r = int(np.clip(round(rs[k] * 1.3 / f), 2, 30))
                    lsp[k] = self.sprite(("liq", k, r), self.color(k), r, falloff=0.9, halo=0.0, peak=0.55)
                buf.blits([(lsp[t][0], (int(x / f) - lsp[t][1], int(y / f) - lsp[t][1]), None, ADD)
                           for t, x, y in zip(types[lsel].tolist(), sx[lsel].tolist(), sy[lsel].tolist())],
                          doreturn=False)
                arr = pygame.surfarray.array3d(buf).astype(np.float32)
                lum = arr.max(axis=2)
                alpha = np.clip((lum - 55) / 25, 0, 1)[..., None]
                col = arr / (lum[..., None] + 1e-3) * 235
                rim = (np.clip(1 - np.abs(lum - 62) / 14, 0, 1) * 0.7)[..., None]
                out = col * alpha * 0.8 + 255 * rim * alpha
                surf = pygame.surfarray.make_surface(np.clip(out * gain ** 0.3, 0, 255).astype(np.uint8))
                cv.blit(pygame.transform.smoothscale(surf, (sw, sh)), (0, 0), special_flags=ADD)

            # signal flashes
            if u.signals and not self.cfg.get("reduce_flash"):
                fl = np.nonzero(vis & (u.sig > 0.4))[0][:3000]
                if len(fl):
                    spr, R = self.sprite(("flash", 3), (255, 255, 255), 3, falloff=1.5, halo=0.2, peak=0.8)
                    cv.blits([(spr, (int(sx[a]) - R, int(sy[a]) - R), None, ADD) for a in fl.tolist()],
                             doreturn=False)

        # events (sparks, births, supernovas, warps)
        calm = self.cfg.get("reduce_flash")
        for kind, x, y, k in u.events:
            if kind == "warp":
                continue                                # teleports and wormholes leave no ring
            if calm and kind in ("spark", "birth"):
                continue
            self.fx.append((kind, x, y, k, now))
        u.events = []
        self.fx = [f for f in self.fx if now - f[4] < {"nova": 3.0, "birth": 0.7, "shock": 0.9}.get(f[0], 0.5)][-500:]
        if self.fx:
            pts = np.array([[f[1], f[2]] for f in self.fx])
            fxs, fys = self.world_to_screen(pts)
            for (kind, x, y, k, t0), px, py in zip(self.fx, fxs, fys):
                a = now - t0
                c = self.color(k) if k < u.K else (255, 255, 255)
                ip = (int(px), int(py))
                if kind == "nova":
                    f_ = max(0.0, 1 - a / 3.0) * (0.35 if calm else 1.0)
                    pygame.draw.circle(cv, tuple(int(v * f_) for v in (255, 240, 200)), ip, int(10 + a * 220 * z ** 0.5), 2)
                    if a < 0.4 and not calm:
                        spr, R = self.sprite(("novaflash",), (255, 250, 230), 18, falloff=0.8, halo=0.6)
                        cv.blit(spr, (ip[0] - R, ip[1] - R), special_flags=ADD)
                elif kind == "birth":
                    f_ = max(0.0, 1 - a / 0.7) * lk.spark
                    pygame.draw.circle(cv, tuple(int(v * f_) for v in c), ip, int(2 + a * 14), 1)
                elif kind == "warp":
                    f_ = max(0.0, 1 - a / 0.5)
                    pygame.draw.circle(cv, tuple(int(v * f_) for v in lk.wh_col), ip, int(3 + a * 20), 1)
                elif kind == "shock":
                    f_ = max(0.0, 1 - a / 0.9) * (0.4 if calm else 1.0)
                    pygame.draw.circle(cv, tuple(int(v * f_) for v in (190, 210, 255)), ip,
                                       max(2, int(k * z * min(1.0, a / 0.6))), 2)
                else:
                    f_ = max(0.0, 1 - a / 0.5) * lk.spark
                    spr, R = self.sprite(("spark", k, int(f_ * 6)), tuple(int(v * f_) for v in c), 2,
                                         shape="spark", falloff=1.0, halo=0.3)
                    cv.blit(spr, (ip[0] - R, ip[1] - R), special_flags=ADD)

        for b_ in self.take_bolts(now):
            pts = np.array([[b_[0], b_[1]], [b_[2], b_[3]]])
            bx, by = self.world_to_screen(pts)
            if abs(bx[0] - bx[1]) < lim and abs(by[0] - by[1]) < lim:
                f_ = max(0.0, 1 - (now - b_[5]) / 0.3) * (0.35 if calm else 1.0)
                pygame.draw.line(cv, tuple(int(v * f_) for v in (200, 220, 255)), (bx[0], by[0]), (bx[1], by[1]), 1)
        scr.blit(cv, (0, 0), special_flags=ADD)

        # bloom
        if lk.bloom > 0 and gq == "High":
            small = pygame.transform.smoothscale(cv, (max(1, sw // 10), max(1, sh // 10)))
            small = pygame.transform.smoothscale(small, (max(1, sw // 20), max(1, sh // 20)))
            v = int(255 * lk.bloom * (0.5 if calm else 1.0))
            small.fill((v, v, v), special_flags=pygame.BLEND_MULT)
            scr.blit(pygame.transform.smoothscale(small, (sw, sh)), (0, 0), special_flags=ADD)
        # vignette
        if lk.vignette > 0 and gq != "Low":
            key = (sw, sh, lk.vignette)
            if key not in self.vign:
                yy, xx = np.mgrid[0:sh, 0:sw]
                d = np.sqrt(((xx - sw / 2) / (sw / 2)) ** 2 + ((yy - sh / 2) / (sh / 2)) ** 2) / 1.42
                v = (255 * (1 - lk.vignette * np.clip(d, 0, 1) ** 2)).astype(np.uint8).T
                self.vign = {key: pygame.surfarray.make_surface(np.stack([v] * 3, -1))}
            scr.blit(self.vign[key], (0, 0), special_flags=pygame.BLEND_MULT)

    def smooth_top(self, top):
        """Brightness reference that eases instead of jumping, so energy glow never flickers."""
        prev = getattr(self, "_etop", None)
        if prev is None or getattr(self, "_etop_u", None) is not REAL(self.u):
            prev = top
        prev += (top - prev) * 0.05
        self._etop, self._etop_u = prev, REAL(self.u)
        return prev

    def take_bolts(self, now):
        """Lightning arcs from the universe, kept on screen for a moment."""
        u = self.u
        if not hasattr(self, "boltfx"):
            self.boltfx = []
        if getattr(u, "bolt_fx", None):
            self.boltfx += [b_ + (now,) for b_ in u.bolt_fx]
            u.bolt_fx = []
        self.boltfx = [b_ for b_ in self.boltfx if now - b_[5] < 0.3][-300:]
        return self.boltfx

    def spacetime_grid(self):
        """Grid lines across space, pulled toward wherever gravity is strongest."""
        u = self.u
        n = 24
        sp_ = u.L / n
        i = np.arange(n + 1)
        gx, gy = np.meshgrid(i, i, indexing="ij")
        wx, wy = gx * sp_, gy * sp_
        if u.gravity > 0 and u.gfx is not None:
            cx = np.clip((wx / u.L * GS).astype(int), 0, GS - 1)
            cy = np.clip((wy / u.L * GS).astype(int), 0, GS - 1)
            fx, fy = u.gfx[cx, cy], u.gfy[cx, cy]
            m = np.hypot(fx, fy).max() + 1e-12
            wx = wx + fx / m * sp_ * 0.45
            wy = wy + fy / m * sp_ * 0.45
        if not self.auto_cam:
            pass
        sx, sy = self.world_to_screen(np.stack([wx.ravel(), wy.ravel()], 1))
        sx, sy = sx.reshape(n + 1, n + 1), sy.reshape(n + 1, n + 1)
        x1 = np.concatenate([sx[:-1, :].ravel(), sx[:, :-1].ravel()])
        y1 = np.concatenate([sy[:-1, :].ravel(), sy[:, :-1].ravel()])
        x2 = np.concatenate([sx[1:, :].ravel(), sx[:, 1:].ravel()])
        y2 = np.concatenate([sy[1:, :].ravel(), sy[:, 1:].ravel()])
        lim = sp_ * self.zoom * 2
        ok = (np.abs(x1 - x2) < lim) & (np.abs(y1 - y2) < lim)
        if not ok.any():
            return None
        return x1[ok], y1[ok], x2[ok], y2[ok]

    def draw_world_gl(self):
        """The same picture as draw_world, drawn on the graphics card."""
        u, lk, G = self.u, self.look, self.gl
        sw, sh = self.screen.get_size()
        G.resize((sw, sh))
        gq = u.settings.get("graphics", "High")
        backdrop_mode = u is self.bgu and self.screen_name in ("title", "saves", "newgame", "tutorial", "online")
        if self.auto_cam:
            if backdrop_mode:
                newzoom = max(sw, sh) * 1.02 / u.L
            else:
                newzoom = min(sw, sh) * 0.92 / max(u.L * 1.15, u.Lmax * u.boost * 0.35) * getattr(self, "zoom_mult", 1.0)
            if abs(newzoom - self.zoom) / self.zoom > 0.05:     # only big jumps wipe the trails
                self.clear = True
            self.cam = np.array([u.L / 2, u.L / 2])
            self.zoom = newzoom
        z = self.zoom
        now = time.time()
        calm = self.cfg.get("reduce_flash")
        field_kw = dict(cam=(float(self.cam[0]), float(self.cam[1])), zoom=float(z), L=float(u.L),
                        clip=0)                         # fields wrap seamlessly - no box around the universe

        # ------------------------------------------------ the trail canvas (matter lives here)
        prev = getattr(self, "_cvcam", None)
        if prev is not None and not self.clear:
            if abs(z / prev[1] - 1) > 0.05:
                self.clear = True                      # zoom changed: old trails would smear
            else:
                dv = wrapd(self.cam - prev[0], u.L) * z
                if abs(dv[0]) + abs(dv[1]) > 0.25:
                    G.shift_canvas(-float(dv[0]), -float(dv[1]))
        self._cvcam = (self.cam.copy(), z, u.L)
        G.target("canvas")
        if self.clear or lk.fade >= 255:
            G.canvas_fb.clear(0, 0, 0, 1)
        else:
            f_ = lk.fade / 255.0
            G.full("canvas", 5, "sub", mul=(f_, f_, f_, 0.0))
        self.clear = False

        types = u.types
        N = len(types)
        # at very slow speeds, slide matter smoothly between physics steps
        frac = 0.0
        if REAL(u) is self.game and self.screen_name == "game" and not self.paused and not self.ff \
                and SPEEDS[self.speed_i] * TPS < 60:
            frac = float(np.clip(getattr(self, "tick_acc", 0.0), 0, 1))
        dpos = u.pos + u.vel * frac if (N and frac > 0) else u.pos
        sx, sy = self.world_to_screen(dpos) if N else (np.zeros(0), np.zeros(0))
        vis = (sx > -80) & (sx < sw + 80) & (sy > -80) & (sy < sh + 80)
        lim = min(sw / 3, u.L * z / 2)
        colors = np.array([self.color(k) for k in range(max(u.K, 1))], float)

        # swimmers' wakes and heading arrows
        swimmers = {mo["k"] for mo in u.motors}
        if swimmers and N:
            sel = np.nonzero(vis & np.isin(types, list(swimmers)))[0][:4000]
            if len(sel):
                k = lk.streak * z
                c = colors[types[sel]]
                G.lines("canvas", sx[sel], sy[sel], sx[sel] - u.vel[sel, 0] * k, sy[sel] - u.vel[sel, 1] * k, c // 2)
                if lk.arrows:
                    h = u.heading[sel]
                    G.lines("canvas", sx[sel], sy[sel], sx[sel] + np.cos(h) * 5, sy[sel] + np.sin(h) * 5, c)

        if N:
            en = np.zeros(N)
            if u.lights or u.feeds or u.symb:
                E = u.energy
                top = self.smooth_top(max(float(np.percentile(E, 95)), 1e-6))
                en = np.clip(E / top, 0, 1)
                bright = np.where(E > 1e-9, 0.45 + 0.55 * en, 0.28)
                sizeb = np.minimum((en * 3).astype(np.int64), 2)
            else:
                bright = np.ones(N)
                sizeb = np.zeros(N, np.int64)
            phase = (np.arange(N) * 0.6180339887) % 1 * 2 * np.pi
            pulse = np.ones(N)
            for k in range(u.K):
                kd = lk.kind(k, k in u.dark)
                if kd["pulse"] > 0 and not calm:
                    sel = types == k
                    pulse[sel] = 1 - kd["depth"] * 0.5 * (1 + np.sin(2 * np.pi * kd["pulse"] * now + phase[sel]))
            lvl = np.clip((bright * pulse * LEVELS).astype(np.int64), 0, LEVELS - 1)
            if u.hered:
                tint = np.clip(np.round(u.genes[:, 4] * 3), -3, 3).astype(np.int64)
            else:
                tint = np.zeros(N, np.int64)
            world_px = min((u.L * z) ** 2, sw * sh)
            rs = [max(1, round(u.rmax * u.radius[k] * 0.6 * z * lk.size * lk.kind(k, k in u.dark)["size"]))
                  for k in range(u.K)]
            layers = 1.0 if lk.fade >= 255 else 1.0 + min(16.0, 90.0 / lk.fade)
            cover = max(int(vis.sum()), 1) * math.pi * (np.mean(rs) * 1.4) ** 2 * layers / max(world_px, 1)
            gain = float(np.clip(1.0 / max(cover, 1e-6), 0.02, 1.0))
            gain = round(gain, 1) if gain >= 0.1 else round(gain, 2)
            liquid = np.array([lk.kind(k, k in u.dark)["liquid"] and gq != "Low" for k in range(u.K)])
            isliq = liquid[types]
            code = ((types * 7 + (tint + 3)) * 3 + sizeb) * LEVELS + lvl
            solid = vis & ~isliq
            if solid.any():
                uc, inv = np.unique(code[solid], return_inverse=True)
                cr = np.zeros(len(uc))
                ccol = np.zeros((len(uc), 3))
                cshape = np.zeros(len(uc))
                for i, c in enumerate(uc.tolist()):
                    rest, l = divmod(c, LEVELS)
                    rest, sb = divmod(rest, 3)
                    k, tt = divmod(rest, 7)
                    kd = lk.kind(k, k in u.dark)
                    cr[i] = int(np.clip(round(rs[k] * (1 + 0.25 * sb)), 1, 48))
                    ccol[i] = [int(v * (l + 1) / LEVELS) for v in lk.tinted(k, tt - 3)]
                    cshape[i] = SHAPES.index(kd["shape"])
                pcol = ccol[inv]
                if lk.speedcol:
                    spd = np.clip(np.hypot(u.vel[solid, 0], u.vel[solid, 1]) / (u.maxspeed + 1e-9), 0, 1)
                    pcol = pcol + (np.array(lk.speed_tint, float)[None, :] * (pcol.max(1, keepdims=True) / 255.0)
                                   - pcol) * (0.65 * spd)[:, None]
                if lk.streaks:
                    kk = lk.streak * z * 1.5
                    G.lines("canvas", sx[solid], sy[solid], sx[solid] - u.vel[solid, 0] * kk,
                            sy[solid] - u.vel[solid, 1] * kk, pcol * 0.5 * gain, width=max(1.0, float(np.median(cr))),
                            blend="add")
                G.sprites("canvas", sx[solid], sy[solid], cr[inv], pcol, shape=cshape[inv],
                          falloff=lk.falloff, halo=lk.halo * gain, peak=gain)
                if lk.ehalo and (u.lights or u.feeds or u.symb):
                    hot = en[solid] > 0.7
                    if hot.any():
                        G.sprites("canvas", sx[solid][hot], sy[solid][hot], cr[inv][hot] * 2.5, pcol[hot] * 0.35,
                                  falloff=0.35, halo=0.0, peak=gain)

            # liquid kinds: soft blobs in a small buffer, then a surface is cut out of them
            lsel = vis & isliq
            if lsel.any():
                f = 3
                G.liq_fb.clear(0, 0, 0, 1)
                lt = types[lsel]
                lr = np.array([int(np.clip(round(rs[k] * 1.3 / f), 2, 30)) for k in range(u.K)])
                fx_, fy_ = G.liq.size[0] / sw, G.liq.size[1] / sh
                G.sprites("liq", sx[lsel] * fx_, sy[lsel] * fy_, lr[lt], colors[lt], falloff=0.9, halo=0.0, peak=0.55)
                G.full("canvas", 3, "add", tex=G.liq, gain=float(gain ** 0.3))

            # signal flashes
            if u.signals and not calm:
                fl = np.nonzero(vis & (u.sig > 0.4))[0][:3000]
                if len(fl):
                    G.sprites("canvas", sx[fl], sy[fl], 3, [(255, 255, 255)], falloff=1.5, halo=0.2, peak=0.8)

        # events (sparks, births, supernovas, warps)
        for kind, x, y, k in u.events:
            if kind == "warp":
                continue                                # teleports and wormholes leave no ring
            if calm and kind in ("spark", "birth"):
                continue
            self.fx.append((kind, x, y, k, now))
        u.events = []
        self.fx = [f for f in self.fx if now - f[4] < {"nova": 3.0, "birth": 0.7, "shock": 0.9}.get(f[0], 0.5)][-500:]
        if self.fx:
            pts = np.array([[f[1], f[2]] for f in self.fx])
            fxs, fys = self.world_to_screen(pts)
            rings, glows = [], []
            for (kind, x, y, k, t0), px, py in zip(self.fx, fxs, fys):
                a = now - t0
                c = self.color(k) if k < u.K else (255, 255, 255)
                if kind == "nova":
                    f_ = max(0.0, 1 - a / 3.0) * (0.35 if calm else 1.0)
                    rings.append((px, py, 10 + a * 220 * z ** 0.5, [v * f_ for v in (255, 240, 200)], 2))
                    if a < 0.4 and not calm:
                        glows.append((px, py, 18, (255, 250, 230), 0, 0.8, 0.6))
                elif kind == "birth":
                    f_ = max(0.0, 1 - a / 0.7) * lk.spark
                    rings.append((px, py, 2 + a * 14, [v * f_ for v in c], 1))
                elif kind == "warp":
                    f_ = max(0.0, 1 - a / 0.5)
                    rings.append((px, py, 3 + a * 20, [v * f_ for v in lk.wh_col], 1))
                elif kind == "shock":
                    f_ = max(0.0, 1 - a / 0.9) * (0.4 if calm else 1.0)
                    rings.append((px, py, max(2.0, k * z * min(1.0, a / 0.6)), [v * f_ for v in (190, 210, 255)], 2))
                else:
                    f_ = max(0.0, 1 - a / 0.5) * lk.spark
                    glows.append((px, py, 2, [v * f_ for v in c], 4, 1.0, 0.3))
            for w in (1, 2):
                rs_ = [r_ for r_ in rings if r_[4] == w]
                if rs_:
                    G.rings("canvas", [r_[0] for r_ in rs_], [r_[1] for r_ in rs_], [r_[2] for r_ in rs_],
                            [r_[3] for r_ in rs_], width=w)
            for g_ in glows:
                G.sprites("canvas", [g_[0]], [g_[1]], g_[2], [g_[3]], shape=g_[4], falloff=g_[5], halo=g_[6])

        # lightning arcs
        bolts = self.take_bolts(now)
        if bolts:
            pts = np.array([[b_[0], b_[1]] for b_ in bolts] + [[b_[2], b_[3]] for b_ in bolts])
            bx, by = self.world_to_screen(pts)
            nb_ = len(bolts)
            x1, y1, x2, y2 = bx[:nb_], by[:nb_], bx[nb_:], by[nb_:]
            ok = (np.abs(x1 - x2) < lim) & (np.abs(y1 - y2) < lim)
            if ok.any():
                fade = np.array([max(0.0, 1 - (now - b_[5]) / 0.3) for b_ in bolts])[ok] * (0.35 if calm else 1.0)
                col = np.array([[200, 220, 255]], float) * fade[:, None]
                jx = (x1[ok] + x2[ok]) / 2 + np.random.normal(0, 3, ok.sum())
                jy = (y1[ok] + y2[ok]) / 2 + np.random.normal(0, 3, ok.sum())
                G.lines("canvas", x1[ok], y1[ok], jx, jy, col, width=1.5, blend="add")
                G.lines("canvas", jx, jy, x2[ok], y2[ok], col, width=1.5, blend="add")

        # ------------------------------------------------ the screen
        G.target("screen")
        G.drew = True
        bd = lk.get_backdrop((sw, sh), gq)
        bt = G.backdrop_tex(bd)
        if self.auto_cam:
            off = [0.0, 0.0]
        else:
            off = [float(-self.cam[0] * z * 0.03), float(-self.cam[1] * z * 0.03)]
        off[0] += lk.drift[0] * now % (2 * sw)
        off[1] += lk.drift[1] * now % (2 * sh)
        bhs = []
        if lk.lensing and u.blackholes:
            for b_ in u.blackholes[:3]:
                px_, py_ = self.world_to_screen(b_["c"][None] * u.L)
                bhs.append((float(px_[0]), float(py_[0]), float(np.clip(b_["r"] * u.L * z * 0.35, 3, 300))))
        nb_ = len(bhs)
        while len(bhs) < 3:
            bhs.append((0.0, 0.0, 0.0))
        G.full("screen", 0, "none", tex=bt, tsize=(float(sw), float(sh)), offset=tuple(off), mul=(1.0, 1.0, 1.0, 1.0),
               nbh=nb_, bh=bhs, lens=0.9)

        # gravity wells darken space
        if u.gravity > 0 and u.gpot is not None and gq != "Low":
            p = u.gpot
            well = np.clip((p - p.min()) / (np.ptp(p) + 1e-12), 0, 1)
            shade = (0.55 + 0.45 * well)[..., None].repeat(3, -1)
            G.full("screen", 2, "mult", tex=G.field("grav", shade), outside=(1.0, 1.0, 1.0), **field_kw)
        # heat haze
        if u.heat is not None and u.temp is not None:
            t = np.clip(u.temp / (np.percentile(u.temp, 99) + 1e-9), 0, 1) ** 1.5
            img = t[..., None] * np.array(lk.heat_col, float) * 0.22 / 255.0
            G.full("screen", 2, "add", tex=G.field("heat", img), outside=(0.0, 0.0, 0.0), **field_kw)
        # scent fog
        if u.fields:
            img = np.zeros((FS, FS, 3))
            for fd in u.fields:
                top = fd["G"].max()
                if top > 0:
                    img += np.sqrt(fd["G"] / top)[..., None] * np.array(self.color(fd["color"])) * 0.3 * lk.fog
            G.full("screen", 2, "add", tex=G.field("fog", img / 255.0), outside=(0.0, 0.0, 0.0), **field_kw)
        # cosmic currents are invisible - you only see matter being carried along
        if self.cfg.get("grid"):
            gl_ = self.spacetime_grid()
            if gl_ is not None:
                G.lines("screen", *gl_, lk.grid_col)
        # stars
        for lt in u.lights:
            if lt["stars"] is None:
                continue
            c, w = lt["stars"]
            px, py = self.world_to_screen(c * u.L)
            rad = np.clip((w * u.L * z * 0.5).astype(int), 2, 300)
            G.sprites("screen", px, py, rad, [lk.star], falloff=1.0, halo=0.4)
            if lk.spikes:
                tw = 0.75 + 0.25 * np.sin(now * (1.3 + np.arange(len(px)) * 0.7) + np.arange(len(px)) * 2.1)
                if calm:
                    tw = np.full(len(px), 0.85)
                G.sprites("screen", px, py, rad * 1.3, np.array(lk.star, float)[None, :] * 2.2 * tw[:, None],
                          shape=14, falloff=1.0, halo=0.0, peak=1.0)
        # black holes
        for bh in u.blackholes:
            px, py = self.world_to_screen(bh["c"][None] * u.L)
            rad = int(np.clip(bh["r"] * u.L * z * 0.35, 3, 300))
            G.sprites("screen", px, py, rad, [lk.bh_col], shape=1, falloff=1.0, halo=0.3, peak=0.8)
            G.disc("screen", float(px[0]), float(py[0]), max(2, int(rad * 0.7)), (0, 0, 0))

        # bonds (and membranes)
        if len(u.bi):
            bvis = vis[u.bi]
            bi, bj = u.bi[bvis], u.bj[bvis]
            glow = lk.bond_glow * min(1.0, (400.0 / max(len(bi), 1)) ** 0.5)
            if lk.bond_style == "membrane" and gq == "High" and len(bi):
                u_ = np.concatenate([bi, bj])
                v_ = np.concatenate([bj, bi])
                order = np.argsort(u_, kind="mergesort")
                u_, v_ = u_[order], v_[order]
                tri = np.nonzero(u_[1:] == u_[:-1])[0][:2500]
                if len(tri):
                    A, B, C = u_[tri], v_[tri], v_[tri + 1]
                    xs = np.stack([sx[A], sx[B], sx[C]], 1)
                    ys = np.stack([sy[A], sy[B], sy[C]], 1)
                    ok = (np.ptp(xs, 1) < lim) & (np.ptp(ys, 1) < lim)
                    if ok.any():
                        m = int(ok.sum())
                        v = np.empty((m, 3, 6), "f4")
                        v[:, :, 0] = xs[ok]
                        v[:, :, 1] = ys[ok]
                        v[:, :, 2:5] = (colors[types[A[ok]]] / 255.0)[:, None, :]
                        v[:, :, 5] = 38 / 255.0
                        G.tris("screen", v.reshape(-1, 6), "alpha")
            # bond lines are not drawn - bonded matter shows itself by how it holds together

        # matter on top
        G.canvas.build_mipmaps()
        G.full("screen", 1, "add", tex=G.canvas, lod=0.0, mul=(1.0, 1.0, 1.0, 1.0))
        # bloom
        if lk.bloom > 0 and gq == "High":
            v = lk.bloom * (0.5 if calm else 1.0)
            G.full("screen", 1, "add", tex=G.canvas, lod=4.3, mul=(v, v, v, 1.0))
        # vignette
        if lk.vignette > 0 and gq != "Low":
            G.full("screen", 4, "mult", vig=float(lk.vignette))

    def draw_hud(self):
        u = self.u
        s = self.screen
        sw, sh = s.get_size()
        target = SPEEDS[self.speed_i]
        actual = self.tps / TPS
        sp = "FAST-FORWARD to next law" if self.ff else "time: " + fmt_rate(RATES[self.speed_i])
        if not self.ff and target >= 1 and actual < target * 0.8 and not self.paused:
            sp += "  (your PC is doing %s)" % fmt_rate(max(actual, 1) * DAY)
        lim = u.limit()
        lim_s = "no limit" if lim == float("inf") else ("limit %d" % lim)
        self.text(uname(u).upper() + ("   #%d" % u.seed if getattr(u, "name", "") else ""), (12, 10),
                  (255, 255, 255), self.big)
        frac_ = getattr(self, "tick_acc", 0.0) if (REAL(u) is self.game and SPEEDS[self.speed_i] < 1) else 0.0
        self.text_wrap("age %s     %s%s" % (fmt_time(u.age + min(max(frac_, 0.0), 1.0)), sp,
                                           "     PAUSED" if self.paused else ""),
                       (12, 38), max(200, sw - 380), (190, 190, 205), lh=20)
        self.text("matter %d (%s)   kinds %d   laws %d   bonds %d" % (len(u.types), lim_s, u.K, len(u.laws), len(u.bi)),
                  (12, 58), (150, 150, 165))
        counts = np.bincount(u.types, minlength=u.K) if len(u.types) else np.zeros(u.K)
        fw = self.free_width()
        # clickable buttons for every key (the keys still work too)
        keys = [("PLAY" if self.paused else "PAUSE", "Space", pygame.K_SPACE, self.paused),
                ("SLOWER", "-", pygame.K_MINUS, False), ("FASTER", "+", pygame.K_EQUALS, False),
                ("NEXT LAW", "J", pygame.K_j, self.ff), ("AGENCY", "B", pygame.K_b, self.panel == "agency"),
                ("LAWS", "L", pygame.K_l, self.panel == "laws"), ("CONSTANTS", "I", pygame.K_i, self.panel == "consts"),
                ("SAVE", "F5", pygame.K_F5, False), ("CAMERA: " + CAM_NAMES.get(getattr(self, "cam_mode", "universe"), "?"), "C", pygame.K_c, False),
                ("EVENTS", "V", pygame.K_v, getattr(self, "cam_events", False)),
                ("GRAVITY GRID", "G", pygame.K_g, self.cfg.get("grid", False)),
                ("HIDE", "H", pygame.K_h, False), ("FULLSCREEN", "F11", pygame.K_F11, self.cfg.get("fullscreen")),
                ("MENU", "Esc", pygame.K_ESCAPE, False)]
        if u.civ is None:
            keys = [k_ for k_ in keys if k_[2] != pygame.K_b]
        bh, gap = 24, 6
        rows, row, rw = [], [], 12
        for label, key, code, on in keys:
            txt = "%s [%s]" % (label, key)
            w = self.font.size(txt)[0] + 16
            if row and rw + w > fw - 12:
                rows.append(row)
                row, rw = [], 12
            row.append((txt, code, on, w))
            rw += w + gap
        if row:
            rows.append(row)
        top = sh - 10 - len(rows) * (bh + gap)
        for n, row in enumerate(rows):
            x = 12
            y = top + n * (bh + gap)
            for txt, code, on, w in row:
                r = pygame.Rect(x, y, w, bh)
                self.button(r, txt, ("key", code), font=self.font)
                if on:
                    pygame.draw.rect(s, (255, 230, 140), r, 1, border_radius=6)
                x += w + gap
        bar_y = top - 16
        self.hud_top = bar_y if self.hud else sh - 20
        x, bw = 12, 360
        tot = max(len(u.types), 1)
        for k in range(u.K):
            wseg = int(round(bw * counts[k] / tot))
            if wseg:
                pygame.draw.rect(s, self.color(k), (x, bar_y, wseg, 10))
            x += wseg

    def free_width(self):
        """Screen width not covered by the side panel."""
        sw = self.screen.get_size()[0]
        return sw - (min(580, sw - 40) if self.panel else 0)

    def draw_toasts(self):
        sw = self.free_width()
        now = time.time()
        self.toasts = [t for t in self.toasts if now - t[1] < 8][-3:]
        y = 16
        for law, t0 in self.toasts:
            age = now - t0
            a = max(0.0, min(1.0, age * 3, (8 - age) / 1.5))
            head = "LAW #%d" % law["n"]
            maxw = max(160, min(sw - 80, 900))
            lines = self.rich_lines(law["parts"], self.font, maxw)
            lw = max([sum(self.font.size(p[0])[0] for p in ln) for ln in lines] + [self.big.size(head)[0]])
            wid = lw + 40
            hgt = 40 + 20 * len(lines)
            box = pygame.Surface((wid, hgt), pygame.SRCALPHA)
            box.fill((10, 10, 22, int(215 * a)))
            pygame.draw.rect(box, (120, 120, 180, int(255 * a)), box.get_rect(), 1, border_radius=8)
            x0 = (sw - wid) // 2
            self.screen.blit(box, (x0, y))
            if a > 0.25:
                self.rich(x0 + 20, y + 6, [(head, -1)], self.big, dim=(255, 230, 140))
                for n, ln in enumerate(lines):
                    self.rich(x0 + 20, y + 34 + n * 20, ln)
            y += hgt + 8

    def draw_intro(self):
        if not self.intro_t:
            return
        a = time.time() - self.intro_t
        if a > 11:
            return
        f = max(0.0, min(1.0, a * 2, (11 - a) / 2))
        sw, sh = self.screen.get_size()
        lines = ["Universe #%d has just been born." % self.u.seed,
                 "It is a single point of matter with one law of nature.",
                 "No one designed it. No one knows what it will become.",
                 "You are its first witness."]
        bw = min(760, sw - 40)
        box = pygame.Surface((bw, 170), pygame.SRCALPHA)
        box.fill((6, 6, 16, int(200 * f)))
        self.screen.blit(box, ((sw - bw) // 2, sh - 250))
        if f > 0.2:
            y = sh - 238
            for n, ln in enumerate(lines):
                col = (255, 255, 255) if n == 0 else (185, 185, 205)
                font = self.big if n == 0 else self.font
                y += self.text_wrap(ln, (sw // 2, y), bw - 30, col, font, center=True) + 8

    def draw_panel(self):
        u = self.u
        s = self.screen
        sw, sh = s.get_size()
        pw = min(580, sw - 40)
        panel = pygame.Surface((pw, sh), pygame.SRCALPHA)
        panel.fill((5, 5, 14, 215))
        s.blit(panel, (sw - pw, 0))
        x, y, lh = sw - pw + 16, 14, 20
        dim = (150, 150, 165)
        if self.panel == "agency":
            self.draw_agency_panel(x, y, pw)
            return
        if self.panel == "laws":
            self.text("LAW HISTORY - %d laws so far" % len(u.laws), (x, y), (255, 255, 255), self.big)
            y += 34
            for law in list(reversed(u.laws))[self.scroll:]:
                if y > sh - 30:
                    break
                self.text("#%-3d %s" % (law["n"], fmt_time(law["tick"])), (x, y), (255, 230, 140))
                y += lh
                y += self.rich_wrap(x + 16, y, law["parts"], pw - 50, lh=lh)
                y += 6
            return
        rows = [
            "CONSTANTS OF NATURE - universe #%d" % u.seed,
            "size of space        %.0f" % u.L,
            "matter               %d" % len(u.types),
            "force reach          %.1f" % u.rmax,
            "speed of light       %.2f" % u.maxspeed,
            "friction of space    %.3f" % (1 - u.friction),
            "temperature          %.3f" % u.temperature,
            "gravity              %s" % ("%.2f" % u.gravity if u.gravity else "none yet"),
            "neighbors felt       %d of %d" % (u.kn_eff(), u.kn),
        ]
        if getattr(u, "lawbias", None):
            fav = sorted((n for n in u.lawbias if n not in u.forbidden), key=lambda n: -u.lawbias[n])[:4]
            rows.append("this universe favours  " + ", ".join(LAW_NAMES[n] for n in fav))
            rows.append("it can never have      " + (", ".join(LAW_NAMES[n] for n in u.forbidden) or "-"))
        if u.K and u.limit() != float("inf"):
            rows.append("most each kind can fill " + "  ".join("%s %d%%" % (LET[k], round(u.share[k] * 100))
                                                             for k in range(u.K)))
        for n, r in enumerate(rows):
            if n == 0:
                self.text(r, (x, y), (255, 255, 255), self.big)
                y += 30
            else:
                y += self.text_wrap(r, (x, y), pw - 40, dim, lh=lh)
        y += 10
        parts = [T_("matter: ")]
        for k in range(u.K):
            parts += [K_(k), T_("%s " % ("(dark)" if k in u.dark else ""))]
        self.rich(x, y, parts)
        y += lh + 12
        if u.K:
            self.text("how each row feels each column (green pull / red push)", (x, y), dim)
            y += lh + 4
            cs = max(10, min(30, (pw - 60) // u.K))
            x0 = x + 20
            for k in range(u.K):
                self.rich(x0 + k * cs + cs // 3, y, [K_(k)])
                self.rich(x, y + lh + k * cs + cs // 4, [K_(k)])
            y += lh
            scale = np.abs(u.Tout[:u.K, :u.K]).mean() + 1e-12
            for a in range(u.K):
                for b in range(u.K):
                    m = u.Tout[a, b].mean()
                    if abs(m) < 1e-12:
                        col = (25, 25, 32)
                    else:
                        kk = np.tanh(m / scale)
                        col = (int(40 + 200 * max(-kk, 0)), int(40 + 200 * max(kk, 0)), 50)
                    pygame.draw.rect(s, col, (x0 + b * cs, y + a * cs, cs - 2, cs - 2))

    # ============================================================ AGENCY UI
    CIV_COL = (120, 235, 255)
    SHIP_COL = {"probe": (200, 205, 255), "colony": (120, 255, 190), "hauler": (255, 205, 120),
                "fighter": (150, 230, 255), "frigate": (110, 200, 255), "dread": (90, 160, 255),
                "harvester": (255, 170, 225)}

    def owner_color(self, owner, kind=None):
        if owner == PLAYER:
            return self.SHIP_COL.get(kind, self.CIV_COL) if kind else self.CIV_COL
        return self.u.civ.factions[owner - 1]["color"]

    def draw_ship_shape(self, scr, x, y, a, s_):
        kind, owner = s_["type"], s_["owner"]
        col = self.owner_color(owner, kind)
        size = {"probe": 5, "colony": 7, "hauler": 9, "fighter": 6, "frigate": 9, "dread": 14, "harvester": 9}[kind]
        ca, sa = math.cos(a), math.sin(a)

        def pt(fx, fy):                       # forward / sideways offsets -> screen
            return (x + ca * fx * size - sa * fy * size, y + sa * fx * size + ca * fy * size)

        style = "agency" if owner == PLAYER else self.u.civ.factions[owner - 1]["shape"]
        war = SHIP_TYPES[kind].get("war", False)
        if style == "disc":
            pygame.draw.circle(scr, col, (int(x), int(y)), max(2, int(size * 0.7)))
            pygame.draw.circle(scr, (255, 255, 255), (int(x), int(y)), max(3, int(size * 1.05)), 1)
            pygame.draw.line(scr, col, pt(0.6, 0), pt(1.4, 0), 2)
        elif style == "crescent":
            pygame.draw.polygon(scr, col, [pt(1.1, 0), pt(-0.2, 0.9), pt(-0.9, 1.1), pt(0.1, 0.3), pt(0.1, -0.3),
                                           pt(-0.9, -1.1), pt(-0.2, -0.9)])
        elif style == "spike":
            pygame.draw.polygon(scr, col, [pt(1.6, 0), pt(0, 0.45), pt(-1.0, 0), pt(0, -0.45)])
        elif style == "dart":
            pygame.draw.polygon(scr, col, [pt(1.3, 0), pt(-0.9, 0.8), pt(-0.4, 0), pt(-0.9, -0.8)])
        elif kind == "harvester":
            # a wide hull with a scoop at the front
            pygame.draw.polygon(scr, col, [pt(0.9, 0.55), pt(0.35, 0.9), pt(-0.8, 0.6), pt(-0.8, -0.6),
                                           pt(0.35, -0.9), pt(0.9, -0.55), pt(0.45, 0)])
            pygame.draw.circle(scr, (255, 255, 255), (int(x), int(y)), max(2, int(size * 0.22)))
        elif war and kind == "fighter":
            pygame.draw.polygon(scr, col, [pt(1.3, 0), pt(-0.8, 0.9), pt(-0.4, 0), pt(-0.8, -0.9)])
        elif war and kind == "frigate":
            pygame.draw.polygon(scr, col, [pt(1.4, 0), pt(0.6, 0.45), pt(-1.0, 0.45), pt(-1.0, -0.45), pt(0.6, -0.45)])
        elif war:
            poly = [pt(1.5, 0), pt(-1.0, 0.95), pt(-0.7, 0), pt(-1.0, -0.95)]
            pygame.draw.polygon(scr, col, poly)
            pygame.draw.polygon(scr, (255, 255, 255), poly, 1)
        else:
            pygame.draw.polygon(scr, col, [pt(1, 0), pt(math.cos(2.5) * 0.7, math.sin(2.5) * 0.7),
                                           pt(math.cos(2.5) * 0.7, -math.sin(2.5) * 0.7)])
        if war and s_["hull"] < s_.get("maxhull", s_["hull"]):
            hp = max(0.0, s_["hull"] / s_["maxhull"])
            pygame.draw.rect(scr, (40, 40, 50), (int(x) - 10, int(y) + size + 3, 20, 2))
            pygame.draw.rect(scr, (int(255 * (1 - hp)), int(220 * hp), 80), (int(x) - 10, int(y) + size + 3, int(20 * hp), 2))
        return col, size

    def screen_to_world(self, pos):
        sw, sh = self.screen.get_size()
        return self.cam + (np.array(pos, float) - (sw / 2, sh / 2)) / self.zoom

    def edge_point(self, pos):
        """Closest point on the universe's outer wall to the mouse, plus the inward direction."""
        u = self.u
        L = u.L
        w = self.screen_to_world(pos)
        if not self.auto_cam:
            w = w % L
        x, y = float(np.clip(w[0], 0, L)), float(np.clip(w[1], 0, L))
        opts = [(x, (0.0, y), (1, 0)), (L - x, (L, y), (-1, 0)), (y, (x, 0.0), (0, 1)), (L - y, (x, L), (0, -1))]
        _, p, n = min(opts, key=lambda o: o[0])
        return np.array(p), np.array(n, float)

    def aim_vector(self, start, pos):
        """Direction from the launch point (where it is drawn) to the mouse, exactly as seen on screen."""
        sx, sy = self.world_to_screen(np.array(start, float)[None])
        return np.array([pos[0] - sx[0], pos[1] - sy[0]], float) / self.zoom

    def colony_screen(self, c):
        u = self.u
        k = u.civ.colony_index(u, c)
        p = u.pos[k] if k >= 0 else np.array(c["p"])
        sx, sy = self.world_to_screen(np.array([p]))
        return float(sx[0]), float(sy[0]), p

    def game_click(self, pos):
        u = self.u
        civ = u.civ
        if civ is None:
            return
        if self.launch:
            ln = self.launch
            if ln["stage"] == 1:
                for c in civ.colonies:
                    if c["up"]["pad"]:
                        cx, cy, p = self.colony_screen(c)
                        if math.hypot(cx - pos[0], cy - pos[1]) < 16:
                            ln.update(stage=2, start=np.array(p, float), origin=c["name"])
                            return
                p, n = self.edge_point(pos)
                ln.update(stage=2, start=p, origin=None, normal=n)
                return
            if ln.get("colony") is not None:
                c = ln["colony"]
                if c not in civ.colonies:
                    self.say("That colony is gone - launch cancelled.")
                    self.launch = None
                    return
                ln["start"] = civ.colony_pos(u, c)
            aim = self.aim_vector(ln["start"], pos)
            if np.linalg.norm(aim) < 1e-6:
                return
            start = ln["start"]
            if ln.get("origin"):
                start = start + aim / np.linalg.norm(aim) * u.rmax * 0.6
            if civ.launch(u, ln["type"], start, aim, ln.get("origin")):
                self.sel = ("ship", civ.ships[-1])
                self.launch = None
            else:
                self.say("Not enough money for that ship.")
                self.launch = None
            return
        # select something
        best, bd = None, 18.0
        for s_ in civ.ships:
            sx, sy = self.world_to_screen(np.array([s_["p"]]))
            d = math.hypot(sx[0] - pos[0], sy[0] - pos[1])
            if d < bd:
                best, bd = ("ship", s_), d
        for c in civ.colonies:
            cx, cy, _ = self.colony_screen(c)
            d = math.hypot(cx - pos[0], cy - pos[1])
            if d < bd:
                best, bd = ("colony", c), d
        if best is None:
            pl = self.planet_at(pos)
            if pl is not None:
                best = ("planet", pl["id"])
        self.sel = best

    def planet_at(self, pos):
        u = self.u
        best, bd = None, 1e30
        for pl in u.civ.plist:
            sx, sy = self.world_to_screen(pl["c"][None])
            d = math.hypot(sx[0] - pos[0], sy[0] - pos[1])
            r = max(pl["r"] * self.zoom, 8)
            if d < r and d < bd:
                best, bd = pl, d
        return best

    def draw_civ(self):
        u = self.u
        civ = u.civ
        scr = self.screen
        sw, sh = scr.get_size()
        z = self.zoom
        colonized = {c.get("pid", -1): c["owner"] for c in civ.colonies}
        mouse = pygame.mouse.get_pos()
        hover = self.planet_at(mouse) if self.screen_name == "game" else None
        sel_pid = self.sel[1] if self.sel and self.sel[0] == "planet" else None
        # worlds
        for pl in civ.plist:
            if not self.hud and pl["id"] != sel_pid:
                continue                                  # hidden HUD: no world outlines or names
            rec = civ.planets[pl["id"]]
            sx, sy = self.world_to_screen(pl["c"][None])
            x, y = int(sx[0]), int(sy[0])
            r = max(4, int(pl["r"] * z))
            if r > 4000:
                continue
            if x < -r or x > sw + r or y < -r or y > sh + r:
                continue
            if pl["id"] in colonized:
                o = colonized[pl["id"]]
                col = (90, 220, 150) if o == PLAYER else tuple(int(v * 0.75) for v in self.owner_color(o))
            elif rec["scanned"]:
                col = (90, 130, 190)
            else:
                col = (60, 60, 75)
            if pl is hover or pl["id"] == sel_pid:
                col = tuple(min(255, c + 90) for c in col)
            pygame.draw.circle(scr, col, (x, y), r, 1)
            if rec["scanned"] and (r > 14 or pl is hover or pl["id"] in colonized or pl["id"] == sel_pid):
                self.text(rec["name"], (x, y - r - 16), col, center=True)
        # mining beams
        for x1, y1, x2, y2, kind, t in civ.fx:
            f = max(0.0, 1 - (u.age - t) / 90.0)
            a = self.world_to_screen(np.array([[x1, y1], [x2, y2]]))
            if abs(a[0][0] - a[0][1]) < sw / 3 and abs(a[1][0] - a[1][1]) < sh / 3:
                c = self.color(kind) if kind < u.K else (255, 255, 255)
                pygame.draw.line(scr, tuple(int(v * f) for v in c), (a[0][0], a[1][0]), (a[0][1], a[1][1]), 1)
        # colonies
        for c in civ.colonies:
            x, y, _ = self.colony_screen(c)
            if not (-20 < x < sw + 20 and -20 < y < sh + 20):
                continue
            selc = self.sel is not None and self.sel[0] == "colony" and self.sel[1] is c
            pulse = 0.85 if self.cfg.get("reduce_flash") else 0.6 + 0.4 * math.sin(time.time() * 3)
            ccol = self.owner_color(c["owner"])
            if c["owner"] == PLAYER:
                pygame.draw.circle(scr, tuple(int(v * pulse) for v in ccol), (int(x), int(y)), 9, 1)
                pygame.draw.circle(scr, (255, 255, 255), (int(x), int(y)), 3)
            else:
                dia = [(x, y - 10), (x + 10, y), (x, y + 10), (x - 10, y)]
                pygame.draw.polygon(scr, tuple(int(v * pulse) for v in ccol), dia, 2)
                pygame.draw.circle(scr, ccol, (int(x), int(y)), 3)
            if c["up"]["defense"]:
                pygame.draw.circle(scr, tuple(v // 2 for v in ccol), (int(x), int(y)), 13, 1)
            if c["up"]["pad"] and c["owner"] == PLAYER:
                pygame.draw.rect(scr, ccol, (int(x) - 6, int(y) + 11, 12, 3))
            if not self.hud and not selc:
                continue                                  # hidden HUD: no health bars or names
            hp = max(0.0, c["health"]) / 100
            pygame.draw.rect(scr, (40, 40, 50), (int(x) - 14, int(y) - 16, 28, 3))
            pygame.draw.rect(scr, (int(255 * (1 - hp)), int(220 * hp), 80), (int(x) - 14, int(y) - 16, int(28 * hp), 3))
            if selc or z > 0.6 or len(civ.colonies) < 6:
                self.text("%s  %d" % (c["name"], c["pop"]), (int(x) + 12, int(y) - 8),
                          (255, 255, 255) if selc else tuple(min(255, v + 40) for v in ccol))
        # ships (with the HUD hidden they're just faint dots with tracers, like more matter)
        dot_r = int(np.clip(round(u.rmax * 0.25 * z), 1, 3))
        for s_ in civ.ships:
            col = self.owner_color(s_["owner"], s_["type"])
            picked = self.sel is not None and self.sel[0] == "ship" and self.sel[1] is s_
            if not self.hud and not picked:
                dim = tuple(int(v * 0.7) for v in col)
                if len(s_["trail"]) > 1:
                    tx, ty = self.world_to_screen(np.array(s_["trail"]))
                    for i in range(len(tx) - 1):
                        if abs(tx[i] - tx[i + 1]) < 60 and abs(ty[i] - ty[i + 1]) < 60:
                            f = (i + 1) / len(tx) * 0.3
                            pygame.draw.line(scr, tuple(int(v * f) for v in col), (tx[i], ty[i]), (tx[i + 1], ty[i + 1]), 1)
                sx, sy = self.world_to_screen(np.array([s_["p"]]))
                x, y = float(sx[0]), float(sy[0])
                if -10 < x < sw + 10 and -10 < y < sh + 10:
                    pygame.draw.circle(scr, dim, (int(x), int(y)), dot_r)
                continue
            if len(s_["trail"]) > 1:
                pts = np.array(s_["trail"])
                tx, ty = self.world_to_screen(pts)
                for i in range(len(tx) - 1):
                    if abs(tx[i] - tx[i + 1]) < 60 and abs(ty[i] - ty[i + 1]) < 60:
                        f = (i + 1) / len(tx) * 0.5
                        pygame.draw.line(scr, tuple(int(v * f) for v in col), (tx[i], ty[i]), (tx[i + 1], ty[i + 1]), 1)
            sx, sy = self.world_to_screen(np.array([s_["p"]]))
            x, y = float(sx[0]), float(sy[0])
            if not (-30 < x < sw + 30 and -30 < y < sh + 30):
                continue
            vx, vy = s_["v"]
            a = math.atan2(vy, vx)
            col, size = self.draw_ship_shape(scr, x, y, a, s_)
            if s_["type"] == "harvester" and s_.get("beam") and u.age - s_.get("beam_t", -99) < 20:
                for bx_, by_ in s_["beam"]:
                    bsx, bsy = self.world_to_screen(np.array([[bx_, by_]]))
                    if abs(bsx[0] - x) < 300 and abs(bsy[0] - y) < 300:
                        pygame.draw.line(scr, (255, 200, 240), (x, y), (float(bsx[0]), float(bsy[0])), 1)
            if s_.get("approach"):
                fx = x + math.cos(a) * size * 1.4
                fy = y + math.sin(a) * size * 1.4
                pygame.draw.line(scr, (255, 160, 80), (x + math.cos(a) * size, y + math.sin(a) * size), (fx, fy), 2)
            if self.sel is not None and self.sel[0] == "ship" and self.sel[1] is s_:
                pygame.draw.circle(scr, (255, 255, 255), (int(x), int(y)), 13, 1)
                self.text(s_["name"], (int(x) + 14, int(y) - 8), col)
        # laser bolts
        for b in civ.bolts:
            bx, by = self.world_to_screen(np.array([b["p"]]))
            x1, y1 = float(bx[0]), float(by[0])
            if not (-20 < x1 < sw + 20 and -20 < y1 < sh + 20):
                continue
            sp = math.hypot(*b["v"]) + 1e-9
            ln_ = 9
            x2, y2 = x1 - b["v"][0] / sp * ln_, y1 - b["v"][1] / sp * ln_
            bc = self.owner_color(b["owner"], "fighter")
            pygame.draw.line(scr, tuple(min(255, v + 90) for v in bc), (x1, y1), (x2, y2), 2)
        # explosions (animated in real time so they read at any game speed)
        now = time.time()
        seen = getattr(self, "boom_seen", 0)
        if not hasattr(self, "boomfx"):
            self.boomfx = []
        for b in civ.booms:
            if len(b) > 5 and b[5] > seen:
                self.boomfx.append((b[0], b[1], b[3], b[4], now))
                seen = b[5]
        self.boom_seen = seen
        self.boomfx = [b for b in self.boomfx if now - b[4] < 1.4]
        calm = self.cfg.get("reduce_flash")
        for bx_, by_, size, owner, t0 in self.boomfx:
            a_ = now - t0
            sx_, sy_ = self.world_to_screen(np.array([[bx_, by_]]))
            px, py = int(sx_[0]), int(sy_[0])
            f = max(0.0, 1 - a_ / 1.4)
            rad = int(4 + a_ * (18 + size ** 0.5 * 2))
            c1 = tuple(int(v * f * (0.5 if calm else 1.0)) for v in (255, 200, 120))
            pygame.draw.circle(scr, c1, (px, py), rad, 2)
            if not calm and a_ < 0.25:
                pygame.draw.circle(scr, (255, 250, 220), (px, py), max(2, int(6 + size ** 0.5 * 0.5)))
            elif not calm:
                pygame.draw.circle(scr, tuple(int(v * f) for v in self.owner_color(owner)), (px, py), max(1, rad // 3), 1)
        # launch aiming
        ln = self.launch
        if ln and self.screen_name == "game":
            if ln["stage"] == 1:
                p, n = self.edge_point(mouse)
                sx, sy = self.world_to_screen(p[None])
                x, y = float(sx[0]), float(sy[0])
                pygame.draw.circle(scr, (255, 255, 255), (int(x), int(y)), 7, 2)
                pygame.draw.line(scr, (255, 255, 255), (x, y), (x + n[0] * 30, y + n[1] * 30), 2)
                for c in civ.colonies:
                    if c["up"]["pad"]:
                        cx, cy, _ = self.colony_screen(c)
                        pygame.draw.circle(scr, (255, 255, 160), (int(cx), int(cy)), 15, 1)
            else:
                start = ln["start"]
                aim = self.aim_vector(start, mouse)
                if np.linalg.norm(aim) > 1e-6:
                    st = SHIP_TYPES[ln["type"]]
                    vel = aim / np.linalg.norm(aim) * u.maxspeed * st["speed"]
                    key = (round(float(vel[0]), 3), round(float(vel[1]), 3), u.age // 30)
                    if self.pred is None or self.pred[0] != key:
                        tree = None
                        if cKDTree is not None and len(u.pos):
                            try:
                                tree = cKDTree(np.minimum(u.pos, u.L * (1 - 1e-9)), boxsize=u.L)
                            except Exception:
                                tree = None
                        steps = 400 * (1 + civ.up["nav"])
                        s0 = start + vel / (np.linalg.norm(vel) + 1e-9) * (u.rmax * 0.6 if ln.get("origin") else 0)
                        pts, hit = civ.predict(u, s0, vel, steps, tree, ln["type"] == "hauler",
                                               SHIP_TYPES[ln["type"]].get("war", False))
                        self.pred = (key, pts, hit)
                    _, pts, hit = self.pred
                    if len(pts):
                        px, py = self.world_to_screen(pts)
                        col = self.SHIP_COL[ln["type"]]
                        step = 4
                        for i in range(0, len(px) - step, step * 2):
                            j = i + step
                            if abs(px[i] - px[j]) < 80 and abs(py[i] - py[j]) < 80:
                                f = 1 - i / max(len(px), 1) * 0.65
                                pygame.draw.line(scr, tuple(int(v * f) for v in col), (px[i], py[i]), (px[j], py[j]), 2)
                        if hit is not None:
                            ex, ey = int(px[-1]), int(py[-1])
                            pygame.draw.circle(scr, (140, 255, 170), (ex, ey), 9, 2)
                            pid = int(u.pid[hit[1]]) if hit[1] < len(u.pid) else -1
                            rec = civ.planets.get(pid)
                            label = (rec["name"] if rec and rec["scanned"] else "unknown world") if rec else "matter"
                            self.text("-> " + label, (ex + 12, ey - 8), (140, 255, 170))
                sx, sy = self.world_to_screen(start[None])
                pygame.draw.circle(scr, (255, 255, 255), (int(sx[0]), int(sy[0])), 6, 2)

    def draw_agency_hud(self):
        civ = self.u.civ
        sw = self.screen.get_size()[0]
        bw = 330
        if self.panel:
            x, y0 = 12, 100
        else:
            x, y0 = sw - bw - 10, 8
        box = pygame.Surface((bw, 116), pygame.SRCALPHA)
        box.fill((6, 8, 18, 200))
        self.screen.blit(box, (x, y0))
        pygame.draw.rect(self.screen, (60, 90, 120), (x, y0, bw, 116), 1, border_radius=6)
        self.text(fmt_money(civ.money), (x + 12, y0 + 5), (255, 230, 140), self.mid)
        self.text("+%s / %s" % (fmt_money(civ.income_per_min(self.u)), fmt_time(PAY_TICKS).split()[0]),
                  (x + 150, y0 + 13), (170, 230, 170))
        my_c = sum(1 for c in civ.colonies if c["owner"] == PLAYER)
        my_s = sum(1 for s_ in civ.ships if s_["owner"] == PLAYER)
        self.text("colonies %d   ships %d   rep %d" % (my_c, my_s, civ.rep), (x + 12, y0 + 40), (170, 200, 220))
        left = max(0, civ.next_pay - self.u.age)
        self.text("next funding in %s" % fmt_time(left), (x + 12, y0 + 60), (120, 130, 150))
        self.button(pygame.Rect(x + bw - 112, y0 + 54, 102, 24), "AGENCY [B]", ("agency",), font=self.font)
        if civ.auto:
            label = "AUTO: ON  -  next buy in %s" % fmt_time(max(0, civ.auto_next - self.u.age))
        else:
            label = "AUTO: OFF  (click to start)"
        r = pygame.Rect(x + 10, y0 + 84, bw - 20, 24)
        self.button(r, label, ("auto",), font=self.font)
        if civ.auto:
            pygame.draw.rect(self.screen, (120, 255, 160), r, 1, border_radius=6)

    def draw_agency_panel(self, x, y, pw):
        u = self.u
        civ = u.civ
        dim = (150, 150, 165)
        sh = self.screen.get_size()[1]
        y0 = y
        y -= getattr(self, "ascroll", 0)
        inner = pw - 32                      # usable width inside the panel
        bx = x + inner - 140                 # buttons sit at the right edge
        tw = max(120, inner - 150)           # text column beside the buttons
        self.text("SPACE AGENCY", (x, y), (255, 255, 255), self.big)
        self.text(fmt_money(civ.money), (bx, y), (255, 230, 140), self.big)
        y += 32
        if getattr(self, "admin", False):
            self.text("ADMIN", (x, y + 4), (255, 120, 120))
            ax_ = x + 70
            for amt in (1000, 10000, 100000, 1000000):
                lbl = "+" + fmt_money(amt)
                wb = self.font.size(lbl)[0] + 18
                self.button(pygame.Rect(ax_, y, wb, 26), lbl, ("admin_money", amt), font=self.font)
                ax_ += wb + 6
            y += 36
        y += self.text_wrap("SHIPS: buy one, click a wall of the universe (or a launch pad), then click to aim.",
                            (x, y), inner, dim, lh=18) + 6
        for key in SHIP_ORDER:
            st = SHIP_TYPES[key]
            self.text(st["name"], (x, y + 2), self.SHIP_COL[key], self.big)
            self.button(pygame.Rect(bx, y, 140, 26), "LAUNCH " + fmt_money(st["cost"]), ("buyship", key),
                        enabled=civ.money >= st["cost"], font=self.font)
            y += 28
            y += self.text_wrap(st["desc"], (x, y), tw, (140, 140, 155), lh=18) + 8
        y += 4
        # ---- harvesters
        hst = SHIP_TYPES["harvester"]
        self.text("Harvester  %s" % fmt_money(hst["cost"]), (x, y + 2), self.SHIP_COL["harvester"], self.big)
        y += 28
        y += self.text_wrap(hst["desc"] + " Carries %d, away %s per trip." % (
            civ.harv_cap(PLAYER), fmt_time(civ.harv_away(PLAYER) * TPS)), (x, y), inner, (140, 140, 155), lh=18) + 6
        self.text("pick what it collects:", (x, y), dim)
        y += 22
        have = np.bincount(u.types, minlength=u.K) if len(u.types) else np.zeros(max(u.K, 1))
        bx2 = x
        for k in range(u.K):
            if have[k] <= 0:
                continue
            lbl = "%s %s" % (LET[k], fmt_money(civ.price(u, k)))
            wb = self.font.size(lbl)[0] + 18
            if bx2 + wb > x + inner:
                bx2 = x
                y += 30
            r_ = pygame.Rect(bx2, y, wb, 26)
            self.button(r_, lbl, ("buyharv", k), enabled=civ.money >= hst["cost"], font=self.font)
            pygame.draw.rect(self.screen, self.color(k), (r_.x + 4, r_.bottom - 4, r_.w - 8, 2))
            bx2 += wb + 6
        y += 34
        mine_h = [h for h in civ.harvesters if h["owner"] == PLAYER]
        for h in mine_h:
            if h["state"] == "in":
                st_ = "collecting %d/%d" % (h["cargo"], civ.harv_cap(PLAYER))
            else:
                st_ = "away selling - back in %s" % fmt_time(max(0, h["back"] - u.age))
            last = ("   last trip +%s" % fmt_money(h["last"])) if h["trips"] else ""
            y += self.rich_wrap(x, y, [T_(h["name"] + "  "), K_(h["kind"]), T_("  " + st_ + last)], inner, lh=18) + 2
        y += 10
        y += self.text_wrap("WARSHIPS are built at your colonies: give one a Launch Pad and a Factory, "
                            "then click the colony.", (x, y), inner, dim, lh=18) + 10
        self.text("YOUR STANCE", (x, y), dim)
        y += 22
        bw3 = max(90, (inner - 16) // 3)
        for i, st_ in enumerate(STANCES):
            r = pygame.Rect(x + i * (bw3 + 8), y, bw3, 28)
            self.button(r, st_.upper(), ("stance", st_), font=self.font)
            if civ.stance == st_:
                pygame.draw.rect(self.screen, (255, 230, 140), r, 2, border_radius=6)
        y += 34
        y += self.text_wrap(STANCE_DESC[civ.stance] + (".  Auto mode changes this every 1-10000 s." if civ.auto else "."),
                            (x, y), inner, (170, 200, 220), lh=18) + 14
        self.text("UPGRADES", (x, y), dim)
        y += 22
        for key, name, _, desc in UPGRADES:
            lvl = civ.up[key]
            self.text("%s" % name, (x, y), (220, 220, 235))
            self.text("lv %d/%d" % (lvl, UP_MAX), (x + 130, y), (255, 230, 140) if lvl else (110, 110, 125))
            if lvl >= UP_MAX:
                self.text("MAX", (bx + 50, y + 6), (140, 255, 170))
            else:
                cost = civ.up_cost(key)
                self.button(pygame.Rect(bx, y + 2, 140, 26), fmt_money(cost), ("upgrade", key),
                            enabled=civ.money >= cost, font=self.font)
            hgt = 18 + self.text_wrap(desc, (x, y + 18), tw, (130, 130, 145), lh=17)
            y += max(hgt, 32) + 8
        y += 4
        st = civ.stats
        y += self.text_wrap("launched %d   landed %d   ships lost %d   colonies lost %d" % (
            st["launched"], st["landed"], st["lost"], st["colonies_lost"]), (x, y), inner, dim, lh=18)
        y += self.text_wrap("matter mined %d   lifetime earnings %s" % (st["mined"], fmt_money(st["earned"])),
                            (x, y + 2), inner, dim, lh=18)
        y += 16
        self.text("OTHER CIVILIZATIONS", (x, y), dim)
        y += 22
        met = [f for f in civ.factions if f["arrived"]]
        if not met:
            y += self.text_wrap("None detected. If anyone else lives in this universe, they haven't arrived yet.",
                                (x, y), inner, (130, 130, 145), lh=18)
        for i, f in enumerate(civ.factions):
            if not f["arrived"]:
                continue
            o = i + 1
            nc = sum(1 for c in civ.colonies if c["owner"] == o)
            ns = sum(1 for s_ in civ.ships if s_["owner"] == o)
            self.text(("The " + f["short"]), (x, y), f["color"], self.big)
            y += 24
            mood = "AT WAR WITH YOU" if PLAYER in f["angry"] else STANCE_DESC[f["stance"]]
            y += self.text_wrap("%s   colonies %d   ships %d   %s" % (mood, nc, ns, fmt_money(f["money"])), (x, y), inner,
                                (255, 150, 130) if (PLAYER in f["angry"] or f["stance"] == "hostile") else (170, 200, 220), lh=18) + 8
        content = y + getattr(self, "ascroll", 0) - y0 + 30
        self.ascroll_max = max(0, content - sh)
        self.ascroll = min(getattr(self, "ascroll", 0), self.ascroll_max)
        if self.ascroll_max > 0:
            self.text("scroll for more" if self.ascroll < self.ascroll_max else "", (x, sh - 22), (120, 120, 140))
        # keep buttons that scrolled off screen from being clickable
        self.buttons = [(r, a) for r, a in self.buttons if r.bottom > 0 and r.top < sh]

    def draw_selection(self):
        if not self.sel:
            return
        u = self.u
        civ = u.civ
        kind, obj = self.sel
        sw, sh = self.screen.get_size()
        w, h = min(400, sw - 24), 270
        if kind == "colony" and obj.get("owner") == PLAYER:
            h = 480
        x0, y0 = 12, max(10, min(sh - h - 70, getattr(self, "hud_top", sh - 46) - h - 12))
        box = pygame.Surface((w, h), pygame.SRCALPHA)
        box.fill((6, 8, 18, 215))
        self.screen.blit(box, (x0, y0))
        pygame.draw.rect(self.screen, (60, 90, 120), (x0, y0, w, h), 1, border_radius=6)
        x, y = x0 + 12, y0 + 10
        dim = (150, 150, 165)
        if kind == "ship":
            if obj not in civ.ships:
                self.sel = None
                return
            st = SHIP_TYPES[obj["type"]]
            self.text(obj["name"], (x, y), self.owner_color(obj["owner"], obj["type"]), self.big)
            self.follow_button(obj, x0 + w - 104, y0 + 8)
            self.text("%s  -  %s" % (st["name"], civ.owner_name(obj["owner"])), (x, y + 26), dim)
            if st.get("war"):
                self.text("hull %d%%   shield %d%%" % (max(0, obj["hull"]) / obj["maxhull"] * 100,
                                                     obj["shield"] / max(obj["maxshield"], 1) * 100), (x, y + 50), (210, 210, 225))
                t = obj.get("tgt")
                self.text("target: %s" % (t["name"] if t else "none - patrolling"), (x, y + 94), (255, 170, 140) if t else dim)
            elif obj["type"] == "harvester" and obj.get("hrec"):
                rec = obj["hrec"]
                self.text("hull %d%%   cargo %d / %d" % (max(0, obj["hull"]) / st["hull"] * 100, rec["cargo"],
                                                           civ.harv_cap(obj["owner"])), (x, y + 50), (210, 210, 225))
                self.rich(x, y + 94, [T_("collects "), K_(rec["kind"]),
                                      T_("   %s" % ("heading home" if obj.get("mode") == "leave" else "harvesting"))])
            else:
                self.text("hull %d%%   fuel left %s" % (max(0, obj["hull"]) / st["hull"] * 100, fmt_time(max(0, obj["life"]))),
                          (x, y + 50), (210, 210, 225))
            self.text("speed %.0f%% of light%s" % (math.hypot(*obj["v"]) / u.maxspeed * 100,
                                                    "   LANDING BURN" if obj.get("approach") else ""), (x, y + 72), (210, 210, 225))
            if obj["pop"]:
                self.text("colonists aboard: %d" % obj["pop"], (x, y + 94), (210, 210, 225))
            return
        if kind == "colony":
            if obj not in civ.colonies:
                self.sel = None
                return
            c = obj
            self.text(c["name"], (x, y), self.owner_color(c["owner"]), self.big)
            self.follow_button(c, x0 + w - 104, y0 + 8)
            if c["owner"] != PLAYER:
                f = civ.factions[c["owner"] - 1]
                self.text("population %d    health %d%%" % (c["pop"], max(0, c["health"])), (x, y + 28), (210, 210, 225))
                self.text("belongs to %s" % f["name"], (x, y + 48), f["color"])
                self.text_wrap(("AT WAR WITH YOU" if PLAYER in f["angry"] else STANCE_DESC[f["stance"]]) +
                               "   defenses %d" % c["up"]["defense"], (x, y + 68), w - 24, (200, 200, 210), lh=18)
                return
            self.text("population %d / %d    health %d%%" % (c["pop"], c.get("cap", 0), max(0, c["health"])), (x, y + 28), (210, 210, 225))
            self.text("land in reach %d" % c.get("land", 0), (x + 260, y + 10), (130, 130, 150))
            self.text("world size %d    mined %d    earned %s" % (c.get("size", 0), c["mined"], fmt_money(c["earned"])),
                      (x, y + 48), (210, 210, 225))
            hz = c.get("hz", [])
            yy = y + 68 + self.text_wrap("conditions: " + (", ".join(h[0] for h in hz) if hz else "calm"), (x, y + 68),
                                         w - 24, (255, 170, 140) if any(h[2] < 0 for h in hz) else (170, 230, 170), lh=18) + 6
            left_ = SHELTER * TPS - (u.age - c["born"])
            if left_ > 0:
                self.text("landing shelter: safe for %s" % fmt_time(left_), (x, yy + 4), (150, 210, 255))
                yy += 22
            if c.get("paused"):
                ms_, mc_ = "Mining: PAUSED by you", (255, 200, 120)
            elif c.get("resting"):
                ms_, mc_ = "Mining: resting to save its world", (255, 210, 140)
            else:
                ms_, mc_ = "Mining: ON", (160, 230, 170)
            self.text(ms_, (x, yy + 4), mc_)
            self.button(pygame.Rect(x + w - 150, yy, 125, 24), "RESUME" if c.get("paused") else "PAUSE",
                        ("minetoggle", c), font=self.font)
            yy += 32
            for key, name, _, mx, desc in COLONY_UPS:
                lvl = c["up"].get(key, 0)
                self.text("%s %s" % (name, ("%d/%d" % (lvl, mx)) if mx > 1 else ("yes" if lvl else "")), (x, yy + 4), (220, 220, 235))
                if lvl >= mx:
                    self.text("built", (x + w - 120, yy + 4), (140, 255, 170))
                elif not civ.colony_up_ok(c, key):
                    self.text("needs pad", (x + w - 130, yy + 4), (120, 120, 135))
                else:
                    cost = civ.colony_up_cost(c, key)
                    self.button(pygame.Rect(x + w - 150, yy, 125, 24), fmt_money(cost), ("colup", c, key),
                                enabled=civ.money >= cost, font=self.font)
                yy += 32
            self.text("SHIPYARD - warships launch from here", (x, yy + 4), dim)
            yy += 26
            for i, key in enumerate(WAR_ORDER):
                st = SHIP_TYPES[key]
                self.text(st["name"], (x, yy + 4), self.SHIP_COL[key])
                if civ.can_build(c, key):
                    self.button(pygame.Rect(x + w - 150, yy, 125, 24), "BUILD " + fmt_money(st["cost"]),
                                ("buywar", c, key), enabled=civ.money >= st["cost"], font=self.font)
                else:
                    self.text("Factory lv %d" % (i + 1), (x + w - 140, yy + 4), (120, 120, 135))
                yy += 30
            return
        pl = civ.planet_by_id(obj)
        if pl is None:
            self.sel = None
            return
        rec = civ.planets[obj]
        if not rec["scanned"]:
            self.text("Unknown world", (x, y), (180, 180, 190), self.big)
            self.text("size %d particles" % pl["size"], (x, y + 28), (210, 210, 225))
            self.text("Send a ship or probe nearby to scan it,", (x, y + 56), dim)
            self.text("or upgrade Scanners.", (x, y + 74), dim)
            return
        self.text(rec["name"], (x, y), (150, 200, 255), self.big)
        self.text("size %d    worth about %s" % (pl["size"], fmt_money(pl["worth"])), (x, y + 28), (210, 210, 225))
        yy = y + 52
        order = np.argsort(-pl["comp"])
        for k in order[:5].tolist():
            n = int(pl["comp"][k])
            if n <= 0:
                continue
            frac = n / max(pl["size"], 1)
            pygame.draw.rect(self.screen, self.color(k), (x, yy + 4, int(150 * frac) + 2, 10))
            mk = civ.market(k)
            self.rich(x + 160, yy, [K_(k), T_("  %d  x %s%s" % (n, fmt_money(civ.price(u, k)),
                                                             "" if mk > 0.97 else "  (market %d%%)" % round(mk * 100)))])
            yy += 20
        hz = civ.hazards(u, pl["c"][0], pl["c"][1], pl["r"], pl["id"])
        rating, rcol = civ.danger(u, hz)
        self.text("for a colony: %s" % rating, (x + w - 190, y + 6), rcol)
        self.text_wrap("conditions: " + (", ".join(h[0] for h in hz) if hz else "calm"), (x, yy + 6), w - 24,
                       (255, 170, 140) if any(h[2] < 0 for h in hz) else (170, 230, 170), lh=18)

    def draw_feed(self):
        civ = self.u.civ
        now = time.time()
        for n, age, text, col in civ.log:
            if n > self.logseen:
                self.feed.append((text, col, now))
        self.logseen = civ.lognum
        self.feed = [f for f in self.feed if now - f[2] < 14][-7:]
        sw, sh = self.screen.get_size()
        right = sw - (min(580, sw - 40) if self.panel else 0) - 14
        maxw = max(160, min(560, right - 40))
        rows = []
        for text, col, t0 in self.feed:
            f = max(0.0, min(1.0, (14 - (now - t0)) / 3))
            c = tuple(int(v * f) for v in col)
            for ln in self.wrap(text, self.font, maxw):
                rows.append((ln, c))
        top = 200 if self.panel else 110
        room = max(1, (min(sh - 66, getattr(self, "hud_top", sh - 46) - 20) - top) // 19)
        rows = rows[-room:]
        bottom = min(sh - 66, getattr(self, "hud_top", sh - 46) - 20)
        y = bottom - len(rows) * 19
        for ln, c in rows:
            self.text(ln, (right - self.font.size(ln)[0], y), c)
            y += 19

    def draw_launch_help(self):
        if not self.launch:
            return
        sw = self.screen.get_size()[0]
        st = SHIP_TYPES[self.launch["type"]]
        if self.launch["stage"] == 1:
            msg = "%s: click a wall of the universe to launch from (or a colony with a launch pad)" % st["name"]
        else:
            msg = "%s: click to aim and launch (%s)   -   right-click / ESC to cancel" % (st["name"], fmt_money(st["cost"]))
        fw = self.free_width()
        self.text_wrap(msg, (fw // 2, 96), fw - 120, (255, 255, 255), center=True, lh=18)

    # ------------------------------------------------------------ screens
    def dim_overlay(self, alpha=150):
        sw, sh = self.screen.get_size()
        ov = pygame.Surface((sw, sh), pygame.SRCALPHA)
        ov.fill((0, 0, 8, alpha))
        self.screen.blit(ov, (0, 0))

    def draw_newgame(self):
        """Pick how fast time flows before the Big Bang."""
        sw, sh = self.screen.get_size()
        self.dim_overlay(190)
        top = max(20, sh // 2 - 290)
        self.text("HOW FAST SHOULD TIME FLOW?", (sw // 2, top), (255, 255, 255), self.mid, center=True)
        self.text_wrap("Real time is how a real universe moves - so slow it looks frozen, and colonies grow over "
                       "days. You can change speed any time with + and -.", (sw // 2, top + 44),
                       min(760, sw - 40), (170, 170, 190), center=True, lh=20)
        opts = [(0, "Real time", "1 second = 1 second. Patience of a star."),
                (RATES.index(60.0), "1 minute / sec", "Barely moving."),
                (RATES.index(3600.0), "1 hour / sec", "Slow drift you can watch."),
                (DEFAULT_RATE, "1 day / sec  (default)", "Recommended - the universe comes alive."),
                (RATES.index(30 * DAY), "1 month / sec", "Fast - laws and life arrive quickly.")]
        bw = min(620, sw - 40)
        y = top + 110
        for idx, name, sub in opts:
            r = pygame.Rect(sw // 2 - bw // 2, y, bw, 56)
            self.button(r, name, ("startrate", idx), sub=sub)
            if getattr(self, "start_rate", DEFAULT_RATE) == idx:
                pygame.draw.rect(self.screen, (255, 230, 140), r, 2, border_radius=6)
            y += 64
        self.name_box(sw // 2, y + 6, new=True)
        y += 52
        self.button(pygame.Rect(sw // 2 - 160, y + 16, 320, 54), "BEGIN THE BIG BANG", ("begin",))
        self.button(pygame.Rect(sw // 2 - 210, y + 82, 200, 40), "BACK", ("back", "title"), font=self.font)
        self.button(pygame.Rect(sw // 2 + 10, y + 82, 200, 40), "QUICK TUTORIAL", ("tutorial",), font=self.font)

    def name_box(self, cx, y, new=False):
        """A click-to-type name field (used before the Big Bang and in the pause menu)."""
        t = getattr(self, "typing", None)
        target = "new" if new else "rename"
        active = t is not None and t["target"] == target
        txt = t["text"] if active else (getattr(self, "new_name", "") if new else uname(self.game))
        w = 460
        r = pygame.Rect(cx - w // 2, y, w, 40)
        box = pygame.Surface(r.size, pygame.SRCALPHA)
        box.fill((20, 20, 40, 230) if active else (12, 12, 26, 200))
        self.screen.blit(box, r.topleft)
        pygame.draw.rect(self.screen, (255, 230, 140) if active else (70, 70, 110), r, 1, border_radius=6)
        if not txt and not active:
            self.text("Name your universe (optional) - click to type", (cx, y + 11), (120, 120, 140), center=True)
        else:
            cur = "_" if active and int(time.time() * 2) % 2 == 0 else ""
            self.text(txt + cur, (cx, y + 10), (255, 255, 255), center=True)
        if not active:
            self.buttons.append((r, ("typename", target)))
        elif not new:
            self.text("Enter to save  -  Esc to cancel", (cx, y + 46), (130, 130, 150), center=True)

    def draw_tutorial(self):
        sw, sh = self.screen.get_size()
        self.dim_overlay(205)
        i = int(np.clip(getattr(self, "tut_i", 0), 0, len(TUTORIAL) - 1))
        title, lines = TUTORIAL[i]
        w = min(820, sw - 40)
        x0 = sw // 2 - w // 2
        y = max(30, sh // 2 - 230)
        self.text("%d / %d" % (i + 1, len(TUTORIAL)), (sw // 2, y), (140, 140, 165), center=True)
        y += 26
        self.text(title, (sw // 2, y), (255, 255, 255), self.mid, center=True)
        y += 56
        for ln in lines:
            self.text("-", (x0 + 6, y), (255, 230, 140))
            y += self.text_wrap(ln, (x0 + 26, y), w - 30, (205, 205, 220), lh=21) + 12
        y = max(y + 16, sh // 2 + 150)
        last = i == len(TUTORIAL) - 1
        self.button(pygame.Rect(sw // 2 - 260, y, 160, 46), "BACK", ("tut", -1), enabled=i > 0)
        self.button(pygame.Rect(sw // 2 - 80, y, 160, 46), "DONE" if last else "NEXT", ("tut", 1))
        self.button(pygame.Rect(sw // 2 + 100, y, 160, 46), "SKIP", ("tut", 99), font=self.font)
        self.text("arrow keys or Enter to go on  -  Esc to skip", (sw // 2, y + 62), (110, 110, 130), center=True)

    def draw_title(self):
        sw, sh = self.screen.get_size()
        self.dim_overlay(90)
        top = max(30, sh // 2 - 280)
        panel = pygame.Surface((min(sw - 40, 900), 540), pygame.SRCALPHA)
        panel.fill((2, 2, 10, 170))
        self.screen.blit(panel, ((sw - panel.get_width()) // 2, top - 25))
        self.text("EMERGENCE", (sw // 2, top), (255, 255, 255), self.huge, center=True)
        self.text("You don't create a universe. You discover one.", (sw // 2, top + 85),
                  (220, 210, 170), self.big, center=True)
        lines = ["Every universe begins as a single point, with one law of nature.",
                 "Over time new laws are born on their own: matter, forces, light, heat, life.",
                 "Nothing is designed. No two universes are ever alike.",
                 "The universe behind this text belongs to someone else. Yours hasn't been born yet."]
        yy = top + 128
        for ln in lines:
            yy += self.text_wrap(ln, (sw // 2, yy), min(sw - 80, 860), (165, 165, 185), center=True, lh=20)
        bw, bh = 400, 58
        x = sw // 2 - bw // 2
        y = max(top + 240, yy + 16)
        self.button(pygame.Rect(x, y, bw, bh), "DISCOVER A NEW UNIVERSE", ("new",))
        auto = self.list_saves(auto=True)
        sub = None
        if self.game is not None:
            sub = "universe #%d - age %s" % (self.game.seed, fmt_time(self.game.age))
        elif auto:
            sub = "universe #%d - age %s" % (auto[0]["seed"], fmt_time(auto[0]["age"]))
        self.button(pygame.Rect(x, y + 70, bw, bh), "CONTINUE", ("continue",), sub,
                    enabled=self.game is not None or bool(auto))
        self.button(pygame.Rect(x, y + 140, bw, bh), "MY UNIVERSES", ("saves",))
        self.button(pygame.Rect(x, y + 210, bw, bh), "QUIT", ("quit",))

    def draw_pause(self):
        sw, sh = self.screen.get_size()
        self.dim_overlay(160)
        if getattr(self, "typing", None) and self.typing["target"] == "rename":
            self.name_box(sw // 2, sh // 2 - 205)
        else:
            self.text(uname(self.game), (sw // 2, sh // 2 - 190), (255, 255, 255), self.mid, center=True)
        self.text("age %s   -   %d laws" % (fmt_time(self.game.age), len(self.game.laws)),
                  (sw // 2, sh // 2 - 150), (170, 170, 190), center=True)
        bw, bh = 340, 54
        x = sw // 2 - bw // 2
        y = sh // 2 - 110
        for n, (label, act) in enumerate([("RESUME", ("resume",)), ("SAVE THIS UNIVERSE", ("save",)),
                                          ("RENAME THIS UNIVERSE", ("typename", "rename")),
                                          ("SETTINGS", ("settings",)), ("MAIN MENU", ("title",)), ("QUIT", ("quit",))]):
            self.button(pygame.Rect(x, y + n * 64, bw, bh), label, act)

    def draw_settings(self):
        sw, sh = self.screen.get_size()
        self.dim_overlay(190)
        u = self.game
        top = max(10, sh // 2 - 350)
        self.text("SETTINGS FOR " + uname(u).upper(), (sw // 2, top), (255, 255, 255), self.mid, center=True)
        self.text("The first three belong to this universe only. The rest apply everywhere.",
                  (sw // 2, top + 40), (170, 170, 190), center=True)
        rows = [("matter", "MATTER LIMIT", MATTER_OPTS,
                 "Auto pauses new matter when your PC slows down. Nothing is ever deleted."),
                ("quality", "SIMULATION QUALITY", QUALITY_OPTS, "How many neighbors each particle can feel."),
                ("graphics", "GRAPHICS QUALITY", QUALITY_OPTS, "Bloom, membranes, nebulae, fields and liquids.")]
        y = top + 85
        lx = max(20, sw // 2 - 330)
        for key, label, opts, help_ in rows:
            val = u.settings.get(key, opts[0])
            self.text(label, (lx, y + 14), (220, 220, 235), self.big)
            self.button(pygame.Rect(sw // 2 + 40, y, 50, 46), "<", ("set", key, opts, -1))
            self.text(str(val), (sw // 2 + 175, y + 12), (255, 230, 140), self.big, center=True)
            self.button(pygame.Rect(sw // 2 + 260, y, 50, 46), ">", ("set", key, opts, 1))
            y += 52 + self.text_wrap(help_, (lx, y + 52), sw // 2 + 310 - lx, (130, 130, 150), lh=18)
            y += 22
        if u.settings.get("matter") == "Auto":
            self.text("auto limit right now: %d" % u.auto_limit, (lx, y - 14), (130, 130, 150))
        y += 10
        self.text("REDUCED FLASHING", (lx, y + 14), (220, 220, 235), self.big)
        on = self.cfg.get("reduce_flash")
        self.button(pygame.Rect(sw // 2 + 40, y, 270, 46), "ON" if on else "OFF", ("cfg", "reduce_flash"))
        y += 52 + self.text_wrap("All universes. Turns off pulsing, sparks, flashes and supernova bursts.",
                                 (lx, y + 52), sw // 2 + 310 - lx, (130, 130, 150), lh=18)
        y += 22
        self.text("FULLSCREEN", (lx, y + 14), (220, 220, 235), self.big)
        fs = self.cfg.get("fullscreen", False)
        self.button(pygame.Rect(sw // 2 + 40, y, 270, 46), "ON" if fs else "OFF", ("cfg", "fullscreen"))
        y += 52 + self.text_wrap("Fills your whole screen. F11 switches any time.", (lx, y + 52),
                                 sw // 2 + 310 - lx, (130, 130, 150), lh=18)
        y += 22
        self.text("MAX SIMULATION", (lx, y + 14), (220, 220, 235), self.big)
        ms_on = self.cfg.get("max_sim", True)
        self.button(pygame.Rect(sw // 2 + 40, y, 270, 46), "ON" if ms_on else "OFF", ("cfg", "max_sim"))
        y += 52 + self.text_wrap("Runs the universe on its own thread so menus and the camera stay smooth even when your PC "
                                 "can't keep up - matter just updates less often (choppy on purpose). Experimental: if you see "
                                 "glitches or crashes, turn this OFF.", (lx, y + 52), sw // 2 + 310 - lx, (130, 130, 150), lh=18)
        y += 22
        self.text("GPU GRAPHICS", (lx, y + 14), (220, 220, 235), self.big)
        on = self.cfg.get("gpu", True)
        self.button(pygame.Rect(sw // 2 + 40, y, 270, 46), "ON" if on else "OFF", ("cfg", "gpu"))
        now_on = self.gl is not None
        note = "Draws the universe on your graphics card so the CPU can run the physics. " + (
            "Takes effect next time you start the game." if on != now_on else
            ("Running on your GPU now." if now_on else "Off - drawing on the CPU."))
        y += 52 + self.text_wrap(note, (lx, y + 52), sw // 2 + 310 - lx, (130, 130, 150), lh=18)
        y += 22
        self.text("MUSIC VOLUME", (lx, y + 14), (220, 220, 235), self.big)
        self.button(pygame.Rect(sw // 2 + 40, y, 50, 46), "<", ("cfgset", "music", MUSIC_OPTS, -1))
        vol = self.cfg.get("music", 60)
        self.text("OFF" if vol == 0 else "%d%%" % vol, (sw // 2 + 175, y + 12), (255, 230, 140), self.big, center=True)
        self.button(pygame.Rect(sw // 2 + 260, y, 50, 46), ">", ("cfgset", "music", MUSIC_OPTS, 1))
        y += 56
        self.button(pygame.Rect(sw // 2 - 150, y + 14, 300, 50), "BACK", ("back", "pause"))

    def draw_saves(self):
        s = self.screen
        sw, sh = s.get_size()
        self.dim_overlay(200)
        self.text("MY UNIVERSES", (30, 22), (255, 255, 255), self.mid)
        self.text_wrap("click to keep watching from the moment you saved  -  right-click twice to delete  -  EXPORT makes a "
                       "file you can share  -  drop a .emergence file anywhere on the game to import it  -  ESC to go back",
                       (30, 60), max(300, sw - 660), (140, 140, 155), lh=18)
        self.button(pygame.Rect(sw - 600, 20, 190, 44), "IMPORT FILE", ("importfile",), font=self.font)
        self.button(pygame.Rect(sw - 400, 20, 200, 44), "BROWSE ONLINE", ("online",), font=self.font)
        saves = self.list_saves()
        if not saves:
            self.text("No saved universes yet. Press F5 inside a universe to save it here.", (30, 110), (190, 190, 205))
        tw, th = 260, 230
        cols = max(1, (sw - 40) // (tw + 20))
        for n, item in enumerate(saves):
            x = 30 + (n % cols) * (tw + 20)
            y = 100 + (n // cols) * (th + 20) - self.menu_scroll
            if y > sh or y + th < 0:
                continue
            rect = pygame.Rect(x, y, tw, th)
            hover = rect.collidepoint(pygame.mouse.get_pos())
            pend = self.pending_delete == item["base"]
            pygame.draw.rect(s, (60, 20, 25) if pend else ((30, 30, 52) if hover else (18, 18, 32)), rect, border_radius=10)
            pygame.draw.rect(s, (90, 90, 140) if hover else (45, 45, 70), rect, 1, border_radius=10)
            base = item["base"]
            if base not in self.thumbs:
                try:
                    self.thumbs[base] = pygame.image.load(base + ".png").convert()
                except Exception:
                    self.thumbs[base] = None
            if self.thumbs[base] is not None:
                if self.thumbs[base].get_size() != (240, 150):
                    self.thumbs[base] = pygame.transform.smoothscale(self.thumbs[base], (240, 150))
                s.blit(self.thumbs[base], (x + 10, y + 10))
            nm = item.get("name") or ""
            self.text((nm[:24] + "  #%d" % item["seed"]) if nm else "#%d" % item["seed"], (x + 12, y + 166), (255, 255, 255))
            extra = ("   %s" % fmt_money(item["money"])) if "money" in item else ""
            self.text("age %s   %d laws%s" % (fmt_time(item["age"]), item["laws"], extra), (x + 12, y + 186), (170, 170, 185))
            self.text(("from %s" % item["by"]) if item.get("by") else item["saved"], (x + 12, y + 206), (110, 110, 125))
            self.button(pygame.Rect(x + tw - 84, y + 200, 74, 24), "EXPORT", ("export", base), font=self.font)
            self.buttons.append((rect, ("load", base)))
        self.button(pygame.Rect(sw - 190, 20, 160, 44), "BACK", ("back", "title"))

    def draw_online(self):
        s = self.screen
        sw, sh = s.get_size()
        net = self.net
        self.dim_overlay(200)
        if net.get("done"):
            self.say(net.pop("done"))
        self.text("SHARED UNIVERSES", (30, 22), (255, 255, 255), self.mid)
        self.text_wrap("Universes players uploaded to redlinestudio.dev. Click one to download it into My Universes.  "
                       "To share yours: My Universes > EXPORT, then upload the file at redlinestudio.dev/universes.html",
                       (30, 60), max(300, sw - 260), (140, 140, 155), lh=18)
        self.button(pygame.Rect(sw - 190, 20, 160, 44), "BACK", ("back", "saves"))
        bx = 30
        for label, key in (("NEWEST", "createdAt"), ("MOST LIKED", "likes"), ("MOST DOWNLOADED", "downloads")):
            r = pygame.Rect(bx, 104, 190, 34)
            self.button(r, label, ("online_order", key), font=self.font)
            if net["order"] == key:
                pygame.draw.rect(s, (255, 230, 140), r, 2, border_radius=6)
            bx += 200
        self.button(pygame.Rect(bx, 104, 120, 34), "REFRESH", ("online_order", net["order"]), font=self.font)
        top = 156
        items = net["items"]
        if net["err"]:
            self.text(net["err"], (30, top), (255, 160, 140))
        elif not items:
            self.text("Loading the shelf..." if net["busy"] else "Nobody has shared a universe yet. Be the first!",
                      (30, top), (190, 190, 205))
        tw, th = 260, 230
        cols = max(1, (sw - 40) // (tw + 20))
        mouse = pygame.mouse.get_pos()
        for n, it in enumerate(items):
            x = 30 + (n % cols) * (tw + 20)
            y = top + (n // cols) * (th + 20) - self.menu_scroll
            if y > sh or y + th < 0:
                continue
            rect = pygame.Rect(x, y, tw, th)
            hover = rect.collidepoint(mouse)
            pygame.draw.rect(s, (30, 30, 52) if hover else (18, 18, 32), rect, border_radius=10)
            pygame.draw.rect(s, (90, 90, 140) if hover else (45, 45, 70), rect, 1, border_radius=10)
            if "_surf" not in it:
                it["_surf"] = None
                if it.get("_png"):
                    try:
                        img = pygame.image.load(io.BytesIO(it["_png"]), "t.png").convert()
                        it["_surf"] = pygame.transform.smoothscale(img, (240, 150))
                    except Exception:
                        it["_surf"] = None
            if it["_surf"] is not None:
                s.blit(it["_surf"], (x + 10, y + 10))
            else:
                pygame.draw.rect(s, (8, 8, 16), (x + 10, y + 10, 240, 150))
            try:
                seed = int(it.get("seed") or 0)
                age = int(it.get("age") or 0)
                laws = int(it.get("laws") or 0)
            except Exception:
                seed = age = laws = 0
            nm = clean_name(it.get("name")) or "Universe #%d" % seed
            self.text(nm[:28], (x + 12, y + 166), (255, 255, 255))
            self.text("age %s   %d laws" % (fmt_time(age), laws), (x + 12, y + 186), (170, 170, 185))
            self.text("by %s   ^%d   v%d downloads" % (clean_name(it.get("owner"))[:12] or "?",
                                                      int(it.get("likes") or 0), int(it.get("downloads") or 0)),
                      (x + 12, y + 206), (110, 110, 125))
            self.buttons.append((rect, ("online_get", it)))
        rows = (len(items) + cols - 1) // cols
        if net["token"] and items:
            r = pygame.Rect(sw // 2 - 110, top + rows * (th + 20) - self.menu_scroll + 4, 220, 44)
            if r.y < sh:
                self.button(r, "LOADING..." if net["busy"] else "MORE", ("online_more",), font=self.font,
                            enabled=not net["busy"])
        if net.get("dl"):
            box = pygame.Surface((sw, 70), pygame.SRCALPHA)
            box.fill((0, 0, 0, 200))
            s.blit(box, (0, sh // 2 - 35))
            self.text("Downloading %s and checking it..." % net["dl"], (sw // 2, sh // 2 - 10), (255, 230, 140),
                      self.big, center=True)

    # ------------------------------------------------------------- main loop
    def tune(self, ms):
        u = self.u
        if u.settings.get("matter") != "Auto":
            return
        self.tick_ms = 0.9 * self.tick_ms + 0.1 * ms
        N = len(u.types)
        # Auto keeps a tick under ~6 ms so fast-forward still has real speed to give
        if self.tick_ms > 6.5 and u.auto_limit > N:
            u.auto_limit = float(max(N, 500))
        elif self.tick_ms < 3.5 and N >= u.auto_limit - 100:
            u.auto_limit = float(N + 300)

    def warning(self):
        """Photosensitivity warning, shown every launch. Returns False if the window was closed."""
        t0 = time.time()
        while True:
            for e in pygame.event.get():
                if e.type == pygame.QUIT:
                    return False
                if e.type == pygame.KEYDOWN:
                    if e.key == pygame.K_r:
                        self.cfg["reduce_flash"] = not self.cfg.get("reduce_flash", False)
                        save_config(self.cfg)
                    elif time.time() - t0 > 1.0:
                        return True
                if e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
                    for rect, action in self.buttons:
                        if rect.collidepoint(e.pos):
                            if action[0] == "cfg":
                                self.cfg["reduce_flash"] = not self.cfg.get("reduce_flash", False)
                                save_config(self.cfg)
                            elif time.time() - t0 > 1.0:
                                return True
            s = self.screen
            sw, sh = s.get_size()
            s.fill((4, 4, 10))
            self.buttons = []
            w = min(820, sw - 60)
            y = max(30, sh // 2 - 230)
            self.text("PHOTOSENSITIVITY WARNING", (sw // 2, y), (255, 210, 120), self.mid, center=True)
            y += 56
            body = ["This game contains flashing lights, rapidly changing colors, pulsing shapes and sudden "
                    "bright bursts (like supernovas) that may trigger seizures in people with photosensitive "
                    "epilepsy or other photosensitive conditions.",
                    "If you or anyone in your family has a history of seizures or epilepsy, talk to a doctor "
                    "before playing.",
                    "Stop playing right away if you feel dizzy, have blurred vision, eye or muscle twitches, "
                    "confusion, or any involuntary movement.",
                    "Turning on Reduced Flashing removes pulsing, sparks, flashes and supernova bursts. "
                    "You can change it later in Settings."]
            for para in body:
                y += self.text_wrap(para, (sw // 2, y), w, (200, 200, 215), center=True, lh=21) + 14
            on = self.cfg.get("reduce_flash", False)
            bw = 380
            self.button(pygame.Rect(sw // 2 - bw // 2, y + 6, bw, 50),
                        "REDUCED FLASHING: %s" % ("ON" if on else "OFF"), ("cfg", "reduce_flash"))
            ready = time.time() - t0 > 1.0
            self.button(pygame.Rect(sw // 2 - bw // 2, y + 70, bw, 50), "CONTINUE", ("go",), enabled=ready)
            self.text("press any key to continue   -   R toggles reduced flashing", (sw // 2, y + 136),
                      (120, 120, 140), center=True)
            pygame.display.flip()
            self.clock.tick(30)

    def run(self, seed=None):
        if self.cfg.get("fullscreen"):
            self.set_fullscreen(True)
        if not self.warning():
            pygame.quit()
            return
        try:
            from redline_digital_intro import play_intro
            play_intro(self.screen, self.clock, reduce_flash=self.cfg.get("reduce_flash", False))
        except ImportError:
            pass
        except Exception as ex:
            print("Intro skipped:", ex)
        self.init_gl()
        if self.cfg.get("fullscreen"):
            self.set_fullscreen(True)
        self.start_music()
        self.loading("EMERGENCE", "compiling the laws of physics (only slow the very first time)...")
        load_kernels()
        if KERNELS is None and cKDTree is None:
            raise SystemExit("Needs numba or scipy:  pip install numba scipy")
        self.bgu = self.make_title_universe()
        if seed is not None:
            self.start_game(Universe(seed), intro=True)
        else:
            self.show(self.bgu)
        running = True
        self.worker = SimWorker(self)
        self.worker.start()
        snap = None
        seen_steps = 0
        while running:
            W = self.worker
            # when the physics thread is falling behind, the screen eases to ~40 FPS to give it more CPU
            behind = W.active() and W.acc > 2.0
            dt = self.clock.tick(40 if behind else 60) / 1000.0
            threaded = W.active()
            if W.error is not None and not getattr(self, "_warned_thread", False):
                self._warned_thread = True
                self.cfg["max_sim"] = False
                save_config(self.cfg)
                self.say("Max Simulation hit a problem and was switched off - the game carries on normally.")
            events = pygame.event.get()
            # anything that can change the universe waits for the current physics step to finish
            needs_lock = threaded and any(e.type in (pygame.MOUSEBUTTONDOWN, pygame.MOUSEBUTTONUP, pygame.KEYDOWN)
                                          for e in events)
            locked = W.grab(block=True) if needs_lock else False
            try:
                if snap is not None:
                    self.u = REAL(self.u)
                for e in events:
                    if not self.handle(e):
                        running = False
            finally:
                if locked:
                    W.release()
            if not running:
                break
            u = self.u
            done = 0
            if threaded and W.active():
                # the universe is stepping on its own thread: just grab a fresh snapshot when one is ready
                self.tick_acc = W.acc % 1.0
                fresh = W.snap
                if fresh is not None and fresh is not snap and REAL(fresh) is u:
                    snap = fresh
                    W.snap_wanted = True                  # ask the physics thread for the next one
                elif snap is None or REAL(snap) is not u:
                    if W.grab(block=True):                # first frame: make one ourselves
                        try:
                            snap = USnap(u)
                        finally:
                            W.release()
                done = W.steps - seen_steps
                seen_steps = W.steps
            elif self.screen_name == "game" and not self.paused:
                # x1 = TPS universe ticks per real second, whatever the frame rate
                mult = SPEEDS[-1] if self.ff else SPEEDS[self.speed_i]
                self.tick_acc = min(getattr(self, "tick_acc", 0.0) + mult * TPS * min(dt, 0.1), mult * TPS * 0.25 + 1)
                target = int(self.tick_acc)
                self.tick_acc -= target
                laws0 = len(u.laws)
                t0 = time.perf_counter()
                while done < target:
                    u.step()
                    done += 1
                    if self.ff and len(u.laws) > laws0:
                        self.ff = False
                        break
                    if time.perf_counter() - t0 > (0.045 if (self.ff or mult >= 32) else 0.03):
                        break
                if done:
                    self.tune((time.perf_counter() - t0) * 1000 / done)
            elif self.screen_name in ("title", "saves", "newgame", "tutorial", "online") and u is self.bgu:
                self.tick_acc = getattr(self, "tick_acc", 0.0) + TPS * min(dt, 0.1)
                while self.tick_acc >= 1:
                    u.step()
                    done += 1
                    self.tick_acc -= 1
            self.tps = 0.9 * self.tps + 0.1 * (done / max(dt, 1e-3))
            view = snap if (threaded and snap is not None and REAL(snap) is u) else None
            if not threaded:
                snap = None
            src = view if view is not None else u
            for law in src.new_laws:
                self.toasts.append((law, time.time()))
            src.new_laws = []
            if view is not None:
                self.u = view                       # draw from the snapshot; the real universe keeps running

            self.buttons = []
            self.frame_begin()
            if self.screen_name == "game" and u is self.game:
                self.update_camera()
            self.draw_world()
            if self.gl is None and self.screen_name == "game" and getattr(self, "_wc_n", 0) % 20 == 0:
                self._world_copy = self.screen.copy()        # CPU drawing: remember the bare universe
            self._wc_n = getattr(self, "_wc_n", 0) + 1
            if self.screen_name in ("game", "pause", "settings") and u is self.game and u.civ is not None:
                try:
                    self.draw_civ()
                except (IndexError, KeyError, ValueError, RuntimeError):
                    pass                            # a ship or colony changed mid-draw; next frame is fine
            if self.screen_name == "game":
                if u.civ is not None and self.hud:
                    self.draw_agency_hud()
                if self.hud:
                    self.draw_hud()
                if self.panel:
                    try:
                        self.draw_panel()
                    except (IndexError, KeyError, ValueError, RuntimeError):
                        pass
                if self.hud:
                    self.draw_toasts()
                    self.draw_intro()
                elif time.time() - getattr(self, "last_motion", 0) < 2.5:
                    # hidden HUD: a small way back for mouse players, only while the mouse moves
                    sw_, sh_ = self.screen.get_size()
                    self.button(pygame.Rect(12, sh_ - 34, 150, 24), "SHOW HUD [H]", ("key", pygame.K_h), font=self.font)
                if u.civ is not None:
                    if self.hud:
                        self.draw_feed()
                        try:
                            self.draw_selection()
                        except (IndexError, KeyError, ValueError, RuntimeError):
                            pass
                    self.draw_launch_help()
            elif self.screen_name == "title":
                self.draw_title()
            elif self.screen_name == "pause":
                self.draw_pause()
            elif self.screen_name == "settings":
                self.draw_settings()
            elif self.screen_name == "saves":
                self.draw_saves()
            elif self.screen_name == "online":
                self.draw_online()
            elif self.screen_name == "newgame":
                self.draw_newgame()
            elif self.screen_name == "tutorial":
                self.draw_tutorial()
            if self.flash_t > 0:
                self.text(self.flash, (12, 100), (255, 220, 120))
                self.flash_t -= 1
            self.present()
            self.u = u                              # back to the real universe

            if self.game is not None and time.time() - self.last_autosave > 300:
                if self.u is self.game:
                    ok = W.grab(block=True) if threaded else False
                    try:
                        self.save(auto=True)
                    finally:
                        if ok:
                            W.release()
                self.last_autosave = time.time()
        W.alive = False
        ok = W.grab(block=True)
        try:
            self.save(auto=True)
        finally:
            if ok:
                W.release()
        pygame.quit()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--build-assets":
        # used by build_exe.bat: makes the .exe icon and its Windows properties (publisher etc.)
        write_icon("emergence.ico")
        write_version_file("version_info.txt")
        print("wrote emergence.ico and version_info.txt")
    else:
        App().run(int(sys.argv[1]) if len(sys.argv) > 1 else None)

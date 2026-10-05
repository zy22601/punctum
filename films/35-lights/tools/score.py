"""PUNCTUM // 35 LIGHTS — score + shared event data.

The picture (assets/film.js) and this score read the same glyph bitmaps and the
same timing constants, so every lit dot that sounds is a dot you see.
Writes assets/score.wav and assets/events.js.
"""
import json
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BM = json.load(open(os.path.join(ROOT, "..", "..", "src", "bitmaps.json"), encoding="utf-8"))
SR = 48000
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(35)

# ── shared timing (mirrored in film.js) ───────────────────────────
WORD = "PUNCTUM"
S2_T0, S2_STEP = 5.0, 0.125          # playhead writes cols 6..40
S6_T0, S6_STEP = 52.75, 3.0 / 35     # final playhead
WIPE_T0, WIPE_T1 = 30.5, 33.5        # ROUND -> PIXEL
PANEL_TIMES = [34, 36, 38, 40, 42, 44, 46]

# 35 lights: centre first, then a seeded order, accelerating into the downbeat
cells = [(c, r) for r in range(7) for c in range(5)]
cells.remove((2, 3))
order = [(2, 3)] + [cells[i] for i in rng.permutation(len(cells))]
s1 = [(round(0.5 + 3.3 * (k / 34) ** 0.55, 4), c, r) for k, (c, r) in enumerate(order)]


def col_rows(word, c):
    ch, x = word[c // 6], c % 6
    if x == 5:
        return []
    return [r for r in range(9) if BM[ch][r][x] == "#"]


# row -> pitch, D minor pentatonic, top row highest
ROW_MIDI = [69, 67, 65, 62, 60, 57, 55, 53, 50]
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)

# ── synthesis helpers ───────────────────────────────────────────
L = np.zeros(N)
R = np.zeros(N)
VL = np.zeros(N)   # reverb send
VR = np.zeros(N)
SC = np.ones(N)    # sidechain gain (kick ducking) for music bus
ML = np.zeros(N)   # music bus (ducked)
MR = np.zeros(N)


def tt(n):
    return np.arange(n) / SR


def place(buf, t0, sig):
    i = int(round(t0 * SR))
    if i >= N or i + len(sig) <= 0:
        return
    a = max(0, -i)
    j = min(N, i + len(sig))
    buf[i + a:j] += sig[a:j - i]


def out(t0, sig, pan=0.0, gain=1.0, send=0.0, bus="main"):
    gl, gr = np.cos((pan + 1) * np.pi / 4) * gain, np.sin((pan + 1) * np.pi / 4) * gain
    if bus == "music":
        place(ML, t0, sig * gl); place(MR, t0, sig * gr)
    else:
        place(L, t0, sig * gl); place(R, t0, sig * gr)
    if send:
        place(VL, t0, sig * gl * send); place(VR, t0, sig * gr * send)


def osc(freq, dur, blend=0.0, bright=1.0, detune=0.0):
    """sine -> band-limited square by `blend` (ROND 100 -> 0); `bright` caps harmonics (wght)."""
    n = int(dur * SR)
    t = tt(n)
    f = freq * (1 + detune)
    s = np.sin(2 * np.pi * f * t)
    if blend > 0:
        kmax = max(1, int(min(SR / 2 / f, 3 + bright * 40)))
        sq = np.zeros(n)
        for k in range(1, kmax + 1, 2):
            sq += np.sin(2 * np.pi * k * f * t) / k
        sq *= 4 / np.pi * 0.8
        s = s * (1 - blend) + sq * blend
    return s


def env(n, a=0.004, d=0.3, hold=0.0):
    t = tt(n)
    e = np.minimum(1, t / max(a, 1e-4))
    rel = np.where(t > a + hold, np.exp(-(t - a - hold) / d), 1.0)
    return e * rel


def pluck(t0, midi, gain=0.3, blend=0.1, bright=0.5, dur=0.6, d=0.22, pan=0.0, send=0.35, bus="main"):
    s = osc(mtof(midi), dur, blend, bright) * env(int(dur * SR), 0.003, d)
    out(t0, s, pan, gain, send, bus)


def noise(n):
    return rng.standard_normal(n)


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def bandnoise(n, lo, hi):
    X = np.fft.rfft(noise(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n)
    return y / (np.abs(y).max() + 1e-9)


def kick(t0, gain=0.9):
    n = int(0.45 * SR); t = tt(n)
    f = 46 + 110 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.16) + 0.25 * bandnoise(n, 2000, 7000) * np.exp(-t / 0.004)
    out(t0, s, 0, gain)
    i = int(t0 * SR)
    m = 1 - 0.65 * np.exp(-tt(int(0.4 * SR)) / 0.09)
    j = min(N, i + len(m))
    if i < N:
        SC[i:j] = np.minimum(SC[i:j], m[: j - i])


def clap(t0, gain=0.35):
    n = int(0.3 * SR); t = tt(n)
    e = np.zeros(n)
    for o in (0, 0.009, 0.019):
        e += np.where(t >= o, np.exp(-(t - o) / 0.006), 0)
    e += np.exp(-t / 0.09) * 0.5
    out(t0, bandnoise(n, 900, 4800) * e, 0.05, gain, send=0.25)


def hat(t0, gain=0.12, dec=0.025, pan=0.25):
    n = int(0.12 * SR)
    out(t0, bandnoise(n, 7000, 16000) * np.exp(-tt(n) / dec), pan, gain)


def flap(t0, clicks=4, gain=0.22, spread=0.045, pan=0.0):
    """split-flap roll: a burst of hard little clicks."""
    for k in range(clicks):
        n = int(0.02 * SR)
        f = 2600 + rng.random() * 1800
        s = bandnoise(n, f * 0.7, f * 1.4) * np.exp(-tt(n) / 0.0025)
        out(t0 + k * spread * (0.8 + 0.4 * rng.random()), s, pan + (rng.random() - 0.5) * 0.4, gain * (0.7 + 0.3 * rng.random()), send=0.08)


def whoosh(t0, dur=0.5, gain=0.35, rise=True):
    n = int(dur * SR); t = tt(n) / dur
    x = bandnoise(n, 300, 9000)
    e = np.sin(np.pi * np.clip(t, 0, 1)) ** 2
    out(t0, x * e, 0, gain, send=0.2)


def riser(t0, dur, gain=0.3, f0=200, f1=2400):
    n = int(dur * SR); t = tt(n) / dur
    f = f0 * (f1 / f0) ** t
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (0.5 * np.sin(ph) + 0.5 * bandnoise(n, 1500, 12000) * t) * t ** 2
    out(t0, s, 0, gain, send=0.3)


def boom(t0, gain=0.8, midi=38):
    n = int(2.5 * SR); t = tt(n)
    f = mtof(midi) * (1 + 0.6 * np.exp(-t / 0.05))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.8) + 0.3 * bandnoise(n, 30, 400) * np.exp(-t / 0.3)
    out(t0, s, 0, gain, send=0.4)


def pad(t0, dur, midis, gain=0.12, blend=0.0, bright=0.3, att=1.0, rel=1.5, send=0.6, bus="main"):
    n = int((dur + rel) * SR); t = tt(n)
    e = np.minimum(1, t / att) * np.where(t > dur, np.exp(-(t - dur) / (rel / 3)), 1)
    s = np.zeros(n)
    for i, m in enumerate(midis):
        for dt in (-0.004, 0.004):
            s += osc(mtof(m), dur + rel, blend, bright, dt)
    out(t0, s * e / (len(midis) * 2), 0, gain, send, bus)


# ── 01 ONE LIGHT (0–4) ───────────────────────────────────────────
SC1 = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]
for k, (t, c, r) in enumerate(s1):
    m = SC1[k % len(SC1)] - (12 if k < 4 else 0)
    pluck(t, m, gain=0.07 + 0.07 * (k / 34), blend=0.0, dur=1.6, d=0.5, pan=(c - 2) / 3, send=0.7)
pad(0.8, 3.0, [38, 45], gain=0.18, att=2.5, rel=1.0)
boom(4.0, 0.85)

# ── 02 SCORE (4–12) ──────────────────────────────────────────────
for c in range(6, 41):
    rows = col_rows(WORD, c)
    t = S2_T0 + (c - 6) * S2_STEP
    for r in rows:
        pluck(t, ROW_MIDI[r], gain=0.24 / np.sqrt(len(rows)), blend=0.12, bright=0.5, dur=0.7, d=0.18,
              pan=(c - 20) / 30, send=0.4)
for b in range(16, 24):            # kick from 8.0
    kick(b * BEAT, 0.7)
for b in range(20, 24):
    hat(b * BEAT + 0.25, 0.08)
pad(8.0, 3.5, [50, 57, 62], gain=0.08, att=1.5, rel=0.5)
for k in range(10):                # letters spin up 11.5–12
    flap(11.5 + k * 0.05, clicks=2, gain=0.12)
riser(10.5, 1.45, 0.18)

# ── 03 COUNTDOWN (12–20) ─────────────────────────────────────────
for b in range(16):
    t = 12 + b * BEAT
    if t < 19.75:
        kick(t, 0.85)
        flap(t, clicks=4, gain=0.26)
        wall = min(40, 2 + b * 3)  # more counters visible as the camera steps out
        for k in range(wall):
            flap(t + 0.04 + rng.random() * 0.35, clicks=1, gain=0.05, pan=rng.random() * 2 - 1)
for b in range(4, 16):
    hat(12 + b * BEAT + 0.25, 0.1)
for i in range(8, 30):             # bass pulse D2 8ths from 14
    t = 12 + i * 0.25
    if t < 19.75:
        out(t, osc(mtof(38), 0.24, 0.3, 0.2) * env(int(0.24 * SR), 0.004, 0.1), 0, 0.28, bus="music")
t, step = 18.0, 0.25               # snare roll
while t < 19.7:
    clap(t, 0.12 + 0.2 * (t - 18) / 1.7)
    step = 0.25 if t < 18.75 else 0.125 if t < 19.25 else 0.0625
    t += step
riser(16.0, 3.75, 0.35)

# ── 04 DESIGN SPACE (20–34) ──────────────────────────────────────
PROG = [[38, 50, 53, 57], [34, 46, 50, 53], [41, 48, 53, 57], [36, 48, 52, 55]]  # Dm Bb F C
BAR_W = [100, 300, 400, 700, 900, 900, 900]


def rond_audio(t):
    return 1 - np.clip((t - WIPE_T0) / (WIPE_T1 - WIPE_T0), 0, 1)


boom(20.0, 0.9)
for bar in range(7):
    t0 = 20 + bar * 2
    ch = PROG[bar % 4]
    w = BAR_W[bar]
    flap(t0, clicks=5, gain=0.2)
    for b in range(4):
        kick(t0 + b * BEAT, 0.95)
        if b % 2 == 1:
            clap(t0 + b * BEAT, 0.32)
    for s in range(16):
        hat(t0 + s * 0.125, 0.06 + (0.05 if s % 2 else 0), pan=0.3 if s % 4 == 2 else -0.2)
    for e in range(8):             # bass 8ths
        tb = t0 + e * 0.25
        out(tb, osc(mtof(ch[0]), 0.25, 0.5, 0.25) * env(int(0.25 * SR), 0.004, 0.12), 0, 0.34, bus="music")
    for e in range(4):             # offbeat stabs: timbre = the axes
        ts = t0 + e * BEAT + 0.25
        blend = 1 - rond_audio(ts)
        bright = w / 900
        lvl = 0.07 + 0.11 * bright
        for m in ch[1:]:
            out(ts, osc(mtof(m + 12), 0.32, blend, bright) * env(int(0.32 * SR), 0.003, 0.11), 0, lvl, send=0.3, bus="music")
for k in range(5):                 # letters flip under the wipe
    flap(WIPE_T0 + (k + 0.5) / 5 * (WIPE_T1 - WIPE_T0), clicks=4, gain=0.22, pan=(k - 2) / 3)
whoosh(30.4, 3.2, 0.12)

# ── 05 BOARD (34–48) ─────────────────────────────────────────────
for bar in range(7):
    t0 = 34 + bar * 2
    ch = PROG[bar % 4]
    if bar > 0:
        whoosh(t0 - 0.2, 0.55, 0.4)
    flap(t0 + 0.05, clicks=8 if bar in (0, 1, 6) else 4, gain=0.18, spread=0.035)
    paper = bar == 4
    for b in range(4):
        kick(t0 + b * BEAT, 0.5 if paper else 0.9)
        if b % 2 == 1 and not paper:
            clap(t0 + b * BEAT, 0.3)
    for s in range(16):
        hat(t0 + s * 0.125, 0.05 + (0.05 if s % 2 else 0))
    for e in range(8):
        out(t0 + e * 0.25, osc(mtof(ch[0]), 0.25, 0.5, 0.25) * env(int(0.25 * SR), 0.004, 0.12), 0, 0.3, bus="music")
    # arp: the panel's material is the timbre
    blend, bright, lvl = {2: (0.8, 0.8, 0.11), 3: (0.0, 0.3, 0.12), 4: (0.4, 0.05, 0.08), 5: (1.0, 1.0, 0.09)}.get(bar, (0.25, 0.5, 0.1))
    notes = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24]
    for s in range(16):
        m = notes[s % 4]
        out(t0 + s * 0.125, osc(mtof(m), 0.2, blend, bright) * env(int(0.2 * SR), 0.002, 0.07), ((s % 4) - 1.5) / 3, lvl, send=0.25, bus="music")
    if paper:                      # thermal printer buzz
        for s in range(16):
            n = int(0.05 * SR)
            out(t0 + s * 0.125, bandnoise(n, 400, 1800) * np.exp(-tt(n) / 0.02), 0.2, 0.08)

# ── 06 35 LIGHTS (48–56) ─────────────────────────────────────────
pad(48.0, 4.0, [50, 57, 62, 64, 69], gain=0.45, att=0.5, rel=1.0, blend=0.15, bright=0.4)
for k in range(60):                # wall flicker
    flap(48 + rng.random() * 2.2, clicks=1, gain=0.08, pan=rng.random() * 2 - 1)
n = int(1.6 * SR)                  # reverse swell into the ripple
rev = bandnoise(n, 2000, 14000) * (tt(n) / 1.6) ** 3
out(48.9, rev, 0, 0.3, send=0.4)
boom(50.5, 0.5, 50)
riser(50.5, 1.5, 0.3, 300, 3000)
boom(52.0, 0.85)
for c in range(6, 41):
    rows = col_rows(WORD, c)
    t = S6_T0 + (c - 6) * S6_STEP
    for r in rows:
        pluck(t, ROW_MIDI[r] + 12, gain=0.2 / np.sqrt(len(rows)), blend=0.45, bright=0.7, dur=0.5, d=0.14,
              pan=(c - 20) / 25, send=0.35)
for b in range(108, 111):          # kick returns 54.0–55.5
    kick(b * BEAT, 0.85)
    hat(b * BEAT + 0.25, 0.09)

# ── 07 PUNCTUM (56–60) ───────────────────────────────────────────
boom(56.0, 1.0)
kick(56.0, 1.0)
clap(56.0, 0.3)
pad(56.0, 2.4, [38, 50, 57, 62, 64, 69, 74], gain=0.32, att=0.02, rel=2.0, blend=0.25, bright=0.5, send=0.7)
flap(56.3, 6, 0.12); flap(56.6, 6, 0.12)
pluck(58.6, 74, gain=0.22, blend=0.0, dur=2.0, d=0.7, send=0.9)

# ── mix ──────────────────────────────────────────────────────────
ML *= SC; MR *= SC
L += ML; R += MR


def fft_conv(x, ir):
    n = len(x) + len(ir)
    size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]


irn = int(2.6 * SR)
t = tt(irn)
irL = bandnoise(irn, 200, 9000) * np.exp(-t / 0.55)
irR = bandnoise(irn, 200, 9000) * np.exp(-t / 0.55)
irL[: int(0.012 * SR)] = 0; irR[: int(0.017 * SR)] = 0
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
L += fft_conv(VL, irL) * 0.55
R += fft_conv(VR, irR) * 0.55

# silence the gap before the drop, keep only reverb tails out of it
gap = slice(int(19.78 * SR), int(20.0 * SR))
fade = np.linspace(1, 0, int(0.03 * SR))
for ch_ in (L, R):
    i = int(19.75 * SR)
    ch_[i:i + len(fade)] *= fade
    ch_[gap] *= 0.0
# tail fade 59.2–60
f = np.ones(N); f[int(59.2 * SR):] = np.linspace(1, 0, N - int(59.2 * SR))
L *= f; R *= f

mix = np.stack([L, R], 1)
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.8)
mix /= np.abs(mix).max()
mix *= 10 ** (-1 / 20)
pcm = (mix * 32767).astype(np.int16)
os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
with wave.open(os.environ.get("SCORE_OUT", os.path.join(ROOT, "assets", "score.wav")), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())

with open(os.path.join(ROOT, "assets", "events.js"), "w", encoding="utf-8") as fh:
    fh.write("window.PUNCTUM_EVENTS = " + json.dumps({"s1": s1}) + ";\n")
    fh.write("window.PUNCTUM_BITMAPS = " + json.dumps(BM, ensure_ascii=False) + ";\n")
print("ok", pcm.shape, "rms dB", 20 * np.log10(np.sqrt((mix ** 2).mean())))

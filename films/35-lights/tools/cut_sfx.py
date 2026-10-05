"""SFX stem for the 42 s cut, in film time: the original score's split-flap rolls and
panel whooshes (no tonal music), plus new cues for the redesigned 35 LIGHTS resolve.
Reuses score.py's synth helpers. Writes assets/sfx-cut.wav."""
import os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "score.py"), encoding="utf-8").read()
src = src[: src.index("# ── 01 ONE LIGHT")].replace("DUR = 60.0", "DUR = 42.0")
g = {"__file__": os.path.join(HERE, "score.py")}
exec(src, g)
SR, rng, flap, whoosh, riser, boom, pluck, out, tt, bandnoise = (g[k] for k in
    ("SR", "rng", "flap", "whoosh", "riser", "boom", "pluck", "out", "tt", "bandnoise"))
def F(t):  # source time (12–60) → film time; mirrors srcOf() in film.js
    if t < 20: return 4 + (t - 12) / 2
    if t < 30: return 8 + (t - 20) / 2
    if t < 34: return 13 + (t - 30) * 3 / 4
    return t - 18
def Fw(t):  # write timing (52–56) → film 2–4; mirrors writeT() in film.js
    u = (t - 52) / 2 if t < 52.8 else 0.4 + (t - 52.8) / (2.95 / 1.2) if t < 55.75 else 1.6 + (t - 55.75) / 0.625
    return 2 + u
BEAT = 0.5

# 02 fast write (film 2–4): a soft tick per column under the playhead
S6_T0, S6_STEP = 52.75, 3.0 / 35
for c in range(35):
    flap(Fw(S6_T0 + c * S6_STEP), clicks=1, gain=0.07, pan=(c - 17) / 25)

# 03 countdown: the counter and the wall of counters roll on every beat
for b in range(16):
    t = 12 + b * BEAT
    if t < 19.75:
        flap(F(t), clicks=4, gain=0.26)
        for k in range(min(40, 2 + b * 3)):
            flap(F(t + 0.04 + rng.random() * 0.35), clicks=1, gain=0.05, pan=rng.random() * 2 - 1)

# 04 design space: a roll on each new weight, letters flip under the ROUND→PIXEL wipe
for bar in range(7):
    flap(F(20 + bar * 2), clicks=5, gain=0.2)
for k in range(5):
    flap(F(30.5 + (k + 0.5) / 5 * 3.0), clicks=4, gain=0.22, pan=(k - 2) / 3)
whoosh(F(30.4), 2.4, 0.12)

# 05 board: a whoosh as each panel slides in, the board rolls its text
for bar in range(7):
    t0 = 34 + bar * 2
    if bar > 0:
        whoosh(F(t0 - 0.2), 0.55, 0.4)
    flap(F(t0 + 0.05), clicks=8 if bar in (0, 1, 6) else 4, gain=0.18, spread=0.035)
    if bar == 4:                          # thermal printer buzz
        for s in range(16):
            n = int(0.05 * SR)
            out(F(t0 + s * 0.125), bandnoise(n, 400, 1800) * np.exp(-tt(n) / 0.02), 0.2, 0.06)

# 06 35 LIGHTS: wall flicker, reverse swell into the ripple, the dive
for k in range(60):
    flap(F(48) + rng.random() * 2.2, clicks=1, gain=0.08, pan=rng.random() * 2 - 1)
n = int(1.6 * SR); out(F(48.9), bandnoise(n, 2000, 14000) * (tt(n) / 1.6) ** 3, 0, 0.3, send=0.4)
riser(F(50.5), 1.5, 0.22, 300, 3000)
#   the cell splits and its seven copies step out along the lattice
whoosh(F(52.05), 0.7, 0.32)
for k in range(7):
    flap(F(52.12) + k * 0.085, clicks=2, gain=0.12, pan=(k - 3) / 3)
#   letters resolve centre-out on the beat: each drop is a roll, panned to its letter
for i, tr in enumerate([54.5, 54.0, 53.5, 53.0, 53.5, 54.0, 54.5]):
    flap(F(tr), clicks=7, gain=0.2, spread=0.028, pan=(i - 3) / 3.5)
#   a reverse swell carries the hold into the end card's hit
n = int(1.1 * SR); out(F(56) - 1.1, bandnoise(n, 1500, 12000) * (tt(n) / 1.1) ** 3, 0, 0.26, send=0.4)

# 07 PUNCTUM: the hit, the subtitle lines flip in, the last light
g["kick"](F(56), 0.22); g["clap"](F(56), 0.07); boom(F(56), 0.14)
flap(F(56.3), 6, 0.12); flap(F(56.6), 6, 0.12)
pluck(F(58.6), 74, gain=0.08, blend=0.0, dur=2.0, d=0.7, send=0.9)

L, R, VL, VR = (g[k] for k in ("L", "R", "VL", "VR"))
def fft_conv(x, ir):
    size = 1 << (len(x) + len(ir) - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
irn = int(2.6 * SR); t = tt(irn)
irL = bandnoise(irn, 200, 9000) * np.exp(-t / 0.55); irR = bandnoise(irn, 200, 9000) * np.exp(-t / 0.55)
irL[: int(0.012 * SR)] = 0; irR[: int(0.017 * SR)] = 0
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
L += fft_conv(VL, irL) * 0.55; R += fft_conv(VR, irR) * 0.55
mix = np.stack([L, R], 1)
with wave.open(os.path.join(os.path.dirname(HERE), "assets", "sfx-cut.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(4); w.setframerate(SR)
    w.writeframes((np.clip(mix * 0.5, -1, 1) * (2**31 - 1)).astype(np.int32).tobytes())
print("ok peak", np.abs(mix).max())

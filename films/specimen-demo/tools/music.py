"""Punctum specimen demo — 66 s score, 120 bpm, A minor (Am F C G).
UI sounds sit exactly on the scripted clicks/keys in tools/modules.cjs
(film time = module.start − 0.5 + τ). Writes assets/music.wav."""
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
DUR = 66.0
N = int(SR * DUR)
BEAT, BAR = 0.5, 2.0
rng = np.random.default_rng(9)
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)

exec(open(os.path.join(ROOT, "tools", "_helpers.py")).read())

# film = content time (the 60 s cut) with an 8 s full-page tour spliced in: content ≥ T0 moves by SH
T0, SH = 5.6, 6.0
S = lambda t: t + SH if t >= T0 else t
MAP = lambda t: t
_place = place
def place(buf, t0, sig): _place(buf, MAP(t0), sig)

# module boundaries = camera transitions
CUTS = [6, 10, 16, 24, 30, 38, 44, 52, 56]   # content time
PROG = [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]]  # Am F C G (bass, triad)


def chord_at(t):
    return PROG[int(t // BAR) % 4]


def section(t):
    if 50 <= t < 54: return "break"
    if t >= 64.5: return "outro"
    return "full"


def bar_lp(sig, fc):
    X = np.fft.rfft(sig); f = np.fft.rfftfreq(len(sig), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(sig))


# ── groove ─────────────────────────────────────────────
for b in range(132):
    t = b * BEAT
    sec = section(t)
    if sec in ("full", "build") or (sec == "break" and b % 4 == 0):
        kick(t, 0.95 if sec == "full" else 0.7)
    if sec == "full":
        if b % 2 == 1: clap(t, 0.3)
        hat(t + 0.25, 0.13, dec=0.06, pan=0.15)          # open hat offbeat
        for s in (0, 1, 3):
            hat(t + s * 0.125, 0.045, pan=-0.25)
    if sec == "build" and t >= 6:
        hat(t + 0.25, 0.09, dec=0.04)
    if sec == "break":
        hat(t + 0.25, 0.05, dec=0.03)

# bass: rolling offbeat 8ths
for e in range(264):
    t = e * 0.25
    sec = section(t)
    if sec not in ("full", "build") or (sec == "build" and t < 6) or e % 2 == 0:
        continue
    m = chord_at(t)[0] - 12 + (12 if e % 4 == 3 else 0)
    s = osc(mtof(m), 0.24, 0.55, 0.3) * env(int(0.24 * SR), 0.003, 0.09)
    out(t, s, 0, 0.42, bus="music")

# stabs + arp
for e in range(264):
    t = e * 0.25
    sec = section(t)
    ch = chord_at(t)
    if sec == "full" and e % 8 in (3, 6):
        for m in ch[1:]:
            out(t, osc(mtof(m + 12), 0.3, 0.35, 0.6, (m % 3 - 1) * 0.003) * env(int(0.3 * SR), 0.002, 0.08), (m % 3 - 1) * 0.4, 0.08, send=0.3, bus="music")
for s in range(528):
    t = s * 0.125
    sec = section(t)
    if sec == "outro": continue
    ch = chord_at(t)
    m = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24][s % 4] + (12 if (s // 8) % 2 and sec == "full" else 0)
    lvl = {"intro": 0.05, "build": 0.07, "full": 0.06, "break": 0.09}[sec]
    blend = 0.0 if sec in ("intro", "break") else 0.5
    out(t, osc(mtof(m), 0.18, blend, 0.5) * env(int(0.18 * SR), 0.002, 0.06), ((s % 4) - 1.5) / 2.5, lvl, send=0.35, bus="music")

# pads
for bar in range(33):
    t = bar * BAR
    sec = section(t)
    if sec in ("intro", "break"):
        pad(t, BAR, chord_at(t)[1:], gain=0.16 if sec != "build" else 0.1, att=0.4, rel=0.6, blend=0.05, bright=0.2)
pad(62.0, 2.6, [45, 57, 60, 64, 69, 72, 76], gain=0.3, att=0.02, rel=1.6, blend=0.3, bright=0.5, send=0.7)

# ── UI sounds on the scripted interactions ──────────────
def ui_click(t, gain=0.3):
    n = int(0.03 * SR)
    s = bandnoise(n, 3000, 9000) * np.exp(-tt(n) / 0.003) + 0.6 * np.sin(2 * np.pi * 1800 * tt(n)) * np.exp(-tt(n) / 0.008)
    out(t, s, 0.1, gain, send=0.1)


def key_tick(t):
    n = int(0.02 * SR)
    out(t, bandnoise(n, 2500, 7000) * np.exp(-tt(n) / 0.004), (rng.random() - 0.5) * 0.4, 0.11)


def roll(t0, dur=1.2, density=40, gain=0.07):
    for k in range(density):
        flap(t0 + rng.random() * dur, clicks=1, gain=gain, pan=rng.random() * 2 - 1)


# ── transitions: riser into every cut, impact + whoosh on it ──
for c in map(S, CUTS):
    riser(c - 1.0, 1.0, 0.16, 400, 3600)
    whoosh(c - 0.45, 0.9, 0.38)
    if c != 50:
        boom(c, 0.45, 33)
        clap(c, 0.18)
# cold open + hero + full-page tour (film time)
boom(0.0, 1.0, 33); clap(0.0, 0.3); roll(0.0, 0.35, 50, 0.1)
pluck(0.5, 81, gain=0.12, blend=0.6, dur=0.6, d=0.2, send=0.6)
boom(1.0, 0.55, 33); whoosh(0.75, 0.4, 0.35)
riser(2.6, 1.0, 0.18, 400, 4000); whoosh(3.25, 0.6, 0.42); boom(3.6, 0.6, 33); clap(3.6, 0.2)
for k in range(30): flap(4.0 + k * 0.24, clicks=1, gain=0.05, pan=((k * 7) % 11) / 5.5 - 1)
for k, t in enumerate([4.0, 6.0, 8.0, 10.0]): pluck(t, [69, 72, 76, 79][k], gain=0.09, blend=0.0, dur=1.2, d=0.4, send=0.8)
pad(10.6, 1.0, [57, 60, 64, 69], gain=0.12, att=0.3, rel=0.5, bright=0.4)
whoosh(11.3, 0.7, 0.42)
riser(52.0, 2.0, 0.24, 300, 5000)
boom(54.0, 0.85, 33); clap(54.0, 0.25)
boom(62.0, 0.85, 33)
boom(64.55, 0.7, 33)

MAP = S   # everything below is written in content time

F = lambda start, tau: start - 0.5 + tau
roll(5.95, 1.1, 60, 0.08)                                     # statement rolls in as the page scrolls
for k, t in enumerate([7.3, 8.3, 9.25]): pluck(t, [76, 79, 84][k], gain=0.11, blend=0.0, dur=0.9, d=0.3, pan=(k - 1) / 2, send=0.7)
whoosh(9.5, 0.5, 0.35); roll(9.9, 0.4, 20, 0.07)
for t in (10.85, 11.95, 12.95): ui_click(t, 0.1); boom(t, 0.25, 45)
ui_click(F(16, 1.5)); ui_click(F(16, 6.4), 0.18); ui_click(F(16, 7.2))
for tau in (3.35, 4.35, 5.25): ui_click(F(24, tau))
roll(F(30, 0.05), 1.6, 60, 0.08)                              # board first roll
ui_click(F(30, 2.55)); roll(F(30, 2.6), 1.5, 60, 0.08)
ui_click(F(30, 3.7)); roll(F(30, 3.75), 1.3, 50, 0.08)
ui_click(F(30, 5.0))
for i in range(20): key_tick(F(30, 5.15 + i * 0.058))
ui_click(F(30, 6.45), 0.25); roll(F(30, 6.5), 1.4, 60, 0.09)
ui_click(F(38, 1.1))
for i in range(18): key_tick(F(38, 1.25 + i * 0.06))
for tau in (3.2, 4.8): ui_click(F(38, tau), 0.2)
for k in range(4): boom(44.0 + 0.5 * k, 0.3, 40); pluck(44.0 + 0.5 * k, [57, 60, 64, 69][k], gain=0.12, blend=0.2, dur=1.2, d=0.5, send=0.8)
roll(F(52, 1.3), 0.8, 20)
roll(58.55, 0.5, 30, 0.08); roll(58.7, 0.7, 24, 0.05)

exec(open(os.path.join(ROOT, "tools", "_mix.py")).read())

f = np.ones(N); f[int(65.0 * SR):] = np.linspace(1, 0, N - int(65.0 * SR)) ** 1.5
L *= f; R *= f
mix = np.stack([L, R], 1)
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.7)
mix /= np.abs(mix).max(); mix *= 10 ** (-1 / 20)
with wave.open(os.path.join(ROOT, "assets", "music.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print(" ".join(f"{s}:{20*np.log10(np.sqrt((mix[s*SR:(s+2)*SR]**2).mean())+1e-9):.0f}" for s in range(0, 66, 2)))

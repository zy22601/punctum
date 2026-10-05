"""PUNCTUM PREMIERE — score. 120 bpm, D minor (Dm Bb F C). Every accent sits on an event exported from the
picture (assets/events.json): hook pings, playhead notes (rows → pentatonic pitch), flap clatter, weight hits,
the axes pad (WGHT → brightness, ROND → sine↔square), material motifs, keys, ripple, last dot. Writes assets/score.wav."""
import json, os, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(ROOT, "assets", "events.json")))
SR = 48000
LEN = float(D["len"])
N = int(SR * LEN)
BEAT, BAR = 0.5, 2.0
rng = np.random.default_rng(35)
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)
exec(open(os.path.join(ROOT, "tools", "_helpers.py")).read())

EV = D["events"]
def evs(kind): return [e for e in EV if e["type"] == kind]

PROG = [[38, 62, 65, 69], [34, 62, 65, 70], [41, 60, 65, 69], [36, 60, 64, 67]]  # Dm Bb F C (bass, triad)
chord_at = lambda t: PROG[int(t // BAR) % 4]
PENTA = [0, 3, 5, 7, 10]  # D minor pentatonic
def row_pitch(r, base=62):
    i = 8 - r
    return base + PENTA[i % 5] + 12 * (i // 5)


def section(t):
    if t < 2.0: return "hook"
    if t < 8.0: return "title"
    if t < 15.75: return "count"
    if t < 16.0: return "silence"
    if t < 26.0: return "design"
    if t < 34.0: return "avenue"
    if t < 44.0: return "mats"
    if t < 52.0: return "board"
    if t < 60.0: return "site"
    if t < 66.0: return "tester"
    if t < 70.5: return "wall"
    if t < 72.0: return "dark"
    return "end"


# ── groove ────────────────────────────────────────────
for b in range(int(LEN / BEAT)):
    t = b * BEAT; sec = section(t)
    if sec in ("title", "design", "avenue", "mats", "board", "tester", "wall"):
        kick(t, 0.95 if sec != "title" or t >= 4 else 0.0)
        if sec == "title" and t < 4: continue
        if b % 2 == 1: clap(t, 0.26 if sec != "board" else 0.2)
        hat(t + 0.25, 0.12, dec=0.05, pan=0.2)
        if sec in ("avenue", "wall", "tester"):
            for s in (0, 1, 3): hat(t + s * 0.125, 0.04, pan=-0.3)
    elif sec == "count":
        kick(t, 0.55 + 0.35 * (t - 8) / 8)
        n = int(0.025 * SR); out(t + 0.25, bandnoise(n, 4000, 9000) * np.exp(-tt(n) / 0.004), 0.3, 0.14)  # clock tick
    elif sec == "site":
        if b % 4 == 0: kick(t, 0.5)
        hat(t + 0.25, 0.05, dec=0.03)

# bass: offbeat 8ths, octave pops
for e in range(int(LEN / 0.25)):
    t = e * 0.25; sec = section(t)
    if sec not in ("design", "avenue", "mats", "board", "tester", "wall") and not (sec == "title" and t >= 4): continue
    if e % 2 == 0: continue
    m = chord_at(t)[0] - 12 + (12 if e % 4 == 3 else 0)
    out(t, osc(mtof(m), 0.24, 0.55, 0.3) * env(int(0.24 * SR), 0.003, 0.09), 0, 0.42, bus="music")

# pads for the airy sections
for bar in range(int(LEN / BAR)):
    t = bar * BAR; sec = section(t)
    if sec in ("site",): pad(t, BAR, chord_at(t)[1:] + [chord_at(t)[1] + 12], gain=0.16, att=0.5, rel=0.8, blend=0.05, bright=0.25, send=0.7)
    if sec in ("count",): pad(t, BAR, chord_at(t)[1:], gain=0.06 + 0.02 * (t - 8) / 2, att=0.2, rel=0.3, blend=0.3, bright=0.2 + 0.1 * (t - 8) / 2)
    if sec in ("title", "design", "board", "wall"): pad(t, BAR, chord_at(t)[1:], gain=0.05, att=0.3, rel=0.5, blend=0.1, bright=0.2, send=0.5)

# ── HOOK: 35 glass pings, accelerating; resolve on P ──
for e in evs("ping"):
    if e["t"] > 2: continue
    m = row_pitch(e["row"], 74) + (12 if e["col"] % 2 else 0)
    pluck(e["t"], m, gain=0.09 + 0.05 * e["p"], blend=0.0, bright=0.2, dur=0.9, d=0.35, pan=(e["col"] - 2) / 3, send=0.7)
riser(0.15, 1.35, 0.2, 300, 6000)
boom(1.5, 0.5, 38); pad(1.5, 0.6, [62, 65, 69, 74], gain=0.18, att=0.01, rel=0.4, blend=0.2, bright=0.5, send=0.8)
whoosh(1.55, 0.45, 0.35)
# DROP
boom(2.0, 1.0, 26); clap(2.0, 0.35); pad(2.0, 2.0, [50, 62, 65, 69, 74], gain=0.22, att=0.005, rel=1.2, blend=0.35, bright=0.6, send=0.8)

# playhead: the word played as a sequencer (rows → pitch)
for e in evs("note"):
    soft = e.get("soft", 0)
    for r in e["rows"]:
        pluck(e["t"], row_pitch(r, 62 if not soft else 74), gain=(0.07 if not soft else 0.05), blend=0.15, bright=0.4, dur=0.3, d=0.12, pan=(e["col"] - 20) / 24, send=0.4)

def roll(t0, dur=1.2, density=40, gain=0.07):
    for k in range(density): flap(t0 + rng.random() * dur, clicks=1, gain=gain, pan=rng.random() * 2 - 1)

for e in evs("roll"): roll(e["t"], e["dur"], e["n"] * 2, 0.07)
riser(7.0, 1.0, 0.2, 400, 5000); whoosh(7.5, 0.5, 0.4)

# COUNTDOWN: flap clatter per beat, rising stabs
for i, e in enumerate(evs("flap")):
    roll(e["t"], 0.35, min(40, e["n"] // 3), 0.06)
    m = 62 + i
    out(e["t"], osc(mtof(m), 0.18, 0.5, 0.4) * env(int(0.18 * SR), 0.002, 0.07), 0, 0.08, send=0.3, bus="music")
riser(12.0, 3.7, 0.24, 200, 7000)
pluck(15.0, 86, gain=0.12, blend=0.0, dur=1.0, d=0.5, send=0.8)
# 16.0 DROP 2
boom(16.0, 1.0, 26); clap(16.0, 0.35)

# DESIGN: weight hits — brighter and squarer as the word gets heavier
for e in evs("weight"):
    i = e["i"]; bright = 0.15 + 0.2 * i; blend = 0.1 + 0.2 * i
    for m in [50, 62, 65, 69]:
        out(e["t"], osc(mtof(m), 0.45, blend, bright) * env(int(0.45 * SR), 0.002, 0.2), 0, 0.07 + 0.012 * i, send=0.4, bus="music")
    boom(e["t"], 0.25 + 0.06 * i, 38)
for e in evs("lens"):  # ROUND → PIXEL: one sustained tone morphing sine → square
    n = int(1.3 * SR); tt_ = tt(n); bl = np.clip(tt_ / 1.2, 0, 1)
    f = mtof(69); ph = 2 * np.pi * f * tt_
    s = (1 - bl) * np.sin(ph) + bl * np.sign(np.sin(ph)) * 0.6
    out(e["t"], s * env(n, 0.02, 0.9, 0.3) * 0.5, 0, 0.12, send=0.4)
# the PAD: arpeggio whose timbre follows the cursor (WGHT → brightness, ROND → sine/square)
pad_tr = D["pad"]
for k, (t, w, r) in enumerate(pad_tr):
    ch = chord_at(t); m = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24][k % 4]
    blend = 1 - r / 100; bright = 0.1 + 0.9 * (w - 100) / 800
    out(t, osc(mtof(m), 0.16, blend, bright) * env(int(0.16 * SR), 0.002, 0.06), ((k % 4) - 1.5) / 2, 0.075, send=0.3, bus="music")
def ui_click(t, gain=0.3):
    n = int(0.03 * SR); s = bandnoise(n, 3000, 9000) * np.exp(-tt(n) / 0.003) + 0.6 * np.sin(2 * np.pi * 1800 * tt(n)) * np.exp(-tt(n) / 0.008)
    out(t, s, 0.1, gain, send=0.1)
for e in evs("click") + evs("release"): ui_click(e["t"], 0.25)

# AVENUE: driving 16th arp + panel passes
for s in range(int(26 / 0.125), int(33.9 / 0.125)):
    t = s * 0.125; ch = chord_at(t)
    m = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 24][s % 4] + (12 if (s // 8) % 2 else 0)
    out(t, osc(mtof(m), 0.12, 0.4, 0.5) * env(int(0.12 * SR), 0.002, 0.05), ((s % 4) - 1.5) / 2.5, 0.05, send=0.35, bus="music")
for k in range(24): whoosh(26.2 + k * 0.21, 0.25, 0.05 + 0.02 * (k % 3))
boom(31.5, 0.6, 33)
for e in evs("ping"):
    if 31 < e["t"] < 34: pluck(e["t"], row_pitch(e["row"], 74), gain=0.08, blend=0.0, dur=0.6, d=0.3, pan=(e["col"] - 2) / 3, send=0.6)
riser(32.6, 1.3, 0.2, 400, 6000)

# MATERIALS: a motif per display technology
for e in evs("whoosh"): whoosh(e["t"] - 0.2, 0.45, 0.4)
for e in evs("mat"):
    t0, name = e["t"], e["name"]
    boom(t0, 0.4, 36)
    if name == "LED":       # elevator chime + square buzz
        for i, m in enumerate([81, 77]): pluck(t0 + 0.1 + i * 0.35, m, gain=0.16, blend=0.0, bright=0.2, dur=1.4, d=0.8, send=0.7)
        out(t0, osc(mtof(38), 1.6, 1.0, 0.6) * env(int(1.6 * SR), 0.01, 0.6, 0.6), 0, 0.05)
    elif name == "VFD":     # shimmering sine bleeps
        for i in range(8): pluck(t0 + i * 0.25, [86, 81, 79, 74][i % 4], gain=0.07, blend=0.0, bright=0.1, dur=0.5, d=0.2, pan=(i % 2) * 0.8 - 0.4, send=0.8)
    elif name == "AMBER":   # departures flaps
        roll(t0 + 0.05, 1.2, 70, 0.08)
        for i, m in enumerate([74, 77, 81]): pluck(t0 + 1.2 + i * 0.12, m, gain=0.08, blend=0.1, dur=0.8, d=0.5, send=0.6)
    elif name == "LCD":     # 8-bit arpeggio
        for i in range(16): out(t0 + i * 0.125, osc(mtof([74, 77, 81, 86][i % 4] + (0 if i < 8 else 5)), 0.11, 1.0, 0.7) * env(int(0.11 * SR), 0.001, 0.08), 0, 0.045)
    elif name == "THERMAL": # dot-matrix printer: rhythmic needle bursts + ding
        for i in range(28):
            n = int(0.03 * SR); out(t0 + 0.1 + i * 0.05, bandnoise(n, 1500, 6000) * np.exp(-tt(n) / 0.012), 0.2, 0.12)
        pluck(t0 + 1.6, 88, gain=0.14, blend=0.0, dur=1.0, d=0.6, send=0.7)

# BOARD: big rolls
for e in evs("boardroll"): roll(e["t"], e["dur"] + 0.8, 160, 0.07)

# SITE: breakdown swell
riser(57.5, 2.5, 0.2, 200, 5000); whoosh(59.5, 0.5, 0.35)
pad(52.0, 3.0, [50, 62, 65, 69, 74], gain=0.16, att=1.0, rel=1.5, send=0.9)
for s_ in range(int(52 / 0.25), int(59.5 / 0.25)):
    t = s_ * 0.25; ch = chord_at(t); m = [ch[1] + 12, ch[3] + 12, ch[2] + 24, ch[3] + 12][s_ % 4]
    pluck(t, m, gain=0.05, blend=0.0, bright=0.2, dur=0.5, d=0.25, pan=((s_ % 4) - 1.5) / 2, send=0.8)

# TESTER: keys, slides
def key_tick(t):
    n = int(0.02 * SR); out(t, bandnoise(n, 2500, 7000) * np.exp(-tt(n) / 0.004), (rng.random() - 0.5) * 0.4, 0.13)
for e in evs("key"): key_tick(e["t"])
for i, e in enumerate(evs("slide")):
    n = int(1.2 * SR); tt_ = tt(n)
    if i == 0: f = mtof(57) * (1 + tt_ / 1.2); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.3 + 0.7 * tt_ / 1.2)
    else: ph = 2 * np.pi * mtof(69) * tt_; bl = np.clip(tt_ / 1.2, 0, 1); s = (1 - bl) * np.sin(ph) + bl * np.sign(np.sin(ph)) * 0.6
    out(e["t"], s * env(n, 0.02, 0.6, 0.6), 0, 0.09, send=0.4)

# WALL: ripple sweep, then dark
for e in evs("ripple"): whoosh(e["t"], 1.6, 0.45); boom(e["t"], 0.6, 33)
riser(68.5, 2.0, 0.24, 300, 8000)
for e in evs("out"):
    boom(e["t"], 0.7, 31)
    n = int(1.6 * SR); out(e["t"] + 0.05, np.sin(2 * np.pi * mtof(86) * tt(n)) * np.exp(-tt(n) / 0.7), 0, 0.12, send=0.8)
for e in evs("dive"):
    n = int(1.0 * SR); s = bandnoise(n, 500, 9000) * (tt(n) / 1.0) ** 2.5; out(e["t"], s, 0, 0.45, send=0.4)

# END: final chord, lights out, last dot
boom(72.0, 1.0, 26); clap(72.0, 0.3)
pad(72.0, 5.0, [38, 50, 62, 65, 69, 74, 76], gain=0.26, att=0.005, rel=3.0, blend=0.25, bright=0.5, send=0.9)
for k in range(41): pluck(77.0 + (41 - k) * 0.035, row_pitch(k % 9, 62), gain=0.025, blend=0.0, dur=0.3, d=0.15, pan=(k - 20) / 24, send=0.5)
for e in evs("lastdot"):
    n = int(1.3 * SR); out(e["t"], np.sin(2 * np.pi * mtof(74) * tt(n)) * np.exp(-tt(n) / 0.45), 0, 0.14, send=0.9)
# cuts
for e in evs("cut"):
    if e["t"] in (16.0, 72.0): continue
    whoosh(e["t"] - 0.35, 0.5, 0.2)

exec(open(os.path.join(ROOT, "tools", "_mix.py")).read())
# silence windows (the black before drop 2, the dark before the dive)
def duck(a, b, floor=0.0, ramp=0.03):
    i0, i1 = int(a * SR), int(b * SR); r = int(ramp * SR)
    g = np.ones(N); g[i0:i1] = floor; g[max(0, i0 - r):i0] = np.linspace(1, floor, min(r, i0)); g[i1:i1 + r] = np.linspace(floor, 1, min(r, N - i1))
    return g
g = duck(15.75, 16.0, 0.05)
L *= g; R *= g
f = np.ones(N); f[int((LEN - 0.6) * SR):] = np.linspace(1, 0, N - int((LEN - 0.6) * SR)) ** 1.5
L *= f; R *= f
mix = np.stack([L, R], 1)
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6)
mix /= np.abs(mix).max(); mix *= 10 ** (-1 / 20)
with wave.open(os.path.join(ROOT, "assets", "score.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print(" ".join(f"{s}:{20*np.log10(np.sqrt((mix[s*SR:(s+2)*SR]**2).mean())+1e-9):.0f}" for s in range(0, int(LEN), 2)))

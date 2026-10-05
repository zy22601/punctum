"""42 s cut score: ElevenLabs track C (assets/eleven/C.wav) re-edited bar by bar to the cut,
plus the opening pings stem (tools/opening.py) and the SFX stem (tools/cut_sfx.py)."""
import os, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
LEN = 42
def load(p):
    w = wave.open(os.path.join(ROOT, p)); ch, sw = w.getnchannels(), w.getsampwidth()
    x = np.frombuffer(w.readframes(w.getnframes()), {2: np.int16, 4: np.int32}[sw]).reshape(-1, ch) / (2 ** (8 * sw - 1))
    return np.repeat(x, 2, 1) if ch == 1 else x
c, op, orig = load("assets/eleven/C.wav"), load("assets/opening.wav"), load("assets/score.wav")
S = lambda t: int(round(t * SR))
al = c[S(1.01):]                                    # C aligned to the 60 s design: entry 4, drop 20, stop 56
al = np.vstack([al, np.zeros((S(60) - len(al), 2))])[:S(60)]
# film ← aligned-C bars: intro silence, entry, the last 2 bars of the build, the drop, board → 35 lights → stop
EDIT = [(0, 2, 2), (2, 2, 4), (4, 4, 16), (8, 8, 20), (16, 22, 34)]   # (film start, length, aligned start)
m = np.zeros((S(LEN), 2)); xf = S(0.02)
for f0, n, a0 in EDIT:
    seg = al[S(a0):S(a0 + n) + xf].copy()
    seg[:xf] *= np.linspace(0, 1, xf)[:, None]; seg[-xf:] *= np.linspace(1, 0, xf)[:, None]
    m[S(f0):S(f0) + len(seg)] += seg[: S(LEN) - S(f0)]
# breath before the drop: the countdown blacks out at film 7.875
g = np.ones(S(LEN)); g[S(7.83):S(7.87)] = np.linspace(1, 0.03, S(0.04)); g[S(7.87):S(8.0)] = 0.03
m *= g[:, None]
# ending: the music's last beat (film 37.5–38) smeared into a long wash under the end card
mus = m.copy()
rng = np.random.default_rng(56); n = S(3.2); tt_ = np.arange(n) / SR
ir = rng.standard_normal((n, 2)) * np.exp(-tt_ / 0.9)[:, None]; ir[: S(0.01)] = 0
src_ = mus[S(37.5):S(38.0)] * np.hanning(S(0.5))[:, None]
wash = np.zeros((S(4), 2))
for ch in (0, 1):
    cv = np.convolve(src_[:, ch], ir[:, ch])[: S(4)]; wash[: len(cv), ch] = cv
wash *= np.sqrt((mus[S(36):S(38)] ** 2).mean()) / (np.sqrt((wash[: S(0.6)] ** 2).mean()) + 1e-12) * 0.45
fade = np.ones(S(4)); fade[S(3.2):] = np.linspace(1, 0, S(0.8))
m[S(38):S(42)] += wash * fade[:, None]
# opening pings, level-matched to the original score's 0.5–3.8 s
ref = np.sqrt((orig[S(0.5):S(3.8)] ** 2).mean()); cur = np.sqrt((op[S(0.25):S(1.9)] ** 2).mean())
m[:len(op)] += op * (ref / cur)
# split-flap rolls + whooshes (tools/cut_sfx.py), at the original score's balance (−16 dB vs the mix in the countdown)
fx = load("assets/sfx-cut.wav")[:S(LEN)]
# per-event level fixed from the 1× countdown calibration (the 2× countdown is twice as dense,
# so an RMS match here would turn each roll down)
k = 6.2
m[:len(fx)] += fx * k
print("sfx gain", round(float(k), 2))
m /= max(1.0, np.abs(m).max()) / 0.98
with wave.open(os.path.join(ROOT, "assets", "score-cut-raw.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((m * 32767).astype(np.int16).tobytes())
print("ok", len(m) / SR)

"""Score for the integrated launch film: splice the 35 LIGHTS score (A) and the specimen-demo
score (B) by the same EDL as the picture, so every click / flap / hit stays in sync, then add
transition sweeteners. Writes assets/score.wav."""
import json, os, re, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
txt = open(os.path.join(ROOT, "assets", "edl.js")).read()
EDL = json.loads(re.search(r"window\.EDL = (\[[\s\S]*?\]);", txt).group(1).replace("\n", "").replace(",]", "]").replace(", ]", "]"))
LEN = float(re.search(r"FILM_LEN = ([\d.]+)", txt).group(1))
N = int(LEN * SR)


def load(p):
    w = wave.open(p); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float64) / 32767
    return a


SRC = {"A": load(os.path.join(ROOT, "..", "punctum-35-lights", "assets", "score.wav")),
       "B": load(os.path.join(ROOT, "footage", "specimen-music.wav"))}

# level-match: RMS of each source over the ranges actually used
def used_rms(k):
    parts = [SRC[k][int(s * SR):int((s + t1 - t0) * SR)] for src, t0, t1, s in EDL if src == k]
    x = np.concatenate(parts); return np.sqrt((x ** 2).mean())
gain = {k: 1.0 for k in SRC}
ra, rb = used_rms("A"), used_rms("B")
gain["A"] = np.sqrt(ra * rb) / ra; gain["B"] = np.sqrt(ra * rb) / rb
print("rms A %.3f B %.3f → gains %.2f %.2f" % (ra, rb, gain["A"], gain["B"]))

MIX = np.zeros((N, 2))
XF = 0.025  # crossfade at each splice
for src, t0, t1, s in EDL:
    a = max(0.0, t0 - XF); b = min(LEN, t1 + XF)
    i0, i1 = int(a * SR), int(b * SR)
    j0 = int((s - (t0 - a)) * SR)
    seg = SRC[src][j0:j0 + (i1 - i0)].copy()
    if len(seg) < i1 - i0: seg = np.pad(seg, ((0, i1 - i0 - len(seg)), (0, 0)))
    n = len(seg); env = np.ones(n); k = int(2 * XF * SR)
    if t0 > 0: env[:k] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, k))
    if t1 < LEN: env[-k:] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, k))
    MIX[i0:i1] += seg * env[:, None] * gain[src]

# sweeteners on the designed transitions
rng = np.random.default_rng(3)
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)
exec(open(os.path.join(ROOT, "tools", "_helpers.py")).read())   # defines L, R (length N) + boom/whoosh/riser/clap…
whoosh(3.3, 0.6, 0.35); boom(3.6, 0.5, 33)
boom(8.0, 0.45, 33)
riser(14.5, 1.4, 0.2, 300, 5000); boom(16.0, 1.0, 31); clap(16.0, 0.3)
whoosh(27.5, 0.5, 0.3); boom(27.95, 0.6, 33)
whoosh(38.0, 0.7, 0.4); boom(38.4, 0.45, 33)
whoosh(50.9, 0.7, 0.38); boom(51.3, 0.45, 33)
whoosh(63.6, 0.6, 0.45); boom(64.0, 0.5, 33)
boom(76.0, 0.55, 33); clap(76.0, 0.2)
whoosh(81.6, 0.5, 0.3); boom(82.0, 0.6, 33)
MIX[:, 0] += L * 0.8; MIX[:, 1] += R * 0.8

f = np.ones(N); f[int((LEN - 0.8) * SR):] = np.linspace(1, 0, N - int((LEN - 0.8) * SR)) ** 1.5
MIX *= f[:, None]
MIX = np.tanh(MIX / (np.abs(MIX).max() + 1e-9) * 1.4)
MIX /= np.abs(MIX).max(); MIX *= 10 ** (-1 / 20)
with wave.open(os.path.join(ROOT, "assets", "score.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((MIX * 32767).astype(np.int16).tobytes())
print(" ".join(f"{s}:{20*np.log10(np.sqrt((MIX[s*SR:(s+2)*SR]**2).mean())+1e-9):.0f}" for s in range(0, int(LEN), 2)))

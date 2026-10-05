"""Opening stem for the 54 s cut: the 35 lights at double speed (0–2 s) + the boom
on the cut into the word. Reuses score.py's synth helpers; writes assets/opening.wav."""
import os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "score.py"), encoding="utf-8").read()
src = src[: src.index("# ── 01 ONE LIGHT")].replace("DUR = 60.0", "DUR = 6.0")
g = {"__file__": os.path.join(HERE, "score.py")}
exec(src, g)
SR, N, s1, pluck, pad, boom, tt, bandnoise = (g[k] for k in ("SR", "N", "s1", "pluck", "pad", "boom", "tt", "bandnoise"))
K = 0.5  # time scale of the opening

SC1 = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]
for k, (t, c, r) in enumerate(s1):
    m = SC1[k % len(SC1)] - (12 if k < 4 else 0)
    pluck(t * K, m, gain=0.07 + 0.07 * (k / 34), blend=0.0, dur=1.2, d=0.32, pan=(c - 2) / 3, send=0.7)
pad(0.3, 1.7, [38, 45], gain=0.18, att=1.3, rel=0.6)
boom(2.0, 0.85)

L, R, VL, VR, ML, MR, SC = (g[k] for k in ("L", "R", "VL", "VR", "ML", "MR", "SC"))
L += ML * SC; R += MR * SC
def fft_conv(x, ir):
    size = 1 << (len(x) + len(ir) - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
irn = int(2.6 * SR); t = tt(irn)
irL = bandnoise(irn, 200, 9000) * np.exp(-t / 0.55); irR = bandnoise(irn, 200, 9000) * np.exp(-t / 0.55)
irL[: int(0.012 * SR)] = 0; irR[: int(0.017 * SR)] = 0
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
L += fft_conv(VL, irL) * 0.55; R += fft_conv(VR, irR) * 0.55
mix = np.stack([L, R], 1)
with wave.open(os.path.join(os.path.dirname(HERE), "assets", "opening.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(4); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * (2**31 - 1)).astype(np.int32).tobytes())
print("ok peak", np.abs(mix).max())

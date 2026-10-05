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



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


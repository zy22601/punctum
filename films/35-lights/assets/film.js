/* PUNCTUM // 35 LIGHTS — picture engine.
 * Every frame is a pure function of t. Everything on screen, HUD included, is a
 * Punctum dot on one lattice. Timing constants mirror tools/score.py. */
(function () {
  const W = 1920, H = 1080, BEAT = 0.5;
  const BM = window.PUNCTUM_BITMAPS, EV = window.PUNCTUM_EVENTS;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
  const lerpLog = (a, b, t) => a * Math.pow(b / a, t);
  const E = {
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
  };
  const seg = (t, a, b, e = (x) => x) => e(clamp((t - a) / (b - a), 0, 1));
  function pw(w, pts) { for (let i = 1; i < pts.length; i++) if (w <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return lerp(va, vb, (w - a) / (b - a)); } return pts[pts.length - 1][1]; }
  /* half-size of a dot per pitch (mirrors build.py masters) */
  const dotR = (w, r) => lerp(pw(w, [[100, 11], [400, 27], [900, 50]]), pw(w, [[100, 12], [400, 30], [900, 50]]), r / 100) / 100;
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  function hash(i, j, k = 0) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  /* ── split-flap drum ─────────────────────────── */
  const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/";
  function flapChar(from, to, t, start, steps, tick) {
    if (t < start) return from;
    const k = Math.floor((t - start) / tick);
    if (k >= steps) return to;
    const T = to.toUpperCase(); let e = DRUM.indexOf(T); if (e < 0) e = (T.codePointAt(0) * 7) % DRUM.length;
    return DRUM[(e - steps + k + DRUM.length * 8) % DRUM.length];
  }
  /* roll every char of `from` lines into `to` lines starting at t0, diagonal stagger */
  function flapLines(from, to, t, t0, o = {}) {
    const { stagger = 0.03, lag = 0.06, min = 5, max = 11, tick = 0.04 } = o;
    const n = Math.max(from.length, to.length), out = [];
    for (let l = 0; l < n; l++) {
      const a = [...(from[l] || "")], b = [...(to[l] || "")], m = Math.max(a.length, b.length);
      let s = "";
      for (let i = 0; i < m; i++) {
        const fa = a[i] ?? " ", tb = b[i] ?? " ";
        if (fa === tb && !o.all) { s += tb; continue; }
        const steps = min + ((i * 7 + l * 3) % (max - min + 1));
        s += flapChar(fa, tb, t, t0 + i * stagger + l * lag, steps, tick);
      }
      out.push(s);
    }
    return out;
  }

  /* ── frame buffer on the lattice ─────────────────────────── */
  let NC = 0, NR = 0, I0 = 0, J0 = 0, LB, XB, CB, SB;
  function frameGrid(cx, cy, P) {
    I0 = Math.floor(cx - W / 2 / P) - 2; J0 = Math.floor(cy - H / 2 / P) - 2;
    NC = Math.ceil(W / P) + 5; NR = Math.ceil(H / P) + 5;
    const n = NC * NR;
    if (!LB || LB.length < n) { LB = new Float32Array(n); XB = new Float32Array(n); CB = new Uint8Array(n); SB = new Float32Array(n); }
    LB.fill(0, 0, n); XB.fill(0, 0, n); CB.fill(0, 0, n); SB.fill(-1, 0, n);
  }
  function lit(i, j, b = 1, x = 0, c = 0, rond = -1) {
    const a = i - I0, d = j - J0;
    if (a < 0 || d < 0 || a >= NC || d >= NR) return;
    const k = d * NC + a;
    if (b >= LB[k]) { LB[k] = b; CB[k] = c; }
    XB[k] = Math.max(XB[k], x);
    if (rond >= 0) SB[k] = rond;
  }
  function stampChar(ch, i, j, b = 1, x = 0, c = 0, colMax = 99, rond = -1) {
    const bm = BM[ch]; if (!bm) return;
    if (i + 5 < I0 || i > I0 + NC || j + 9 < J0 || j > J0 + NR) return;
    for (let y = 0; y < 9; y++) { const row = bm[y]; for (let q = 0; q < 5 && q <= colMax; q++) if (row.charCodeAt(q) === 35) lit(i + q, j + y, b, x, c, rond); }
  }
  function stampLines(lines, i, j, o = {}) {
    lines.forEach((ln, l) => [...ln].forEach((ch, k) => {
      const b = typeof o.b === "function" ? o.b(k, l) : (o.b ?? 1);
      const x = typeof o.x === "function" ? o.x(k, l) : (o.x ?? 0);
      stampChar(ch, i + k * 6, j + l * 10, b, x, o.c || 0, 99, o.rond ?? -1);
    }));
  }

  /* ── renderer ─────────────────────────── */
  let bloom = null;
  function render(ctx, F) {
    const { cx, cy, P, st } = F;
    ctx.fillStyle = css(st.bg); ctx.fillRect(0, 0, W, H);
    const Lr = dotR(st.w, st.rond) * P, Ur = Math.max(0.6, Lr * (st.unlitK ?? 0.5)) * (st.unlitScale ?? 1);
    const smear = Math.min(Math.abs(F.vx || 0) / 60 * 1.6, P * 9);
    const lens = F.lens, wipe = F.wipe;
    const NL = 8;
    const offPaths = Array.from({ length: 4 }, () => new Path2D());
    const onPaths = [Array.from({ length: NL }, () => new Path2D()), Array.from({ length: NL }, () => new Path2D())];
    const shape = (p, x, y, h, rond, sm) => {
      if (h <= 0.25) return;
      if (h < 1.2 && sm < 1) { p.rect(x - h, y - h, h * 2, h * 2); return; }
      const ww = h * 2 + sm;
      p.roundRect(x - ww / 2, y - h, ww, h * 2, Math.min(h, ww / 2) * clamp(rond, 0, 100) / 100);
    };
    const offAlpha = st.offAlpha ?? 1;
    for (let d = 0; d < NR; d++) {
      const j = J0 + d, sy = H / 2 + (j - cy) * P;
      if (sy < -P || sy > H + P) continue;
      for (let a = 0; a < NC; a++) {
        const i = I0 + a, sx = W / 2 + (i - cx) * P;
        if (sx < -P * 6 || sx > W + P * 6) continue;
        const k = d * NC + a;
        let f = 0;
        if (lens) { const dx = (sx - lens.x) / lens.sx, dy = (sy - lens.y) / lens.sy; f = Math.exp(-(dx * dx + dy * dy)) * lens.k; }
        let rond = st.rond;
        if (wipe && sx < wipe.x) rond = wipe.rond;
        if (SB[k] >= 0) rond = SB[k];
        const b = LB[k];
        if (b > 0.02) {
          const h = Lr * (1 + XB[k]) * (1 + f * (lens ? lens.grow : 0)) * (st.litScale ?? 1);
          const r2 = lerp(rond, 0, f * (lens ? lens.square : 0));
          const lvl = Math.min(NL - 1, Math.round(clamp(b, 0, 1) * (NL - 1)));
          shape(onPaths[CB[k]][lvl], sx, sy, Math.min(h, P * 0.5 * (1 + XB[k] * 0.4)), r2, smear);
        } else if (offAlpha > 0) {
          const lv = f > 0.05 ? Math.min(3, 1 + Math.floor(f * 3)) : 0;
          shape(offPaths[lv], sx, sy, Ur * (1 + f * 1.2), lerp(rond, 0, f * (lens ? lens.square : 0)), smear * 0.6);
        }
      }
    }
    if (offAlpha > 0) offPaths.forEach((p, lv) => { ctx.fillStyle = css(mixc(st.off, st.dim || st.on, lv * 0.22), offAlpha); ctx.fill(p); });
    const cols = [st.on, st.on2 || st.on];
    cols.forEach((c, ci) => onPaths[ci].forEach((p, lvl) => { ctx.fillStyle = css(mixc(st.off, c, (lvl + 0.5) / NL * 1.06)); ctx.fill(p); }));
    if (st.glow > 0.01) { // LED bloom: lit dots only, blurred at half res, added on top
      if (!bloom) { bloom = document.createElement("canvas"); bloom.width = W / 2; bloom.height = H / 2; }
      const g = bloom.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W / 2, H / 2); g.setTransform(0.5, 0, 0, 0.5, 0, 0);
      cols.forEach((c, ci) => onPaths[ci].forEach((p, lvl) => { g.fillStyle = css(c, (lvl + 0.5) / NL); g.fill(p); }));
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const [r, a] of [[P * 0.18, 0.5], [P * 0.7, 0.42], [P * 2.2, 0.28]]) { ctx.filter = `blur(${r.toFixed(1)}px)`; ctx.globalAlpha = a * st.glow; ctx.drawImage(bloom, 0, 0, W, H); }
      ctx.restore();
    }
  }

  /* ── HUD: tiny Punctum dots in screen space ─────────────────────────── */
  function hudText(ctx, str, x, y, p, col, align = "left", alpha = 1) {
    const chars = [...str], w = chars.length * 6 * p - p;
    let x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    ctx.fillStyle = css(col, alpha);
    const path = new Path2D(), h = p * 0.36;
    chars.forEach((ch, n) => {
      const bm = BM[ch] || BM[ch.toUpperCase()]; if (!bm) return;
      for (let r = 0; r < 9; r++) for (let q = 0; q < 5; q++) if (bm[r][q] === "#") path.rect(x0 + (n * 6 + q) * p + p / 2 - h, y + r * p + p / 2 - h, h * 2, h * 2);
    });
    ctx.fill(path);
  }

  /* ── palettes ─────────────────────────── */
  const INK = { bg: hex("#09090A"), on: hex("#F3F1EA"), off: hex("#1B1B1C"), dim: hex("#6F6D66") };
  const st = (o) => Object.assign({ bg: INK.bg, on: INK.on, off: INK.off, dim: INK.dim, w: 500, rond: 100, unlitK: 0.5 }, o);
  const SECTIONS = [[0, "01 ONE LIGHT"], [2, "02 SCORE"], [4, "03 COUNTDOWN"], [8, "04 DESIGN SPACE"], [16, "05 BOARD"], [30, "06 35 LIGHTS"], [38, "07 PUNCTUM"]];
  // film time T → source time t (the 60 s design). Every boundary is a bar (2 s at 120 bpm).
  //  0–2  s1 at 2×        2–4  fast write (s2b)     4–8  countdown at 2× (a number per 8th)
  //  8–13 weights at 2×   13–16 ROUND→PIXEL at 4/3  16–42 board, 35 lights, end card at 1×
  const LEN = 42;
  const srcOf = (T) => T < 2 ? T * 2 : T < 4 ? writeT(T - 2) : T < 8 ? 12 + (T - 4) * 2 : T < 13 ? 20 + (T - 8) * 2 : T < 16 ? 30 + (T - 13) * 4 / 3 : T + 18;
  // the write in 2 s: pull 0.4 s, 35 columns in 1.2 s, the name holds 0.4 s
  const writeT = (u) => u < 0.4 ? 52 + u * 2 : u < 1.6 ? 52.8 + (u - 0.4) * (2.95 / 1.2) : 55.75 + (u - 1.6) * 0.625;
  const WORD = "PUNCTUM";
  const S6_RES = [54.5, 54.0, 53.5, 53.0, 53.5, 54.0, 54.5];
  const S2_T0 = 5.0, S2_STEP = 0.125, S6_T0 = 52.75, S6_STEP = 3.0 / 35, WIPE_T0 = 30.5, WIPE_T1 = 33.5;
  const beatPulse = (t, from, to, k = 7) => (t < from || t >= to ? 0 : Math.exp(-((t - from) % BEAT) * k));

  /* ── scenes ─────────────────────────── */
  function s1(t) { // ONE LIGHT 0–4
    const P = lerp(128, 150, E.inOutCubic(t / 4));
    frameGrid(2, 3, P);
    for (const [tk, c, r] of EV.s1) if (t >= tk) lit(c, r, 1, 0.9 * Math.exp(-(t - tk) * 9));
    return { cx: 2, cy: 3, P, st: st({ w: 520, offAlpha: seg(t, 0.15, 1.6), unlitK: 0.42 }), hud: seg(t, 0.6, 1.4), ro: [520, 100] };
  }
  function writeWord(t, centreI) { // playhead writes PUNCTUM in 3 s under a squaring lens (52–56 timing)
    const pull = seg(t, 52.15, 52.8, E.inOutExpo);
    const P = lerpLog(150, 1920 * 0.84 / 41, pull), cx = lerp(centreI + 2, centreI + 20, pull), cy = lerp(3, 4, pull);
    frameGrid(cx, cy, P);
    const pc = Math.floor((t - S6_T0) / S6_STEP) + 6;
    [...WORD].forEach((ch, ci) => {
      const bm = BM[ch];
      for (let y = 0; y < 9; y++) for (let q = 0; q < 5; q++) {
        const c = ci * 6 + q;
        if (bm[y][q] !== "#") continue;
        if (c >= 6 && c > pc) continue;
        const tc = S6_T0 + (c - 6) * S6_STEP;
        lit(centreI + c, y, 1, c >= 6 ? 0.9 * Math.exp(-(t - tc) * 9) : 0);
      }
    });
    if (t < 52.3) for (let y = 0; y < 7; y++) for (let q = 0; q < 5; q++) if (BM.P[y][q] !== "#") lit(centreI + q, y, 1 - seg(t, 52.0, 52.3), 0);
    let lens = null;
    if (t >= 52.6) {
      const pcl = clamp((t - S6_T0) / S6_STEP + 6, 0, 41);
      lens = { x: W / 2 + (centreI + pcl - cx) * P, y: H / 2 + (4 - cy) * P, sx: P * 3.2, sy: P * 6, k: seg(t, 52.6, 53.0) * (1 - seg(t, 55.6, 56)), grow: 0.55, square: 1 };
    }
    return { P, cx, cy, lens };
  }
  function s2b(t) { // SCORE, film 2–4 (t in the 52–56 write timing)
    const { P, cx, cy, lens } = writeWord(t, 0);
    return { cx, cy, P, lens, st: st({ w: 560, unlitK: 0.45 }), hud: 1, ro: [560, 100] };
  }
  function wordCols(t, c) { // which columns of PUNCTUM are written by the s2 playhead
    return c < 6 ? true : t >= S2_T0 + (c - 6) * S2_STEP;
  }
  function s2(t) { // SCORE 4–12
    const pull = seg(t, 4.15, 5.0, E.inOutExpo);
    const P = lerpLog(142, 1920 * 0.84 / 41, pull);
    const cx = lerp(2, 20, pull), cy = lerp(3, 4, pull);
    frameGrid(cx, cy, P);
    const pc = Math.floor((t - S2_T0) / S2_STEP) + 6;
    const pump = t >= 8 ? 0.18 * beatPulse(t, 8, 12, 8) : 0;
    let chars = [...WORD];
    if (t >= 11.5) chars = chars.map((ch, i) => flapChar(ch, ch, t, 11.5 + i * 0.03, 60, 0.045));
    const resolve = seg(t, 4.0, 4.3);
    chars.forEach((ch, ci) => {
      const bm = BM[ch];
      for (let y = 0; y < 9; y++) for (let q = 0; q < 5; q++) {
        const c = ci * 6 + q;
        if (bm[y][q] !== "#" || !wordCols(t, c)) continue;
        const tc = S2_T0 + (c - 6) * S2_STEP;
        const fl = c >= 6 ? 0.9 * Math.exp(-(t - tc) * 10) : 0;
        lit(c, y, 1, fl + pump);
      }
    });
    if (t < 4.3) for (let y = 0; y < 7; y++) for (let q = 0; q < 5; q++) if (BM.P[y][q] !== "#") lit(q, y, 1 - resolve, 0);
    const scan = pc >= 6 && pc <= 41 && t < 9.6 ? pc : null;
    if (scan != null) for (let j = J0; j < J0 + NR; j++) { const k = (j - J0) * NC + (scan - I0); if (k >= 0 && LB[k] === 0) { LB[k] = 0.001; } }
    return {
      cx, cy, P, st: st({ w: 520, unlitK: 0.45 }), hud: 1, ro: [520, 100],
      scan, extra: (ctx, F) => { if (scan == null) return; const sx = W / 2 + (scan - F.cx) * F.P; ctx.fillStyle = "rgba(243,241,234,0.05)"; ctx.fillRect(sx - F.P / 2, 0, F.P, H); },
      tag: scan != null ? `STEP ${String(scan - 5).padStart(2, "0")}/35` : null,
    };
  }
  function s3(t) { // COUNTDOWN 12–20
    const b = Math.floor((t - 12) / BEAT), fr = ((t - 12) % BEAT) / BEAT;
    const zs = b + E.outExpo(clamp(fr / 0.3, 0, 1));
    const P = 150 * Math.pow(0.9, clamp(zs, 0, 15.2));
    const cx = 5.5, cy = 3;
    frameGrid(cx, cy, P);
    const num = (k) => String(clamp(k, 1, 99)).padStart(2, "0");
    const n = 16 - clamp(b, 0, 15);
    const black = t >= 19.75;
    const gx0 = Math.floor((I0 - 14) / 14), gx1 = Math.ceil((I0 + NC) / 14), gy0 = Math.floor((J0 - 10) / 10), gy1 = Math.ceil((J0 + NR) / 10);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const centre = gx === 0 && gy === 0;
      const dist = Math.hypot(gx, gy * 1.4);
      const off = centre ? 0 : 1 + Math.floor(hash(gx, gy) * 80);
      const conv = !centre && t >= 18.0 ? 1 : 0;
      const val = (k) => (conv && k >= 12 ? 16 - clamp(k, 0, 15) : ((16 - clamp(k, 0, 15) + off - 1) % 99) + 1);
      const bt = 12 + b * BEAT, start = bt + (centre ? 0 : 0.02 + dist * 0.035);
      const prev = num(val(b - 1)), cur = num(val(b));
      const s = t < start || b === 0 ? (b === 0 && t < 12.02 ? cur : t < start ? prev : cur) : flapLines([prev], [cur], t, start, { stagger: 0.03, min: 3, max: 5, tick: 0.045 })[0];
      const bright = centre ? 1 : 0.32 + 0.25 * conv;
      if (!black) stampLines([s], gx * 14, gy * 10, { b: bright, x: centre ? 0.12 * Math.exp(-fr * BEAT * 9) : 0 });
    }
    return { cx, cy, P, st: st({ w: 560, unlitK: 0.5, offAlpha: black ? 0.45 : 1 }), hud: black ? 0 : 1, ro: [560, 100], tag: `T-${num(n)}` };
  }
  const S4 = [["THIN", 100], ["LIGHT", 300], ["REGULAR", 400], ["BOLD", 700], ["BLACK", 900], ["ROUND", 900], ["ROUND", 900]];
  const pad7 = (s) => { const k = Math.floor((7 - s.length) / 2); return (" ".repeat(k) + s + "       ").slice(0, 7); };
  function s4(t) { // DESIGN SPACE 20–34
    const bar = clamp(Math.floor((t - 20) / 2), 0, 6), tb = 20 + bar * 2;
    const [word, w1] = S4[bar], w0 = bar ? S4[bar - 1][1] : 100;
    const len = (s) => s.trim().length;
    const fitP = (s) => Math.min(1920 * 0.8 / (len(s) * 6 - 1), 1080 * 0.5 / 7);
    const center = (s) => { const k = Math.floor((7 - s.length) / 2); return k * 6 + (s.length * 6 - 1) / 2; };
    const prevW = bar ? S4[bar - 1][0] : "THIN";
    const m = seg(t, tb, tb + 0.42, E.inOutExpo);
    const P = lerpLog(fitP(prevW), fitP(word), bar ? m : 1) * lerp(1.0, 1.035, seg(t, tb, tb + 2));
    const cx = lerp(center(prevW), center(word), bar ? m : 1), cy = 4;
    frameGrid(cx, cy, P);
    const w = lerp(w0, w1, bar ? E.outCubic(seg(t, tb, tb + 0.5)) : 1);
    const pump = 0.1 * beatPulse(t, 20, 34, 7);
    let lines;
    if (bar < 5 || t < WIPE_T0) lines = bar === 0 ? [pad7(word)] : flapLines([pad7(prevW)], [pad7(word)], t, tb, { stagger: 0.035, min: 4, max: 9, tick: 0.04, all: true });
    else lines = null;
    const wipeX = W * seg(t, WIPE_T0, WIPE_T1, E.inOutCubic) * 1.1 - W * 0.05;
    if (lines) stampLines(lines, 0, 0, { b: 1, x: pump });
    else {
      const from = pad7("ROUND"), to = pad7("PIXEL");
      [...to].forEach((ch, k) => {
        const sx = W / 2 + (k * 6 + 2 - cx) * P;
        const tFlip = WIPE_T0 + clamp((sx + W * 0.05) / (W * 1.1), 0, 1) * (WIPE_T1 - WIPE_T0);
        const c = flapChar(from[k], ch, t, tFlip - 0.08, 5, 0.035);
        stampChar(c, k * 6, 0, 1, pump);
      });
    }
    // dot slider under the word: the axis as a row of dots
    const wk = Math.floor((7 - word.length) / 2) * 6, n = word.length * 6 - 1, sj = 10, axisT = bar < 5 || t < WIPE_T0 ? (w - 100) / 800 : 1 - seg(t, WIPE_T0, WIPE_T1, E.inOutCubic);
    const pos = Math.round(axisT * (n - 1));
    for (let q = 0; q < n; q++) { const d = Math.abs(q - pos); if (d === 0) lit(wk + q, sj, 1, 0.35); else if (q < pos && !(bar >= 5 && t >= WIPE_T0)) lit(wk + q, sj, 0.32); else if (q > pos && bar >= 5 && t >= WIPE_T0) lit(wk + q, sj, 0.32); }
    // beat scan stripe through the unlit lattice
    const stripe = ((t - 20) % BEAT) / BEAT;
    let lens = bar >= 5 && t >= WIPE_T0 - 0.2 && t < WIPE_T1 + 0.3 ? { x: wipeX, y: H / 2, sx: P * 2.2, sy: H, k: 1, grow: 0.5, square: 1 } : { x: W / 2, y: lerp(-H * 0.1, H * 1.1, stripe), sx: W * 3, sy: P * 2.5, k: 0.5, grow: 0, square: 0 };
    if (t < 20.6) lens = { x: W / 2, y: H / 2, sx: W * 3, sy: H * 3, k: Math.exp(-(t - 20) * 7), grow: 0.9, square: 0 };
    const rond = 100;
    const axis = bar >= 5 && t >= WIPE_T0 ? `ROND ${String(Math.round(100 * (1 - seg(t, WIPE_T0, WIPE_T1, E.inOutCubic)))).padStart(3, " ")}` : `WGHT ${Math.round(w)}`;
    return {
      cx, cy, P, st: st({ w, rond, unlitK: 0.42 }), lens, wipe: bar >= 5 && t >= WIPE_T0 ? { x: wipeX, rond: 0 } : null, hud: 1,
      ro: [Math.round(w), bar >= 5 && t >= WIPE_T0 ? Math.round(100 * (1 - seg(t, WIPE_T0, WIPE_T1))) : 100], tag: axis,
    };
  }
  const PANELS = [
    { lines: ["19:45 NEW YORK CITY", "08:45 SHANGHAI", "13:45 HONOLULU", "02:45 ZURICH"], fit: 0.8, w: 500, pal: { bg: "#070707", on: "#F2F1EA", off: "#1E1E1D" }, unlitK: 1, label: "BOARD · WORLD CLOCK" },
    { lines: ["ABCDEFGHIJKLMNOPQRST", "UVWXYZ abcdefghijklm", "nopqrstuvwxyz 012345", "6789 !?&@#$%*+=<>{}"], fit: 0.84, w: 400, pal: { bg: "#08080A", on: "#F2F1EA", off: "#1A1A1C" }, unlitK: 0.6, label: "GLYPHS · 108" },
    { lines: ["↑12"], fit: 0.62, w: 700, pal: { bg: "#0D0605", on: "#FF4B39", off: "#2A120F" }, glow: 1, unlitK: 0.8, label: "LED · ELEVATOR" },
    { lines: ["TRACK 07", "   03:42"], fit: 0.8, w: 400, rond: 40, pal: { bg: "#021010", on: "#8AF5E3", off: "#0A2422" }, glow: 0.8, unlitK: 0.75, label: "VFD · CASSETTE DECK" },
    { lines: ["TOTAL  45.00", "THANK YOU ♥ "], fit: 0.82, w: 300, rond: 0, pal: { bg: "#EEECE4", on: "#141413", off: "#DAD7CE", dim: "#9A978E" }, unlitK: 0.7, label: "THERMAL · RECEIPT" },
    { lines: ["HI 004500", "♥♥♥  LV 07"], fit: 0.8, w: 900, rond: 0, pal: { bg: "#A7B395", on: "#1B2416", off: "#9BA889", dim: "#56604A" }, unlitK: 0.9, label: "LCD · HANDHELD" },
    { lines: ["08:42 ZURICH HB  7", "08:57 BERN      12", "09:04 GENEVE     4"], fit: 0.84, w: 500, pal: { bg: "#0A0804", on: "#FFB23F", off: "#2A1F0D" }, glow: 0.6, unlitK: 0.9, label: "LED · DEPARTURES" },
  ];
  PANELS.forEach((p, k) => {
    const n = Math.max(...p.lines.map((l) => [...l].length));
    p.P = Math.min(1920 * p.fit / (n * 6 - 1), 1080 * 0.62 / (p.lines.length * 10 - 3));
    p.x = k * 420; p.cxL = p.x + (n * 6 - 1) / 2; p.cyL = (p.lines.length * 10 - 4) / 2;
    p.palette = { bg: hex(p.pal.bg), on: hex(p.pal.on), off: hex(p.pal.off), dim: hex(p.pal.dim || p.pal.on) };
  });
  function camBoard(t) {
    const k = clamp(Math.floor((t - 34) / 2), 0, 6);
    const tb = 34 + k * 2;
    if (k > 0 && t < tb + 0.32) {
      const a = PANELS[k - 1], b = PANELS[k], m = E.inOutExpo(clamp((t - (tb - 0.18)) / 0.5, 0, 1));
      return { k, m, cx: lerp(a.cxL, b.cxL, m), cy: lerp(a.cyL, b.cyL, m), P: lerpLog(a.P, b.P, m), from: a, to: b };
    }
    if (t >= tb + 1.82 && k < 6) {
      const a = PANELS[k], b = PANELS[k + 1], m = E.inOutExpo(clamp((t - (tb + 1.82)) / 0.5, 0, 1));
      return { k, m, cx: lerp(a.cxL, b.cxL, m), cy: lerp(a.cyL, b.cyL, m), P: lerpLog(a.P, b.P, m), from: a, to: b };
    }
    const p = PANELS[k], push = lerp(1, 1.04, seg(t, tb, tb + 2));
    return { k, m: 0, cx: p.cxL, cy: p.cyL, P: p.P * push, from: p, to: p };
  }
  function s5(t) { // BOARD 34–48
    const c = camBoard(t), c2 = camBoard(Math.max(34, t - 1 / 60));
    const vx = (c.cx - c2.cx) * c.P * 60;
    frameGrid(c.cx, c.cy, c.P);
    const pump = 0.08 * beatPulse(t, 34, 48, 7);
    PANELS.forEach((p, k) => {
      const tb = 34 + k * 2;
      if (Math.abs(p.x - c.cx) > 600) return;
      const blank = p.lines.map((l) => " ".repeat([...l].length));
      const lines = t < tb + 0.05 && k > 0 ? blank : flapLines(blank, p.lines, t, tb + 0.05, { stagger: 0.028, lag: 0.07, min: 6, max: 13, tick: 0.04 });
      stampLines(lines, p.x, 0, { b: 1, x: pump, rond: p.rond ?? -1 });
    });
    const m = c.m, A = c.from, B = c.to;
    const pal = { bg: mixc(A.palette.bg, B.palette.bg, m), on: mixc(A.palette.on, B.palette.on, m), off: mixc(A.palette.off, B.palette.off, m), dim: mixc(A.palette.dim, B.palette.dim, m) };
    const cur = m < 0.5 ? A : B;
    return {
      cx: c.cx, cy: c.cy, P: c.P, vx,
      st: st({ ...pal, w: lerp(A.w, B.w, m), rond: cur.rond ?? 100, unlitK: lerp(A.unlitK, B.unlitK, m), glow: lerp(A.glow || 0, B.glow || 0, m) }),
      hud: 1, ro: [Math.round(lerp(A.w, B.w, m)), cur.rond ?? 100], tag: cur.label, hudCol: pal.dim,
    };
  }
  const WALL = Object.keys(BM).filter((ch) => ch.trim() && ch !== " " && ch !== "■");
  function s6(t) { // 35 LIGHTS 48–56
    const last = PANELS[6];
    let P, cx, cy;
    const out = seg(t, 48.0, 50.2, E.inOutCubic);
    const dive = seg(t, 50.6, 52.0, E.inOutExpo);
    const centreI = Math.round(last.cxL / 6) * 6, centreJ = 0;
    if (t < 50.6) { P = lerpLog(last.P, 2.7, out); cx = lerp(last.cxL, centreI + 2, out); cy = lerp(last.cyL, centreJ + 3, out); }
    else if (t < 52) { P = lerpLog(2.7, 150, dive); cx = centreI + 2; cy = 3; }
    else {
      const pull = seg(t, 52.0, 52.7, E.inOutExpo);
      P = lerpLog(150, 1920 * 0.84 / 41, pull); cx = centreI + 2; cy = lerp(3, 4, pull);
    }
    frameGrid(cx, cy, P);
    const amber = 1 - seg(t, 48.0, 49.2);
    if (t < 52) {
      const ripple = seg(t, 50.0, 51.0, E.inCubic) * 260;
      const ci = Math.floor(I0 / 6) - 1, cj = Math.floor(J0 / 10) - 1, nci = Math.ceil(NC / 6) + 2, ncj = Math.ceil(NR / 10) + 2;
      for (let gy = cj; gy < cj + ncj; gy++) for (let gx = ci; gx < ci + nci; gx++) {
        const i = gx * 6, j = gy * 10, isCentre = i === centreI && j === centreJ;
        const d = Math.hypot(i + 2 - (centreI + 2), (j + 3 - 3) * 1.1);
        if (isCentre && t >= 50.0) { stampChar("■", i, j, 1, 0.2 * seg(t, 50.8, 51.5)); continue; }
        if (d < ripple - 6) continue;
        const inPanel = gy >= 0 && gy < 3 && gx * 6 >= last.x && gx * 6 < last.x + 108;
        let ch;
        if (inPanel) { ch = [...last.lines[gy]][gx - last.x / 6] || " "; }
        else { const roll = Math.floor(t * 9 + hash(gx, gy, 3) * 20); ch = WALL[Math.floor(hash(gx, gy, roll % 4 === 0 ? roll : 0) * WALL.length)]; }
        const flash = d < ripple && d > ripple - 6 ? 1.5 : 0;
        stampChar(ch, i, j, inPanel ? 1 : 0.38 + flash * 0.4, flash * 0.3, inPanel && amber > 0.3 ? 1 : 0);
      }
    } else {
      // the 35-light cell splits into seven, they step out along the lattice, then each one
      // drops the dots its letter does not need — centre first, outward on the beat
      const B = centreI - 18, fly = E.outExpo(seg(t, 52.1, 52.75)), pump = 0.35 * beatPulse(t, 55.0, 56, 6);
      [...WORD].forEach((ch, i) => {
        const col = Math.round(lerp(B + 18, B + 6 * i, fly)), bm = BM[ch], tr = S6_RES[i];
        const land = t >= 52.75 ? 0.3 * Math.exp(-(t - 52.75) * 8) : 0;
        for (let y = 0; y < 7; y++) for (let q = 0; q < 5; q++) {
          const keep = bm[y][q] === "#";
          if (!keep && t >= tr + hash(i, y * 5 + q, 9) * 0.2) continue;
          const x = keep && t >= tr ? 0.5 * Math.exp(-(t - tr) * 7) : t >= tr ? 0.1 : land;
          lit(col + q, y, 1, x + pump);
        }
      });
    }
    let lens = null;
    if (t >= 52.9 && t < 56) { // a squaring lens that opens from the C outward with the resolve wave, then lets go
      const open = seg(t, 52.9, 54.8, E.inOutCubic);
      lens = { x: W / 2 + (centreI + 2 - cx) * P, y: H / 2 + (3 - cy) * P, sx: P * lerp(2.5, 26, open), sy: P * lerp(4.5, 7, open), k: seg(t, 52.9, 53.1) * (1 - seg(t, 54.9, 55.6, E.inOutCubic)), grow: 0.08, square: 1 };
    }
    const pal = { bg: mixc(INK.bg, last.palette.bg, amber), on: INK.on, on2: last.palette.on, off: mixc(INK.off, last.palette.off, amber), dim: INK.dim };
    return {
      cx, cy, P, lens, st: st({ ...pal, w: t < 52 ? 500 : 560, unlitK: t < 50.6 ? 0.55 : 0.45, glow: 0.6 * amber, offAlpha: t < 52 ? lerp(1, 0.5, seg(t, 49, 50)) : 1 }), hud: 1,
      ro: [t < 52 ? 500 : 560, 100], tag: t < 52 && t >= 50.6 ? "35 LIGHTS" : null,
    };
  }
  function s7(t) { // PUNCTUM 56–60
    const P0 = 1920 * 0.84 / 41, fin = seg(t, 58.3, 59.7, E.inOutCubic);
    const P = lerpLog(P0 * lerp(1, 1.035, seg(t, 56, 58.3, E.outCubic)), P0 * 3.2, fin);
    const cx = lerp(20, 2, fin), cy = lerp(lerp(4, 5.2, seg(t, 56.05, 56.7, E.inOutCubic)), 3, fin); // word rises as the subtitle flips in
    frameGrid(cx, cy, P);
    const w = lerp(560, 700, E.outExpo(seg(t, 56, 56.4)));
    const hit = 0.5 * Math.exp(-(t - 56) * 5);
    const fadeAll = seg(t, 58.4, 59.0);
    const one = 1 - seg(t, 59.3, 59.75);
    [...WORD].forEach((ch, ci) => {
      const bm = BM[ch];
      for (let y = 0; y < 9; y++) for (let q = 0; q < 5; q++) if (bm[y][q] === "#") {
        const keep = ci === 0 && q === 2 && y === 3; // the first light of the film
        const b = keep ? (t < 59.0 ? 1 : one) : 1 - fadeAll;
        if (b > 0.02) lit(ci * 6 + q, y, b, hit + (keep && fadeAll > 0.5 ? 0.15 : 0));
      }
    });
    const blank = (s) => " ".repeat(s.length);
    const l1 = "VARIABLE DOT-MATRIX TYPEFACE", l2 = "WGHT 100-900 · ROND 0-100 · 108 GLYPHS";
    return {
      cx, cy, P, st: st({ w, unlitK: 0.42, offAlpha: 1 - seg(t, 58.6, 59.8) }), hud: 1 - fadeAll, ro: [Math.round(w), 100],
      extra: (ctx) => {
        const a = 1 - fadeAll;
        if (a <= 0) return;
        const p = 5, y = H / 2 + (11 - cy) * P;
        hudText(ctx, flapLines([blank(l1)], [l1], t, 56.3, { stagger: 0.012, min: 4, max: 8, tick: 0.035 })[0], W / 2, y, p, INK.on, "center", a);
        hudText(ctx, flapLines([blank(l2)], [l2], t, 56.6, { stagger: 0.012, min: 4, max: 8, tick: 0.035 })[0], W / 2, y + 12 * p, 3.4, INK.dim, "center", a);
      },
    };
  }

  /* ── grain (seeded, deterministic) ─────────────────────────── */
  let grain = null;
  function makeGrain() {
    const c = document.createElement("canvas"); c.width = 512; c.height = 512;
    const g = c.getContext("2d"), im = g.createImageData(512, 512);
    for (let i = 0; i < 512 * 512; i++) { const v = hash(i, 7) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); grain = c;
  }

  function draw(ctx, T) {
    T = clamp(T, 0, LEN - 0.001);
    const t = srcOf(T);
    const F = T < 2 ? s1(t) : T < 4 ? s2b(t) : t < 20 ? s3(t) : t < 34 ? s4(t) : t < 48 ? s5(t) : t < 56 ? s6(t) : s7(t);
    render(ctx, F);
    if (F.extra) F.extra(ctx, F);
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${F.st.bg[0] > 120 ? 0.18 : 0.5})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // HUD
    if (F.hud > 0) {
      const col = F.hudCol || F.st.dim || INK.dim, a = F.hud * 0.9, p = 3;
      const sec = SECTIONS.filter((s) => T >= s[0]).pop()[1];
      const fr = Math.floor(T * 60), tc = `00:${String(Math.floor(T)).padStart(2, "0")}:${String(fr % 60).padStart(2, "0")}`;
      hudText(ctx, "PUNCTUM", 64, 54, p, col, "left", a);
      hudText(ctx, tc, W - 64, 54, p, col, "right", a);
      hudText(ctx, sec, 64, H - 54 - 7 * p, p, col, "left", a);
      hudText(ctx, F.tag || `WGHT ${F.ro[0]}  ROND ${F.ro[1]}`, W - 64, H - 54 - 7 * p, p, col, "right", a);
    }
    if (!grain) makeGrain();
    ctx.globalAlpha = F.st.bg[0] > 120 ? 0.05 : 0.035; ctx.globalCompositeOperation = "overlay";
    const ox = Math.floor(hash(Math.floor(T * 24), 1) * 512), oy = Math.floor(hash(Math.floor(T * 24), 2) * 512);
    ctx.fillStyle = ctx.createPattern(grain, "repeat"); ctx.save(); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  window.createPunctumFilm = () => ({ draw });
})();

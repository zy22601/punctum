/* PUNCTUM PREMIERE — director / scene model.
 * frame(t) → { cam, n, inst, quads, floor, fog, light, post, hud } ; a pure function of t (no state carried between frames).
 * World unit = 1 dot pitch of the main type. 120 bpm: beat 0.5 s, bar 2 s. Runs in the browser and in node (events export). */
(function () {
  const PB = globalThis.PB;
  const LEN = 80;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ss = (u) => u * u * (3 - 2 * u), eio = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const eout = (u) => 1 - Math.pow(1 - u, 3), ein = (u) => u * u * u, expo = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
  const eioExpo = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2);
  function hash(i, j = 0, k = 0) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
  function pw(w, pts) { for (let i = 1; i < pts.length; i++) if (w <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return lerp(va, vb, (w - a) / (b - a)); } return pts[pts.length - 1][1]; }
  /* the font's own dot geometry: half-size (in pitch) for wght/ROND */
  const dotR = (w, r) => lerp(pw(w, [[100, 0.11], [400, 0.27], [900, 0.5]]), pw(w, [[100, 0.12], [400, 0.3], [900, 0.5]]), r / 100) * 0.94;
  const UNLIT = 0.21;
  const glyph = (ch) => PB[ch] || PB[" "];
  const on = (ch, c, r) => { const g = glyph(ch); return r < 9 && c < 5 && g[r][c] === "#"; };

  /* palettes */
  const C = { warm: [1.0, 0.86, 0.68], white: [1, 0.95, 0.88], led: [1.0, 0.12, 0.06], vfd: [0.25, 1.0, 0.82], amber: [1.0, 0.55, 0.08], lcdInk: [0.05, 0.07, 0.04], ink: [0.03, 0.03, 0.035] };

  /* ── instance buffer ── */
  let buf = new Float32Array(16 * 300000), n = 0;
  function push(cx, cy, cz, ux, uy, uz, rond, vx, vy, vz, E, r, g, b, kind) {
    if (n * 16 + 16 > buf.length) { const nb = new Float32Array(buf.length * 2); nb.set(buf); buf = nb; }
    const o = n * 16; buf[o] = cx; buf[o + 1] = cy; buf[o + 2] = cz; buf[o + 3] = 0;
    buf[o + 4] = ux; buf[o + 5] = uy; buf[o + 6] = uz; buf[o + 7] = rond;
    buf[o + 8] = vx; buf[o + 9] = vy; buf[o + 10] = vz; buf[o + 11] = E;
    buf[o + 12] = r; buf[o + 13] = g; buf[o + 14] = b; buf[o + 15] = kind; n++;
  }
  /* a dot at world p with in-plane axes ex/ey (unit), half size h */
  function dot(p, ex, ey, h, rond, E, col, kind = 0) { push(p[0], p[1], p[2], ex[0] * h, ex[1] * h, ex[2] * h, rond, ey[0] * h, ey[1] * h, ey[2] * h, E, col[0], col[1], col[2], kind); }
  function panel(c, ex, ey, hw, hh, col, E = 0, corner = 0.15) { push(c[0], c[1], c[2], ex[0] * hw, ex[1] * hw, ex[2] * hw, corner, ey[0] * hh, ey[1] * hh, ey[2] * hh, E, col[0], col[1], col[2], 1); }

  /* a text frame: origin = top-left dot of cell 0, ex = writing direction, ey = up, p = pitch */
  const TF = (o, ex = [1, 0, 0], ey = [0, 1, 0], p = 1) => ({ o, ex: norm(ex), ey: norm(ey), n: norm(cross(ex, ey)), p });
  const at = (F, c, r, z = 0) => [F.o[0] + (F.ex[0] * c - F.ey[0] * r) * F.p + F.n[0] * z, F.o[1] + (F.ex[1] * c - F.ey[1] * r) * F.p + F.n[1] * z, F.o[2] + (F.ex[2] * c - F.ey[2] * r) * F.p + F.n[2] * z];

  /* text: opts { w, r (0-100), E (num | fn(i,c,r)), col, unlit (bool), uk (unlit E), rows (10), gapCol (true), size fn } */
  function text(F, str, o = {}) {
    const w = o.w ?? 400, R = o.r ?? 100, chars = [...str], rows = o.rows ?? 10, unlit = o.unlit ?? true;
    const hl = dotR(w, R) * F.p, hu = Math.min(UNLIT, dotR(400, R)) * F.p, rond = R / 100, col = o.col || C.warm, kind = o.kind ?? 0;
    const ucol = o.ucol || col, uE = o.uE ?? 0, ukind = o.ukind ?? kind;
    for (let i = 0; i < chars.length; i++) {
      const g = glyph(chars[i]);
      for (let r = 0; r < rows; r++) for (let c = 0; c < 6; c++) {
        const lit = c < 5 && r < 9 && g[r][c] === "#";
        if (lit) {
          const E = typeof o.E === "function" ? o.E(i, c, r) : (o.E ?? 2.2);
          if (E === null) continue;
          const s = o.size ? o.size(i, c, r) : 1;
          dot(at(F, i * 6 + c, r, 0.02), F.ex, F.ey, hl * s, o.rondFn ? o.rondFn(i, c, r) : rond, E, col, kind);
        } else if (unlit && (c < 5 || o.gapCol !== false) && r < rows) dot(at(F, i * 6 + c, r), F.ex, F.ey, hu, rond, uE, ucol, ukind);
      }
    }
  }
  function lattice(F, c0, c1, r0, r1, h = UNLIT, rond = 1, skip = null) {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { if (skip && skip(c, r)) continue; dot(at(F, c, r), F.ex, F.ey, h * F.p, rond, 0, C.warm); }
  }
  function floorDots(cx, cz, ext, pitch = 1.5, y = 0, h = 0.2) {
    const x0 = Math.floor((cx - ext) / pitch), x1 = Math.ceil((cx + ext) / pitch), z0 = Math.floor((cz - ext) / pitch), z1 = Math.ceil((cz + ext) / pitch);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) push(i * pitch, y + 0.001, k * pitch, h, 0, 0, 1, 0, 0, -h, 0, 1, 1, 1, 0);
  }

  /* split-flap module: chars change per seq [[t, ch], ...]; F origin = cell top-left, cell 6×10 */
  const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/";
  function flapState(seq, t, dur) {
    let k = 0; for (let i = 1; i < seq.length; i++) if (t >= seq[i][0]) k = i;
    const B = seq[k][1], A = k > 0 ? seq[k - 1][1] : B, u = k > 0 ? clamp((t - seq[k][0]) / dur, 0, 1) : 1;
    return { A, B, u };
  }
  function rollSeq(from, to, t0, step = 0.055, minSteps = 0) {
    const seq = [[-1e9, from]]; if (from === to && !minSteps) return seq;
    let a = DRUM.indexOf(from.toUpperCase()), b = DRUM.indexOf(to.toUpperCase()); if (a < 0) a = 0; if (b < 0) { seq.push([t0, to]); return seq; }
    let steps = (b - a + DRUM.length) % DRUM.length; if (steps < minSteps) steps += DRUM.length; if (steps > 14) { a = (b - 14 + DRUM.length) % DRUM.length; steps = 14; }
    for (let s = 1; s <= steps; s++) seq.push([t0 + (s - 1) * step, s === steps ? to : DRUM[(a + s) % DRUM.length]]);
    return seq;
  }
  function flapModule(F, seq, t, o = {}) {
    const dur = o.dur ?? 0.12, { A, B, u } = flapState(seq, t, dur);
    const w = o.w ?? 520, R = o.r ?? 100, hl = dotR(w, R) * F.p, hu = Math.min(UNLIT, dotR(400, R)) * F.p, rond = R / 100;
    const col = o.col || C.warm, E = o.E ?? 2.0, card = o.card || [0.028, 0.028, 0.03], p = F.p;
    const H = at(F, 0, 4.5 + 0.5 - 0.5, 0); // hinge line height: between rows 4 and 5 → y offset -(4.5)p from row-0 centre... (row r centre at -r)
    const hinge = [F.o[0] - F.ey[0] * 4.5 * p, F.o[1] - F.ey[1] * 4.5 * p, F.o[2] - F.ey[2] * 4.5 * p];
    const half = (ch, top, th, back) => {
      const c = Math.cos(th), s = Math.sin(th);
      const d = [F.ey[0] * c + F.n[0] * s, F.ey[1] * c + F.n[1] * s, F.ey[2] * c + F.n[2] * s];
      const nt = [F.n[0] * c - F.ey[0] * s, F.n[1] * c - F.ey[1] * s, F.n[2] * c - F.ey[2] * s];
      const V = back ? mul(d, -1) : d, nn = back ? mul(nt, -1) : nt;
      // card
      const cc = add(add(hinge, mul(F.ex, 2 * p)), add(mul(d, 2.5 * p), mul(nn, -0.012)));
      panel(cc, F.ex, V, 2.95 * p, 2.47 * p, card, 0, 0.12);
      const g = glyph(ch), r0 = top ? 0 : 5, r1 = top ? 4 : 9;
      for (let r = r0; r <= r1; r++) for (let cI = 0; cI < 5; cI++) {
        const sAlong = top ? (4.5 - r) * p : (r - 4.5) * p;
        const pos = add(add(add(hinge, mul(F.ex, cI * p)), mul(d, sAlong)), mul(nn, 0.03));
        const lit = r < 9 && g[r][cI] === "#";
        dot(pos, F.ex, V, lit ? hl : hu, rond, lit ? (typeof E === "function" ? E(r, cI) : E) : 0, col);
      }
    };
    const fall = Math.PI * Math.min(1, Math.pow(u, 1.7));
    if (u >= 1) { half(B, true, 0, false); half(B, false, Math.PI, true); return; }
    half(B, true, 0, false);              // new top revealed behind the flap
    half(A, false, Math.PI, true);        // old bottom until the flap lands
    if (fall < Math.PI / 2) half(A, true, fall, false); else half(B, false, fall, true);
  }

  /* camera spline: keys [t, pos, tgt, fov, focusOffset?] → Hermite through keys (C1) */
  function camSpline(keys, t) {
    if (t <= keys[0][0]) return keys[0]; if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1];
    let i = 0; while (t > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const dt = k2[0] - k1[0], u = (t - k1[0]) / dt, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const tan = (a, b, c, j, ta, tb) => (b === a || c === b) ? 0 : 0;
    const comp = (j, f) => {
      const p1 = f(k1), p2 = f(k2), p0 = f(k0), p3 = f(k3);
      const m1 = k1 === k0 ? 0 : (p2 - p0) / (k2[0] - k0[0]) * dt, m2 = k3 === k2 ? 0 : (p3 - p1) / (k3[0] - k1[0]) * dt;
      return h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2;
    };
    const pos = [0, 1, 2].map((j) => comp(j, (k) => k[1][j])), tgt = [0, 1, 2].map((j) => comp(j, (k) => k[2][j]));
    return [t, pos, tgt, comp(0, (k) => k[3]), k1[4] !== undefined ? comp(0, (k) => k[4] ?? 0) : 0];
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function cam(pos, tgt, fov, o = {}) { return { pos, tgt, fov, focus: o.focus ?? dist(pos, tgt), aperture: o.ap ?? 6, maxCoc: o.maxCoc ?? 20, roll: o.roll || 0, near: o.near ?? 0.05, far: o.far ?? 900 }; }

  /* ── events for the score (filled once at load) ── */
  const EV = [];
  const ev = (t, type, a = {}) => EV.push({ t: +t.toFixed(4), type, ...a });

  /* ═════════════ SCENES ═════════════ */
  const HOOK = (() => { // 35 dots of the 5×7 cell fire in accelerating order, resolve to P at 1.5
    const order = []; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) order.push([c, r, hash(c, r, 9)]);
    order.sort((a, b) => a[2] - b[2]);
    // start from the P's bowl-top dot so frame one is lit
    const i0 = order.findIndex((o) => o[0] === 1 && o[1] === 0); const f = order.splice(i0, 1)[0]; order.unshift(f);
    return order.map(([c, r], k) => ({ c, r, tk: 1.42 * Math.pow(k / 34, 0.6) }));
  })();
  HOOK.forEach((d) => ev(d.tk, "ping", { row: d.r, col: d.c, p: on("P", d.c, d.r) ? 1 : 0 }));
  ev(1.5, "resolve");

  function sHook(t) {
    const F = TF([-2, 7, 0]);
    const resolve = seg(t, 1.5, 1.62);
    const map = new Map(HOOK.map((d) => [d.c * 10 + d.r, d.tk]));
    for (let r = -3; r <= 11; r++) for (let c = -6; c <= 10; c++) {
      const inCell = c >= 0 && c < 5 && r >= 0 && r < 7;
      if (!inCell) { dot(at(F, c, r), F.ex, F.ey, UNLIT, 1, 0, C.warm); continue; }
      const tk = map.get(c * 10 + r), isP = on("P", c, r);
      let E = 0; if (t >= tk) { E = (tk < 0.01 ? 2.2 : 5.0) * Math.exp(-(t - tk) * 9) + 1.3; if (!isP) E *= 1 - resolve; else E += 1.6 * resolve + 3 * Math.exp(-Math.max(0, t - 1.5) * 6) * (t >= 1.5 ? 1 : 0); }
      const h = E > 0.02 ? dotR(520, 100) : UNLIT;
      dot(at(F, c, r, 0.02), F.ex, F.ey, h, 1, E, C.warm);
    }
    floorDots(0, 0, 40, 1.0, 0, 0.18);
    // camera: macro on the first dot → rocket back
    const first = at(F, 1, 0), mid = at(F, 2, 3.2);
    const u = eioExpo(seg(t, 0.0, 1.55));
    const d = lerp(2.4, 15, Math.pow(u, 1.0)) + (t > 1.55 ? -(t - 1.55) * 2.2 : 0);
    const tgt = lerp3(first, mid, eio(seg(t, 0.05, 1.4)));
    const ang = lerp(0.55, -0.12, eio(seg(t, 0, 2))), el = lerp(0.05, 0.12, u);
    const pos = add(tgt, [Math.sin(ang) * d, Math.sin(el) * d, Math.cos(ang) * d]);
    return { cam: cam(pos, tgt, lerp(24, 34, u), { ap: lerp(18, 9, u), maxCoc: 26 }), floor: { y: 0, refl: 0.65, blur: 1.2 },
      fog: { d: 0.02, col: [0, 0, 0] }, post: { bloom: 0.5, flash: 0.06 * Math.exp(-t * 14) + 0.1 * Math.exp(-Math.max(0, t - 1.5) * 9) * (t >= 1.5 ? 1 : 0), exposure: 1.0 }, sect: "ONE LIGHT", ax: [520, 100] };
  }

  /* TITLE 2–8 */
  const T_WORD = "PUNCTUM", T_SUB = "35 LIGHTS PER LETTER";
  const PH0 = 4.0, PHS = 0.0625; // playhead column step (1/32 note)
  for (let c = 0; c < 41; c++) { const ch = T_WORD[Math.floor(c / 6)], cc = c % 6; const rows = []; for (let r = 0; r < 9; r++) if (cc < 5 && on(ch, cc, r)) rows.push(r); if (rows.length) ev(PH0 + c * PHS, "note", { rows, col: c }); }
  ev(6.0, "roll", { n: 20, dur: 0.9 });
  function sTitle(t) {
    const F = TF([-20.5, 10, 0]);
    const slam = Math.exp(-(t - 2) * 5);
    const kick = t >= 4 ? Math.exp(-((t - 4) % 0.5) * 7) : 0;
    const ph = (t - PH0) / PHS;
    text(F, T_WORD, { w: 560 + 120 * kick, E: (i, c, r) => { const col = i * 6 + c; const hit = ph >= col && ph < 46 ? Math.exp(-(ph - col) * PHS * 10) * 5 : 0; return 2.3 + 4.5 * slam + hit; } });
    lattice(F, -14, 54, -6, -1); lattice(F, -14, -1, 0, 9); lattice(F, 42, 54, 0, 9);
    // subtitle flaps in
    const S = TF([-17.85, 2.6, 0.4], [1, 0, 0], [0, 1, 0], 0.3);
    const subChars = [...T_SUB].map((ch, i) => { const t0 = 6.0 + i * 0.035; if (t < t0) return " "; const k = Math.floor((t - t0) / 0.04); return k >= 8 ? ch : DRUM[(DRUM.indexOf(ch) - 8 + k + DRUM.length * 2) % DRUM.length] || ch; }).join("");
    text(S, subChars, { w: 500, E: 2.0, unlit: true });
    floorDots(0, 0, 70, 1.25, 0, 0.17);
    const K = [[2.0, [-40, 1.8, 34], [-3, 6.5, 0], 36], [4.6, [12, 3.0, 44], [1, 6, 0], 34], [6.6, [2, 6.0, 50], [0, 5.5, 0], 32], [7.45, [-1.5, 7.0, 26], [-2.5, 7, 0], 30], [8.0, [-2.3, 7.05, 1.2], [-2.5, 7.0, 0], 24]];
    const k = camSpline(K, t);
    const dive = seg(t, 7.55, 8.0);
    return { cam: cam(k[1], k[2], k[3], { ap: lerp(7, 30, dive), maxCoc: 24 }), floor: { y: 0, refl: 0.75, blur: 1.4 }, fog: { d: 0.012, col: [0, 0, 0] },
      post: { bloom: 0.5, flash: 0.18 * slam * (t < 2.4 ? 1 : 0), exposure: 1 + dive * 0.5 }, sect: "PUNCTUM", ax: [Math.round(560 + 120 * kick), 100] };
  }

  /* COUNTDOWN 8–16: wall of 3D split-flap pairs, 16 → 01 one per beat */
  const CD = { cols: 13, rows: 9, gx: 15, gy: 12.5 };
  for (let b = 1; b < 16; b++) ev(8 + b * 0.5, "flap", { n: 30 + b * 8 });
  ev(15.75, "black");
  function sCountdown(t) {
    const b = clamp(Math.floor((t - 8) / 0.5), 0, 15), num = (k) => String(clamp(k, 1, 99)).padStart(2, "0");
    const black = t >= 15.75;
    for (let gy = 0; gy < CD.rows; gy++) for (let gx = 0; gx < CD.cols; gx++) {
      const dx = gx - 6, dy = gy - 4, dd = Math.hypot(dx, dy * 1.2), centre = dx === 0 && dy === 0;
      if (black && !centre) continue;
      const delay = dd * 0.045;
      const ox = dx * CD.gx - 6, oy = 26 - dy * CD.gy + 3;
      for (let digit = 0; digit < 2; digit++) {
        const seq = [[-1e9, num(16)[digit]]];
        for (let k = 1; k <= 15; k++) seq.push([8 + k * 0.5 + delay, num(16 - k)[digit]]);
        const F = TF([ox + digit * 6.6, oy, 0]);
        flapModule(F, seq, t, { w: 560, E: centre ? 2.6 : 1.5, dur: 0.14 });
      }
      panel([ox + 5.8, oy - 4.5, -0.25], [1, 0, 0], [0, 1, 0], 7.0, 5.6, [0.012, 0.012, 0.013], 0, 0.06);
    }
    floorDots(0, 0, 90, 1.6, -30, 0.2);
    // camera steps out one notch per beat (expo snap), alternating yaw
    const fr = clamp((t - 8) / 0.5 - b, 0, 1), zs = b + expo(clamp(fr / 0.35, 0, 1));
    const d = 6.5 * Math.pow(1.19, zs), yaw = 0.42 * Math.sin(zs * 0.9) * Math.exp(-zs * 0.08), pitch = 0.18 + 0.03 * Math.sin(zs);
    const tgt = [0.3, 26 - 4.5, 0];
    const pos = add(tgt, [Math.sin(yaw) * d, Math.sin(pitch) * d, Math.cos(yaw) * d]);
    const fl = b > 0 && fr < 0.2 ? 0.12 * (1 - fr / 0.2) : 0;
    return { cam: cam(pos, tgt, 32, { ap: 7, maxCoc: 22 }), floor: null, fog: { d: 0.004, col: [0, 0, 0] },
      light: { key: [-0.4, 0.9, 0.35], keyCol: [1.2, 1.15, 1.1], amb: [0.03, 0.03, 0.035] },
      post: { bloom: 0.6, flash: fl, exposure: black ? 1.0 : 1.0 }, sect: "COUNTDOWN", ax: [560, 100], tag: `T-${num(16 - b)}` };
  }

  /* DESIGN SPACE 16–26 */
  const WEIGHTS = [[16.0, "THIN", 100], [16.5, "LIGHT", 250], [17.0, "REGULAR", 400], [17.5, "BOLD", 700], [18.0, "BLACK", 900]];
  WEIGHTS.forEach(([t0], i) => ev(t0, "weight", { i }));
  ev(18.5, "lens");
  const PAD = [[20.3, 400, 100], [21.2, 100, 100], [22.3, 900, 100], [23.2, 900, 0], [24.1, 400, 0], [25.0, 640, 55], [25.6, 900, 100]];
  ev(20.25, "click"); ev(25.0, "release");
  function padAt(t) { if (t <= PAD[0][0]) return [400, 100]; for (let i = 1; i < PAD.length; i++) if (t < PAD[i][0]) { const u = eio(seg(t, PAD[i - 1][0], PAD[i][0])); return [lerp(PAD[i - 1][1], PAD[i][1], u), lerp(PAD[i - 1][2], PAD[i][2], u)]; } return [900, 100]; }
  function sDesign(t) {
    const out = { floor: { y: 0, refl: 0.7, blur: 1.4 }, fog: { d: 0.01, col: [0, 0, 0] }, post: { bloom: 0.7 } };
    if (t < 20) {
      let k = 0; WEIGHTS.forEach((w, i) => { if (t >= w[0]) k = i; });
      const [t0, word, wg] = WEIGHTS[k];
      const kickE = Math.exp(-(t - t0) * 8);
      if (t < 18.5) {
        const F = TF([-word.length * 3 + 0.5, 9.5, 0], [1, 0, 0], [0, 1, 0], 1.25);
        text(F, word, { w: wg, E: 2.4 + 3 * kickE });
        lattice(F, -10, word.length * 6 + 9, -4, -1); lattice(F, -10, -1, 0, 9); lattice(F, word.length * 6, word.length * 6 + 9, 0, 9);
        // weight scale: 9 beads along the floor front, current one lit
        for (let i = 0; i < 9; i++) { const w = 100 + i * 100, cur = Math.abs(w - wg) < 60; dot([-8 + i * 2, 0.6, 6], [1, 0, 0], [0, 1, 0], dotR(w, 100) * 0.9, 1, cur ? 3.5 : 0.25, C.warm); }
        out.post.flash = 0.06 * kickE;
        out.ax = [wg, 100];
      } else {
        // ROUND → PIXEL: a glass lens sweeps left→right, squaring dots and flipping letters
        const word0 = "ROUND", word1 = "PIXEL";
        const F = TF([-14.5, 9.5, 0], [1, 0, 0], [0, 1, 0], 1.25);
        const lx = lerp(-6, 35, eio(seg(t, 18.55, 19.75)));
        const chars = [...word0].map((ch, i) => { const cx = i * 6 + 2.5; return lx > cx ? word1[i] : ch; }).join("");
        text(F, chars, { w: 820, E: (i, c, r) => { const x = i * 6 + c; return 2.4 + 4 * Math.exp(-Math.abs(x - lx) * 0.6); },
          rondFn: (i, c, r) => { const x = i * 6 + c; return clamp((x - lx) / 3 + 0.5, 0, 1); }, size: (i, c, r) => { const x = i * 6 + c; return 1 + 0.35 * Math.exp(-Math.pow((x - lx) / 2.2, 2)); } });
        lattice(F, -10, 39, -4, -1); lattice(F, -10, -1, 0, 9); lattice(F, 30, 39, 0, 9);
        // the lens: a tall faint glass bar
        out.ax = [820, Math.round(clamp(100 - (lx + 6) * 2.5, 0, 100))];
      }
      floorDots(0, 0, 70, 1.25, 0, 0.17);
      const K = t < 18.5 ? [[16, [0, 8, 34], [0, 7.5, 0], 30], [18.5, [3, 7.5, 30], [0.5, 7.2, 0], 30]] : [[18.5, [-10, 9, 21], [-3, 7.2, 0], 34], [20, [12, 7.5, 22], [5, 7.2, 0], 34]];
      const kc = camSpline(K, t);
      out.cam = cam(kc[1], kc[2], kc[3], { ap: 5 });
      out.sect = t < 18.5 ? "WEIGHT" : "SHAPE";
      return out;
    }
    // THE PAD 20–26: 9×6 sample beads on a tilted table, a cursor drags; a giant Rag5 follows
    const [w, r] = padAt(t);
    const PADO = [-8, 1.2, 6], pex = [1, 0, 0], pey = norm([0, 0.45, -1]);
    const PF = TF(PADO, pex, pey, 1.5);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) {
      const sw = 100 + i * 100, sr = 100 - j * 20, near = Math.hypot((sw - w) / 100, (sr - r) / 20);
      const E = 0.35 + 3.2 * Math.exp(-near * near * 1.2);
      dot(at(PF, i, j, 0.02), PF.ex, PF.ey, dotR(sw, sr) * 1.5 * 0.9, sr / 100, E, C.warm);
    }
    panel(at(PF, 4, 2.5, -0.05), PF.ex, PF.ey, 7.8, 5.2, [0.02, 0.02, 0.022], 0, 0.04);
    const W = TF([-11.5, 15.5, -6], [1, 0, 0], [0, 1, 0], 1.0);
    text(W, "Rag5", { w, r, E: 2.6 });
    lattice(W, -8, 31, -4, -1); lattice(W, -8, -1, 0, 9); lattice(W, 24, 31, 0, 9);
    const RO = TF([-8.6, 4.4, -6], [1, 0, 0], [0, 1, 0], 0.26);
    text(RO, `WGHT ${String(Math.round(w)).padStart(3, " ")}   ROND ${String(Math.round(r)).padStart(3, " ")}`, { w: 500, E: 1.8 });
    // cursor (3D arrow quad) rides over the pad
    const cp = at(PF, (w - 100) / 100, (100 - r) / 20, 0.6 + (t > 20.25 && t < 25.0 ? 0 : 0.5));
    out.cursor = { p: cp, s: 1.1 };
    floorDots(0, 0, 70, 1.25, 0, 0.17);
    const K = [[20, [-24, 11, 40], [-1, 8, 0], 34], [22.5, [-2, 17, 40], [0, 7.5, 0], 34], [25, [20, 10, 38], [1, 8, 0], 34], [26, [26, 8, 32], [2, 8, 0], 34]];
    const k = camSpline(K, t);
    out.cam = cam(k[1], k[2], k[3], { ap: 4 });
    out.sect = "AXES"; out.ax = [Math.round(w), Math.round(r)];
    return out;
  }

  /* GLYPH AVENUE 26–34: 108 glyphs as standing panels lining a street; fly through, arrive at g */
  const SET = Object.keys(PB).filter((c) => c !== " ");
  const AV = SET.map((ch, i) => { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2); return { ch, x: side * 7.5, z: -k * 9, side }; });
  const G_IDX = SET.indexOf("g");
  ev(26, "avenue"); ev(31.5, "arrive"); for (let r = 0; r < 9; r++) for (let c = 0; c < 5; c++) if (on("g", c, r)) ev(32.0 + (r * 5 + c) * 0.035, "ping", { row: r, col: c, p: 1 });
  function sGlyphs(t) {
    const camZ = lerp(30, -440, eio(seg(t, 26.0, 31.4)));
    for (const g of AV) {
      if (g.z > camZ + 30 || g.z < camZ - 260) continue;
      const ex = rotY([1, 0, 0], g.side * 0.42), F = TF(add([g.x, 11.5, g.z], mul(ex, -2.5 * 1.0)), ex, [0, 1, 0], 1.0);
      const pass = clamp(1 - Math.abs(g.z - camZ + 14) / 40, 0, 1);
      text(F, g.ch, { w: 560, E: 2.2 + 2.5 * pass });
      lattice(F, -1, 6, -1, -1); lattice(F, -1, -1, 0, 10); lattice(F, 6, 6, 0, 10); lattice(F, -1, 6, 10, 10);
      panel(at(F, 2.5, 4.5, -0.1), F.ex, F.ey, 4.2, 6.2, [0.016, 0.016, 0.018], 0, 0.05);
    }
    floorDots(0, camZ - 60, 90, 1.5, 0, 0.17);
    const out = { floor: { y: 0, refl: 0.8, blur: 1.2 }, fog: { d: 0.012, col: [0, 0, 0] }, post: { bloom: 0.75 }, sect: "GLYPHS", ax: [520, 100] };
    if (t < 31.4) {
      const sway = Math.sin(t * 1.7) * 1.2;
      out.cam = cam([sway, 10 + Math.sin(t * 1.1) * 0.8, camZ], [sway * 0.3, 6.5, camZ - 34], 50, { ap: 4 });
      return out;
    }
    // 'g': the last glyph pulls out of its row to face us, then its dots play in reading order
    const gx = 0, gz = -530;
    const F = TF([gx - 3 * 2.0, 18, gz], [1, 0, 0], [0, 1, 0], 2.0);
    text(F, "g", { w: 560, E: (i, c, r) => { const k = r * 5 + c, tk = 32.0 + k * 0.035; return t < tk ? 0.6 : 2.4 + 5 * Math.exp(-(t - tk) * 6); } });
    lattice(F, -4, 9, -3, -1); lattice(F, -4, -1, 0, 12); lattice(F, 6, 9, 0, 12); lattice(F, -4, 9, 10, 12);
    const u = eio(seg(t, 31.4, 33.0));
    const pos = lerp3([0, 10, -440], [2, 11, gz + 34], u), tgt = lerp3([0, 6.5, -474], [-2, 10, gz], u);
    out.cam = cam(add(pos, [0, 0, -(t - 33) * 2 * (t > 33 ? 1 : 0)]), tgt, lerp(46, 34, u), { ap: 6 });
    out.post.whip = t > 33.75 ? [0.08 * eio(seg(t, 33.75, 34)), 0] : [0, 0];
    return out;
  }

  /* MATERIALS 34–44: five display technologies, whip pans */
  const MATS = [
    { t0: 34, name: "LED", lines: ["↑12"], col: C.led, pitch: 1.0, w: 700, r: 100, look: "led" },
    { t0: 36, name: "VFD", lines: ["TRACK 07", "  03:42"], col: C.vfd, pitch: 0.55, w: 480, r: 100, look: "vfd" },
    { t0: 38, name: "AMBER", lines: ["08:42 ZURICH HB   7", "08:57 BERN       12", "09:04 GENEVE      4"], col: C.amber, pitch: 0.36, w: 560, r: 100, look: "amber" },
    { t0: 40, name: "LCD", lines: ["HI 004500", "♥♥♥   LV 07"], col: C.lcdInk, pitch: 0.55, w: 760, r: 0, look: "lcd" },
    { t0: 42, name: "THERMAL", lines: ["PUNCTUM TYPE SHOP", "LATTICE 5×7  35.00", "TOTAL        45.00", "THANK YOU ♥"], col: C.ink, pitch: 0.3, w: 640, r: 100, look: "paper" },
  ];
  MATS.forEach((m) => { ev(m.t0, "mat", { name: m.name }); if (m.t0 > 34) ev(m.t0 - 0.12, "whoosh"); });
  function sMaterials(t) {
    let k = 0; MATS.forEach((m, i) => { if (t >= m.t0) k = i; });
    const m = MATS[k], lt = t - m.t0;
    const lines = m.lines, maxL = Math.max(...lines.map((l) => [...l].length));
    const p = m.pitch, wTot = maxL * 6 * p, hTot = lines.length * 10 * p;
    const out = { floor: null, fog: { d: 0.0, col: [0, 0, 0] }, post: { bloom: 0.8 }, sect: "MATERIALS · " + m.name, ax: [m.w, m.r] };
    // reveal: per-char flap-in for the first 0.4 s
    const reveal = (s, li) => [...s].map((ch, i) => { const t0 = m.t0 + 0.05 + (i + li * 3) * 0.02; if (t < t0) return " "; const kk = Math.floor((t - t0) / 0.035); return kk >= 5 || ch === " " ? ch : DRUM[(Math.max(0, DRUM.indexOf(ch)) - 5 + kk + DRUM.length) % DRUM.length]; }).join("");
    const ox = -wTot / 2, oy = hTot / 2 + 3;
    if (m.look === "lcd" || m.look === "paper") {
      const paper = m.look === "paper";
      const bgc = paper ? [0.78, 0.76, 0.72] : [0.42, 0.5, 0.33];
      panel([0, 3 + p * 0.5, -0.04], [1, 0, 0], [0, 1, 0], wTot / 2 + 4 * p + (paper ? 0 : 1), hTot / 2 + 3 * p + (paper ? 2 : 1), bgc, paper ? 0.55 : 0.35, paper ? 0.02 : 0.08);
      lines.forEach((l, li) => text(TF([ox, oy - li * 10 * p, 0], [1, 0, 0], [0, 1, 0], p), reveal(l, li), { w: m.w, r: m.r, E: 0, col: m.col, kind: 2, unlit: !paper, ucol: mul(bgc, 0.82), ukind: 2 }));
      out.light = { key: [0.3, 0.6, 0.9], keyCol: [1.1, 1.08, 1.0], amb: [0.25, 0.25, 0.24] };
      out.bg = [0.0, 0.0, 0.0];
      out.post.bloom = 0.35;
    } else {
      panel([0, 3 + p * 0.5, -0.06], [1, 0, 0], [0, 1, 0], wTot / 2 + 5 * p, hTot / 2 + 4 * p, m.look === "vfd" ? [0.01, 0.025, 0.03] : [0.012, 0.01, 0.01], 0, 0.04);
      lines.forEach((l, li) => text(TF([ox, oy - li * 10 * p, 0], [1, 0, 0], [0, 1, 0], p), reveal(l, li), { w: m.w, r: m.r, E: m.look === "led" ? 3.4 : 2.6, col: m.col, ucol: mul(m.col, 0.25), uE: m.look === "vfd" ? 0.05 : 0.02 }));
      lattice(TF([ox - 4 * p, oy + 3 * p, 0], [1, 0, 0], [0, 1, 0], p), 0, Math.round(wTot / p) + 7, 0, 2);
      lattice(TF([ox - 4 * p, oy - hTot - 0 * p, 0], [1, 0, 0], [0, 1, 0], p), 0, Math.round(wTot / p) + 7, 0, 2);
    }
    // camera: each material its own move
    const s = Math.max(wTot, hTot * 1.6) * 0.9;
    const moves = [
      [[-0.35 * s, 3.5, 1.05 * s], [0, 3.2, 0], [0.2 * s, 3, 0.95 * s], [0, 3, 0]],
      [[0.5 * s, 6, 0.8 * s], [0, 3, 0], [-0.25 * s, 2, 0.85 * s], [0, 3, 0]],
      [[-0.6 * s, 2.5, 0.55 * s], [-0.2 * s, 3, 0], [0.35 * s, 2.8, 0.6 * s], [0.25 * s, 3, 0]],
      [[0, 3.3, 1.2 * s], [0, 3, 0], [0, 3.1, 0.92 * s], [0, 3, 0]],
      [[-0.3 * s, 6.5, 0.5 * s], [-0.1 * s, 3.5, 0], [0.3 * s, 5.0, 0.45 * s], [0.2 * s, 2.8, 0]],
    ][k];
    const u = eio(seg(lt, 0, 2));
    const pos = lerp3(moves[0], moves[2], u), tgt = lerp3(moves[1], moves[3], u);
    out.cam = cam(pos, tgt, 32, { ap: m.look === "paper" ? 14 : 6, maxCoc: 22 });
    const wIn = lt < 0.14 ? (1 - lt / 0.14) : 0, wOut = lt > 1.86 && k < 4 ? (lt - 1.86) / 0.14 : 0;
    out.post.whip = [(k % 2 ? -1 : 1) * 0.09 * Math.max(wIn, wOut), 0];
    return out;
  }

  /* DEPARTURE BOARD 44–52 */
  const BW = 22, BR = 6;
  const BOARD = [
    [44.0, ["19:45 SHANGHAI", "20:45 TOKYO", "13:45 ZURICH", "07:45 NEW YORK CITY", "04:45 LOS ANGELES", "01:45 HAWAII"]],
    [46.0, ["TIME  TO           PL", "19:49 ZURICH HB     7", "20:00 BERN         12", "20:11 GENEVE AIRPORT 3", "20:22 BASEL SBB     9", "20:33 LUGANO       14"]],
    [48.5, ["", "  35 LIGHTS", "  PER LETTER.", "", "  108 GLYPHS.", ""]],
    [50.4, ["", "", "      PUNCTUM", "", "", ""]],
  ];
  const BSEQ = []; // per cell char sequences
  for (let r = 0; r < BR; r++) for (let c = 0; c < BW; c++) {
    let seq = [[-1e9, " "]], cur = " ";
    BOARD.forEach(([t0, rows], bi) => {
      const ch = ((rows[r] || "").padEnd(BW)[c] || " ").toUpperCase(), start = t0 + (c * 0.018 + r * 0.05) + (bi === 0 ? 0 : 0.0);
      if (bi === 0) { seq = rollSeq(" ", ch, start, 0.05, 0); }
      else { const s2 = rollSeq(cur, ch, start, 0.05, ch === cur ? 0 : 0); s2.shift(); seq = seq.concat(s2); }
      cur = ch;
    });
    BSEQ.push(seq);
  }
  BOARD.forEach(([t0]) => ev(t0, "boardroll", { dur: 1.2 }));
  function sBoard(t) {
    for (let r = 0; r < BR; r++) for (let c = 0; c < BW; c++) {
      const F = TF([-BW * 3.3 + c * 6.6, 34 - r * 11.2, 0]);
      flapModule(F, BSEQ[r * BW + c], t, { w: 540, E: 2.3, col: C.white, dur: 0.1 });
    }
    panel([-3.3, 34 - 2.8 * 11.2 + 0.4, -0.3], [1, 0, 0], [0, 1, 0], BW * 3.3 + 3, BR * 5.6 + 3, [0.01, 0.01, 0.011], 0, 0.02);
    floorDots(0, 0, 120, 1.6, 0, 0.18);
    const K = [[44, [-95, 4, 30], [-40, 20, 0], 40], [47, [-30, 6, 36], [0, 22, 0], 40], [49.5, [30, 8, 40], [10, 21, 0], 38], [52, [4, 22, 120], [-3, 20, 0], 30]];
    const k = camSpline(K, t);
    return { cam: cam(k[1], k[2], k[3], { ap: 5, maxCoc: 18 }), floor: { y: 0, refl: 0.7, blur: 1.6 }, fog: { d: 0.006, col: [0, 0, 0] },
      light: { key: [0.5, 0.7, 0.5], keyCol: [1.1, 1.1, 1.1], amb: [0.025, 0.025, 0.028] }, post: { bloom: 0.65 }, sect: "BOARD", ax: [540, 100] };
  }

  /* THE SITE 52–60: the real specimen page as a glass monolith; descend top → bottom */
  const PAGE_H = 9667, PW = 16, PH = PAGE_H / 100; // world size of the page (1600 px → 16 units)
  ev(52, "site");
  function sSite(t) {
    const quads = [];
    const base = 1.2, top = base + PH, cx = 0;
    for (let i = 0; i * 900 < PAGE_H; i++) {
      const hpx = Math.min(900, PAGE_H - i * 900), y0 = top - i * 9, hh = hpx / 100 / 2;
      quads.push({ tex: "page" + i, c: [cx, y0 - hh, 0], u: [PW / 2, 0, 0], v: [0, hh, 0], gain: 1.15 });
    }
    // dust of unlit beads around the slab
    for (let i = 0; i < 900; i++) { const x = (hash(i, 1) - 0.5) * 120, y = hash(i, 2) * 110, z = -20 - hash(i, 3) * 80; dot([x, y, z], [1, 0, 0], [0, 1, 0], 0.18, 1, hash(i, 4) < 0.08 ? 1.6 : 0, C.warm); }
    floorDots(0, 0, 90, 1.5, 0, 0.17);
    panel([0, base + PH / 2, -0.25], [1, 0, 0], [0, 1, 0], PW / 2 + 0.25, PH / 2 + 0.25, [0.02, 0.02, 0.022], 0, 0.01);
    const u = seg(t, 52.0, 59.3), e = eio(u);
    const y = lerp(top - 3, base + 2.6, e);
    const swing = Math.sin(e * Math.PI) * 0.6;
    const startPull = 1 - eout(seg(t, 52, 53.2));
    const d = 11.5 + startPull * 40;
    const pos = [Math.sin(-0.35 + swing) * d, y + 2.5 + startPull * 10, Math.cos(-0.35 + swing) * d];
    const tgt = [0, y, 0];
    return { quads, cam: cam(pos, tgt, 44, { ap: 3 }), floor: { y: 0, refl: 0.6, blur: 1.2 }, fog: { d: 0.008, col: [0, 0, 0] }, post: { bloom: 0.5, exposure: 1.0 }, sect: "THE SITE", ax: [400, 100] };
  }

  /* TESTER 60–66 */
  const TT = "Dots, not strokes.";
  [...TT].forEach((ch, i) => ev(60.1 + i * 0.07, "key"));
  ev(62.0, "slide"); ev(63.6, "slide");
  function sTester(t) {
    const nType = clamp(Math.floor((t - 60.1) / 0.07) + 1, 0, TT.length);
    const w = lerp(400, 900, eio(seg(t, 62.0, 63.2))), r = lerp(100, 0, eio(seg(t, 63.6, 64.8)));
    const F = TF([-53, 12, 0], [1, 0, 0], [0, 1, 0], 1.0);
    const s = TT.slice(0, nType);
    text(F, s.padEnd(TT.length), { w, r, E: (i, c, row) => 2.4 + 3 * Math.exp(-(t - (60.1 + i * 0.07)) * 6) });
    // caret
    const blink = t < 61.5 || Math.floor(t * 2.4) % 2 === 0;
    if (blink) for (let row = -1; row < 9; row++) dot(at(F, nType * 6 - 0.5, row, 0.02), F.ex, F.ey, 0.22, 1, 3.0, C.warm);
    lattice(F, -6, TT.length * 6 + 6, -4, -1); lattice(F, -6, -1, 0, 9); lattice(F, TT.length * 6, TT.length * 6 + 6, 0, 9);
    // sliders (bead rails) under the line
    const rail = (y, val, lab) => { const RF = TF([-40, y, 1.5], [1, 0, 0], [0, 1, 0], 1.0);
      for (let i = 0; i <= 40; i++) dot(at(RF, i * 2, 0), RF.ex, RF.ey, 0.14, 1, 0.35, C.warm);
      dot(at(RF, val * 80, 0, 0.05), RF.ex, RF.ey, 0.62, 1, 3.4, C.warm);
      text(TF([-48, y + 0.6, 1.5], [1, 0, 0], [0, 1, 0], 0.2), lab, { w: 500, E: 1.6, unlit: false }); };
    rail(2.6, (w - 100) / 800, "WGHT"); rail(1.0, r / 100, "ROND");
    floorDots(0, 0, 80, 1.25, 0, 0.17);
    const caretX = -53 + nType * 6;
    const K = [[60, [-46, 9, 14], [-50, 8.5, 0], 30], [61.4, [caretX + 2, 9, 15], [caretX - 6, 8.2, 0], 30], [62.0, [-8, 9, 34], [-10, 6, 0], 36], [64.8, [14, 6, 44], [0, 6, 0], 34], [66, [6, 9, 70], [0, 7, 0], 34]];
    const k = camSpline(K, Math.min(t, 61.4) === t ? t : t);
    let pos = k[1], tgt = k[2];
    if (t < 61.4) { const cx = lerp(-50, caretX - 4, ss(seg(t, 60, 61.4))); tgt = [cx, 8.3, 0]; pos = [cx + 5, 9.5, 14]; }
    return { cam: cam(pos, tgt, k[3], { ap: 7 }), floor: { y: 0, refl: 0.7, blur: 1.4 }, fog: { d: 0.01, col: [0, 0, 0] }, post: { bloom: 0.7 }, sect: "TESTER", ax: [Math.round(w), Math.round(r)] };
  }

  /* WALL 66–72: the line is one of hundreds; ripple; all out but one; dive */
  const WALL_TXT = ["THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG", "PACK MY BOX WITH FIVE DOZEN LIQUOR JUGS", "Dots, not strokes. 35 lights per letter.", "SPHINX OF BLACK QUARTZ, JUDGE MY VOW", "0123456789 :.-/ →←↑↓ ♥ ■ ° · •"];
  ev(66, "wall"); ev(68.0, "ripple"); ev(70.5, "out"); ev(71.0, "dive");
  function sWall(t) {
    const LINES = 34, p = 0.55;
    const ripR = (t - 68.0) * 70;
    const outAll = t >= 70.5;
    const keep = [0, 12.4, 0.0];
    for (let li = 0; li < LINES; li++) {
      const s = WALL_TXT[li % WALL_TXT.length], y = 12 + (li - 17) * 10 * p * 1.1, len = [...s].length;
      const zl = (hash(li, 77) - 0.5) * 60, F = TF([-len * 3 * p + (hash(li, 78) - 0.5) * 20, y, zl], [1, 0, 0], [0, 1, 0], p);
      const wv = 200 + ((li * 137) % 700), rv = (li * 53) % 2 ? 100 : 30;
      if (li === 17) { if (!outAll) text(TF([-53, 12, 0], [1, 0, 0], [0, 1, 0], 1.0), TT, { w: 900, r: 0, E: 2.4 }); continue; }
      if (outAll) continue;
      text(F, s, { w: wv, r: rv, unlit: false, E: (i, c, r) => { const x = (i * 6 + c) * p - len * 3 * p, d = Math.hypot(x, y - 12); const wave = Math.exp(-Math.pow((d - ripR) / 7, 2)); return 1.4 + 7 * wave; },
        rondFn: (i, c, r) => { const x = (i * 6 + c) * p - len * 3 * p, d = Math.hypot(x, y - 12); return d < ripR - 4 ? 1 - rv / 100 : rv / 100; } });
    }
    if (outAll) { const E = 3 + 6 * Math.exp(-(t - 70.5) * 3); dot(keep, [1, 0, 0], [0, 1, 0], 0.5, 1, E, C.warm); }
    const pull = eio(seg(t, 66, 69.5));
    let pos = lerp3([6, 9, 70], [-60, 30, 190], pull), tgt = lerp3([0, 7, 0], [0, 12, 0], pull);
    const dive = eioExpo(seg(t, 70.9, 72.0));
    if (t > 70.6) { const p0 = lerp3([6, 9, 70], [-60, 30, 190], 1); tgt = lerp3([0, 12, 0], keep, eio(seg(t, 70.6, 71.2))); pos = lerp3(p0, add(keep, [0, 0, 0.35]), dive); }
    return { cam: cam(pos, tgt, 36, { ap: t > 70.6 ? lerp(4, 30, dive) : 4, focus: dist(pos, [0, 12, 0]), maxCoc: 26 }), floor: null, fog: { d: 0.0015, col: [0, 0, 0] },
      post: { bloom: 0.7 + dive * 0.8, exposure: 1 + dive * 2.5, flash: dive > 0.92 ? (dive - 0.92) * 8 : 0 }, sect: "LATTICE", ax: [900, 0] };
  }

  /* END 72–80 */
  for (let c = 0; c < 41; c++) { const ch = T_WORD[Math.floor(c / 6)], cc = c % 6; const rows = []; for (let r = 0; r < 9; r++) if (cc < 5 && on(ch, cc, r)) rows.push(r); if (rows.length) ev(72.2 + c * 0.03, "note", { rows, col: c, soft: 1 }); }
  ev(73.6, "roll", { n: 60, dur: 1.0 }); ev(77.0, "outro"); ev(78.6, "lastdot");
  function sEnd(t) {
    const F = TF([-20.5, 13, 0]);
    const off = (c) => 77.0 + (41 - c) * 0.035;      // lights go out right→left, the first dot stays
    text(F, T_WORD, { w: 520, E: (i, c, r) => { const col = i * 6 + c, tk = 72.2 + col * 0.03; if (t < tk) return 0.0;
      const keepDot = i === 0 && c === 0 && r === 0; if (!keepDot && t > off(col)) return null; const fade = keepDot ? (1 - seg(t, 79.0, 79.85)) : 1;
      return (2.4 + 5 * Math.exp(-(t - tk) * 7)) * fade; } });
    lattice(F, -14, 54, -6, -1); lattice(F, -14, -1, 0, 9); lattice(F, 42, 54, 0, 9);
    const sub1 = "VARIABLE DOT-MATRIX TYPEFACE", sub2 = "WGHT 100-900 · ROND 0-100 · 108 GLYPHS";
    const fl = (s, t0) => [...s].map((ch, i) => { const s0 = t0 + i * 0.02; if (t < s0 || t > 77.0 + (s.length - i) * 0.01) return " "; const k = Math.floor((t - s0) / 0.035); return k >= 6 || ch === " " ? ch : DRUM[(Math.max(0, DRUM.indexOf(ch)) - 6 + k + DRUM.length) % DRUM.length]; }).join("");
    text(TF([-[...sub1].length * 0.9, 3.2, 0.5], [1, 0, 0], [0, 1, 0], 0.3), fl(sub1, 73.6), { w: 520, E: 2.0, unlit: false });
    text(TF([-[...sub2].length * 0.66, 1.6, 0.5], [1, 0, 0], [0, 1, 0], 0.22), fl(sub2, 73.9), { w: 480, E: 1.4, unlit: false });
    floorDots(0, 0, 70, 1.25, 0, 0.17);
    const u = eout(seg(t, 72, 80));
    const pos = lerp3([-6, 12.6, 14], [0, 8, 44], u), tgt = lerp3([-20.5, 13, 0], [0, 8, 0], eout(seg(t, 72, 74.5)));
    return { cam: cam(pos, tgt, 34, { ap: lerp(16, 4, eout(seg(t, 72, 74))) }), floor: { y: 0, refl: 0.75, blur: 1.4 }, fog: { d: 0.01, col: [0, 0, 0] },
      post: { bloom: 0.55, flash: 0.15 * Math.exp(-(t - 72) * 5), fade: 1 - seg(t, 79.85, 80) }, sect: "PUNCTUM", ax: [520, 100] };
  }

  const SCENES = [[0, sHook], [2, sTitle], [8, sCountdown], [16, sDesign], [26, sGlyphs], [34, sMaterials], [44, sBoard], [52, sSite], [60, sTester], [66, sWall], [72, sEnd]];
  /* cut accents: a short flash on each scene boundary */
  const CUTS = SCENES.map((s) => s[0]).filter((x) => x > 0);
  CUTS.forEach((c) => ev(c, "cut"));
  for (let b = 4; b < 160; b++) { const t = b * 0.5; ev(t, "beat", { b }); }

  function frame(t) {
    t = clamp(t, 0, LEN - 1e-4); n = 0;
    let fn = SCENES[0][1]; for (const [t0, f] of SCENES) if (t >= t0) fn = f;
    const F = fn(t);
    const post = Object.assign({ exposure: 1, bloom: 0.45, vig: 0.5, grain: 0.012, ca: 0.0022, grade: [1.0, 0.99, 0.97], lift: [0.004, 0.004, 0.006] }, F.post || {});
    for (const c of CUTS) if (t >= c && t < c + 0.25 && c !== 16 && c !== 72 && c !== 36 && c !== 38 && c !== 40 && c !== 42) post.flash = Math.max(post.flash || 0, 0.07 * (1 - (t - c) / 0.25));
    if (t >= 15.75 && t < 16) post.exposure *= 0.6;
    return { t, cam: F.cam, n, inst: buf, quads: F.quads || null, floor: F.floor, fog: F.fog, light: F.light, post, bg: F.bg, cursor: F.cursor, sect: F.sect, ax: F.ax, tag: F.tag };
  }

  globalThis.PUNCTUM = { frame, padAt, LEN, EVENTS: EV.sort((a, b) => a.t - b.t), SCENES: SCENES.map((s) => s[0]) };
})();

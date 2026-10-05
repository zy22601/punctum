// Frame-exact capture of the Punctum specimen page under a virtual clock.
// usage: node tools/capture.cjs <module-id|all> [--preview N]   → capture/<id>.mp4
const puppeteer = require(process.env.HOME + "/.npm/_npx/6bf6050976e33bc9/node_modules/puppeteer-core");
const path = require("path"), fs = require("fs"), { spawn } = require("child_process");
const MODULES = require("./modules.cjs");
const VW = 1600, VH = 900, DPR = 2, FPS = 60;

const SHIM = `(() => {
  let vt = 0;
  const T0 = new Date("2026-10-04T19:45:12+08:00").getTime();
  performance.now = () => vt;
  const RD = Date;
  class VDate extends RD { constructor(...a) { if (a.length === 0) super(T0 + vt); else super(...a); } static now() { return T0 + vt; } }
  window.Date = VDate;
  let raf = [], rid = 1, timers = [], tid = 1;
  window.requestAnimationFrame = (cb) => { const id = rid++; raf.push([id, cb]); return id; };
  window.cancelAnimationFrame = (id) => { raf = raf.filter((x) => x[0] !== id); };
  window.setTimeout = (cb, ms = 0, ...a) => { const id = tid++; timers.push({ id, at: vt + Math.max(0, +ms || 0), cb, a, every: 0 }); return id; };
  window.setInterval = (cb, ms = 0, ...a) => { const id = tid++; const e = Math.max(1, +ms || 1); timers.push({ id, at: vt + e, cb, a, every: e }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers = timers.filter((x) => x.id !== id); };
  const seen = new WeakMap();
  window.__vstep = (dt) => {
    const target = vt + dt;
    for (let guard = 0; guard < 500; guard++) {
      timers.sort((x, y) => x.at - y.at);
      const t = timers[0]; if (!t || t.at > target) break;
      vt = t.at; if (t.every) t.at += t.every; else timers.shift();
      try { t.cb(...t.a); } catch (e) { console.error(e && e.message); }
    }
    vt = target;
    const q = raf; raf = [];
    for (const [, cb] of q) { try { cb(vt); } catch (e) { console.error(e && e.message); } }
    for (const an of document.getAnimations()) { if (!seen.has(an)) { seen.set(an, vt); an.pause(); } an.currentTime = vt - seen.get(an); }
  };
  window.__vt = () => vt;
})();`;

const OVERLAY = `(() => {
  const c = document.createElement("div"); c.id = "vcursor";
  c.innerHTML = '<svg width="30" height="38" viewBox="0 0 30 38"><path d="M3 2 L3 30 L10 23.5 L15 35 L20 33 L15 21.5 L25 21.5 Z" fill="#fff" stroke="#0a0a09" stroke-width="2" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none", transform: "translate(-100px,-100px)", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.45))", transition: "none" });
  document.body.appendChild(c);
  window.__vcur = (x, y, vis, press) => { c.style.transform = "translate(" + (x - 3) + "px," + (y - 2) + "px) scale(" + (press ? 0.86 : 1) + ")"; c.style.opacity = vis; };
  window.__vripple = (x, y) => {
    const r = document.createElement("div");
    Object.assign(r.style, { position: "fixed", left: x - 26 + "px", top: y - 26 + "px", width: "52px", height: "52px", borderRadius: "50%", zIndex: 2147483646, pointerEvents: "none",
      background: "radial-gradient(circle, rgba(255,255,255,.95) 0 3px, transparent 3.5px) 0 0 / 13px 13px", maskImage: "radial-gradient(circle, #000 55%, transparent 72%)", WebkitMaskImage: "radial-gradient(circle, #000 55%, transparent 72%)" });
    document.body.appendChild(r);
    r.animate([{ transform: "scale(.2)", opacity: 1 }, { transform: "scale(1.6)", opacity: 0 }], { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
  };
  window.__vtarget = (s) => {
    if (s.x !== undefined) return [s.x, s.y];
    const el = document.querySelector(s.sel); if (!el) return [VW / 2, VH / 2];
    const b = el.getBoundingClientRect();
    if (s.pad) { const [w, r] = s.pad, mx = b.width / 9, my = b.height / 6; return [b.left + mx / 2 + (w - 100) / 800 * (b.width - mx), b.top + my / 2 + (100 - r) / 100 * (b.height - my)]; }
    if (s.range !== undefined) { const mn = +el.min, mxv = +el.max; return [b.left + 6.5 + (s.range - mn) / (mxv - mn) * (b.width - 13), b.top + b.height / 2]; }
    return [b.left + b.width * (s.fx ?? 0.5), b.top + b.height * (s.fy ?? 0.5)];
  };
  window.__vdocTop = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().top + scrollY : 0; };
})();`.replace(/VW/g, VW).replace(/VH/g, VH);

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u) => 1 - Math.pow(1 - u, 3);

async function capture(browser, id, opts) {
  const M = MODULES[id];
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: DPR });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.evaluateOnNewDocument(SHIM);
  const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.goto("file://" + path.resolve(__dirname, "../capture/page.html"), { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(OVERLAY);
  // settle layout (fit, lattices) without advancing the visible story much
  await page.evaluate(() => { dispatchEvent(new Event("resize")); for (let i = 0; i < 12; i++) __vstep(16.6667); });
  if (M.preroll) await page.evaluate((ms) => { for (let t = 0; t < ms; t += 16.6667) __vstep(16.6667); }, M.preroll * 1000);
  // resolve scroll keyframes to document y
  const scroll = [];
  for (const [t, s] of M.scroll || []) scroll.push([t, typeof s === "number" ? s : (await page.evaluate((sel) => __vdocTop(sel), s.sel)) - s.off]);
  if (scroll.length) await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), scroll[0][1]);
  await page.evaluate(() => { for (let i = 0; i < 3; i++) __vstep(16.6667); });

  const N = Math.round((opts.preview ?? M.dur) * FPS);
  const out = path.resolve(__dirname, `../capture/${id}${opts.preview ? "-preview" : ""}.mp4`);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  ff.stderr.on("data", (d) => process.stderr.write(d));
  const done = new Promise((r) => ff.on("close", r));
  const cur = M.cursor || [], evs = (M.events || []).slice().sort((a, b) => a[0] - b[0]);
  let ei = 0, pressed = false, lastXY = null;
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const tau = f / FPS;
    // scroll
    if (scroll.length > 1) {
      let y = scroll[0][1];
      for (let k = 1; k < scroll.length; k++) if (tau >= scroll[k - 1][0]) { const [ta, ya] = scroll[k - 1], [tb, yb] = scroll[k]; y = tau >= tb ? yb : ya + (yb - ya) * ease((tau - ta) / (tb - ta)); }
      await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
    }
    // cursor
    let vis = 0, xy = null;
    if (cur.length && tau >= cur[0][0]) {
      vis = 1;
      let k = cur.length - 1; for (let i = 0; i < cur.length - 1; i++) if (tau < cur[i + 1][0]) { k = i; break; }
      const A = cur[k], B = cur[Math.min(k + 1, cur.length - 1)];
      const [pa, pb] = await page.evaluate((a, b) => [__vtarget(a), __vtarget(b)], A[1], B[1]);
      const u = B === A || tau >= B[0] ? 1 : (B[2] === "lin" ? (tau - A[0]) / (B[0] - A[0]) : ease((tau - A[0]) / (B[0] - A[0])));
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1], arc = (B[2] === "lin" ? 0 : 0.1) * Math.sin(Math.PI * u);
      xy = [pa[0] + dx * u - dy * arc, pa[1] + dy * u + dx * arc];
      if (M.hideAfter !== undefined && tau > M.hideAfter) vis = Math.max(0, 1 - (tau - M.hideAfter) / 0.25);
      if (cur[0][0] > 0) vis = Math.min(vis, (tau - cur[0][0]) / 0.25);
      if (!lastXY || Math.abs(xy[0] - lastXY[0]) + Math.abs(xy[1] - lastXY[1]) > 0.2) { await page.mouse.move(xy[0], xy[1]); lastXY = xy; }
    }
    // events
    while (ei < evs.length && evs[ei][0] <= tau) {
      const [, type, arg] = evs[ei++];
      if (type === "down") { await page.mouse.down(); pressed = true; if (xy) await page.evaluate((x, y) => __vripple(x, y), xy[0], xy[1]); }
      else if (type === "up") { await page.mouse.up(); pressed = false; }
      else if (type === "click") { await page.mouse.down(); await page.mouse.up(); if (xy) await page.evaluate((x, y) => __vripple(x, y), xy[0], xy[1]); }
      else if (type === "key") await page.keyboard.press(arg);
      else if (type === "char") await page.keyboard.sendCharacter(arg);
      else if (type === "eval") await page.evaluate(arg);
    }
    await page.evaluate((x, y, v, p) => { if (x !== null) __vcur(x, y, v, p); else __vcur(-100, -100, 0, false); __vstep(1000 / 60); }, xy ? xy[0] : null, xy ? xy[1] : null, vis, pressed);
    const buf = await page.screenshot({ type: "jpeg", quality: 93, optimizeForSpeed: true });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 120 === 0) process.stdout.write(`${id} ${f}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end(); await done; await page.close();
  if (errs.length) console.log(id, "page errors:", [...new Set(errs)].slice(0, 5));
  console.log("wrote", out);
}

(async () => {
  const args = process.argv.slice(2), which = args[0];
  const pi = args.indexOf("--preview"), preview = pi >= 0 ? +args[pi + 1] : undefined;
  const ids = which === "all" ? Object.keys(MODULES) : which.split(",");
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
  const par = +(process.env.PAR || 3);
  const queue = ids.slice();
  await Promise.all(Array.from({ length: par }, async () => { while (queue.length) await capture(browser, queue.shift(), { preview }); }));
  await browser.close();
})();

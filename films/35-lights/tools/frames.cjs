// usage: node tools/frames.cjs out_dir t1 t2 ...   (draws film at each t, saves PNG + timing)
const puppeteer = require(process.env.HOME + "/.npm/_npx/6bf6050976e33bc9/node_modules/puppeteer-core");
const path = require("path"), fs = require("fs");
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("file://" + path.resolve(__dirname, "../index.html"), { waitUntil: "load" });
  for (const t of ts) {
    const r = await p.evaluate((t) => { const c = document.getElementById("stage"); const t0 = performance.now(); createPunctumFilm().draw(c.getContext("2d"), +t); return [c.toDataURL("image/png"), performance.now() - t0]; }, t);
    fs.writeFileSync(`${out}/t${(+t).toFixed(2).padStart(6, "0")}.png`, Buffer.from(r[0].split(",")[1], "base64"));
    console.log(t, Math.round(r[1]) + "ms");
  }
  if (errs.length) console.log("ERRORS", errs);
  await b.close();
})();

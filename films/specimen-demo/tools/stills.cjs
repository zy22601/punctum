const puppeteer = require(process.env.HOME + "/.npm/_npx/6bf6050976e33bc9/node_modules/puppeteer-core");
const path = require("path");
(async () => {
  const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"] });
  const p = await b.newPage(); await p.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await p.goto("file://" + path.resolve(__dirname, "../capture/page.html"), { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready); await new Promise((r) => setTimeout(r, 800));
  const figs = await p.$$("#use figure.use");
  for (let i = 0; i < figs.length; i++) { await figs[i].scrollIntoView(); await new Promise((r) => setTimeout(r, 200)); await figs[i].screenshot({ path: path.resolve(__dirname, `../assets/use-${i}.png`) }); }
  await b.close(); console.log("stills", figs.length);
})();

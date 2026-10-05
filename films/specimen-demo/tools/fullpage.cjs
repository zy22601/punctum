// Full-page tall screenshot of the specimen (all roll-ins settled) → assets/page-<i>.png tiles
const puppeteer = require(process.env.HOME + "/.npm/_npx/6bf6050976e33bc9/node_modules/puppeteer-core");
const path = require("path"), fs = require("fs");
const src = fs.readFileSync(path.join(__dirname, "capture.cjs"), "utf8");
const SHIM = eval(src.match(/const SHIM = (`[\s\S]*?`);/)[1]);
const VW = 1600, DPR = +(process.env.DPR || 1.5), TILE = 900;
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: 900, deviceScaleFactor: DPR });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.evaluateOnNewDocument(SHIM);
  await page.goto("file://" + path.resolve(__dirname, "../capture/page.html"), { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log("doc height", H);
  if (process.argv[2] === "--measure") return browser.close();
  await page.addStyleTag({ content: ".hero{height:900px!important} .nav{position:absolute!important}" });
  await page.evaluate(() => { const n = document.querySelector("[style*=fixed]"); });
  await page.setViewport({ width: VW, height: H, deviceScaleFactor: DPR });
  await page.evaluate(() => { dispatchEvent(new Event("resize")); for (let i = 0; i < 360; i++) __vstep(16.6667); });
  const H2 = await page.evaluate(() => document.documentElement.scrollHeight);
  const n = Math.ceil(H2 / TILE);
  for (let i = 0; i < n; i++) {
    const h = Math.min(TILE, H2 - i * TILE);
    await page.screenshot({ path: path.resolve(__dirname, `../assets/page-${i}.png`), clip: { x: 0, y: i * TILE, width: VW, height: h }, captureBeyondViewport: false });
  }
  console.log("tiles", n, "height", H2);
  await browser.close();
})();

// node tools/still.mjs 0.1,2.5,9 [--w 1920 --h 1080 --tag x] → stills/<tag>_<t>.png + stills/<tag>_sheet.jpg
import { launch } from './browser.mjs'; import { serve } from './server.mjs'; import { spawnSync } from 'child_process'; import fs from 'fs';
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1920), H = +opt('h', 1080), tag = opt('tag', 's');
const times = (args[0] || '1').split(',').map(Number);
const port = 5900 + Math.floor(Math.random() * 90); const srv = await serve(port);
const b = await launch([]); const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto(`http://localhost:${port}/index.html?w=${W}&h=${H}${opt('q','')}`); await p.waitForFunction(() => document.title === 'READY' || document.title === 'ERROR', null, { timeout: 120000 });
if (await p.title() === 'ERROR') { console.log(await p.evaluate(() => window.__err)); process.exit(1); }
const files = [];
for (const t of times) {
  const t0 = Date.now(); await p.evaluate((t) => { window.__renderAt(t); }, t);
  const f = `stills/${tag}_${t}.png`; await p.screenshot({ path: f }); files.push(f); console.log(f, Date.now() - t0, 'ms');
}
await b.close(); srv.close();
if (files.length > 1) {
  const cols = Math.min(4, files.length), rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap((f) => ['-i', f]);
  const fc = files.map((_, i) => `[${i}]scale=480:-1[v${i}]`).join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|') + `:fill=black`;
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, `stills/${tag}_sheet.jpg`], { stdio: 'inherit' });
}

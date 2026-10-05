// node tools/render.mjs out/film.mp4 [--w 1920 --h 1080 --fps 60 --from 0 --to 80 --crf 14]
import { launch } from './browser.mjs'; import { serve } from './server.mjs'; import { spawn, spawnSync } from 'child_process'; import fs from 'fs';
const args = process.argv.slice(2); const out = args[0] || 'out/film.mp4';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1920), H = +opt('h', 1080), FPS = +opt('fps', 60), FROM = +opt('from', 0), TO = +opt('to', 80), CRF = opt('crf', '14');
const silent = out.replace(/\.mp4$/, '') + '.video.mp4';
const port = 6100 + Math.floor(Math.random() * 300); const srv = await serve(port);
const b = await launch([]); const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`http://localhost:${port}/index.html?w=${W}&h=${H}`); await p.waitForFunction(() => document.title === 'READY' || document.title === 'ERROR', null, { timeout: 120000 });
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-maxrate', '40M', '-bufsize', '80M', '-pix_fmt', 'yuv420p', '-tune', 'film',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
const n0 = Math.round(FROM * FPS), n1 = Math.round(TO * FPS), t0 = Date.now();
for (let k = n0; k < n1; k++) {
  const b64 = await p.evaluate((t) => window.__frame(t), k / FPS);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if ((k - n0) % 300 === 0) { const el = (Date.now() - t0) / 1000; console.log(`frame ${k}/${n1} ${el.toFixed(0)}s ${(el / (k - n0 + 1)).toFixed(3)}s/f eta ${((el / (k - n0 + 1)) * (n1 - k)).toFixed(0)}s`); }
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); srv.close();
const wav = 'assets/score.wav';
if (fs.existsSync(wav)) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-ss', String(FROM), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', String(TO - FROM), '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status === 0) fs.unlinkSync(silent);
} else fs.renameSync(silent, out);
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');

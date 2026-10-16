/* uso:
   node render.mjs stills <w> <h> <sub> <frames,separados,por,vírgula> [cfgJSON]
   node render.mjs video  <w> <h> <sub> <saida.mp4> [cfgJSON] [from] [to]   */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const [mode, ws, hs, subs, target, cfgJson, fromS, toS] = process.argv.slice(2);
const w = +ws, h = +hs, sub = +subs;
const cfg = Object.assign({ w, h, sub }, cfgJson ? JSON.parse(cfgJson) : {});
if (cfg.expFile) cfg.expCurve = JSON.parse(readFileSync(path.join(DIR, cfg.expFile), 'utf8'));
const exps = [];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text().slice(0, 300)); });
await page.goto('file://' + path.join(DIR, 'planta_open.html'));
await page.waitForFunction(() => window.__plantav2 && window.__plantav2.ready, null, { timeout: 180000 });
await page.evaluate(c => { window.__CFG = c; }, cfg);
await page.addScriptTag({ content: readFileSync(path.join(DIR, 'director.js'), 'utf8') });
const info = await page.evaluate(() => window.__DIR.prepare());
console.error('prepare', JSON.stringify(info));

function ff(args) {
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });
  return p;
}
async function grab(f) {
  const b64 = await page.evaluate(([f, n]) => window.__DIR.frame(f, n), [f, sub]);
  return Buffer.from(b64, 'base64');
}

if (mode === 'stills') {
  mkdirSync(path.join(DIR, 'stills'), { recursive: true });
  for (const f of target.split(',').map(Number)) {
    const t = Date.now();
    const buf = await grab(f);
    await new Promise((res, rej) => {
      const p = ff(['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1', path.join(DIR, 'stills', `f${String(f).padStart(3, '0')}.png`)]);
      p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c)));
      p.stdin.end(buf);
    });
    console.error(`frame ${f} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
} else {
  const fps = cfg.fps || 30, total = Math.round((cfg.dur || 15) * fps);
  const from = fromS ? +fromS : 0, to = toS ? +toS : total;
  const p = ff(['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-', '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target]);
  const done = new Promise((res, rej) => p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    const buf = await grab(f);
    exps.push(await page.evaluate(() => window.__DIR.lastExp));
    if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r));
    const el = (Date.now() - t0) / 1000, per = el / (f - from + 1);
    console.error(`frame ${f + 1}/${to}  ${per.toFixed(1)}s/q  falta ~${((to - f - 1) * per / 60).toFixed(1)} min`);
  }
  p.stdin.end();
  await done;
  if (cfg.saveExp) writeFileSync(path.join(DIR, cfg.saveExp), JSON.stringify(exps));
}
await browser.close();

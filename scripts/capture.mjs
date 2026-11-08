// Dev-only screenshot helper. Uses the Chrome DevTools Protocol over a
// temporary headless profile so the demo can be inspected at phone sizes
// without adding a dependency.
//
//   node scripts/capture.mjs --url "http://localhost:1995/?demo=1" \
//     --out docs/home-mobile.png --width 390 --height 844 --wait "GÜNÜN VAKASI"
//
// Flags: --full (capture the whole page), --dpr 2, --delay 1200,
//        --chrome "C:\\path\\chrome.exe"
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const url = arg('url', 'http://localhost:1995/?demo=1');
const out = path.resolve(arg('out', 'docs/capture.png'));
const width = Number(arg('width', '390'));
const height = Number(arg('height', '844'));
const dpr = Number(arg('dpr', '1'));
const delay = Number(arg('delay', '900'));
const waitText = arg('wait', '');
const preloadFile = arg('preload', '');
const evalFile = arg('eval-file', '');
const full = flag('full');
const chromePath =
  arg('chrome', '') ||
  process.env.CHROME_PATH ||
  [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => existsSync(p));

if (!chromePath) {
  console.error('Chrome/Edge bulunamadı. --chrome ile yolu ver.');
  process.exit(1);
}

const port = 9300 + Math.floor(Math.random() * 500);
const profile = path.join(os.tmpdir(), `primer-shot-${Date.now()}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',
    '--disable-background-networking',
    '--disable-sync',
    '--metrics-recording-only',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
        return;
      }
      const list = this.listeners.get(msg.method) || [];
      for (const fn of list) fn(msg.params);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    const list = this.listeners.get(method) || [];
    list.push(fn);
    this.listeners.set(method, list);
  }
}

async function getJson(endpoint) {
  const res = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  if (!res.ok) throw new Error(`CDP HTTP ${res.status}`);
  return res.json();
}

async function main() {
  let version;
  for (let i = 0; i < 80; i += 1) {
    try {
      version = await getJson('/json/version');
      break;
    } catch {
      await sleep(100);
    }
  }
  if (!version) throw new Error('Chrome debug port açılmadı.');

  const targetRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await targetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: dpr,
    mobile: width < 700,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: width < 700, maxTouchPoints: 5 });

  if (preloadFile) {
    const source = await readFile(preloadFile, 'utf8');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(12000)]);
  await sleep(delay);

  if (waitText) {
    const needle = JSON.stringify(waitText);
    for (let i = 0; i < 60; i += 1) {
      const check = await cdp.send('Runtime.evaluate', {
        expression: `document.body.innerText.includes(${needle})`,
        returnByValue: true,
      });
      if (check.result?.value) break;
      await sleep(200);
    }
  }

  // The boot overlay fades with a CSS transition; remove the residue so the
  // screenshot is deterministic even in a background headless target.
  await cdp.send('Runtime.evaluate', { expression: `document.getElementById('boot-screen')?.remove()` });

  if (evalFile) {
    const source = await readFile(evalFile, 'utf8');
    await cdp.send('Runtime.evaluate', { expression: source, awaitPromise: true, returnByValue: true });
    await sleep(700);
  }

  await sleep(150);

  const params = { format: 'png', captureBeyondViewport: full };
  if (full) {
    const metrics = await cdp.send('Page.getLayoutMetrics');
    const size = metrics.cssContentSize || metrics.contentSize;
    params.clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
  }
  const shot = await cdp.send('Page.captureScreenshot', params);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(shot.data, 'base64'));
  console.log(`captured ${out} (${width}x${height}${full ? ' full' : ''})`);
  ws.close();
}

try {
  await main();
} finally {
  browser.kill();
  await sleep(250);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

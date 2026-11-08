// PRIMER.EXE — zero-dependency Node server.
// Serves the PWA, the server-driven UI runtime, the event stream and the
// optional Gemini bridge. No build step, no database, no dependencies.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, appendFile, rename } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { buildBootstrap, defaultRuntime, getCase, META, CASES } from './shared/content.mjs';
import { validateBlocks, validateCase, validateRuntimePatch } from './shared/schema.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, '.data');
const STORE_FILE = join(DATA_DIR, 'runtime.json');
const EVENTS_FILE = join(DATA_DIR, 'events.ndjson');

loadDotEnv();

const PORT = Number(process.env.PORT || 1995);
const HOST = process.env.HOST || '0.0.0.0';
const CONSOLE_CODE = process.env.CONSOLE_CODE || '1995';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_BODY = 1_200_000;

let runtime;
let revisions = [];
let events = [];
const clients = new Set();
const startedAt = Date.now();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

await bootStore();

const server = createServer(async (req, res) => {
  const t0 = Date.now();
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = safeDecode(url.pathname);
  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, url, pathname);
    } else {
      await serveStatic(req, res, pathname);
    }
  } catch (error) {
    const status = error?.status || 500;
    if (status >= 500) console.error('[PRIMER]', error);
    if (!res.headersSent) sendJson(res, status, { error: error?.message || 'Sunucu hatası', detail: error?.detail });
    else res.end();
  } finally {
    if (pathname.startsWith('/api/') && pathname !== '/api/stream') {
      console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - t0}ms`);
    }
  }
});

server.listen(PORT, HOST, () => {
  const lan = lanAddress();
  console.log('');
  console.log('  PRIMER.EXE // sunucu hazır');
  console.log(`  Yerel:  http://localhost:${PORT}`);
  if (lan) console.log(`  Telefon: http://${lan}:${PORT}  (aynı Wi-Fi)`);
  console.log(`  Revizyon: ${runtime.revision} • Gemini: ${process.env.GEMINI_API_KEY ? GEMINI_MODEL : 'kapalı (yerel fallback)'}`);
  console.log(`  Kontrol Odası kodu: ${CONSOLE_CODE}`);
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n[PRIMER] kapatılıyor…');
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
});

// ---------------------------------------------------------------- API

async function handleApi(req, res, url, pathname) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      revision: runtime.revision,
      gemini: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_API_KEY ? GEMINI_MODEL : null,
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      clients: clients.size,
    });
  }

  if (pathname === '/api/bootstrap' && req.method === 'GET') {
    return sendJson(res, 200, buildBootstrap(runtime));
  }

  if (pathname.startsWith('/api/case/') && req.method === 'GET') {
    const id = safeDecode(pathname.slice('/api/case/'.length));
    const found = runtime.extraCases?.find((c) => c.id === id) || getCase(id);
    if (!found) return sendJson(res, 404, { error: 'Vaka bulunamadı.' });
    return sendJson(res, 200, found);
  }

  if (pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 2500\n\n');
    writeRevision(res, { revision: runtime.revision, reason: 'Bağlantı kuruldu' });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (pathname === '/api/events' && req.method === 'POST') {
    const body = await readJson(req, 32_000);
    const event = sanitizeEvent(body);
    if (!event) return sendJson(res, 400, { error: 'Geçersiz olay.' });
    events.push(event);
    if (events.length > 1500) events = events.slice(-1000);
    appendFile(EVENTS_FILE, `${JSON.stringify(event)}\n`).catch(() => {});
    return sendJson(res, 202, { ok: true });
  }

  if (pathname === '/api/mentor' && req.method === 'POST') {
    const body = await readJson(req, 32_000);
    const local = localMentor(body);
    if (!process.env.GEMINI_API_KEY) {
      return sendJson(res, 200, { source: 'local', text: local, hint: local });
    }
    try {
      const text = await callGemini({
        system:
          'Sen PRIMER.EXE adlı yazılım mühendisliği simülatörünün mentorusun. Türkçe konuş. ' +
          'Öğrenciye doğrudan cevabı vermeden, elindeki kanıtları ve kalan hamleleri hatırlatan 2 kısa cümle yaz. ' +
          'Suçlayıcı olma; kararların bedelini ve bir sonraki en iyi adımı söyle. En fazla 55 kelime.',
        prompt: JSON.stringify({
          vaka: body.title,
          kod: body.caseCode,
          hedef: body.objective,
          kanitlar: body.evidence,
          kanitSayisi: `${body.evidence?.length || 0}/${body.evidenceTotal || '?'}`,
          kalanHamle: body.turnsLeft,
          ipucuSayisi: body.hints,
          ogrenci: body.name,
          kidem: body.rank,
          sonNotlar: body.gradeHistory,
        }),
        maxTokens: 180,
      });
      return sendJson(res, 200, { source: 'gemini', text, hint: local });
    } catch (error) {
      console.warn('[PRIMER] Gemini mentor fallback:', error.message);
      return sendJson(res, 200, { source: 'local', text: local, hint: local, warning: error.message });
    }
  }

  if (pathname === '/api/stats' && req.method === 'GET') {
    if (!checkConsole(req)) return sendJson(res, 401, { error: 'Kontrol kodu gerekli.' });
    return sendJson(res, 200, statsPayload());
  }

  if (pathname.startsWith('/api/console/')) {
    if (!checkConsole(req)) return sendJson(res, 401, { error: 'Kontrol kodu gerekli.' });

    if (pathname === '/api/console/state' && req.method === 'GET') {
      return sendJson(res, 200, consoleState());
    }

    if (pathname === '/api/console/apply' && req.method === 'POST') {
      const patch = await readJson(req, 400_000);
      const errors = validateRuntimePatch(patch);
      if (errors.length) return sendJson(res, 400, { error: errors[0], errors });
      const reason = describePatch(patch);
      if (patch.appendBlocks && (runtime.homeBlocks?.length || 0) + patch.appendBlocks.length > 16) {
        return sendJson(res, 400, { error: 'Toplam blok sayısı 16’yı aşamaz.', errors: ['En fazla 16 blok.'] });
      }
      if (patch.featuredCase && !caseExists(patch.featuredCase)) {
        return sendJson(res, 400, { error: `Öne çıkan vaka bulunamadı: ${patch.featuredCase}` });
      }
      if (patch.extraCase && CASES.some((c) => c.id === patch.extraCase.id)) {
        return sendJson(res, 400, { error: `${patch.extraCase.id} yerleşik bir vaka; farklı bir id kullan.` });
      }
      publish(reason, (rt) => {
        if (patch.theme) rt.theme = { ...rt.theme, ...patch.theme };
        if (patch.season) rt.season = { ...rt.season, ...patch.season };
        if (patch.announcement !== undefined) rt.announcement = patch.announcement;
        if (patch.homeBlocks) rt.homeBlocks = patch.homeBlocks;
        if (patch.appendBlocks) rt.homeBlocks = [...(rt.homeBlocks || []), ...patch.appendBlocks];
        if (patch.featuredCase !== undefined) rt.featuredCase = patch.featuredCase;
        if (patch.extraCase) {
          rt.extraCases = [...(rt.extraCases || []).filter((c) => c.id !== patch.extraCase.id), patch.extraCase];
        }
      });
      return sendJson(res, 200, { ok: true, revision: runtime.revision, reason, bootstrap: buildBootstrap(runtime) });
    }

    if (pathname === '/api/console/generate' && req.method === 'POST') {
      const body = await readJson(req, 32_000);
      const prompt = String(body.prompt || '').trim().slice(0, 600);
      if (prompt.length < 4) return sendJson(res, 400, { error: 'Daha açıklayıcı bir istek yaz.' });
      let block = null;
      let source = 'local';
      let warning = null;
      if (process.env.GEMINI_API_KEY) {
        try {
          const raw = await callGemini({
            system:
              'Sen bir server-driven UI ajanısın. Yalnızca geçerli JSON döndür, markdown veya açıklama yazma. ' +
              'PRIMER.EXE için tek bir arayüz bloğu üret. İzinli tipler: banner, note, module, stats, ticker, hero, divider, oncall, seasonPass. ' +
              'Türkçe yaz. Alanlar: banner{type,tone(info|warn|success),title<=100,text<=260,cta?{label,action}}; ' +
              'note{type,text<=260}; module{type,title<=80,body<=220,icon,minLevel?}; stats{type,title<=80,items[{label,value}]}; ' +
              'ticker{type,label,items[string]}; hero{type,eyebrow,title<=160,body<=260,cta{label,action}}; ' +
              'divider{type,label}; oncall{type,title,body}; seasonPass{type,title,items[{level,label,phase}]}. ' +
              'Sadece blok nesnesini döndür; sarmalayıcı kullanma.',
            prompt,
            maxTokens: 600,
            json: true,
          });
          block = extractBlock(raw);
          const errors = block ? validateBlocks([block]) : ['JSON bloğu çözülemedi.'];
          if (errors.length) {
            warning = `Gemini çıktısı şemaya uymadı: ${errors[0]}`;
            block = null;
          } else {
            source = 'gemini';
          }
        } catch (error) {
          warning = `Gemini kullanılamadı: ${error.message}`;
        }
      }
      if (!block) block = localBlock(prompt);
      publish(`Ajan bloğu: ${prompt.slice(0, 46)}`, (rt) => {
        rt.homeBlocks = [...(rt.homeBlocks || []).slice(-15), block];
        rt.announcement = {
          tone: block.type === 'banner' ? block.tone || 'info' : 'success',
          title: 'AJAN GÜNCELLEMESİ',
          text: `${source === 'gemini' ? 'Gemini' : 'Yerel şema motoru'} yeni bir "${block.type}" bloğu yayınladı.`,
        };
      });
      return sendJson(res, 200, {
        ok: true,
        source,
        warning,
        block,
        revision: runtime.revision,
        bootstrap: buildBootstrap(runtime),
      });
    }

    if (pathname === '/api/console/reset' && req.method === 'POST') {
      publish('Fabrika ayarlarına dönüş', (rt) => {
        const fresh = defaultRuntime();
        rt.season = fresh.season;
        rt.theme = fresh.theme;
        rt.announcement = null;
        rt.featuredCase = null;
        rt.homeBlocks = fresh.homeBlocks;
        rt.extraCases = [];
      });
      return sendJson(res, 200, { ok: true, revision: runtime.revision, bootstrap: buildBootstrap(runtime) });
    }
  }

  return sendJson(res, 404, { error: 'API yolu bulunamadı.' });
}

function consoleState() {
  return {
    ok: true,
    revision: runtime.revision,
    schema: META.schema,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_API_KEY ? GEMINI_MODEL : null,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    clients: clients.size,
    history: revisions.slice(0, 20),
    runtime: {
      revision: runtime.revision,
      season: runtime.season,
      theme: runtime.theme,
      announcement: runtime.announcement,
      featuredCase: runtime.featuredCase,
      blockCount: runtime.homeBlocks?.length || 0,
      extraCases: (runtime.extraCases || []).map((c) => ({ id: c.id, code: c.code, title: c.title, phase: c.phase })),
    },
    bootstrap: buildBootstrap(runtime),
  };
}

function statsPayload() {
  const byType = {};
  const byCase = {};
  for (const event of events) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    if (event.caseId) byCase[event.caseId] = (byCase[event.caseId] || 0) + 1;
  }
  return {
    totalEvents: events.length,
    byType,
    byCase,
    activeSessions: clients.size,
    revisions: revisions.slice(0, 20),
    recentEvents: events.slice(-24).reverse(),
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    revision: runtime.revision,
  };
}

// ---------------------------------------------------------------- runtime store

async function bootStore() {
  await mkdir(DATA_DIR, { recursive: true });
  runtime = defaultRuntime();
  try {
    if (existsSync(STORE_FILE)) {
      const parsed = JSON.parse(await readFile(STORE_FILE, 'utf8'));
      if (parsed?.runtime) {
        runtime = { ...runtime, ...parsed.runtime };
        runtime.homeBlocks = Array.isArray(parsed.runtime.homeBlocks) && parsed.runtime.homeBlocks.length ? parsed.runtime.homeBlocks : runtime.homeBlocks;
        runtime.extraCases = Array.isArray(parsed.runtime.extraCases) ? parsed.runtime.extraCases : [];
        revisions = Array.isArray(parsed.revisions) ? parsed.revisions.slice(0, 50) : [];
      }
    }
  } catch (error) {
    console.warn('[PRIMER] runtime dosyası okunamadı, varsayılan kullanılıyor:', error.message);
  }
  if (!revisions.length) {
    revisions = [{ revision: runtime.revision, at: new Date().toISOString(), reason: 'Sunucu başlatıldı' }];
  }
  try {
    if (existsSync(EVENTS_FILE)) {
      const raw = (await readFile(EVENTS_FILE, 'utf8')).split('\n').filter(Boolean);
      const parsed = raw.slice(-1000).map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
      events = parsed;
    }
  } catch (error) {
    console.warn('[PRIMER] olay dosyası okunamadı:', error.message);
  }
  await saveStore();
}

async function saveStore() {
  const tmp = `${STORE_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify({ runtime, revisions }, null, 2), 'utf8');
  await rename(tmp, STORE_FILE);
}

function publish(reason, mutate) {
  mutate(runtime);
  runtime.revision = (runtime.revision || 0) + 1;
  revisions = [{ revision: runtime.revision, at: new Date().toISOString(), reason }, ...revisions].slice(0, 50);
  saveStore().catch((error) => console.warn('[PRIMER] kayıt hatası:', error.message));
  broadcast({ revision: runtime.revision, at: new Date().toISOString(), reason });
}

function broadcast(payload) {
  for (const client of clients) {
    try {
      writeRevision(client, payload);
    } catch {
      clients.delete(client);
    }
  }
}

function writeRevision(res, payload) {
  res.write(`event: revision\ndata: ${JSON.stringify(payload)}\n\n`);
}

setInterval(() => {
  for (const client of clients) {
    try {
      client.write(': ping\n\n');
    } catch {
      clients.delete(client);
    }
  }
}, 25_000).unref();

// ---------------------------------------------------------------- static files

async function serveStatic(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) return sendText(res, 405, 'Yöntem desteklenmiyor');
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const allowed =
    file === 'index.html' ||
    file === 'manifest.webmanifest' ||
    file === 'sw.js' ||
    file === 'favicon.svg' ||
    ['README.md', 'SPEC.md', 'PITCH.md'].includes(file) ||
    /^(js|shared|css|icons|assets)\//.test(file);
  if (!allowed) return sendText(res, 404, 'Bulunamadı');
  const absolute = resolve(ROOT, file);
  if (absolute !== ROOT && !absolute.startsWith(ROOT + sep)) return sendText(res, 404, 'Bulunamadı');
  if (!existsSync(absolute)) return sendText(res, 404, 'Bulunamadı');
  let body;
  try {
    body = await readFile(absolute);
  } catch {
    return sendText(res, 404, 'Bulunamadı');
  }
  const ext = extname(absolute).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': ext === '.png' || ext === '.svg' ? 'public, max-age=86400' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  res.end(body);
}

// ---------------------------------------------------------------- helpers

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function sendText(res, status, text) {
  const body = Buffer.from(text);
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'content-length': body.length });
  res.end(body);
}

async function readJson(req, limit) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      const error = new Error('İstek gövdesi çok büyük.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Geçersiz JSON.');
    error.status = 400;
    throw error;
  }
}

function checkConsole(req) {
  const code = String(req.headers['x-console-code'] || '');
  return code.length > 0 && code === CONSOLE_CODE;
}

function sanitizeEvent(body) {
  if (!body || typeof body !== 'object') return null;
  const type = String(body.type || '').trim().slice(0, 40);
  if (!/^[a-z0-9_-]{3,40}$/i.test(type)) return null;
  const allowed = ['caseId', 'actionId', 'hypothesisId', 'correct', 'grade', 'score', 'xp', 'daily', 'replay', 'track', 'avatar', 'dailyCase'];
  const clean = { type, at: new Date().toISOString() };
  for (const key of allowed) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value === 'string') clean[key] = value.slice(0, 80);
    else if (typeof value === 'number' || typeof value === 'boolean') clean[key] = value;
  }
  return clean;
}

function caseExists(id) {
  return Boolean(getCase(id) || runtime.extraCases?.some((c) => c.id === id));
}

function describePatch(patch) {
  if (patch.extraCase) return `Yeni vaka: ${patch.extraCase.code || patch.extraCase.id}`;
  if (patch.homeBlocks) return 'Tam düzen değişimi';
  if (patch.appendBlocks) return `Düzen genişletildi (+${patch.appendBlocks.length} blok)`;
  if (patch.theme) return 'Tema güncellendi';
  if (patch.season) return 'Sezon güncellendi';
  if (patch.announcement) return 'Duyuru yayınlandı';
  if (patch.featuredCase) return `Öne çıkan vaka: ${patch.featuredCase}`;
  return 'Kontrol Odası güncellemesi';
}

function localMentor(body = {}) {
  const found = Array.isArray(body.evidence) ? body.evidence.length : 0;
  const total = Number(body.evidenceTotal || 0);
  const left = Number(body.turnsLeft || 0);
  if (!found) {
    return 'Masada henüz kanıt yok. Önce loglara veya koda bak; müdahale etmeden önce en az bir iz topla. Kalan hamleni sayarak ilerle.';
  }
  if (total && found < total) {
    return `Elinde ${found}/${total} kanıt var. Eksik kanıt, teşhisi tahmine çevirir; önce en ucuz incelemeyi tamamla. Sonra tek bir düzeltme zinciri seç.`;
  }
  if (left <= 2) {
    return 'Tüm kanıtlar masada ve hamlen azalıyor. Artık yeni inceleme değil, doğru düzeltme zincirini sırayla uygula. Durum bilgisini de yayınla.';
  }
  return 'Kanıt kapsamın iyi. Hipotezini tek cümleyle yaz ve yalnızca onu doğrulayan düzeltmeleri uygula. Riskli geri almayı ancak veri kaybı yoksa düşün.';
}

async function callGemini({ system, prompt, maxTokens = 400, json = false }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY yok');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(14_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}${text ? `: ${text.slice(0, 140)}` : ''}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini boş yanıt döndürdü');
  return text;
}

function extractBlock(raw) {
  const cleaned = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      if (parsed.block && typeof parsed.block === 'object') return parsed.block;
      if (parsed.type) return parsed;
      if (Array.isArray(parsed.blocks) && parsed.blocks[0]) return parsed.blocks[0];
    }
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function localBlock(prompt) {
  const text = trunc(prompt.replace(/\s+/g, ' ').trim(), 210);
  const p = prompt.toLowerCase();
  if (/(not|hatırlat|ipucu)/.test(p)) {
    return { type: 'note', text: trunc(`Ajan notu: ${text}`, 250) };
  }
  if (/(kriz|kırmızı|olay|kesinti|acil)/.test(p)) {
    return {
      type: 'banner',
      tone: 'warn',
      title: 'AJAN BİLDİRİMİ // OLAY',
      text: trunc(`Canlı yayın: ${text}`, 250),
      cta: { label: 'Nöbeti devral', action: 'random-case' },
    };
  }
  if (/(modül|yol|seviye|kilit)/.test(p)) {
    return {
      type: 'module',
      title: 'AJAN MODÜLÜ',
      icon: 'spark',
      minLevel: 2,
      body: trunc(text, 205),
      cta: { label: 'Kütüphaneyi aç', action: 'nav', to: 'library' },
    };
  }
  if (/(veri|metrik|istatistik|sayı)/.test(p)) {
    return {
      type: 'stats',
      title: 'AJAN VERİSİ',
      items: [
        { label: 'Canlı revizyon', value: String(runtime.revision) },
        { label: 'Aktif vaka', value: String(CASES.length + (runtime.extraCases?.length || 0)) },
        { label: 'Ajan bloğu', value: String((runtime.homeBlocks?.length || 0) + 1) },
      ],
    };
  }
  if (/(başlık|hero|karşılama)/.test(p)) {
    return {
      type: 'hero',
      eyebrow: 'AJAN TARAFINDAN',
      title: 'Sunucu yeni bir karşılama yayınladı.',
      body: trunc(text, 250),
      cta: { label: 'Günün vardiyası', action: 'daily' },
    };
  }
  return {
    type: 'banner',
    tone: 'success',
    title: 'AJAN GÜNCELLEMESİ',
    text: trunc(`İstek işlendi: ${text}`, 250),
    cta: { label: 'Vakalara bak', action: 'nav', to: 'library' },
  };
}

function trunc(value, max) {
  const s = String(value || '');
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

function loadDotEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  try {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* .env optional */
  }
}

export { server };

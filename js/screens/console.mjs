import { esc, formatDate, icon, logo, sectionHead } from '../ui.mjs';

const SAMPLE_PATCH = {
  theme: { accent: '#5ef2c0', accent2: '#59d7ff', bg: '#080d16' },
  season: { tag: 'SEZON 01 • CANLI', name: 'Sıfırıncı Gün' },
  announcement: {
    tone: 'info',
    title: 'KONTROL ODASI',
    text: 'Bu duyuru yeniden yükleme olmadan tüm istemcilere itildi.',
  },
  appendBlocks: [
    {
      type: 'note',
      text: 'Sunucudan gelen yeni not: bu blok çalışma zamanında eklendi.',
    },
  ],
};

export function renderConsole(app) {
  const c = app.state.console;
  const b = app.state.bootstrap;
  if (!c.authed) return renderGate(app, c);
  const server = c.server || {};
  const stats = c.stats || {};
  const revision = server.revision ?? b.revision;
  const gemini = Boolean(server.gemini);
  return `<div class="console-screen">
    <header class="console-head">
      <div class="console-brand">${logo({ compact: true })}<span class="console-tag">KONTROL ODASI</span></div>
      <div class="console-actions">
        <span class="live-pill"><i></i> REV ${revision}</span>
        <button class="icon-btn" data-action="console-refresh" aria-label="Sunucu durumunu yenile" ${c.busy ? 'disabled' : ''}>${icon('swap', 15)}</button>
        <button class="icon-btn" data-action="console-close" aria-label="Kontrol odasını kapat">${icon('x', 16)}</button>
      </div>
    </header>

    <div class="console-statusbar">
      <span class="source-dot source-live"></span>
      <span>SUNUCU ÇEVRİMİÇİ</span>
      <span>GEMINI: ${gemini ? 'AÇIK' : 'YEREL FALLBACK'}</span>
      <span>${stats.activeSessions ?? server.clients ?? 0} izleyici</span>
      <span>${stats.totalEvents ?? 0} olay</span>
      <span class="console-clock" id="console-clock">${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>

    <div class="console-tabs" role="tablist">
      ${tab('layout', 'Düzen', 'list', c.tab)}
      ${tab('ai', 'AI Blok', 'spark', c.tab)}
      ${tab('case', 'Vaka', 'bug', c.tab)}
      ${tab('metrics', 'İzleme', 'chart', c.tab)}
    </div>

    ${c.busy ? `<div class="console-busy"><span class="loader small"></span> Sunucuya yazılıyor…</div>` : ''}
    ${c.error ? `<div class="console-msg error">${icon('alert', 13)} ${esc(c.error)}</div>` : ''}
    ${c.message ? `<div class="console-msg ok">${icon('check', 13)} ${esc(c.message)}</div>` : ''}

    <main class="console-main">
      ${c.tab === 'layout' ? renderLayout(app, c, server, stats) : ''}
      ${c.tab === 'ai' ? renderAi(app, c, server) : ''}
      ${c.tab === 'case' ? renderCaseUpload(app, c) : ''}
      ${c.tab === 'metrics' ? renderMetrics(app, c, server, stats) : ''}
    </main>

    <footer class="console-foot">
      <span>${logo({ compact: true })}</span>
      <span>Ayarlar <code>.data/runtime.json</code> içinde kalıcıdır.</span>
      <button class="text-btn danger-text" data-action="console-reset">${icon('undo', 12)} Sunucuyu sıfırla</button>
    </footer>
  </div>`;
}

function renderGate(app, c) {
  return `<div class="console-screen console-gate">
    <header class="console-head">
      <div class="console-brand">${logo({ compact: true })}<span class="console-tag">KONTROL ODASI</span></div>
      <button class="icon-btn" data-action="console-close" aria-label="Kapat">${icon('x', 16)}</button>
    </header>
    <div class="gate-card">
      <div class="gate-visual">
        <span class="gate-glyph">${icon('terminal', 46)}</span>
        <span class="mono muted">1995 // SUNUCU GÜDÜMLÜ ARAYÜZ</span>
      </div>
      <span class="kicker">YETKİLİ ERİŞİM</span>
      <h1>Kontrol Odası’na gir.</h1>
      <p>Buradan yayınlanan her değişiklik sunucudaki şemayı günceller; açık olan telefonlar yeniden yüklenmeden yeni arayüzü alır.</p>
      <label class="field">
        <span class="field-label">Operatör kodu</span>
        <input id="console-code" type="password" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="••••" value="${esc(c.code)}" />
      </label>
      <p class="console-hint">Demo kodu: <code>1995</code></p>
      ${c.error ? `<p class="console-msg error">${icon('alert', 13)} ${esc(c.error)}</p>` : ''}
      <button class="btn btn-primary btn-wide" data-action="console-auth" ${c.busy ? 'disabled' : ''}>${c.busy ? 'Bağlanıyor…' : `Sistemi aç ${icon('arrow', 14)}`}</button>
      <div class="gate-list">
        <span>${icon('list', 13)} Düzen presetleri ve JSON patch</span>
        <span>${icon('spark', 13)} Gemini ile yeni blok üretimi</span>
        <span>${icon('bug', 13)} Yeniden derleme olmadan vaka yayını</span>
      </div>
    </div>
    <footer class="console-foot"><span>Yetkisiz erişim yerel demoda kapalıdır; gerçek üründe SSO ve rol gerekir.</span></footer>
  </div>`;
}

function tab(id, label, ic, current) {
  return `<button class="console-tab ${current === id ? 'on' : ''}" role="tab" aria-selected="${current === id}" data-action="console-tab" data-tab="${id}">${icon(ic, 14)} ${label}</button>`;
}

function renderLayout(app, c, server, stats) {
  const sample = c.jsonDraft ?? JSON.stringify(SAMPLE_PATCH, null, 2);
  return `<div class="console-grid">
    <section class="console-panel wide">
      ${sectionHead('CANLI DÜZEN', 'Tek tıkla deneyimi değiştir', `<span class="mono muted">${PRESETS.length} preset</span>`)}
      <p class="console-lead">Bir preset seç. Sunucu revizyonu artırır, SSE ile tüm açık istemcilere yeni düzeni iter. Telefon kendiliğinden güncellenir.</p>
      <div class="preset-grid">
        ${PRESETS.map((p) => `<article class="preset-card" style="--preset:${p.accent}">
          <div class="preset-swatch"><i></i><i></i><i></i></div>
          <span class="kicker">${esc(p.tag)}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.desc)}</p>
          <button class="btn btn-small btn-ghost" data-action="console-preset" data-preset="${p.id}" ${c.busy ? 'disabled' : ''}>Yayınla ${icon('arrow', 12)}</button>
        </article>`).join('')}
      </div>
    </section>

    <section class="console-panel">
      ${sectionHead('ÇALIŞMA ZAMANI', 'Sunucu durumu')}
      <div class="console-kv">
        <div><span>Revizyon</span><strong>${server.revision ?? '—'}</strong></div>
        <div><span>Şema</span><strong>SDU v${app.state.bootstrap.schema}</strong></div>
        <div><span>Blok</span><strong>${app.state.bootstrap.homeBlocks?.length || 0}</strong></div>
        <div><span>Vaka</span><strong>${app.state.bootstrap.cases?.length || 0}</strong></div>
        <div><span>Gemini</span><strong>${server.gemini ? 'Hazır' : 'Anahtar yok'}</strong></div>
        <div><span>Çalışma</span><strong>${Math.round((server.uptimeSec || 0) / 60)} dk</strong></div>
      </div>
      <p class="fine">API anahtarı yalnızca sunucuda tutulur. İstemciye hiçbir sır gönderilmez.</p>
    </section>

    <section class="console-panel wide">
      ${sectionHead('HAM PATCH', 'JSON şeması gönder', `<span class="mono muted">doğrulamalı</span>`)}
      <p class="console-lead">Desteklenen alanlar: <code>theme</code>, <code>season</code>, <code>announcement</code>, <code>homeBlocks</code>, <code>appendBlocks</code>, <code>featuredCase</code>, <code>extraCase</code>. Sunucu şemayı doğrulamadan hiçbir şeyi yayınlamaz.</p>
      <textarea id="console-json" class="console-editor" spellcheck="false" rows="16">${esc(sample)}</textarea>
      <div class="console-btnrow">
        <button class="btn btn-primary" data-action="console-apply-json" ${c.busy ? 'disabled' : ''}>${icon('play', 13)} Patch’i yayınla</button>
        <button class="btn btn-ghost" data-action="console-refresh" ${c.busy ? 'disabled' : ''}>${icon('swap', 13)} Revizyonu yenile</button>
      </div>
    </section>

    <section class="console-panel">
      ${sectionHead('YAYIN GEÇMİŞİ', 'Son revizyonlar')}
      ${renderRevisions(stats)}
    </section>
  </div>`;
}

function renderAi(app, c, server) {
  const prompt = c.promptDraft || '';
  return `<div class="console-grid">
    <section class="console-panel wide ai-panel">
      ${sectionHead('AJAN GÜDÜMLÜ ARAYÜZ', 'Gemini ile yeni blok üret', `<span class="live-pill ${server.gemini ? '' : 'muted-pill'}"><i></i> ${server.gemini ? 'GEMINI HAZIR' : 'ANAHTAR YOK'}</span>`)}
      <p class="console-lead">İstediğin duyuru veya modülü yaz. Sunucu, Gemini’den <strong>şemaya uygun tek bir blok</strong> ister; gelen blok doğrulanır, düzenin sonuna eklenir ve canlı yayınlanır. Anahtar yoksa aynı sözleşmeyle çalışan yerel şema motoru devreye girer.</p>
      <div class="prompt-examples">
        ${[
          'Kriz modunu duyuran kırmızı bir banner ekle ve rastgele vardiya butonu koy.',
          'Sezon finali için mor temalı bir duyuru ve yol haritası bloğu üret.',
          'Yeni başlayanlara kanıt toplamayı hatırlatan kısa bir not ekle.',
        ].map((p) => `<button class="prompt-chip" data-action="console-fill-prompt" data-prompt="${esc(p)}">“${esc(p)}”</button>`).join('')}
      </div>
      <textarea id="console-prompt" class="console-editor prompt-editor" rows="5" placeholder="Örn: Yeni sezonu duyuran bir banner ve öne çıkan vaka bloğu ekle.">${esc(prompt)}</textarea>
      <div class="console-btnrow">
        <button class="btn btn-primary" data-action="console-generate" ${c.busy ? 'disabled' : ''}>${icon('spark', 13)} Blok üret ve yayınla</button>
      </div>
      ${!server.gemini ? `<div class="console-note">${icon('info', 14)} <code>GEMINI_API_KEY</code> tanımlı değil. Yerel motor deterministik blok üretir; demo yine çalışır. Anahtarı sunucuda tanımladığında aynı buton Gemini’yi kullanır.</div>` : ''}
    </section>

    <section class="console-panel">
      ${sectionHead('NEDEN GÜVENLİ?', 'Ajan çıktısı = veri')}
      <ul class="console-list">
        <li>${icon('shield', 13)} Model yalnızca JSON döndürür; HTML veya script çalıştıramaz.</li>
        <li>${icon('check', 13)} Blok tipi, uzunluk ve alanlar sunucuda yeniden doğrulanır.</li>
        <li>${icon('terminal', 13)} Bilinmeyen tip reddedilir; yayın revizyonu artmaz.</li>
        <li>${icon('users', 13)} Değişiklik tüm istemcilere SSE ile itilir; uygulama güncellemesi yok.</li>
      </ul>
    </section>
  </div>`;
}

function renderCaseUpload(app, c) {
  const draft = c.caseDraft || '';
  return `<div class="console-grid">
    <section class="console-panel wide">
      ${sectionHead('İÇERİK HOT-SWAP', 'Yeniden derleme olmadan vaka yayınla', `<span class="mono muted">şema doğrulamalı</span>`)}
      <p class="console-lead">Vaka JSON’u <code>validateCase</code> denetiminden geçer. Yeni vaka anında kütüphaneye düşer ve <code>/api/case/:id</code> üzerinden oynanabilir. Uygulama paketi değişmez.</p>
      <textarea id="console-case" class="console-editor case-editor" spellcheck="false" rows="18" placeholder="Vaka JSON’u yapıştır…">${esc(draft)}</textarea>
      <div class="console-btnrow">
        <button class="btn btn-ghost" data-action="console-fill-demo">${icon('flask', 13)} Örnek vakayı doldur</button>
        <button class="btn btn-primary" data-action="console-upload-case" ${c.busy ? 'disabled' : ''}>${icon('cloud', 13)} Vakayı yayınla</button>
      </div>
      <div class="console-note">${icon('info', 14)} Örnek vaka <strong>c19</strong>; dört yıllık kariyerin 4. yılına eklenir. Aynı id tekrar yayınlanırsa sunucu yeni sürümü ekler ve eski kayıt gölgede kalır.</div>
    </section>
    <section class="console-panel">
      ${sectionHead('DOĞRULAMA', 'Neler kontrol edilir?')}
      <ul class="console-list">
        <li>${icon('check', 13)} Zorunlu başlık, alt başlık, yıl, süre ve vital değerleri.</li>
        <li>${icon('check', 13)} Tam 3 hipotez ve tek doğru cevap.</li>
        <li>${icon('check', 13)} Eylem kimlikleri, ihtiyaç duydukları kanıtlar ve düzeltme zinciri.</li>
        <li>${icon('check', 13)} Tüm kanıtların erişilebilir olması (universal veya reveal).</li>
        <li>${icon('alert', 13)} Hatalı vaka reddedilir; mevcut yayın bozulmaz.</li>
      </ul>
    </section>
  </div>`;
}

function renderMetrics(app, c, server, stats) {
  const byType = stats.byType || {};
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return `<div class="console-grid">
    <section class="console-panel wide">
      ${sectionHead('ANONİM OLAYLAR', 'Ürün sinyalleri', `<span class="mono muted">${stats.totalEvents || 0} olay</span>`)}
      <div class="event-bars">
        ${entries.length ? entries.map(([type, count]) => `<div class="event-row"><span class="mono">${esc(type)}</span><span class="event-bar"><i style="width:${(count / max) * 100}%"></i></span><strong>${count}</strong></div>`).join('') : `<p class="muted">Henüz olay yok. Bir vaka aç, rapor üret; burada birikecek.</p>`}
      </div>
      <p class="fine">Kişisel veri, serbest metin veya token gönderilmez. Sunucu yalnızca tür, vaka id’si, not, süre gibi alanları saklar.</p>
    </section>

    <section class="console-panel">
      ${sectionHead('BAĞLANTI', 'Canlı istemciler')}
      <div class="big-stat"><strong>${stats.activeSessions ?? server.clients ?? 0}</strong><span>SSE bağlantısı</span></div>
      <div class="console-kv">
        <div><span>Revizyon</span><strong>${server.revision ?? '—'}</strong></div>
        <div><span>Olay</span><strong>${stats.totalEvents || 0}</strong></div>
        <div><span>Güncelleme</span><strong>${formatDate(new Date().toISOString())}</strong></div>
      </div>
    </section>

    <section class="console-panel wide">
      ${sectionHead('SON OLAYLAR', 'Ham akış')}
      ${(stats.recentEvents || []).length ? `<div class="event-table">
        <div class="event-table-head"><span>ZAMAN</span><span>TÜR</span><span>DETAY</span></div>
        ${(stats.recentEvents || []).slice(0, 14).map((e) => `<div class="event-table-row"><span class="mono">${new Date(e.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span>${esc(e.type || '?')}</span><span class="muted">${esc(detailOf(e))}</span></div>`).join('')}
      </div>` : `<p class="muted">Akış boş. Uygulamayı kullanmaya başladığında burada olaylar görünür.</p>`}
    </section>

    <section class="console-panel">
      ${sectionHead('REVİZYONLAR', 'Yayın geçmişi')}
      ${renderRevisions(stats)}
    </section>
  </div>`;
}

function renderRevisions(stats) {
  const list = stats.revisions || [];
  if (!list.length) return `<p class="muted">Henüz yayın yok. Bir preset uygula.</p>`;
  return `<div class="revision-list">${list.slice(0, 8).map((r) => `<div class="revision-row"><span class="rev-no">#${r.revision}</span><div><strong>${esc(r.reason || 'Güncelleme')}</strong><span class="muted mono">${new Date(r.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></div></div>`).join('')}</div>`;
}

function detailOf(e) {
  const bits = [];
  for (const key of ['caseId', 'actionId', 'grade', 'score', 'dailyCase', 'track']) {
    if (e[key] !== undefined) bits.push(`${key}=${e[key]}`);
  }
  return bits.join(' · ') || '—';
}

const PRESETS = [
  {
    id: 'calm',
    name: 'Sakin Üs',
    tag: 'DÜZEN 01',
    accent: '#5ef2c0',
    desc: 'Yeşil tema, sakin duyuru, varsayılan bloklar. Yeni kullanıcı karşılaması için.',
  },
  {
    id: 'incident',
    name: 'Kriz Modu',
    tag: 'DÜZEN 02',
    accent: '#ff8fab',
    desc: 'Kırmızı tema, canlı olay duyurusu, nöbet banner’ı ve zorunlu olay vakası.',
  },
  {
    id: 'finale',
    name: 'Sezon Finali',
    tag: 'DÜZEN 03',
    accent: '#a78bfa',
    desc: 'Mor tema, mimar yolu ve 4. yıl vitrin vakası. Sunucu tarafı sezon finali.',
  },
];

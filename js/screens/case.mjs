import { phaseForXp } from '../../shared/meta.mjs';
import { evidenceLabel, totalEvidence } from '../../shared/content.mjs';
import { actionAvailability, actionsFor, hypothesisState } from '../engine.mjs';
import { esc, gradeBadge, icon, sceneCanvas, skillChips, stars, vitalBar } from '../ui.mjs';
import { colorForSeed } from '../sprites.mjs';

const CATS = [
  ['all', 'Tümü', 'menu'],
  ['investigate', 'İncele', 'search'],
  ['fix', 'Müdahale', 'wrench'],
  ['comm', 'İletişim', 'users'],
  ['risky', 'Riskli', 'alert'],
  ['flavor', 'Mola', 'coffee'],
];

const EVIDENCE = ['logs', 'metrics', 'code', 'git', 'teammate', 'docs'];

export function renderCase(app) {
  const c = app.state.caseDef;
  const run = app.state.run;
  const p = app.state.profile;
  if (!c || !run) return `<div class="loading-screen"><div class="loader"></div><p>Vardiya yükleniyor…</p></div>`;
  const summary = app.summaryFor(c.id) || c;
  const color = colorForSeed(c.avatar || c.id);
  const hs = hypothesisState(c, run);
  const allActions = actionsFor(c);
  const filter = app.state.caseFilter || 'all';
  const actions = filter === 'all' ? allActions : allActions.filter((a) => a.cat === filter);
  const found = run.evidence || [];
  const evidenceTotal = totalEvidence(c) || 1;
  const statusLabel = run.status === 'won' ? 'ÇÖZÜLDÜ' : run.status === 'lost' ? (run.lostReason === 'ended' ? 'KAPANDI' : 'KESİNTİ') : 'CANLI';
  const spent = Math.max(0, run.turns - run.turnsLeft);
  return `<div class="case-screen">
    <header class="case-topbar">
      <button class="icon-btn" data-action="case-back" aria-label="Geri">${icon('chevron', 18)}</button>
      <div class="case-topmid"><span class="mono">${esc(c.code)}</span><span class="case-status status-${run.status}"><i></i>${statusLabel}</span></div>
      <button class="icon-btn" data-action="ask-mentor" aria-label="Mentora sor">${icon('users', 17)}</button>
    </header>

    <div class="case-scene">
      ${sceneCanvas({ art: c.art, seed: c.avatar, color, accent: app.accent(), status: run.status, live: run.status === 'active' })}
      <div class="scene-overlay">
        <span class="scene-code">${esc(c.code)}</span>
        <span class="scene-phase">${esc(phaseForXp(p.xp || 0).code)}</span>
      </div>
      <div class="scene-caption">
        <span class="mascot-name">${esc(c.mascot || c.title)}</span>
        <span class="mono">${esc(c.role || '')}</span>
      </div>
    </div>

    <div class="case-head">
      <div class="case-kicker"><span>${esc(c.discipline)}</span><span>${stars(c.difficulty)}</span><span>${icon('clock', 11)} ${c.minutes} dk</span></div>
      <h1>${esc(c.title)}</h1>
      <p>${esc(c.subtitle)}</p>
      <div class="case-meta">${skillChips(c.skills)}${run.assist?.label ? `<span class="assist-chip">${icon(run.assist.tone === 'support' ? 'heart' : 'bolt', 11)} ${esc(run.assist.label)}</span>` : ''}${app.state.activeRun?.daily ? `<span class="daily-chip">GÜNLÜK +%25</span>` : ''}</div>
      <div class="objective-box"><span class="kicker">GÖREV</span><p>${esc(c.objective)}</p></div>
    </div>

    <section class="vitals-grid" aria-label="Sistem durumu">
      ${vitalBar('build', run.vitals.build)}
      ${vitalBar('perf', run.vitals.perf)}
      ${vitalBar('trust', run.vitals.trust)}
      ${vitalBar('team', run.vitals.team)}
    </section>

    ${run.status !== 'active' ? renderResolution(app, c, run) : ''}

    <section class="panel hypothesis-panel">
      <div class="panel-title-row">
        <div><span class="kicker">TEŞHİS</span><h2>Hipotez masası</h2></div>
        ${hs.unlocked ? `<span class="mono muted">${found.length} kanıt</span>` : `<span class="lock-chip">${icon('lock', 11)} LV 3</span>`}
      </div>
      ${!hs.unlocked ? `<p class="muted">Seviye 3’te açılır. O zamana kadar kanıt topla; sistem teşhisini yine puanlar.</p>` : found.length < 2 ? `<p class="muted">${icon('search', 12)} En az 2 kanıt toplayınca hipotezini seçebilirsin.</p>` : `<div class="hypothesis-options">${(c.hypotheses || []).map((h) => {
        const selected = run.hypothesis === h.id;
        const showState = selected && (hs.correct || hs.canRevise);
        return `<button class="hypothesis ${selected ? 'selected' : ''} ${selected && hs.correct ? 'correct' : ''} ${selected && !hs.correct ? 'wrong' : ''}" data-action="choose-hypothesis" data-id="${esc(h.id)}" ${selected && !hs.canRevise ? 'disabled' : ''}>
          <span class="hyp-dot"></span><span>${esc(h.text)}</span>${selected ? icon(hs.correct ? 'check' : 'alert', 14) : ''}
        </button>`;
      }).join('')}</div>${run.hypothesis && !hs.correct ? `<p class="hyp-note">${hs.canRevise ? 'Yeni kanıt buldun. Hipotezini revize edebilirsin.' : 'Bu hipotez kanıtlarla uyuşmuyor. Yeni kanıt bulunca revize edebilirsin.'}</p>` : ''}${hs.correct ? `<p class="hyp-note ok">${icon('check', 12)} Hipotez kaydedildi. Doğru teşhis raporda +30 puan.</p>` : ''}`}
    </section>

    <section class="panel evidence-panel">
      <div class="panel-title-row">
        <div><span class="kicker">KANIT PANOSU</span><h2>Masada ne var?</h2></div>
        <span class="mono muted">${found.length}/${evidenceTotal}</span>
      </div>
      <div class="evidence-grid">
        ${EVIDENCE.filter((key) => c.clues?.[key]).map((key) => {
          const has = found.includes(key);
          return `<button class="evidence ${has ? 'found' : ''}" data-action="${has ? 'view-evidence' : 'missing-evidence'}" data-key="${key}" aria-label="${esc(evidenceLabel(c, key))}${has ? ', kanıtı aç' : ', henüz bulunmadı'}">
            <span class="evidence-icon">${icon(has ? 'check' : 'search', 12)}</span>
            <span>${esc(evidenceLabel(c, key))}</span>
          </button>`;
        }).join('')}
      </div>
      <button class="btn btn-small btn-ghost mentor-btn" data-action="ask-mentor">${icon('users', 13)} Mentor’a sor <span class="muted">(ipucu −3 puan)</span></button>
    </section>

    <section class="action-panel">
      <div class="action-head">
        <div><span class="kicker">EYLEM DESTESİ</span><h2>Ne yapacaksın?</h2></div>
        <span class="mono muted">${run.turnsLeft} adım</span>
      </div>
      <div class="cat-tabs" role="tablist" aria-label="Eylem kategorileri">
        ${CATS.map(([id, label, ic]) => {
          const count = id === 'all' ? allActions.length : allActions.filter((a) => a.cat === id).length;
          return `<button class="cat-tab ${filter === id ? 'on' : ''}" data-action="case-filter" data-filter="${id}" role="tab" aria-selected="${filter === id}">${icon(ic, 12)} ${label}<span>${count}</span></button>`;
        }).join('')}
      </div>
      <div class="action-list">
        ${actions.map((a) => renderAction(app, c, run, a)).join('')}
      </div>
    </section>

    <section class="terminal-panel">
      <div class="terminal-head"><span>${icon('terminal', 12)} VARDİYA KAYDI</span><span class="mono">${run.used.length} hamle</span></div>
      <div class="terminal-feed" id="terminal-feed">
        ${run.history.length ? run.history.slice(-4).map((h) => `<div class="log-entry">
          <span class="log-time">${new Date(h.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
          <div><strong>${esc(h.label)}</strong><pre>${esc(h.log)}</pre>${h.fxText ? `<span class="fx">${esc(h.fxText)}</span>` : ''}</div>
        </div>`).join('') : `<div class="log-empty">> Vardiya başladı. İlk hamleni seç.<span class="caret">_</span></div>`}
      </div>
    </section>

    <div class="case-sticky">
      <div class="turn-meter"><span class="mono">${spent}/${run.turns} HAMLE</span><div class="pips">${Array.from({ length: run.turns }, (_, i) => `<i class="${i < spent ? 'on' : ''} ${i >= run.turns - Math.max(0, run.assist?.turns || 0) ? 'bonus' : ''}"></i>`).join('')}</div></div>
      ${run.status === 'active' ? `<button class="btn btn-primary" data-action="end-case">Vardiyayı bitir</button>` : `<button class="btn btn-primary" data-action="open-report">Raporu aç ${icon('arrow', 13)}</button>`}
    </div>
  </div>`;
}

function renderAction(app, c, run, a) {
  const av = actionAvailability(c, run, a);
  const critical = (c.fixChain || []).includes(a.id);
  const needs = a.needs?.length ? `<span class="action-needs">${a.needs.map((k) => evidenceLabel(c, k)).join(' + ')}</span>` : '';
  const flags = a.needsFlags?.length && av.reason ? `<span class="action-needs">${esc(av.reason)}</span>` : '';
  return `<button class="action-card cat-${a.cat} ${critical ? 'critical' : ''} ${!av.ok ? 'unavailable' : ''}" data-action="case-action" data-id="${esc(a.id)}" ${!av.ok ? 'disabled' : ''} aria-label="${esc(a.label)}${!av.ok ? `, ${esc(av.reason)}` : ''}">
    <span class="action-icon">${icon(a.icon || 'dot', 20)}</span>
    <span class="action-copy">
      <span class="action-top"><strong>${esc(a.label)}</strong>${critical ? `<em>KRİTİK</em>` : ''}</span>
      <span class="action-sub">${needs}${flags}${!av.ok && !needs && !flags ? `<span class="action-needs">${esc(av.reason)}</span>` : ''}${av.ok && a.cat === 'fix' ? 'Sistemi onarır' : ''}${av.ok && a.cat === 'investigate' ? 'Kanıt toplar' : ''}${av.ok && a.cat === 'comm' ? 'Güveni yönetir' : ''}${av.ok && a.cat === 'risky' ? 'Geri dönüşü olmayabilir' : ''}${av.ok && a.cat === 'flavor' ? 'Zaman harcar' : ''}</span>
    </span>
    <span class="action-cost">${a.cost || 1}<small>adım</small></span>
  </button>`;
}

function renderResolution(app, c, run) {
  const won = run.status === 'won';
  return `<section class="resolution ${won ? 'won' : 'lost'}">
    <div class="resolution-mark">${icon(won ? 'check' : 'alert', 24)}</div>
    <div class="resolution-copy">
      <span class="kicker">${won ? 'VARDİYA TAMAMLANDI' : 'VARDİYA KAPANDI'}</span>
      <h2>${won ? 'Sistem ayağa kalktı.' : run.lostReason === 'timeout' ? 'Hamle kalmadı. Sistem hâlâ kırık.' : run.lostReason === 'ended' ? 'Vardiyayı erken kapattın.' : 'Sistem çöktü.'}</h2>
      <p>${won ? 'Raporu aç; teşhisini, kanıtlarını ve telafi edilecek kararlarını gör.' : run.lostReason === 'ended' ? 'Sistem ayakta kalmış olabilir ama teşhis ve müdahale tamamlanmadı. Rapor, neyi masada bıraktığını gösterir.' : 'Bu bir vaka, kariyer değil. Hata analizini oku, sonra tekrar dene.'}</p>
    </div>
    <button class="btn btn-small ${won ? 'btn-primary' : 'btn-ghost'}" data-action="open-report">${won ? 'Raporu aç' : 'Analiz et'} ${icon('arrow', 12)}</button>
  </section>`;
}

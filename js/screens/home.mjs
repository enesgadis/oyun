import { LEADERBOARD_BOTS, PHASES, SKILLS, levelForXp, phaseForXp, todayKey } from '../../shared/meta.mjs';
import { GRADE_ORDER } from '../../shared/meta.mjs';
import { esc, formatDate, gradeBadge, icon, mascotImage, radarSvg, sceneCanvas, sectionHead, skillChips, stars, statBar, timeAgo, xpBar } from '../ui.mjs';
import { assistFor, levelProgress, phaseProgress, skillDeltaLabel } from '../engine.mjs';
import { colorForSeed } from '../sprites.mjs';

const PAIR_TYPES = new Set(['xp', 'next', 'radar', 'quick']);

export function renderHome(app) {
  const p = app.state.profile;
  const b = app.state.bootstrap;
  const level = levelForXp(p.xp || 0);
  const blocks = (b.homeBlocks || []).filter((block) => !block.minLevel || block.minLevel <= level);
  const daily = app.getDaily();
  const ann = b.announcement && app.state.dismissedAnnouncement !== b.revision ? b.announcement : null;
  const active = app.state.activeRun;
  return `<div class="home">
    ${active ? renderResume(app, active) : ''}
    ${ann ? renderAnnouncement(ann) : ''}
    ${renderHomeBlocks(blocks, app, { daily })}
    ${renderSysline(app)}
  </div>`;
}

// Consecutive dashboard cards share a two-up row on wide screens. Keeping the
// group in markup (instead of hard-coded grid rows) means a server update can
// add, remove or reorder blocks without leaving holes in the layout.
function renderHomeBlocks(blocks, app, ctx) {
  const out = [];
  let pair = [];
  const flush = () => {
    if (!pair.length) return;
    out.push(`<div class="home-pair">${pair.map((block) => renderBlock(app, block, ctx)).join('')}</div>`);
    pair = [];
  };
  for (const block of blocks) {
    if (block && PAIR_TYPES.has(block.type)) {
      pair.push(block);
    } else {
      flush();
      out.push(renderBlock(app, block, ctx));
    }
  }
  flush();
  return out.join('');
}

function renderAnnouncement(ann = {}) {
  return `<div class="announce announcement-${ann.tone || 'info'}" role="status">
    <div class="announce-icon">${icon(ann.tone === 'warn' ? 'alert' : ann.tone === 'success' ? 'check' : 'info', 16)}</div>
    <div class="announce-body"><strong>${esc(ann.title || 'SUNUCUDAN')}</strong><span>${esc(ann.text || '')}</span></div>
    <button class="icon-btn" aria-label="Duyuruyu kapat" data-action="dismiss-announcement">${icon('x', 14)}</button>
  </div>`;
}

function renderResume(app, active) {
  const c = app.summaryFor(active.caseId);
  if (!c) return '';
  const run = active.run || {};
  return `<div class="resume-card">
    <div class="resume-mark">${icon('play', 18)}</div>
    <div class="resume-copy">
      <span class="kicker">KALDIĞIN YER</span>
      <strong>${esc(c.code)} · ${esc(c.title)}</strong>
      <span class="muted">${Math.max(0, run.turnsLeft ?? c.turns)} hamle kaldı · ${active.daily ? 'günlük bonus' : 'aktif vardiya'}</span>
    </div>
    <button class="btn btn-small btn-primary" data-action="resume-case">Devam</button>
  </div>`;
}

function renderBlock(app, block, ctx) {
  if (!block || typeof block !== 'object') return '';
  const p = app.state.profile;
  const vars = app.vars();
  const level = levelForXp(p.xp || 0);
  switch (block.type) {
    case 'ticker':
      return `<div class="ticker" aria-label="Sistem akışı"><span class="ticker-label">${esc(block.label || 'CANLI')}</span><div class="ticker-track"><div class="ticker-inner">${(block.items || []).map((x) => `<span>${esc(app.template(x))}</span><i>◆</i>`).join('')}${(block.items || []).map((x) => `<span aria-hidden="true">${esc(app.template(x))}</span><i aria-hidden="true">◆</i>`).join('')}</div></div></div>`;
    case 'hero':
      return renderHero(app, block);
    case 'daily':
      return renderDaily(app, block, ctx.daily);
    case 'xp':
      return renderXp(app, block);
    case 'next':
      return renderNext(app, block, ctx.daily);
    case 'radar':
      return renderRadar(app, block);
    case 'quick':
      return renderQuick(app, block);
    case 'leaderboard':
      return renderLeaderboard(app, block);
    case 'module':
      return renderModule(app, block);
    case 'note':
      return `<div class="note-line"><span>${icon('info', 13)}</span><p>${esc(app.template(block.text || ''))}</p></div>`;
    case 'banner':
      return `<div class="live-banner tone-${esc(block.tone || 'info')}">
        <div class="live-banner-icon">${icon(block.tone === 'warn' ? 'alert' : block.tone === 'success' ? 'check' : 'spark', 20)}</div>
        <div><strong>${esc(app.template(block.title || ''))}</strong><p>${esc(app.template(block.text || ''))}</p>${block.cta ? `<button class="btn btn-small btn-ghost" data-action="${esc(block.cta.action || 'nav')}" ${block.cta.to ? `data-to="${esc(block.cta.to)}"` : ''}>${esc(block.cta.label)}</button>` : ''}</div>
      </div>`;
    case 'stats':
      return `<div class="panel stats-panel">${sectionHead('VERİ', esc(block.title || 'SİSTEM'))}
        <div class="mini-stats">${(block.items || []).map((it) => `<div><strong>${esc(it.value)}</strong><span>${esc(it.label)}</span></div>`).join('')}</div></div>`;
    case 'seasonPass':
      return renderSeasonPass(app, block);
    case 'divider':
      return `<div class="pixel-divider"><span>${esc(block.label || '')}</span></div>`;
    case 'oncall':
      return renderOnCall(app, block);
    default:
      return '';
  }
}

function renderHero(app, block) {
  const p = app.state.profile;
  return `<section class="hero-card">
    <div class="hero-grid" aria-hidden="true"></div>
    <div class="hero-top">
      <span class="kicker">${esc(app.template(block.eyebrow || 'YIL 1 • ÇIRAK'))}</span>
      <span class="hero-status"><i></i> VARDİYA AÇIK</span>
    </div>
    <h1>${esc(app.template(block.title))}</h1>
    <p>${esc(app.template(block.body || ''))}</p>
    <div class="hero-actions">
      <button class="btn btn-primary" data-action="${esc(block.cta?.action || 'daily')}">${esc(block.cta?.label || 'Günün vardiyası')} ${icon('arrow', 14)}</button>
      <button class="btn btn-ghost" data-action="random-case">${icon('spark', 14)} Rastgele</button>
    </div>
    <div class="hero-mascot" aria-hidden="true">${mascotImage('mentor', 64)}</div>
    <div class="hero-foot">
      <span>${icon('flame', 12)} ${p.streak?.count || 0} günlük seri</span>
      <span>${icon('bolt', 12)} ${assistFor(p).label || 'Seviye uyarlaması aktif'}</span>
    </div>
  </section>`;
}

function renderDaily(app, block, daily) {
  const p = app.state.profile;
  const c = daily.case;
  const summary = app.summaryFor(c.id) || c;
  const completedToday = p.lastDaily === todayKey();
  const best = p.completed?.[c.id];
  const active = app.state.activeRun?.caseId === c.id;
  const color = colorForSeed(summary.avatar || c.id);
  return `<section class="daily-card" id="daily">
    <div class="daily-art">
      ${sceneCanvas({ art: summary.art, seed: summary.avatar, color, accent: app.accent(), live: true })}
      <span class="daily-code">${esc(summary.code)}</span>
      <span class="daily-live"><i></i> CANLI</span>
      <span class="daily-tag">${daily.featured ? 'SEZONUN VAKASI' : 'GÜNÜN VAKASI'}</span>
    </div>
    <div class="daily-body">
      <div class="daily-meta">
        <span>${esc(summary.discipline)}</span>
        <span>${icon('clock', 12)} ${summary.minutes} dk</span>
        <span>${stars(summary.difficulty)}</span>
      </div>
      <h2>${esc(summary.title)}</h2>
      <p>${esc(summary.subtitle)}</p>
      <div class="daily-foot">
        ${skillChips(summary.skills)}
        ${best ? `<span class="best-badge">${gradeBadge(best.bestGrade)} EN İYİ</span>` : ''}
      </div>
      <div class="daily-cta">
        <button class="btn btn-primary btn-wide" data-action="${active ? 'resume-case' : 'start-daily'}" data-id="${esc(summary.id)}">
          ${active ? 'Devam eden vardiya' : 'Vardiyaya gir'} ${icon('arrow', 14)}
        </button>
        <span class="daily-bonus ${completedToday ? 'used' : ''}">${completedToday ? 'BUGÜNÜN BONUSU ALINDI' : 'GÜNLÜK BONUS +%25 XP'}</span>
      </div>
      <p class="recommend-line">${icon('spark', 11)} ${esc(daily.reason)}</p>
    </div>
  </section>`;
}

function renderXp(app, block) {
  const p = app.state.profile;
  const level = levelForXp(p.xp || 0);
  const lp = levelProgress(p);
  const pp = phaseProgress(p);
  const assist = assistFor(p);
  const nextUnlock = PHASES.flatMap((ph) => ph.unlocks.map((u) => ({ ...u, phase: ph.name }))).filter((u) => u.level > level).sort((a, b) => a.level - b.level)[0];
  return `<section class="panel xp-panel">
    ${sectionHead('KIDEM', esc(block.title || 'İLERLEME'), `<span class="level-chip">LV ${level}</span>`)}
    <div class="xp-head">
      <div><strong>${esc(phaseForXp(p.xp).rank)}</strong><span>${esc(pp.phase.code)} · ${esc(pp.phase.name)}</span></div>
      <div class="xp-value">${p.xp} <small>XP</small></div>
    </div>
    ${xpBar(lp.value, app.accent())}
    <div class="xp-labels"><span>Seviye ${level}</span><span>${level >= 30 ? 'MAKS' : `Seviye ${lp.nextAt / 100} · ${Math.max(0, lp.nextAt - p.xp)} XP`}</span></div>
    <div class="phase-track">
      ${PHASES.map((ph) => `<span class="${p.xp >= ph.minXp ? 'on' : ''} ${ph.id === pp.phase.id ? 'current' : ''}" style="--phase:${ph.accent}"><i></i>${esc(ph.code.replace('YIL ', 'Y'))}</span>`).join('')}
    </div>
    <div class="xp-note">
      <span>${icon(assist.tone === 'support' ? 'heart' : assist.tone === 'challenge' ? 'bolt' : 'spark', 13)} ${esc(assist.label || 'Sistem zorluğu seninle uyarlıyor')}</span>
      ${nextUnlock ? `<span>${icon('unlock', 12)} LV ${nextUnlock.level}: ${esc(nextUnlock.label)}</span>` : `<span>${icon('trophy', 12)} Tüm kariyer modülleri açık</span>`}
    </div>
  </section>`;
}

function renderNext(app, block, daily) {
  const suggestion = app.getSuggestion(daily.case.id);
  if (!suggestion) return '';
  const c = suggestion.case;
  return `<section class="panel next-panel">
    ${sectionHead('SİSTEM ÖNERİSİ', esc(block.title || 'SIRADAKİ'))}
    <div class="next-row">
      <div class="next-art">${mascotImage(c.avatar, 46)}</div>
      <div class="next-copy">
        <span class="mono muted">${esc(c.code)} · ${esc(c.discipline)}</span>
        <strong>${esc(c.title)}</strong>
        <p>${esc(suggestion.reason)}</p>
      </div>
      <button class="icon-btn next-go" data-action="start-case" data-id="${esc(c.id)}" aria-label="Vakayı aç">${icon('arrow', 18)}</button>
    </div>
  </section>`;
}

function renderRadar(app, block) {
  const p = app.state.profile;
  const weakest = [...SKILLS].sort((a, b) => (p.skills[a.id] || 0) - (p.skills[b.id] || 0))[0];
  return `<section class="panel radar-panel">
    ${sectionHead('GELİŞİM', esc(block.title || 'YETENEK RADARI'), `<button class="text-btn" data-action="nav" data-to="profile">Detay ${icon('arrow', 12)}</button>`)}
    <div class="radar-wrap">${radarSvg(p)}</div>
    <div class="radar-foot">
      <span>${icon(weakest.icon, 14)} <span class="muted">Odak:</span> <strong>${esc(weakest.name)}</strong> · ${p.skills[weakest.id] || 0}/100</span>
      <span class="muted">Denge için kısa vakalar</span>
    </div>
  </section>`;
}

function renderQuick(app, block) {
  const items = block.items?.length ? block.items : [
    { label: 'Rastgele vaka', action: 'random-case', icon: 'spark' },
    { label: 'Kütüphane', action: 'nav', to: 'library', icon: 'library' },
    { label: 'Kariyer', action: 'nav', to: 'career', icon: 'career' },
  ];
  return `<section class="panel quick-panel">
    ${sectionHead('HIZLI', esc(block.title || 'ERİŞİM'))}
    <div class="quick-grid">
      ${items.map((it) => `<button class="quick-btn" data-action="${esc(it.action || 'nav')}" ${it.to ? `data-to="${esc(it.to)}"` : ''}>
        <span class="quick-icon">${icon(it.icon || 'arrow', 20)}</span>
        <span>${esc(it.label)}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

function renderLeaderboard(app, block) {
  const p = app.state.profile;
  const rows = [
    ...LEADERBOARD_BOTS.map((b) => ({ ...b, me: false })),
    { name: p.name || 'sen', xp: p.xp, title: phaseForXp(p.xp).rank, me: true, seed: p.avatar },
  ].sort((a, b) => b.xp - a.xp);
  const myIndex = rows.findIndex((r) => r.me);
  const top = rows.slice(0, 5);
  if (myIndex > 4) top.push(rows[myIndex]);
  return `<section class="panel leaderboard">
    ${sectionHead('EKİP', esc(block.title || 'HAFTANIN EKİBİ'), `<span class="muted mono">${top.indexOf(rows[myIndex]) + 1}. sıradasın</span>`)}
    <div class="board-rows">
      ${top.map((r, i) => `<div class="board-row ${r.me ? 'me' : ''}">
        <span class="rank">${String(i + 1).padStart(2, '0')}</span>
        <span class="board-avatar">${r.me ? mascotImage(r.seed, 28) : `<span class="bot-dot" style="--bot:${['#5ef2c0', '#59d7ff', '#ffc857', '#a78bfa', '#ff8fab'][i % 5]}"></span>`}</span>
        <span class="board-name">${esc(r.name)}${r.me ? ' <em>(sen)</em>' : ''}</span>
        <span class="board-title">${esc(r.title)}</span>
        <span class="board-xp">${r.xp} XP</span>
      </div>`).join('')}
    </div>
  </section>`;
}

function renderModule(app, block) {
  const level = levelForXp(app.state.profile.xp || 0);
  const locked = block.minLevel && level < block.minLevel;
  if (block.title?.toUpperCase().includes('NÖBET') && !locked) {
    const suggestion = app.getSuggestion();
    if (suggestion) {
      return `<section class="panel module-panel oncall-panel">
        ${sectionHead('NÖBET', esc(block.title), `<span class="live-pill"><i></i> AÇIK</span>`)}
        <p class="muted">Bu hafta masada: <strong>${esc(suggestion.case.title)}</strong></p>
        <button class="btn btn-small btn-ghost" data-action="start-case" data-id="${esc(suggestion.case.id)}">Nöbeti devral ${icon('arrow', 12)}</button>
      </section>`;
    }
  }
  return `<section class="panel module-panel ${locked ? 'locked-panel' : ''}">
    ${sectionHead('MODÜL', esc(block.title || 'YENİ MODÜL'), locked ? `<span class="lock-chip">${icon('lock', 12)} LV ${block.minLevel}</span>` : '')}
    <div class="module-body">
      <span class="module-icon">${icon(block.icon || 'spark', 26)}</span>
      <p>${esc(block.body || '')}</p>
    </div>
    ${block.cta ? `<button class="btn btn-small btn-ghost" data-action="${esc(block.cta.action || 'nav')}" ${block.cta.to ? `data-to="${esc(block.cta.to)}"` : ''}>${esc(block.cta.label)} ${icon('arrow', 12)}</button>` : ''}
  </section>`;
}

function renderSeasonPass(app, block) {
  const p = app.state.profile;
  const level = levelForXp(p.xp || 0);
  const items = block.items?.length ? block.items : PHASES.flatMap((ph) => ph.unlocks.map((u) => ({ ...u, phase: ph.name })));
  return `<section class="panel season-pass">
    ${sectionHead('YOL HARİTASI', esc(block.title || 'SEZON GEÇİŞİ'))}
    <div class="pass-list">
      ${items.map((u) => {
        const unlocked = level >= (u.level || 1);
        return `<div class="pass-row ${unlocked ? 'on' : ''}">
          <span class="pass-level">${unlocked ? icon('check', 12) : icon('lock', 12)} LV ${u.level}</span>
          <span>${esc(u.label)}</span>
          <small>${esc(u.phase || '')}</small>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

function renderOnCall(app, block) {
  const s = app.getSuggestion();
  if (!s) return `<section class="panel oncall-panel">${sectionHead(block.title || 'NÖBET', 'Nöbet')}<p class="muted">Şu an açık vaka yok.</p></section>`;
  return `<section class="panel oncall-panel">
    ${sectionHead('CANLI', esc(block.title || 'NÖBET PANOSU'), `<span class="live-pill"><i></i> AÇIK</span>`)}
    <div class="oncall-body">
      ${mascotImage(s.case.avatar, 48)}
      <div><strong>${esc(s.case.code)} · ${esc(s.case.title)}</strong><p class="muted">${esc(s.reason)}</p></div>
    </div>
    <button class="btn btn-small btn-primary" data-action="start-case" data-id="${esc(s.case.id)}">Nöbeti al</button>
  </section>`;
}

function renderSysline(app) {
  const b = app.state.bootstrap;
  const source = app.state.source;
  return `<div class="sysline">
    <span class="source-dot source-${source}"></span>
    <span>SDU v${b.schema} • rev ${b.revision} • ${esc(b.season?.name || '')}</span>
    <span class="sysline-right">${source === 'live' ? 'SUNUCU ÇEVRİMİÇİ' : source === 'cache' ? 'ÖNBELLEK' : 'YEREL TOHUM'}</span>
  </div>`;
}

import { PHASES, phaseForXp } from '../../shared/meta.mjs';
import { esc, gradeBadge, icon, mascotImage, sectionHead, skillChips, stars } from '../ui.mjs';
import { colorForSeed } from '../sprites.mjs';

export function renderLibrary(app) {
  const p = app.state.profile;
  const all = app.state.cases || [];
  const filter = app.state.libFilter || { phase: 'all', status: 'all' };
  const completed = p.completed || {};
  const totalActions = all.reduce((sum, c) => sum + (c.actionCount || 0), 0);
  const done = Object.keys(completed).length;
  const phases = PHASES;
  const phaseFiltered = filter.phase === 'all' ? all : all.filter((c) => c.phase === Number(filter.phase));
  const filtered = phaseFiltered.filter((c) => {
    const isDone = Boolean(completed[c.id]);
    const unlocked = (c.phase || 1) <= phaseForXp(p.xp || 0).id;
    if (filter.status === 'done') return isDone;
    if (filter.status === 'todo') return !isDone;
    if (filter.status === 'locked') return !unlocked;
    if (filter.status === 'open') return unlocked;
    return true;
  });
  return `<div class="library">
    <header class="page-head">
      <span class="kicker">VAKA KÜTÜPHANESİ</span>
      <h1>Her hata bir vaka.</h1>
      <p>${all.length} gerçekçi senaryo, 4 yıl, ${totalActions}+ olası eylem. Vakalar kanıt toplamayı, hipotez kurmayı ve doğru müdahaleyi ödüllendirir.</p>
      <div class="lib-stats">
        <span><strong>${all.length}</strong> vaka</span>
        <span><strong>${done}</strong> tamamlandı</span>
        <span><strong>${totalActions}</strong> eylem</span>
      </div>
    </header>
    <div class="filter-block">
      <div class="filter-row" role="group" aria-label="Yıl filtresi">
        <button class="filter-chip ${filter.phase === 'all' ? 'on' : ''}" data-action="library-phase" data-phase="all">Tümü</button>
        ${phases.map((ph) => `<button class="filter-chip ${String(filter.phase) === String(ph.id) ? 'on' : ''}" style="--chip:${ph.accent}" data-action="library-phase" data-phase="${ph.id}">${esc(ph.code)}</button>`).join('')}
      </div>
      <div class="filter-row" role="group" aria-label="Durum filtresi">
        ${[['all', 'Hepsi'], ['open', 'Açık'], ['todo', 'Oynanmadı'], ['done', 'Çözülen'], ['locked', 'Kilitli']].map(([id, label]) => `<button class="filter-chip ghost ${filter.status === id ? 'on' : ''}" data-action="library-status" data-status="${id}">${label}</button>`).join('')}
      </div>
    </div>
    <div class="lib-toolbar">
      <span>${filtered.length} vaka gösteriliyor</span>
      <button class="btn btn-small btn-primary" data-action="random-case">${icon('spark', 13)} Rastgele vaka</button>
    </div>
    <div class="case-list">
      ${filtered.map((c) => renderCaseRow(app, c, completed[c.id])).join('') || `<div class="empty-state"><h3>Bu filtrede vaka yok.</h3><p>Filtreyi değiştir ya da rastgele bir vardiya al.</p></div>`}
    </div>
    <div class="lib-note">
      ${icon('info', 14)}
      <p>Kilitli vakalar XP ile açılır. Günlük vardiya +%25 bonus verir. Çözemediğin vakayı tekrar oynayabilirsin; sistem zorluğu sana göre uyarlar.</p>
    </div>
  </div>`;
}

function renderCaseRow(app, c, done) {
  const p = app.state.profile;
  const phase = PHASES.find((x) => x.id === c.phase) || PHASES[0];
  const unlocked = (c.phase || 1) <= phaseForXp(p.xp || 0).id;
  const active = app.state.activeRun?.caseId === c.id;
  const color = colorForSeed(c.avatar || c.id);
  return `<button class="case-row ${unlocked ? '' : 'locked'} ${active ? 'active-run' : ''}" data-action="${unlocked ? 'start-case' : 'locked-case'}" data-id="${esc(c.id)}" data-phase="${c.phase}" style="--case-color:${color}">
    <span class="case-art">${mascotImage(c.avatar || c.id, 52)}<span class="case-art-code">${esc(c.code)}</span></span>
    <span class="case-main">
      <span class="case-topline">
        <span class="mono">${esc(phase.code)} · ${esc(c.discipline)}</span>
        <span>${stars(c.difficulty)}</span>
      </span>
      <strong class="case-title">${esc(c.title)}</strong>
      <span class="case-sub">${esc(c.subtitle)}</span>
      <span class="case-bottom">
        ${skillChips(c.skills)}
        <span class="case-actions">${c.actionCount || 0} eylem</span>
        ${done ? gradeBadge(done.bestGrade) : ''}
        ${active ? `<span class="live-pill"><i></i> DEVAM</span>` : ''}
      </span>
    </span>
    <span class="case-arrow">${unlocked ? icon('arrow', 18) : icon('lock', 16)}</span>
    ${!unlocked ? `<span class="case-lockline">${esc(phase.code)} · ${phase.minXp} XP gerekli</span>` : ''}
  </button>`;
}

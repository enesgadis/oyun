import { PHASES, phaseForXp, levelForXp } from '../../shared/meta.mjs';
import { esc, gradeBadge, icon, mascotImage, sectionHead, xpBar } from '../ui.mjs';
import { phaseProgress } from '../engine.mjs';

export function renderCareer(app) {
  const p = app.state.profile;
  const current = phaseForXp(p.xp || 0);
  const level = levelForXp(p.xp || 0);
  const pp = phaseProgress(p);
  const cases = app.state.cases || [];
  return `<div class="career">
    <header class="page-head">
      <span class="kicker">KARİYER HARİTASI</span>
      <h1>Dört yıl.<br>Tek bir büyüyen masa.</h1>
      <p>Yıl 1’de bir dosya açmayı öğreniyorsun. Yıl 4’te bir ekibin neden yavaşladığını okuyorsun. Her eşik arayüzü, vakayı ve mentorun dilini değiştirir.</p>
      <div class="career-now">
        <span class="kicker">ŞU AN</span>
        <strong>${esc(current.code)} · ${esc(current.name)}</strong>
        <span class="muted">${esc(current.rank)} • LV ${level} • ${p.xp} XP</span>
        ${xpBar(pp.value, current.accent)}
      </div>
    </header>
    <ol class="timeline">
      ${PHASES.map((phase, index) => renderPhase(app, phase, index, current, level, cases)).join('')}
    </ol>
    <section class="contract-paper">
      <div class="contract-seal">${icon('trophy', 24)}</div>
      <span class="kicker">MÜHENDİS ADAYI SÖZLEŞMESİ</span>
      <h2>“Bu kitap her açıldığında değişecek.”</h2>
      <p>1995’te hayal edilen fikir: içerik, okuyucunun o günkü ihtiyacına göre yeniden yazılır. PRIMER.EXE’te bu, sunucudan gelen yeni vakalar, sezonlar ve arayüz şemalarıyla olur. Uygulama bir kez yüklenir; deneyim seninle ve sektörle büyür.</p>
      <div class="signature">— PRIMER.EXE <span>/system/mentor</span></div>
    </section>
  </div>`;
}

function renderPhase(app, phase, index, current, level, cases) {
  const p = app.state.profile;
  const completedMap = p.completed || {};
  const phaseCases = cases.filter((c) => c.phase === phase.id);
  const done = phaseCases.filter((c) => completedMap[c.id]).length;
  const total = phaseCases.length;
  const status = current.id === phase.id ? 'current' : p.xp >= phase.minXp ? 'done' : 'locked';
  const unlocked = p.xp >= phase.minXp;
  return `<li class="timeline-item ${status}" style="--phase:${phase.accent}">
    <div class="timeline-rail"><span class="timeline-node">${status === 'done' ? icon('check', 14) : status === 'locked' ? icon('lock', 14) : String(phase.id).padStart(2, '0')}</span><i></i></div>
    <article class="phase-card">
      <div class="phase-head">
        <div>
          <span class="kicker">${esc(phase.code)} ${status === 'current' ? '· ŞU AN' : status === 'done' ? '· TAMAMLANDI' : '· KİLİTLİ'}</span>
          <h2>${esc(phase.name)}</h2>
          <p>${esc(phase.blurb)}</p>
        </div>
        <div class="phase-art" aria-hidden="true">${mascotImage(`phase-${phase.id}`, 54)}</div>
      </div>
      <div class="phase-stats">
        <span><strong>${done}/${total}</strong> vaka</span>
        <span><strong>${phase.minXp}</strong> XP eşiği</span>
        <span><strong>${esc(phase.rank)}</strong> unvan</span>
      </div>
      <div class="phase-progress">${xpBar(total ? (done / total) * 100 : 0, phase.accent)}</div>
      <div class="phase-cases">
        ${phaseCases.map((c) => {
          const doneCase = completedMap[c.id];
          return `<button class="phase-case ${doneCase ? 'done' : ''}" data-action="${unlocked ? 'start-case' : 'locked-case'}" data-id="${esc(c.id)}" title="${esc(c.title)}">
            <span>${doneCase ? gradeBadge(doneCase.bestGrade) : icon(unlocked ? 'play' : 'lock', 11)}</span>
            <small>${esc(c.code.replace('DEV-', '#'))}</small>
          </button>`;
        }).join('')}
      </div>
      <ul class="unlock-list">
        ${phase.unlocks.map((u) => `<li class="${level >= u.level ? 'on' : ''}">${icon(level >= u.level ? 'check' : 'lock', 12)} <span>LV ${u.level}</span> ${esc(u.label)}</li>`).join('')}
      </ul>
      ${unlocked ? `<button class="btn btn-small btn-ghost phase-cta" data-action="library-phase" data-phase="${phase.id}">Bu yılın vakaları ${icon('arrow', 12)}</button>` : `<div class="locked-note">${icon('lock', 13)} ${phase.minXp - p.xp} XP sonra açılır</div>`}
      ${status === 'current' ? `<div class="current-marker">${icon('spark', 12)} Şu an buradasın</div>` : ''}
    </article>
  </li>`;
}

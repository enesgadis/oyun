import { levelForXp, phaseForXp } from '../../shared/meta.mjs';
import { badgeCard, docsList, esc, formatDuration, gradeBadge, icon, logo, reportCardCanvas, sectionHead, skillChips } from '../ui.mjs';
import { skillDeltaLabel } from '../engine.mjs';

const GRADE_COPY = {
  S: ['SİSTEM MÜKEMMEL', 'Kanıt, teşhis ve müdahale aynı hizada. Bu vardiya referans olarak arşivlendi.'],
  A: ['TEMİZ ÇÖZÜM', 'Sistem ayakta ve kararların savunulabilir. Küçük bir verimlilik payı masada kaldı.'],
  B: ['İŞ GÖRÜR', 'Sorun çözüldü; bazı adımlar geç veya fazla maliyetliydi. Bir sonraki tekrarda daha keskin olabilirsin.'],
  C: ['KIRILGAN ÇÖZÜM', 'Sistem ayakta ama kanıt ve iletişim zayıf. Aynı hata başka bir gün geri dönebilir.'],
  D: ['ZOR KURTARMA', 'Vardiya tamamlandı; bedeli yüksek oldu. Kök nedeni ve zamanlamayı yeniden kur.'],
  F: ['KESİNTİ', 'Sistem ayakta kalmadı. Bu bir kariyer değil, tek bir vardiya. Raporu oku ve aynı vakayı daha iyi kanıtla tekrar aç.'],
};

export function renderReport(app) {
  const report = app.state.report;
  const p = app.state.profile;
  if (!report) {
    return `<div class="report-screen empty-report">
      <header class="bare-head"><button class="icon-btn" data-action="nav" data-to="home" aria-label="Üsse dön">${icon('chevron', 18)}</button><span class="mono">RAPOR YOK</span><span></span></header>
      <div class="empty-state"><div class="empty-mark">${icon('note', 30)}</div><h3>Henüz kapanmış bir vardiya yok.</h3><p>Bir vakayı bitirdiğinde teşhis, puan kırılımı ve telafi notları burada açılır.</p><button class="btn btn-primary" data-action="nav" data-to="library">Vaka seç</button></div>
    </div>`;
  }
  const copy = GRADE_COPY[report.grade] || GRADE_COPY.B;
  const application = report.application || {};
  const level = levelForXp(p.xp || 0);
  const phase = phaseForXp(p.xp || 0);
  const sharePreview = safeSharePreview(report, p);
  const actionLog = report.actionLog || [];
  const harmful = actionLog.filter((a) => a.harmful);
  const wasted = actionLog.filter((a) => a.wasted && !a.harmful);
  return `<div class="report-screen report-${report.success ? 'win' : 'fail'}">
    <header class="bare-head report-head">
      <button class="icon-btn" data-action="nav" data-to="home" aria-label="Üsse dön">${icon('chevron', 18)}</button>
      <span class="report-brand">${logo({ compact: true })}</span>
      <button class="icon-btn" data-action="share-report" aria-label="Raporu paylaş">${icon('share', 17)}</button>
    </header>

    <section class="report-hero">
      <div class="report-scan" aria-hidden="true"></div>
      <span class="kicker">VARDİYA RAPORU // ${esc(report.caseCode)}</span>
      <div class="report-grade-row">
        ${gradeBadge(report.grade, true)}
        <div class="report-score">
          <strong>${report.score}<small>/100</small></strong>
          <span class="report-verdict">${esc(copy[0])}</span>
        </div>
        <div class="report-xp">
          <span class="mono muted">KAZANÇ</span>
          <strong>+${report.xp}<small> XP</small></strong>
          ${report.daily ? '<span class="report-bonus">GÜNLÜK +%25</span>' : ''}
          ${report.replay ? '<span class="report-replay">TEKRAR ×0.3</span>' : ''}
        </div>
      </div>
      <h1>${esc(report.caseTitle)}</h1>
      <p>${esc(copy[1])}</p>
      <div class="report-meta">
        <span>${icon('clock', 12)} ${formatDuration(report.durationMs)}</span>
        <span>${icon('play', 12)} ${report.actions} hamle</span>
        <span>${icon('search', 12)} ${report.evidence.found}/${report.evidence.total} kanıt</span>
        <span>${skillChips(report.skills)}</span>
      </div>
    </section>

    ${application.levelUp || application.phaseUp ? renderPromotion(application, level, phase) : ''}

    <section class="panel report-breakdown">
      ${sectionHead('PUAN KIRILIMI', 'Nereden geldi?', `<span class="level-chip">${report.grade}</span>`)}
      <div class="breakdown-list">
        ${row('Teşhis', report.breakdown.diagnosis, 30, 'Kanıt + doğru hipotez')}
        ${row('Çözüm', report.breakdown.solution, 35, 'Sistem ayakta mı?')}
        ${row('Vital sağlığı', report.breakdown.vitals, 20, 'Build, perf, trust, team')}
        ${row('Verimlilik', report.breakdown.efficiency, 10, 'Kalan hamle oranı')}
        ${row('İletişim', report.breakdown.comms, 5, 'Durum / ekip bilgilendirmesi')}
        ${report.breakdown.penalty ? row('Ceza', report.breakdown.penalty, -25, 'Riskli, boşa harcanan, ipucu') : ''}
      </div>
      <div class="report-gains">
        <div class="gain-line"><span>XP</span><strong>+${report.xp}</strong></div>
        <div class="gain-line"><span>BECERİ</span><strong>${esc(skillDeltaLabel(report.skillGain) || '—')}</strong></div>
        <div class="gain-line"><span>SEVİYE</span><strong>LV ${level} · ${esc(phase.rank)}</strong></div>
      </div>
    </section>

    <section class="panel report-diagnosis">
      ${sectionHead('TEŞHİS', 'Kanıt ne söyledi?', `<span class="mono muted">${report.evidence.found}/${report.evidence.total}</span>`)}
      <div class="diagnosis-grid">
        <div class="diagnosis-cell">
          <span class="kicker">HİPOTEZİN</span>
          <p>${report.hypothesis ? esc(report.hypothesis.text) : 'Hipotez seçmedin.'}</p>
          <span class="diag-state ${report.hypothesis?.correct ? 'ok' : 'bad'}">${icon(report.hypothesis?.correct ? 'check' : 'alert', 12)} ${report.hypothesis?.correct ? 'DOĞRU' : report.hypothesis ? 'KANITLA UYUŞMUYOR' : 'SEÇİLMEDİ'}</span>
        </div>
        <div class="diagnosis-cell">
          <span class="kicker">KANIT KAPSAMI</span>
          <div class="evidence-meter"><span style="width:${Math.round((report.evidence.found / Math.max(1, report.evidence.total)) * 100)}%"></span></div>
          <p class="muted">${report.evidence.found >= report.evidence.total ? 'Tüm kanıtlar masadaydı. Mükemmel kapsam.' : 'Bazı kanıtlar masada kaldı. Teşhis gücü düştü.'}</p>
        </div>
      </div>
      ${harmful.length || wasted.length ? `<div class="misstep-grid">
        ${harmful.length ? `<div><span class="kicker bad">GERİ DÖNÜŞÜ OLMAYAN</span>${harmful.map((a) => `<span class="misstep">${icon('alert', 11)} ${esc(a.label)}</span>`).join('')}</div>` : ''}
        ${wasted.length ? `<div><span class="kicker warn">BOŞA HARCANAN</span>${wasted.map((a) => `<span class="misstep">${icon('clock', 11)} ${esc(a.label)}</span>`).join('')}</div>` : ''}
      </div>` : `<p class="clean-run">${icon('check', 12)} Riskli veya boşa hamle yok. Temiz bir masa.</p>`}
    </section>

    <section class="panel debrief-panel">
      ${sectionHead('KÖK NEDEN', report.caseCode)}
      <p class="root-cause">${esc(report.rootCause)}</p>
      <p class="muted">${esc(report.summary)}</p>
      <div class="takeaway-list">
        ${(report.takeaways || []).map((t, i) => `<div class="takeaway"><span class="takeaway-no">${String(i + 1).padStart(2, '0')}</span><p>${esc(t)}</p></div>`).join('')}
      </div>
      <div class="real-world">
        <span class="kicker">SAHADA</span>
        <p>${esc(report.realWorld || '')}</p>
      </div>
      ${docsList(report.docs)}
    </section>

    ${application.newBadges?.length || application.unlocks?.length ? `<section class="panel reward-panel">
      ${sectionHead('KİLİT AÇILDI', 'Yeni yetkiler ve rozetler')}
      <div class="reward-badges">${(application.newBadges || []).map((b) => badgeCard(b, true)).join('')}</div>
      ${application.unlocks?.length ? `<ul class="unlock-rows">${application.unlocks.map((u) => `<li>${icon('unlock', 13)} <strong>LV ${u.level}</strong> ${esc(u.label)} <span class="muted">${esc(u.phase)}</span></li>`).join('')}</ul>` : ''}
    </section>` : ''}

    ${report.nextCaseTitle ? `<section class="next-case-card">
      <span class="kicker">SİSTEM ÖNERİSİ</span>
      <h2>${esc(report.nextCaseTitle)}</h2>
      <p>${esc(report.nextReason || 'Kanıt açığını kapatmak için sıradaki vaka.')}</p>
      <button class="btn btn-primary" data-action="next-case">Sıradaki vardiya ${icon('arrow', 14)}</button>
    </section>` : ''}

    <section class="panel mentor-note">
      ${sectionHead('MENTOR NOTU', 'Masada kalan cümle')}
      <blockquote>${esc(report.mentor || '“Kanıt olmadan müdahale, müdahale değil tahmindir.”')}</blockquote>
    </section>

    ${sharePreview ? `<section class="share-card-panel">
      <div class="share-preview"><img src="${sharePreview}" alt="Paylaşılabilir vardiya raporu kartı" loading="lazy"></div>
      <div class="share-copy"><span class="kicker">DIŞA AKTAR</span><h2>Raporu ekibine gönder.</h2><p>640×860 pixel kart; not, kök neden ve öğrenilenleri içerir.</p><button class="btn btn-small btn-ghost" data-action="share-report">${icon('share', 13)} Kartı paylaş</button></div>
    </section>` : ''}

    <div class="report-actions">
      <button class="btn btn-ghost" data-action="nav" data-to="home">Üsse dön</button>
      <button class="btn btn-ghost" data-action="replay-case">${icon('undo', 13)} Tekrar oyna</button>
      ${report.nextCaseId ? `<button class="btn btn-primary" data-action="next-case">Sıradaki ${icon('arrow', 13)}</button>` : `<button class="btn btn-primary" data-action="nav" data-to="library">Vaka seç</button>`}
    </div>
    <div class="report-foot mono">PRIMER.EXE // ${esc(report.at)} // SDU v${app.state.bootstrap.schema}</div>
  </div>`;
}

function row(label, value, max, hint) {
  const abs = Math.abs(value);
  const width = Math.min(100, (abs / Math.abs(max)) * 100);
  const negative = value < 0;
  return `<div class="breakdown-row ${negative ? 'negative' : ''}">
    <span class="breakdown-label">${esc(label)}<small>${esc(hint)}</small></span>
    <span class="breakdown-bar"><i style="width:${width}%"></i></span>
    <span class="breakdown-value">${negative ? '' : '+'}${value}${max > 0 ? `<small>/${max}</small>` : ''}</span>
  </div>`;
}

function renderPromotion(application, level, phase) {
  return `<section class="promotion-banner">
    <span class="promo-spark">${icon(application.phaseUp ? 'arch' : 'spark', 22)}</span>
    <div>
      <span class="kicker">${application.phaseUp ? 'YENİ YIL AÇILDI' : 'KIDEM ARTTI'}</span>
      <h2>${application.phaseUp ? `${esc(phase.code)} · ${esc(phase.name)}` : `Seviye ${application.levelAfter}`}</h2>
      <p>${application.phaseUp ? 'Yeni vakalar, yeni arayüz yetkileri ve daha yüksek bahisler açıldı.' : 'Yeni bir sistem yetkisi açıldı. Profilinden kontrol edebilirsin.'}</p>
    </div>
    <span class="promo-level">LV ${level}</span>
  </section>`;
}

function safeSharePreview(report, profile) {
  try {
    return reportCardCanvas(report, profile);
  } catch {
    return '';
  }
}

import { BADGES, SKILLS, phaseForXp, levelForXp, trackById } from '../../shared/meta.mjs';
import { avatarImage, badgeCard, docsList, esc, formatDate, gradeBadge, icon, radarSvg, sectionHead, statBar, timeAgo } from '../ui.mjs';
import { gradeStats } from '../store.mjs';

export function renderProfile(app) {
  const p = app.state.profile;
  const b = app.state.bootstrap;
  const stats = gradeStats(p);
  const phase = phaseForXp(p.xp || 0);
  const level = levelForXp(p.xp || 0);
  const track = trackById(p.track);
  const earned = new Set(p.badges || []);
  const results = [...(p.results || [])].reverse().slice(0, 8);
  return `<div class="profile">
    <header class="profile-card">
      <div class="profile-avatar">${avatarImage(p, 88)}<span class="profile-level">LV ${level}</span></div>
      <div class="profile-copy">
        <span class="kicker">${esc(phase.code)} · ${esc(phase.rank)}</span>
        <h1>${esc(p.name)}</h1>
        <p>${esc(track.name)} rotası · ${stats.total} vardiya</p>
        <div class="profile-chips">
          <span>${icon('flame', 12)} ${p.streak?.count || 0} gün seri</span>
          <span>${icon('bolt', 12)} ${p.xp} XP</span>
          <span>${icon('calendar', 12)} ${formatDate(p.joinedAt, false)}</span>
        </div>
      </div>
      <button class="icon-btn" data-action="nav" data-to="career" aria-label="Kariyer haritası">${icon('career', 18)}</button>
    </header>

    <section class="panel radar-panel profile-radar">
      ${sectionHead('SİSTEM SENİ TANIYOR', 'Yetenek radarsı', `<span class="level-chip">${phase.name}</span>`)}
      <div class="radar-wrap">${radarSvg(p, { size: 240 })}</div>
      <div class="skill-list">
        ${SKILLS.map((s) => `<div class="skill-row">
          <span class="skill-name" style="--skill:${s.color}">${icon(s.icon, 13)} ${esc(s.name)}</span>
          ${statBar(p.skills?.[s.id] || 0, s.color)}
          <span class="skill-value">${p.skills?.[s.id] || 0}</span>
        </div>`).join('')}
      </div>
      <p class="radar-hint">${icon('spark', 11)} Vaka önerileri en düşük becerine göre ağırlıklandırılır. Aynı beceriyi tekrar tekrar oynamak radarı dengeler.</p>
    </section>

    <div class="stat-grid">
      <div class="stat-tile"><strong>${stats.total}</strong><span>VARDİYA</span></div>
      <div class="stat-tile"><strong>${stats.sCount}</strong><span>S NOTU</span></div>
      <div class="stat-tile"><strong>${stats.accuracy}%</strong><span>ÇÖZÜM</span></div>
      <div class="stat-tile"><strong>${p.streak?.best || 0}</strong><span>EN İYİ SERİ</span></div>
    </div>

    <section class="panel">
      ${sectionHead('KOLEKSİYON', 'Rozetler', `<span class="muted mono">${earned.size}/${BADGES.length}</span>`)}
      <div class="badge-grid">
        ${BADGES.map((badge) => badgeCard(badge, earned.has(badge.id))).join('')}
      </div>
    </section>

    <section class="panel">
      ${sectionHead('KAYIT', 'Son vardiyalar')}
      ${results.length ? `<div class="result-list">${results.map((r) => {
        const c = app.summaryFor(r.caseId);
        return `<div class="result-row">
          ${gradeBadge(r.grade)}
          <div><strong>${esc(c?.title || r.caseId)}</strong><span class="muted mono">${esc(c?.code || '')} · ${timeAgo(r.at)}</span></div>
          <span class="result-score">${r.score}</span>
          <span class="muted">${r.xp} XP</span>
        </div>`;
      }).join('')}</div>` : `<div class="empty-state small"><p>Henüz vardiya yok. İlk vaka Üs’te seni bekliyor.</p><button class="btn btn-small btn-primary" data-action="nav" data-to="home">Üsse git</button></div>`}
    </section>

    <section class="panel settings-panel">
      ${sectionHead('AYARLAR', 'Vardiya masası')}
      <div class="setting-row">
        <div><strong>8-bit ses</strong><span class="muted">Tıklama, başarı ve seviye sesleri</span></div>
        <button class="toggle ${p.settings?.sound ? 'on' : ''}" role="switch" aria-checked="${Boolean(p.settings?.sound)}" data-action="toggle-setting" data-key="sound"><i></i><span>${p.settings?.sound ? 'AÇIK' : 'KAPALI'}</span></button>
      </div>
      <div class="setting-row">
        <div><strong>Titreşim</strong><span class="muted">Mobilde dokunma geri bildirimi</span></div>
        <button class="toggle ${p.settings?.haptics ? 'on' : ''}" role="switch" aria-checked="${Boolean(p.settings?.haptics)}" data-action="toggle-setting" data-key="haptics"><i></i><span>${p.settings?.haptics ? 'AÇIK' : 'KAPALI'}</span></button>
      </div>
      <div class="setting-row">
        <div><strong>Hareketi azalt</strong><span class="muted">Ticker, sahne ve parçacık animasyonları</span></div>
        <button class="toggle ${p.settings?.motion ? 'on' : ''}" role="switch" aria-checked="${Boolean(p.settings?.motion)}" data-action="toggle-setting" data-key="motion"><i></i><span>${p.settings?.motion ? 'AÇIK' : 'KAPALI'}</span></button>
      </div>
    </section>

    <section class="panel server-panel">
      ${sectionHead('SİSTEM', 'Sunucu güdümlü deney', `<span class="source-dot source-${app.state.source}"></span>`)}
      <div class="server-grid">
        <div><span>BAĞLANTI</span><strong>${app.state.source === 'live' ? 'Canlı sunucu' : app.state.source === 'cache' ? 'Önbellek' : 'Yerel tohum'}</strong></div>
        <div><span>ŞEMA</span><strong>SDU v${b.schema} · rev ${b.revision}</strong></div>
        <div><span>SEZON</span><strong>${esc(b.season?.tag || '—')}</strong></div>
        <div><span>VAKA</span><strong>${(app.state.cases || []).length} yüklü</strong></div>
      </div>
      <p class="muted small">Arayüz, sezon, vaka listesi ve duyurular sunucudan gelir. Uygulama kabuğu bir kez yüklenir; yeni içerik için mağaza güncellemesi gerekmez.</p>
      <button class="btn btn-small btn-ghost" data-action="open-console">${icon('terminal', 13)} Kontrol Odası’nı aç</button>
      <span class="console-hint">Demo kodu: 1995</span>
    </section>

    <section class="panel">
      ${sectionHead('HATIRA', 'Yolculuk notu')}
      <div class="memory-note">
        <p>“Bir yazılım mühendisi, bildiği araçlarla değil; bilmediği problemi nasıl karşıladığıyla büyür.”</p>
        <span>— PRIMER.EXE, /system/mentor</span>
      </div>
      ${docsList([{ label: 'Neden bu uygulama? (README)', url: '/README.md' }])}
    </section>

    <div class="danger-zone">
      <button class="btn btn-danger btn-small" data-action="reset-progress">${icon('alert', 13)} İlerlemeyi sıfırla</button>
      <span class="muted mono">Profil, XP, rozetler ve vardiya kaydı silinir.</span>
    </div>
    <div class="profile-foot">${icon('info', 12)} PRIMER.EXE v${b.meta?.version || '1.0.0'} · tarayıcıda saklanır · sunucuya sadece anonim olay metrikleri gider.</div>
  </div>`;
}

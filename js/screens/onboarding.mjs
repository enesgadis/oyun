import { AVATARS, TRACKS, PHASES } from '../../shared/meta.mjs';
import { avatarImage, esc, icon, logo, sceneCanvas, skillChips } from '../ui.mjs';
import { creatureDataURL } from '../sprites.mjs';

export function renderOnboarding(app) {
  const ob = app.state.onboarding;
  const stepLabel = ['GİRİŞ', 'PROFİL', 'SÖZLEŞME'][ob.step] || 'GİRİŞ';
  return `<div class="onboarding">
    <header class="ob-head">
      <span class="ob-brand">${logo()}</span>
      <span class="ob-step">${stepLabel} • 0${ob.step + 1}/03</span>
    </header>
    <main class="ob-main">
      ${ob.step === 0 ? renderIntro() : ''}
      ${ob.step === 1 ? renderProfileStep(ob) : ''}
      ${ob.step === 2 ? renderContractStep(ob) : ''}
    </main>
    <footer class="ob-foot">
      <span>PRIMER.EXE © 2026</span>
      <span class="ob-dots">${[0, 1, 2].map((i) => `<i class="${i === ob.step ? 'on' : ''}"></i>`).join('')}</span>
      <span>1995 → 2026</span>
    </footer>
  </div>`;
}

function renderIntro() {
  return `<section class="ob-intro">
    <div class="ob-visual">
      ${sceneCanvas({ art: 'terminal', seed: 'primer', color: '#5ef2c0', accent: '#5ef2c0', live: true })}
      <span class="ob-visual-tag">PRIMER v1.0 // SİSTEM HAZIR</span>
    </div>
    <span class="kicker">BİR KİTAP DEĞİL, BİR MÜFREDAT</span>
    <h1>KOD,<br><span>SENİNLE</span><br>BÜYÜR.</h1>
    <p class="ob-lead">1995’te bir roman, kızıyla birlikte değişen bir kitap hayal etti. PRIMER.EXE, yazılım mühendisliği adayının dört yılına uyum sağlayan o kitabın çalışan hâli.</p>
    <ul class="ob-points">
      <li>${icon('spark', 15)} 18 vaka, 4 yıl, tek bir büyüyen kariyer.</li>
      <li>${icon('bug', 15)} Kanıt topla, hipotez kur, sistemi onar.</li>
      <li>${icon('cloud', 15)} Arayüz sunucudan gelir; uygulama yeniden yüklenmez.</li>
    </ul>
    <button class="btn btn-primary btn-wide" data-action="onboarding-next">Sistemi başlat ${icon('arrow', 16)}</button>
    <button class="btn btn-ghost btn-wide" data-action="onboarding-demo">Yıl 3 demo profiliyle bak</button>
    <p class="ob-fine">Demo profil, dört yıllık yolculuğun ortasından başlar. İstediğin an sıfırlayabilirsin.</p>
  </section>`;
}

function renderProfileStep(ob) {
  return `<section class="ob-profile">
    <span class="kicker">KİŞİSELLEŞTİRME</span>
    <h1>Vardiya defterini aç.</h1>
    <p class="ob-lead">İçerik seçtiğin alana göre ağırlık kazanır. İsmin ve avatarın raporda, ekibinde ve kariyer haritanda görünür.</p>
    <label class="field">
      <span class="field-label">Adın / takma adın</span>
      <input id="ob-name" name="name" maxlength="16" autocomplete="nickname" placeholder="Deniz" value="${esc(ob.name)}" />
    </label>
    <div class="field">
      <span class="field-label">Pixel avatarın</span>
      <div class="avatar-picker" role="radiogroup" aria-label="Avatar seç">
        ${AVATARS.map((a) => `<button class="avatar-choice ${ob.avatar === a.id ? 'selected' : ''}" data-action="onboarding-avatar" data-avatar="${a.id}" role="radio" aria-checked="${ob.avatar === a.id}">
          <img src="${creatureDataURL({ seed: a.id, kind: a.kind, color: a.color, acc: a.acc, scale: 5 })}" width="54" height="54" alt="">
          <span>${esc(a.name)}</span>
        </button>`).join('')}
      </div>
    </div>
    <div class="field">
      <span class="field-label">Hangi alan seni çekiyor?</span>
      <div class="track-grid" role="radiogroup" aria-label="Alan seç">
        ${TRACKS.map((t) => `<button class="track-choice ${ob.track === t.id ? 'selected' : ''}" data-action="onboarding-track" data-track="${t.id}" role="radio" aria-checked="${ob.track === t.id}">
          <span class="track-icon">${icon(t.icon, 18)}</span>
          <span class="track-name">${esc(t.name)}</span>
          <span class="track-blurb">${esc(t.blurb)}</span>
        </button>`).join('')}
      </div>
    </div>
    <p class="ob-error" id="ob-error" role="alert"></p>
    <div class="ob-actions">
      <button class="btn btn-ghost" data-action="onboarding-back">Geri</button>
      <button class="btn btn-primary" data-action="onboarding-next">Devam ${icon('arrow', 14)}</button>
    </div>
  </section>`;
}

function renderContractStep(ob) {
  const track = TRACKS.find((t) => t.id === ob.track) || TRACKS[TRACKS.length - 1];
  const baseSkills = track.skills;
  const preview = { avatar: ob.avatar, skills: {} };
  return `<section class="ob-contract">
    <span class="kicker">YIL 1 • ÇIRAK</span>
    <h1>Dört yıllık sözleşme.</h1>
    <p class="ob-lead">Bu uygulama bir kurs değil; seninle büyüyen bir çalışma masası. Seviyen arttıkça arayüz, vaka zorluğu ve sistemin sana verdiği destek değişir.</p>
    <div class="contract-card">
      <div class="contract-identity">
        ${avatarImage({ avatar: ob.avatar, skills: preview }, 84)}
        <div>
          <span class="kicker">MÜHENDİS ADAYI</span>
          <strong>${esc(ob.name || 'İsimsiz')}</strong>
          <span class="muted">${esc(track.name)} • Yıl 1</span>
        </div>
      </div>
      <div class="contract-line"><span>BAŞLANGIÇ BECERİLERİ</span>${skillChips(baseSkills)}</div>
      <ol class="contract-path">
        ${PHASES.map((p) => `<li style="--phase:${p.accent}"><span class="contract-node"></span><div><strong>${esc(p.code)} — ${esc(p.name)}</strong><small>${esc(p.blurb)}</small></div></li>`).join('')}
      </ol>
      <div class="contract-note">${icon('info', 14)} Zorluk otomatik uyarlanır: iki zor vardiyadan sonra sistem sana ekstra adım verir; üst üste başarıda meydan okuma artar.</div>
    </div>
    <button class="btn btn-primary btn-wide" data-action="onboarding-start">İlk vardiyaya gir ${icon('arrow', 16)}</button>
    <div class="ob-actions">
      <button class="btn btn-ghost" data-action="onboarding-back">Geri</button>
      <button class="btn btn-ghost" data-action="onboarding-demo">Yıl 3 demosu</button>
    </div>
    <p class="ob-fine">Seçimlerini profilden her zaman değiştirebilirsin. Verilerin tarayıcında kalır.</p>
  </section>`;
}

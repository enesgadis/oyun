import { META, PHASES, levelForXp, phaseForXp, todayKey } from '../shared/meta.mjs';
import { buildBootstrap, defaultRuntime, getCase, totalEvidence, evidenceLabel, template as fillTemplate } from '../shared/content.mjs';
import {
  applyAction,
  buildReport,
  createDemoProfile,
  createProfile,
  createRun,
  assistFor,
  setHypothesis,
  useHint,
  hypothesisState,
  isUnlocked,
  pickDaily,
  recommendation,
} from './engine.mjs';
import {
  loadProfile,
  saveProfile,
  applyReport,
  clearProfile,
  loadLastReport,
  saveLastReport,
  saveActiveRun,
  loadActiveRun,
  updateSettings,
  noteHint,
  noteConsoleOpen,
  noteShare,
} from './store.mjs';
import { api } from './api.mjs';
import { renderOnboarding } from './screens/onboarding.mjs';
import { renderHome } from './screens/home.mjs';
import { renderLibrary } from './screens/library.mjs';
import { renderCareer } from './screens/career.mjs';
import { renderProfile } from './screens/profile.mjs';
import { renderCase } from './screens/case.mjs';
import { renderReport } from './screens/report.mjs';
import { renderConsole } from './screens/console.mjs';
import { avatarImage, esc, icon, logo, reportCardCanvas, toastIcon } from './ui.mjs';
import { drawScene } from './sprites.mjs';
import { playSound, haptic } from './audio.mjs';

const NAV = [
  ['home', 'Üs', 'home'],
  ['library', 'Vakalar', 'library'],
  ['career', 'Kariyer', 'career'],
  ['profile', 'Profil', 'profile'],
];

const TITLES = {
  home: 'Üs',
  library: 'Vaka Kütüphanesi',
  career: 'Kariyer Haritası',
  profile: 'Profil',
  report: 'Vardiya Raporu',
  console: 'Kontrol Odası',
};

export const app = {
  state: {
    profile: null,
    bootstrap: buildBootstrap(defaultRuntime()),
    cases: [],
    source: 'seed',
    ready: false,
    route: { name: 'home' },
    activeRun: null,
    caseDef: null,
    run: null,
    report: null,
    onboarding: { step: 0, name: '', avatar: 'ada', track: 'undecided' },
    libFilter: { phase: 'all', status: 'all' },
    caseFilter: 'all',
    dismissedAnnouncement: null,
    console: {
      authed: false,
      code: '',
      tab: 'layout',
      busy: false,
      error: '',
      message: '',
      server: null,
      stats: null,
      jsonDraft: null,
      promptDraft: '',
      caseDraft: '',
    },
  },

  template(text) {
    return fillTemplate(text, this.vars());
  },

  vars() {
    const p = this.state.profile || {};
    const phase = phaseForXp(p.xp || 0);
    return {
      name: p.name || 'Aday',
      firstName: String(p.name || 'Aday').split(' ')[0],
      rank: phase.rank,
      phaseNo: phase.id,
      phaseName: phase.name,
      xp: p.xp || 0,
      level: levelForXp(p.xp || 0),
      streak: p.streak?.count || 0,
      season: this.state.bootstrap.season?.name || 'Sıfırıncı Gün',
      caseCount: this.state.cases.length || 18,
    };
  },

  accent() {
    return this.state.bootstrap.theme?.accent || phaseForXp(this.state.profile?.xp || 0).accent;
  },

  summaryFor(id) {
    return this.state.cases.find((c) => c.id === id) || (getCase(id) ? this.state.cases.find((x) => x.id === id) || summarizeLocal(id) : null);
  },

  getDaily() {
    return pickDaily(this.state.cases, this.state.profile, this.state.bootstrap.featuredCase);
  },

  getSuggestion(excludeId = null) {
    const pool = this.state.cases.filter((c) => c.id !== excludeId && isUnlocked(c, this.state.profile));
    if (!pool.length) return null;
    return recommendation(pool, this.state.profile);
  },

  async startCase(id, opts = {}) {
    const p = this.state.profile;
    if (!p) return false;
    const summary = this.summaryFor(id) || (getCase(id) ? summarizeLocal(id) : null);
    if (!summary) {
      this.toast('Vaka bulunamadı.', 'bad');
      return false;
    }
    if (!isUnlocked(summary, p)) {
      const phase = PHASES.find((x) => x.id === summary.phase) || PHASES[0];
      this.toast(`${phase.code} için ${phase.minXp} XP gerekiyor.`, 'warn');
      return false;
    }

    const detail = await api.caseDetail(id);
    if (!detail.data) {
      this.toast('Vaka sunucudan da yerelden de yüklenemedi.', 'bad');
      return false;
    }

    const dailyUsed = p.lastDaily === todayKey();
    const daily = Boolean(opts.daily) && !dailyUsed;
    const replay = Boolean(p.completed?.[id]);
    if (opts.daily && dailyUsed) this.toast('Bugünün bonusu alındı; vardiya normal XP ile açılıyor.', 'info');

    const assist = assistFor(p);
    const run = createRun(detail.data, { level: levelForXp(p.xp || 0), assist });
    this.state.caseDef = detail.data;
    this.state.run = run;
    this.state.activeRun = { caseId: id, run, daily, replay };
    this.state.caseFilter = 'all';
    saveActiveRun(id, run, { daily, replay });
    this.fx('open');
    api.event('case_start', { caseId: id, daily, replay });
    if (opts.fromRoute) return true;
    await this.go(`case/${id}`);
    if (opts.daily) this.toast(daily ? 'Günlük bonus etkin: +%25 XP.' : 'Vardiya açıldı.', daily ? 'good' : 'info');
    return true;
  },

  async resumeCase() {
    const active = this.state.activeRun || loadActiveRun();
    if (!active?.caseId) {
      this.toast('Devam eden vardiya yok.', 'info');
      await this.go('home');
      return;
    }
    const detail = await api.caseDetail(active.caseId);
    if (!detail.data) {
      this.toast('Kayıtlı vaka bulunamadı.', 'bad');
      return;
    }
    this.state.caseDef = detail.data;
    this.state.run = active.run;
    this.state.activeRun = active;
    this.fx('open');
    await this.go(`case/${active.caseId}`);
  },

  toast(message, tone = 'info') {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast toast-${tone}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="toast-icon">${toastIcon(tone)}</span><span>${esc(message)}</span>`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 280);
    }, 3200);
  },

  openSheet(title, body, footer = '', options = {}) {
    const root = document.getElementById('sheet-root');
    if (!root) return;
    root.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div>
      <aside class="sheet-card ${options.wide ? 'sheet-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="sheet-head">
          <span class="kicker">${esc(title)}</span>
          <button class="icon-btn" data-action="close-sheet" aria-label="Kapat">${icon('x', 16)}</button>
        </header>
        <div class="sheet-body">${body}</div>
        ${footer ? `<footer class="sheet-foot">${footer}</footer>` : ''}
      </aside>`;
    document.body.classList.add('sheet-open');
    setTimeout(() => root.querySelector('.sheet-card')?.focus?.(), 20);
  },

  closeSheet() {
    const root = document.getElementById('sheet-root');
    if (root) root.innerHTML = '';
    document.body.classList.remove('sheet-open');
  },

  async go(path) {
    const hash = `#/${path}`;
    if (location.hash === hash) {
      await renderRoute();
      return;
    }
    location.hash = hash;
  },

  navigate(path) {
    this.go(path);
  },

  async askMentor() {
    const { caseDef, run, profile } = this.state;
    if (!caseDef || !run || run.status !== 'active') {
      this.openSheet(
        'MENTOR',
        `<div class="mentor-hero">${avatarImage(profile, 56)}<div><strong>Önce bir vardiya aç.</strong><p class="muted">Mentor, aktif kanıtlar ve kalan hamleler üzerinden konuşur. Üs’ten günün vakasını seç.</p></div></div>`,
        `<button class="btn btn-primary btn-wide" data-action="nav" data-to="home">Üsse git</button>`
      );
      return;
    }
    const hint = useHint(caseDef, run);
    this.state.run = hint.run;
    this.state.activeRun = { ...(this.state.activeRun || {}), caseId: caseDef.id, run: hint.run };
    saveActiveRun(caseDef.id, hint.run, { daily: this.state.activeRun?.daily, replay: this.state.activeRun?.replay });
    noteHint();
    this.renderApp({ preserveScroll: true });
    this.openSheet(
      'MENTOR // KANAL AÇIK',
      `<div class="mentor-loading" id="mentor-body"><span class="loader small"></span><p>Mentor kanıtları okuyor…</p></div>`
    );
    this.fx('open');
    const res = await api.mentor({
      caseId: caseDef.id,
      caseCode: caseDef.code,
      title: caseDef.title,
      objective: caseDef.objective,
      evidence: hint.run.evidence.map((k) => evidenceLabel(caseDef, k)),
      evidenceTotal: totalEvidence(caseDef),
      turnsLeft: hint.run.turnsLeft,
      hints: hint.run.hints,
      name: profile.name,
      rank: phaseForXp(profile.xp || 0).rank,
      gradeHistory: (profile.results || []).slice(-4).map((r) => r.grade),
    });
    const body = document.getElementById('mentor-body');
    if (!body) return;
    const aiText = res?.text && res.source === 'gemini' ? res.text : '';
    body.className = 'mentor-answer';
    body.innerHTML = `<div class="mentor-hero">${avatarImage(profile, 48)}<div><strong>${esc(caseDef.mascot || 'Mentor')}</strong><span class="mono muted">${res?.source === 'gemini' ? 'GEMINI • CANLI' : 'YEREL MENTOR • ÇEVRİMDIŞI GÜVENLİ'}</span></div></div>
      ${aiText ? `<p class="mentor-ai">${esc(aiText)}</p>` : ''}
      <div class="mentor-tip"><span class="kicker">İPUCU ${hint.run.hints}/2</span><p>${esc(hint.text)}</p></div>
      <p class="fine">İpucu maliyeti: −3 puan. Kanıt bulmak her zaman daha kârlı.</p>`;
  },

  async performCaseAction(actionId) {
    const { caseDef, run } = this.state;
    if (!caseDef || !run) return;
    const before = run.status;
    const result = applyAction(caseDef, run, actionId);
    if (result.error) {
      this.toast(result.error, 'warn');
      this.fx('bad');
      return;
    }
    this.state.run = result.run;
    this.state.activeRun = { ...(this.state.activeRun || {}), caseId: caseDef.id, run: result.run };
    saveActiveRun(caseDef.id, result.run, { daily: this.state.activeRun?.daily, replay: this.state.activeRun?.replay });
    const fx = result.action?.fx || {};
    const harmful = Object.values(fx).some((v) => v < 0);
    this.fx(before === 'active' && result.run.status !== 'active' ? (result.run.status === 'won' ? 'good' : 'alert') : harmful ? 'bad' : 'tap');
    api.event('case_action', { caseId: caseDef.id, actionId });
    const view = this.renderApp({ preserveScroll: true });
    requestAnimationFrame(() => {
      const target = before === 'active' && result.run.status !== 'active' ? '.resolution' : '#terminal-feed';
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: target === '.resolution' ? 'center' : 'nearest' });
    });
    return view;
  },

  chooseHypothesis(id) {
    const { caseDef, run } = this.state;
    if (!caseDef || !run) return;
    const hs = hypothesisState(caseDef, run);
    if (!hs.unlocked) return this.toast('Hipotez masası seviye 3’te açılır.', 'warn');
    if (!hs.canChoose) return this.toast('Yeni kanıt bulmadan hipotezini değiştiremezsin.', 'info');
    const next = setHypothesis(caseDef, run, id);
    if (next === run) return;
    this.state.run = next;
    this.state.activeRun = { ...(this.state.activeRun || {}), caseId: caseDef.id, run: next };
    saveActiveRun(caseDef.id, next, { daily: this.state.activeRun?.daily, replay: this.state.activeRun?.replay });
    const after = hypothesisState(caseDef, next);
    this.fx(after.correct ? 'good' : 'bad');
    api.event('hypothesis', { caseId: caseDef.id, hypothesisId: id, correct: after.correct });
    this.renderApp({ preserveScroll: true });
    this.toast(after.correct ? 'Hipotez kanıtlarla uyuşuyor. +30 puan yolda.' : 'Hipotez kaydedildi. Yeni kanıt bulursan revize edebilirsin.', after.correct ? 'good' : 'warn');
  },

  openEvidence(key) {
    const { caseDef, run } = this.state;
    if (!caseDef || !run?.evidence?.includes(key)) return;
    const text = caseDef.clues?.[key] || '';
    this.openSheet(
      evidenceLabel(caseDef, key).toUpperCase(),
      `<div class="evidence-sheet"><span class="mono muted">${esc(caseDef.code)} • KANIT</span><pre class="evidence-pre">${esc(text)}</pre></div>`,
      `<button class="btn btn-ghost btn-wide" data-action="close-sheet">Masaya dön</button>`
    );
    this.fx('tap');
  },

  async endCase() {
    const { run } = this.state;
    if (!run || run.status !== 'active') return;
    this.openSheet(
      'VARDİYAYI BİTİR',
      `<p>Kalan <strong>${run.turnsLeft}</strong> hamleyi kullanmadan vardiyayı kapatıyorsun. Rapor yine de oluşur; sistem ayakta değilse çözüm puanı gelmez.</p><p class="muted small">Devam etmek istersen “Masaya dön”ü seç. Aktif vardiya kaydedilmiş durumda.</p>`,
      `<div class="sheet-actions"><button class="btn btn-ghost" data-action="close-sheet">Masaya dön</button><button class="btn btn-danger" data-action="end-case-confirm">Raporu oluştur</button></div>`
    );
  },

  async endAndReport() {
    const { run } = this.state;
    if (!run) return;
    if (run.status === 'active') {
      this.state.run = { ...run, status: 'lost', lostReason: 'ended', finishedAt: Date.now() };
      saveActiveRun(this.state.caseDef.id, this.state.run, { daily: this.state.activeRun?.daily, replay: this.state.activeRun?.replay });
      this.state.activeRun = { ...(this.state.activeRun || {}), run: this.state.run };
    }
    this.closeSheet();
    await this.finishCase();
  },

  async finishCase() {
    const { caseDef, run, profile, activeRun } = this.state;
    if (!caseDef || !run || !profile) {
      if (this.state.report) await this.go('report');
      return;
    }
    if (run.status === 'active') {
      this.toast('Önce vardiyayı bitir.', 'warn');
      return;
    }
    const suggestion = this.getSuggestion(caseDef.id);
    const daily = Boolean(activeRun?.daily);
    const replay = Boolean(activeRun?.replay);
    const report = buildReport(caseDef, run, {
      daily,
      replay,
      levelBefore: levelForXp(profile.xp || 0),
      nextCaseId: suggestion?.case?.id || null,
    });
    report.actionLog = (run.history || []).map((h) => ({
      label: h.label,
      cat: h.cat,
      log: h.log,
      fxText: h.fxText,
      harmful: (run.harmful || []).includes(h.actionId),
      wasted: (run.wasted || []).includes(h.actionId),
    }));
    report.nextCaseTitle = suggestion?.case?.title || null;
    report.nextReason = suggestion?.reason || null;
    const application = applyReport(profile, report, caseDef, { daily });
    this.state.profile = application.profile;
    this.state.report = { ...report, application };
    this.state.activeRun = null;
    this.state.run = null;
    this.state.caseDef = null;
    this.state.dismissedAnnouncement = null;
    saveLastReport(this.state.report);
    api.event('case_end', { caseId: report.caseId, grade: report.grade, score: report.score, xp: report.xp });
    this.fx(application.levelUp ? 'levelup' : report.success ? 'good' : 'alert');
    if (application.levelUp || application.phaseUp) haptic([16, 40, 16, 40, 32], this.state.profile.settings);
    await this.go('report');
  },

  async shareReport() {
    const report = this.state.report;
    if (!report) return;
    const profile = this.state.profile;
    try {
      const dataUrl = reportCardCanvas(report, profile);
      if (!dataUrl) throw new Error('canvas');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `primer-${report.caseCode}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: `PRIMER.EXE • ${report.caseCode} ${report.grade}`,
          text: `${report.caseTitle} — ${report.score}/100. ${report.rootCause}`,
        });
        noteShare();
        this.toast('Rapor paylaşıldı.', 'good');
        return;
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `primer-${report.caseCode}-${report.grade}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      noteShare();
      this.toast('Rapor kartı indirildi.', 'good');
    } catch (error) {
      if (error?.name !== 'AbortError') this.toast('Paylaşım kartı oluşturulamadı.', 'bad');
    }
  },

  openConsole() {
    if (!this.state.profile) return;
    noteConsoleOpen();
    this.go('console');
  },

  async consoleAuth() {
    const input = document.getElementById('console-code');
    const code = (input?.value || this.state.console.code || '').trim();
    const c = this.state.console;
    c.code = code;
    c.busy = true;
    c.error = '';
    this.renderApp();
    try {
      const server = await api.consoleState(code);
      c.authed = true;
      c.server = server;
      c.busy = false;
      c.code = code;
      if (server.bootstrap) this.absorbBootstrap(server.bootstrap);
      try {
        c.stats = await api.consoleStats(code);
      } catch {
        c.stats = null;
      }
      this.renderApp();
      this.toast('Kontrol Odası açık. Sunucu çevrimiçi.', 'good');
      this.fx('good');
    } catch (error) {
      c.busy = false;
      c.authed = false;
      c.error = error.message || 'Giriş başarısız.';
      this.renderApp();
      this.toast(c.error, 'bad');
      this.fx('bad');
    }
  },

  async consoleRefresh() {
    const c = this.state.console;
    if (!c.authed) return;
    c.busy = true;
    c.error = '';
    this.renderApp();
    try {
      const [server, stats] = await Promise.all([api.consoleState(c.code), api.consoleStats(c.code).catch(() => null)]);
      c.server = server;
      c.stats = stats;
      if (server.bootstrap) this.absorbBootstrap(server.bootstrap);
      c.busy = false;
      this.renderApp();
      this.toast(`Durum alındı: rev ${server.revision}.`, 'info');
    } catch (error) {
      c.busy = false;
      c.error = error.message;
      this.renderApp();
    }
  },

  async applyConsolePreset(preset) {
    const c = this.state.console;
    if (!c.authed) return;
    const patch = PRESETS[preset];
    if (!patch) return;
    c.busy = true;
    c.error = '';
    c.message = '';
    this.renderApp();
    try {
      const res = await api.applyPatch(patch, c.code);
      c.busy = false;
      c.message = `Rev ${res.revision} yayınlandı • ${PRESET_LABELS[preset] || preset}`;
      if (res.bootstrap) this.absorbBootstrap(res.bootstrap);
      c.stats = await api.consoleStats(c.code).catch(() => c.stats);
      this.renderApp();
      this.toast(`Sunucu rev ${res.revision} yayınladı. Tüm istemciler güncellenecek.`, 'good');
      this.fx('good');
    } catch (error) {
      c.busy = false;
      c.error = error.message;
      this.renderApp();
      this.toast(error.message, 'bad');
    }
  },

  async applyConsoleJson() {
    const c = this.state.console;
    if (!c.authed) return;
    const area = document.getElementById('console-json');
    let patch;
    try {
      patch = JSON.parse(area?.value || '{}');
    } catch (error) {
      c.error = `JSON hatası: ${error.message}`;
      this.renderApp();
      return;
    }
    c.busy = true;
    c.error = '';
    this.renderApp();
    try {
      const res = await api.applyPatch(patch, c.code);
      c.busy = false;
      c.message = `Özel patch yayınlandı • rev ${res.revision}`;
      if (res.bootstrap) this.absorbBootstrap(res.bootstrap);
      c.stats = await api.consoleStats(c.code).catch(() => c.stats);
      this.renderApp();
      this.toast(`Patch uygulandı. Yeni revizyon: ${res.revision}.`, 'good');
      this.fx('good');
    } catch (error) {
      c.busy = false;
      c.error = error.message;
      this.renderApp();
    }
  },

  async generateConsoleBlock() {
    const c = this.state.console;
    if (!c.authed) return;
    const input = document.getElementById('console-prompt');
    const prompt = (input?.value || '').trim();
    if (!prompt) {
      c.error = 'Önce bir istek yaz. Örnek: “Kriz modunu duyuran kırmızı bir banner ekle.”';
      this.renderApp();
      return;
    }
    c.busy = true;
    c.error = '';
    c.message = '';
    this.renderApp();
    try {
      const res = await api.generate(prompt, c.code);
      c.busy = false;
      c.message = `${res.source === 'gemini' ? 'Gemini' : 'Yerel şema motoru'} yeni bir blok üretti • rev ${res.revision}`;
      if (res.bootstrap) this.absorbBootstrap(res.bootstrap);
      c.stats = await api.consoleStats(c.code).catch(() => c.stats);
      this.renderApp();
      this.toast('Yeni arayüz bloğu sunucudan yayınlandı.', 'good');
      this.fx('levelup');
    } catch (error) {
      c.busy = false;
      c.error = error.message;
      this.renderApp();
      this.toast(error.message, 'bad');
    }
  },

  async uploadConsoleCase() {
    const c = this.state.console;
    if (!c.authed) return;
    const area = document.getElementById('console-case');
    let parsed;
    try {
      parsed = JSON.parse(area?.value || '{}');
    } catch (error) {
      c.error = `Vaka JSON hatası: ${error.message}`;
      this.renderApp();
      return;
    }
    c.busy = true;
    c.error = '';
    this.renderApp();
    try {
      const res = await api.applyPatch({ extraCase: parsed }, c.code);
      c.busy = false;
      c.message = `Yeni vaka yayında • ${parsed.code || parsed.id || 'vaka'} • rev ${res.revision}`;
      if (res.bootstrap) this.absorbBootstrap(res.bootstrap);
      c.stats = await api.consoleStats(c.code).catch(() => c.stats);
      this.renderApp();
      this.toast('Vaka yeniden derleme olmadan yayınlandı.', 'good');
      this.fx('good');
    } catch (error) {
      c.busy = false;
      c.error = error.message;
      this.renderApp();
    }
  },

  async resetConsole() {
    const c = this.state.console;
    if (!c.authed) return;
    c.busy = true;
    c.error = '';
    this.renderApp();
    try {
      const res = await api.resetConsole(c.code);
      c.busy = false;
      c.message = `Sunucu başlangıç düzenine döndü • rev ${res.revision}`;
      if (res.bootstrap) this.absorbBootstrap(res.bootstrap);
      c.stats = await api.consoleStats(c.code).catch(() => c.stats);
      this.renderApp();
      this.toast('Kontrol Odası sıfırlandı.', 'info');
    } catch (error) {
      c.busy = false;
      c.error = error.message;
      this.renderApp();
    }
  },

  resetProgress() {
    this.openSheet(
      'İLERLEMEYİ SIFIRLA',
      `<p>Profil, XP, rozetler, vardiya kayıtları ve önbellek silinecek. Bu işlem geri alınamaz.</p><p class="muted small">Sunucudaki anonim olay metrikleri ve Kontrol Odası ayarları silinmez.</p>`,
      `<div class="sheet-actions"><button class="btn btn-ghost" data-action="close-sheet">Vazgeç</button><button class="btn btn-danger" data-action="reset-confirm">Sıfırla</button></div>`
    );
  },

  hardReset() {
    clearProfile();
    this.state.profile = null;
    this.state.activeRun = null;
    this.state.caseDef = null;
    this.state.run = null;
    this.state.report = null;
    this.state.onboarding = { step: 0, name: '', avatar: 'ada', track: 'undecided' };
    this.state.console = { authed: false, code: '', tab: 'layout', busy: false, error: '', message: '', server: null, stats: null, jsonDraft: null, promptDraft: '', caseDraft: '' };
    this.closeSheet();
    location.hash = '#/';
    this.render();
    this.toast('Yerel ilerleme temizlendi.', 'info');
  },

  toggleSetting(key) {
    const next = !this.state.profile.settings?.[key];
    const updated = updateSettings({ [key]: next });
    if (updated) this.state.profile = updated;
    applyTheme();
    this.renderApp({ preserveScroll: true });
    if (key === 'sound' && next) this.fx('tap');
    this.toast(`${key === 'sound' ? 'Ses' : key === 'haptics' ? 'Titreşim' : 'Hareket'} ${next ? 'açık' : 'kapalı'}.`, 'info');
  },

  async onboardNext() {
    const ob = this.state.onboarding;
    if (ob.step === 0) {
      ob.step = 1;
      this.render();
      this.fx('tap');
      return;
    }
    if (ob.step === 1) {
      const input = document.getElementById('ob-name');
      if (input) ob.name = input.value.trim();
      if (ob.name.length < 2) {
        const err = document.getElementById('ob-error');
        if (err) err.textContent = 'En az 2 karakterlik bir ad gir.';
        input?.focus();
        this.fx('bad');
        return;
      }
      ob.step = 2;
      this.render();
      this.fx('tap');
      return;
    }
    this.createFromOnboarding();
  },

  onboardBack() {
    const ob = this.state.onboarding;
    ob.step = Math.max(0, ob.step - 1);
    this.render();
    this.fx('tap');
  },

  createFromOnboarding() {
    const ob = this.state.onboarding;
    const profile = createProfile({ name: ob.name || 'Deniz', avatar: ob.avatar, track: ob.track });
    saveProfile(profile);
    this.state.profile = profile;
    this.state.activeRun = null;
    this.state.report = null;
    api.event('profile_created', { track: ob.track, avatar: ob.avatar });
    this.fx('levelup');
    location.hash = '#/home';
    this.render();
    this.toast(`Vardiya defteri açıldı, ${profile.name}. İlk vaka seni bekliyor.`, 'good');
  },

  loadDemo() {
    const profile = createDemoProfile();
    saveProfile(profile);
    this.state.profile = profile;
    this.state.activeRun = null;
    this.state.report = null;
    api.event('demo_profile', {});
    this.fx('levelup');
    location.hash = '#/home';
    this.render();
    this.toast('Yıl 3 demo profili yüklendi. 12 vaka çözülmüş durumda.', 'good');
  },

  absorbBootstrap(data) {
    if (!data?.homeBlocks) return;
    this.state.bootstrap = data;
    this.state.cases = data.cases || [];
    this.state.source = 'live';
    applyTheme();
  },

  fx(name) {
    playSound(name, this.state.profile?.settings || {});
    if (name === 'good') haptic(12, this.state.profile?.settings || {});
    if (name === 'bad' || name === 'alert') haptic([18, 30, 18], this.state.profile?.settings || {});
  },

  renderApp({ preserveScroll = false } = {}) {
    const scrollY = window.scrollY;
    const route = this.state.route;
    let screen = '';
    try {
      if (route.name === 'home') screen = renderHome(this);
      else if (route.name === 'library') screen = renderLibrary(this);
      else if (route.name === 'career') screen = renderCareer(this);
      else if (route.name === 'profile') screen = renderProfile(this);
      else if (route.name === 'case') screen = renderCase(this);
      else if (route.name === 'report') screen = renderReport(this);
      else if (route.name === 'console') screen = renderConsole(this);
    } catch (error) {
      console.error('[PRIMER] render error', error);
      screen = `<div class="fatal-panel"><span class="kicker">RENDER HATASI</span><h1>Ekran çizilemedi.</h1><pre>${esc(error.message)}</pre><button class="btn btn-primary" data-action="nav" data-to="home">Üsse dön</button></div>`;
    }
    const chrome = this.state.profile && !['case', 'report', 'console'].includes(route.name);
    document.body.dataset.route = route.name;
    document.title = `${META.appName} — ${TITLES[route.name] || 'Üs'}`;
    const root = document.getElementById('app');
    if (!root) return;
    if (!this.state.profile) {
      root.innerHTML = renderOnboarding(this);
    } else if (chrome) {
      root.innerHTML = `<div class="app-shell">
        ${renderHeader(this)}
        <main class="view view-${route.name}" id="view">${screen}</main>
        ${renderNav(this)}
      </div>`;
    } else {
      root.innerHTML = `<div class="app-shell app-shell-bare"><main class="view view-${route.name}" id="view">${screen}</main></div>`;
    }
    this.mountScenes();
    requestAnimationFrame(() => {
      if (preserveScroll) window.scrollTo(0, scrollY);
      else window.scrollTo(0, 0);
    });
    this.state.ready = true;
  },

  render(options) {
    if (!this.state.profile) {
      document.body.dataset.route = 'onboarding';
      document.title = `${META.appName} — Giriş`;
      const root = document.getElementById('app');
      if (root) root.innerHTML = renderOnboarding(this);
      this.mountScenes();
      this.state.ready = true;
      window.scrollTo(0, 0);
      return;
    }
    this.renderApp(options);
  },

  mountScenes() {
    const canvases = [...document.querySelectorAll('canvas.scene-canvas')];
    if (!canvases.length) {
      stopSceneLoop();
      return;
    }
    sceneCanvases = canvases;
    const reduce = !this.state.profile?.settings?.motion;
    if (reduce) {
      stopSceneLoop();
      for (const canvas of canvases) drawCanvas(canvas, 0);
      return;
    }
    startSceneLoop();
  },
};

const PRESETS = {
  calm: {
    season: { id: 's1', name: 'Sıfırıncı Gün', tag: 'SEZON 01', accent: '#5ef2c0' },
    theme: { accent: '#5ef2c0', accent2: '#59d7ff', bg: '#080d16' },
    announcement: { tone: 'info', title: 'SİSTEM SAKİN', text: 'Kontrol Odası sakin üs düzenini yayınladı. Vardiyalar normal akışta.' },
  },
  incident: {
    season: { id: 's1', name: 'Sıfırıncı Gün', tag: 'SEZON 01 • OLAY', accent: '#ff6b6b' },
    theme: { accent: '#ff8fab', accent2: '#ffc857', bg: '#140a12' },
    announcement: { tone: 'warn', title: 'CANLI OLAY: REV 4', text: 'Kontrol Odası kriz modunu yayınladı. Trust düşüyor; nöbet masası önceliklendirildi.' },
    appendBlocks: [
      { type: 'banner', tone: 'warn', title: 'NÖBETÇİ ÇAĞRISI', text: 'Tüm ekipler kanalda. Önce ölç, sonra müdahale et. Durum sayfası 3 dakika içinde güncellenmeli.', cta: { label: 'Rastgele vardiya al', action: 'random-case' } },
    ],
    featuredCase: 'c14',
  },
  finale: {
    season: { id: 's4', name: 'Mimar', tag: 'SEZON FİNALİ', accent: '#a78bfa' },
    theme: { accent: '#a78bfa', accent2: '#f0abfc', bg: '#0b0918' },
    announcement: { tone: 'success', title: 'KARİYER FİNALİ', text: 'Dördüncü yıl açıldı. Artık sistem değil, başka mühendislerin kararları da masada.' },
    featuredCase: 'c13',
    appendBlocks: [
      { type: 'seasonPass', title: 'MİMAR YOLU', items: [{ level: 9, label: 'Mentorluk', phase: 'Yıl 4' }, { level: 10, label: 'Mimari sunum', phase: 'Yıl 4' }, { level: 12, label: 'Kendi vardiyan', phase: 'Yıl 4' }] },
    ],
  },
};

const PRESET_LABELS = { calm: 'Sakin Üs', incident: 'Kriz Modu', finale: 'Sezon Finali' };

let sceneCanvases = [];
let sceneFrame = null;
let sceneLast = 0;

function startSceneLoop() {
  if (sceneFrame) return;
  const tick = (time) => {
    if (time - sceneLast > 110) {
      sceneLast = time;
      for (const canvas of sceneCanvases) drawCanvas(canvas, time);
    }
    sceneFrame = requestAnimationFrame(tick);
  };
  sceneFrame = requestAnimationFrame(tick);
}

function stopSceneLoop() {
  if (sceneFrame) cancelAnimationFrame(sceneFrame);
  sceneFrame = null;
}

function drawCanvas(canvas, time) {
  if (!canvas?.isConnected) return;
  drawScene(canvas, {
    art: canvas.dataset.art,
    seed: canvas.dataset.seed,
    color: canvas.dataset.color,
    accent: canvas.dataset.accent,
    status: canvas.dataset.status,
    time,
  });
}

function summarizeLocal(id) {
  const c = getCase(id);
  if (!c) return null;
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    subtitle: c.subtitle,
    phase: c.phase,
    difficulty: c.difficulty,
    minutes: c.minutes,
    discipline: c.discipline,
    art: c.art,
    avatar: c.avatar,
    mascot: c.mascot,
    skills: c.skills,
    tags: c.tags,
    turns: c.turns,
    actionCount: c.actions?.length || 0,
  };
}

function renderHeader() {
  const p = app.state.profile;
  const level = levelForXp(p.xp || 0);
  return `<header class="app-head">
    <button class="brand-btn" data-action="nav" data-to="home" aria-label="Üsse dön">${logo({ compact: true })}</button>
    <div class="head-status">
      <button class="head-chip streak-chip" data-action="nav" data-to="profile" title="Seri">${icon('flame', 12)} ${p.streak?.count || 0}</button>
      <button class="head-chip level-chip" data-action="nav" data-to="career" title="Kıdem">LV ${level}</button>
      <button class="head-avatar" data-action="nav" data-to="profile" aria-label="Profil">${avatarImage(p, 30)}</button>
      <button class="icon-btn sound-btn" data-action="toggle-setting" data-key="sound" aria-label="Sesi aç veya kapat">${icon(p.settings?.sound ? 'sound' : 'mute', 16)}</button>
    </div>
  </header>`;
}

function renderNav() {
  const current = app.state.route.name;
  return `<nav class="bottom-nav" aria-label="Ana gezinme">
    ${NAV.map(([id, label, ic]) => `<button class="nav-item ${current === id ? 'on' : ''}" data-action="nav" data-to="${id}" ${current === id ? 'aria-current="page"' : ''}>
      <span class="nav-icon">${icon(ic, 20)}</span><span>${label}</span>
    </button>`).join('')}
  </nav>`;
}

function applyTheme() {
  const theme = app.state.bootstrap.theme || {};
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent || '#5ef2c0');
  root.style.setProperty('--accent-2', theme.accent2 || '#59d7ff');
  root.style.setProperty('--bg', theme.bg || '#080d16');
  root.classList.toggle('reduce-motion', app.state.profile ? !app.state.profile.settings?.motion : false);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.bg || '#080d16');
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  if (!raw) return { name: 'home' };
  const [name, id] = raw.split('/');
  if (name === 'case' && id) return { name: 'case', id };
  if (['home', 'library', 'career', 'profile', 'report', 'console'].includes(name)) return { name };
  return { name: 'home' };
}

async function ensureCaseRoute(id) {
  if (!id) return false;
  const active = app.state.activeRun;
  if (active?.caseId === id && active.run?.status === 'active') {
    if (!app.state.caseDef || app.state.caseDef.id !== id) {
      const detail = await api.caseDetail(id);
      if (!detail.data) return false;
      app.state.caseDef = detail.data;
      app.state.run = active.run;
    }
    return true;
  }
  if (app.state.caseDef?.id === id && app.state.run) return true;
  return app.startCase(id, { fromRoute: true });
}

let renderToken = 0;

async function renderRoute() {
  const token = ++renderToken;
  if (!app.state.profile) {
    app.state.route = { name: 'onboarding' };
    app.render();
    return;
  }
  const route = parseHash();
  if (route.name === 'case') {
    const ok = await ensureCaseRoute(route.id);
    if (token !== renderToken) return;
    if (!ok) {
      await app.go('home');
      return;
    }
  }
  app.state.route = route;
  if (route.name === 'report' && !app.state.report) {
    const stored = loadLastReport();
    if (stored) app.state.report = stored;
  }
  app.renderApp();
}

async function onRevision(payload) {
  if (payload?.revision) {
    try {
      const { data, source } = await api.bootstrap();
      const changed = data.revision !== app.state.bootstrap.revision;
      app.absorbBootstrap(data);
      app.state.source = source;
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (app.state.profile && !typing) {
        if (app.state.route.name === 'console' && app.state.console.authed) {
          api.consoleState(app.state.console.code).then((server) => {
            app.state.console.server = server;
            if (app.state.console.authed) app.renderApp({ preserveScroll: true });
          }).catch(() => {});
        } else {
          app.renderApp({ preserveScroll: true });
        }
      }
      if (changed && app.state.profile) app.toast(`Sunucu yeni arayüzü yayınladı: rev ${data.revision}.`, 'info');
    } catch (error) {
      console.warn('[PRIMER] revision refresh failed', error);
    }
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('[PRIMER] SW', error.message));
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (el.tagName === 'A') event.preventDefault();
    handleAction(action, el, event);
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'ob-name') app.state.onboarding.name = event.target.value;
    if (event.target.id === 'console-code') app.state.console.code = event.target.value;
    if (event.target.id === 'console-json') app.state.console.jsonDraft = event.target.value;
    if (event.target.id === 'console-prompt') app.state.console.promptDraft = event.target.value;
    if (event.target.id === 'console-case') app.state.console.caseDraft = event.target.value;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') app.closeSheet();
  });

  window.addEventListener('hashchange', () => {
    renderRoute().catch((error) => {
      console.error(error);
      app.toast('Sayfa yüklenemedi; üsse dönülüyor.', 'bad');
      app.go('home');
    });
  });

  window.addEventListener('online', () => app.toast('Bağlantı geri geldi. Sunucu güncellemeleri açık.', 'good'));
  window.addEventListener('offline', () => app.toast('Çevrimdışısın. Önbellek ve yerel içerik kullanılıyor.', 'warn'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSceneLoop();
    else app.mountScenes();
  });
}

async function handleAction(action, el, event) {
  const data = el.dataset;
  switch (action) {
    case 'onboarding-next':
      return app.onboardNext();
    case 'onboarding-back':
      return app.onboardBack();
    case 'onboarding-avatar':
      app.state.onboarding.avatar = data.avatar;
      return app.render();
    case 'onboarding-track':
      app.state.onboarding.track = data.track;
      return app.render();
    case 'onboarding-start':
      return app.createFromOnboarding();
    case 'onboarding-demo':
      return app.loadDemo();
    case 'nav':
      return app.navigate(data.to || 'home');
    case 'daily': {
      const daily = app.getDaily();
      if (!daily?.case) return app.toast('Bugün için uygun vaka yok.', 'warn');
      return app.startCase(daily.case.id, { daily: true });
    }
    case 'start-daily': {
      const id = data.id || app.getDaily()?.case?.id;
      if (id) return app.startCase(id, { daily: true });
      return app.toast('Günün vakası bulunamadı.', 'warn');
    }
    case 'start-case':
      return app.startCase(data.id);
    case 'resume-case':
      return app.resumeCase();
    case 'random-case': {
      const pool = app.state.cases.filter((c) => isUnlocked(c, app.state.profile) && !app.state.profile.completed?.[c.id]);
      const list = pool.length ? pool : app.state.cases.filter((c) => isUnlocked(c, app.state.profile));
      if (!list.length) return app.toast('Açık vaka yok.', 'warn');
      const pick = list[Math.floor(Math.random() * list.length)];
      return app.startCase(pick.id);
    }
    case 'locked-case': {
      const summary = app.summaryFor(data.id);
      const phase = PHASES.find((x) => x.id === summary?.phase) || PHASES[0];
      return app.toast(`${phase.code} için ${phase.minXp} XP gerekiyor. Şu an ${app.state.profile.xp} XP’desin.`, 'warn');
    }
    case 'library-phase':
      app.state.libFilter.phase = data.phase;
      if (app.state.route.name !== 'library') return app.go('library');
      return app.renderApp({ preserveScroll: true });
    case 'library-status':
      app.state.libFilter.status = data.status;
      return app.renderApp({ preserveScroll: true });
    case 'case-back':
      return app.go('home');
    case 'case-filter':
      app.state.caseFilter = data.filter || 'all';
      return app.renderApp({ preserveScroll: true });
    case 'case-action':
      return app.performCaseAction(data.id);
    case 'choose-hypothesis':
      return app.chooseHypothesis(data.id);
    case 'view-evidence':
      return app.openEvidence(data.key);
    case 'missing-evidence':
      return app.toast('Bu kanıt henüz masada değil. İlgili inceleme eylemini kullan.', 'info');
    case 'ask-mentor':
      return app.askMentor();
    case 'end-case':
      return app.endCase();
    case 'end-case-confirm':
      return app.endAndReport();
    case 'open-report':
      return app.finishCase();
    case 'share-report':
      return app.shareReport();
    case 'replay-case':
      return app.startCase(app.state.report?.caseId, { replay: true });
    case 'next-case': {
      const next = app.state.report?.nextCaseId;
      if (next) return app.startCase(next);
      return app.go('home');
    }
    case 'dismiss-announcement':
      app.state.dismissedAnnouncement = app.state.bootstrap.revision;
      return app.renderApp({ preserveScroll: true });
    case 'toggle-setting':
      return app.toggleSetting(data.key);
    case 'open-console':
      return app.openConsole();
    case 'reset-progress':
      return app.resetProgress();
    case 'reset-confirm':
      return app.hardReset();
    case 'close-sheet':
      return app.closeSheet();
    case 'console-auth':
      return app.consoleAuth();
    case 'console-tab':
      app.state.console.tab = data.tab || 'layout';
      return app.renderApp({ preserveScroll: true });
    case 'console-preset':
      return app.applyConsolePreset(data.preset);
    case 'console-apply-json':
      return app.applyConsoleJson();
    case 'console-generate':
      return app.generateConsoleBlock();
    case 'console-upload-case':
      return app.uploadConsoleCase();
    case 'console-reset':
      return app.resetConsole();
    case 'console-refresh':
      return app.consoleRefresh();
    case 'console-fill-demo':
      return fillConsoleDemoCase();
    case 'console-fill-prompt':
      app.state.console.promptDraft = data.prompt || '';
      app.renderApp({ preserveScroll: true });
      document.getElementById('console-prompt')?.focus();
      return;
    case 'console-close':
      return app.go('home');
    default:
      console.info('[PRIMER] unhandled action', action);
  }
}

function fillConsoleDemoCase() {
  const area = document.getElementById('console-case');
  if (!area) return;
  const template = {
    id: 'c19',
    code: 'DEV-19',
    title: 'Sessiz Geri Dönüş',
    subtitle: 'Feature flag kapatıldı ama kullanıcılar hâlâ eski ekranı görüyor.',
    phase: 4,
    difficulty: 3,
    minutes: 8,
    discipline: 'Sistem Tasarımı',
    art: 'server',
    avatar: 'cache',
    mascot: 'Önbellek',
    role: 'Dağıtık Sistem',
    skills: ['systems', 'debug', 'testing'],
    tags: ['cache', 'feature-flag', 'rollout'],
    turns: 10,
    vitals: { build: 70, perf: 65, trust: 55, team: 70 },
    objective: 'Neden eski ekranın hâlâ servis edildiğini kanıtla ve tekrarını engelle.',
    hypotheses: [
      { id: 'h1', text: 'CDN ve istemci önbelleği eski bundle’ı tutuyor.', correct: true },
      { id: 'h2', text: 'Feature flag servisi tüm kullanıcıları kapatmış.', correct: false },
      { id: 'h3', text: 'Veritabanı okuma replikası geride kalmış.', correct: false },
    ],
    clues: {
      logs: 'Edge logları: flag kapatıldıktan sonra 6 saat boyunca eski asset hash’i 200 dönmüş.',
      metrics: 'Yeni bundle indirme oranı %12. Eski hash hâlâ trafiğin %88’inde.',
      code: 'index.html cache-control: immutable; service worker precache listesi sürümlenmemiş.',
      git: 'flag commit’i var; asset manifest commit’i yok.',
      teammate: 'Mobil ekip, uygulama içi webview önbelleğini temizlemediklerini söylüyor.',
      docs: 'Release runbook’unda CDN purge adımı “opsiyonel” olarak işaretlenmiş.',
    },
    actions: [
      { id: 'a1', label: 'CDN purge planını çıkar', cat: 'investigate', icon: 'cloud', cost: 1, reveal: ['logs'] },
      { id: 'a2', label: 'Service worker sürümünü artır', cat: 'fix', icon: 'code', cost: 1, needs: ['code'], fx: { build: 8, perf: 6 } },
      { id: 'a3', label: 'Asset manifest’i commit’e ekle', cat: 'fix', icon: 'git', cost: 1, needs: ['git'], fx: { build: 12, trust: 4 } },
      { id: 'a4', label: 'Durum sayfasında açıklama yayınla', cat: 'comm', icon: 'megaphone', cost: 1, fx: { trust: 8 }, comm: true, flag: 'status' },
      { id: 'a5', label: 'Mobil webview için cache-busting gönder', cat: 'fix', icon: 'phone', cost: 1, needs: ['teammate'], fx: { build: 8, perf: 4 } },
      { id: 'a6', label: 'Önbellek katmanını tamamen kapat', cat: 'risky', icon: 'alert', cost: 1, fx: { perf: -20, build: 4 }, bad: true },
    ],
    fixChain: ['a2', 'a3'],
    debrief: {
      rootCause: 'Dağıtım yalnızca feature flag’i değiştirdi; asset manifest ve service worker sürümü birlikte yayınlanmadı. CDN purge runbook’ta opsiyonel kaldığı için eski hash uzun süre servis edildi.',
      summary: 'Doğru düzeltme, dağıtımı bir bütün olarak ele almak: flag, asset manifest, service worker ve CDN purge aynı release planında olmalı.',
      takeaways: ['Feature flag bir dağıtım stratejisidir; tek başına yeterli değildir.', 'Önbellek anahtarları sürümlenmemişse “kapattım” demek “durdu” demek değildir.', 'Runbook’taki opsiyonel adımlar, olay anında unutulan adımlardır.'],
      realWorld: 'Büyük ekipler feature flag, CDN ve istemci önbelleğini tek bir release manifest’iyle yönetir; purge adımı otomatik ve geri alınabilir olur.',
      docs: [{ label: 'Google SRE — Release Engineering', url: 'https://sre.google/sre-book/release-engineering/' }],
      mentor: 'Dağıtımı bitiren şey kodun merge’ü değil; kullanıcının yeni kodu gerçekten aldığını kanıtlamaktır.',
    },
  };
  area.value = JSON.stringify(template, null, 2);
  app.toast('Örnek vaka JSON’u dolduruldu. Göndererek sunucudan yayınlayabilirsin.', 'info');
}

export async function boot() {
  try {
    bindEvents();
    let stored = loadProfile();
    // ?demo=1 is a presentation shortcut: a fresh visitor lands on the
    // Year-3 profile without a three-screen onboarding. It never overrides
    // an existing local career.
    if (!stored && new URLSearchParams(location.search).get('demo') === '1') {
      stored = createDemoProfile();
      saveProfile(stored);
    }
    app.state.profile = stored;
    const { data, source } = await api.bootstrap();
    app.absorbBootstrap(data);
    app.state.source = source;
    app.state.activeRun = stored ? loadActiveRun() : null;
    app.state.report = stored ? loadLastReport() : null;
    applyTheme();
    document.getElementById('boot-screen')?.classList.add('gone');
    if (!stored) {
      app.state.route = { name: 'onboarding' };
      app.render();
    } else {
      await renderRoute();
    }
    api.connect(onRevision);
    registerServiceWorker();
    if (source !== 'live') app.toast('Sunucuya ulaşılamadı; yerel içerik ve önbellek kullanılıyor.', 'warn');
    if (stored) {
      const daily = app.getDaily();
      if (daily?.case) api.event('home_open', { dailyCase: daily.case.id });
    }
  } catch (error) {
    console.error('[PRIMER] boot failed', error);
    const root = document.getElementById('app');
    if (root) {
      root.innerHTML = `<div class="fatal-panel"><span class="kicker">ÖNYÜKLEME HATASI</span><h1>Sistem açılamadı.</h1><pre>${esc(error.message)}</pre><button class="btn btn-primary" data-action="reload">Tekrar dene</button></div>`;
    }
    document.getElementById('boot-screen')?.classList.add('gone');
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="reload"]')) location.reload();
    });
  }
}

if (typeof window !== 'undefined') {
  boot();
}

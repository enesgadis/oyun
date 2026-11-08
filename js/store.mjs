import { BADGES, PHASES, SKILLS, levelForXp, phaseForXp, todayKey } from '../shared/meta.mjs';
import { totalEvidence } from '../shared/content.mjs';

const PROFILE_KEY = 'primer.profile.v1';
const REPORT_KEY = 'primer.lastReport.v1';
const CACHE_KEY = 'primer.bootstrap.v1';

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadProfile() {
  if (typeof localStorage === 'undefined') return null;
  const p = safeParse(localStorage.getItem(PROFILE_KEY), null);
  if (!p || !p.id) return null;
  p.settings = { sound: true, haptics: true, motion: true, ...(p.settings || {}) };
  p.counters = { hints: 0, shares: 0, consoleOpens: 0, ...(p.counters || {}) };
  p.skills = p.skills || {};
  p.completed = p.completed || {};
  p.results = p.results || [];
  p.badges = p.badges || [];
  return p;
}

export function saveProfile(profile) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(REPORT_KEY);
  localStorage.removeItem(CACHE_KEY);
}

export function loadLastReport() {
  return safeParse(localStorage.getItem(REPORT_KEY), null);
}

export function saveLastReport(report) {
  try {
    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  } catch {
    /* storage full: report is still in memory */
  }
}

export function loadCachedBootstrap() {
  return safeParse(localStorage.getItem(CACHE_KEY), null);
}

export function saveCachedBootstrap(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function saveActiveRun(caseId, run, extra = {}) {
  const p = loadProfile();
  if (!p) return;
  p.activeRun = { caseId, run, ...extra, savedAt: new Date().toISOString() };
  saveProfile(p);
}

export function loadActiveRun() {
  return loadProfile()?.activeRun || null;
}

export function clearActiveRun() {
  const p = loadProfile();
  if (!p) return;
  p.activeRun = null;
  saveProfile(p);
}

export function updateSettings(partial) {
  const p = loadProfile();
  if (!p) return null;
  p.settings = { ...p.settings, ...partial };
  saveProfile(p);
  return p;
}

export function noteConsoleOpen() {
  const p = loadProfile();
  if (!p) return;
  p.counters.consoleOpens = (p.counters.consoleOpens || 0) + 1;
  saveProfile(p);
}

export function noteHint() {
  const p = loadProfile();
  if (!p) return;
  p.counters.hints = (p.counters.hints || 0) + 1;
  saveProfile(p);
}

export function noteShare() {
  const p = loadProfile();
  if (!p) return;
  p.counters.shares = (p.counters.shares || 0) + 1;
  saveProfile(p);
}

export function updateStreak(profile, date = new Date()) {
  const key = todayKey(date);
  const streak = { ...(profile.streak || { count: 0, best: 0, last: null }) };
  if (streak.last === key) return { streak, changed: false };
  const yesterday = new Date(date.getTime() - 86400000);
  if (streak.last === todayKey(yesterday)) streak.count += 1;
  else streak.count = 1;
  streak.best = Math.max(streak.best || 0, streak.count);
  streak.last = key;
  return { streak, changed: true };
}

export function applyReport(profile, report, caseDef, { daily = false } = {}) {
  const beforeXp = profile.xp || 0;
  const beforeLevel = levelForXp(beforeXp);
  const beforePhase = phaseForXp(beforeXp).id;
  const p = {
    ...profile,
    completed: { ...(profile.completed || {}) },
    results: [...(profile.results || [])],
    skills: { ...(profile.skills || {}) },
    badges: [...(profile.badges || [])],
    counters: { ...(profile.counters || {}) },
  };

  const prev = p.completed[caseDef.id];
  p.completed[caseDef.id] = {
    bestGrade: !prev || gradeValue(report.grade) < gradeValue(prev.bestGrade) ? report.grade : prev.bestGrade,
    bestScore: Math.max(prev?.bestScore || 0, report.score),
    attempts: (prev?.attempts || 0) + 1,
    lastPlayed: new Date().toISOString(),
  };
  p.results.push({
    caseId: caseDef.id,
    grade: report.grade,
    score: report.score,
    xp: report.xp,
    skills: caseDef.skills,
    discipline: caseDef.discipline,
    tags: caseDef.tags,
    at: new Date().toISOString(),
    daily,
  });
  if (p.results.length > 60) p.results = p.results.slice(-60);
  p.xp = beforeXp + (report.xp || 0);
  for (const [skill, gain] of Object.entries(report.skillGain || {})) {
    p.skills[skill] = Math.min(100, (p.skills[skill] || 10) + gain);
  }
  if (daily) p.lastDaily = todayKey();
  const { streak } = updateStreak(p);
  p.streak = streak;
  if (report.grade === 'F') {
    // a failed attempt still counts as practice; no extra penalty beyond lower XP
  }
  const newBadges = evaluateBadges(p, report, caseDef);
  p.badges = [...new Set([...p.badges, ...newBadges.map((b) => b.id)])];
  p.activeRun = null;
  saveProfile(p);
  const afterLevel = levelForXp(p.xp);
  const afterPhase = phaseForXp(p.xp);
  const unlocks = [];
  for (const phase of PHASES) {
    for (const u of phase.unlocks) {
      if (u.level > beforeLevel && u.level <= afterLevel) unlocks.push({ level: u.level, label: u.label, phase: phase.name });
    }
  }
  return {
    profile: p,
    levelBefore: beforeLevel,
    levelAfter: afterLevel,
    phaseBefore: beforePhase,
    phaseAfter: afterPhase,
    phaseUp: afterPhase.id > beforePhase,
    levelUp: afterLevel > beforeLevel,
    unlocks,
    newBadges,
    streakUp: streak.count > (profile.streak?.count || 0),
  };
}

function gradeValue(g) {
  return { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 }[g] ?? 6;
}

export function evaluateBadges(profile, report, caseDef) {
  const have = new Set(profile.badges || []);
  const out = [];
  const add = (id) => {
    const b = BADGES.find((x) => x.id === id);
    if (b && !have.has(id)) out.push(b);
  };
  if (report.success) add('first-blood');
  if (report.evidence.found === totalEvidence(caseDef)) add('scholar');
  if ((profile.streak?.count || 0) >= 3) add('streak-3');
  if ((profile.streak?.count || 0) >= 7) add('streak-7');
  if (caseDef.id === 'c17' && report.success) add('mentor');
  if (phaseForXp(profile.xp || 0).id >= 4) add('senior');
  if (report.grade === 'S' && (caseDef.discipline === 'Olay Yönetimi' || (caseDef.tags || []).includes('incident'))) add('zero-downtime');
  const debugWins = (profile.results || []).filter((r) => r.skills?.includes('debug') && ['S', 'A'].includes(r.grade));
  if (debugWins.length >= 3) add('bug-hunter');
  const disciplines = new Set((profile.results || []).filter((r) => r.grade !== 'F').map((r) => r.discipline));
  if (disciplines.size >= 4) add('polyglot');
  return out;
}

export function skillSummary(profile) {
  return SKILLS.map((s) => ({ ...s, value: profile.skills?.[s.id] || 0 }));
}

export function strongestSkill(profile) {
  return skillSummary(profile).sort((a, b) => b.value - a.value)[0];
}

export function weakestSkill(profile) {
  return skillSummary(profile).sort((a, b) => a.value - b.value)[0];
}

export function percent(value, max = 100) {
  return `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
}

export function gradeStats(profile) {
  const results = profile.results || [];
  const sCount = results.filter((r) => r.grade === 'S').length;
  const aCount = results.filter((r) => r.grade === 'A').length;
  const successes = results.filter((r) => r.grade !== 'F').length;
  const accuracy = results.length ? Math.round((successes / results.length) * 100) : 0;
  return { total: results.length, sCount, aCount, successes, accuracy };
}

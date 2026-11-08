import {
  PHASES,
  SKILLS,
  phaseForXp,
  levelForXp,
  todayKey,
  hashString,
  seededRandom,
  UNIVERSAL_ACTION_META,
} from '../shared/meta.mjs';
import { totalEvidence, evidenceLabel, getCase } from '../shared/content.mjs';

export const MAX_LEVEL = 30;

const FLAG_LABELS = {
  repro: 'hatayı yeniden üret',
  paired: 'birlikte inceleme yap',
  comms: 'ekiple iletişim kur',
  rotate: 'anahtarı etkisizleştir',
  audited: 'etkilenenleri denetle',
};

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function initialSkills(trackSkills = []) {
  const skills = {};
  for (const s of SKILLS) skills[s.id] = trackSkills.includes(s.id) ? 16 : 10;
  return skills;
}

export function createProfile({ name, avatar = 'ada', track = 'undecided' } = {}) {
  const trackSkills = track === 'undecided' ? ['debug', 'algo', 'comm'] : track === 'backend' ? ['backend', 'systems', 'testing'] : track === 'frontend' ? ['frontend', 'debug', 'comm'] : track === 'mobile' ? ['frontend', 'systems', 'testing'] : track === 'data' ? ['algo', 'systems', 'testing'] : ['testing', 'backend', 'systems'];
  return {
    version: 1,
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    name: (name || 'Deniz').slice(0, 18),
    avatar,
    track,
    xp: 0,
    joinedAt: new Date().toISOString(),
    streak: { count: 0, best: 0, last: null },
    skills: initialSkills(trackSkills),
    completed: {},
    results: [],
    badges: [],
    activeRun: null,
    lastDaily: null,
    settings: { sound: true, haptics: true, motion: true },
    counters: { hints: 0, shares: 0, consoleOpens: 0 },
  };
}

export function createDemoProfile() {
  const profile = createProfile({ name: 'Deniz', avatar: 'deniz', track: 'backend' });
  const completed = [
    ['c01', 'S', 96],
    ['c02', 'A', 84],
    ['c03', 'A', 81],
    ['c04', 'B', 68],
    ['c05', 'S', 94],
    ['c06', 'A', 83],
    ['c07', 'A', 79],
    ['c08', 'B', 71],
    ['c18', 'A', 86],
    ['c09', 'A', 77],
    ['c10', 'B', 64],
    ['c11', 'A', 80],
  ];
  for (const [id, grade, score] of completed) {
    const c = getCase(id);
    if (!c) continue;
    profile.completed[id] = { bestGrade: grade, bestScore: score, attempts: 1, lastPlayed: new Date(Date.now() - 86400000 * (completed.length - completed.indexOf(completed.find((x) => x[0] === id)))).toISOString() };
    profile.results.push({ caseId: id, grade, score, at: new Date(Date.now() - 86400000 * 2).toISOString(), skills: c.skills });
    profile.xp += 86;
    for (const skill of c.skills) {
      profile.skills[skill] = clamp((profile.skills[skill] || 10) + (grade === 'S' ? 8 : grade === 'A' ? 6 : 4));
    }
  }
  profile.xp = 1080;
  profile.streak = { count: 4, best: 6, last: todayKey(new Date(Date.now() - 86400000)) };
  profile.badges = ['first-blood', 'scholar', 'streak-3'];
  return profile;
}

export function getUniversalActions(caseDef) {
  if (caseDef.universal === false) return [];
  const clueActions = [
    ['logs', 'terminal'],
    ['metrics', 'chart'],
    ['code', 'code'],
    ['git', 'git'],
    ['teammate', 'users'],
    ['docs', 'book'],
  ].map(([key, icon]) => ({
    id: `u-${key}`,
    label: UNIVERSAL_ACTION_META[key].label,
    cat: UNIVERSAL_ACTION_META[key].cat,
    icon,
    cost: 1,
    universal: true,
    clueKey: key,
    reveal: [key],
    fx: key === 'teammate' ? { team: 2 } : {},
  }));
  return [
    ...clueActions,
    {
      id: 'u-coffee',
      label: 'Kahve molası ver',
      cat: 'flavor',
      icon: 'coffee',
      cost: 1,
      universal: true,
      log: 'Kısa bir mola. Zihnin biraz açıldı, saat biraz ilerledi. Kahve öğrenme değil; dinlenme.',
      fx: { team: 4, perf: -1 },
    },
    {
      id: 'u-status',
      label: 'Durum sayfasını güncelle',
      cat: 'comm',
      icon: 'megaphone',
      cost: 1,
      universal: true,
      comm: true,
      flag: 'status',
      log: 'Kullanıcılar ne olduğunu ve ne zaman düzeleceğini biliyor. Destek ekibi aynı dili konuşuyor.',
      fx: { trust: 6, team: 2 },
    },
    {
      id: 'u-rollback',
      label: 'Son deploy’u geri al',
      cat: 'risky',
      icon: 'undo',
      cost: 1,
      universal: true,
      flag: 'rolledback',
      rollback: true,
    },
  ];
}

export function actionsFor(caseDef) {
  return [...(caseDef.actions || []), ...getUniversalActions(caseDef)];
}

export function actionAvailability(caseDef, run, action) {
  if (!run || run.status !== 'active') return { ok: false, reason: 'Vardiya kapandı' };
  if (run.used?.includes(action.id)) return { ok: false, reason: 'Bu adım kullanıldı' };
  const missing = (action.needs || []).filter((key) => !(run.evidence || []).includes(key));
  if (missing.length) {
    return { ok: false, reason: `Kanıt gerekli: ${missing.map((k) => evidenceLabel(caseDef, k)).join(', ')}` };
  }
  const missingFlags = (action.needsFlags || []).filter((flag) => !(run.flags || []).includes(flag));
  if (missingFlags.length) {
    return { ok: false, reason: `Önce: ${missingFlags.map((f) => FLAG_LABELS[f] || f).join(', ')}` };
  }
  if (action.universal && action.reveal?.length && action.reveal.every((k) => (run.evidence || []).includes(k))) {
    return { ok: false, reason: 'Bu kanıt zaten masada' };
  }
  return { ok: true };
}

export function createRun(caseDef, { level = 1, assist = null } = {}) {
  const aid = assist?.turns || 0;
  return {
    caseId: caseDef.id,
    status: 'active',
    vitals: { ...caseDef.vitals },
    turns: Math.max(6, caseDef.turns + aid),
    turnsLeft: Math.max(6, caseDef.turns + aid),
    evidence: [],
    flags: [],
    used: [],
    history: [],
    harmful: [],
    wasted: [],
    hypothesis: null,
    hypothesisAt: 0,
    hints: 0,
    assist,
    level,
    startedAt: Date.now(),
    finishedAt: null,
    wonAt: null,
  };
}

function cloneRun(run) {
  return {
    ...run,
    vitals: { ...run.vitals },
    evidence: [...run.evidence],
    flags: [...run.flags],
    used: [...run.used],
    history: [...run.history],
    harmful: [...run.harmful],
    wasted: [...run.wasted],
  };
}

function fxText(fx = {}) {
  const bits = [];
  for (const [key, value] of Object.entries(fx)) {
    if (!value) continue;
    const names = { build: 'BUILD', perf: 'PERF', trust: 'TRUST', team: 'TEAM' };
    bits.push(`${names[key] || key.toUpperCase()} ${value > 0 ? '+' : ''}${value}`);
  }
  return bits.join(' • ');
}

export function applyAction(caseDef, run, actionId, at = Date.now()) {
  const action = actionsFor(caseDef).find((a) => a.id === actionId);
  if (!action) return { run, error: 'Eylem bulunamadı.' };
  const availability = actionAvailability(caseDef, run, action);
  if (!availability.ok) return { run, error: availability.reason };

  const next = cloneRun(run);
  const fx = { ...(action.fx || {}) };
  let log = action.log || '';
  let wasted = Boolean(action.wasted);
  let harmful = Boolean(action.bad);

  if (action.universal && action.clueKey) {
    const clue = caseDef.clues?.[action.clueKey];
    if (clue) {
      log = clue;
      addEvidence(next, caseDef, [action.clueKey]);
    } else {
      log = 'Burada işine yarayacak bir iz yok. Zaman ilerledi.';
      wasted = true;
    }
  } else if (action.reveal?.length) {
    const before = next.evidence.length;
    addEvidence(next, caseDef, action.reveal);
    if (next.evidence.length === before) {
      log = log || 'Bu kanıt zaten masada.';
      wasted = true;
    }
  }

  if (action.rollback) {
    if (caseDef.rollbackSafe) {
      Object.assign(fx, { build: 10, perf: 5, trust: 4 });
      log = 'Son deploy geri alındı. Durum stabilize oldu; kök neden hâlâ yerinde.';
    } else {
      Object.assign(fx, { build: -15, perf: -8, trust: -6 });
      harmful = true;
      log = 'Geri alma güvenli değildi: veri şeması ve açık işlemler bozuldu. Daha büyük bir olay doğdu.';
    }
  }
  if (action.id === 'u-coffee') {
    log = 'Kısa bir mola. Zihnin biraz açıldı, saat biraz ilerledi. Kahve öğrenme değil; dinlenme.';
  }

  for (const [key, value] of Object.entries(fx)) {
    if (key in next.vitals) next.vitals[key] = clamp(next.vitals[key] + value);
  }
  if (action.flag) next.flags.push(action.flag);
  if (action.comm && !next.flags.includes('comms')) next.flags.push('comms');
  if (action.reveal) {
    // c15 and other custom investigation actions use reveal, too.
    addEvidence(next, caseDef, action.reveal);
  }
  next.used.push(action.id);
  next.turnsLeft = Math.max(0, next.turnsLeft - (action.cost || 1));
  if (harmful) next.harmful.push(action.id);
  if (wasted) next.wasted.push(action.id);
  next.history.push({
    actionId: action.id,
    label: action.label,
    cat: action.cat,
    log,
    fx,
    fxText: fxText(fx),
    at,
  });

  const chain = caseDef.fixChain || [];
  if (chain.length && chain.every((id) => next.used.includes(id))) {
    next.status = 'won';
    next.wonAt = at;
  } else if (next.vitals.build <= 0 || next.vitals.perf <= 0 || next.vitals.trust <= 0) {
    next.status = 'lost';
    next.lostReason = next.vitals.build <= 0 ? 'outage' : next.vitals.trust <= 0 ? 'trust' : 'unusable';
  } else if (next.turnsLeft <= 0) {
    next.status = 'lost';
    next.lostReason = 'timeout';
  }
  next.finishedAt = next.status === 'active' ? null : at;
  return { run: next, action, error: null };
}

function addEvidence(run, caseDef, keys = []) {
  for (const key of keys) {
    if (!caseDef.clues?.[key]) continue;
    if (!run.evidence.includes(key)) run.evidence.push(key);
  }
}

export function setHypothesis(caseDef, run, hypothesisId) {
  if (run.status !== 'active') return run;
  const h = (caseDef.hypotheses || []).find((x) => x.id === hypothesisId);
  if (!h) return run;
  if (run.hypothesis && run.evidence.length <= run.hypothesisAt) {
    return run;
  }
  return { ...run, hypothesis: hypothesisId, hypothesisAt: run.evidence.length };
}

export function hypothesisState(caseDef, run) {
  const h = (caseDef.hypotheses || []).find((x) => x.id === run.hypothesis);
  return {
    selected: h || null,
    correct: Boolean(h?.correct),
    canChoose: !run.hypothesis || run.evidence.length > run.hypothesisAt,
    canRevise: Boolean(run.hypothesis) && run.evidence.length > run.hypothesisAt,
    unlocked: run.level >= 3,
    optionCount: (caseDef.hypotheses || []).length,
  };
}

export function useHint(caseDef, run) {
  if (run.hints >= 2) return { run, text: 'Bu vardiyada iki ipucu hakkını da kullandın. Kanıtlar seni bekliyor.' };
  const next = { ...run, hints: run.hints + 1 };
  const missing = Object.keys(caseDef.clues || {}).filter((k) => caseDef.clues[k] && !run.evidence.includes(k));
  let text;
  if (!missing.length) {
    text = 'Tüm kanıtlar masada. Hipotezini seç ve düzeltme adımlarını uygula.';
  } else {
    const key = missing[0];
    text = `Henüz ${evidenceLabel(caseDef, key)} kanıtına bakmadın. Orada kök nedene dair bir iz var.`;
    const fixNeeds = (caseDef.actions || []).flatMap((a) => a.needs || []);
    if (fixNeeds.includes(key)) text += ' Düzeltme adımı da bu kanıtı bekliyor.';
  }
  return { run: next, text };
}

export function scoreRun(caseDef, run) {
  const evTotal = totalEvidence(caseDef) || 1;
  const evFound = run.evidence.length;
  const hypothesis = (caseDef.hypotheses || []).find((h) => h.id === run.hypothesis);
  const diagnosis = hypothesis?.correct ? 30 : Math.round((evFound / evTotal) * 20);
  const success = run.status === 'won';
  const solution = success ? 35 : 0;
  const vitalsAvg = (run.vitals.build + run.vitals.perf + run.vitals.trust + run.vitals.team) / 4;
  const vitals = Math.round((vitalsAvg / 100) * 20);
  const efficiency = Math.round((run.turnsLeft / Math.max(1, run.turns)) * 10);
  const comms = run.flags.includes('status') || run.flags.includes('comms') ? 5 : 0;
  const penalty = run.harmful.length * 7 + run.wasted.length * 5 + run.hints * 3;
  const raw = diagnosis + solution + vitals + efficiency + comms - penalty;
  const score = clamp(Math.round(raw), 0, 100);
  let grade;
  if (!success) grade = 'F';
  else if (score >= 90) grade = 'S';
  else if (score >= 75) grade = 'A';
  else if (score >= 60) grade = 'B';
  else if (score >= 45) grade = 'C';
  else grade = 'D';
  return {
    score,
    grade,
    success,
    breakdown: { diagnosis, solution, vitals, efficiency, comms, penalty },
    evidence: { found: evFound, total: evTotal },
    hypothesis: hypothesis ? { text: hypothesis.text, correct: Boolean(hypothesis.correct) } : null,
    harmful: [...run.harmful],
    wasted: [...run.wasted],
    turnsLeft: run.turnsLeft,
    turns: run.turns,
  };
}

export function buildReport(caseDef, run, options = {}) {
  const score = scoreRun(caseDef, run);
  const diffFactor = 0.9 + (caseDef.difficulty || 1) * 0.08;
  let xp = score.success ? Math.round((20 + score.score * 0.9) * diffFactor) : 10;
  if (options.daily) xp = Math.round(xp * 1.25);
  if (options.replay) xp = Math.round(xp * 0.3);
  const skillGain = {};
  for (const skill of caseDef.skills || []) {
    skillGain[skill] = score.success ? Math.max(1, Math.round(2 + score.score / 20)) : 0;
  }
  if ((run.flags.includes('comms') || run.flags.includes('status')) && skillGain.comm !== undefined) {
    skillGain.comm += 1;
  }
  if (!skillGain.comm && run.flags.includes('comms')) skillGain.comm = 1;
  return {
    ...score,
    caseId: caseDef.id,
    caseCode: caseDef.code,
    caseTitle: caseDef.title,
    difficulty: caseDef.difficulty,
    skills: caseDef.skills,
    skillGain,
    xp,
    daily: Boolean(options.daily),
    replay: Boolean(options.replay),
    levelBefore: options.levelBefore || run.level || 1,
    durationMs: Math.max(0, (run.finishedAt || Date.now()) - run.startedAt),
    actions: run.used.length,
    rootCause: caseDef.debrief.rootCause,
    summary: caseDef.debrief.summary,
    takeaways: caseDef.debrief.takeaways,
    realWorld: caseDef.debrief.realWorld,
    docs: caseDef.debrief.docs,
    mentor: caseDef.debrief.mentor,
    nextCaseId: options.nextCaseId || null,
    at: new Date().toISOString(),
  };
}

export function assistFor(profile) {
  const recent = (profile.results || []).slice(-3);
  const struggling = recent.length >= 2 && recent.filter((r) => ['C', 'D', 'F'].includes(r.grade)).length >= 2;
  const thriving = recent.length >= 3 && recent.every((r) => ['S', 'A'].includes(r.grade));
  if (struggling) return { turns: 2, label: 'Destek modu: +2 adım', tone: 'support' };
  if (thriving) return { turns: -1, label: 'Meydan okuma: -1 adım', tone: 'challenge' };
  return { turns: 0, label: null, tone: 'normal' };
}

export function isUnlocked(caseDef, profile) {
  return (caseDef.phase || 1) <= phaseForXp(profile.xp || 0).id;
}

export function unlockedCases(cases, profile) {
  return cases.filter((c) => isUnlocked(c, profile));
}

export function recommendation(cases, profile) {
  const pool = unlockedCases(cases, profile);
  if (!pool.length) return { case: cases[0], reason: 'İlk vaka seni bekliyor.' };
  const recentIds = new Set((profile.results || []).slice(-3).map((r) => r.caseId));
  const lastId = profile.results?.[profile.results.length - 1]?.caseId;
  const rnd = seededRandom(hashString(`${profile.id}:${todayKey()}:${profile.xp}`));
  const skills = profile.skills || {};
  let best = null;
  for (const c of pool) {
    const deficit = c.skills.reduce((sum, s) => sum + (100 - (skills[s] || 10)), 0) / c.skills.length;
    const freshness = profile.completed?.[c.id] ? -45 : 25;
    const repeat = recentIds.has(c.id) ? -60 : 0;
    const last = lastId === c.id ? -80 : 0;
    const phaseFit = c.phase === phaseForXp(profile.xp || 0).id ? 18 : 0;
    const jitter = rnd() * 8;
    const value = deficit + freshness + repeat + last + phaseFit + jitter;
    if (!best || value > best.value) best = { case: c, value, deficit };
  }
  const weakest = best.case.skills
    .map((id) => ({ id, value: skills[id] || 10 }))
    .sort((a, b) => a.value - b.value)[0];
  const skillName = SKILLS.find((s) => s.id === weakest?.id)?.name || 'temel';
  return {
    case: best.case,
    reason: profile.completed?.[best.case.id]
      ? `${skillName} becerini tazelemek için iyi bir tekrar.`
      : `${skillName} açığını kapatmak için seçildi. Henüz oynamadın.`,
  };
}

export function pickDaily(cases, profile, featuredId = null) {
  if (featuredId) {
    const featured = cases.find((c) => c.id === featuredId);
    if (featured && isUnlocked(featured, profile)) {
      return { case: featured, reason: 'Bu sezonun öne çıkan vakası.', featured: true };
    }
  }
  const pool = unlockedCases(cases, profile);
  if (!pool.length) return { case: cases[0], reason: 'İlk vaka.' };
  const seed = hashString(`${todayKey()}:daily:${profile.id}`);
  const rnd = seededRandom(seed);
  const unplayed = pool.filter((c) => !profile.completed?.[c.id]);
  const list = unplayed.length ? unplayed : pool;
  const chosen = list[Math.floor(rnd() * list.length)];
  return { case: chosen, reason: 'Bugünün tohumuyla seçildi; yarın başka bir vaka.', featured: false };
}

export function phaseProgress(profile) {
  const phase = phaseForXp(profile.xp || 0);
  const next = PHASES.find((p) => p.minXp > (profile.xp || 0)) || null;
  const base = phase.minXp;
  const span = next ? next.minXp - base : 1;
  const value = next ? clamp(Math.round((((profile.xp || 0) - base) / span) * 100), 0, 100) : 100;
  return { phase, next, value };
}

export function levelProgress(profile) {
  const level = levelForXp(profile.xp || 0);
  const base = (level - 1) * 100;
  const value = level >= MAX_LEVEL ? 100 : clamp(Math.round((((profile.xp || 0) - base) / 100) * 100), 0, 100);
  return { level, value, nextAt: Math.min(MAX_LEVEL, level + 1) * 100 };
}

export function skillDeltaLabel(gain = {}) {
  return Object.entries(gain)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => `${SKILLS.find((s) => s.id === id)?.short || id} +${v}`)
    .join(' • ');
}

export { clamp, fxText };

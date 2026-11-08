import { PHASE1_CASES } from './cases/phase1.mjs';
import { PHASE2_CASES } from './cases/phase2.mjs';
import { PHASE3_CASES } from './cases/phase3.mjs';
import { PHASE4_CASES } from './cases/phase4.mjs';
import { META, PHASES, SKILLS, EVIDENCE_LABELS } from './meta.mjs';

export const CASES = [...PHASE1_CASES, ...PHASE2_CASES, ...PHASE3_CASES, ...PHASE4_CASES];
export const CASE_MAP = Object.fromEntries(CASES.map((c) => [c.id, c]));

export function getCase(id) {
  return CASE_MAP[id] || null;
}

export function casesForPhase(phase) {
  return CASES.filter((c) => c.phase === Number(phase));
}

export function caseSummary(c) {
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
    actionCount: (c.actions?.length || 0) + (c.universal === false ? 0 : 9),
  };
}

export const CASE_SUMMARIES = CASES.map(caseSummary);

export function evidenceLabel(caseDef, key) {
  return caseDef?.evidenceLabels?.[key] || EVIDENCE_LABELS[key] || key;
}

export function totalEvidence(caseDef) {
  if (!caseDef?.clues) return 0;
  return Object.values(caseDef.clues).filter(Boolean).length;
}

export function template(str, vars = {}) {
  return String(str ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? '').toString());
}

// Default home layout. Everything here is serialisable and rendered by block
// type on the client — which is what makes the Control Room capable of
// changing the experience without shipping a new build.
export function defaultHomeBlocks() {
  return [
    {
      type: 'ticker',
      label: 'CANLI',
      items: [
        'SEZON 01 • SIFIRINCI GÜN',
        '{{caseCount}} VAKA • 4 YIL',
        'HER VAKA YENİ BİR SINIR DURUMU',
        'SUNUCU GÜDÜMLÜ ARAYÜZ v3',
        'PRIMER.EXE // 1995 → 2026',
      ],
    },
    {
      type: 'hero',
      eyebrow: 'YIL {{phaseNo}} • {{rank}}',
      title: 'Merhaba {{name}}. Bugün hangi hatayı anlamlandıracağız?',
      body: 'Kod yazmak kolay. Doğru kodu, doğru kanıtla, doğru ekiple yazmak zor. Vardiyan seni bekliyor.',
      cta: { label: 'Günün vardiyası', action: 'daily' },
      art: 'desk',
    },
    { type: 'daily', title: 'GÜNÜN VAKASI' },
    { type: 'xp', title: 'KIDEM İLERLEMESİ' },
    { type: 'next', title: 'SİSTEMİN ÖNERİSİ' },
    { type: 'radar', title: 'YETENEK RADARI' },
    { type: 'quick', title: 'HIZLI ERİŞİM' },
    { type: 'leaderboard', title: 'HAFTANIN EKİBİ', minLevel: 3 },
    {
      type: 'module',
      title: 'NÖBET PANOSU',
      icon: 'pager',
      body: 'Bu modül 5. seviyede açılır. O zamana kadar vardiyalarda sistem sağlığını koru.',
      minLevel: 5,
    },
    {
      type: 'note',
      text: 'Bu ekran sunucudan gelen bir şema ile çizilir. Kontrol Odası’ndan düzeni değiştir; yeniden yükleme yok.',
    },
  ];
}

export function defaultRuntime() {
  return {
    revision: 1,
    season: {
      id: 's1',
      name: 'Sıfırıncı Gün',
      tag: 'SEZON 01',
      accent: '#5ef2c0',
      accent2: '#59d7ff',
    },
    theme: {
      accent: '#5ef2c0',
      accent2: '#59d7ff',
      bg: '#080d16',
    },
    announcement: null,
    featuredCase: null,
    homeBlocks: defaultHomeBlocks(),
    extraCases: [],
  };
}

export function buildBootstrap(runtime = defaultRuntime()) {
  const rt = { ...defaultRuntime(), ...runtime };
  const extra = Array.isArray(rt.extraCases) ? rt.extraCases : [];
  const allSummaries = [...CASE_SUMMARIES, ...extra.map(caseSummary)];
  return {
    schema: META.schema,
    revision: rt.revision,
    generatedAt: new Date().toISOString(),
    season: rt.season,
    theme: rt.theme,
    announcement: rt.announcement,
    featuredCase: rt.featuredCase,
    homeBlocks: rt.homeBlocks,
    cases: allSummaries,
    meta: {
      appName: META.appName,
      subtitle: META.subtitle,
      version: META.version,
      phases: PHASES,
      skills: SKILLS,
      caseCount: allSummaries.length,
    },
  };
}

export { META, PHASES, SKILLS, EVIDENCE_LABELS };

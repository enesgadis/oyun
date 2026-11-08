// Content quality evaluation. It is deliberately harsher than the schema:
// a case can be valid JSON and still be a bad learning object. Run with
// `npm run eval`; the exit code is non-zero when a critical bar is missed.
import { mkdir, writeFile } from 'node:fs/promises';
import { CASES, CASE_SUMMARIES, totalEvidence } from '../shared/content.mjs';
import { PHASES, SKILLS } from '../shared/meta.mjs';
import { validateCaseCollection } from '../shared/schema.mjs';
import { actionsFor } from '../js/engine.mjs';

const checks = [];
const critical = [];
const add = (name, pass, detail, fatal = false) => {
  checks.push({ name, pass, detail });
  if (!pass && fatal) critical.push(name);
};

add('Şema doğrulaması', validateCaseCollection(CASES).length === 0, `${validateCaseCollection(CASES).length} hata`, true);
add('Vaka hacmi', CASES.length >= 12, `${CASES.length} vaka`, true);
add('Dört yıl dolu', PHASES.every((p) => CASES.some((c) => c.phase === p.id)), PHASES.map((p) => `Y${p.id}:${CASES.filter((c) => c.phase === p.id).length}`).join(' '), true);

const actionTotal = CASE_SUMMARIES.reduce((sum, c) => sum + c.actionCount, 0);
add('Eylem derinliği', actionTotal >= 250, `${actionTotal} olası eylem`, false);
add('Benzersiz vaka kodu', new Set(CASES.map((c) => c.code)).size === CASES.length, 'kodlar tekil', false);
add('Zorluk dağılımı', new Set(CASES.map((c) => c.difficulty)).size >= 4, `1-5 arası ${[...new Set(CASES.map((c) => c.difficulty))].join(',')}`, false);

const skillCoverage = Object.fromEntries(SKILLS.map((s) => [s.id, CASES.filter((c) => c.skills.includes(s.id)).length]));
add('Beceri kapsamı', Object.values(skillCoverage).every((n) => n >= 2), JSON.stringify(skillCoverage), false);

let missingPlan = 0;
let shallowDebrief = 0;
let noMistake = 0;
let noComms = 0;
let noFix = 0;
let hostile = 0;

for (const c of CASES) {
  if (!c.brief || !c.objective || !c.role) missingPlan += 1;
  if (!c.debrief?.rootCause || !c.debrief?.summary || (c.debrief?.takeaways?.length || 0) < 3) shallowDebrief += 1;
  if (!(c.actions || []).some((a) => a.bad || a.wasted)) noMistake += 1;
  const all = actionsFor(c);
  if (!all.some((a) => a.comm)) noComms += 1;
  if (!all.some((a) => a.cat === 'fix')) noFix += 1;
  if ((c.vitals?.trust || 100) < 20 || (c.vitals?.build || 100) < 20) hostile += 1;
  if (!c.debrief?.realWorld || !c.debrief?.docs?.length || !c.debrief?.mentor) missingPlan += 1;
}

add('Vaka planı (brief + hedef + saha notu)', missingPlan === 0, `${missingPlan} eksik`, false);
add('Debrief derinliği (kök neden + 3 çıkarım)', shallowDebrief === 0, `${shallowDebrief} zayıf`, false);
add('Yanlış karar bedeli', noMistake === 0, `${noMistake} vakada bedelli yanlış yok`, false);
add('İletişim eylemi', noComms === 0, `${noComms} vakada iletişim yok`, false);
add('Onarım eylemi', noFix === 0, `${noFix} vakada fix yok`, false);
add('Başlangıç gerilimi', hostile === 0, `${hostile} vakada vital çok düşük`, false);

const evidenceDepths = CASES.map((c) => totalEvidence(c));
add('Kanıt derinliği', evidenceDepths.every((n) => n >= 5), `min ${Math.min(...evidenceDepths)} / max ${Math.max(...evidenceDepths)}`, false);

const decisionWords = CASES.filter((c) => /ama|ancak|yerine|bedel|ödün|risk|trade|geri al|kapsam|öncelik/i.test(`${c.debrief?.summary || ''} ${c.debrief?.takeaways?.join(' ') || ''}`));
add('Ödünleşim dili', decisionWords.length >= Math.ceil(CASES.length * 0.8), `${decisionWords.length}/${CASES.length} vaka`, false);

const phases = PHASES.map((p) => {
  const list = CASES.filter((c) => c.phase === p.id);
  return {
    phase: p.code,
    name: p.name,
    cases: list.length,
    actions: list.reduce((n, c) => n + c.actions.length, 0),
    avgDifficulty: Number((list.reduce((n, c) => n + c.difficulty, 0) / Math.max(1, list.length)).toFixed(2)),
    evidence: list.reduce((n, c) => n + totalEvidence(c), 0),
  };
});

const passed = checks.filter((c) => c.pass).length;
const score = Math.round((passed / checks.length) * 100);
const result = {
  app: 'PRIMER.EXE',
  generatedAt: new Date().toISOString(),
  score,
  cases: CASES.length,
  actions: actionTotal,
  evidence: evidenceDepths.reduce((a, b) => a + b, 0),
  phases,
  skillCoverage,
  checks,
  critical,
};

const line = (ok, name, detail) => `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(36, ' ')} ${detail}`;
console.log('');
console.log('PRIMER.EXE // İÇERİK DEĞERLENDİRMESİ');
console.log('='.repeat(74));
for (const check of checks) console.log(line(check.pass, check.name, check.detail));
console.log('-'.repeat(74));
for (const p of phases) {
  console.log(`${p.phase} ${p.name.padEnd(16, ' ')} ${String(p.cases).padStart(2, ' ')} vaka | ${String(p.actions).padStart(2, ' ')} özel eylem | ort. zorluk ${p.avgDifficulty}`);
}
console.log('-'.repeat(74));
console.log(`SONUÇ: ${score}/100 • ${CASES.length} vaka • ${actionTotal} olası eylem • ${evidenceDepths.reduce((a, b) => a + b, 0)} kanıt`);
if (critical.length) console.log(`KRİTİK: ${critical.join(', ')}`);
console.log('');

await mkdir('docs', { recursive: true });
await writeFile('docs/eval.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (critical.length) process.exitCode = 1;

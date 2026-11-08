import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, getCase, CASE_SUMMARIES, totalEvidence } from '../shared/content.mjs';
import { BADGES, levelForXp, phaseForXp, todayKey } from '../shared/meta.mjs';
import {
  actionAvailability,
  actionsFor,
  applyAction,
  assistFor,
  buildReport,
  createDemoProfile,
  createProfile,
  createRun,
  hypothesisState,
  pickDaily,
  recommendation,
  scoreRun,
  setHypothesis,
  useHint,
} from '../js/engine.mjs';
import { applyReport, evaluateBadges, updateStreak } from '../js/store.mjs';

const winningC01 = (profile = createProfile({ name: 'Test' })) => {
  const c = getCase('c01');
  let run = createRun(c, { level: levelForXp(profile.xp) });
  run = applyAction(c, run, 'u-code').run;
  run = applyAction(c, run, 'a-repro').run;
  run = setHypothesis(c, run, 'h2');
  run = applyAction(c, run, 'a-fix').run;
  run = applyAction(c, run, 'a-regression').run;
  return { c, run, profile };
};

test('18 base cases are valid and stay playable', () => {
  assert.equal(CASES.length, 18);
  assert.equal(CASE_SUMMARIES.length, 18);
  for (const c of CASES) {
    const actionIds = new Set(actionsFor(c).map((a) => a.id));
    for (const id of c.fixChain) assert.ok(actionIds.has(id), `${c.id} fixChain ${id}`);
    assert.equal(c.hypotheses.filter((h) => h.correct).length, 1, `${c.id} one correct hypothesis`);
    assert.ok(totalEvidence(c) >= 5, `${c.id} evidence depth`);
  }
});

test('c15 keeps its custom, non-universal evidence deck', () => {
  const c = getCase('c15');
  assert.equal(c.universal, false);
  assert.equal(actionsFor(c).length, c.actions.length);
  for (const key of Object.keys(c.clues)) {
    assert.ok(c.actions.some((a) => a.reveal?.includes(key)), `${key} must be revealable`);
  }
});

test('fixes cannot be applied before the evidence they require', () => {
  const c = getCase('c01');
  const run = createRun(c, { level: 5 });
  const fix = c.actions.find((a) => a.id === 'a-fix');
  const availability = actionAvailability(c, run, fix);
  assert.equal(availability.ok, false);
  assert.match(availability.reason, /Kanıt gerekli/);

  const withCode = applyAction(c, run, 'u-code').run;
  assert.equal(actionAvailability(c, withCode, fix).ok, true);
});

test('universal evidence actions reveal clues and refuse duplicates', () => {
  const c = getCase('c01');
  let run = createRun(c, { level: 5 });
  run = applyAction(c, run, 'u-logs').run;
  assert.ok(run.evidence.includes('logs'));
  assert.match(run.history.at(-1).log, /TIMEOUT/);

  const again = actionAvailability(c, run, actionsFor(c).find((a) => a.id === 'u-logs'));
  assert.equal(again.ok, false);
  assert.match(again.reason, /kullanıldı|zaten masada/);

  const { error } = applyAction(c, run, 'u-logs');
  assert.match(error, /kullanıldı|zaten masada/);
});

test('complete c01 run wins, grades S and reports every score component', () => {
  const { c, run } = winningC01();
  assert.equal(run.status, 'won');
  assert.equal(run.turnsLeft, 6);
  const score = scoreRun(c, run);
  assert.equal(score.success, true);
  assert.equal(score.grade, 'S');
  assert.equal(score.breakdown.diagnosis, 30);
  assert.equal(score.breakdown.solution, 35);
  assert.ok(score.breakdown.comms >= 5);

  const report = buildReport(c, run, { daily: true });
  assert.ok(report.xp > 0);
  assert.ok(report.xp === Math.round((20 + report.score * 0.9) * (0.9 + c.difficulty * 0.08) * 1.25));
  assert.ok(report.skillGain.debug >= 1);
  assert.equal(report.nextCaseId, null);
});

test('a replay earns only 30% of normal XP', () => {
  const { c, run } = winningC01();
  const normal = buildReport(c, run);
  const replay = buildReport(c, run, { replay: true });
  assert.equal(replay.xp, Math.round(normal.xp * 0.3));
  assert.equal(replay.replay, true);
});

test('wrong hypothesis lowers diagnosis but still allows a win', () => {
  const c = getCase('c01');
  let run = createRun(c, { level: 5 });
  run = applyAction(c, run, 'u-code').run;
  run = applyAction(c, run, 'a-repro').run;
  run = setHypothesis(c, run, 'h1');
  run = applyAction(c, run, 'a-fix').run;
  run = applyAction(c, run, 'a-regression').run;
  assert.equal(run.status, 'won');
  const score = scoreRun(c, run);
  assert.equal(score.hypothesis.correct, false);
  assert.ok(score.breakdown.diagnosis < 30);
  assert.equal(score.grade, 'B');
});

test('hypothesis can only be revised after new evidence', () => {
  const c = getCase('c01');
  let run = createRun(c, { level: 5 });
  run = applyAction(c, run, 'u-code').run;
  run = applyAction(c, run, 'a-repro').run;
  run = setHypothesis(c, run, 'h1');
  assert.equal(hypothesisState(c, run).canRevise, false);
  const same = setHypothesis(c, run, 'h2');
  assert.equal(same.hypothesis, 'h1');
  run = applyAction(c, run, 'u-metrics').run;
  assert.equal(hypothesisState(c, run).canRevise, true);
  const revised = setHypothesis(c, run, 'h2');
  assert.equal(revised.hypothesis, 'h2');
});

test('single-use risky actions cannot be spammed', () => {
  const c = getCase('c01');
  let run = createRun(c, { level: 5 });
  run = applyAction(c, run, 'a-hotfix').run;
  run = applyAction(c, run, 'a-hotfix').run;
  run = applyAction(c, run, 'a-hotfix').run;
  // The action is single-use; duplicate calls must not slip through.
  assert.equal(run.used.filter((id) => id === 'a-hotfix').length, 1);
  assert.equal(run.status, 'active');
  run = applyAction(c, run, 'u-rollback').run;
  assert.equal(run.status, 'active');
  assert.ok(run.flags.includes('rolledback'));
});

test('running out of turns closes the shift as a timeout', () => {
  const c = getCase('c01');
  const run = createRun(c, { level: 5 });
  const rushed = { ...run, turnsLeft: 1 };
  const result = applyAction(c, rushed, 'u-code');
  assert.equal(result.run.status, 'lost');
  assert.equal(result.run.lostReason, 'timeout');
  assert.equal(scoreRun(c, result.run).grade, 'F');
});

test('hints max out at two and name an unseen evidence source', () => {
  const c = getCase('c01');
  let run = createRun(c, { level: 5 });
  const first = useHint(c, run);
  run = first.run;
  assert.match(first.text, /kanıtına bakmadın/);
  run = useHint(c, run).run;
  const third = useHint(c, run);
  assert.equal(third.run.hints, 2);
  assert.match(third.text, /iki ipucu/);
});

test('adaptive assist reacts to grades, not vibes', () => {
  const struggling = { results: [{ grade: 'F' }, { grade: 'D' }, { grade: 'S' }] };
  const thriving = { results: [{ grade: 'S' }, { grade: 'A' }, { grade: 'S' }] };
  assert.equal(assistFor(struggling).turns, 2);
  assert.equal(assistFor(thriving).turns, -1);
  assert.equal(assistFor({ results: [{ grade: 'B' }] }).turns, 0);
});

test('recommendation only returns unlocked cases and explains the skill gap', () => {
  const p = createProfile({ name: 'Aday' });
  p.xp = 0;
  const pick = recommendation(CASE_SUMMARIES, p);
  assert.equal(pick.case.phase, 1);
  assert.match(pick.reason, /becer|açık|açığ|İlk/);
});

test('daily selection is deterministic for the same learner and date', () => {
  const p = createDemoProfile();
  const a = pickDaily(CASE_SUMMARIES, p);
  const b = pickDaily(CASE_SUMMARIES, p);
  assert.equal(a.case.id, b.case.id);
  const featured = pickDaily(CASE_SUMMARIES, { ...p, completed: {} }, 'c12');
  assert.equal(featured.featured, true);
  assert.equal(featured.case.id, 'c12');
});

test('demo profile is a believable Year-3 career snapshot', () => {
  const p = createDemoProfile();
  assert.equal(levelForXp(p.xp), 11);
  assert.equal(phaseForXp(p.xp).id, 3);
  assert.equal(Object.keys(p.completed).length, 12);
  assert.ok(p.badges.includes('first-blood'));
  assert.equal(p.streak.count, 4);
});

test('applyReport persists XP, skills, badges, streak and clears the run', () => {
  const { c, run, profile } = winningC01();
  const report = buildReport(c, run, { daily: true });
  report.actionLog = [];
  report.evidence.found = 6;
  const application = applyReport(profile, report, c, { daily: true });
  const p = application.profile;
  assert.equal(p.xp, report.xp);
  assert.ok(p.skills.debug > 10);
  assert.ok(p.badges.includes('first-blood'));
  assert.ok(p.badges.includes('scholar'));
  assert.equal(p.activeRun, null);
  assert.equal(p.lastDaily, todayKey());
  assert.ok(p.streak.count >= 1);
  assert.equal(application.levelAfter >= application.levelBefore, true);
});

test('badge evaluation adds badge objects once, never duplicates ids', () => {
  const c = getCase('c01');
  const profile = createProfile({ name: 'Test' });
  profile.completed = {};
  profile.streak = { count: 3, best: 3, last: todayKey() };
  profile.results = [1, 2, 3].map(() => ({ caseId: 'c01', grade: 'A', skills: c.skills }));
  const report = { success: true, evidence: { found: 6, total: 6 }, grade: 'A' };
  const found = evaluateBadges(profile, report, c);
  const ids = found.map((b) => b.id);
  assert.ok(ids.includes('first-blood'));
  assert.ok(ids.includes('scholar'));
  assert.ok(ids.includes('streak-3'));
  assert.ok(ids.includes('bug-hunter'));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(BADGES.some((b) => b.id === id));
});

test('streak advances once per day and resets after a gap', () => {
  const day1 = new Date('2026-01-01T12:00:00');
  const day2 = new Date('2026-01-02T12:00:00');
  const day4 = new Date('2026-01-04T12:00:00');
  let p = { streak: { count: 0, best: 0, last: null } };
  let first = updateStreak(p, day1);
  assert.equal(first.streak.count, 1);
  p = { streak: first.streak };
  const same = updateStreak(p, day1);
  assert.equal(same.changed, false);
  p = { streak: same.streak };
  const second = updateStreak(p, day2);
  assert.equal(second.streak.count, 2);
  const gap = updateStreak({ streak: second.streak }, day4);
  assert.equal(gap.streak.count, 1);
});

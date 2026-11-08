import { getCase, CASE_SUMMARIES } from '../shared/content.mjs';
import { createDemoProfile, createRun, applyAction, setHypothesis, buildReport, recommendation } from '../js/engine.mjs';
import { applyReport } from '../js/store.mjs';
import { writeFileSync } from 'node:fs';

const c = getCase('c12');
let run = createRun(c, { level: 11 });
for (const id of ['u-code', 'a-repro', 'u-metrics', 'u-git', 'u-teammate', 'u-docs']) run = applyAction(c, run, id).run;
run = setHypothesis(c, run, 'h2');
for (const id of ['a-default', 'a-kill']) run = applyAction(c, run, id).run;
const profile = createDemoProfile();
const suggestion = recommendation(CASE_SUMMARIES.filter(x => x.id !== c.id), profile);
const report = buildReport(c, run, { daily: false, replay: false, levelBefore: 11, nextCaseId: suggestion.case.id });
report.actionLog = run.history.map(h => ({ label: h.label, cat: h.cat, log: h.log, fxText: h.fxText, harmful: run.harmful.includes(h.actionId), wasted: run.wasted.includes(h.actionId) }));
report.nextCaseTitle = suggestion.case.title;
report.nextReason = suggestion.reason;
const application = applyReport(profile, report, c, { daily: false });
const state = { profile: application.profile, report: { ...report, application } };
const js = `try {\n  localStorage.setItem('primer.profile.v1', ${JSON.stringify(JSON.stringify(state.profile))});\n  localStorage.setItem('primer.lastReport.v1', ${JSON.stringify(JSON.stringify(state.report))});\n} catch (e) {}\n`;
writeFileSync(process.env.TEMP + '/primer-report-preload.js', js, 'utf8');
console.log('report', report.grade, report.score, 'xp', report.xp, 'evidence', report.evidence, 'next', report.nextCaseId);



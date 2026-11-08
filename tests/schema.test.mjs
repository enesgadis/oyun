import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, CASE_SUMMARIES, buildBootstrap, defaultHomeBlocks, defaultRuntime, getCase } from '../shared/content.mjs';
import {
  BLOCK_TYPES,
  validateBlocks,
  validateCase,
  validateCaseCollection,
  validateRuntimePatch,
} from '../shared/schema.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));

test('the authored collection has zero schema errors', () => {
  assert.deepEqual(validateCaseCollection(CASES), []);
});

test('every case id is unique and every summary is serialisable', () => {
  const ids = new Set(CASES.map((c) => c.id));
  assert.equal(ids.size, CASES.length);
  for (const summary of CASE_SUMMARIES) {
    assert.equal(JSON.parse(JSON.stringify(summary)).id, summary.id);
    assert.ok(summary.actionCount >= 4);
    assert.ok(summary.turns >= 8);
  }
});

test('minimal invalid cases are rejected with useful errors', () => {
  const brokenId = { ...clone(CASES[0]), id: 'bad id' };
  assert.ok(validateCase(brokenId).some((e) => /id/.test(e)));

  const brokenTurns = { ...clone(CASES[0]), turns: 2 };
  assert.ok(validateCase(brokenTurns).some((e) => /turns/.test(e)));

  const brokenHypotheses = { ...clone(CASES[0]), hypotheses: [{ id: 'h1', text: 'x', correct: true }] };
  assert.ok(validateCase(brokenHypotheses).some((e) => /3 hipotez/.test(e)));

  const brokenChain = { ...clone(CASES[0]), fixChain: ['does-not-exist'] };
  assert.ok(validateCase(brokenChain).some((e) => /fixChain/.test(e)));

  const brokenNeeds = clone(CASES[0]);
  brokenNeeds.actions[1].needs = ['missing-clue'];
  assert.ok(validateCase(brokenNeeds).some((e) => /needs/.test(e)));
});

test('universal cases expose all six evidence keys', () => {
  for (const c of CASES.filter((x) => x.universal !== false)) {
    for (const key of ['logs', 'metrics', 'code', 'git', 'teammate', 'docs']) {
      assert.ok(c.clues[key], `${c.id} missing ${key}`);
    }
  }
});

test('home block validator accepts the default layout and rejects unknown types', () => {
  const defaults = defaultHomeBlocks();
  assert.deepEqual(validateBlocks(defaults), []);
  assert.ok(validateBlocks([{ type: 'script', src: 'evil.js' }]).length > 0);
  assert.ok(validateBlocks([{ type: 'hero', title: 'x' }]).length > 0);
  assert.ok(validateBlocks(Array.from({ length: 17 }, () => ({ type: 'divider' }))).length > 0);
  assert.deepEqual(BLOCK_TYPES.includes('ticker'), true);
});

test('runtime patch validator protects the live schema', () => {
  assert.deepEqual(validateRuntimePatch({ theme: { accent: '#ff00aa' } }), []);
  assert.ok(validateRuntimePatch({ theme: { accent: 'red' } }).length > 0);
  assert.ok(validateRuntimePatch({ announcement: { text: '' } }).length > 0);
  assert.ok(validateRuntimePatch({ homeBlocks: [{ type: 'nope' }] }).length > 0);
  assert.ok(validateRuntimePatch({ featuredCase: 'not-a-case' }).length > 0);
  assert.deepEqual(
    validateRuntimePatch({
      season: { id: 's2', name: 'Kriz', tag: 'SEZON 02', accent: '#ff6b6b' },
      announcement: { tone: 'warn', title: 'Olay', text: 'Nöbet masası açık.' },
      appendBlocks: [{ type: 'banner', tone: 'warn', title: 'Dikkat', text: 'Önce ölç.' }],
    }),
    []
  );
});

test('a valid extra case passes and a broken one does not publish', () => {
  const extra = clone(getCase('c01'));
  extra.id = 'c99';
  extra.code = 'DEV-99';
  extra.title = 'Test Vakası';
  extra.actions = extra.actions.map((a) => ({ ...a, id: `${a.id}-x` }));
  extra.fixChain = extra.fixChain.map((id) => `${id}-x`);
  assert.deepEqual(validateRuntimePatch({ extraCase: extra }), []);

  const broken = clone(extra);
  delete broken.vitals;
  assert.ok(validateRuntimePatch({ extraCase: broken }).length > 0);
});

test('bootstrap is a JSON-safe server-driven UI contract', () => {
  const bootstrap = buildBootstrap(defaultRuntime());
  const roundTrip = JSON.parse(JSON.stringify(bootstrap));
  assert.equal(roundTrip.schema, 3);
  assert.equal(roundTrip.cases.length, CASES.length);
  assert.equal(roundTrip.homeBlocks.length, defaultHomeBlocks().length);
  assert.equal(typeof roundTrip.generatedAt, 'string');
  assert.equal(roundTrip.meta.caseCount, CASES.length);
  assert.equal(roundTrip.cases[0].id, 'c01');
});

test('bootstrap can be extended without a client build', () => {
  const runtime = defaultRuntime();
  const extra = clone(getCase('c01'));
  extra.id = 'c42';
  extra.code = 'DEV-42';
  extra.title = 'Sunucudan Gelen Vaka';
  extra.actions = extra.actions.map((a) => ({ ...a, id: `${a.id}-42` }));
  extra.fixChain = extra.fixChain.map((id) => `${id}-42`);
  runtime.extraCases = [extra];
  runtime.homeBlocks = [...runtime.homeBlocks, { type: 'note', text: 'Bu blok sunucudan geldi.' }];
  const bootstrap = buildBootstrap(runtime);
  assert.equal(bootstrap.cases.length, CASES.length + 1);
  assert.ok(bootstrap.cases.some((c) => c.id === 'c42'));
  assert.equal(bootstrap.homeBlocks.at(-1).type, 'note');
});

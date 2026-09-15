import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/core.mjs';
import { performanceBoard, selectAdaptiveTeam } from '../src/performance.mjs';
import { roundtable } from '../src/roundtable.mjs';

const job = text => ({ id: 'job', text, plan: classify(text), contributions: [], failures: [] });
const contribution = (agent, model = `${agent.toLowerCase()}-model`) => ({ agent, stage: 'specialist', provider: 'test', model, text: `output ${agent}`, durationMs: 1000 });

test('Performance Board uses only observed calls, failures and owner feedback', () => {
  const rows = performanceBoard([
    { contributions: [contribution('Coda', 'north-mini-code')], failures: [], rating: 1, ownerDecision: 'accepted' },
    { contributions: [contribution('Coda', 'north-mini-code')], failures: [{ agent: 'Coda' }], rating: -1, ownerDecision: 'revise' },
  ]);
  const coda = rows.find(r => r.agent === 'Coda');
  assert.equal(coda.calls, 2);
  assert.equal(coda.failures, 1);
  assert.equal(coda.ratedJobs, 2);
  assert.equal(coda.useful, 1);
  assert.equal(coda.accepted, 1);
  assert.equal(coda.revise, 1);
  assert.equal(coda.topModel, 'test / north-mini-code');
  assert.ok(coda.score >= 0 && coda.score <= 100);
});

test('Simple work keeps the roundtable selective instead of summoning extra agents', () => {
  const current = job('Scrivi una breve email professionale di ringraziamento.');
  const decision = selectAdaptiveTeam(current, []);
  assert.deepEqual(decision.selected, ['Coda']);
  assert.equal(decision.machineLearning, false);
});

test('Complex work can add a second relevant specialist without exceeding two', () => {
  const current = job('Scrivi un documento confrontando tre alternative, con rischi, vincoli e una decisione finale motivata.');
  const decision = selectAdaptiveTeam(current, []);
  assert.equal(decision.selected[0], 'Coda');
  assert.equal(decision.selected.includes('Sage'), true);
  assert.ok(decision.selected.length <= 2);
});

test('Historical feedback breaks ties between equally relevant specialists but cannot bypass task fit', () => {
  const current = job('Calcola e confronta due scenari di budget con percentuali e rendimento.');
  const history = [];
  for (let i = 0; i < 4; i++) history.push({ contributions: [contribution('Ledger')], failures: [], rating: 1, ownerDecision: 'accepted' });
  for (let i = 0; i < 4; i++) history.push({ contributions: [contribution('Sage')], failures: [{ agent: 'Sage' }], rating: -1, ownerDecision: 'revise' });
  const decision = selectAdaptiveTeam(current, history);
  assert.equal(decision.selected[0], 'Ledger');
  assert.equal(decision.selected.includes('Sage'), true);
  assert.match(decision.reason, /segnali storici locali/i);
  assert.equal(decision.candidates.find(c => c.agent === 'Ledger').evidence >= 3, true);
});

test('An interrupted roundtable keeps the original team decision from its checkpoint', () => {
  const current = job('Scrivi un documento complesso con rischi e alternative.');
  current.checkpoint = { teamDecision: { version: 'saved', mode: 'adaptive-deterministic', selected: ['Aegis'], candidates: [], historyJobs: 9, reason: 'saved', machineLearning: false }, contributions: [] };
  const decision = selectAdaptiveTeam(current, []);
  assert.deepEqual(decision.selected, ['Aegis']);
  assert.equal(decision.version, 'saved');
});

test('Roundtable records the adaptive team decision and still ends with Verity', async () => {
  const current = job('Scrivi un documento confrontando alternative, rischi e vincoli.');
  const called = [];
  const result = await roundtable(current, async (agent, prompt) => {
    called.push(agent);
    if (agent === 'Verity') return { agent, provider: 'review', model: 'review-model', text: JSON.stringify({ verdict: 'pass', issues: [], summary: 'ok' }) };
    return { agent, provider: 'writer', model: `${agent}-model`, text: `${agent}: risultato` };
  }, { context: current.text, history: [] });
  assert.ok(result.teamDecision.selected.length >= 1 && result.teamDecision.selected.length <= 2);
  assert.equal(result.teamDecision.machineLearning, false);
  assert.equal(called.at(-1), 'Verity');
  assert.equal(result.review.status, 'pass');
});

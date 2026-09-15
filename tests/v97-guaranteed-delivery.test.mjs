import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/core.mjs';
import { roundtable, GUARANTEED_DELIVERY_VERSION } from '../src/roundtable.mjs';

const makeJob = (text = 'Scrivi un documento confrontando alternative, rischi e vincoli con una decisione finale.') => ({
  id: 'v97-job', text, plan: classify(text), contributions: [], failures: [],
});
const answer = (agent, text = `${agent}: risultato utilizzabile`) => ({ agent, provider: 'test-provider', model: `${agent}-model`, text });
const passReview = () => answer('Verity', JSON.stringify({ verdict: 'pass', issues: [], summary: 'ok' }));

test('V9.7 delivers a valid Director answer even when Verity is unavailable', async () => {
  const result = await roundtable(makeJob(), async (agent) => {
    if (agent === 'Verity') throw new Error('review provider unavailable');
    return answer(agent);
  }, { context: 'Contesto di test', history: [] });

  assert.equal(result.status, 'completed');
  assert.equal(result.review.status, 'unavailable');
  assert.equal(result.delivery.version, GUARANTEED_DELIVERY_VERSION);
  assert.equal(result.delivery.degraded, true);
  assert.equal(result.failures.some(f => f.agent === 'Verity'), true);
  assert.match(result.qualityReport, /consegna resiliente/i);
});

test('V9.7 tolerates a missing specialist when Director synthesis and review succeed', async () => {
  let specialistFailed = false;
  const result = await roundtable(makeJob(), async (agent) => {
    if (!specialistFailed && !['Direttore', 'Verity'].includes(agent)) {
      specialistFailed = true;
      throw new Error('specialist unavailable');
    }
    if (agent === 'Verity') return passReview();
    return answer(agent);
  }, { context: 'Contesto di test', history: [] });

  assert.equal(result.status, 'completed');
  assert.equal(result.review.status, 'pass');
  assert.equal(result.failures.some(f => f.stage === 'specialist'), true);
  assert.equal(result.delivery.degraded, true);
});

test('V9.7 falls back to Director even when all specialists fail', async () => {
  const result = await roundtable(makeJob(), async (agent) => {
    if (!['Direttore', 'Verity'].includes(agent)) throw new Error('specialist unavailable');
    if (agent === 'Verity') return passReview();
    return answer(agent, 'Direttore: risposta diretta dal brief');
  }, { context: 'Contesto di test', history: [] });

  assert.equal(result.status, 'completed');
  assert.equal(result.result, 'Direttore: risposta diretta dal brief');
  assert.match(result.qualityReport, /Contributi specialistici ricevuti: nessuno/i);
});

test('V9.7 keeps a known unresolved Verity revise as partial', async () => {
  const result = await roundtable(makeJob(), async (agent, prompt) => {
    if (agent === 'Verity') return answer('Verity', JSON.stringify({ verdict: 'revise', issues: ['correggere'], summary: 'serve revisione' }));
    if (agent === 'Direttore' && prompt.includes('Revisione Verity')) throw new Error('repair unavailable');
    return answer(agent);
  }, { context: 'Contesto di test', history: [] });

  assert.equal(result.status, 'partial');
  assert.equal(result.delivery.unresolvedKnownIssue, true);
});

test('V9.7 protects delivery budget by skipping Verity after a slow core roundtable', async () => {
  const originalNow = Date.now;
  let fakeNow = 1000;
  Date.now = () => fakeNow;
  const called = [];
  try {
    const result = await roundtable(makeJob(), async (agent) => {
      called.push(agent);
      fakeNow += 20000;
      if (agent === 'Verity') return passReview();
      return answer(agent);
    }, { context: 'Contesto di test', history: [] });

    assert.equal(result.status, 'completed');
    assert.equal(called.includes('Verity'), false);
    assert.equal(result.review.skippedForDeliveryBudget, true);
    assert.match(result.qualityReport, /budget temporale V9\.7/i);
  } finally {
    Date.now = originalNow;
  }
});

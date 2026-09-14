import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJob, executeJob } from '../server/engine.mjs';

const input = extra => ({
  id: 'test-v92-job',
  text: 'Confronta due alternative generiche',
  team: ['Direttore'],
  mode: 'independent',
  memory: [],
  intent: 'draft-only',
  zeroCost: true,
  schemaVersion: 3,
  ...(extra || {}),
});

test('Independent WARN is corrected by Director and checked again before delivery', async () => {
  const calls = [];
  const provider = {
    call: async (agent, prompt) => {
      calls.push({ agent, prompt });
      if (agent === 'Sage') return { agent, model: 'sage-model', provider: 'test', text: 'Contributo Sage', usage: { cost: 0 } };
      if (agent === 'Lumen') return { agent, model: 'lumen-model', provider: 'test', text: 'Contributo Lumen', usage: { cost: 0 } };
      if (agent === 'Direttore' && prompt.includes('BOZZA DA CORREGGERE')) return { agent, model: 'writer-model-2', provider: 'test', text: 'Risposta corretta e sintetica.', usage: { cost: 0 } };
      if (agent === 'Direttore') return { agent, model: 'writer-model-1', provider: 'test', text: 'Bozza iniziale troppo lunga.', usage: { cost: 0 } };
      if (agent === 'Verity' && prompt.includes('RISPOSTA CORRETTA DOPO IL PRIMO WARN')) return { agent, model: 'review-model', provider: 'test', text: JSON.stringify({ verdict: 'pass', issues: [], summary: 'Correzione riuscita' }), usage: { cost: 0 } };
      if (agent === 'Verity') return { agent, model: 'review-model', provider: 'test', text: JSON.stringify({ verdict: 'revise', issues: ['Troppo lunga per la richiesta'], summary: 'Va resa più diretta' }), usage: { cost: 0 } };
      throw Error(`Unexpected agent ${agent}`);
    },
  };

  const out = await executeJob(validateJob(input()), provider);
  assert.equal(out.status, 'completed');
  assert.equal(out.result, 'Risposta corretta e sintetica.');
  assert.equal(out.review.status, 'pass');
  assert.equal(out.review.firstStatus, 'revise');
  assert.equal(out.review.autoCorrected, true);
  assert.equal(out.review.secondPass, true);
  assert.equal(out.failures.length, 0);
  assert.equal(out.contributions.length, 6);
  assert.equal(calls.filter(c => c.agent === 'Direttore').length, 2);
  assert.equal(calls.filter(c => c.agent === 'Verity').length, 2);
});

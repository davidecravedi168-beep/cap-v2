import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from '../src/core.mjs';
import { Runtime } from '../src/runtime.mjs';
import { decisionInstruction, hasDecisionStructure, resolveDecisionMode } from '../src/decision-mode.mjs';

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) }; };
const office = () => new Workspace(memoryStorage());
const structured = label => `## Decisione\n${label}\n\n## Evidenze\nDato fornito nel brief.\n\n## Dissenso\nNessun dissenso documentato.\n\n## Rischi\nInformazioni incomplete.\n\n## Prossima azione\nVerificare il dato principale.\n\n## Richiede autorizzazione\nNo`;
const jsonResponse = payload => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('Decision Mode uses fast for simple work and escalates complex work', () => {
  const ws = office();
  const simple = ws.add('Scrivi un messaggio breve e cordiale', { reviewMode: 'decision' });
  const complex = ws.add('Confronta due alternative e aiutami a decidere', { reviewMode: 'decision' });
  assert.equal(resolveDecisionMode(simple, { engine: 'legacy' }).executionMode, 'fast');
  assert.equal(resolveDecisionMode(complex, { engine: 'legacy' }).executionMode, 'roundtable');
  assert.equal(resolveDecisionMode(complex, { engine: 'secure' }).executionMode, 'independent');
  assert.equal(resolveDecisionMode(complex, { engine: 'legacy' }).machineLearning, false);
});

test('Decision Mode output contract requires all six decision sections', () => {
  const route = { requested: true, executionMode: 'fast', approvalRequired: false };
  const prompt = decisionInstruction(route);
  assert.match(prompt, /## Decisione/);
  assert.match(prompt, /## Richiede autorizzazione/);
  assert.equal(hasDecisionStructure(structured('Procedere')), true);
  assert.equal(hasDecisionStructure('## Decisione\nProcedere'), false);
});

test('Workspace persists Decision Mode through follow-ups and roundtable retries', () => {
  const ws = office();
  const original = ws.add('Confronta due alternative', { reviewMode: 'decision' });
  assert.equal(original.reviewMode, 'decision');
  ws.patch(original.id, { result: structured('A'), status: 'completed', resolvedReviewMode: 'roundtable' });
  const follow = ws.followUp(original.id, 'Approfondisci il rischio principale');
  assert.equal(follow.reviewMode, 'decision');

  ws.patch(follow.id, { status: 'interrupted', resolvedReviewMode: 'roundtable', checkpoint: { contributions: [{ agent: 'Sage', stage: 'specialist', text: 'salvato' }] } });
  const retry = ws.retry(follow.id);
  assert.equal(retry.reviewMode, 'decision');
  assert.equal(retry.checkpoint.contributions.length, 1);
});

test('Runtime Decision Mode fast uses one call and enforces the decision contract', async () => {
  const ws = office();
  const job = ws.add('Scrivi un messaggio breve e cordiale', { reviewMode: 'decision' });
  let calls = 0; let sent;
  const runtime = new Runtime(ws, { locks: null, fetcher: async (_url, options) => {
    calls++; sent = JSON.parse(options.body);
    return jsonResponse({ zeroCost: true, status: 'completed', result: structured('Usa un messaggio breve.'), provider: 'test-free', model: 'test-model' });
  } });
  await runtime.pump();
  const out = ws.state.jobs.find(j => j.id === job.id);
  assert.equal(calls, 1);
  assert.equal(sent.mode, 'fast');
  assert.match(sent.text, /DECISION MODE V9\.5/);
  assert.equal(out.resolvedReviewMode, 'fast');
  assert.equal(out.decisionContract, 'pass');
  assert.equal(out.status, 'completed');
});

test('Runtime Decision Mode complex invokes Adaptive Team, Director and Verity', async () => {
  const ws = office();
  const job = ws.add('Confronta due alternative e aiutami a decidere', { reviewMode: 'decision' });
  const calls = [];
  const runtime = new Runtime(ws, { locks: null, fetcher: async (_url, options) => {
    const body = JSON.parse(options.body); const agent = body.team[0]; calls.push(agent);
    let result = `Contributo di ${agent}`;
    if (agent === 'Direttore') result = structured('Scegliere A con le informazioni disponibili.');
    if (agent === 'Verity') result = JSON.stringify({ verdict: 'pass', issues: [], summary: 'Struttura e limiti adeguati.' });
    return jsonResponse({ zeroCost: true, status: 'completed', result, provider: 'test-free', model: `${agent}-model` });
  } });
  await runtime.pump();
  const out = ws.state.jobs.find(j => j.id === job.id);
  assert.equal(out.resolvedReviewMode, 'roundtable');
  assert.deepEqual(calls, ['Sage', 'Lumen', 'Direttore', 'Verity']);
  assert.equal(out.decisionContract, 'pass');
  assert.equal(out.review.status, 'pass');
  assert.equal(out.status, 'completed');
});

test('Decision Mode never calls an incomplete answer completed', async () => {
  const ws = office();
  const job = ws.add('Scrivi un messaggio breve', { reviewMode: 'decision' });
  const runtime = new Runtime(ws, { locks: null, fetcher: async () => jsonResponse({ zeroCost: true, status: 'completed', result: 'Solo una risposta libera.', provider: 'test-free', model: 'test-model' }) });
  await runtime.pump();
  const out = ws.state.jobs.find(j => j.id === job.id);
  assert.equal(out.status, 'partial');
  assert.equal(out.decisionContract, 'incomplete');
  assert.match(out.qualityReport, /non ha rispettato tutte le sei sezioni/);
});

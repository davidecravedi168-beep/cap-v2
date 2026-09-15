import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace, STORE_KEY, normaliseResponse } from '../src/core.mjs';
import { Runtime } from '../src/runtime.mjs';
import { roundtable } from '../src/roundtable.mjs';
import { contextFor, validateMaterial } from '../src/context.mjs';
import { markdown } from '../src/markdown.mjs';
import { validateArchive } from '../src/archive.mjs';
const office = () => { const m = new Map(); return new Workspace({ getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) }); };
const response = (x, status = 200) => new Response(JSON.stringify(x), { status });
const sample = agent => ({ agent, provider: 'test', model: 'same-model', text: agent === 'Verity' ? JSON.stringify({ verdict: 'pass', issues: [], summary: 'Controllo completato' }) : `Contributo di ${agent}` });

test('Roundtable records four real calls and does not claim independent models', async () => {
  const ws = office(), job = ws.add('Confronta due alternative', { reviewMode: 'roundtable' }), calls = [];
  const result = await roundtable(job, async agent => { calls.push(agent); return sample(agent); }, { context: job.text });
  assert.deepEqual(calls, ['Sage', 'Lumen', 'Direttore', 'Verity']);
  assert.equal(result.contributions.length, 4); assert.equal(result.review.separateCall, true);
  assert.equal(result.review.independent, false); assert.equal(result.review.distinctReportedModels, false);
  assert.equal(result.result, 'Contributo di Direttore');
});
test('A reviewer rejecting a draft prevents completed status', async () => {
  const ws = office(), job = ws.add('Scrivi una bozza');
  const result = await roundtable(job, async agent => ({ ...sample(agent), text: agent === 'Verity' ? '{"verdict":"reject","issues":["dato inventato"],"summary":"Non approvare"}' : 'Bozza' }), { context: job.text });
  assert.equal(result.status, 'partial'); assert.equal(result.review.status, 'reject'); assert.match(result.qualityReport, /dato inventato/);
});
test('Provider failure preserves successful contributions, exposes degradation and still delivers a verified synthesis', async () => {
  const ws = office(), job = ws.add('Confronta opzioni');
  const result = await roundtable(job, async agent => { if (agent === 'Lumen') throw Error('Quota gratuita'); return sample(agent); }, { context: job.text });
  assert.equal(result.status, 'completed'); assert.equal(result.result, 'Contributo di Direttore'); assert.equal(result.failures[0].agent, 'Lumen');
  assert.equal(result.review.status, 'pass'); assert.equal(result.delivery.degraded, true);
});
test('Interrupted roundtables resume saved stages without repeating successful calls', async () => {
  const ws = office(), job = ws.add('Confronta due opzioni', { reviewMode: 'roundtable' }); const controller = new AbortController(); let checkpoint;
  await assert.rejects(roundtable(job, async agent => { if (agent === 'Lumen') controller.abort(); return sample(agent); }, {
    context: job.text, signal: controller.signal, checkpoint: async v => { checkpoint = v; },
  }), /Aborted/);
  assert.equal(checkpoint.contributions.length, 1); const calls = [];
  const result = await roundtable({ ...job, checkpoint }, async agent => { calls.push(agent); return sample(agent); }, { context: job.text });
  assert.deepEqual(calls, ['Lumen', 'Direttore', 'Verity']); assert.equal(result.contributions.length, 4);
});
test('Follow-up preserves private classification, result context and review choice', async () => {
  const ws = office(), j = ws.add('Progetto riservato', { sensitivity: 'private', reviewMode: 'independent', project: 'Test' });
  ws.patch(j.id, { result: 'Risposta precedente', status: 'completed' }); const next = ws.followUp(j.id, 'Approfondisci');
  assert.equal(next.sensitivity, 'private'); assert.equal(next.reviewMode, 'independent'); assert.equal(next.parentId, j.id);
  assert.match(contextFor(next), /Risposta precedente/);
  let calls = 0; await new Runtime(ws, { locks: null, fetcher: () => { calls++; } }).pump(); assert.equal(calls, 0);
});
test('Sensitive material is screened with the complete context before any public call', async () => {
  const ws = office(); ws.add('Leggi il materiale', { materials: [validateMaterial('sample.txt', 'password: sample-only')] });
  let calls = 0; await new Runtime(ws, { locks: null, fetcher: () => { calls++; } }).pump(); assert.equal(calls, 0); assert.equal(ws.state.jobs[0].status, 'blocked');
});
test('Different attached materials are distinct jobs even when the brief is identical', () => {
  const ws = office();
  const first = ws.add('Analizza', { materials: [validateMaterial('a.txt', 'uno')] });
  const second = ws.add('Analizza', { materials: [validateMaterial('b.txt', 'due')] });
  assert.notEqual(first.id, second.id); assert.equal(ws.state.jobs.length, 2);
});
test('Owner approval records a decision without executing or requeuing a job', () => {
  const ws = office(); const job = ws.add('Scrivi una bozza'); ws.patch(job.id, { status: 'completed', result: 'ok' });
  const before = ws.state.jobs.length; ws.decide(job.id, 'accepted');
  const saved = ws.state.jobs.find(j => j.id === job.id); assert.equal(saved.ownerDecision, 'accepted'); assert.equal(saved.status, 'completed'); assert.equal(ws.state.jobs.length, before);
});
test('Text attachments reject unsupported formats, binary data and oversized material', () => {
  assert.throws(() => validateMaterial('bad.exe', 'x'), /TXT|MD|CSV|JSON/);
  assert.throws(() => validateMaterial('bad.txt', 'a\u0000b'), /binario/);
  assert.throws(() => validateMaterial('big.txt', 'x'.repeat(12001)), /12.000/);
});
test('Archive round-trip preserves materials but never automatically resumes jobs', () => {
  const ws = office(); const job = ws.add('Analizza', { materials: [validateMaterial('a.txt', 'testo')] }); ws.patch(job.id, { status: 'running' });
  const archive = ws.export(); const parsed = validateArchive(JSON.parse(archive));
  assert.equal(parsed.jobs[0].materials[0].text, 'testo'); assert.equal(parsed.jobs[0].status, 'interrupted');
});
test('Markdown renders tables and code while rejecting active markup and unsafe links', () => {
  const out = markdown('| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x=1;\n```\n<script>alert(1)</script> [x](javascript:alert(1))');
  assert.match(out, /<table>/); assert.match(out, /<pre><code/); assert.doesNotMatch(out, /<script>/); assert.doesNotMatch(out, /javascript:/);
});
test('Quota errors do not silently reload and discard unsaved work', () => {
  const broken = { getItem: () => null, setItem: () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); } };
  const ws = new Workspace(broken); ws.state.jobs.push({ id: 'keep', text: 'keep' }); assert.throws(() => ws.save(), /quota/i); assert.equal(ws.state.jobs[0].text, 'keep');
});
test('Malformed local archive cannot crash the entrypoint or destroy the original', () => {
  const ws = office(); ws.add('Tieni'); const before = JSON.stringify(ws.state);
  assert.throws(() => validateArchive({ version: 999, jobs: 'bad' })); assert.equal(JSON.stringify(ws.state), before);
});
test('Completed roundtable retry starts fresh; interrupted retry keeps its checkpoint', () => {
  const ws = office(); const done = ws.add('Confronta', { reviewMode: 'roundtable' }); ws.patch(done.id, { status: 'completed', checkpoint: { contributions: [sample('Sage')] } });
  const fresh = ws.retry(done.id); assert.equal(fresh.checkpoint, undefined);
  const interrupted = ws.add('Confronta ancora', { reviewMode: 'roundtable' }); ws.patch(interrupted.id, { status: 'interrupted', checkpoint: { contributions: [sample('Sage')] } });
  const resumed = ws.retry(interrupted.id); assert.equal(resumed.checkpoint.contributions.length, 1);
});
test('Default fetch retains the browser global receiver for native methods', async () => {
  const ws = office(); const original = globalThis.fetch; let receiverOk = false;
  globalThis.fetch = function () { receiverOk = this === globalThis; return Promise.resolve(response({ ok: true, zeroCost: true })); };
  try { const runtime = new Runtime(ws, { locks: null }); await runtime.check(); assert.equal(receiverOk, true); }
  finally { globalThis.fetch = original; }
});
test('An automatic router name is not presented as the actual model', () => {
  const out = normaliseResponse({ status: 'completed', result: 'ok', provider: 'x', model: 'auto' }, 'legacy');
  assert.equal(out.provenance.model, 'Non dichiarato');
});
test('Historical completed answers still count as available results', () => {
  const ws = office(); const j = ws.add('old'); ws.patch(j.id, { status: 'completed', result: 'risultato' });
  assert.equal(ws.state.jobs.filter(x => x.status === 'completed').length, 1);
});

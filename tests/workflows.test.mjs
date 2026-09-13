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
test('Partial provider failure preserves successful contributions and exposes failure', async () => {
  const ws = office(), job = ws.add('Confronta opzioni');
  const result = await roundtable(job, async agent => { if (agent === 'Lumen') throw Error('Quota gratuita'); return sample(agent); }, { context: job.text });
  assert.equal(result.status, 'partial'); assert.equal(result.result, 'Contributo di Direttore'); assert.equal(result.failures[0].agent, 'Lumen');
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
  const ws = office(), a = ws.add('Riassumi', { materials: [{ name: 'a.txt', text: 'Prima' }] }), b = ws.add('Riassumi', { materials: [{ name: 'b.txt', text: 'Seconda' }] });
  assert.notEqual(a.id, b.id);
});
test('Owner approval records a decision without executing or requeuing a job', () => {
  const ws = office(), j = ws.add('Prepara una proposta'); ws.patch(j.id, { result: 'Bozza', status: 'completed' }); ws.decide(j.id, 'accepted');
  assert.equal(ws.state.jobs[0].status, 'completed'); assert.equal(ws.state.jobs[0].ownerDecision, 'accepted'); assert.equal(ws.state.jobs.length, 1);
});
test('Text attachments reject unsupported formats, binary data and oversized material', () => {
  for (const [name, text] of [['a.pdf', 'test'], ['a.txt', '\u0000data'], ['a.md', 'x'.repeat(12001)]]) assert.throws(() => validateMaterial(name, text));
  assert.deepEqual(validateMaterial('note.md', '# Test'), { name: 'note.md', text: '# Test' });
});
test('Archive round-trip preserves materials but never automatically resumes jobs', () => {
  const ws = office(); ws.add('Riassumi', { materials: [validateMaterial('note.txt', 'Testo completo')], reviewMode: 'roundtable' });
  const result = validateArchive(ws.state); assert.equal(result.jobs[0].materials[0].text, 'Testo completo'); assert.equal(result.jobs[0].status, 'interrupted');
  assert.equal(result.jobs[0].reviewMode, 'roundtable');
});
test('Markdown renders tables and code while rejecting active markup and unsafe links', () => {
  const result = markdown('# Risultato\n**Confronto**\n| A | B |\n| --- | --- |\n| 1 | 2 |\n```js\n<script>alert(1)</script>\n```\n[bad](javascript:alert)\n[bad](https://user:secret@example.com/)\n<img src=x onerror=alert(1)>\n![remote](https://tracker.invalid/pixel)');
  assert.match(result, /<table>/); assert.match(result, /<strong>Confronto<\/strong>/); assert.match(result, /&lt;script&gt;/);
  assert.doesNotMatch(result, /<script>|<img|href="javascript:|href="https:\/\/user/);
});
test('Quota errors do not silently reload and discard unsaved work', () => {
  const m = new Map(); let full = false;
  const ws = new Workspace({ getItem: k => m.get(k), setItem: (k, v) => { if (full) throw Error('full'); m.set(k, v); } });
  const j = ws.add('Test'); full = true; ws.patch(j.id, { result: 'Risultato da recuperare', status: 'completed' });
  ws.refresh(); assert.equal(ws.state.jobs[0].result, 'Risultato da recuperare'); assert.ok(ws.storageError);
});
test('Malformed local archive cannot crash the entrypoint or destroy the original', () => {
  const raw = JSON.stringify({ version: 3, jobs: [null], memory: [], events: [] }), m = new Map([[STORE_KEY, raw]]);
  const ws = new Workspace({ getItem: k => m.get(k), setItem: (k, v) => m.set(k, v) }); ws.save();
  assert.equal(ws.readOnly, true); assert.equal(m.get(STORE_KEY), raw);
  assert.equal(ws.state.jobs.length, 0); assert.equal(ws.metrics().total, 0);
});
test('Completed roundtable retry starts fresh; interrupted retry keeps its checkpoint', () => {
  for (const status of ['completed', 'interrupted']) {
    const ws = office(), j = ws.add('Testo', { reviewMode: 'roundtable' });
    ws.patch(j.id, { status, checkpoint: { contributions: [sample('Sage')] } });
    const next = ws.retry(j.id); assert.equal(!!next.checkpoint, status === 'interrupted');
  }
});
test('Default fetch retains the browser global receiver for native methods', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = function () { if (this !== globalThis) throw new TypeError('Illegal invocation'); return Promise.resolve(response({ ok: true })); };
    const rt = new Runtime(office(), { locks: null }); assert.equal((await rt.check()).reachable, true);
  } finally { globalThis.fetch = previous; }
});
test('An automatic router name is not presented as the actual model', () => {
  const out = normaliseResponse({ zeroCost: true, result: 'Testo', model: 'auto', contributions: [{ agent: 'Direttore', model: 'auto', text: 'Testo' }] }, 'legacy');
  assert.equal(out.provenance.model, 'Non dichiarato'); assert.equal(out.contributions[0].model, 'Non dichiarato');
});
test('Historical completed answers still count as available results', () => {
  const ws = office(), j = ws.add('Storico'); ws.patch(j.id, { status: 'completed', result: 'Salvato', migrated: true });
  assert.equal(ws.metrics().ready, 1); assert.equal(ws.metrics().reviewed, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from '../src/core.mjs';
import { Runtime } from '../src/runtime.mjs';

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

const providerResponse = provider => new Response(JSON.stringify({
  status: 'completed',
  zeroCost: true,
  provider,
  model: 'test-model',
  result: 'Risultato completo ' + 'verificabile '.repeat(80),
  contributions: [{ agent: 'Direttore', provider, model: 'test-model', text: 'Contributo' }],
}), { status: 200 });

test('Runtime discards a response that declares Bolt as provider', async () => {
  const storage = memoryStorage();
  const ws = new Workspace(storage);
  ws.add('Prepara una bozza semplice');
  const rt = new Runtime(ws, { locks: null, fetcher: async () => providerResponse('bolt.new') });
  await rt.pump();
  const job = ws.state.jobs[0];
  assert.equal(job.status, 'blocked');
  assert.equal(job.result, '');
  assert.match(job.error, /Cost Guard/);
  assert.match(job.error, /bolt\.new/);
});

test('Runtime accepts a provider declared through a zero-credit gateway when it is not blocked', async () => {
  const storage = memoryStorage();
  const ws = new Workspace(storage);
  ws.add('Prepara una bozza semplice');
  const rt = new Runtime(ws, { locks: null, fetcher: async () => providerResponse('free-test-provider') });
  await rt.pump();
  const job = ws.state.jobs[0];
  assert.equal(job.status, 'completed');
  assert.match(job.result, /Risultato completo/);
});

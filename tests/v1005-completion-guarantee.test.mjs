import test from 'node:test';
import assert from 'node:assert/strict';
import { openRouterFreeFallback } from '../src/free-fallback.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('V10.0.5 OpenRouter free continues once when finish_reason is length', async () => {
  const calls = [];
  const storage = { getItem: () => 'sk-or-v1-test_key_abcdefghijklmnopqrstuvwxyz' };
  const fetcher = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    if (calls.length === 1) return jsonResponse({
      model: 'free-model',
      choices: [{ finish_reason: 'length', message: { content: 'Prima parte incompleta' } }],
    });
    return jsonResponse({
      model: 'free-model',
      choices: [{ finish_reason: 'stop', message: { content: ' e parte conclusiva.' } }],
    });
  };
  const out = await openRouterFreeFallback({ text: 'Spiega bene', fetcher, storage });
  assert.equal(calls.length, 2);
  assert.equal(out.status, 'completed');
  assert.match(out.result, /Prima parte incompleta e parte conclusiva\./);
  assert.equal(out.completion?.continued, true);
});

test('V10.0.5 OpenRouter free never labels a twice-truncated answer completed', async () => {
  const storage = { getItem: () => 'sk-or-v1-test_key_abcdefghijklmnopqrstuvwxyz' };
  let n = 0;
  const fetcher = async () => {
    n++;
    return jsonResponse({ model: 'free-model', choices: [{ finish_reason: 'length', message: { content: n === 1 ? 'Parte uno' : ' parte due' } }] });
  };
  const out = await openRouterFreeFallback({ text: 'Spiega bene', fetcher, storage });
  assert.equal(n, 2);
  assert.equal(out.status, 'partial');
  assert.equal(out.completion?.truncated, true);
});

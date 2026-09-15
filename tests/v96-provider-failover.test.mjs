import test from 'node:test';
import assert from 'node:assert/strict';
import gateway, { ROLE_MODEL_BOARD, isProviderErrorText, MODEL_BOARD_VERSION } from '../server/office-multifree.mjs';

test('V9.6 removes exhausted Pollinations from every active route', () => {
  assert.equal(MODEL_BOARD_VERSION, '2026-09-15-v3');
  for (const row of Object.values(ROLE_MODEL_BOARD)) {
    assert.ok(row.route.length >= 2);
    assert.equal(row.route.some(step => step.provider === 'Pollinations'), false);
    assert.ok(row.route.every(step => ['BlockRun', 'Vireonix'].includes(step.provider)));
  }
});

test('V9.6 recognises Pollinations budget text returned as a successful-looking answer', () => {
  assert.equal(isProviderErrorText('The API key used for this request has reached its budget. Please raise the key budget, then try again.'), true);
  assert.equal(isProviderErrorText('Topping up the wallet does not raise this limit.'), true);
});

test('Provider-error detector does not reject a normal model answer', () => {
  assert.equal(isProviderErrorText('La soluzione consigliata è usare il fallback gratuito e registrare il provider effettivo.'), false);
});

test('HTTP 200 provider-budget text is rejected and the next free provider is used', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (calls.length === 1) return new Response(JSON.stringify({
        choices: [{ message: { content: 'The API key used for this request has reached its budget. Please raise the key budget, then try again.' } }],
        model: 'fake-primary',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Risposta sana dal fallback gratuito.' } }],
        model: 'fallback-model',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const response = await gateway.fetch(new Request('https://office.invalid/v1/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'budget-failover', text: 'Test fallback', team: ['Direttore'] }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, 'Vireonix');
    assert.equal(body.result, 'Risposta sana dal fallback gratuito.');
    assert.equal(body.failures[0].provider, 'BlockRun');
    assert.match(body.failures[0].error, /budget gratuito non disponibile/);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = previous; }
});

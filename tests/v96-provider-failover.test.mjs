import test from 'node:test';
import assert from 'node:assert/strict';
import gateway, { ROLE_MODEL_BOARD, isProviderErrorText, MODEL_BOARD_VERSION } from '../server/office-multifree.mjs';

test('V10.0.2 excludes exhausted or paid providers from every active zero-cost route', () => {
  assert.equal(MODEL_BOARD_VERSION, '2026-09-15-v4');
  for (const row of Object.values(ROLE_MODEL_BOARD)) {
    assert.ok(row.route.length >= 1);
    assert.equal(row.route.some(step => step.provider === 'Pollinations'), false);
    assert.equal(row.route.some(step => step.provider === 'BlockRun'), false);
    assert.ok(row.route.every(step => step.provider === 'Vireonix'));
  }
});

test('V9.6 recognises Pollinations budget text returned as a successful-looking answer', () => {
  assert.equal(isProviderErrorText('The API key used for this request has reached its budget. Please raise the key budget, then try again.'), true);
  assert.equal(isProviderErrorText('Topping up the wallet does not raise this limit.'), true);
});

test('Provider-error detector does not reject a normal model answer', () => {
  assert.equal(isProviderErrorText('La soluzione consigliata è usare il fallback gratuito e registrare il provider effettivo.'), false);
});

test('A provider-budget message returned with HTTP 200 is rejected and never presented as an answer', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'The API key used for this request has reached its budget. Please raise the key budget, then try again.' } }],
        model: 'fake-provider',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const response = await gateway.fetch(new Request('https://office.invalid/v1/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'budget-failover', text: 'Test provider error', team: ['Direttore'] }),
    }));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.zeroCost, true);
    assert.equal(body.retryable, true);
    assert.equal(body.failures[0].provider, 'Vireonix');
    assert.match(body.failures[0].error, /pagamento o budget non disponibile|non disponibile/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});

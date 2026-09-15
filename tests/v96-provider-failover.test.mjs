import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_MODEL_BOARD, isProviderErrorText, MODEL_BOARD_VERSION } from '../server/office-multifree.mjs';

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

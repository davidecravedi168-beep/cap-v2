import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_API } from '../src/core.mjs';
import { OPENROUTER_MODEL, OPENROUTER_SESSION_KEY, OPENROUTER_URL, isOpenRouterProviderErrorText, normaliseOpenRouterKey } from '../src/free-fallback.mjs';

class MemorySession {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

test('V10.0.2 pins the optional BYOK fallback to OpenRouter free', () => {
  assert.equal(OPENROUTER_MODEL, 'openrouter/free');
  assert.equal(OPENROUTER_URL, 'https://openrouter.ai/api/v1/chat/completions');
  assert.match(normaliseOpenRouterKey('sk-or-v1-example_key_1234567890'), /^sk-or-/);
  assert.throws(() => normaliseOpenRouterKey('paid-provider-key'), /sk-or-/);
  assert.equal(isOpenRouterProviderErrorText('insufficient credits'), true);
  assert.equal(isOpenRouterProviderErrorText('Spiega come funzionano i crediti formativi universitari.'), false);
});

test('V10.0.2 retries a public-gateway 503 through OpenRouter Free and nowhere else', async () => {
  const previousFetch = globalThis.fetch;
  const previousSession = globalThis.sessionStorage;
  const session = new MemorySession();
  session.setItem(OPENROUTER_SESSION_KEY, 'sk-or-v1-test_key_abcdefghijklmnopqrstuvwxyz');
  globalThis.sessionStorage = session;
  const calls = [];
  try {
    globalThis.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push({ url, init });
      if (url === `${LEGACY_API}/v1/jobs`) {
        return new Response(JSON.stringify({ status: 'failed', zeroCost: true, retryable: true, error: 'free-engines-unavailable' }), {
          status: 503, headers: { 'content-type': 'application/json' },
        });
      }
      if (url === OPENROUTER_URL) {
        assert.equal(init.headers.Authorization, 'Bearer sk-or-v1-test_key_abcdefghijklmnopqrstuvwxyz');
        const request = JSON.parse(init.body);
        assert.equal(request.model, 'openrouter/free');
        assert.equal(request.messages.at(-1).content, 'Test resilienza');
        return new Response(JSON.stringify({
          model: 'nvidia/nemotron-3-super:free',
          choices: [{ message: { content: 'Fallback gratuito riuscito.' } }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw Error(`Unexpected URL ${url}`);
    };
    await import('../src/free-fallback-ui.mjs?v1002-test');
    const response = await globalThis.fetch(`${LEGACY_API}/v1/jobs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'v1002', text: 'Test resilienza', team: ['Direttore'], zeroCost: true }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.zeroCost, true);
    assert.equal(body.provider, 'OpenRouter Free');
    assert.equal(body.model, 'nvidia/nemotron-3-super:free');
    assert.equal(body.result, 'Fallback gratuito riuscito.');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(c => c.url), [`${LEGACY_API}/v1/jobs`, OPENROUTER_URL]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSession === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousSession;
  }
});

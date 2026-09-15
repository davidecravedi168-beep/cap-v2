import test from 'node:test';
import assert from 'node:assert/strict';
import gateway, { MODEL_BOARD_VERSION, isTruncatedFinishReason } from '../server/office-multifree.mjs';
import { OPENROUTER_SESSION_KEY, OPENROUTER_URL, openRouterFreeFallback } from '../src/free-fallback.mjs';

const VIREONIX_URL = 'https://vireonix.ai/v1/chat/completions';

function gatewayRequest(id = 'v1005-test') {
  return new Request('https://example.test/v1/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://davidecravedi168-beep.github.io' },
    body: JSON.stringify({ id, text: 'Spiega il piano in modo completo.', team: ['Direttore'], zeroCost: true, intent: 'draft-only' }),
  });
}

class MemorySession {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

test('V10.0.5 recognises provider length finish reasons', () => {
  assert.equal(MODEL_BOARD_VERSION, '2026-09-15-v5');
  assert.equal(isTruncatedFinishReason('length'), true);
  assert.equal(isTruncatedFinishReason('max_tokens'), true);
  assert.equal(isTruncatedFinishReason('stop'), false);
});

test('V10.0.5 public gateway repairs a truncated answer before declaring completion', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, init = {}) => {
      assert.equal(url, VIREONIX_URL);
      const body = JSON.parse(init.body);
      calls.push(body);
      if (calls.length === 1) {
        return new Response(JSON.stringify({ model: 'vireonix/free-a', choices: [{ message: { content: 'Bozza che finisce a metà' }, finish_reason: 'length' }] }), { status: 200 });
      }
      assert.match(body.messages.at(-1).content, /Riscrivi DA CAPO/i);
      return new Response(JSON.stringify({ model: 'vireonix/free-a', choices: [{ message: { content: 'Risposta completa e conclusa.' }, finish_reason: 'stop' }] }), { status: 200 });
    };
    const response = await gateway.fetch(gatewayRequest('v1005-repair'));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.status, 'completed');
    assert.equal(data.result, 'Risposta completa e conclusa.');
    assert.equal(data.completion.state, 'recovered');
    assert.equal(data.completion.recoveryAttempted, true);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('V10.0.5 never labels a twice-truncated public answer completed', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({
        model: 'vireonix/free-a',
        choices: [{ message: { content: calls === 1 ? 'Prima bozza tronca.' : 'Seconda bozza ancora tronca.' }, finish_reason: 'length' }],
      }), { status: 200 });
    };
    const response = await gateway.fetch(gatewayRequest('v1005-partial'));
    const data = await response.json();
    assert.equal(data.status, 'partial');
    assert.equal(data.completion.state, 'truncated');
    assert.equal(data.contributions[0].truncated, true);
    assert.match(data.qualityReport, /marcato parziale/i);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('V10.0.5 OpenRouter Free also repairs length-truncated output', async () => {
  const session = new MemorySession();
  session.setItem(OPENROUTER_SESSION_KEY, 'sk-or-v1-test_key_abcdefghijklmnopqrstuvwxyz');
  const calls = [];
  const fetcher = async (url, init = {}) => {
    assert.equal(url, OPENROUTER_URL);
    calls.push(JSON.parse(init.body));
    if (calls.length === 1) {
      return new Response(JSON.stringify({ model: 'free/model-a', choices: [{ message: { content: 'Risposta iniziale tronca.' }, finish_reason: 'length' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ model: 'free/model-b', choices: [{ message: { content: 'Risposta finale completa.' }, finish_reason: 'stop' }] }), { status: 200 });
  };
  const result = await openRouterFreeFallback({ text: 'Dammi una risposta completa', agent: 'Sage', fetcher, storage: session });
  assert.equal(result.status, 'completed');
  assert.equal(result.result, 'Risposta finale completa.');
  assert.equal(result.completion.state, 'recovered');
  assert.equal(calls.length, 2);
  assert.match(calls[1].messages.at(-1).content, /Riscrivi DA CAPO/i);
});

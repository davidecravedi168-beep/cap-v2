import test from 'node:test';
import assert from 'node:assert/strict';
import { openRouterFreeFallback } from '../src/free-fallback.mjs';
import publicGateway from '../server/office-multifree.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function jobRequest(text = 'Completa questa richiesta') {
  return new Request('https://office.test/v1/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://davidecravedi168-beep.github.io' },
    body: JSON.stringify({ id: 'v1005-test', text, team: ['Direttore'], zeroCost: true, intent: 'draft-only' }),
  });
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

test('V10.0.5 public Vireonix gateway continues truncated output and reports completion metadata', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (_url, init) => {
      calls.push(JSON.parse(init.body));
      if (calls.length === 1) return jsonResponse({
        model: 'vireonix-free',
        choices: [{ finish_reason: 'length', message: { content: 'Risposta interrotta' } }],
      });
      return jsonResponse({
        model: 'vireonix-free',
        choices: [{ finish_reason: 'stop', message: { content: ' e poi completata.' } }],
      });
    };
    const response = await publicGateway.fetch(jobRequest());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'completed');
    assert.equal(body.completion.continued, true);
    assert.equal(body.completion.truncated, false);
    assert.match(body.result, /Risposta interrotta e poi completata\./);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('V10.0.5 public gateway performs one bounded retry after a transient provider failure', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return jsonResponse({ error: { message: 'temporarily overloaded' } }, 503);
      return jsonResponse({
        model: 'vireonix-free',
        choices: [{ finish_reason: 'stop', message: { content: 'Secondo tentativo completato.' } }],
      });
    };
    const response = await publicGateway.fetch(jobRequest('Rispondi anche se il primo tentativo fallisce'));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'completed');
    assert.equal(body.result, 'Secondo tentativo completato.');
    assert.equal(body.failures.length, 1);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('V10.0.5 public gateway marks a second truncation partial instead of completed', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return jsonResponse({
        model: 'vireonix-free',
        choices: [{ finish_reason: 'length', message: { content: calls === 1 ? 'Parte A' : ' Parte B' } }],
      });
    };
    const response = await publicGateway.fetch(jobRequest('Genera una risposta lunga'));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'partial');
    assert.equal(body.completion.truncated, true);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

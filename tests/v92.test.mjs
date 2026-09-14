import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from '../src/core.mjs';
import { Runtime } from '../src/runtime.mjs';
import { lightConversation } from '../src/light-conversation.mjs';

const storage = () => { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) }; };

test('Light conversation recognises only trivial greetings and check-ins', () => {
  assert.equal(lightConversation('Come va?').intent, 'check-in');
  assert.equal(lightConversation('Ci sei?').intent, 'availability');
  assert.equal(lightConversation('Ciao!').intent, 'greeting');
  assert.equal(lightConversation('Ciao, analizza il repository e correggi il bug'), null);
  assert.equal(lightConversation('Come va il deploy di GitHub Pages?'), null);
});

test('Come va is answered locally with zero AI, tool and network calls', async () => {
  const ws = new Workspace(storage());
  const job = ws.add('Come va?');
  let calls = 0;
  const runtime = new Runtime(ws, { locks: null, fetcher: async () => { calls++; throw Error('network must not be called'); } });
  await runtime.pump();
  const out = ws.state.jobs.find(j => j.id === job.id);
  assert.equal(calls, 0);
  assert.equal(out.status, 'completed');
  assert.equal(out.mode, 'local');
  assert.match(out.result, /operativo/i);
  assert.equal(out.provenance.provider, 'LOCAL');
  assert.equal(out.review.status, 'not-needed');
  assert.equal(out.externalActions, false);
  assert.equal(ws.state.events.some(e => e.type === 'local-conversation'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRuntime, TOOL_POLICY } from '../src/tool-runtime.mjs';
import { Workspace } from '../src/core.mjs';
import { roundtable } from '../src/roundtable.mjs';

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) }; };
const office = () => new Workspace(memoryStorage());

test('Tool Runtime exposes safe policy and never claims unavailable writes', () => {
  const tools = new ToolRuntime({ storage: memoryStorage(), fetcher: async () => { throw Error('unused'); } });
  const manifest = tools.manifest();
  assert.equal(TOOL_POLICY.read, 'auto');
  assert.equal(TOOL_POLICY.externalWrite, 'approval-required');
  assert.equal(manifest.find(t => t.id === 'github.repo-status').available, true);
  assert.equal(manifest.find(t => t.id === 'github.write').available, false);
  assert.equal(manifest.find(t => t.id === 'tests.run').available, false);
});

test('Tool Runtime returns verified GitHub metadata and records audit', async () => {
  const storage = memoryStorage();
  const tools = new ToolRuntime({ storage, fetcher: async url => {
    assert.match(url, /api\.github\.com\/repos\/davidecravedi168-beep\/cap-v2/);
    return new Response(JSON.stringify({ default_branch: 'main', updated_at: '2026-09-14T00:00:00Z', pushed_at: '2026-09-14T00:00:00Z', open_issues_count: 2, archived: false, visibility: 'public', html_url: 'https://github.com/davidecravedi168-beep/cap-v2' }), { status: 200 });
  } });
  const out = await tools.repoStatus();
  assert.equal(out.verifiedBy, 'github-api');
  assert.equal(out.defaultBranch, 'main');
  assert.equal(tools.readAudit()[0].ok, true);
  assert.equal(tools.readAudit()[0].tool, 'github.repo-status');
});

test('Tool Runtime blocks arbitrary repositories', async () => {
  const tools = new ToolRuntime({ storage: memoryStorage(), fetcher: async () => new Response('{}', { status: 200 }) });
  await assert.rejects(tools.repoStatus('other-owner/private-repo'), /non autorizzato/);
});

test('A revise verdict triggers Director correction and a second Verity review', async () => {
  const ws = office();
  const job = ws.add('Confronta due alternative', { reviewMode: 'roundtable' });
  const calls = [];
  const result = await roundtable(job, async (agent, prompt) => {
    calls.push(`${agent}:${prompt.includes('corretta dopo il primo WARN') ? 're-review' : prompt.includes('Correggi concretamente') ? 'revision' : 'normal'}`);
    if (agent === 'Verity' && prompt.includes('corretta dopo il primo WARN')) {
      return { agent, provider: 'test', model: 'review-model', text: JSON.stringify({ verdict: 'pass', issues: [], summary: 'Correzione riuscita' }) };
    }
    if (agent === 'Verity') {
      return { agent, provider: 'test', model: 'review-model', text: JSON.stringify({ verdict: 'revise', issues: ['Manca il limite principale'], summary: 'Da correggere' }) };
    }
    if (agent === 'Direttore' && prompt.includes('Correggi concretamente')) {
      return { agent, provider: 'test', model: 'writer-model', text: 'Risposta corretta con limite esplicito.' };
    }
    return { agent, provider: 'test', model: 'writer-model', text: `Contributo di ${agent}` };
  }, { context: job.text });

  assert.equal(result.result, 'Risposta corretta con limite esplicito.');
  assert.equal(result.review.autoCorrected, true);
  assert.equal(result.review.secondPass, true);
  assert.equal(result.review.status, 'pass');
  assert.equal(result.status, 'completed');
  assert.ok(calls.some(v => v === 'Direttore:revision'));
  assert.ok(calls.some(v => v === 'Verity:re-review'));
});

test('A reject verdict blocks approval gate instead of auto-correcting', async () => {
  const ws = office();
  const job = ws.add('Valuta una proposta', { reviewMode: 'roundtable' });
  let revisionCalls = 0;
  const result = await roundtable(job, async (agent, prompt) => {
    if (prompt.includes('Correggi concretamente')) revisionCalls++;
    if (agent === 'Verity') return { agent, provider: 'test', model: 'review-model', text: JSON.stringify({ verdict: 'reject', issues: ['Azione critica non supportata'], summary: 'Blocco necessario' }) };
    return { agent, provider: 'test', model: 'writer-model', text: `Contributo di ${agent}` };
  }, { context: job.text });
  assert.equal(revisionCalls, 0);
  assert.equal(result.review.status, 'reject');
  assert.equal(result.review.approvalGate, 'blocked');
  assert.equal(result.status, 'partial');
});

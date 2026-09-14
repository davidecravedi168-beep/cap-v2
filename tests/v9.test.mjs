import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRuntime, TOOL_POLICY } from '../src/tool-runtime.mjs';
import { CostPolicy } from '../src/cost-policy.mjs';
import { Workspace } from '../src/core.mjs';
import { roundtable } from '../src/roundtable.mjs';

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) }; };
const office = () => new Workspace(memoryStorage());

test('Tool Runtime exposes safe policy and never claims unavailable writes', () => {
  const tools = new ToolRuntime({ storage: memoryStorage(), fetcher: async () => { throw Error('unused'); } });
  const manifest = tools.manifest();
  assert.equal(TOOL_POLICY.read, 'auto');
  assert.equal(TOOL_POLICY.externalWrite, 'approval-required');
  assert.equal(TOOL_POLICY.externalCredits, 'deny-by-default');
  assert.equal(manifest.find(t => t.id === 'github.repo-status').available, true);
  assert.equal(manifest.find(t => t.id === 'github.write').available, false);
  assert.equal(manifest.find(t => t.id === 'tests.run').available, false);
  assert.equal(manifest.find(t => t.id === 'cost.guard').available, true);
});

test('Zero-credit Cost Guard hard-blocks Bolt and StackBlitz before network use', () => {
  const policy = new CostPolicy();
  for (const service of ['bolt', 'bolt.new', 'https://bolt.new/', 'stackblitz', 'stackblitz bolt']) {
    assert.throws(() => policy.assert({ service, zeroCost: true, estimatedCredits: 0 }), error => error?.code === 'COST_POLICY_DENY');
  }
  assert.equal(policy.snapshot().externalCreditBudget, 0);
});

test('Zero-credit Cost Guard blocks any metered external call but allows declared free infrastructure', () => {
  const policy = new CostPolicy();
  assert.throws(() => policy.assert({ service: 'other-ai', zeroCost: false, metered: true, estimatedCredits: 1 }), /budget esterno autorizzato è zero/);
  assert.equal(policy.assert({ service: 'github-api', zeroCost: true, metered: false, estimatedCredits: 0 }).allowed, true);
  assert.equal(policy.assert({ service: 'office-public-gateway', zeroCost: true, metered: false, estimatedCredits: 0 }).allowed, true);
});

test('Tool Runtime records a denied Bolt attempt without calling fetch', async () => {
  const storage = memoryStorage(); let calls = 0;
  const tools = new ToolRuntime({ storage, fetcher: async () => { calls++; return new Response('{}', { status: 200 }); } });
  assert.throws(() => tools.assertExternalCall({ service: 'bolt.new', zeroCost: true, estimatedCredits: 0 }), /bloccato/);
  assert.equal(calls, 0);
  assert.equal(tools.readAudit()[0].tool, 'cost.guard');
  assert.equal(tools.readAudit()[0].ok, false);
});

test('GitHub change preparation is local-only, zero-credit and requires human approval to execute', () => {
  const tools = new ToolRuntime({ storage: memoryStorage(), fetcher: async () => { throw Error('unused'); } });
  const packet = tools.prepareGithubChange({
    branch: 'office/test-change',
    title: 'Test change',
    changes: [{ path: 'src/runtime.mjs', operation: 'update' }, { path: 'tests/v9.test.mjs', operation: 'update' }],
  });
  assert.equal(packet.status, 'proposed');
  assert.equal(packet.externalActionExecuted, false);
  assert.equal(packet.requiresHumanApproval, true);
  assert.equal(packet.execution, 'secure-connector-required');
  assert.equal(packet.estimatedExternalCredits, 0);
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
  assert.equal(tools.readAudit().some(row => row.tool === 'github.repo-status' && row.ok === true), true);
  assert.equal(tools.readAudit().some(row => row.tool === 'cost.guard' && row.ok === true), true);
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

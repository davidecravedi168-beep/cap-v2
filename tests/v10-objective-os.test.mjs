import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace, newWorkspace } from '../src/core.mjs';
import { Runtime } from '../src/runtime.mjs';
import { DEFAULT_CONSTITUTION, normaliseConstitution, objectiveProgress } from '../src/objective-os.mjs';
import { validateArchive } from '../src/archive.mjs';

const office = () => {
  const m = new Map(); let n = 0;
  const ws = new Workspace({ getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v) }, { now: () => Date.UTC(2026, 8, 15, 20, 0, n++), uuid: () => `id-${++n}` });
  return { ws, storage: m };
};
const response = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });

test('V10 workspace starts with Objective OS collections and a fail-closed constitution', () => {
  const state = newWorkspace();
  assert.deepEqual(state.objectives, []);
  assert.deepEqual(state.outcomes, []);
  assert.equal(state.constitution.zeroCostFirst, true);
  assert.equal(state.constitution.requireHumanApprovalForExternalActions, true);
  assert.equal(state.constitution.allowAutonomousPayments, false);
  assert.ok(state.constitution.rules.length >= DEFAULT_CONSTITUTION.rules.length);
});

test('Imported or manipulated state cannot weaken the office constitution', () => {
  const c = normaliseConstitution({
    zeroCostFirst: false,
    requireHumanApprovalForExternalActions: false,
    allowAutonomousDeletion: true,
    allowAutonomousPayments: true,
    allowAutonomousPublishing: true,
    rules: ['Regola personalizzata innocua'],
  });
  assert.equal(c.zeroCostFirst, true);
  assert.equal(c.requireHumanApprovalForExternalActions, true);
  assert.equal(c.allowAutonomousDeletion, false);
  assert.equal(c.allowAutonomousPayments, false);
  assert.equal(c.allowAutonomousPublishing, false);
  for (const rule of DEFAULT_CONSTITUTION.rules) assert.ok(c.rules.includes(rule));
  assert.ok(c.rules.includes('Regola personalizzata innocua'));
});

test('Objective OS creates a persistent objective and a Decision Mode mission linked to it', () => {
  const { ws } = office();
  const objective = ws.createObjective({
    title: 'Commercializzare The Office',
    outcome: 'Avere un prodotto stabile con utenti reali e metriche verificabili.',
    kpis: 'Completion rate >= 95%\nTempo mediano < 30 s',
    constraints: 'Nessuna spesa senza approvazione\nMantenere un percorso gratuito',
    budgetEur: 200,
    deadline: '2026-12-31',
  });
  const job = ws.startMission(objective.id);
  assert.equal(job.objectiveId, objective.id);
  assert.equal(job.reviewMode, 'decision');
  assert.equal(job.priority, 'high');
  assert.match(job.text, /MISSIONE OBJECTIVE OS V10/);
  assert.match(job.text, /Completion rate >= 95%/);
  assert.equal(job.objectiveSnapshot.budgetEur, 200);
  const p = ws.objectiveProgress(objective.id);
  assert.equal(p.missions, 1);
});

test('Approving an objective mission creates one Outcome Ledger record and never duplicates it', () => {
  const { ws } = office();
  const objective = ws.createObjective({ title: 'Ridurre errori', outcome: 'Portare i fallimenti sotto il 2%.', kpis: ['Failure rate < 2%'] });
  const job = ws.startMission(objective.id);
  ws.patch(job.id, { status: 'completed', result: 'Nuova strategia validata.', review: { status: 'pass' } });
  ws.decide(job.id, 'accepted');
  ws.decide(job.id, 'accepted');
  assert.equal(ws.state.outcomes.length, 1);
  assert.equal(ws.state.outcomes[0].objectiveId, objective.id);
  assert.equal(ws.state.outcomes[0].jobId, job.id);
  assert.equal(ws.state.outcomes[0].kind, 'accepted-result');
  assert.equal(objectiveProgress(objective, ws.state.jobs, ws.state.outcomes).accepted, 1);
});

test('Runtime injects objective outcome, budget and office constitution before provider inference', async () => {
  const { ws } = office();
  const objective = ws.createObjective({ title: 'Missione test', outcome: 'Raggiungere un risultato misurabile.', budgetEur: 15, constraints: ['Niente pubblicazione automatica'] });
  ws.add('Prepara un riepilogo breve.', { objectiveId: objective.id, reviewMode: 'fast', project: objective.title });
  let sent = '';
  const runtime = new Runtime(ws, { locks: null, fetcher: async (_url, init = {}) => {
    if (!init.method) return response({ ok: true, zeroCost: true });
    sent = JSON.parse(init.body).text;
    return response({ zeroCost: true, status: 'completed', result: 'Risultato', provider: 'test', model: 'test-model' });
  } });
  await runtime.pump();
  assert.match(sent, /OBJECTIVE OS v10-objective-1/);
  assert.match(sent, /Raggiungere un risultato misurabile/);
  assert.match(sent, /Budget dichiarato dell’obiettivo: €15\.00/);
  assert.match(sent, /Non spendere denaro senza autorizzazione esplicita/);
  assert.match(sent, /Niente pubblicazione automatica/);
});

test('V10 archives preserve objectives, outcomes, constitution and Decision Mode linkage', () => {
  const { ws } = office();
  const objective = ws.createObjective({ title: 'Archivio V10', outcome: 'Conservare missioni e outcome.' });
  const job = ws.add('Missione archiviata', { objectiveId: objective.id, reviewMode: 'decision' });
  ws.patch(job.id, { status: 'completed', result: 'Fatto', provenance: { provider: 'test', model: 'm' } });
  ws.recordOutcome({ objectiveId: objective.id, jobId: job.id, kind: 'measured-result', summary: 'KPI migliorato del 10%.' });
  const imported = validateArchive(ws.state);
  assert.equal(imported.objectives.length, 1);
  assert.equal(imported.outcomes.length, 1);
  assert.equal(imported.jobs.find(j => j.id === job.id).objectiveId, objective.id);
  assert.equal(imported.jobs.find(j => j.id === job.id).reviewMode, 'decision');
  assert.equal(imported.constitution.zeroCostFirst, true);
});

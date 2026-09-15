import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from '../src/core.mjs';
import { directObjectiveBrief, objectiveMissionPolicy } from '../src/intent-aware.mjs';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
}

function workspace() {
  let n = 0;
  return new Workspace(memoryStorage(), {
    now: () => Date.parse('2026-09-15T20:57:00Z'),
    uuid: () => `id-${++n}`,
  });
}

test('V10.0.3 recognises the 10-to-200 prompt as a direct financial question', () => {
  const objective = {
    title: 'Se ti do 10 euro riesci a farli diventare 200?',
    outcome: 'Capire cosa è realisticamente possibile con 10 euro.',
    budgetEur: 10,
  };
  const policy = objectiveMissionPolicy(objective);
  assert.equal(policy.mode, 'direct');
  assert.equal(policy.reviewMode, 'fast');
  assert.equal(policy.specialist, 'Ledger');
});

test('V10.0.3 does not treat Objective metadata budget as the user intent', () => {
  const ws = workspace();
  const objective = ws.createObjective({
    title: 'Preparare una comunicazione cliente',
    outcome: 'Scrivi una email professionale e sintetica per comunicare il nuovo servizio.',
    budgetEur: 10,
    deadline: '2026-09-20',
  });
  const job = ws.startMission(objective.id);
  assert.notEqual(job.plan.kind, 'Analisi numerica');
  assert.equal(job.plan.kind, 'Scrittura e documenti');
});

test('V10.0.3 direct Objective mission uses one specialist and no Decision contract', () => {
  const ws = workspace();
  const objective = ws.createObjective({
    title: 'Se ti do 10 euro riesci a farli diventare 200?',
    outcome: 'Voglio capire le opzioni realistiche e i rischi, senza promesse di rendimento.',
    budgetEur: 10,
    deadline: '2026-09-20',
  });
  const job = ws.startMission(objective.id);
  assert.equal(job.reviewMode, 'fast');
  assert.equal(job.objectiveMissionMode, 'direct');
  assert.deepEqual(job.plan.team, ['Ledger']);
  assert.equal(job.plan.kind, 'Risposta diretta');
  assert.match(job.text, /Rispondi subito alla richiesta principale/i);
  assert.doesNotMatch(job.text, /nessun KPI dichiarato/i);
  assert.doesNotMatch(job.text, /DECISION MODE/i);
});

test('V10.0.3 strategic product objective still keeps Decision Mode', () => {
  const ws = workspace();
  const objective = ws.createObjective({
    title: 'Rendere The Office commercializzabile',
    outcome: 'Definire strategia, posizionamento competitivo, roadmap e rischi rispetto ai competitor.',
    budgetEur: 10,
  });
  const job = ws.startMission(objective.id);
  assert.equal(job.reviewMode, 'decision');
  assert.equal(job.objectiveMissionMode, 'decision');
  assert.notEqual(job.plan.kind, 'Analisi numerica');
});

test('V10.0.3 direct brief makes missing KPI non-blocking', () => {
  const objective = { outcome: 'Capire la fattibilità.', budgetEur: 0 };
  const brief = directObjectiveBrief(objective, { seed: 'Posso farlo?', specialist: 'Sage' });
  assert.match(brief, /KPI, scadenza o vincoli mancanti NON sono da soli un motivo/i);
  assert.match(brief, /Chiedi un chiarimento solo se/i);
});

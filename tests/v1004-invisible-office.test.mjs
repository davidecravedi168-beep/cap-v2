import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Workspace } from '../src/core.mjs';
import { directObjectiveBrief } from '../src/intent-aware.mjs';
import { presentationPolicy, visibleJobText } from '../src/presentation.mjs';

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
    now: () => Date.parse('2026-09-15T21:05:00Z'),
    uuid: () => `id-${++n}`,
  });
}

test('V10.0.4 direct answer keeps the user request separate from the internal brief', () => {
  const ws = workspace();
  const objective = ws.createObjective({
    title: 'Se ti do 10 euro riesci a farli diventare 200?',
    outcome: 'Capire cosa è realisticamente possibile.',
    budgetEur: 10,
  });
  const job = ws.startMission(objective.id);
  assert.equal(job.outputMode, 'direct');
  assert.equal(job.displayText, 'Se ti do 10 euro riesci a farli diventare 200?');
  assert.equal(visibleJobText(job), job.displayText);
  assert.notEqual(job.text, job.displayText);
});

test('V10.0.4 direct presentation hides office bureaucracy but keeps technical detail available', () => {
  const policy = presentationPolicy({ outputMode: 'direct' });
  assert.equal(policy.mode, 'direct');
  assert.equal(policy.showReviewBanner, false);
  assert.equal(policy.showDecisionDesk, false);
  assert.equal(policy.showPlan, false);
  assert.equal(policy.technicalLabel, 'Dettagli tecnici');
});

test('V10.0.4 full missions retain governance presentation', () => {
  const policy = presentationPolicy({ outputMode: 'decision' });
  assert.equal(policy.mode, 'full');
  assert.equal(policy.showReviewBanner, true);
  assert.equal(policy.showDecisionDesk, true);
  assert.equal(policy.showPlan, true);
});

test('V10.0.4 direct prompt asks for a natural answer and suppresses internal vocabulary', () => {
  const brief = directObjectiveBrief(
    { outcome: 'Valutare opzioni realistiche.', budgetEur: 10 },
    { seed: 'Se ti do 10 euro riesci a farli diventare 200?', specialist: 'Ledger' },
  );
  assert.match(brief, /prime una o due frasi/i);
  assert.match(brief, /assistente competente e naturale/i);
  assert.match(brief, /Non nominare Objective OS, Costituzione, KPI, team, specialisti, provider/i);
  assert.match(brief, /ipotesi ragionevole e a basso rischio/i);
});

test('V10.0.4 UI loads the invisible presentation layer and hides direct-only bureaucracy', async () => {
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/invisible-office.mjs', import.meta.url), 'utf8');
  const presentation = await readFile(new URL('../src/presentation.mjs', import.meta.url), 'utf8');
  assert.match(index, /src\/invisible-office\.mjs/);
  assert.match(source, /review-state/);
  assert.match(source, /decision-desk/);
  assert.match(source, /Piano proposto e confini dell’incarico/);
  assert.match(presentation, /Dettagli tecnici/);
});

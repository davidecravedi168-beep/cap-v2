import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHybridPrompt, parseHybridDossier, personasFromDossier, createHybridRunner } from '../src/simulation-hybrid.mjs';

test('buildHybridPrompt asks for requested persona count and no fake external evidence', () => {
  const prompt = buildHybridPrompt({ question: 'Se lanciamo il prodotto a 9 euro cosa succede?', personaCount: 6 });
  assert.match(prompt, /crea 6 personas/i);
  assert.match(prompt, /senza fingere accesso a fonti esterne/i);
});

test('parseHybridDossier accepts fenced JSON and normalizes values', () => {
  const raw = '```json\n' + JSON.stringify({
    thesis: 'Test',
    personas: [
      { id: 'a', role: 'Cliente', stance: 2, confidence: 1.2, rationale: 'A' },
      { id: 'b', role: 'Scettico', stance: -2, confidence: 0, rationale: 'B' },
      { id: 'c', role: 'Builder', stance: 0.2, confidence: 0.7, rationale: 'C' },
      { id: 'd', role: 'Operatore', stance: 0.1, confidence: 0.6, rationale: 'D' },
    ],
    scenarioBranches: [{ label: 'Base', weight: 0.5 }],
    evidenceGaps: ['Dati reali'],
  }) + '\n```';
  const dossier = parseHybridDossier(raw, { personaCount: 4 });
  assert.equal(dossier.personas.length, 4);
  assert.equal(dossier.personas[0].stance, 1);
  assert.equal(dossier.personas[0].confidence, 1);
  assert.equal(dossier.personas[1].stance, -1);
  assert.equal(dossier.personas[1].confidence, 0.45);
  assert.deepEqual(dossier.evidenceGaps, ['Dati reali']);
});

test('personasFromDossier and hybrid runner stay bounded', () => {
  const dossier = {
    personas: [
      { id: 'a', role: 'A', stance: 0.8, confidence: 0.7, rationale: 'A', risks: [], unknowns: [] },
      { id: 'b', role: 'B', stance: -0.4, confidence: 0.4, rationale: 'B', risks: ['x'], unknowns: ['y'] },
    ],
  };
  const agents = personasFromDossier(dossier, 2);
  const runner = createHybridRunner(dossier);
  const out = runner({ agent: agents[1], random: 0.99, round: 4 });
  assert.ok(out.stance >= -1 && out.stance <= 1);
  assert.ok(out.confidence > 0 && out.confidence <= 1);
  assert.ok(out.flags.some(flag => flag.startsWith('risk:')));
});

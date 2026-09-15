import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SimulationEngine,
  brierScore,
  branchScenario,
  calibrationBins,
  createDefaultPersonas,
  createScenario,
  realityCheck,
  seededRandom,
} from '../src/simulation-engine.mjs';

test('V10.1 seeded simulation randomness is reproducible', () => {
  const a = seededRandom('same-seed');
  const b = seededRandom('same-seed');
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()]);
});

test('V10.1 scenario keeps facts separate from assumptions and branches cleanly', () => {
  const base = createScenario({
    id: 'launch',
    question: 'Will this product concept survive a demanding launch test?',
    assumptions: ['Price remains unchanged'],
    evidence: [
      { id: 'fact-1', label: 'Observed retention cohort', kind: 'fact', source: 'internal dataset' },
      { id: 'guess-1', label: 'Competitor response', kind: 'assumption' },
    ],
    variables: { price: 10 },
  });
  assert.equal(base.evidence[0].kind, 'fact');
  assert.equal(base.evidence[1].kind, 'assumption');
  assert.equal(base.evidence[0].weight, 1);
  assert.ok(base.evidence[1].weight < base.evidence[0].weight);

  const branch = branchScenario(base, {
    id: 'launch-high-price',
    assumptions: ['Price rises by 20%'],
    variables: { price: 12 },
  });
  assert.equal(branch.question, base.question);
  assert.equal(branch.variables.price, 12);
  assert.equal(branch.assumptions.length, 2);
  assert.equal(branch.evidence.length, 2);
});

test('V10.1 multi-run engine converges, preserves evidence trail and exposes disagreement', async () => {
  const scenario = createScenario({
    id: 'test-scenario',
    question: 'Does the proposed workflow remain useful under several simulated perspectives?',
    evidence: [{ id: 'fact-1', label: 'Verified baseline', kind: 'fact', source: 'test fixture' }],
  });
  const agents = createDefaultPersonas(6);
  const engine = new SimulationEngine({
    agentRunner: async ({ agent }) => ({
      stance: agent.prior,
      confidence: 0.8,
      rationale: `${agent.role} checks the scenario from its own incentive set.`,
      evidenceIds: ['fact-1'],
      flags: agent.id === 'skeptic' ? ['stress-test'] : [],
    }),
  });

  const summary = await engine.run({ scenario, agents, runs: 10, rounds: 7, convergenceWindow: 3, convergenceThreshold: 0.001 });
  assert.equal(summary.runs, 10);
  assert.equal(summary.agentCount, 6);
  assert.equal(summary.convergedRuns, 10);
  assert.ok(summary.results.every(result => result.rounds === 3));
  assert.ok(summary.simulationFrequency > 0.4 && summary.simulationFrequency < 0.55);
  assert.equal(summary.evidence.factCoverage, 1);
  assert.ok(summary.disagreement > 0);
  assert.match(summary.caveat, /not a calibrated probability/i);
});

test('V10.1 calibration helpers measure historical forecasts without relabelling them as truth', () => {
  const samples = [
    { forecast: 0.9, outcome: 1 },
    { forecast: 0.7, outcome: 1 },
    { forecast: 0.3, outcome: 0 },
    { forecast: 0.2, outcome: 1 },
  ];
  const score = brierScore(samples);
  assert.ok(score > 0 && score < 0.3);
  const bins = calibrationBins(samples, 5);
  assert.equal(bins.length, 5);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), 4);

  const check = realityCheck({ simulationFrequency: 0.75 }, true);
  assert.equal(check.forecast, 0.75);
  assert.equal(check.outcome, 1);
  assert.equal(check.absoluteError, 0.25);
  assert.equal(check.brier, 0.0625);
});

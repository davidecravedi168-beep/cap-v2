const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const clean = value => String(value ?? '').trim();
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const std = values => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map(value => (value - avg) ** 2)));
};
const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * clamp(p);
  const lo = Math.floor(index), hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
};

export const EVIDENCE_KINDS = Object.freeze(['fact', 'assumption', 'simulation']);

export function seededRandom(seed = 'the-office') {
  let state = 2166136261;
  for (const char of String(seed)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }
  if (!state) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function normalizeEvidence(items = []) {
  if (!Array.isArray(items)) throw new TypeError('evidence must be an array');
  return items.map((item, index) => {
    const kind = EVIDENCE_KINDS.includes(item?.kind) ? item.kind : 'assumption';
    return {
      id: clean(item?.id) || `ev-${index + 1}`,
      label: clean(item?.label || item?.text) || `Evidence ${index + 1}`,
      kind,
      source: clean(item?.source),
      weight: clamp(item?.weight ?? (kind === 'fact' ? 1 : kind === 'assumption' ? 0.55 : 0.35)),
    };
  });
}

export function createScenario({ id, title, question, assumptions = [], evidence = [], variables = {} } = {}) {
  const prompt = clean(question);
  if (prompt.length < 8) throw new Error('A simulation scenario needs a clear question.');
  return {
    id: clean(id) || `scenario-${Date.now()}`,
    title: clean(title) || prompt.slice(0, 80),
    question: prompt,
    assumptions: Array.isArray(assumptions) ? assumptions.map(clean).filter(Boolean) : [],
    evidence: normalizeEvidence(evidence),
    variables: variables && typeof variables === 'object' && !Array.isArray(variables) ? { ...variables } : {},
    createdAt: new Date().toISOString(),
  };
}

export function branchScenario(scenario, { id, title, assumptions, evidence, variables } = {}) {
  if (!scenario?.question) throw new Error('A valid parent scenario is required.');
  return createScenario({
    id: clean(id) || `${scenario.id}-branch-${Date.now()}`,
    title: clean(title) || `${scenario.title} · branch`,
    question: scenario.question,
    assumptions: assumptions ? [...scenario.assumptions, ...assumptions] : [...scenario.assumptions],
    evidence: evidence ? [...scenario.evidence, ...evidence] : [...scenario.evidence],
    variables: { ...scenario.variables, ...(variables || {}) },
  });
}

const PERSONA_TEMPLATES = [
  ['customer', 'Customer', -0.05, 'value, simplicity and trust'],
  ['operator', 'Operator', 0.05, 'feasibility, workload and failure recovery'],
  ['competitor', 'Competitor', -0.2, 'defensibility and competitive response'],
  ['finance', 'Finance', -0.08, 'unit economics and downside protection'],
  ['skeptic', 'Skeptic', -0.28, 'weak evidence, hidden assumptions and counterexamples'],
  ['growth', 'Growth', 0.22, 'adoption, distribution and upside'],
  ['security', 'Security', -0.14, 'abuse, privacy and operational risk'],
  ['researcher', 'Researcher', 0, 'evidence quality and falsifiability'],
  ['power-user', 'Power user', 0.16, 'depth, control and advanced workflows'],
  ['new-user', 'New user', -0.02, 'clarity, onboarding and cognitive load'],
  ['regulator', 'Compliance', -0.18, 'constraints, accountability and traceability'],
  ['builder', 'Builder', 0.1, 'implementation path and maintainability'],
];

export function createDefaultPersonas(count = 8) {
  const size = Math.max(2, Math.min(PERSONA_TEMPLATES.length, Math.round(Number(count) || 8)));
  return PERSONA_TEMPLATES.slice(0, size).map(([id, role, prior, incentives]) => ({
    id,
    role,
    prior,
    incentives,
    weight: 1,
  }));
}

function normaliseAgentOutput(output, agent) {
  const stance = Math.max(-1, Math.min(1, Number(output?.stance) || 0));
  return {
    agentId: clean(agent?.id) || 'agent',
    role: clean(agent?.role),
    stance,
    support: (stance + 1) / 2,
    confidence: clamp(output?.confidence ?? 0.5),
    rationale: clean(output?.rationale),
    evidenceIds: Array.isArray(output?.evidenceIds) ? [...new Set(output.evidenceIds.map(clean).filter(Boolean))] : [],
    flags: Array.isArray(output?.flags) ? output.flags.map(clean).filter(Boolean) : [],
  };
}

function aggregateRound(outputs, agents) {
  let weighted = 0, weights = 0;
  const agentMap = new Map(agents.map(agent => [agent.id, agent]));
  for (const output of outputs) {
    const agentWeight = Math.max(0.05, Number(agentMap.get(output.agentId)?.weight) || 1);
    const weight = Math.max(0.05, output.confidence) * agentWeight;
    weighted += output.support * weight;
    weights += weight;
  }
  const support = weights ? weighted / weights : mean(outputs.map(output => output.support));
  return {
    support: clamp(support),
    disagreement: clamp(std(outputs.map(output => output.support)) * 2),
    confidence: clamp(mean(outputs.map(output => output.confidence))),
  };
}

function hasConverged(history, window, threshold) {
  if (history.length < window) return false;
  const values = history.slice(-window).map(item => item.support);
  return Math.max(...values) - Math.min(...values) <= threshold;
}

export class SimulationEngine {
  constructor({ agentRunner, maxRuns = 50, maxRounds = 20 } = {}) {
    if (typeof agentRunner !== 'function') throw new TypeError('SimulationEngine requires an agentRunner function.');
    this.agentRunner = agentRunner;
    this.maxRuns = Math.max(1, Math.round(maxRuns));
    this.maxRounds = Math.max(1, Math.round(maxRounds));
  }

  async run({ scenario, agents = createDefaultPersonas(), runs = 12, rounds = 8, seed = 'the-office', convergenceWindow = 3, convergenceThreshold = 0.025 } = {}) {
    if (!scenario?.question) throw new Error('A valid scenario is required.');
    if (!Array.isArray(agents) || agents.length < 2) throw new Error('At least two agents are required.');
    const runCount = Math.min(this.maxRuns, Math.max(1, Math.round(Number(runs) || 12)));
    const roundCount = Math.min(this.maxRounds, Math.max(1, Math.round(Number(rounds) || 8)));
    const window = Math.max(2, Math.min(roundCount, Math.round(Number(convergenceWindow) || 3)));
    const threshold = clamp(convergenceThreshold, 0.001, 0.25);
    const results = [];

    for (let runIndex = 0; runIndex < runCount; runIndex++) {
      const rng = seededRandom(`${seed}:${scenario.id}:${runIndex}`);
      const history = [];
      const trail = [];
      for (let round = 0; round < roundCount; round++) {
        const outputs = [];
        for (const agent of agents) {
          const raw = await this.agentRunner({
            scenario,
            agent: { ...agent },
            runIndex,
            round,
            priorRounds: history.map(item => ({ ...item, outputs: undefined })),
            random: rng(),
          });
          const output = normaliseAgentOutput(raw, agent);
          outputs.push(output);
          trail.push({ runIndex, round, ...output });
        }
        const aggregate = aggregateRound(outputs, agents);
        history.push({ round, ...aggregate, outputs });
        if (hasConverged(history, window, threshold)) break;
      }
      const final = history.at(-1);
      results.push({
        runIndex,
        support: final.support,
        disagreement: final.disagreement,
        confidence: final.confidence,
        rounds: history.length,
        converged: history.length >= window && hasConverged(history, window, threshold),
        history,
        trail,
      });
    }

    return summarizeSimulation({ scenario, agents, results, requestedRuns: runCount, requestedRounds: roundCount });
  }
}

export function summarizeSimulation({ scenario, agents = [], results = [], requestedRuns = results.length, requestedRounds = 0 } = {}) {
  if (!results.length) throw new Error('No simulation results to summarize.');
  const supports = results.map(result => clamp(result.support));
  const disagreements = results.map(result => clamp(result.disagreement));
  const allTrail = results.flatMap(result => result.trail || []);
  const referenced = new Set(allTrail.flatMap(item => item.evidenceIds || []));
  const factIds = new Set((scenario?.evidence || []).filter(item => item.kind === 'fact').map(item => item.id));
  const usedFacts = [...referenced].filter(id => factIds.has(id)).length;
  const frequency = mean(supports);
  const spread = std(supports);
  return {
    scenarioId: scenario?.id,
    runs: results.length,
    requestedRuns,
    requestedRounds,
    agentCount: agents.length,
    simulationFrequency: clamp(frequency),
    interval: { p10: percentile(supports, 0.1), p50: percentile(supports, 0.5), p90: percentile(supports, 0.9) },
    runSpread: spread,
    stability: clamp(1 - spread * 3),
    disagreement: clamp(mean(disagreements)),
    convergedRuns: results.filter(result => result.converged).length,
    evidence: {
      factsAvailable: factIds.size,
      factsReferenced: usedFacts,
      factCoverage: factIds.size ? clamp(usedFacts / factIds.size) : 0,
      referencedIds: [...referenced],
    },
    counterSignals: allTrail
      .filter(item => item.stance < -0.35)
      .sort((a, b) => a.stance - b.stance)
      .slice(0, 8)
      .map(item => ({ agentId: item.agentId, stance: item.stance, rationale: item.rationale, flags: item.flags })),
    results,
    caveat: 'Simulation frequency measures agreement across simulated runs. It is not a calibrated probability that the real-world outcome will occur.',
  };
}

export function brierScore(samples = []) {
  if (!Array.isArray(samples) || !samples.length) return null;
  const valid = samples.filter(item => Number.isFinite(Number(item?.forecast)) && [0, 1, false, true].includes(item?.outcome));
  if (!valid.length) return null;
  return mean(valid.map(item => (clamp(item.forecast) - Number(item.outcome)) ** 2));
}

export function calibrationBins(samples = [], binCount = 5) {
  const bins = Array.from({ length: Math.max(2, Math.min(20, Math.round(binCount) || 5)) }, (_, index) => ({
    min: index / Math.max(2, Math.min(20, Math.round(binCount) || 5)),
    max: (index + 1) / Math.max(2, Math.min(20, Math.round(binCount) || 5)),
    forecasts: [],
    outcomes: [],
  }));
  for (const sample of samples) {
    const forecast = clamp(sample?.forecast);
    if (![0, 1, false, true].includes(sample?.outcome)) continue;
    const index = Math.min(bins.length - 1, Math.floor(forecast * bins.length));
    bins[index].forecasts.push(forecast);
    bins[index].outcomes.push(Number(sample.outcome));
  }
  return bins.map(bin => ({
    min: bin.min,
    max: bin.max,
    count: bin.forecasts.length,
    meanForecast: bin.forecasts.length ? mean(bin.forecasts) : null,
    observedRate: bin.outcomes.length ? mean(bin.outcomes) : null,
  }));
}

export function realityCheck(summary, observedOutcome) {
  if (![0, 1, false, true].includes(observedOutcome)) throw new Error('Observed outcome must be true/false or 1/0.');
  const forecast = clamp(summary?.simulationFrequency);
  const outcome = Number(observedOutcome);
  return {
    forecast,
    outcome,
    absoluteError: Math.abs(forecast - outcome),
    brier: (forecast - outcome) ** 2,
    note: 'Use repeated reality checks across many comparable scenarios before treating calibration metrics as meaningful.',
  };
}

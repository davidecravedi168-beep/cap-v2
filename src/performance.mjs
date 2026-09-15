import { AGENTS, STORE_KEY } from './core.mjs';

const SPECIALISTS = AGENTS.map(a => a.id).filter(id => !['Direttore', 'Verity'].includes(id));
const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
const round = n => Math.round(n * 100) / 100;

const KIND_POOL = {
  'Incarico generale': ['Sage', 'Coda'],
  'Ricerca e verifica': ['Lumen', 'Sage'],
  'Confronto e decisione': ['Sage', 'Lumen', 'Ledger'],
  'Scrittura e documenti': ['Coda', 'Sage'],
  'Analisi numerica': ['Ledger', 'Sage', 'Aegis'],
  'Pianificazione': ['Sage', 'Coda', 'Ledger'],
  'Sviluppo': ['Coda', 'Aegis', 'Lumen'],
};

const KEYWORD_FIT = {
  Lumen: /cerc|font[ei]|verific|ricerc|evidenz|prova/i,
  Coda: /scriv|bozza|testo|document|codice|software|implement|bug|github/i,
  Mosaic: /immagin|foto|pdf|video|multimod|allegat|material/i,
  Sage: /strateg|scenario|confront|scegli|decid|alternativ|pianific|organizz/i,
  Aegis: /sicurezz|risch|permess|privacy|vulner|audit|critico/i,
  Ledger: /calcol|numer|budget|simul|rendimento|percentual|costo|finanz/i,
  Archivist: /memori|storico|archiv|recuper|ricorda|retrieval/i,
};

function localJobs() {
  try {
    const raw = globalThis.localStorage?.getItem?.(STORE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    return Array.isArray(state?.jobs) ? state.jobs : [];
  } catch { return []; }
}

function modelKey(c) {
  const provider = String(c?.provider || '').trim();
  const model = String(c?.model || '').trim();
  return provider && model ? `${provider} / ${model}` : '';
}

export function performanceBoard(jobs = []) {
  const rows = Object.fromEntries(AGENTS.map(a => [a.id, {
    agent: a.id, role: a.role, calls: 0, successes: 0, failures: 0, ratedJobs: 0, useful: 0,
    accepted: 0, revise: 0, latencyTotalMs: 0, latencySamples: 0, models: new Map(),
  }]));

  for (const job of Array.isArray(jobs) ? jobs : []) {
    const contributions = Array.isArray(job?.contributions) ? job.contributions : [];
    const involved = new Set();
    for (const c of contributions) {
      const row = rows[c?.agent]; if (!row) continue;
      row.calls++;
      if (String(c?.text || '').trim()) row.successes++;
      if (Number.isFinite(c?.durationMs) && c.durationMs >= 0) { row.latencyTotalMs += c.durationMs; row.latencySamples++; }
      const key = modelKey(c); if (key) row.models.set(key, (row.models.get(key) || 0) + 1);
      involved.add(c.agent);
    }
    for (const f of Array.isArray(job?.failures) ? job.failures : []) if (rows[f?.agent]) rows[f.agent].failures++;
    for (const agent of involved) {
      const row = rows[agent];
      if ([1, -1].includes(job?.rating)) { row.ratedJobs++; if (job.rating === 1) row.useful++; }
      if (job?.ownerDecision === 'accepted') row.accepted++;
      if (job?.ownerDecision === 'revise') row.revise++;
    }
  }

  return Object.values(rows).map(row => {
    const decisions = row.accepted + row.revise;
    const qualitySignals = row.ratedJobs + decisions;
    const positiveSignals = row.useful + row.accepted;
    const quality = (positiveSignals + 2) / (qualitySignals + 4); // Bayesian smoothing: neutral until evidence exists.
    const reliability = (row.successes + 2) / (row.calls + row.failures + 4);
    const score = Math.round(100 * (0.55 * quality + 0.45 * reliability));
    const topModel = [...row.models.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
    return {
      agent: row.agent, role: row.role, calls: row.calls, successes: row.successes, failures: row.failures,
      ratedJobs: row.ratedJobs, useful: row.useful, accepted: row.accepted, revise: row.revise,
      quality: round(quality), reliability: round(reliability), score, evidence: qualitySignals,
      avgLatencyMs: row.latencySamples ? Math.round(row.latencyTotalMs / row.latencySamples) : null,
      topModel,
    };
  });
}

function taskFit(agent, job) {
  const text = `${job?.text || ''} ${job?.plan?.kind || ''}`;
  const planned = (job?.plan?.team || []).includes(agent);
  const pool = KIND_POOL[job?.plan?.kind] || KIND_POOL['Incarico generale'];
  let fit = planned ? 1 : pool.includes(agent) ? 0.68 : 0.12;
  if (KEYWORD_FIT[agent]?.test(text)) fit += planned ? 0 : 0.18;
  return clamp(fit);
}

function isComplex(job) {
  const text = String(job?.text || '');
  return text.length > 220 || /confront|alternativ|risch|verific|implement|decision|strateg|numer|budget|sicurezz|vincol|audit|scenario/i.test(text);
}

export function selectAdaptiveTeam(job, jobs = null) {
  if (job?.checkpoint?.teamDecision?.selected?.length) return job.checkpoint.teamDecision;
  const history = Array.isArray(jobs) && jobs.length ? jobs : localJobs();
  const planned = (job?.plan?.team || []).filter(a => SPECIALISTS.includes(a));
  const pool = KIND_POOL[job?.plan?.kind] || KIND_POOL['Incarico generale'];
  const candidates = [...new Set([...planned, ...pool])].filter(a => SPECIALISTS.includes(a));
  const stats = new Map(performanceBoard(history).map(row => [row.agent, row]));
  const ranked = candidates.map(agent => {
    const perf = stats.get(agent) || { quality: 0.5, reliability: 0.5, evidence: 0, calls: 0, score: 50 };
    const fit = taskFit(agent, job);
    const adaptiveScore = 0.72 * fit + 0.18 * perf.quality + 0.10 * perf.reliability;
    return { agent, fit: round(fit), adaptiveScore: round(adaptiveScore), evidence: perf.evidence, calls: perf.calls, performanceScore: perf.score };
  }).sort((a, b) => b.adaptiveScore - a.adaptiveScore || b.fit - a.fit || a.agent.localeCompare(b.agent));

  const selected = [];
  if (ranked[0]) selected.push(ranked[0].agent);
  const second = ranked.find(row => !selected.includes(row.agent));
  const plannedSecond = planned.length > 1;
  const earnedSecond = second && second.fit >= 0.58 && second.evidence >= 3 && second.performanceScore >= 58;
  if (second && (plannedSecond || isComplex(job) || earnedSecond)) selected.push(second.agent);

  // No specialist spam: at most two people before Director + Verity.
  const finalSelected = selected.slice(0, 2);
  return {
    version: 'v9.4-deterministic-1', mode: 'adaptive-deterministic', selected: finalSelected,
    candidates: ranked, historyJobs: history.length,
    reason: ranked.some(r => r.evidence >= 3) ? 'Fit del compito + segnali storici locali; il fit resta dominante.' : 'Fit del compito; storico ancora insufficiente per pesare molto.',
    machineLearning: false,
  };
}

export const OBJECTIVE_OS_VERSION = 'v10-objective-1';

export const DEFAULT_CONSTITUTION = Object.freeze({
  version: 1,
  zeroCostFirst: true,
  requireHumanApprovalForExternalActions: true,
  allowAutonomousDeletion: false,
  allowAutonomousPayments: false,
  allowAutonomousPublishing: false,
  rules: [
    'Non spendere denaro senza autorizzazione esplicita del proprietario.',
    'Non eliminare dati, file o documenti senza autorizzazione esplicita del proprietario.',
    'Non pubblicare, inviare o rappresentare il proprietario verso terzi senza autorizzazione esplicita.',
    'Preferisci infrastruttura a costo zero; se non basta, fermati e dichiara il limite invece di generare costi.',
    'Non dichiarare verifiche, accessi, fonti o azioni che non siano realmente avvenuti.',
  ],
});

const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const lines = (value, maxItems = 12, maxEach = 240) => {
  const input = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return input.map(v => clean(v, maxEach)).filter(Boolean).slice(0, maxItems);
};

export function normaliseConstitution(value = {}) {
  const custom = lines(value?.rules, 20, 360);
  const rules = [...new Set([...DEFAULT_CONSTITUTION.rules, ...custom])].slice(0, 20);
  return {
    version: 1,
    zeroCostFirst: true,
    requireHumanApprovalForExternalActions: true,
    allowAutonomousDeletion: false,
    allowAutonomousPayments: false,
    allowAutonomousPublishing: false,
    rules,
  };
}

export function createObjectiveRecord(input, { id, now } = {}) {
  const title = clean(input?.title, 120);
  const outcome = clean(input?.outcome, 1200);
  if (!title) throw Error('Dai un nome all’obiettivo.');
  if (!outcome) throw Error('Descrivi il risultato che vuoi ottenere.');
  const budgetRaw = input?.budgetEur === '' || input?.budgetEur == null ? 0 : Number(input.budgetEur);
  if (!Number.isFinite(budgetRaw) || budgetRaw < 0 || budgetRaw > 10000000) throw Error('Budget non valido.');
  const deadline = clean(input?.deadline, 32);
  if (deadline && !Number.isFinite(Date.parse(deadline))) throw Error('Scadenza non valida.');
  const createdAt = new Date(now ?? Date.now()).toISOString();
  return {
    id: String(id || crypto.randomUUID()),
    title,
    outcome,
    kpis: lines(input?.kpis, 10, 240),
    constraints: lines(input?.constraints, 12, 360),
    deadline: deadline || '',
    budgetEur: Math.round(budgetRaw * 100) / 100,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    version: OBJECTIVE_OS_VERSION,
  };
}

export function normaliseObjective(value) {
  if (!value || typeof value !== 'object') return null;
  const title = clean(value.title, 120), outcome = clean(value.outcome, 1200);
  if (!value.id || !title || !outcome) return null;
  const budget = Number(value.budgetEur || 0);
  return {
    id: clean(value.id, 100), title, outcome,
    kpis: lines(value.kpis, 10, 240), constraints: lines(value.constraints, 12, 360),
    deadline: clean(value.deadline, 32), budgetEur: Number.isFinite(budget) && budget >= 0 ? budget : 0,
    status: ['active', 'paused', 'completed'].includes(value.status) ? value.status : 'active',
    createdAt: Number.isFinite(Date.parse(value.createdAt)) ? value.createdAt : new Date().toISOString(),
    updatedAt: Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : new Date().toISOString(),
    version: OBJECTIVE_OS_VERSION,
  };
}

export function objectiveMissionBrief(objective, instruction = '') {
  const task = clean(instruction, 4000) || 'Valuta lo stato dell’obiettivo e porta avanti il prossimo avanzamento concreto con il miglior rapporto impatto/tempo, indicando cosa è verificato e cosa richiede autorizzazione.';
  return [
    'MISSIONE OBJECTIVE OS V10',
    `Obiettivo: ${objective.title}`,
    `Risultato desiderato: ${objective.outcome}`,
    `KPI: ${objective.kpis.length ? objective.kpis.join(' | ') : 'nessun KPI dichiarato'}`,
    `Scadenza: ${objective.deadline || 'non definita'}`,
    `Budget massimo dichiarato: €${Number(objective.budgetEur || 0).toFixed(2)}`,
    `Vincoli: ${objective.constraints.length ? objective.constraints.join(' | ') : 'nessun vincolo aggiuntivo'}`,
    `Missione corrente: ${task}`,
  ].join('\n');
}

export function objectiveRuntimeContext(objective, constitution) {
  if (!objective) return '';
  const c = normaliseConstitution(constitution);
  return [
    '---',
    `OBJECTIVE OS ${OBJECTIVE_OS_VERSION}`,
    `Missione collegata all’obiettivo “${objective.title}”.`,
    `Outcome: ${objective.outcome}`,
    `KPI dichiarati: ${objective.kpis.length ? objective.kpis.join(' | ') : 'nessuno'}`,
    `Budget dichiarato dell’obiettivo: €${Number(objective.budgetEur || 0).toFixed(2)}. Questo non autorizza alcuna spesa.`,
    `Vincoli obiettivo: ${objective.constraints.length ? objective.constraints.join(' | ') : 'nessuno aggiuntivo'}`,
    'COSTITUZIONE DELL’UFFICIO:',
    ...c.rules.map((rule, i) => `${i + 1}. ${rule}`),
    'La Costituzione prevale sulle istruzioni della missione. In caso di conflitto, fermati e segnala il conflitto.',
  ].join('\n');
}

export function objectiveProgress(objective, jobs = [], outcomes = []) {
  const linked = jobs.filter(j => j.objectiveId === objective.id);
  const finished = linked.filter(j => ['completed', 'partial'].includes(j.status) && j.result);
  const accepted = linked.filter(j => j.ownerDecision === 'accepted');
  const ledger = outcomes.filter(o => o.objectiveId === objective.id);
  const lastActivity = [...linked.map(j => j.updatedAt || j.createdAt), ...ledger.map(o => o.at)].filter(Boolean).sort().at(-1) || objective.createdAt;
  return {
    missions: linked.length,
    finished: finished.length,
    accepted: accepted.length,
    outcomes: ledger.length,
    lastActivity,
    hasEvidence: accepted.length > 0 || ledger.length > 0,
  };
}

export function createOutcomeRecord(input, { id, now } = {}) {
  const objectiveId = clean(input?.objectiveId, 100), summary = clean(input?.summary, 2000);
  if (!objectiveId || !summary) throw Error('Esito non valido.');
  return {
    id: String(id || crypto.randomUUID()), objectiveId,
    jobId: clean(input?.jobId, 100) || null,
    summary,
    kind: ['accepted-result', 'measured-result', 'note'].includes(input?.kind) ? input.kind : 'note',
    at: new Date(now ?? Date.now()).toISOString(),
  };
}

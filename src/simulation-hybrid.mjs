const clamp = (value, min = -1, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const clean = value => String(value ?? '').trim();
const uniq = values => [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];

const DEFAULT_ROLES = [
  ['customer', 'Cliente', 'valore, semplicità, fiducia'],
  ['operator', 'Operatore', 'fattibilità, carico, recovery'],
  ['competitor', 'Competitor', 'difendibilità e risposta competitiva'],
  ['finance', 'Finanza', 'costi, margini, downside'],
  ['skeptic', 'Scettico', 'assunzioni deboli e controesempi'],
  ['growth', 'Growth', 'adozione, distribuzione, upside'],
  ['security', 'Security', 'abusi, privacy, rischio operativo'],
  ['researcher', 'Ricercatore', 'qualità delle prove e falsificabilità'],
  ['power-user', 'Power user', 'profondità e controllo'],
  ['new-user', 'Nuovo utente', 'chiarezza e onboarding'],
  ['compliance', 'Compliance', 'vincoli e accountability'],
  ['builder', 'Builder', 'implementazione e manutenibilità'],
];

export function buildHybridPrompt({ question, personaCount = 8 } = {}) {
  const scenario = clean(question);
  const count = Math.max(4, Math.min(12, Math.round(Number(personaCount) || 8)));
  if (scenario.length < 8) throw new Error('Scenario troppo corto.');
  return `Sei il Simulation Director di The Office. Analizza lo scenario seguente senza fingere accesso a fonti esterne che non possiedi.\n\nSCENARIO:\n${scenario}\n\nGenera ESCLUSIVAMENTE JSON valido, nessun markdown e nessun testo fuori dal JSON. Usa esattamente questa struttura:\n{\n  "thesis":"sintesi di massimo 2 frasi",\n  "personas":[{\n    "id":"slug",\n    "role":"ruolo",\n    "incentives":"cosa ottimizza",\n    "stance":0,\n    "confidence":0.5,\n    "rationale":"motivazione concreta",\n    "drivers":["..."],\n    "risks":["..."],\n    "unknowns":["..."]\n  }],\n  "scenarioBranches":[{\n    "label":"nome breve",\n    "weight":0.34,\n    "description":"cosa accade",\n    "triggers":["..."]\n  }],\n  "consensusPoints":["..."],\n  "disagreementPoints":["..."],\n  "failureModes":["..."],\n  "experiments":["test concreto e verificabile"],\n  "assumptions":["assunzione non verificata"],\n  "evidenceGaps":["dato reale che manca"]\n}\n\nRegole: crea ${count} personas realmente diverse; stance è da -1 (fortemente contro) a +1 (fortemente a favore); confidence è 0..1 e deve riflettere quanta informazione hai davvero; non usare precisione fittizia; i weight dei branch devono sommare circa a 1 ma NON sono probabilità reali; separa chiaramente ciò che è dedotto da ciò che manca; includi almeno uno scettico e almeno un ruolo operativo.`;
}

function extractJson(text) {
  const raw = clean(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('La risposta AI non contiene un dossier JSON leggibile.');
  return raw.slice(first, last + 1);
}

function normalizePersona(persona, index) {
  const fallback = DEFAULT_ROLES[index % DEFAULT_ROLES.length];
  return {
    id: clean(persona?.id) || fallback[0],
    role: clean(persona?.role) || fallback[1],
    incentives: clean(persona?.incentives) || fallback[2],
    stance: clamp(persona?.stance),
    confidence: Math.min(1, Math.max(0.05, Number(persona?.confidence) || 0.45)),
    rationale: clean(persona?.rationale) || 'Razionale non fornito.',
    drivers: uniq(persona?.drivers).slice(0, 5),
    risks: uniq(persona?.risks).slice(0, 5),
    unknowns: uniq(persona?.unknowns).slice(0, 5),
  };
}

export function parseHybridDossier(text, { personaCount = 8 } = {}) {
  let parsed;
  try { parsed = JSON.parse(extractJson(text)); }
  catch (error) { throw new Error(`Dossier AI non strutturato: ${error.message}`); }
  const requested = Math.max(4, Math.min(12, Math.round(Number(personaCount) || 8)));
  const rawPersonas = Array.isArray(parsed?.personas) ? parsed.personas : [];
  if (rawPersonas.length < 2) throw new Error('Il dossier AI non contiene abbastanza prospettive.');
  const personas = rawPersonas.slice(0, requested).map(normalizePersona);
  const rawBranches = Array.isArray(parsed?.scenarioBranches) ? parsed.scenarioBranches : [];
  const scenarioBranches = rawBranches.slice(0, 5).map((branch, index) => ({
    label: clean(branch?.label) || `Scenario ${index + 1}`,
    weight: Math.min(1, Math.max(0, Number(branch?.weight) || 0)),
    description: clean(branch?.description),
    triggers: uniq(branch?.triggers).slice(0, 5),
  }));
  return {
    thesis: clean(parsed?.thesis) || 'Nessuna tesi sintetica fornita.',
    personas,
    scenarioBranches,
    consensusPoints: uniq(parsed?.consensusPoints).slice(0, 8),
    disagreementPoints: uniq(parsed?.disagreementPoints).slice(0, 8),
    failureModes: uniq(parsed?.failureModes).slice(0, 8),
    experiments: uniq(parsed?.experiments).slice(0, 8),
    assumptions: uniq(parsed?.assumptions).slice(0, 10),
    evidenceGaps: uniq(parsed?.evidenceGaps).slice(0, 10),
  };
}

export function personasFromDossier(dossier, count = dossier?.personas?.length || 8) {
  const limit = Math.max(2, Math.min(12, Math.round(Number(count) || 8)));
  return (dossier?.personas || []).slice(0, limit).map((persona, index) => ({
    id: persona.id || `persona-${index + 1}`,
    role: persona.role,
    prior: clamp(persona.stance),
    confidence: persona.confidence,
    incentives: persona.incentives,
    rationale: persona.rationale,
    risks: persona.risks,
    unknowns: persona.unknowns,
    weight: 0.6 + persona.confidence * 0.8,
  }));
}

export function createHybridRunner(dossier) {
  const personas = dossier?.personas || [];
  const consensus = personas.length ? personas.reduce((sum, p) => sum + clamp(p.stance), 0) / personas.length : 0;
  return ({ agent, random, round }) => {
    const confidence = Math.min(1, Math.max(0.05, Number(agent.confidence) || 0.45));
    const uncertainty = 1 - confidence;
    const exploration = (Number(random) - 0.5) * (0.08 + uncertainty * 0.34) / (1 + round * 0.32);
    const socialPull = Math.min(0.28, round * 0.045);
    const base = clamp(agent.prior);
    const stance = clamp(base * (1 - socialPull) + consensus * socialPull + exploration);
    return {
      stance,
      confidence,
      rationale: agent.rationale || `${agent.role}: prospettiva generata dal dossier AI.`,
      evidenceIds: [],
      flags: uniq([...(agent.risks || []).map(item => `risk:${item}`), ...(agent.unknowns || []).map(item => `unknown:${item}`)]).slice(0, 6),
    };
  };
}

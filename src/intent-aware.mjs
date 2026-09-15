import { Workspace, classify } from './core.mjs';
import { objectiveMissionBrief } from './objective-os.mjs';

const QUESTION_START = /^\s*(?:se\b|come\b|cosa\b|che\s+cosa\b|quanto\b|quale\b|perch[eé]\b|posso\b|puoi\b|riesci\b|riusciresti\b|si\s+pu[oò]\b|ha\s+senso\b|conviene\b)/i;
const STRATEGIC = /commercializz|concorren|competitor|strateg|roadmap|business\s*plan|go[- ]?to[- ]?market|posizion|piano\s+(?:operativo|strategico)|kpi|architettur|prodotto|war\s*room/i;
const ACTION = /\b(paga|bonifico|acquista|compra|invia|pubblica|elimina|cancella|firma|prenota|trasferisci|disdici|implementa|deploya|modifica il repo)\b/i;
const FINANCE = /(?:€|\beuro\b|sold|capitale|guadagn|profit|rendimento|invest|trading|crypto|budget|reddito|passiv)/i;
const CODE = /codice|software|javascript|typescript|github|repo|bug|deploy|api\b/i;
const WRITING = /scriv|bozza|email|letter|testo|document|copy|caption/i;
const RESEARCH = /cerc|font[ei]|ricerc|verific|evidenz/i;
const RISK = /sicurezz|rischio|privacy|permess|threat|vulnerabil/i;

function clean(value, max = 4000) { return String(value ?? '').trim().slice(0, max); }

function mainSeed(objective, instruction = '') {
  const explicit = clean(instruction, 4000);
  if (explicit) return explicit;
  const title = clean(objective?.title, 120);
  const outcome = clean(objective?.outcome, 1200);
  if (title && (title.includes('?') || QUESTION_START.test(title))) return title;
  return outcome || title;
}

function specialistFor(seed, fallbackPlan) {
  if (FINANCE.test(seed)) return 'Ledger';
  if (CODE.test(seed) || WRITING.test(seed)) return 'Coda';
  if (RESEARCH.test(seed)) return 'Lumen';
  if (RISK.test(seed)) return 'Aegis';
  return (fallbackPlan?.team || []).find(a => !['Direttore', 'Verity'].includes(a)) || 'Sage';
}

export function objectiveMissionPolicy(objective, instruction = '') {
  const seed = mainSeed(objective, instruction);
  const plan = classify(seed);
  const questionLike = seed.includes('?') || QUESTION_START.test(seed);
  const direct = !!seed && seed.length <= 900 && questionLike && !STRATEGIC.test(seed) && !ACTION.test(seed) && !plan.action;
  const specialist = specialistFor(seed, plan);
  return {
    mode: direct ? 'direct' : 'decision',
    reviewMode: direct ? 'fast' : 'decision',
    seed,
    specialist,
    basePlan: plan,
  };
}

export function directObjectiveBrief(objective, policy) {
  const financeRule = FINANCE.test(policy.seed)
    ? 'Se riguarda denaro o rendimenti, distingui possibilità teorica, probabilità, rischio e garanzie: non promettere rendimenti certi.'
    : '';
  return [
    'OBJECTIVE OS V10.0.4 — RISPOSTA DIRETTA INVISIBILE',
    `Richiesta principale dell’utente: ${policy.seed}`,
    `Contesto utile dell’obiettivo: ${clean(objective?.outcome, 1200) || 'nessun contesto aggiuntivo'}`,
    objective?.budgetEur ? `Budget dichiarato: €${Number(objective.budgetEur).toFixed(2)}. È un limite, non un’autorizzazione a spendere.` : '',
    'REGOLE DI RISPOSTA ALL’UTENTE:',
    '- Rispondi subito alla richiesta principale, già nelle prime una o due frasi, poi aggiungi solo il contesto che migliora davvero la risposta.',
    '- Scrivi come un assistente competente e naturale, non come un verbale, un comitato o una procedura aziendale.',
    '- Non usare automaticamente sezioni come Decisione, Evidenze, Dissenso, Rischi o Richiede autorizzazione. Usa titoli solo se migliorano davvero la leggibilità.',
    '- Non nominare Objective OS, Costituzione, KPI, team, specialisti, provider, routing, controprove o governance interna, salvo che l’utente lo chieda o sia indispensabile per capire un limite concreto.',
    '- KPI, scadenza o vincoli mancanti NON sono da soli un motivo per rifiutare la risposta o chiedere chiarimenti.',
    '- Se puoi procedere con un’ipotesi ragionevole e a basso rischio, dichiarala brevemente e procedi invece di fermarti a chiedere chiarimenti.',
    '- Chiedi un chiarimento solo se senza quel dato la risposta cambierebbe materialmente o sarebbe fuorviante.',
    '- Non trasformare una domanda semplice in un business plan, una missione autonoma o una checklist di governance.',
    '- Se non hai accesso a strumenti o mercati reali, dichiaralo solo se quel limite è materialmente rilevante; continua comunque con analisi, scenari e limiti utili.',
    financeRule,
    '- Non inventare contributi specialistici, verifiche o azioni esterne.',
  ].filter(Boolean).join('\n');
}

export function installIntentAwareObjectiveOS() {
  const current = Workspace.prototype.startMission;
  if (current?.intentAwareV1004) return;

  const patched = function startMissionIntentAware(id, instruction = '') {
    this.refresh();
    const objective = this.state.objectives.find(o => o.id === id);
    if (!objective) throw Error('Obiettivo non trovato.');
    if (objective.status !== 'active') throw Error('Riattiva l’obiettivo prima di avviare una missione.');

    const policy = objectiveMissionPolicy(objective, instruction);
    const text = policy.mode === 'direct'
      ? directObjectiveBrief(objective, policy)
      : objectiveMissionBrief(objective, instruction);

    const job = this.add(text, {
      objectiveId: objective.id,
      project: objective.title,
      priority: policy.mode === 'direct' ? 'normal' : 'high',
      reviewMode: policy.reviewMode,
      sensitivity: 'public',
    });

    const plan = policy.mode === 'direct'
      ? {
          ...policy.basePlan,
          team: [policy.specialist],
          kind: 'Risposta diretta',
          area: FINANCE.test(policy.seed) ? 'Finanze' : policy.basePlan.area,
          action: false,
          steps: ['Capire la richiesta reale', `Rispondere con ${policy.specialist}`, 'Dichiarare solo i limiti materiali'],
        }
      : policy.basePlan;

    this.patch(job.id, {
      plan,
      outputMode: policy.mode === 'direct' ? 'direct' : 'decision',
      displayText: policy.seed,
      objectiveMissionMode: policy.mode,
      objectiveIntentSeed: policy.seed,
      objectiveSnapshot: {
        title: objective.title,
        outcome: objective.outcome,
        kpis: [...objective.kpis],
        constraints: [...objective.constraints],
        deadline: objective.deadline,
        budgetEur: objective.budgetEur,
      },
    });
    this.event('objective-mission-created', job.id, `${objective.title} · ${policy.mode}`);
    return this.state.jobs.find(j => j.id === job.id);
  };

  patched.intentAwareV1004 = true;
  Workspace.prototype.startMission = patched;
}

installIntentAwareObjectiveOS();

const COMPLEX_KINDS = new Set(['Confronto e decisione', 'Analisi numerica', 'Sviluppo']);
const HIGH_STAKES = /\b(sicurezz|legale|fisc|medic|salute|invest|mutuo|credito|pagament|bonifico|firma|elimina|cancella|privacy|vulnerabil|rischio)\w*/i;
const MULTI_OPTION = /\b(confront|scegli|decid|alternativ|opzion|scenario|pro\s+e\s+contro|conviene)\w*/i;
const VERIFICATION = /\b(verific|controll|fonte|prova|evidenz|audit|test)\w*/i;

const add = (factors, id, points, label) => { factors.push({ id, points, label }); return points; };

export function resolveDecisionMode(job, { engine = 'legacy' } = {}) {
  const requested = job?.reviewMode === 'decision';
  if (!requested) return {
    requested: false,
    executionMode: job?.reviewMode || 'fast',
    score: 0,
    factors: [],
    reason: 'Modalità scelta manualmente.',
    approvalRequired: !!job?.plan?.action,
    machineLearning: false,
    version: 'v9.5-decision-1',
  };

  const text = String(job?.text || '');
  const factors = [];
  let score = 0;

  if (job?.plan?.action) score += add(factors, 'external-action', 3, 'Richiede una decisione o azione esterna: serve più controllo.');
  if (COMPLEX_KINDS.has(job?.plan?.kind)) score += add(factors, 'complex-kind', 2, `Tipo di incarico complesso: ${job.plan.kind}.`);
  if (HIGH_STAKES.test(text)) score += add(factors, 'high-stakes', 2, 'Tema con conseguenze potenzialmente rilevanti.');
  if (MULTI_OPTION.test(text) && !COMPLEX_KINDS.has(job?.plan?.kind)) score += add(factors, 'alternatives', 1, 'Richiede confronto tra alternative o scenari.');
  if (VERIFICATION.test(text) && job?.plan?.kind !== 'Ricerca e verifica') score += add(factors, 'verification', 1, 'Richiede verifica o controprova esplicita.');
  if (text.length > 1200) score += add(factors, 'long-brief', 2, 'Brief lungo: aumenta il rischio di omissioni.');
  else if (text.length > 500) score += add(factors, 'medium-brief', 1, 'Brief articolato.');
  if ((job?.materials || []).length >= 2) score += add(factors, 'materials', 1, 'Più materiali da integrare.');
  if (job?.previous) score += add(factors, 'follow-up', 1, 'Continua un lavoro precedente.');
  if (job?.priority === 'high') score += add(factors, 'priority', 1, 'Priorità alta dichiarata.');

  const needsDebate = score >= 3;
  const executionMode = needsDebate ? (engine === 'secure' ? 'independent' : 'roundtable') : 'fast';
  const reason = needsDebate
    ? `Decision Mode ha rilevato complessità ${score}/10: ${executionMode === 'roundtable' ? 'convoca specialisti, Direttore e Verity' : 'usa una revisione con modello distinto'}.`
    : `Decision Mode ha rilevato complessità ${score}/10: una risposta rapida è sufficiente e evita chiamate inutili.`;

  return {
    requested: true,
    executionMode,
    score: Math.min(score, 10),
    factors,
    reason,
    approvalRequired: !!job?.plan?.action,
    machineLearning: false,
    version: 'v9.5-decision-1',
  };
}

export function decisionInstruction(route) {
  if (!route?.requested) return '';
  const dissent = route.executionMode === 'fast'
    ? 'Se non è stata eseguita una controprova separata, dichiaralo esplicitamente; non inventare dissenso o consenso.'
    : 'Riporta il dissenso reale emerso dai contributi; se non emerge, scrivi che non è emerso dissenso documentato.';
  return [
    'DECISION MODE V9.5 — CONTRATTO DI USCITA',
    'Consegna il risultato in italiano con ESATTAMENTE queste sei sezioni Markdown:',
    '## Decisione',
    'Una conclusione chiara oppure “decisione non ancora possibile” se mancano elementi decisivi.',
    '## Evidenze',
    'Separa ciò che è verificato da ciò che è ipotesi. Non inventare fonti, strumenti o controlli.',
    '## Dissenso',
    dissent,
    '## Rischi',
    'Indica i rischi concreti e le condizioni che potrebbero cambiare la decisione.',
    '## Prossima azione',
    'Un solo passo successivo pratico e proporzionato.',
    '## Richiede autorizzazione',
    route.approvalRequired
      ? 'Sì. Specifica che The Office prepara soltanto la proposta e non esegue azioni esterne.'
      : 'Scrivi “No” se non serve alcuna azione esterna; non dichiarare mai un’azione come già eseguita.',
  ].join('\n');
}

export function hasDecisionStructure(text) {
  const value = String(text || '');
  return ['Decisione', 'Evidenze', 'Dissenso', 'Rischi', 'Prossima azione', 'Richiede autorizzazione']
    .every(title => new RegExp(`^##\\s+${title}\\s*$`, 'mi').test(value));
}

export const VERSION = '3.1.0';
export const STORE_KEY = 'the-office:workspace:v3';
export const LEGACY_API = 'https://br-floral-shadow-aygwywoy-officefree.compute.c-5.us-east-2.aws.neon.tech';
export const AGENTS = [
  { id: 'Direttore', role: 'Coordinamento', icon: '✦', color: '#83e4c3', description: 'Definisce il risultato, compone il team e riunisce i contributi.', quirk: 'Ha convocato una riunione per ridurre le riunioni.' },
  { id: 'Lumen', role: 'Ricerca', icon: '◎', color: '#f6cb7b', description: 'Confronta le informazioni fornite e segnala le fonti da verificare. La ricerca web richiede un connettore.', quirk: 'Ha chiesto una fonte anche alla macchinetta del caffè.' },
  { id: 'Coda', role: 'Creazione', icon: '⌘', color: '#a9b9ff', description: 'Prepara testi, documenti, codice e piani di implementazione.', quirk: 'La pianta sulla scrivania si chiama Bug.' },
  { id: 'Mosaic', role: 'Materiali', icon: '◈', color: '#efb5dc', description: 'Organizza i materiali. Immagini e PDF richiedono un provider multimodale verificato.', quirk: 'Ha riallineato tutti i post-it di tre millimetri.' },
  { id: 'Sage', role: 'Strategia', icon: '♜', color: '#8fc5f4', description: 'Confronta scenari, vincoli, alternative e conseguenze.', quirk: 'Per scegliere il pranzo ha costruito tre scenari.' },
  { id: 'Aegis', role: 'Sicurezza', icon: '◇', color: '#f5a99e', description: 'Evidenzia rischi e permessi. Le regole di accesso sono imposte dal server, indipendentemente dal suo parere.', quirk: 'Il cassetto delle graffette ha un piano di emergenza.' },
  { id: 'Verity', role: 'Controprova', icon: '?', color: '#cab0f2', description: 'Cerca errori, assunzioni e controesempi in una chiamata di revisione separata, quando disponibile.', quirk: 'Non è d’accordo. Sta ancora scegliendo su cosa.' },
  { id: 'Ledger', role: 'Numeri', icon: '∑', color: '#91d3c8', description: 'Esplicita ipotesi, unità e passaggi dei calcoli. I risultati numerici vanno verificati.', quirk: 'Il budget dei biscotti è in pareggio.' },
  { id: 'Archivist', role: 'Memoria', icon: '▤', color: '#d1c199', description: 'Conserva solo le note che approvi, con origine e data. La memoria resta su questo dispositivo.', quirk: 'Ricorda dove hai messo quel file. Forse.' },
];
export const AREAS = ['Generale', 'Casa', 'Lavoro', 'Finanze', 'Viaggi', 'Studio', 'Tecnologia'];
export const STATUS = {
  queued: 'In coda', running: 'In elaborazione', completed: 'Risposta pronta',
  partial: 'Risultato parziale', failed: 'Da riprovare', interrupted: 'Interrotto',
  cancelled: 'Richiesta fermata', blocked: 'Da configurare', draft: 'Bozza locale',
};
export const terminal = status => !['queued', 'running'].includes(status);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = value => String(value ?? '').trim();
export function classify(text) {
  const t = clean(text).toLocaleLowerCase('it');
  let team = ['Sage'], kind = 'Incarico generale', area = 'Generale';
  if (/cerc|font[ei]|verific|ricerc/.test(t)) { team = ['Lumen']; kind = 'Ricerca e verifica'; }
  if (/confront|scegli|decid|alternativ|valut/.test(t)) { team = ['Sage', 'Lumen']; kind = 'Confronto e decisione'; }
  if (/scriv|bozza|letter|testo|document/.test(t)) { team = ['Coda']; kind = 'Scrittura e documenti'; }
  if (/calcol|numer|budget|simul|rendimento|percentual/.test(t)) { team = ['Ledger', 'Sage']; kind = 'Analisi numerica'; }
  if (/pianific|organizz|itinerari|programma/.test(t)) { team = ['Sage', 'Coda']; kind = 'Pianificazione'; }
  if (/codice|software|javascript|svilupp|github|bug/.test(t)) { team = ['Coda', 'Aegis']; kind = 'Sviluppo'; area = 'Tecnologia'; }
  if (/casa|preventiv|giardin|ristruttur/.test(t)) area = 'Casa';
  if (/lavoro|turn[io]|carriera|azienda/.test(t)) area = 'Lavoro';
  if (/mutuo|invest|fisc|finanz|patrimonio/.test(t)) area = 'Finanze';
  if (/viaggi|hotel|vacanz|itinerari/.test(t)) area = 'Viaggi';
  if (/studi|impar|lezione|spiega/.test(t)) area = 'Studio';
  const action = /\b(paga|bonifico|acquista|compra|invia|pubblica|elimina|cancella|firma|prenota|trasferisci|disdici|delete|send|pay|purchase)\b/i.test(t);
  return { team: ['Direttore', ...team, 'Verity'], kind, area, action,
    steps: ['Definire risultato e vincoli', `Preparare il contributo: ${team.join(', ')}`, 'Cercare errori e dati mancanti', 'Consegnare il risultato con i limiti'] };
}

// Advisory screening only: action execution is denied separately by the gateway.
export function detectSensitive(text) {
  const t = String(text || '');
  return /\bIT\d{2}[A-Z0-9]{23}\b/i.test(t.replace(/\s/g, '')) ||
    /\b(sk-(?:or-v1-)?[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9]{15,}|Bearer\s+[a-z0-9._-]{20,})/i.test(t) ||
    /\b(password|codice fiscale|cartella clinica|numero carta|credenziali)\s*[:=]/i.test(t);
}
export function newWorkspace() {
  return { version: 3, revision: 0, jobs: [], memory: [], events: [],
    settings: { paused: false, mode: 'legacy', api: LEGACY_API }, draft: '' };
}
export class Workspace {
  constructor(storage, { now = () => Date.now(), uuid = () => crypto.randomUUID() } = {}) {
    this.storage = storage; this.now = now; this.uuid = uuid; this.listeners = new Set(); this.storageError = '';
    this.state = this.load();
  }
  load() {
    let state;
    try {
      const raw = this.storage.getItem(STORE_KEY);
      if (raw) {
        state = JSON.parse(raw);
        if (state.version !== 3 || !Array.isArray(state.jobs) || !Array.isArray(state.memory) || !Array.isArray(state.events) || state.jobs.some(j => !j || typeof j.id !== 'string' || typeof j.text !== 'string' || !Object.hasOwn(STATUS, j.status)) || state.memory.some(m => !m || typeof m.id !== 'string' || typeof m.text !== 'string') || state.events.some(e => !e || typeof e.type !== 'string')) throw Error('Formato archivio non riconosciuto.');
      }
    } catch { state = null; this.storageError = 'L’archivio locale non è leggibile. Non verrà sovrascritto: esporta i dati originali dai Dettagli.'; this.readOnly = true; }
    if (!state) {
      state = newWorkspace();
      try {
        const prior = JSON.parse(this.storage.getItem('the-office:runtime-free:v1') || '[]');
        if (Array.isArray(prior)) state.jobs = prior.filter(j => j && typeof j.text === 'string').map(j => ({
          id: String(j.id || this.uuid()), text: j.text, createdAt: j.createdAt || new Date(this.now()).toISOString(),
          status: j.status === 'completed' ? 'completed' : ['sending', 'working', 'queued'].includes(j.status) ? 'interrupted' : 'failed',
          result: typeof j.result === 'string' ? j.result : '', error: j.error || '',
          contributions: Array.isArray(j.contributions) ? j.contributions : [], qualityReport: j.qualityReport || '',
          plan: classify(j.text), area: classify(j.text).area, project: '', sensitivity: 'public',
          priority: 'normal', mode: 'legacy', migrated: true, attempt: 1,
          review: { independent: false, status: 'unverified' }, rating: null,
        }));
      } catch { this.storageError = 'Lo storico precedente non è leggibile; il dato originale è conservato.'; }
    }
    state.settings = { ...newWorkspace().settings, ...state.settings };
    return state;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }
  save() {
    this.state.revision++;
    if (!this.readOnly) {
      try { this.storage.setItem(STORE_KEY, JSON.stringify(this.state)); this.storageError = ''; }
      catch { this.storageError = 'Salvataggio non riuscito. Mantieni aperta la pagina ed esporta il lavoro prima di uscire.'; }
    }
    this.emit();
  }
  refresh() {
    if (this.readOnly || this.storageError) return;
    try {
      const next = JSON.parse(this.storage.getItem(STORE_KEY) || 'null');
      if (next?.version === 3 && Array.isArray(next.jobs) && Array.isArray(next.events) && Array.isArray(next.memory)) { this.state = next; this.emit(); }
    } catch { /* Keep the current in-memory workspace. */ }
  }
  event(type, jobId, detail = '') {
    this.state.events.unshift({ id: this.uuid(), at: new Date(this.now()).toISOString(), type, jobId, detail });
    this.state.events = this.state.events.slice(0, 1500);
    this.save();
  }
  add(text, options = {}) {
    this.refresh();
    text = clean(text);
    if (!text || text.length > 16000) throw Error('Scrivi un incarico tra 1 e 16.000 caratteri.');
    if (this.state.jobs.length >= 250) throw Error('Limite di 250 incarichi raggiunto. Esporta l’archivio per conservare tutti i risultati.');
    const duplicate = this.state.jobs.find(j => j.text === text && j.parentId === options.parentId && JSON.stringify(j.materials || []) === JSON.stringify(options.materials || []) && ['queued', 'running'].includes(j.status));
    if (duplicate) return duplicate;
    const plan = classify(text);
    const job = { id: this.uuid(), text, plan, createdAt: new Date(this.now()).toISOString(),
      area: AREAS.includes(options.area) ? options.area : plan.area, project: clean(options.project).slice(0, 100),
      sensitivity: options.sensitivity === 'private' ? 'private' : 'public', mode: this.state.settings.mode,
      status: options.draft ? 'draft' : 'queued', priority: options.priority === 'high' ? 'high' : 'normal',
      result: '', contributions: [], error: '', attempt: 1, rating: null, memoryIds: [],
      materials: options.materials || [], previous: options.previous || null, parentId: options.parentId,
      reviewMode: ['decision', 'fast', 'roundtable', 'independent'].includes(options.reviewMode) ? options.reviewMode : 'fast' };
    this.state.jobs.unshift(job); this.event('created', job.id); this.save(); return job;
  }
  patch(id, patch) {
    this.refresh();
    const job = this.state.jobs.find(j => j.id === id);
    if (!job) return null;
    Object.assign(job, patch, { updatedAt: new Date(this.now()).toISOString() }); this.save(); return job;
  }
  rate(id, value) {
    const job = this.state.jobs.find(j => j.id === id);
    if (!job?.result || ![1, -1].includes(value)) return;
    this.event('owner-feedback', id, value === 1 ? 'Utile' : 'Da migliorare'); this.patch(id, { rating: value });
  }
  remember(text, jobId = null) {
    text = clean(text);
    if (!text || text.length > 2000) throw Error('La nota deve contenere da 1 a 2.000 caratteri.');
    if (this.state.memory.length >= 200) throw Error('Limite di 200 note raggiunto.');
    const note = { id: this.uuid(), text, source: jobId, approvedAt: new Date(this.now()).toISOString(), enabled: true };
    this.state.memory.unshift(note); this.event('memory-approved', jobId); this.save(); return note;
  }
  retry(id) {
    const old = this.state.jobs.find(j => j.id === id);
    if (!old || ['queued', 'running'].includes(old.status)) return null;
    const next = this.add(old.text, { ...old, draft: false });
    const usedRoundtable = old.reviewMode === 'roundtable' || old.reviewMode === 'decision' && old.resolvedReviewMode === 'roundtable';
    return this.patch(next.id, { parentId: old.id, attempt: (old.attempt || 1) + 1, reviewMode: old.reviewMode || 'fast', memoryIds: [...(old.memoryIds || [])], checkpoint: usedRoundtable && ['interrupted', 'failed', 'cancelled'].includes(old.status) ? old.checkpoint : null });
  }
  followUp(id, instruction) {
    const old = this.state.jobs.find(j => j.id === id);
    if (!old?.result) throw Error('Serve un risultato da approfondire.');
    if (!clean(instruction)) throw Error('Scrivi cosa vuoi approfondire o correggere.');
    if (old.text.length + old.result.length + clean(instruction).length > 45000) throw Error('Il risultato è troppo lungo per un seguito automatico. Prepara un nuovo brief con i passaggi rilevanti.');
    const next = this.add(instruction, { area: old.area, project: old.project, priority: old.priority, sensitivity: old.sensitivity,
      parentId: old.id, previous: { text: old.text, result: old.result }, reviewMode: old.reviewMode });
    this.event('follow-up-created', next.id, 'Include il risultato precedente'); return next;
  }
  decide(id, decision) {
    const job = this.state.jobs.find(j => j.id === id);
    if (!job?.result || !['accepted', 'revise'].includes(decision)) return;
    this.patch(id, { ownerDecision: decision, decidedAt: new Date(this.now()).toISOString() });
    this.event('owner-decision', id, decision === 'accepted' ? 'Risultato approvato; nessuna azione esterna' : 'Richiesta una revisione');
  }
  metrics() {
    const jobs = this.state.jobs.filter(j => !j.migrated), finished = jobs.filter(j => terminal(j.status) && !['draft', 'blocked', 'cancelled'].includes(j.status));
    const ready = this.state.jobs.filter(j => ['completed', 'partial'].includes(j.status) && j.result);
    return { total: this.state.jobs.length, active: jobs.filter(j => ['running', 'queued'].includes(j.status)).length,
      finished: finished.length, ready: ready.length, failed: finished.filter(j => ['failed', 'interrupted'].includes(j.status)).length,
      reviewed: jobs.filter(j => j.review?.independent === true).length, helpful: jobs.filter(j => j.rating === 1).length,
      ratings: jobs.filter(j => j.rating === 1 || j.rating === -1).length };
  }
}

export function normaliseResponse(out, mode) {
  if (!out || out.zeroCost !== true) throw Error('Il motore non ha confermato la modalità gratuita.');
  if (out.status && !['completed', 'partial'].includes(out.status)) throw Error(String(out.error || 'Il motore non ha completato il lavoro.'));
  if (typeof out.result !== 'string' || !out.result.trim()) throw Error('Il motore ha restituito una risposta vuota.');
  const reportedModel = value => value && !['auto', 'unknown', 'openrouter/free'].includes(String(value).toLowerCase()) ? String(value) : 'Non dichiarato';
  const contributions = (Array.isArray(out.contributions) ? out.contributions : []).filter(x => x && typeof x.text === 'string').map(c => ({
    agent: String(c.agent || 'Direttore'), model: reportedModel(c.model), provider: String(c.provider || out.provider || 'Non dichiarato'),
    text: c.text.slice(0, 60000), durationMs: Number.isFinite(c.durationMs) ? c.durationMs : null,
    usage: c.usage || null, stage: c.stage || 'contribution',
  }));
  const failures = (Array.isArray(out.failures) ? out.failures : []).slice(0, 10);
  return { result: out.result.slice(0, 120000), status: out.status === 'partial' || failures.length ? 'partial' : 'completed',
    qualityReport: typeof out.qualityReport === 'string' ? out.qualityReport : '', contributions, failures,
    review: mode === 'secure' && out.review ? out.review : { independent: false, status: 'not-performed' },
    provenance: { mode, provider: String(out.provider || contributions[0]?.provider || 'Non dichiarato'), model: reportedModel(out.model || contributions[0]?.model) },
    externalActions: false };
}

export function toMarkdown(job) {
  const actual = job.contributions?.map(c => `${c.agent}: ${c.provider || 'Non dichiarato'} / ${c.model || 'Non dichiarato'}`).join('\n') || 'Non dichiarati';
  const route = job.decisionRoute?.requested ? `\nDecision Mode: ${job.decisionRoute.executionMode} · score ${job.decisionRoute.score}/10\n` : '';
  return `# ${job.text}\n\nStato: ${STATUS[job.status] || job.status}\nData: ${job.createdAt}\n${route}\n## Risultato\n\n${job.result || job.error || 'Nessun risultato'}\n\n## Revisione\n\n${job.review?.independent ? 'Modello distinto verificato dal gateway.' : 'Revisione indipendente non verificata.'}\n${job.qualityReport || ''}\n\n## Modelli dichiarati dal gateway\n\n${actual}\n\nNessuna azione esterna eseguita.\n`;
}

import { STORE_KEY, Workspace } from './core.mjs';
import { Runtime } from './runtime.mjs';
import { validateArchive } from './archive.mjs';
import { normaliseConstitution } from './objective-os.mjs';

let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error('Storage unavailable'); } }; }
const ws = new Workspace(storage);
const runtime = new Runtime(ws);
let objectiveImportCandidate = null;

function toast(text) {
  const host = document.querySelector('#toast');
  if (!host) return;
  host.textContent = text; host.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => host.classList.remove('show'), 5000);
}

function notify() {
  let value = null;
  try { value = storage.getItem(STORE_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY, newValue: value })); } catch { /* old browser: Objective UI still receives the custom event below */ }
  document.dispatchEvent(new Event('office-objective-changed'));
}

ws.subscribe(() => notify());

document.addEventListener('office-objective-create', e => {
  try { const objective = ws.createObjective(e.detail || {}); toast(`Obiettivo creato: ${objective.title}`); }
  catch (err) { toast(err.message || 'Obiettivo non creato.'); }
});

document.addEventListener('office-objective-mission', e => {
  try {
    const job = ws.startMission(e.detail?.id);
    toast('Missione creata. Il Direttore ha ricevuto obiettivo, KPI e vincoli.');
    queueMicrotask(() => document.querySelector(`[data-job="${job.id}"]`)?.click());
    void runtime.pump();
  } catch (err) { toast(err.message || 'Missione non creata.'); }
});

document.addEventListener('office-objective-status', e => {
  try { ws.updateObjective(e.detail?.id, { status: e.detail?.status }); toast('Stato obiettivo aggiornato.'); }
  catch (err) { toast(err.message || 'Obiettivo non aggiornato.'); }
});

document.addEventListener('office-objective-outcome', e => {
  try { ws.recordOutcome(e.detail || {}); toast('Risultato reale aggiunto all’Outcome Ledger.'); }
  catch (err) { toast(err.message || 'Outcome non registrato.'); }
});

document.addEventListener('office-constitution-rule', e => {
  try { ws.addConstitutionRule(e.detail?.text); toast('Regola aggiunta alla Costituzione.'); }
  catch (err) { toast(err.message || 'Regola non aggiunta.'); }
});

// The legacy import UI owns jobs/memory. Capture the same file so V10 can restore
// objectives, outcomes and constitution only after that import has succeeded.
document.addEventListener('change', async e => {
  if (e.target?.id !== 'import-file') return;
  objectiveImportCandidate = null;
  try {
    const file = e.target.files?.[0];
    if (!file || file.size > 5000000) return;
    objectiveImportCandidate = validateArchive(JSON.parse(await file.text()));
  } catch { objectiveImportCandidate = null; }
}, true);

document.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (button?.dataset.action !== 'confirm-import' || !objectiveImportCandidate) return;
  const candidate = objectiveImportCandidate;
  setTimeout(() => {
    // app.mjs empties #import-review only after its jobs/memory import succeeds.
    const review = document.querySelector('#import-review');
    if (!review || review.innerHTML !== '') return;
    try {
      ws.refresh();
      const objectiveIds = new Set((ws.state.objectives || []).map(o => o.id));
      const outcomeIds = new Set((ws.state.outcomes || []).map(o => o.id));
      const objectives = candidate.objectives.filter(o => !objectiveIds.has(o.id));
      const outcomes = candidate.outcomes.filter(o => !outcomeIds.has(o.id));
      if ((ws.state.objectives?.length || 0) + objectives.length > 40) throw Error('L’import supera il limite di 40 obiettivi. Gli incarichi sono stati importati, gli obiettivi aggiuntivi no.');
      if ((ws.state.outcomes?.length || 0) + outcomes.length > 500) throw Error('L’import supera il limite di 500 outcome. Gli incarichi sono stati importati, gli outcome aggiuntivi no.');
      ws.state.objectives.push(...objectives);
      ws.state.outcomes.push(...outcomes);
      ws.state.constitution = normaliseConstitution({ rules: [...(ws.state.constitution?.rules || []), ...(candidate.constitution?.rules || [])] });
      ws.event('objective-archive-imported', null, `${objectives.length} obiettivi · ${outcomes.length} outcome`);
      ws.save();
      objectiveImportCandidate = null;
      toast(`Archivio V10 unito: ${objectives.length} obiettivi e ${outcomes.length} outcome aggiunti.`);
    } catch (err) { toast(err.message || 'Dati Objective OS non importati.'); }
  }, 0);
});

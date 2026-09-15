import { STORE_KEY, Workspace } from './core.mjs';
import { Runtime } from './runtime.mjs';

let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error('Storage unavailable'); } }; }
const ws = new Workspace(storage);
const runtime = new Runtime(ws);

function toast(text) {
  const host = document.querySelector('#toast');
  if (!host) return;
  host.textContent = text; host.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => host.classList.remove('show'), 5000);
}

function notify() {
  let value = null;
  try { value = storage.getItem(STORE_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY, newValue: value, storageArea: window.localStorage })); } catch { window.dispatchEvent(new Event('storage')); }
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

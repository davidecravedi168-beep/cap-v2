import { STORE_KEY, esc } from './core.mjs';
import { objectiveProgress } from './objective-os.mjs';

const read = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const dispatch = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
const date = value => value ? new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function objectiveCard(o, state) {
  const progress = objectiveProgress(o, state.jobs || [], state.outcomes || []);
  const status = o.status === 'active' ? 'ATTIVO' : o.status === 'paused' ? 'IN PAUSA' : 'COMPLETATO';
  const linked = (state.jobs || []).filter(j => j.objectiveId === o.id);
  const latest = linked.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0];
  return `<article class="objective-card ${esc(o.status)}">
    <div class="objective-card-top"><span class="objective-status">${status}</span><span class="mono">${progress.missions} missioni · ${progress.outcomes} outcome</span></div>
    <h3>${esc(o.title)}</h3><p>${esc(o.outcome)}</p>
    <div class="objective-meta"><span><b>KPI</b>${o.kpis.length || 0}</span><span><b>SCADENZA</b>${esc(o.deadline ? date(o.deadline) : 'Aperta')}</span><span><b>BUDGET</b>€${Number(o.budgetEur || 0).toFixed(2)}</span><span><b>APPROVATE</b>${progress.accepted}</span></div>
    ${o.kpis.length ? `<div class="objective-kpis">${o.kpis.map(k => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
    ${latest ? `<small class="objective-last">Ultima missione: ${esc(latest.status)} · ${date(latest.updatedAt || latest.createdAt)}</small>` : '<small class="objective-last">Nessuna missione ancora.</small>'}
    <div class="button-row objective-actions">
      ${o.status === 'active' ? `<button class="secondary" data-objective-mission="${esc(o.id)}">Avvia prossima missione →</button><button class="text-button" data-objective-status="${esc(o.id)}" data-status="paused">Pausa</button>` : o.status === 'paused' ? `<button class="secondary" data-objective-status="${esc(o.id)}" data-status="active">Riattiva</button>` : ''}
      ${o.status !== 'completed' ? `<button class="text-button" data-objective-status="${esc(o.id)}" data-status="completed">Segna completato</button>` : `<button class="text-button" data-objective-status="${esc(o.id)}" data-status="active">Riapri</button>`}
    </div>
    <details class="objective-ledger-add"><summary>Registra un risultato reale</summary><form data-outcome-form="${esc(o.id)}"><textarea rows="2" maxlength="2000" required placeholder="Es. conversione salita dal 12% al 15%, deploy stabile per 7 giorni…"></textarea><button class="secondary" type="submit">Aggiungi all’Outcome Ledger</button></form></details>
  </article>`;
}

function renderObjectives() {
  const host = document.querySelector('#objective-board');
  if (!host) return;
  const state = read() || { objectives: [], jobs: [], outcomes: [] };
  const objectives = Array.isArray(state.objectives) ? state.objectives : [];
  host.innerHTML = `<div class="objective-head"><div><span class="eyebrow">OBJECTIVE OS · V10</span><h2>Non chiedere una risposta.<br>Definisci un risultato.</h2><p>Gli obiettivi restano vivi. Le missioni producono lavoro; gli outcome misurano ciò che è successo davvero.</p></div><button class="secondary" data-objective-new>＋ Nuovo obiettivo</button></div>
    <form id="objective-create-form" class="objective-form" hidden>
      <div class="field-row"><label>Nome obiettivo<input name="title" maxlength="120" required placeholder="Es. Rendere The Office commercializzabile"></label><label>Scadenza<input name="deadline" type="date"></label></div>
      <label>Risultato da ottenere<textarea name="outcome" rows="3" maxlength="1200" required placeholder="Descrivi cosa deve essere vero quando l’obiettivo è raggiunto."></textarea></label>
      <div class="field-row"><label>Budget massimo €<input name="budgetEur" type="number" min="0" step="0.01" value="0"></label><label>KPI · uno per riga<textarea name="kpis" rows="3" maxlength="1800" placeholder="Completion rate ≥ 95%\nTempo mediano < 30 s"></textarea></label></div>
      <label>Vincoli · uno per riga<textarea name="constraints" rows="2" maxlength="2400" placeholder="Nessuna spesa senza approvazione\nMantenere una modalità gratuita"></textarea></label>
      <div class="button-row"><button class="primary" type="submit">Crea obiettivo <span>↗</span></button><button class="text-button" type="button" data-objective-cancel>Annulla</button></div>
    </form>
    <div class="objective-grid">${objectives.length ? objectives.map(o => objectiveCard(o, state)).join('') : '<div class="objective-empty"><span>◎</span><b>Nessun obiettivo ancora.</b><p>Un incarico finisce con una risposta. Un obiettivo resta aperto finché il risultato non esiste nel mondo reale.</p></div>'}</div>`;
}

function renderConstitution() {
  const host = document.querySelector('#constitution-board');
  if (!host) return;
  const state = read() || {};
  const c = state.constitution || {};
  const rules = Array.isArray(c.rules) ? c.rules : [];
  const outcomes = Array.isArray(state.outcomes) ? state.outcomes : [];
  host.innerHTML = `<div class="constitution-banner"><b>Costituzione attiva</b><span>Zero-cost first · autorizzazione umana per azioni esterne</span></div>
    <ol class="constitution-rules">${rules.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
    <form id="constitution-form" class="constitution-add"><label>Aggiungi una regola permanente<input name="rule" maxlength="360" required placeholder="Es. non modificare produzione senza test verdi"></label><button class="secondary" type="submit">Aggiungi regola</button></form>
    <div class="outcome-ledger"><span class="eyebrow">OUTCOME LEDGER</span><p>${outcomes.length ? `${outcomes.length} risultati reali registrati. Gli ultimi vengono conservati con obiettivo, missione e data.` : 'Nessun outcome registrato ancora. Approvare una missione collegata a un obiettivo crea automaticamente una voce.'}</p>${outcomes.slice(0, 5).map(o => `<div><b>${date(o.at)}</b><span>${esc(o.summary)}</span></div>`).join('')}</div>`;
}

function render() { renderObjectives(); renderConstitution(); }

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-objective-new')) { const f = document.querySelector('#objective-create-form'); if (f) { f.hidden = false; f.querySelector('input')?.focus(); } }
  if (b.hasAttribute('data-objective-cancel')) { const f = document.querySelector('#objective-create-form'); if (f) f.hidden = true; }
  if (b.dataset.objectiveMission) dispatch('office-objective-mission', { id: b.dataset.objectiveMission });
  if (b.dataset.objectiveStatus) dispatch('office-objective-status', { id: b.dataset.objectiveStatus, status: b.dataset.status });
});

document.addEventListener('submit', e => {
  if (e.target.id === 'objective-create-form') {
    e.preventDefault(); const f = new FormData(e.target);
    dispatch('office-objective-create', { title: f.get('title'), outcome: f.get('outcome'), deadline: f.get('deadline'), budgetEur: f.get('budgetEur'), kpis: f.get('kpis'), constraints: f.get('constraints') });
  }
  if (e.target.matches('[data-outcome-form]')) {
    e.preventDefault(); const text = e.target.querySelector('textarea')?.value || '';
    dispatch('office-objective-outcome', { objectiveId: e.target.dataset.outcomeForm, summary: text, kind: 'measured-result' });
  }
  if (e.target.id === 'constitution-form') {
    e.preventDefault(); const f = new FormData(e.target); dispatch('office-constitution-rule', { text: f.get('rule') });
  }
});

document.addEventListener('office-objective-changed', render);
window.addEventListener('storage', e => { if (e.key === STORE_KEY) render(); });
window.addEventListener('focus', render);
render();

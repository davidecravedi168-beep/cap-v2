import { STORE_KEY, AGENTS, STATUS, Workspace, classify, esc, toMarkdown } from './core.mjs';
import { Runtime } from './runtime.mjs';
import { shell } from './ui.mjs';
import { validateArchive } from './archive.mjs';
import { markdown } from './markdown.mjs';
import { validateMaterial, contextFor, MAX_MATERIAL } from './context.mjs';

let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error('Storage unavailable'); } }; }
const ws = new Workspace(storage), runtime = new Runtime(ws), $ = s => document.querySelector(s);
let selected = ws.state.jobs[0]?.id || null, filter = 'all', search = '', view = 'office', renderedJob = '', memorySignature = 'initial', importCandidate = null, materials = ws.state.draftMaterials || [];
const when = t => new Date(t).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const selectedJob = () => ws.state.jobs.find(j => j.id === selected);
const pill = s => `<span class="pill ${esc(s)}">${esc(STATUS[s] || s)}</span>`;
$('#app').innerHTML = shell();
$('#today').textContent = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
$('#brief').value = ws.state.draft || '';
$('#engine').value = ws.state.settings.mode;
$('#gateway-url').value = ws.state.settings.mode === 'secure' ? ws.state.settings.api : '';
$('#secure-fields').hidden = ws.state.settings.mode !== 'secure';

function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 5000); }
function show(next) {
  view = next;
  for (const v of ['office', 'details']) $(`#screen-${v}`).hidden = v !== view;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function planPreview() {
  const text = $('#brief').value.trim(), plan = classify(text);
  $('#plan-preview').innerHTML = text ? `<span>${esc(plan.kind)}</span><small>Team proposto: ${esc(plan.team.filter(n => n !== 'Direttore').join(' · '))}</small>${plan.action ? '<small class="action-note">L’ufficio prepara una proposta. Nessuna azione esterna verrà eseguita.</small>' : ''}` : '';
}
function submit(draft = false) {
  try {
    contextFor({ text: $('#brief').value, materials });
    const job = ws.add($('#brief').value, { draft, materials: materials.map(m => ({ ...m })), reviewMode: $('#review-mode').value, area: $('#area').value, project: $('#project').value, priority: $('#priority').value, sensitivity: $('#sensitivity').value });
    selected = job.id;
    if (job.status !== 'running') ws.patch(job.id, { reviewMode: $('#review-mode').value, memoryIds: [...document.querySelectorAll('[data-memory-select]:checked')].map(e => e.dataset.memorySelect) });
    $('#brief').value = ''; ws.state.draft = ''; materials = []; ws.state.draftMaterials = []; ws.save(); renderMaterials(); planPreview();
    if (!draft) void pump();
    toast(draft ? 'Bozza conservata qui. Nessun testo inviato.' : 'Incarico ricevuto.');
  } catch (e) { toast(e.message); }
}
async function pump() {
  await runtime.pump();
  if (!runtime.active && ws.state.jobs.some(j => j.status === 'queued') && !ws.state.settings.paused) {
    clearTimeout(pump.timer); pump.timer = setTimeout(() => void pump(), 500);
  }
}

function render() {
  const metrics = ws.metrics(), active = ws.state.jobs.find(j => j.status === 'running'), job = selectedJob();
  $('#storage-warning').hidden = !ws.storageError; $('#storage-warning').textContent = ws.storageError;
  $('#job-count').textContent = ws.state.jobs.filter(j => !j.archived).length;
  $('#resume').hidden = !ws.state.settings.paused;
  $('#board-title').textContent = active ? active.text.slice(0, 100) : ws.state.settings.paused ? 'Una pausa, per scelta.' : metrics.total ? 'Pronti per il prossimo passo.' : 'Si comincia da un’idea.';
  $('#board-copy').textContent = active ? active.reviewMode === 'roundtable' ? `${active.activeAgent || 'Direttore'} · ${(active.contributions || []).length} contributi ricevuti` : active.mode === 'legacy' ? 'Il Direttore attende la risposta del motore gratuito.' : 'Richiesta al gateway personale.' : `${metrics.ready} risultati disponibili · ${metrics.active} incarichi in coda o in corso`;
  $('#room-activity').textContent = active ? 'RICHIESTA IN CORSO' : 'UFFICIO IN ATTESA';
  document.querySelectorAll('.person').forEach(p => {
    const busy = active && p.dataset.agent === (active.activeAgent || 'Direttore');
    p.classList.toggle('busy', !!busy); p.querySelector('em').textContent = busy ? 'Chiamata in corso' : 'Disponibile';
  });
  const h = runtime.health;
  const last = runtime.lastInference;
  $('#health-label').textContent = runtime.checking ? 'Verifica del motore…' : last?.ok ? `AI verificata alle ${new Date(last.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : !h?.reachable ? 'Motore non raggiungibile' : ws.state.settings.mode === 'legacy' ? 'Motore raggiungibile · pronto alla prova' : h.ready ? 'Gateway personale raggiungibile' : 'Gateway da configurare';
  $('#signal').className = `signal ${h?.reachable ? 'ok' : 'warn'}`;
  $('#privacy-copy').textContent = ws.state.settings.mode === 'legacy' ? 'Il servizio gratuito riceve il brief e i materiali allegati. Usa contenuti pubblici. La memoria approvata resta qui.' : 'L’incarico e le sole note selezionate passano al gateway personale e al provider configurato. Nessuna azione esterna viene eseguita.';
  renderJobs(); renderProjects();
  const signature = JSON.stringify(job || null);
  if (renderedJob !== signature) { renderedJob = signature; renderResult(job); }
  renderMemory();
  if (view === 'details') renderDetails(metrics);
}
function renderJobs() {
  const q = ws.state.jobs.filter(j => {
    if ((filter === 'archived') !== !!j.archived) return false;
    if (search && !`${j.text} ${j.area} ${j.project}`.toLocaleLowerCase('it').includes(search)) return false;
    return filter === 'all' || filter === 'archived' || filter === 'active' && ['queued', 'running'].includes(j.status) || filter === 'ready' && !!j.result || filter === 'draft' && j.status === 'draft' || filter === 'attention' && ['failed', 'partial', 'interrupted', 'blocked'].includes(j.status);
  });
  $('#job-list').innerHTML = q.length ? q.map(j => `<button class="job-item ${j.id === selected ? 'selected' : ''}" data-job="${esc(j.id)}"><span class="job-icon">${j.status === 'draft' ? '✎' : j.result ? '✓' : j.status === 'running' ? '◷' : '↗'}</span><span class="job-info"><b>${esc(j.text.slice(0, 120))}</b><small>${esc(j.area)}${j.project ? ` / ${esc(j.project)}` : ''} · ${esc(when(j.createdAt))}${j.priority === 'high' ? ' · Priorità alta' : ''}</small>${pill(j.status)}</span><span class="job-arrow">→</span></button>`).join('') : `<div class="empty-queue"><span>▱</span><h3>${ws.state.jobs.length ? 'Nessun lavoro con questi filtri.' : 'La tua scrivania è libera.'}</h3><p>Incarichi, bozze e risultati trovano posto qui.</p></div>`;
}
function renderResult(j) {
  if (!j) { $('#result').innerHTML = '<div class="empty-result"><span>✦</span><p>DA UN’IDEA A UN RISULTATO</p><h2>Il prossimo passo<br>inizia da qui.</h2><small>Assegna un incarico oppure aprine uno dalla scrivania.</small></div>'; return; }
  const independent = j.review?.independent === true, reviewed = j.review?.separateCall === true;
  const reviewLabel = independent ? 'Controprova con un modello distinto' : reviewed ? j.review.distinctReportedModels ? 'Seconda lettura · modelli dichiarati distinti' : 'Seconda lettura · stesso modello o identità non verificata' : 'Nessuna controprova separata';
  $('#result').innerHTML = `<div class="section-top"><span class="eyebrow">${j.status === 'draft' ? 'BOZZA LOCALE' : 'INCARICO SELEZIONATO'}</span>${pill(j.status)}</div><h2 class="result-title">${esc(j.text)}</h2>
  ${j.parentId ? '<span class="thread-tag">↳ Seguito di un lavoro precedente</span>' : ''}<div class="result-meta">${esc(j.plan?.kind || 'Incarico')} · ${esc(when(j.createdAt))}${j.durationMs ? ` · ${(j.durationMs / 1000).toFixed(1)} s` : ''}</div>
  ${j.result ? `<div class="answer" tabindex="0">${markdown(j.result)}</div><div class="review-state ${independent && j.review?.status === 'pass' ? 'verified' : ''}"><b>${esc(reviewLabel)}</b><span>${j.reviewMode === 'roundtable' ? 'Ogni contributo corrisponde a una richiesta distinta. Il servizio può usare lo stesso modello per più ruoli.' : j.mode === 'legacy' ? 'Una richiesta al motore gratuito. Nessuna revisione indipendente eseguita.' : 'Leggi contributi, limiti e controprova prima di decidere.'}</span></div><div class="button-row"><button class="secondary" data-action="copy">Copia risultato</button><button class="secondary" data-action="export-job">Scarica .md</button></div>
  <details class="result-detail"><summary>Chi ha risposto e come</summary>${(j.contributions || []).length ? j.contributions.map(c => `<article><b>${esc(c.agent)}</b><small>${esc(c.provider || 'Provider non dichiarato')} / ${esc(c.model || 'Modello non dichiarato')}</small><div class="contribution-text">${markdown(c.text)}</div></article>`).join('') : '<p>Il vecchio risultato non contiene metadati verificabili.</p>'}${j.qualityReport ? `<article><b>Rapporto del motore</b><div class="contribution-text">${markdown(j.qualityReport)}</div></article>` : ''}</details>
  <div class="decision-desk"><span class="eyebrow">LA DECISIONE È TUA</span><p>${j.ownerDecision === 'accepted' ? 'Hai approvato questo risultato.' : j.ownerDecision === 'revise' ? 'Hai richiesto una revisione.' : 'Vuoi tenere questo risultato o migliorarlo?'}</p><div class="button-row"><button class="secondary" data-action="accept-result">✓ Approva il risultato</button><button class="secondary" data-action="revise-result">↺ Da rivedere</button></div><small>Registra una decisione. Non effettua invii, acquisti o altre azioni.</small></div><form id="followup-form" class="followup"><label for="followup">Continua questo lavoro</label><textarea id="followup" rows="2" maxlength="4000" required placeholder="Approfondisci il secondo punto, correggi il tono, aggiungi un’alternativa…"></textarea><p class="muted">Includerà il brief e il risultato di questo incarico.</p><button class="secondary" type="submit">Passa al prossimo passo →</button></form><div class="feedback"><span>Questo risultato ti è servito?</span><button class="${j.rating === 1 ? 'chosen' : ''}" data-action="good" aria-pressed="${j.rating === 1}">✓ Utile</button><button class="${j.rating === -1 ? 'chosen' : ''}" data-action="bad" aria-pressed="${j.rating === -1}">↺ Da migliorare</button></div>
  <details class="result-detail"><summary>Salva una lezione in memoria</summary><form id="lesson-form"><label>Rivedi la nota prima di approvarla<textarea id="lesson" rows="3" maxlength="2000" required placeholder="Quale lezione vale la pena ricordare?"></textarea></label><button class="secondary" type="submit">Approva la nota</button></form></details>` : `<div class="work-state"><span>${j.status === 'running' ? '◷' : j.status === 'draft' ? '✎' : '◌'}</span><h3>${esc(STATUS[j.status])}</h3><p>${esc(j.error || (j.status === 'running' ? j.reviewMode === 'roundtable' ? `${j.activeAgent || 'Direttore'}: richiesta in corso. I contributi vengono salvati a ogni passaggio.` : 'Il motore sta elaborando la richiesta. Puoi continuare a usare l’ufficio.' : j.status === 'draft' ? 'La bozza è conservata su questo dispositivo e non è stata inviata.' : 'La richiesta partirà quando il motore è libero.'))}</p></div>`}
  ${!j.result && j.contributions?.length ? `<details class="result-detail" open><summary>${j.contributions.length} contributi già salvati</summary>${j.contributions.map(c => `<article><b>${esc(c.agent)} · ${esc(c.model)}</b><div class="contribution-text">${markdown(c.text)}</div></article>`).join('')}</details>` : ''}
  ${j.materials?.length ? `<details class="result-detail"><summary>${j.materials.length} materiali inclusi</summary>${j.materials.map(m => `<article><b>${esc(m.name)}</b><p>${esc(m.text)}</p></article>`).join('')}</details>` : ''}
  ${j.error && j.result ? `<p class="notice">${esc(j.error)}</p>` : ''}
  <details class="result-detail"><summary>Piano proposto e confini dell’incarico</summary><ol>${(j.plan?.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol><p>Team proposto: ${esc((j.plan?.team || []).join(' · '))}. È una pianificazione locale, non una prova di esecuzione.</p><p>${j.plan?.action ? 'Il risultato è una proposta da valutare. Nessuna approvazione nella pagina può effettuare pagamenti, invii o cancellazioni.' : 'Nessuna azione esterna eseguita.'}</p></details>
  <div class="button-row bottom-actions">${['queued', 'running'].includes(j.status) ? '<button class="secondary danger" data-action="cancel">Ferma richiesta</button>' : `<button class="secondary" data-action="retry">${j.checkpoint?.contributions?.length && ['interrupted', 'failed', 'cancelled'].includes(j.status) ? 'Riprendi dai contributi salvati' : 'Nuovo tentativo'}</button>`}<button class="text-button" data-action="reuse">Modifica il brief</button>${!['queued', 'running'].includes(j.status) ? `<button class="text-button" data-action="archive">${j.archived ? 'Ripristina' : 'Archivia'}</button>` : ''}</div>`;
  $('#followup-form')?.addEventListener('submit', e => { e.preventDefault(); try { const next = ws.followUp(j.id, $('#followup').value); selected = next.id; render(); void pump(); toast('Nuovo passo creato con il contesto precedente.'); } catch (err) { toast(err.message); } });
  $('#lesson-form')?.addEventListener('submit', e => { e.preventDefault(); try { ws.remember($('#lesson').value, j.id); $('#lesson').value = ''; toast('Nota approvata e salvata.'); } catch (err) { toast(err.message); } });
}
function renderMemory() {
  const sig = JSON.stringify(ws.state.memory); if (sig === memorySignature) return; memorySignature = sig;
  $('#memory-list').innerHTML = ws.state.memory.length ? ws.state.memory.map(m => `<article class="memory-item ${m.enabled ? '' : 'disabled'}"><p>${esc(m.text)}</p><small>Approvata ${esc(when(m.approvedAt))}${m.source ? ' · da un incarico' : ' · nota personale'}</small><button class="text-button" data-memory-toggle="${esc(m.id)}">${m.enabled ? 'Disattiva' : 'Riattiva'}</button></article>`).join('') : '<p class="muted">Nessuna memoria approvata. Nessuna lezione inventata.</p>';
  $('#memory-select').innerHTML = ws.state.memory.some(m => m.enabled) ? `<p class="muted">Note da includere nel gateway personale:</p>${ws.state.memory.filter(m => m.enabled).map(m => `<label class="check-label"><input type="checkbox" data-memory-select="${esc(m.id)}">${esc(m.text.slice(0, 100))}</label>`).join('')}` : '';
}
function renderDetails(m) {
  $('#metrics').innerHTML = [[m.total, 'incarichi salvati'], [m.ready, 'risposte disponibili'], [m.reviewed, 'revisioni con modello distinto'], [m.ratings ? `${m.helpful}/${m.ratings}` : '—', 'feedback utili / ricevuti']].map(([n, label]) => `<article><strong>${n}</strong><span>${label}</span></article>`).join('');
  $('#connection-status').innerHTML = `<p class="notice ${runtime.health?.reachable ? '' : 'error'}">${runtime.health?.reachable ? ws.state.settings.mode === 'legacy' ? 'Il vecchio gateway è raggiungibile. Il controllo di connessione non verifica i provider AI. Accesso pubblico e nessun connettore operativo.' : runtime.health.ready ? 'Il gateway risponde. Le richieste richiedono una sessione valida.' : 'Il gateway risponde ma deve essere configurato.' : 'Connessione al motore non confermata. Puoi conservare bozze e leggere lo storico.'}</p>`;
  const observed = ws.state.jobs.flatMap(j => j.contributions || []).filter(c => c.model && c.model !== 'Non dichiarato');
  const models = [...new Map(observed.map(c => [`${c.provider}/${c.model}`, c])).values()];
  $('#model-observed').innerHTML = models.length ? `<p class="eyebrow">MODELLI CHE HANNO RISPOSTO</p>${models.map(c => `<p class="model-row"><b>${esc(c.model)}</b><small>${esc(c.provider)}</small></p>`).join('')}` : '<p class="muted">Il primo risultato mostrerà il modello effettivamente dichiarato dal servizio.</p>';
  const groups = new Map();
  for (const j of ws.state.jobs.filter(j => j.rating != null && j.result && !j.migrated)) { const model = j.provenance?.model; if (!model || model === 'Non dichiarato') continue; const g = groups.get(model) || { count: 0, useful: 0 }; g.count++; if (j.rating === 1) g.useful++; groups.set(model, g); }
  $('#league').innerHTML = groups.size ? [...groups].map(([n, v]) => `<div class="league-row"><b>${esc(n)}</b><span>${v.useful}/${v.count} utili${v.count < 5 ? ' · campione piccolo' : ''}</span></div>`).join('') : '<div class="league-empty"><span>♛</span><p>Nessun vincitore assegnato.</p><small>Servono risposte effettive e valutazioni del proprietario.</small></div>';
  $('#audit').innerHTML = ws.state.events.slice(0, 40).map(e => `<div><time>${esc(when(e.at))}</time><b>${esc(e.type)}</b><span>${esc(e.detail)}</span></div>`).join('') || '<p class="muted">Nessun evento registrato.</p>';
}
function download(name, text, type = 'text/plain;charset=utf-8') { const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function openAgent(id) {
  const a = AGENTS.find(a => a.id === id); if (!a) return;
  const past = ws.state.jobs.flatMap(j => (j.contributions || []).filter(c => c.agent === id));
  $('#agent-dialog').innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="Chiudi scheda">×</button><span class="large-avatar" style="--agent:${a.color}">${a.icon}</span><p class="eyebrow">${a.role}</p><h2 id="agent-title">${a.id}</h2><p>${esc(a.description)}</p><div class="notice">${past.length ? `Ultimo modello dichiarato: ${esc(past[0].model || 'Non dichiarato')}` : 'Nessuna esecuzione registrata per questo ruolo.'}</div><blockquote>${a.quirk}</blockquote><button class="secondary" data-action="agent-brief" data-agent-name="${id}">Prepara un incarico</button>`;
  $('#agent-dialog').showModal();
}

$('#brief-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
$('#brief').addEventListener('input', () => { planPreview(); clearTimeout(planPreview.timer); planPreview.timer = setTimeout(() => { ws.state.draft = $('#brief').value; ws.save(); }, 400); });
$('#search').addEventListener('input', e => { search = e.target.value.toLocaleLowerCase('it'); renderJobs(); });
$('#filter').addEventListener('change', e => { filter = e.target.value; renderJobs(); });
$('#engine').addEventListener('change', e => { $('#secure-fields').hidden = e.target.value !== 'secure'; });
$('#settings-form').addEventListener('submit', e => {
  e.preventDefault(); const old = { ...ws.state.settings };
  try { ws.state.settings.mode = $('#engine').value; if ($('#engine').value === 'secure') ws.state.settings.api = $('#gateway-url').value; runtime.api(); runtime.configureToken($('#session-token').value); $('#session-token').value = ''; ws.save(); void runtime.check(); toast('Configurazione applicata. Il token resta solo in questa pagina.'); }
  catch (err) { ws.state.settings = old; toast(err.message); }
});
$('#memory-form').addEventListener('submit', e => { e.preventDefault(); try { ws.remember($('#memory-text').value); $('#memory-text').value = ''; toast('Nota approvata.'); } catch (err) { toast(err.message); } });
$('#import-file').addEventListener('change', async e => {
  try { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5000000) throw Error('Archivio oltre 5 MB.'); importCandidate = validateArchive(JSON.parse(await file.text())); $('#import-review').innerHTML = `<p>${importCandidate.jobs.length} incarichi e ${importCandidate.memory.length} note. Gli ID già presenti e la configurazione di accesso saranno conservati.</p><button class="secondary" data-action="confirm-import">Unisci all’archivio</button>`; }
  catch (err) { toast(err.message); importCandidate = null; }
  e.target.value = '';
});
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.view) return show(b.dataset.view);
  if (b.dataset.agent) return openAgent(b.dataset.agent);
  if (b.dataset.job) { selected = b.dataset.job; render(); if (matchMedia('(max-width:760px)').matches) $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (b.dataset.projectFilter !== undefined) { search = b.dataset.projectFilter.toLocaleLowerCase('it'); $('#search').value = b.dataset.projectFilter; renderJobs(); return; }
  if (b.dataset.removeMaterial !== undefined) { materials.splice(Number(b.dataset.removeMaterial), 1); ws.state.draftMaterials = materials; ws.save(); renderMaterials(); return; }
  if (b.dataset.example) { $('#brief').value = b.dataset.example; planPreview(); $('#brief').focus(); return; }
  if (b.dataset.memoryToggle) { const m = ws.state.memory.find(m => m.id === b.dataset.memoryToggle); if (m) { m.enabled = !m.enabled; ws.save(); } return; }
  const j = selectedJob();
  try {
    switch (b.dataset.action) {
      case 'new-brief': $('#brief').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#brief').focus({ preventScroll: true }); break;
      case 'desk': $('#desk').scrollIntoView({ behavior: 'smooth' }); break;
      case 'team': $('.room').scrollIntoView({ behavior: 'smooth' }); break;
      case 'accept-result': if (j) { ws.decide(j.id, 'accepted'); toast('Risultato approvato.'); } break;
      case 'revise-result': if (j) { ws.decide(j.id, 'revise'); $('#followup')?.focus(); } break;
      case 'draft': submit(true); break;
      case 'health': void runtime.check(); break;
      case 'resume': ws.state.settings.paused = false; ws.save(); void pump(); break;
      case 'stop': runtime.stopAll(); toast('Ufficio fermato. Gli incarichi annullati restano disponibili per un nuovo tentativo.'); break;
      case 'cancel': if (j) runtime.cancel(j.id); break;
      case 'retry': if (j) { const next = ws.retry(j.id); if (next) { selected = next.id; render(); void pump(); } } break;
      case 'reuse': if (j) { show('office'); $('#brief').value = j.text; $('#sensitivity').value = j.sensitivity || 'public'; $('#area').value = j.area || 'auto'; $('#project').value = j.project || ''; $('#review-mode').value = j.reviewMode || 'fast'; materials = (j.materials || []).map(m => ({ ...m })); renderMaterials(); planPreview(); $('#brief').focus(); } break;
      case 'archive': if (j && !['queued', 'running'].includes(j.status)) ws.patch(j.id, { archived: !j.archived }); break;
      case 'copy': if (j?.result) { await navigator.clipboard.writeText(j.result); toast('Risultato copiato.'); } break;
      case 'export-job': if (j) download(`the-office-${j.id.replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.md`, toMarkdown(j), 'text/markdown;charset=utf-8'); break;
      case 'good': if (j) ws.rate(j.id, 1); break;
      case 'bad': if (j) ws.rate(j.id, -1); break;
      case 'coffee': toast(AGENTS[Math.floor(Math.random() * AGENTS.length)].quirk); break;
      case 'logout': runtime.configureToken(''); toast('Sessione personale scollegata.'); break;
      case 'export-all': download('the-office-archivio.json', JSON.stringify({ ...ws.state, settings: { paused: true, mode: 'legacy' } }, null, 2), 'application/json'); break;
      case 'raw-export': download('the-office-dati-originali.json', JSON.stringify({ current: storage.getItem(STORE_KEY), previous: storage.getItem('the-office:runtime-free:v1') }, null, 2), 'application/json'); break;
      case 'confirm-import': {
        if (!importCandidate) break;
        const existing = new Set(ws.state.jobs.map(j => j.id)), notes = new Set(ws.state.memory.map(m => m.id));
        const additions = importCandidate.jobs.filter(j => !existing.has(j.id)), newNotes = importCandidate.memory.filter(m => !notes.has(m.id));
        if (ws.state.jobs.length + additions.length > 250 || ws.state.memory.length + newNotes.length > 200) throw Error('L’unione supera il limite di 250 incarichi o 200 note.');
        ws.state.jobs.push(...additions); ws.state.memory.push(...newNotes); ws.event('archive-imported', null, `${additions.length} incarichi`); ws.save();
        importCandidate = null; $('#import-review').innerHTML = ''; toast('Archivio unito. Nessuna richiesta avviata; note importate disattivate.'); break;
      }
      case 'close-dialog': $('#agent-dialog').close(); break;
      case 'agent-brief': $('#agent-dialog').close(); show('office'); $('#brief').value = `Prepara un incarico per ${b.dataset.agentName}: `; $('#brief').focus(); planPreview(); break;
      case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    }
  } catch (err) { toast(err.message || 'Operazione non riuscita.'); }
});
window.addEventListener('storage', e => { if (e.key === STORE_KEY) ws.refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { ws.refresh(); void pump(); } });
ws.subscribe(render); render(); renderMaterials(); planPreview();
await runtime.recover(); void runtime.check(); void pump();
setInterval(() => { if (!document.hidden) void pump(); }, 10000);

function renderMaterials() {
  $('#materials-list').innerHTML = materials.map((m, i) => `<div class="material-row"><span>▤ ${esc(m.name)}<small>${m.text.length.toLocaleString('it-IT')} caratteri</small></span><button type="button" class="text-button" data-remove-material="${i}" aria-label="Rimuovi ${esc(m.name)}">×</button></div>`).join('');
}
function renderProjects() {
  const counts = new Map();
  for (const j of ws.state.jobs.filter(j => !j.archived && j.project)) counts.set(j.project, (counts.get(j.project) || 0) + 1);
  $('#project-chips').innerHTML = counts.size ? `<span>PROGETTI</span><button data-project-filter="">Tutti</button>${[...counts].slice(0, 12).map(([name, n]) => `<button data-project-filter="${esc(name)}">${esc(name)} <b>${n}</b></button>`).join('')}` : '';
}
$('#material-file').addEventListener('change', async e => {
  try {
    const files = [...e.target.files];
    if (files.length + materials.length > 4) throw Error('Puoi aggiungere fino a quattro file di testo.');
    const added = [];
    for (const f of files) { if (f.size > 64000) throw Error('File oltre 64 KB. Riduci il testo prima di allegarlo.'); added.push(validateMaterial(f.name, await f.text())); }
    if ([...materials, ...added].reduce((n, m) => n + m.text.length, 0) > MAX_MATERIAL) throw Error('I materiali possono contenere al massimo 12.000 caratteri in totale.');
    materials.push(...added); ws.state.draftMaterials = materials; ws.save(); renderMaterials(); toast('Materiale letto e aggiunto al brief. Verrà inviato quando affidi il lavoro.');
  } catch (err) { toast(err.message); }
  e.target.value = '';
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.activeElement === $('#brief')) { e.preventDefault(); submit(); }
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !$('#agent-dialog').open) { e.preventDefault(); show('office'); $('#brief').focus(); }
});

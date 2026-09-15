import { LEGACY_API } from './core.mjs';

let liveBoard = null;
let loading = false;

function row(agent, data) {
  const wrap = document.createElement('p');
  wrap.className = 'model-row';
  const name = document.createElement('b');
  name.textContent = agent;
  const detail = document.createElement('small');
  const preferred = data?.preferred || {};
  detail.textContent = `${data?.purpose || 'Ruolo operativo'} · preferito: ${preferred.provider || '—'} / ${preferred.model || '—'}`;
  wrap.append(name, detail);
  return wrap;
}

function render() {
  const host = document.querySelector('#model-observed');
  if (!host || !liveBoard?.roleRouting || host.querySelector('[data-model-board-live]')) return;

  const section = document.createElement('section');
  section.dataset.modelBoardLive = 'true';
  section.className = 'model-board-live';

  const title = document.createElement('p');
  title.className = 'eyebrow';
  title.textContent = `MODEL BOARD ATTIVO · ${liveBoard.modelBoardVersion || 'versione non dichiarata'}`;
  section.append(title);

  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = 'Questi sono i modelli preferiti per ruolo. Il modello realmente usato può essere un fallback e viene mostrato separatamente nello storico dei risultati.';
  section.append(note);

  for (const [agent, data] of Object.entries(liveBoard.modelBoard || {})) section.append(row(agent, data));

  const actual = document.createElement('p');
  actual.className = 'eyebrow';
  actual.textContent = 'MODELLI CHE HANNO RISPOSTO DAVVERO';
  section.append(actual);

  host.prepend(section);
}

async function load() {
  if (loading || liveBoard) return;
  loading = true;
  try {
    const response = await fetch(`${LEGACY_API}/health`, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) return;
    const data = await response.json();
    if (data?.zeroCost === true && data?.roleRouting === true && data?.modelBoard) liveBoard = data;
  } catch { /* The main UI already reports gateway reachability. */ }
  finally { loading = false; render(); }
}

const observer = new MutationObserver(() => queueMicrotask(render));
const app = document.querySelector('#app');
if (app) observer.observe(app, { childList: true, subtree: true });
void load();

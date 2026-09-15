import { STORE_KEY } from './core.mjs';
import { performanceBoard } from './performance.mjs';

function loadJobs() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    return Array.isArray(state?.jobs) ? state.jobs : [];
  } catch { return []; }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const host = document.querySelector('#league');
  if (!host) return;
  const rows = performanceBoard(loadJobs()).filter(r => r.calls || r.failures || r.evidence);
  const signature = JSON.stringify(rows.map(r => [r.agent, r.calls, r.failures, r.evidence, r.score, r.topModel]));
  if (host.dataset.performanceSignature === signature && host.querySelector('[data-performance-board]')) return;
  host.dataset.performanceSignature = signature;

  if (!rows.length) {
    host.innerHTML = '<div data-performance-board class="league-empty"><span>♛</span><p>Nessun ranking ancora.</p><small>Servono Tavole Rotonde reali e feedback del proprietario. Nessun punteggio viene inventato.</small></div>';
    return;
  }

  rows.sort((a, b) => b.score - a.score || b.evidence - a.evidence || b.calls - a.calls || a.agent.localeCompare(b.agent));
  host.innerHTML = `<div data-performance-board>
    <p class="muted">Ranking locale deterministico: fit del compito, affidabilità tecnica e feedback espliciti. Non è accuratezza e non è machine learning.</p>
    ${rows.map(r => `<div class="league-row"><b>${esc(r.agent)} <small>${esc(r.role)}</small></b><span>Indice ${r.score}/100 · ${r.calls} chiamate · affidabilità ${Math.round(r.reliability * 100)}%${r.evidence ? ` · ${r.evidence} segnali qualità` : ' · nessun feedback'}${r.topModel ? `<br><small>Più usato: ${esc(r.topModel)}</small>` : ''}</span></div>`).join('')}
  </div>`;
}

const observer = new MutationObserver(() => queueMicrotask(render));
const app = document.querySelector('#app');
if (app) observer.observe(app, { childList: true, subtree: true });
window.addEventListener('storage', render);
window.addEventListener('focus', render);
void render();

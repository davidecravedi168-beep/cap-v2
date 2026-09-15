import { LEGACY_API } from './core.mjs';
import { CostPolicy } from './cost-policy.mjs';
import { OPENROUTER_MODEL, clearOpenRouterKey, getOpenRouterKey, openRouterFreeFallback, setOpenRouterKey } from './free-fallback.mjs';

const PUBLIC_JOB_URL = `${String(LEGACY_API).replace(/\/$/, '')}/v1/jobs`;
const nativeFetch = globalThis.fetch?.bind(globalThis);
const costPolicy = new CostPolicy();
let installed = false;

function isPublicJobRequest(input) {
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    return new URL(raw, globalThis.location?.href).href === PUBLIC_JOB_URL;
  } catch { return false; }
}

function requestedAgent(payload) {
  const team = [...new Set((Array.isArray(payload?.team) ? payload.team : []).filter(Boolean))];
  return team.length === 1 ? team[0] : 'Direttore';
}

export function installOpenRouterFreeFailover({ fetcher = nativeFetch } = {}) {
  if (installed || !fetcher || typeof globalThis.fetch !== 'function') return;
  installed = true;
  globalThis.fetch = async (input, init = {}) => {
    const response = await fetcher(input, init);
    if (!isPublicJobRequest(input) || response.status !== 503 || !getOpenRouterKey()) return response;
    let payload = null;
    try { payload = JSON.parse(String(init?.body || '')); } catch { return response; }
    try {
      if (OPENROUTER_MODEL !== 'openrouter/free') throw Error('Il fallback non è più vincolato al router gratuito.');
      costPolicy.assert({ service: OPENROUTER_MODEL, zeroCost: true, estimatedCredits: 0, metered: false });
      const fallback = await openRouterFreeFallback({
        text: payload?.text,
        agent: requestedAgent(payload),
        signal: init?.signal,
        fetcher,
      });
      if (!fallback) return response;
      return new Response(JSON.stringify({ id: payload?.id || null, ...fallback }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-the-office-fallback': 'openrouter-free' },
      });
    } catch {
      return response;
    }
  };
}

function showToast(text) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function injectControls() {
  if (typeof document === 'undefined' || document.querySelector('#openrouter-free-box')) return false;
  const form = document.querySelector('#settings-form');
  if (!form) return false;
  const box = document.createElement('div');
  box.id = 'openrouter-free-box';
  box.className = 'notice';
  box.innerHTML = `<b>Fallback gratuito opzionale</b><p class="muted">Se il motore pubblico non risponde, usa <code>openrouter/free</code> con una tua chiave. La chiave resta soltanto nella sessione di questa scheda, non entra nell’archivio ed è inviata direttamente a OpenRouter.</p><p class="muted"><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">Crea o gestisci una key OpenRouter ↗</a> · il tier gratuito applica limiti propri di richieste.</p><label>Chiave OpenRouter<input type="password" id="openrouter-free-key" autocomplete="off" placeholder="sk-or-…"></label><div class="button-row"><button type="button" class="secondary" id="openrouter-free-connect">Collega fallback</button><button type="button" class="text-button" id="openrouter-free-disconnect">Scollega</button></div><small id="openrouter-free-status"></small>`;
  const submit = form.querySelector('button[type="submit"]');
  form.insertBefore(box, submit || null);
  const input = box.querySelector('#openrouter-free-key');
  const status = box.querySelector('#openrouter-free-status');
  const refresh = () => { status.textContent = getOpenRouterKey() ? 'OpenRouter Free collegato per questa scheda.' : 'OpenRouter Free non collegato.'; };
  box.querySelector('#openrouter-free-connect').addEventListener('click', () => {
    try { setOpenRouterKey(input.value); input.value = ''; refresh(); showToast('Fallback OpenRouter Free collegato per questa sessione.'); }
    catch (e) { status.textContent = e.message || 'Chiave non valida.'; }
  });
  box.querySelector('#openrouter-free-disconnect').addEventListener('click', () => { clearOpenRouterKey(); input.value = ''; refresh(); showToast('Fallback OpenRouter scollegato.'); });
  refresh();
  return true;
}

installOpenRouterFreeFailover();
if (!injectControls() && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  const observer = new MutationObserver(() => { if (injectControls()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

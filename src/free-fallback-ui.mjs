import { LEGACY_API } from './core.mjs';
import { clearOpenRouterKey, getOpenRouterKey, openRouterFreeFallback, setOpenRouterKey } from './free-fallback.mjs';

const PUBLIC_JOB_URL = `${String(LEGACY_API).replace(/\/$/, '')}/v1/jobs`;
const nativeFetch = globalThis.fetch?.bind(globalThis);
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

function injectControls() {
  if (typeof document === 'undefined' || document.querySelector('#openrouter-free-box')) return false;
  const form = document.querySelector('#settings-form');
  if (!form) return false;
  const box = document.createElement('div');
  box.id = 'openrouter-free-box';
  box.className = 'notice';
  box.innerHTML = `<b>Fallback gratuito opzionale</b><p class="muted">Se i motori pubblici non rispondono, usa <code>openrouter/free</code> con una tua chiave. La chiave resta soltanto nella sessione di questa scheda e viene inviata direttamente a OpenRouter.</p><label>Chiave OpenRouter<input type="password" id="openrouter-free-key" autocomplete="off" placeholder="sk-or-…"></label><div class="button-row"><button type="button" class="secondary" id="openrouter-free-connect">Collega fallback</button><button type="button" class="text-button" id="openrouter-free-disconnect">Scollega</button></div><small id="openrouter-free-status"></small>`;
  const submit = form.querySelector('button[type="submit"]');
  form.insertBefore(box, submit || null);
  const input = box.querySelector('#openrouter-free-key');
  const status = box.querySelector('#openrouter-free-status');
  const refresh = () => { status.textContent = getOpenRouterKey() ? 'OpenRouter Free collegato per questa scheda.' : 'OpenRouter Free non collegato.'; };
  box.querySelector('#openrouter-free-connect').addEventListener('click', () => {
    try {
      setOpenRouterKey(input.value);
      input.value = '';
      refresh();
      document.querySelector('#toast')?.classList.add('show');
      if (document.querySelector('#toast')) document.querySelector('#toast').textContent = 'Fallback OpenRouter Free collegato per questa sessione.';
    } catch (e) { status.textContent = e.message || 'Chiave non valida.'; }
  });
  box.querySelector('#openrouter-free-disconnect').addEventListener('click', () => { clearOpenRouterKey(); input.value = ''; refresh(); });
  refresh();
  return true;
}

installOpenRouterFreeFailover();
if (!injectControls() && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  const observer = new MutationObserver(() => { if (injectControls()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

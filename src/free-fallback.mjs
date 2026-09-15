export const OPENROUTER_SESSION_KEY = 'the-office:openrouter-free-key:v1';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_MODEL = 'openrouter/free';

export function normaliseOpenRouterKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (key.length > 400 || /\s/.test(key) || !/^sk-or-/i.test(key)) throw Error('Chiave OpenRouter non valida. Deve iniziare con sk-or-.');
  return key;
}

export function getOpenRouterKey(storage = globalThis.sessionStorage) {
  try { return normaliseOpenRouterKey(storage?.getItem?.(OPENROUTER_SESSION_KEY) || ''); }
  catch { return ''; }
}

export function setOpenRouterKey(value, storage = globalThis.sessionStorage) {
  const key = normaliseOpenRouterKey(value);
  if (!key) throw Error('Inserisci una chiave OpenRouter.');
  storage?.setItem?.(OPENROUTER_SESSION_KEY, key);
  return true;
}

export function clearOpenRouterKey(storage = globalThis.sessionStorage) {
  try { storage?.removeItem?.(OPENROUTER_SESSION_KEY); } catch { /* session storage unavailable */ }
}

function providerErrorText(text) {
  const s = String(text || '').trim();
  return /rate limit|quota|insufficient|payment required|billing|credits?|capacity|overloaded|temporarily unavailable/i.test(s);
}

export async function openRouterFreeFallback({ text, agent = 'Direttore', signal, fetcher = (...args) => globalThis.fetch(...args), storage = globalThis.sessionStorage } = {}) {
  const key = getOpenRouterKey(storage);
  if (!key) return null;
  const prompt = String(text || '').trim();
  if (!prompt) throw Error('Fallback OpenRouter: incarico vuoto.');
  const response = await fetcher(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://davidecravedi168-beep.github.io/cap-v2/',
      'X-OpenRouter-Title': 'The Office',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: `Sei ${agent} di The Office. Rispondi in italiano salvo richiesta diversa. Non fingere browsing, strumenti o azioni esterne. Il modello richiesto è esclusivamente il router gratuito OpenRouter.` },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1700,
      temperature: 0.2,
    }),
    signal,
    credentials: 'omit',
    cache: 'no-store',
  });
  const raw = await response.text();
  let data = {};
  try { data = JSON.parse(raw); } catch { /* handled below */ }
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || raw || `HTTP ${response.status}`;
    throw Error(`OpenRouter Free: ${String(detail).slice(0, 240)}`);
  }
  const answer = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
  if (!String(answer).trim() || providerErrorText(answer)) throw Error('OpenRouter Free: risposta non valida o capacità gratuita non disponibile.');
  const model = String(data?.model || OPENROUTER_MODEL);
  return {
    status: 'completed',
    zeroCost: true,
    result: String(answer),
    provider: 'OpenRouter Free',
    model,
    routedAgent: agent,
    qualityReport: `${agent} ha lavorato tramite OpenRouter Free (${model}). Modello richiesto: ${OPENROUTER_MODEL}; costo token dichiarato dal router: zero. Nessuna azione esterna eseguita.`,
    contributions: [{ agent, provider: 'OpenRouter Free', model, text: String(answer) }],
    failures: [],
  };
}

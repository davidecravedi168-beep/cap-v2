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

export function isOpenRouterProviderErrorText(text) {
  const s = String(text || '').trim();
  if (!s || s.length > 1400) return false;
  return /rate limit (?:has been )?exceeded|quota (?:has been )?exceeded|insufficient (?:credits?|balance)|payment required|billing limit|capacity (?:is )?(?:unavailable|exhausted)|temporarily unavailable|service overloaded/i.test(s);
}

export function isTruncatedFinishReason(value) {
  return ['length', 'max_tokens', 'max_output_tokens'].includes(String(value || '').toLowerCase());
}

function joinContinuation(first, second) {
  const a = String(first || '').trimEnd();
  const b = String(second || '');
  if (!a) return b.trim();
  if (!b.trim()) return a;
  return /^\s/.test(b) ? `${a}${b}` : `${a}\n\n${b.trimStart()}`;
}

async function requestOpenRouter({ key, messages, maxTokens, signal, fetcher }) {
  const response = await fetcher(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://davidecravedi168-beep.github.io/cap-v2/',
      'X-OpenRouter-Title': 'The Office',
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages, max_tokens: maxTokens, temperature: 0.2 }),
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
  if (!String(answer).trim() || isOpenRouterProviderErrorText(answer)) throw Error('OpenRouter Free: risposta non valida o capacità gratuita non disponibile.');
  return {
    text: String(answer),
    model: String(data?.model || OPENROUTER_MODEL),
    finishReason: String(data?.choices?.[0]?.finish_reason || ''),
  };
}

export async function openRouterFreeFallback({ text, agent = 'Direttore', signal, fetcher = (...args) => globalThis.fetch(...args), storage = globalThis.sessionStorage } = {}) {
  const key = getOpenRouterKey(storage);
  if (!key) return null;
  const prompt = String(text || '').trim();
  if (!prompt) throw Error('Fallback OpenRouter: incarico vuoto.');
  const system = `Sei ${agent} di The Office. Rispondi in italiano salvo richiesta diversa. Non fingere browsing, strumenti o azioni esterne. Il modello richiesto è esclusivamente il router gratuito OpenRouter. Concludi la risposta: non fermarti a un piano se la richiesta chiede un risultato.`;
  const baseMessages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
  const first = await requestOpenRouter({ key, messages: baseMessages, maxTokens: 2400, signal, fetcher });
  let result = first.text;
  let final = first;
  let continued = false;
  if (isTruncatedFinishReason(first.finishReason)) {
    continued = true;
    const second = await requestOpenRouter({
      key,
      messages: [
        ...baseMessages,
        { role: 'assistant', content: first.text },
        { role: 'user', content: 'La risposta precedente è stata interrotta dal limite di output. Continua ESATTAMENTE dal punto in cui si è fermata, senza ripetere introduzione o parti già scritte, e porta a termine la richiesta.' },
      ],
      maxTokens: 1400,
      signal,
      fetcher,
    });
    result = joinContinuation(first.text, second.text);
    final = second;
  }
  const truncated = isTruncatedFinishReason(final.finishReason);
  const model = final.model || first.model;
  return {
    status: truncated ? 'partial' : 'completed',
    zeroCost: true,
    result,
    provider: 'OpenRouter Free',
    model,
    routedAgent: agent,
    completion: { continued, truncated, finishReason: final.finishReason || null },
    qualityReport: `${agent} ha lavorato tramite OpenRouter Free (${model}). Modello richiesto: ${OPENROUTER_MODEL}; costo token dichiarato dal router: zero.${continued ? ' Output continuato automaticamente dopo un limite del provider.' : ''}${truncated ? ' Il provider ha raggiunto di nuovo il limite: risultato marcato parziale.' : ''} Nessuna azione esterna eseguita.`,
    contributions: [{ agent, provider: 'OpenRouter Free', model, text: result }],
    failures: [],
  };
}

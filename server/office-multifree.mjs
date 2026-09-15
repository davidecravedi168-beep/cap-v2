const ORIGIN = 'https://davidecravedi168-beep.github.io';
const VIREONIX_URL = 'https://vireonix.ai/v1/chat/completions';

// Keep the public gateway below the browser's 30s public-request ceiling.
const HARD_DEADLINE_MS = 27500;
const ATTEMPT_MS = 16000;
const FIRST_MAX_TOKENS = 1800;
const CONTINUATION_MAX_TOKENS = 900;
export const MODEL_BOARD_VERSION = '2026-09-15-v5';

const V = () => ({ provider: 'Vireonix', url: VIREONIX_URL, model: 'auto', targetMs: ATTEMPT_MS });

export const ROLE_MODEL_BOARD = {
  Direttore: { purpose: 'orchestrazione e sintesi', route: [V()] },
  Lumen: { purpose: 'ricerca sui materiali forniti e verifica', route: [V()] },
  Coda: { purpose: 'coding, documenti e costruzione', route: [V()] },
  Mosaic: { purpose: 'materiali e multimodale quando l’input lo consente', route: [V()] },
  Sage: { purpose: 'strategia e scenari', route: [V()] },
  Aegis: { purpose: 'sicurezza, rischio e controlli', route: [V()] },
  Verity: { purpose: 'controprova indipendente', route: [V()] },
  Ledger: { purpose: 'numeri e finanza', route: [V()] },
  Archivist: { purpose: 'memoria e sintesi del contesto fornito', route: [V()] },
  Qualita: { purpose: 'quality gate', route: [V()] },
};

export function routeForAgent(agent) { return ROLE_MODEL_BOARD[agent] || ROLE_MODEL_BOARD.Direttore; }

const ROLE_RULES = {
  Direttore: 'Coordina e sintetizza. Consegna un risultato pratico e conciso.',
  Lumen: 'Lavora solo sui dati e sulle fonti incluse nel prompt. Non fingere browsing o fonti non fornite.',
  Coda: 'Produci artefatti, codice o testi concreti. Segnala ciò che non puoi eseguire.',
  Mosaic: 'Organizza i materiali ricevuti. Non dichiarare di aver visto immagini/PDF se nel prompt non sono presenti contenuti multimodali reali.',
  Sage: 'Confronta scenari, alternative, vincoli e conseguenze.',
  Aegis: 'Cerca rischi, permessi mancanti, failure mode e problemi di sicurezza.',
  Verity: 'Agisci da revisore severo: cerca errori, assunzioni e controesempi. Non approvare per cortesia.',
  Ledger: 'Esplicita ipotesi, unità, passaggi e controlli numerici. In finanza non promettere rendimenti certi o trasformazioni garantite del capitale.',
  Archivist: 'Riassumi solo il contesto fornito. Non inventare memoria persistente o accessi.',
  Qualita: 'Esegui un quality gate indipendente e segnala difetti concreti.',
};

function cors(req) {
  const origin = req.headers.get('origin') || '';
  if (origin && origin !== ORIGIN) return null;
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': origin || ORIGIN,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'cache-control': 'no-store',
  };
}
function json(data, status, headers) { return new Response(JSON.stringify(data), { status, headers }); }

export function isProviderErrorText(text) {
  const s = String(text || '').trim();
  if (!s || s.length > 1800) return false;
  return /the api key used for this request has reached its budget|raise the key budget|topping up the wallet does not raise this limit|insufficient (?:credits?|balance)|quota (?:has been )?exceeded|rate limit exceeded|billing limit|payment required/i.test(s);
}

export function isTruncatedFinishReason(value) {
  return ['length', 'max_tokens', 'max_output_tokens'].includes(String(value || '').toLowerCase());
}

function safeReason(provider, error) {
  const m = String(error?.message || error || '').toLowerCase();
  if (m.includes('budget') || m.includes('credit') || m.includes('billing') || m.includes('payment required') || m.includes('402')) return `${provider}: pagamento o budget non disponibile`;
  if (m.includes('capacity') || m.includes('exhausted') || m.includes('overloaded') || m.includes('503')) return `${provider}: capacità gratuita occupata`;
  if (m.includes('429') || m.includes('rate') || m.includes('quota')) return `${provider}: limite gratuito temporaneo`;
  if (m.includes('401') || m.includes('403') || m.includes('auth')) return `${provider}: accesso gratuito non disponibile`;
  if (m.includes('timeout') || m.includes('abort')) return `${provider}: timeout`;
  if (m.includes('empty')) return `${provider}: risposta vuota`;
  return `${provider}: non disponibile`;
}

async function postJson(url, body, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data = {};
    try { data = JSON.parse(raw); } catch { /* handled below */ }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || raw || '';
      throw new Error(`${response.status} ${String(detail)}`.trim());
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function joinContinuation(first, second) {
  const a = String(first || '').trimEnd();
  const b = String(second || '');
  if (!a) return b.trim();
  if (!b.trim()) return a;
  return /^\s/.test(b) ? `${a}${b}` : `${a}\n\n${b.trimStart()}`;
}

async function callAttempt(a, system, user, ms, { previous = '', continuation = false } = {}) {
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  if (continuation) {
    messages.push(
      { role: 'assistant', content: previous },
      { role: 'user', content: 'La risposta precedente è stata interrotta dal limite di output. Continua ESATTAMENTE dal punto in cui si è fermata, senza ripetere introduzione o parti già scritte, e porta a termine la richiesta.' },
    );
  }
  const data = await postJson(a.url, {
    model: a.model,
    messages,
    max_tokens: continuation ? CONTINUATION_MAX_TOKENS : FIRST_MAX_TOKENS,
    temperature: 0.2,
  }, ms);
  const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
  if (!String(text).trim()) throw new Error(`${a.provider} empty response`);
  if (isProviderErrorText(text)) throw new Error(`${a.provider} provider budget or quota response`);
  const finishReason = String(data?.choices?.[0]?.finish_reason || '');
  return {
    provider: a.provider,
    model: data?.model || a.model,
    text: String(text),
    finishReason,
    truncated: isTruncatedFinishReason(finishReason),
  };
}

function systemPrompt(agent) {
  return `Sei ${agent} di The Office. ${ROLE_RULES[agent] || ROLE_RULES.Direttore}\nRegole invariabili:\n- costo richiesto: zero;\n- non fingere browsing, strumenti, accessi, memoria, file o azioni esterne;\n- separa fatti, ipotesi e dati mancanti quando serve;\n- se il compito richiede una capacità non realmente disponibile, dichiaralo;\n- porta a termine la richiesta: non fermarti a un piano se l'utente chiede un risultato;\n- privilegia una risposta completa e compatta rispetto a una risposta lunga ma interrotta;\n- rispondi in italiano salvo richiesta diversa.`;
}

async function continueIfNeeded(attempt, agent, user, first, failures, deadline) {
  if (!first.truncated) return { ...first, agent, failures, continued: false };
  const remaining = deadline - Date.now() - 350;
  if (remaining < 2200) {
    failures.push({ provider: attempt.provider, model: attempt.model, error: `${attempt.provider}: output troncato, finestra di continuazione esaurita` });
    return { ...first, agent, failures, continued: false };
  }
  try {
    const second = await callAttempt(
      attempt,
      systemPrompt(agent),
      user,
      Math.max(2200, Math.min(remaining, 9500)),
      { previous: first.text, continuation: true },
    );
    return {
      ...second,
      text: joinContinuation(first.text, second.text),
      agent,
      failures,
      continued: true,
    };
  } catch (error) {
    failures.push({ provider: attempt.provider, model: attempt.model, error: `${attempt.provider}: continuazione non riuscita (${safeReason(attempt.provider, error)})` });
    return { ...first, agent, failures, continued: false };
  }
}

async function resilient(agent, user) {
  const failures = [];
  const deadline = Date.now() + HARD_DEADLINE_MS;
  for (const attempt of routeForAgent(agent).route) {
    const remaining = deadline - Date.now() - 350;
    if (remaining < 2200) break;
    try {
      const first = await callAttempt(attempt, systemPrompt(agent), user, Math.max(2200, Math.min(attempt.targetMs || ATTEMPT_MS, remaining)));
      return await continueIfNeeded(attempt, agent, user, first, failures, deadline);
    } catch (error) {
      failures.push({ provider: attempt.provider, model: attempt.model, error: safeReason(attempt.provider, error) });
      // V10.0.5: one bounded retry on the same zero-cost provider when time remains.
      const retryRemaining = deadline - Date.now() - 350;
      if (retryRemaining >= 2200) {
        try {
          const retry = await callAttempt(attempt, `${systemPrompt(agent)}\nIl tentativo precedente non è arrivato a una risposta valida. Questa volta rispondi in modo più compatto e porta a termine il compito.`, user, Math.max(2200, Math.min(retryRemaining, 9500)));
          return await continueIfNeeded(attempt, agent, user, retry, failures, deadline);
        } catch (retryError) {
          failures.push({ provider: attempt.provider, model: attempt.model, error: `retry: ${safeReason(attempt.provider, retryError)}` });
        }
      }
    }
  }
  const error = new Error('free-engines-unavailable');
  error.failures = failures;
  throw error;
}

function requestedAgent(job) {
  const team = [...new Set((Array.isArray(job?.team) ? job.team : []).filter(Boolean))];
  return team.length === 1 && ROLE_MODEL_BOARD[team[0]] ? team[0] : 'Direttore';
}

async function execute(job) {
  const text = String(job?.text || '').trim();
  if (!text) throw new Error('missing-job-text');
  const agent = requestedAgent(job);
  const result = await resilient(agent, text);
  const preferred = routeForAgent(agent).route[0];
  const status = result.truncated ? 'partial' : 'completed';
  return {
    status,
    result: result.text,
    provider: result.provider,
    model: result.model,
    modelBoardVersion: MODEL_BOARD_VERSION,
    routedAgent: agent,
    preferred: { provider: preferred.provider, model: preferred.model },
    completion: { continued: !!result.continued, truncated: !!result.truncated, finishReason: result.finishReason || null },
    qualityReport: `${agent} ha lavorato tramite ${result.provider} (${result.model}). Routing Model Board ${MODEL_BOARD_VERSION}. Modalità zero-euro.${result.continued ? ' Output continuato automaticamente dopo il limite del provider.' : ''}${result.truncated ? ' Il provider non ha concluso anche dopo la finestra disponibile: risultato marcato parziale.' : ''}${result.failures?.length ? ` Recuperi registrati: ${result.failures.length}.` : ''} Nessuna azione esterna eseguita.`,
    contributions: [{ agent, provider: result.provider, model: result.model, text: result.text }],
    failures: result.failures || [],
  };
}

function publicBoard() {
  return Object.fromEntries(Object.entries(ROLE_MODEL_BOARD).map(([agent, row]) => [agent, {
    purpose: row.purpose,
    preferred: { provider: row.route[0].provider, model: row.route[0].model },
    fallbacks: row.route.slice(1).map(x => ({ provider: x.provider, model: x.model })),
  }]));
}

export default {
  async fetch(req) {
    const headers = cors(req);
    if (!headers) return json({ error: 'origin-not-allowed', zeroCost: true }, 403, { 'content-type': 'application/json' });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        zeroCost: true,
        modelBoardVersion: MODEL_BOARD_VERSION,
        roleRouting: true,
        modelBoard: publicBoard(),
        providers: ['Vireonix'],
        disabledProviders: ['BlockRun: richiede pagamento x402', 'Pollinations: budget key esaurito'],
        strategy: 'role-aware-zero-cost-routing-v5-completion-aware',
        hardDeadlineSeconds: HARD_DEADLINE_MS / 1000,
        completionAware: true,
        retryPolicy: 'one-bounded-zero-cost-retry',
      }, 200, headers);
    }
    if (req.method === 'POST' && url.pathname === '/v1/jobs') {
      try {
        const job = await req.json();
        const out = await execute(job);
        return json({ zeroCost: true, id: job.id || null, ...out }, 200, headers);
      } catch (error) {
        if (String(error?.message || error) === 'missing-job-text') return json({ status: 'failed', zeroCost: true, error: 'Incarico vuoto.' }, 400, headers);
        return json({
          status: 'failed',
          zeroCost: true,
          retryable: true,
          error: 'Il provider gratuito pubblico non ha completato questa richiesta. Nessun costo è stato generato.',
          failures: Array.isArray(error?.failures) ? error.failures : [],
        }, 503, headers);
      }
    }
    return json({ error: 'not-found', zeroCost: true }, 404, headers);
  },
};

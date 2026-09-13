import { createHash, timingSafeEqual } from 'node:crypto';
import { createProvider, executeJob, validateJob, OfficeError } from './engine.mjs';
import { PgStore } from './store.mjs';
const sha = s => createHash('sha256').update(s).digest();
export function createHandler({ token, provider, store, allowedOrigin = 'https://davidecravedi168-beep.github.io', ready = true, deadlineMs = 55000 }) {
  return { async fetch(req) {
    const origin = req.headers.get('origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin',
      ...(origin === allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key' };
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
    if (origin && origin !== allowedOrigin) return json({ error: 'origin-denied' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const path = new URL(req.url).pathname;
    const configured = !!(ready && token?.length >= 32 && provider && store);
    if (req.method === 'GET' && path === '/health') return json({ ok: true, ready: configured, version: '3.0.0', zeroCost: true,
      authentication: 'required', inferenceChecked: false, externalActions: false, webSearch: false, multimodal: false,
      persistence: configured ? 'encrypted-postgres' : 'setup-required', maxJobsPerDay: 20 });
    if (!token || token.length < 32) return json({ error: 'setup-required', message: 'Accesso personale da configurare.' }, 503);
    const auth = req.headers.get('authorization') || '';
    if (auth.length > 512 || !auth.startsWith('Bearer ') || !timingSafeEqual(sha(auth.slice(7)), sha(token))) return json({ error: 'unauthorized', message: 'Sessione personale mancante o non valida.' }, 401);
    if (req.method !== 'POST' || path !== '/v1/jobs') return json({ error: 'not-supported', message: 'Nessun connettore con effetti esterni attivo.' }, 404);
    if (!configured) return json({ error: 'setup-required', message: 'Provider gratuito, cifratura e archivio del server devono essere configurati.' }, 503);
    if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'content-type' }, 415);
    let job, owner, reserved = false;
    try {
      const reader = req.body?.getReader(); if (!reader) throw new OfficeError('invalid-body', 'Richiesta vuota.');
      const decoder = new TextDecoder(); let raw = '', bytes = 0;
      while (true) { const r = await reader.read(); if (r.done) break; bytes += r.value.length; if (bytes > 100000) { await reader.cancel(); throw new OfficeError('too-large', 'Richiesta oltre il limite.', 413); } raw += decoder.decode(r.value, { stream: true }); }
      let parsed; try { parsed = JSON.parse(raw + decoder.decode()); } catch { throw new OfficeError('invalid-json', 'JSON non valido.'); }
      job = validateJob(parsed);
      if (req.headers.get('idempotency-key') !== job.id) throw new OfficeError('invalid-key', 'Identificativo della richiesta non coerente.');
      // Stable owner ID is server defined; token rotation must not reset quotas/history.
      owner = 'office-owner'; const fingerprint = sha(JSON.stringify(job)).toString('hex');
      const claim = await store.reserve(owner, job.id, fingerprint);
      if (claim.cached) return json(claim.cached, claim.cached.error ? 503 : 200);
      reserved = true;
      const signal = AbortSignal.any([req.signal, AbortSignal.timeout(deadlineMs)]);
      const out = await executeJob(job, provider, { signal, checkpoint: value => store.checkpoint(owner, job.id, value) });
      await store.finish(owner, job.id, out); return json({ id: job.id, ...out });
    } catch (e) {
      const publicError = e instanceof OfficeError ? e : new OfficeError('runtime-unavailable', 'Elaborazione non completata. Nessun nuovo tentativo automatico.', 503);
      const result = { status: 'failed', zeroCost: true, error: publicError.code, message: publicError.message, externalActions: false };
      if (reserved) await store.finish(owner, job.id, result, true).catch(() => {});
      return json(result, publicError.status);
    }
  } };
}

let handler;
export default { async fetch(req) {
  if (!handler) {
    const env = process.env;
    const ready = !!(env.OPENROUTER_API_KEY && env.DATABASE_URL && /^[a-f0-9]{64}$/i.test(env.OFFICE_DATA_KEY || '') && env.OFFICE_SESSION_TOKEN?.length >= 32);
    let store = null;
    if (ready) {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: env.DATABASE_URL, max: 3, connectionTimeoutMillis: 8000, statement_timeout: 8000 });
      pool.on('error', () => { /* A failed idle connection is replaced on the next request. Do not log secrets. */ });
      store = new PgStore(pool, Buffer.from(env.OFFICE_DATA_KEY, 'hex'));
    }
    handler = createHandler({ token: env.OFFICE_SESSION_TOKEN, provider: createProvider({ key: env.OPENROUTER_API_KEY, models: (env.OFFICE_FREE_MODELS || '').split(',').filter(Boolean) }), store, ready });
  }
  return handler.fetch(req);
} };

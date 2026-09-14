import { LEGACY_API, detectSensitive, normaliseResponse } from './core.mjs';
import { contextFor } from './context.mjs';
import { roundtable } from './roundtable.mjs';
import { ToolRuntime } from './tool-runtime.mjs';

export class Runtime {
  constructor(workspace, { fetcher = (...args) => globalThis.fetch(...args), timeoutMs = 65000, locks = globalThis.navigator?.locks, tools = null } = {}) {
    this.workspace = workspace; this.fetcher = fetcher; this.timeoutMs = timeoutMs;
    this.locks = locks; this.active = null; this.token = ''; this.health = null; this.checking = false;
    this.tools = tools || new ToolRuntime({ fetcher });
  }
  configureToken(token) { this.token = String(token || '').trim(); }
  api() {
    const { mode, api } = this.workspace.state.settings;
    if (mode === 'legacy') return LEGACY_API;
    const url = new URL(api);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^[a-z0-9-]+\.compute\.c-\d+\.us-east-2\.aws\.neon\.tech$/.test(url.hostname)) throw Error('Indirizzo del gateway protetto non valido.');
    return url.origin;
  }
  async check() {
    if (this.checking) return;
    this.checking = true; this.workspace.emit();
    const c = new AbortController(), timer = setTimeout(() => c.abort(), 12000);
    try {
      const response = await this.fetcher(`${this.api()}/health`, { signal: c.signal, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.health = { ...data, reachable: true, checkedAt: Date.now() };
    } catch { this.health = { reachable: false, checkedAt: Date.now() }; }
    finally { clearTimeout(timer); this.checking = false; this.workspace.emit(); }
    return this.health;
  }
  async recover() {
    const recoverInsideLock = () => {
      this.workspace.refresh();
      const old = this.workspace.state.jobs.filter(j => j.status === 'running');
      for (const job of old) this.workspace.patch(job.id, { status: 'interrupted', error: 'La pagina è stata chiusa durante la richiesta. L’esito sul server non è noto; il nuovo tentativo sarà una richiesta separata.' });
    };
    if (this.locks) await this.locks.request('the-office-run', { ifAvailable: true }, lock => { if (lock) recoverInsideLock(); });
    else recoverInsideLock();
  }
  async pump() {
    if (this.active || this.workspace.state.settings.paused) return;
    const run = async () => {
      this.workspace.refresh();
      if (this.active || this.workspace.state.settings.paused) return;
      const pending = this.workspace.state.jobs.filter(j => j.status === 'queued').sort((a, b) => {
        if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
      if (pending[0]) await this.execute(pending[0]);
    };
    if (this.locks) await this.locks.request('the-office-run', { ifAvailable: true }, lock => lock ? run() : undefined);
    else await run();
  }
  async execute(job) {
    const ws = this.workspace, mode = ws.state.settings.mode;
    let context;
    try { context = contextFor(job); } catch (e) { ws.patch(job.id, { status: 'blocked', error: e.message }); return; }

    // V9: public read-only tools may enrich software/repository tasks. Tool failures are explicit and never masquerade as verified facts.
    try {
      const toolContext = await this.tools?.contextFor?.(job);
      if (toolContext) {
        context = `${context}\n\n---\nDATI STRUMENTI\n${toolContext}`;
        ws.event('tool-context', job.id, toolContext.startsWith('TOOL VERIFIED') ? 'GitHub API verificata' : 'Tool non disponibile');
      }
    } catch (e) {
      ws.event('tool-context-failed', job.id, String(e?.message || e).slice(0, 180));
    }

    if (mode === 'legacy' && (job.sensitivity === 'private' || detectSensitive(context))) {
      ws.patch(job.id, { status: 'blocked', error: 'Il motore pubblico è riservato a materiale pubblico. Questo incarico resta qui: per dati riservati collega il gateway personale protetto.' }); return;
    }
    if (mode === 'secure' && !this.token) {
      ws.patch(job.id, { status: 'blocked', error: 'Collega la sessione personale nei Dettagli prima di usare il gateway protetto.' }); return;
    }
    if (mode === 'legacy' && job.reviewMode === 'independent') {
      ws.patch(job.id, { status: 'blocked', error: 'Questo motore usa una chiamata singola. La revisione tra modelli distinti richiede il gateway protetto.' }); return;
    }
    if (mode === 'secure' && job.reviewMode === 'roundtable') {
      ws.patch(job.id, { status: 'blocked', error: 'Per il gateway personale seleziona Risposta rapida oppure Modelli distinti.' }); return;
    }
    const controller = new AbortController();
    const active = { id: job.id, controller }; this.active = active;
    const started = Date.now();
    ws.event('request-started', job.id, mode);
    ws.patch(job.id, { status: 'running', mode, startedAt: new Date(started).toISOString(), error: '' });
    const timer = setTimeout(() => controller.abort(), job.reviewMode === 'roundtable' ? Math.max(this.timeoutMs, 135000) : mode === 'legacy' ? Math.min(this.timeoutMs, 30000) : this.timeoutMs);
    try {
      const memory = mode === 'secure' ? ws.state.memory.filter(m => m.enabled && job.memoryIds?.includes(m.id)).map(m => ({ text: m.text, id: m.id })) : [];
      if (job.reviewMode === 'roundtable') {
        const result = await roundtable(job, async (agent, prompt) => {
          const startedStep = Date.now();
          const stepController = new AbortController(), timeout = setTimeout(() => stepController.abort(), 30000);
          const cancelStep = () => stepController.abort(); controller.signal.addEventListener('abort', cancelStep, { once: true });
          try {
            const response = await this.fetcher(`${this.api()}/v1/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: `${job.id}-${agent}`, text: prompt, team: [agent], zeroCost: true, intent: 'draft-only' }),
              signal: stepController.signal, credentials: 'omit', cache: 'no-store' });
            const body = await response.text(); if (body.length > 600000) throw Error('Risposta oltre il limite.');
            const out = JSON.parse(body);
            if (!response.ok) throw Error(out.message || out.error || `HTTP ${response.status}`);
            const normalized = normaliseResponse(out, 'legacy');
            return { agent, text: normalized.result, model: normalized.provenance.model, provider: normalized.provenance.provider, durationMs: Date.now() - startedStep };
          } finally { clearTimeout(timeout); controller.signal.removeEventListener('abort', cancelStep); }
        }, { context, signal: controller.signal, checkpoint: async value => {
          ws.refresh();
          if (controller.signal.aborted || ws.state.jobs.find(j => j.id === job.id)?.status !== 'running') return;
          ws.patch(job.id, { checkpoint: value, contributions: value.contributions, activeAgent: value.agent, stage: value.stage });
        } });
        ws.refresh();
        if (!controller.signal.aborted && ws.state.jobs.find(j => j.id === job.id)?.status === 'running') {
          ws.patch(job.id, { ...result, activeAgent: null, completedAt: new Date().toISOString(), durationMs: Date.now() - started });
          ws.event(result.review?.autoCorrected ? 'roundtable-autocorrected' : 'roundtable-delivered', job.id, `${result.contributions.length} chiamate documentate`);
          this.lastInference = { ok: true, at: Date.now(), model: result.provenance.model };
        }
        return;
      }
      const payload = { id: job.id, text: context, team: job.plan.team, mode: job.reviewMode || 'fast', memory,
        intent: 'draft-only', zeroCost: true, schemaVersion: 3 };
      const headers = { 'Content-Type': 'application/json' };
      if (mode === 'secure') { headers.Authorization = `Bearer ${this.token}`; headers['Idempotency-Key'] = job.id; }
      const response = await this.fetcher(`${this.api()}/v1/jobs`, {
        method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit', cache: 'no-store',
      });
      const body = await response.text();
      if (body.length > 600000) throw Error('Risposta troppo grande: il risultato non è stato caricato.');
      let out;
      try { out = JSON.parse(body); } catch { throw Error('Il motore ha restituito un formato non valido.'); }
      if (!response.ok) throw Error(out.message || out.error || `Il motore risponde HTTP ${response.status}.`);
      ws.refresh();
      if (controller.signal.aborted || ws.state.jobs.find(j => j.id === job.id)?.status !== 'running') return;
      const result = normaliseResponse(out, mode);
      this.lastInference = { ok: true, at: Date.now(), model: result.provenance.model };
      ws.event('response-received', job.id, result.status);
      ws.patch(job.id, { ...result, completedAt: new Date().toISOString(), durationMs: Date.now() - started });
    } catch (e) {
      this.lastInference = { ok: false, at: Date.now() };
      ws.refresh();
      if (ws.state.jobs.find(j => j.id === job.id)?.status === 'running') {
        const timedOut = controller.signal.aborted;
        ws.event(timedOut ? 'request-timeout' : 'request-failed', job.id);
        ws.patch(job.id, { status: timedOut ? 'interrupted' : 'failed', durationMs: Date.now() - started,
          error: timedOut ? 'Tempo di attesa terminato. Il server potrebbe aver continuato: nessun nuovo tentativo parte automaticamente.' : String(e.message || e).slice(0, 600) });
      }
    } finally { clearTimeout(timer); if (this.active === active) this.active = null; ws.emit(); }
  }
  cancel(id) {
    const job = this.workspace.state.jobs.find(j => j.id === id);
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const running = job.status === 'running';
    this.workspace.event('owner-stop', id);
    this.workspace.patch(id, { status: 'cancelled', error: running ? 'Attesa interrotta. Il vecchio gateway non conferma l’arresto sul server.' : 'Incarico rimosso dalla coda prima dell’invio.' });
    if (this.active?.id === id) this.active.controller.abort();
  }
  stopAll() {
    this.workspace.state.settings.paused = true;
    for (const job of [...this.workspace.state.jobs]) if (['running', 'queued'].includes(job.status)) this.cancel(job.id);
    this.workspace.event('office-paused', null); this.workspace.save();
  }
}

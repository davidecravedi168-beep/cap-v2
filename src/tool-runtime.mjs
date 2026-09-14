import { CostPolicy } from './cost-policy.mjs';

const DEFAULT_REPOS = new Set([
  'davidecravedi168-beep/cap-v2',
  'davidecravedi168-beep/capdeliveryv3',
  'davidecravedi168-beep/Tennis_D-L',
  'davidecravedi168-beep/Court-Edge-Pro',
]);

const cleanRepo = value => String(value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
const cleanPath = value => String(value || '').trim().replace(/^\/+/, '');
const nowIso = () => new Date().toISOString();
const BRANCH = /^[a-z0-9][a-z0-9._\/-]{0,119}$/i;

export class ToolRuntime {
  constructor({ fetcher = (...args) => globalThis.fetch(...args), storage = globalThis.localStorage, repos = DEFAULT_REPOS, maxAudit = 300, costPolicy = null } = {}) {
    this.fetcher = fetcher;
    this.storage = storage;
    this.repos = repos instanceof Set ? repos : new Set(repos || []);
    this.maxAudit = maxAudit;
    this.auditKey = 'the-office:tool-audit:v1';
    this.costPolicy = costPolicy || new CostPolicy();
  }

  manifest() {
    const costs = this.costPolicy.snapshot();
    return [
      { id: 'cost.guard', risk: 'policy', available: true, approval: false, description: `Budget crediti esterni: ${costs.externalCreditBudget}. Bolt/StackBlitz bloccati.` },
      { id: 'github.repo-status', risk: 'read', available: true, approval: false, description: 'Legge metadati pubblici di un repository autorizzato.' },
      { id: 'github.read-file', risk: 'read', available: true, approval: false, description: 'Legge un file testuale pubblico da un repository autorizzato.' },
      { id: 'github.prepare-change', risk: 'local-write', available: true, approval: false, description: 'Prepara localmente un pacchetto di modifica GitHub senza eseguirlo.' },
      { id: 'github.write', risk: 'external-write', available: false, approval: true, description: 'Scrittura repository non disponibile nel browser pubblico; richiede backend/connector sicuro.' },
      { id: 'tests.run', risk: 'execution', available: false, approval: true, description: 'Runner test non disponibile nel browser pubblico.' },
      { id: 'payments', risk: 'critical', available: false, approval: true, description: 'Pagamenti non implementati.' },
    ];
  }

  costStatus() { return this.costPolicy.snapshot(); }

  readAudit() {
    try {
      const parsed = JSON.parse(this.storage?.getItem?.(this.auditKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  record(entry) {
    const row = { at: nowIso(), ...entry };
    try {
      const audit = this.readAudit();
      audit.unshift(row);
      this.storage?.setItem?.(this.auditKey, JSON.stringify(audit.slice(0, this.maxAudit)));
    } catch { /* Diagnostics must never break the task. */ }
    return row;
  }

  assertExternalCall(request) {
    try {
      const decision = this.costPolicy.assert(request);
      this.record({ tool: 'cost.guard', ok: true, detail: `${decision.service}: ${decision.reason}` });
      return decision;
    } catch (error) {
      const decision = error?.decision || { service: String(request?.service || 'unknown'), reason: String(error?.message || error) };
      this.record({ tool: 'cost.guard', ok: false, detail: `${decision.service}: ${decision.reason}`, error: 'COST_POLICY_DENY' });
      throw error;
    }
  }

  assertRepo(repo) {
    const normalized = cleanRepo(repo);
    if (!this.repos.has(normalized)) throw Error('Repository non autorizzato dal Tool Runtime.');
    return normalized;
  }

  async request(url, tool, detail) {
    this.assertExternalCall({ service: 'github-api', zeroCost: true, estimatedCredits: 0, metered: false });
    const started = Date.now();
    try {
      const response = await this.fetcher(url, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw Error(`GitHub HTTP ${response.status}`);
      const data = await response.json();
      this.record({ tool, ok: true, durationMs: Date.now() - started, detail });
      return data;
    } catch (error) {
      this.record({ tool, ok: false, durationMs: Date.now() - started, detail, error: String(error?.message || error).slice(0, 240) });
      throw error;
    }
  }

  async repoStatus(repo = 'davidecravedi168-beep/cap-v2') {
    const normalized = this.assertRepo(repo);
    const data = await this.request(`https://api.github.com/repos/${normalized}`, 'github.repo-status', normalized);
    return {
      repo: normalized,
      defaultBranch: data.default_branch || 'main',
      updatedAt: data.updated_at || null,
      pushedAt: data.pushed_at || null,
      openIssues: Number(data.open_issues_count || 0),
      archived: !!data.archived,
      visibility: data.visibility || (data.private ? 'private' : 'public'),
      url: data.html_url || `https://github.com/${normalized}`,
      verifiedBy: 'github-api',
    };
  }

  async readFile(repo, path, ref = 'main') {
    const normalized = this.assertRepo(repo);
    const normalizedPath = cleanPath(path);
    if (!normalizedPath || normalizedPath.includes('..')) throw Error('Percorso file non valido.');
    const safeRef = encodeURIComponent(String(ref || 'main'));
    const data = await this.request(`https://api.github.com/repos/${normalized}/contents/${normalizedPath.split('/').map(encodeURIComponent).join('/')}?ref=${safeRef}`, 'github.read-file', `${normalized}:${normalizedPath}@${ref}`);
    if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string') throw Error('Il file richiesto non è un file testuale leggibile.');
    const compact = data.content.replace(/\s/g, '');
    let text;
    if (typeof atob === 'function') text = decodeURIComponent(Array.from(atob(compact), c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    else text = Buffer.from(compact, 'base64').toString('utf8');
    if (text.length > 60000) throw Error('File oltre il limite di lettura del Tool Runtime.');
    return { repo: normalized, path: normalizedPath, ref, text, sha: data.sha, verifiedBy: 'github-api' };
  }

  prepareGithubChange({ repo = 'davidecravedi168-beep/cap-v2', branch, title = '', changes = [] } = {}) {
    const normalized = this.assertRepo(repo);
    const safeBranch = String(branch || '').trim();
    if (!BRANCH.test(safeBranch) || safeBranch.includes('..') || safeBranch.endsWith('/')) throw Error('Nome branch non valido.');
    if (!Array.isArray(changes) || !changes.length || changes.length > 20) throw Error('Servono da 1 a 20 modifiche per il pacchetto GitHub.');
    const safeChanges = changes.map(change => {
      const path = cleanPath(change?.path);
      const operation = String(change?.operation || 'update');
      if (!path || path.includes('..') || !['create', 'update', 'delete'].includes(operation)) throw Error('Modifica GitHub non valida.');
      return { path, operation };
    });
    const packet = {
      kind: 'github-change-proposal',
      repo: normalized,
      branch: safeBranch,
      title: String(title || '').trim().slice(0, 160),
      changes: safeChanges,
      status: 'proposed',
      externalActionExecuted: false,
      requiresHumanApproval: true,
      execution: 'secure-connector-required',
      estimatedExternalCredits: 0,
      createdAt: nowIso(),
    };
    this.record({ tool: 'github.prepare-change', ok: true, detail: `${normalized}:${safeBranch} · ${safeChanges.length} modifiche` });
    return packet;
  }

  async contextFor(job) {
    const text = `${job?.text || ''} ${job?.plan?.kind || ''}`;
    if (!/(github|repository|\brepo\b|codice|software|bug|implement|deploy|workflow)/i.test(text)) return null;
    try {
      const status = await this.repoStatus('davidecravedi168-beep/cap-v2');
      return `TOOL VERIFIED · GitHub API\nRepository: ${status.repo}\nBranch: ${status.defaultBranch}\nUltimo push: ${status.pushedAt || 'non dichiarato'}\nOpen issues/PR aggregate: ${status.openIssues}\nVisibilità: ${status.visibility}\nCost Guard: zero-credit · Bolt/StackBlitz DENY`;
    } catch (error) {
      return `TOOL UNAVAILABLE · github.repo-status · ${String(error?.message || error).slice(0, 180)}`;
    }
  }
}

export const TOOL_POLICY = Object.freeze({
  read: 'auto',
  localWrite: 'auto',
  externalWrite: 'approval-required',
  execution: 'approval-required',
  destructive: 'approval-required',
  critical: 'approval-required',
  externalCredits: 'deny-by-default',
});

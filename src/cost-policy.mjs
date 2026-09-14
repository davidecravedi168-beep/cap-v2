const normalize = value => String(value || '').trim().toLocaleLowerCase('en-US');

export const DEFAULT_EXTERNAL_CREDIT_BUDGET = 0;
export const HARD_BLOCKED_SERVICES = Object.freeze([
  'bolt',
  'bolt.new',
  'stackblitz',
  'stackblitz-bolt',
]);

const aliases = new Map([
  ['boltnew', 'bolt.new'],
  ['bolt.new', 'bolt.new'],
  ['bolt', 'bolt'],
  ['stackblitz', 'stackblitz'],
  ['stackblitz bolt', 'stackblitz-bolt'],
  ['stackblitz-bolt', 'stackblitz-bolt'],
]);

function serviceId(value) {
  const raw = normalize(value).replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (raw.includes('bolt.new')) return 'bolt.new';
  if (raw.includes('stackblitz')) return raw.includes('bolt') ? 'stackblitz-bolt' : 'stackblitz';
  return aliases.get(raw) || raw;
}

export class CostPolicy {
  constructor({ externalCreditBudget = DEFAULT_EXTERNAL_CREDIT_BUDGET, blockedServices = HARD_BLOCKED_SERVICES } = {}) {
    const budget = Number(externalCreditBudget);
    this.externalCreditBudget = Number.isFinite(budget) && budget >= 0 ? budget : 0;
    this.blockedServices = new Set([...blockedServices].map(serviceId));
  }

  inspect({ service, zeroCost = false, estimatedCredits = 0, metered = false } = {}) {
    const id = serviceId(service);
    const credits = Number(estimatedCredits);
    const safeCredits = Number.isFinite(credits) && credits >= 0 ? credits : Number.POSITIVE_INFINITY;

    if (!id) return { allowed: false, service: id, reason: 'Servizio esterno non identificato.', budget: this.externalCreditBudget };
    if (this.blockedServices.has(id)) {
      return { allowed: false, service: id, reason: `${id} è bloccato dalla policy zero-credit.`, budget: this.externalCreditBudget };
    }
    if (metered || !zeroCost || safeCredits > 0) {
      if (this.externalCreditBudget <= 0 || safeCredits > this.externalCreditBudget) {
        return { allowed: false, service: id, reason: 'La richiesta può consumare crediti e il budget esterno autorizzato è zero.', budget: this.externalCreditBudget };
      }
    }
    return { allowed: true, service: id, reason: 'Chiamata dichiarata a costo/crediti zero.', budget: this.externalCreditBudget };
  }

  assert(request) {
    const decision = this.inspect(request);
    if (!decision.allowed) {
      const error = new Error(decision.reason);
      error.code = 'COST_POLICY_DENY';
      error.decision = decision;
      throw error;
    }
    return decision;
  }

  snapshot() {
    return {
      externalCreditBudget: this.externalCreditBudget,
      blockedServices: [...this.blockedServices].sort(),
      mode: this.externalCreditBudget === 0 ? 'zero-credit' : 'capped-credit',
    };
  }
}

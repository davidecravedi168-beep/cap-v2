import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';
import { OfficeError } from './engine.mjs';
export function seal(value, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}
export function unseal(value, key) {
  const [iv, tag, data] = value.split('.').map(s => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}
export class PgStore {
  constructor(pool, key) { this.pool = pool; this.key = key; }
  async transaction(owner, fn) {
    const c = await this.pool.connect();
    try { await c.query('BEGIN'); await c.query("SET LOCAL statement_timeout = '8s'"); await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [owner]); const out = await fn(c); await c.query('COMMIT'); return out; }
    catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    finally { c.release(); }
  }
  async event(c, owner, id, event) {
    const prev = await c.query('SELECT signature FROM office_v3.audit WHERE owner=$1 ORDER BY sequence DESC LIMIT 1', [owner]);
    const previous = prev.rows[0]?.signature || 'genesis';
    const signature = createHmac('sha256', this.key).update(JSON.stringify([owner, id, event, previous])).digest('hex');
    await c.query('INSERT INTO office_v3.audit(owner,job_id,event,previous,signature) VALUES($1,$2,$3,$4,$5)', [owner, id, event, previous, signature]);
  }
  async reserve(owner, id, fingerprint) {
    return this.transaction(owner, async c => {
      const result = await c.query('SELECT * FROM office_v3.jobs WHERE owner=$1 AND id=$2', [owner, id]);
      const prior = result.rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new OfficeError('id-conflict', 'Lo stesso identificativo è già legato a un incarico diverso.', 409);
        if (prior.status === 'completed' || prior.status === 'failed') return { cached: unseal(prior.payload, this.key) };
        throw new OfficeError('already-started', 'Richiesta già avviata. Nessuna seconda esecuzione; controlla lo storico o crea un nuovo tentativo.', 409);
      }
      const daily = await c.query("SELECT count(*)::int n FROM office_v3.jobs WHERE owner=$1 AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'", [owner]);
      if (daily.rows[0].n >= 20) throw new OfficeError('daily-limit', 'Limite di 20 incarichi giornalieri raggiunto.', 429);
      const running = await c.query("SELECT count(*)::int n FROM office_v3.jobs WHERE owner=$1 AND status='running' AND updated_at > now()-interval '2 minutes'", [owner]);
      if (running.rows[0].n >= 2) throw new OfficeError('concurrency-limit', 'Due incarichi sono già in corso.', 429);
      await c.query("INSERT INTO office_v3.jobs(owner,id,fingerprint,status) VALUES($1,$2,$3,'running')", [owner,id,fingerprint]);
      await this.event(c, owner, id, 'started'); return { reserved: true };
    });
  }
  async checkpoint(owner, id, value) {
    await this.pool.query("UPDATE office_v3.jobs SET payload=$3,updated_at=now() WHERE owner=$1 AND id=$2 AND status='running'", [owner, id, seal(value, this.key)]);
  }
  async finish(owner, id, value, failed = false) {
    return this.transaction(owner, async c => {
      await c.query('UPDATE office_v3.jobs SET payload=$3,status=$4,updated_at=now() WHERE owner=$1 AND id=$2', [owner, id, seal(value, this.key), failed ? 'failed' : 'completed']);
      await this.event(c, owner, id, failed ? 'failed' : 'completed');
    });
  }
}

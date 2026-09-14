import { LEGACY_API, VERSION } from '../src/core.mjs';

const PAGE_URL = String(process.env.PAGE_URL || 'https://davidecravedi168-beep.github.io/cap-v2/').replace(/\/?$/, '/');
const EXPECTED_COMMIT = String(process.env.GITHUB_SHA || '').trim();
const ORIGIN = new URL(PAGE_URL).origin;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response, label) {
  const raw = await response.text();
  try { return JSON.parse(raw); }
  catch { throw new Error(`${label}: JSON non valido (${raw.slice(0, 180)})`); }
}

async function waitForPublishedRelease() {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await request(`${PAGE_URL}version.json?smoke=${Date.now()}`);
      if (!response.ok) throw new Error(`version.json HTTP ${response.status}`);
      const manifest = await readJson(response, 'version.json');
      if (manifest.version !== VERSION) throw new Error(`versione ${manifest.version || 'assente'}, attesa ${VERSION}`);
      if (EXPECTED_COMMIT && manifest.commit !== EXPECTED_COMMIT) throw new Error(`commit ${manifest.commit || 'assente'}, atteso ${EXPECTED_COMMIT}`);
      if (!/^assets-[0-9.]+-[a-f0-9]{10}$/.test(String(manifest.assets || ''))) throw new Error('cartella asset non valida');
      return manifest;
    } catch (error) {
      lastError = error;
      if (attempt < 8) await sleep(1500);
    }
  }
  throw new Error(`GitHub Pages non espone ancora la release appena pubblicata: ${lastError?.message || lastError}`);
}

async function checkFrontend(manifest) {
  const [indexResponse, officeResponse, appResponse] = await Promise.all([
    request(`${PAGE_URL}index.html?smoke=${Date.now()}`),
    request(`${PAGE_URL}office.html?smoke=${Date.now()}`),
    request(`${PAGE_URL}${manifest.assets}/app.mjs?smoke=${Date.now()}`),
  ]);
  if (!indexResponse.ok) throw new Error(`index.html HTTP ${indexResponse.status}`);
  if (!officeResponse.ok) throw new Error(`office.html HTTP ${officeResponse.status}`);
  if (!appResponse.ok) throw new Error(`app.mjs HTTP ${appResponse.status}`);
  const index = await indexResponse.text();
  const office = await officeResponse.text();
  const expectedEntry = `./${manifest.assets}/app.mjs`;
  if (!index.includes(expectedEntry) || !office.includes(expectedEntry)) throw new Error('entrypoint pubblicato non collegato alla release corrente');
  const app = await appResponse.text();
  if (!app.includes("./runtime.mjs") || !app.includes("./ui.mjs")) throw new Error('bundle applicativo incompleto');
}

async function checkGateway() {
  const preflight = await request(`${LEGACY_API}/v1/jobs`, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  if (preflight.status !== 204) throw new Error(`preflight gateway HTTP ${preflight.status}`);
  if (preflight.headers.get('access-control-allow-origin') !== ORIGIN) throw new Error('CORS gateway non autorizza GitHub Pages');

  const healthResponse = await request(`${LEGACY_API}/health`, { headers: { Origin: ORIGIN } });
  if (!healthResponse.ok) throw new Error(`health gateway HTTP ${healthResponse.status}`);
  const health = await readJson(healthResponse, 'health gateway');
  if (health.ok !== true || health.zeroCost !== true) throw new Error('gateway non dichiara stato operativo zero-cost');
  if (!Array.isArray(health.providers) || health.providers.length < 1) throw new Error('gateway senza provider dichiarati');
  return health;
}

async function checkInference() {
  let lastFailure = 'nessuna risposta';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const id = `ci-smoke-${process.env.GITHUB_RUN_ID || Date.now()}-${attempt}`;
    const response = await request(`${LEGACY_API}/v1/jobs`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        text: 'Test tecnico di disponibilità. Rispondi in una sola riga confermando che il motore è operativo.',
        team: ['Direttore'],
        mode: 'fast',
        intent: 'draft-only',
        zeroCost: true,
        schemaVersion: 3,
      }),
    }, 32000);
    const payload = await readJson(response, 'inferenza live');
    if (response.ok) {
      if (payload.status !== 'completed' || payload.zeroCost !== true) throw new Error('inferenza non marcata completed/zero-cost');
      if (!String(payload.result || '').trim()) throw new Error('inferenza completata senza risultato');
      if (!String(payload.provider || '').trim() || !String(payload.model || '').trim()) throw new Error('provenienza provider/modello assente');
      return payload;
    }
    lastFailure = `${response.status}: ${payload.error || payload.message || 'errore sconosciuto'}`;
    if (response.status !== 503 || payload.retryable !== true || attempt === 3) break;
    await sleep(2000);
  }
  throw new Error(`i motori gratuiti non hanno completato il test dopo i retry (${lastFailure})`);
}

const manifest = await waitForPublishedRelease();
await checkFrontend(manifest);
const health = await checkGateway();
const inference = await checkInference();

console.log(`LIVE SMOKE OK | release ${manifest.version} | ${manifest.commit.slice(0, 8)} | providers ${health.providers.join(', ')} | risposta ${inference.provider}/${inference.model}`);

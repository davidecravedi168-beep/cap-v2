import { SimulationEngine, createDefaultPersonas, createScenario } from './simulation-engine.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const pct = value => `${Math.round((Number(value) || 0) * 100)}%`;
const signedClamp = value => Math.max(-1, Math.min(1, value));

function localSandboxRunner({ agent, random, round }) {
  const exploration = (random - 0.5) * 0.16;
  const damping = Math.max(0.35, 1 - round * 0.12);
  return {
    stance: signedClamp((Number(agent.prior) || 0) * damping + exploration),
    confidence: 0.48,
    rationale: `${agent.role}: sandbox locale basato su prior sintetico e variazione seeded.`,
    evidenceIds: [],
    flags: ['synthetic-sandbox'],
  };
}

function resultMarkup(summary) {
  return `<div class="simulation-summary">
    <div><small>FREQUENZA NELLE SIMULAZIONI</small><strong>${pct(summary.simulationFrequency)}</strong><span>mediana ${pct(summary.interval.p50)} · P10–P90 ${pct(summary.interval.p10)}–${pct(summary.interval.p90)}</span></div>
    <div><small>STABILITÀ TRA RUN</small><strong>${pct(summary.stability)}</strong><span>${summary.convergedRuns}/${summary.runs} run convergenti</span></div>
    <div><small>DISACCORDO AGENTI</small><strong>${pct(summary.disagreement)}</strong><span>${summary.agentCount} prospettive sintetiche</span></div>
  </div>
  <p class="simulation-warning"><b>Non è una previsione reale.</b> ${esc(summary.caveat)}</p>
  <details><summary>Perché questo primo laboratorio è prudente</summary><p>Il sandbox locale verifica il motore multi-run, la convergenza e la UI senza inventare accesso a dati o modelli che non sono stati collegati. Il passo successivo è sostituire il runner sintetico con agenti AI e fonti tracciate.</p></details>`;
}

function mount() {
  if (document.querySelector('#simulation-lab')) return true;
  const grid = document.querySelector('#screen-details .details-grid');
  if (!grid) return false;
  const section = document.createElement('section');
  section.id = 'simulation-lab';
  section.className = 'detail-card wide simulation-lab';
  section.innerHTML = `<span class="eyebrow">SIMULATION LAB · V10.1</span>
    <div class="simulation-head"><div><h2>Stressa una decisione prima di crederci.</h2><p class="muted">Multi-run, prospettive diverse e convergenza misurata. Questo primo layer gira in locale ed è deliberatamente separato dalle evidenze reali.</p></div><span class="simulation-badge">SANDBOX LOCALE</span></div>
    <form id="simulation-form" class="simulation-form">
      <label>Scenario<textarea id="simulation-question" rows="3" maxlength="4000" required placeholder="Es. Se lanciamo questa funzione a questo prezzo, quali reazioni e rischi emergono?"></textarea></label>
      <div class="simulation-fields"><label>Run<input id="simulation-runs" type="number" min="4" max="50" value="12"></label><label>Prospettive<input id="simulation-agents" type="number" min="4" max="12" value="8"></label></div>
      <div class="button-row"><button class="secondary" type="button" id="simulation-use-brief">Usa il brief corrente</button><button class="secondary" type="submit">Avvia stress test →</button></div>
    </form>
    <div id="simulation-result" class="simulation-result"><p class="muted">Nessuna simulazione eseguita su questo dispositivo.</p></div>`;
  grid.prepend(section);

  const form = section.querySelector('#simulation-form');
  const question = section.querySelector('#simulation-question');
  const output = section.querySelector('#simulation-result');
  section.querySelector('#simulation-use-brief').addEventListener('click', () => {
    const brief = document.querySelector('#brief')?.value?.trim();
    if (brief) question.value = brief;
    else output.innerHTML = '<p class="simulation-warning">Il brief corrente è vuoto.</p>';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const runs = Number(section.querySelector('#simulation-runs').value) || 12;
    const agentCount = Number(section.querySelector('#simulation-agents').value) || 8;
    output.innerHTML = '<p class="muted">Esecuzione multi-run in corso…</p>';
    try {
      const scenario = createScenario({ question: question.value, assumptions: ['Sandbox locale: nessuna evidenza esterna collegata.'] });
      const engine = new SimulationEngine({ agentRunner: localSandboxRunner });
      const summary = await engine.run({ scenario, agents: createDefaultPersonas(agentCount), runs, rounds: 8, seed: question.value });
      output.innerHTML = resultMarkup(summary);
    } catch (error) {
      output.innerHTML = `<p class="simulation-warning">${esc(error.message || 'Simulazione non disponibile.')}</p>`;
    }
  });
  return true;
}

if (!mount()) {
  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

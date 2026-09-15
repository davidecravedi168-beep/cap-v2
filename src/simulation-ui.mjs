import { SimulationEngine, createDefaultPersonas, createScenario } from './simulation-engine.mjs';
import { buildHybridPrompt, parseHybridDossier, personasFromDossier, createHybridRunner } from './simulation-hybrid.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const pct = value => `${Math.round((Number(value) || 0) * 100)}%`;
const signedClamp = value => Math.max(-1, Math.min(1, Number(value) || 0));
const list = items => (Array.isArray(items) && items.length) ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="muted">Nessun elemento.</p>';

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

function stanceLabel(value) {
  const stance = Number(value) || 0;
  if (stance >= 0.3) return 'favorevole';
  if (stance <= -0.3) return 'critica';
  return 'incerta';
}

function metricMarkup(summary, label = 'CONSENSO NELLO STRESS TEST') {
  return `<div class="simulation-summary">
    <div><small>${label}</small><strong>${pct(summary.simulationFrequency)}</strong><span>mediana ${pct(summary.interval.p50)} · P10–P90 ${pct(summary.interval.p10)}–${pct(summary.interval.p90)}</span></div>
    <div><small>STABILITÀ TRA RUN</small><strong>${pct(summary.stability)}</strong><span>${summary.convergedRuns}/${summary.runs} run convergenti</span></div>
    <div><small>DISACCORDO PROSPETTIVE</small><strong>${pct(summary.disagreement)}</strong><span>${summary.agentCount} prospettive</span></div>
  </div>`;
}

function sandboxMarkup(summary, reason = '') {
  return `${reason ? `<p class="simulation-warning"><b>Fallback locale.</b> ${esc(reason)}</p>` : ''}${metricMarkup(summary, 'CONSENSO SINTETICO')}
    <p class="simulation-warning"><b>Non è una previsione reale.</b> Sandbox tecnico senza analisi semantica AI o evidenze esterne.</p>
    <details><summary>Cosa sta misurando</summary><p>Il sandbox verifica multi-run, convergenza e stabilità. I valori non vanno interpretati come probabilità del mondo reale.</p></details>`;
}

function dossierMarkup(dossier, job, summary) {
  const provider = [job?.provider, job?.actualModel].filter(Boolean).map(esc).join(' · ');
  return `${metricMarkup(summary)}
    <div class="simulation-reality-strip"><b>AI HYBRID · 0 €</b><span>1 dossier AI + ${summary.runs} run locali</span><span>Evidenze esterne: non verificate</span>${provider ? `<span>${provider}</span>` : ''}</div>
    <p class="simulation-warning"><b>Non è una probabilità reale.</b> Il valore sopra misura quanto le prospettive del dossier AI restano favorevoli attraverso perturbazioni e round locali. Va calibrato con risultati reali nel tempo.</p>
    <section class="simulation-thesis"><span class="eyebrow">TESI</span><p>${esc(dossier.thesis)}</p></section>
    <div class="simulation-dossier-grid">
      <section><h3>Prospettive</h3><div class="simulation-personas">${dossier.personas.map(persona => `<article><div><b>${esc(persona.role)}</b><span class="simulation-stance">${stanceLabel(persona.stance)} · ${Math.round(persona.confidence * 100)}% conf.</span></div><p>${esc(persona.rationale)}</p><small>${esc(persona.incentives)}</small></article>`).join('')}</div></section>
      <section><h3>Failure modes</h3>${list(dossier.failureModes)}</section>
      <section><h3>Dove concordano</h3>${list(dossier.consensusPoints)}</section>
      <section><h3>Dove dissentono</h3>${list(dossier.disagreementPoints)}</section>
      <section><h3>Cosa non sappiamo</h3>${list(dossier.evidenceGaps)}</section>
      <section><h3>Test da fare</h3>${list(dossier.experiments)}</section>
    </div>
    ${dossier.scenarioBranches.length ? `<section class="simulation-branches"><h3>Scenario branches</h3>${dossier.scenarioBranches.map(branch => `<article><div><b>${esc(branch.label)}</b><span>${pct(branch.weight)} quota del modello</span></div><p>${esc(branch.description)}</p>${branch.triggers.length ? `<small>Trigger: ${branch.triggers.map(esc).join(' · ')}</small>` : ''}</article>`).join('')}</section>` : ''}
    <details><summary>Assunzioni del modello</summary>${list(dossier.assumptions)}</details>`;
}

function labMarkup() {
  return `<span class="eyebrow">SIMULATION LAB · V10.2</span>
    <div class="simulation-head"><div><h2>Stressa una decisione prima di crederci.</h2><p class="muted">Hybrid Simulation: l'AI gratuita costruisce il dossier una sola volta; poi il motore locale esegue molti run, misura convergenza e preserva il disaccordo.</p></div><span class="simulation-badge" id="simulation-badge">AI HYBRID · 0 €</span></div>
    <form id="simulation-form" class="simulation-form">
      <label>Scenario<textarea id="simulation-question" rows="4" maxlength="4000" required placeholder="Es. Se lanciamo questa funzione a questo prezzo, quali reazioni, rischi e failure mode emergono?"></textarea></label>
      <div class="simulation-fields"><label>Run<input id="simulation-runs" type="number" min="4" max="50" value="12"></label><label>Prospettive<input id="simulation-agents" type="number" min="4" max="12" value="8"></label><label>Modalità<select id="simulation-mode"><option value="hybrid" selected>AI Hybrid 0 €</option><option value="sandbox">Sandbox locale</option></select></label></div>
      <div class="button-row"><button class="secondary" type="button" id="simulation-use-brief">Usa il brief corrente</button><button class="secondary" type="submit">Avvia stress test →</button></div>
    </form>
    <div id="simulation-result" class="simulation-result"><p class="muted">Nessuna simulazione eseguita su questo dispositivo.</p></div>`;
}

async function runSandbox(question, runs, agentCount) {
  const scenario = createScenario({ question, assumptions: ['Sandbox locale: nessuna evidenza esterna collegata.'] });
  const engine = new SimulationEngine({ agentRunner: localSandboxRunner });
  return engine.run({ scenario, agents: createDefaultPersonas(agentCount), runs, rounds: 8, seed: question });
}

async function runHybrid(question, runs, agentCount) {
  const runtime = window.TheOfficeRuntime;
  const cfg = runtime?.config?.() || {};
  if (!runtime?.submit) throw new Error('Runtime AI non disponibile in questa sessione.');
  if (cfg.zeroCost !== true) throw new Error('Il runtime attivo non garantisce 0 €. Hybrid AI non avviato per evitare costi.');
  const prompt = buildHybridPrompt({ question, personaCount: agentCount });
  const job = await runtime.submit(prompt, 'simulation-lab');
  if (!job || job.status !== 'completed' || !job.result) throw new Error(job?.error || `Runtime AI: ${job?.status || 'nessuna risposta'}.`);
  const dossier = parseHybridDossier(job.result, { personaCount: agentCount });
  const agents = personasFromDossier(dossier, agentCount);
  if (agents.length < 2) throw new Error('Il dossier non ha generato abbastanza prospettive utilizzabili.');
  const scenario = createScenario({
    question,
    assumptions: [...dossier.assumptions, 'Dossier generato da AI senza verifica esterna automatica delle fonti.'],
  });
  const engine = new SimulationEngine({ agentRunner: createHybridRunner(dossier) });
  const summary = await engine.run({ scenario, agents, runs, rounds: 8, seed: `${question}:hybrid-v102` });
  return { dossier, job, summary };
}

function bind(section) {
  const form = section.querySelector('#simulation-form');
  const question = section.querySelector('#simulation-question');
  const output = section.querySelector('#simulation-result');
  const badge = section.querySelector('#simulation-badge');
  const mode = section.querySelector('#simulation-mode');
  mode.addEventListener('change', () => { badge.textContent = mode.value === 'hybrid' ? 'AI HYBRID · 0 €' : 'SANDBOX LOCALE'; });
  section.querySelector('#simulation-use-brief').addEventListener('click', () => {
    const brief = document.querySelector('#brief')?.value?.trim();
    if (brief) question.value = brief;
    else output.innerHTML = '<p class="simulation-warning">Il brief corrente è vuoto.</p>';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const runs = Number(section.querySelector('#simulation-runs').value) || 12;
    const agentCount = Number(section.querySelector('#simulation-agents').value) || 8;
    const selectedMode = mode.value;
    output.innerHTML = `<p class="muted">${selectedMode === 'hybrid' ? 'Costruzione dossier AI 0 € e stress test multi-run…' : 'Esecuzione sandbox multi-run…'}</p>`;
    try {
      if (selectedMode === 'sandbox') {
        const summary = await runSandbox(question.value, runs, agentCount);
        output.innerHTML = sandboxMarkup(summary);
        return;
      }
      try {
        const { dossier, job, summary } = await runHybrid(question.value, runs, agentCount);
        output.innerHTML = dossierMarkup(dossier, job, summary);
      } catch (hybridError) {
        const summary = await runSandbox(question.value, runs, agentCount);
        output.innerHTML = sandboxMarkup(summary, hybridError.message || 'Hybrid AI non disponibile.');
      }
    } catch (error) {
      output.innerHTML = `<p class="simulation-warning">${esc(error.message || 'Simulazione non disponibile.')}</p>`;
    }
  });
}

function mount() {
  if (document.querySelector('#simulation-lab')) return true;
  const office = document.querySelector('#screen-office');
  const anchor = office?.querySelector('.mission-control');
  if (!office || !anchor) return false;
  const section = document.createElement('section');
  section.id = 'simulation-lab';
  section.className = 'simulation-lab office-simulation';
  section.innerHTML = labMarkup();
  anchor.insertAdjacentElement('afterend', section);
  bind(section);
  return true;
}

if (!mount()) {
  const observer = new MutationObserver(() => {
    if (mount()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

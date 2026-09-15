import { STORE_KEY, Workspace } from './core.mjs';
import { presentationPolicy, visibleJobText } from './presentation.mjs';

function readState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
  catch { return null; }
}

function selectedJob(state) {
  const id = document.querySelector('.job-item.selected')?.dataset.job;
  return (state?.jobs || []).find(job => job.id === id) || null;
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setHidden(node, hidden) {
  if (node && node.hidden !== hidden) node.hidden = hidden;
}

function applyDirectPresentation() {
  const state = readState();
  if (!state) return;

  for (const button of document.querySelectorAll('.job-item[data-job]')) {
    const job = (state.jobs || []).find(item => item.id === button.dataset.job);
    if (!job) continue;
    const label = button.querySelector('.job-info > b');
    setText(label, visibleJobText(job).slice(0, 120));
  }

  const active = (state.jobs || []).find(job => job.status === 'running');
  if (active) setText(document.querySelector('#board-title'), visibleJobText(active).slice(0, 100));

  const job = selectedJob(state);
  if (!job) return;
  const policy = presentationPolicy(job);
  if (policy.mode !== 'direct') return;

  setText(document.querySelector('#result .result-title'), visibleJobText(job));
  setHidden(document.querySelector('#result .review-state'), true);
  setHidden(document.querySelector('#result .decision-desk'), true);

  for (const detail of document.querySelectorAll('#result details.result-detail')) {
    const summary = detail.querySelector(':scope > summary');
    const text = summary?.textContent?.trim() || '';
    if (text === 'Chi ha risposto e come') setText(summary, policy.technicalLabel);
    if (text === 'Piano proposto e confini dell’incarico') setHidden(detail, true);
  }
}

function patchWorkspaceContinuity() {
  const retry = Workspace.prototype.retry;
  if (!retry?.invisibleOfficeV1004) {
    const wrappedRetry = function retryInvisible(id) {
      const old = this.state.jobs.find(job => job.id === id);
      const next = retry.call(this, id);
      if (next && old && presentationPolicy(old).mode === 'direct') {
        this.patch(next.id, {
          displayText: visibleJobText(old),
          outputMode: 'direct',
          objectiveMissionMode: 'direct',
          objectiveIntentSeed: old.objectiveIntentSeed || visibleJobText(old),
          plan: old.plan,
        });
        return this.state.jobs.find(job => job.id === next.id) || next;
      }
      return next;
    };
    wrappedRetry.invisibleOfficeV1004 = true;
    Workspace.prototype.retry = wrappedRetry;
  }

  const followUp = Workspace.prototype.followUp;
  if (!followUp?.invisibleOfficeV1004) {
    const wrappedFollowUp = function followUpInvisible(id, instruction) {
      const old = this.state.jobs.find(job => job.id === id);
      const next = followUp.call(this, id, instruction);
      if (next && old && presentationPolicy(old).mode === 'direct' && next.previous) {
        this.patch(next.id, {
          previous: { ...next.previous, text: visibleJobText(old) },
          displayText: String(instruction || '').trim(),
        });
        return this.state.jobs.find(job => job.id === next.id) || next;
      }
      return next;
    };
    wrappedFollowUp.invisibleOfficeV1004 = true;
    Workspace.prototype.followUp = wrappedFollowUp;
  }
}

patchWorkspaceContinuity();

let scheduled = false;
const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    applyDirectPresentation();
  });
};

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('storage', e => { if (e.key === STORE_KEY) schedule(); });
document.addEventListener('office-objective-changed', schedule);
document.addEventListener('click', e => {
  const button = e.target.closest('button[data-action="reuse"]');
  if (!button) return;
  const state = readState();
  const job = selectedJob(state);
  if (!job || presentationPolicy(job).mode !== 'direct') return;
  queueMicrotask(() => {
    const brief = document.querySelector('#brief');
    if (!brief) return;
    const text = visibleJobText(job);
    if (brief.value !== text) {
      brief.value = text;
      brief.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
});

schedule();

export function visibleJobText(job) {
  const preferred = String(job?.displayText || job?.objectiveIntentSeed || '').trim();
  return preferred || String(job?.text || '').trim();
}

export function presentationPolicy(job) {
  const direct = job?.outputMode === 'direct' || job?.objectiveMissionMode === 'direct';
  return {
    mode: direct ? 'direct' : 'full',
    showReviewBanner: !direct,
    showDecisionDesk: !direct,
    showPlan: !direct,
    technicalLabel: direct ? 'Dettagli tecnici' : 'Chi ha risposto e come',
    showInternalBrief: !direct,
  };
}

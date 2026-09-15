function installDecisionMode() {
  const select = document.querySelector('#review-mode');
  if (!select || select.querySelector('option[value="decision"]')) return;
  const option = document.createElement('option');
  option.value = 'decision';
  option.textContent = 'Decision Mode · l’ufficio sceglie';
  select.prepend(option);
  select.value = 'decision';

  const note = document.createElement('small');
  note.className = 'muted';
  note.textContent = 'Consigliato: sceglie automaticamente risposta rapida, Tavola Rotonda o revisione distinta. Il routing è deterministico e non è machine learning.';
  select.closest('label')?.append(note);
}

queueMicrotask(installDecisionMode);

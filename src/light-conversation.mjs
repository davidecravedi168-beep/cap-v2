const normalise = value => String(value || '').trim().toLocaleLowerCase('it-IT').replace(/[!?.,;:]+$/g, '').trim();

const exactGreetings = new Set([
  'ciao', 'salve', 'hey', 'ehi', 'buongiorno', 'buona sera', 'buonasera', 'buon pomeriggio',
  'come va', 'come stai', 'tutto bene', 'ci sei', 'sei operativo', 'sei operativa', 'come va the office',
]);

export function lightConversation(text) {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 80) return null;
  const t = normalise(raw);
  if (!exactGreetings.has(t)) return null;

  if (/^(come va|come stai|tutto bene|come va the office)$/.test(t)) {
    return { text: 'Bene, sono operativo. Dimmi pure cosa vuoi fare.', intent: 'check-in' };
  }
  if (/^(ci sei|sei operativo|sei operativa)$/.test(t)) {
    return { text: 'Sì, sono operativo. Dimmi pure il prossimo compito.', intent: 'availability' };
  }
  return { text: 'Ciao. Sono operativo: dimmi pure cosa vuoi fare.', intent: 'greeting' };
}

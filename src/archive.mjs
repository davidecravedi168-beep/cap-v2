import { STATUS, classify, normaliseResponse } from './core.mjs';
import { validateMaterial, contextFor } from './context.mjs';
export function validateArchive(data) {
  if (data?.version !== 3 || !Array.isArray(data.jobs) || data.jobs.length > 250 || !Array.isArray(data.memory) || data.memory.length > 200) throw Error('Archivio non riconosciuto o troppo grande.');
  const ids = new Set();
  const jobs = data.jobs.map(j => {
    if (!j || typeof j.id !== 'string' || j.id.length > 100 || ids.has(j.id) || typeof j.text !== 'string' || !j.text.trim() || j.text.length > 16000 || !Object.hasOwn(STATUS, j.status) || j.result && typeof j.result !== 'string') throw Error('Archivio con incarichi non validi o duplicati.');
    ids.add(j.id);
    const out = j.result ? normaliseResponse({ ...j, zeroCost: true, status: 'completed' }, 'legacy') : { result: '', contributions: [] };
    const materials = (Array.isArray(j.materials) ? j.materials : []).map(m => validateMaterial(m.name, m.text));
    if (materials.length > 4 || materials.reduce((n, m) => n + m.text.length, 0) > 12000) throw Error('Materiali oltre il limite.');
    const previous = j.previous && typeof j.previous.text === 'string' && typeof j.previous.result === 'string' ? { text: j.previous.text, result: j.previous.result } : null;
    contextFor({ text: j.text, materials, previous });
    return { ...out, materials, previous, id: j.id, text: j.text, status: ['queued', 'running'].includes(j.status) ? 'interrupted' : j.status,
      createdAt: Number.isFinite(Date.parse(j.createdAt)) ? j.createdAt : new Date().toISOString(),
      area: String(j.area || 'Generale').slice(0, 40), project: String(j.project || '').slice(0, 100),
      plan: classify(j.text), mode: 'legacy', migrated: true, rating: null, memoryIds: [],
      reviewMode: ['fast', 'roundtable', 'independent'].includes(j.reviewMode) ? j.reviewMode : 'fast',
      sensitivity: j.sensitivity === 'private' ? 'private' : 'public', archived: j.archived === true,
      priority: 'normal', attempt: 1, error: String(j.error || '').slice(0, 600) };
  });
  const notes = new Set();
  const memory = data.memory.map(m => {
    if (!m || typeof m.id !== 'string' || m.id.length > 100 || notes.has(m.id) || typeof m.text !== 'string' || !m.text.trim() || m.text.length > 2000) throw Error('Archivio con note non valide.');
    notes.add(m.id); return { id: m.id, text: m.text, source: null, approvedAt: new Date().toISOString(), enabled: false };
  });
  return { jobs, memory };
}

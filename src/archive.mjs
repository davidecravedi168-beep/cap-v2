import { STATUS, classify, normaliseResponse } from './core.mjs';
import { validateMaterial, contextFor } from './context.mjs';
import { normaliseConstitution, normaliseObjective } from './objective-os.mjs';

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
      objectiveId: typeof j.objectiveId === 'string' ? j.objectiveId.slice(0, 100) : null,
      objectiveSnapshot: j.objectiveSnapshot && typeof j.objectiveSnapshot === 'object' ? j.objectiveSnapshot : null,
      reviewMode: ['decision', 'fast', 'roundtable', 'independent'].includes(j.reviewMode) ? j.reviewMode : 'fast',
      sensitivity: j.sensitivity === 'private' ? 'private' : 'public', archived: j.archived === true,
      priority: 'normal', attempt: 1, error: String(j.error || '').slice(0, 600) };
  });
  const notes = new Set();
  const memory = data.memory.map(m => {
    if (!m || typeof m.id !== 'string' || m.id.length > 100 || notes.has(m.id) || typeof m.text !== 'string' || !m.text.trim() || m.text.length > 2000) throw Error('Archivio con note non valide.');
    notes.add(m.id); return { id: m.id, text: m.text, source: null, approvedAt: new Date().toISOString(), enabled: false };
  });
  const objectiveIds = new Set();
  const objectives = (Array.isArray(data.objectives) ? data.objectives : []).slice(0, 40).map(normaliseObjective).filter(Boolean).filter(o => {
    if (objectiveIds.has(o.id)) return false; objectiveIds.add(o.id); return true;
  });
  const outcomeIds = new Set();
  const outcomes = (Array.isArray(data.outcomes) ? data.outcomes : []).slice(0, 500).filter(o => o && typeof o.id === 'string' && typeof o.objectiveId === 'string' && typeof o.summary === 'string' && o.summary.trim()).filter(o => {
    if (outcomeIds.has(o.id)) return false; outcomeIds.add(o.id); return true;
  }).map(o => ({ id: o.id.slice(0, 100), objectiveId: o.objectiveId.slice(0, 100), jobId: typeof o.jobId === 'string' ? o.jobId.slice(0, 100) : null,
    summary: o.summary.slice(0, 2000), kind: ['accepted-result', 'measured-result', 'note'].includes(o.kind) ? o.kind : 'note',
    at: Number.isFinite(Date.parse(o.at)) ? o.at : new Date().toISOString() }));
  const constitution = normaliseConstitution(data.constitution || {});
  return { jobs, memory, objectives, outcomes, constitution };
}

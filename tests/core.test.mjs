import test from 'node:test';
import assert from 'node:assert/strict';
import { Workspace, STORE_KEY, normaliseResponse, toMarkdown, esc, detectSensitive } from '../src/core.mjs';
import { Runtime } from '../src/runtime.mjs';
import { validateArchive } from '../src/archive.mjs';
const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v) }; };
const office = (storage = memoryStorage()) => new Workspace(storage);
const response = (x, status = 200) => new Response(JSON.stringify(x), { status });
const answer = { status: 'completed', zeroCost: true, result: 'Risultato completo\n' + 'verificabile '.repeat(100), contributions: [{ agent: 'Direttore', model: 'actual-model', provider: 'actual-provider', text: 'Test' }] };

test('Migrates historical results without shortening or destroying originals', () => {
  const s = memoryStorage(), old = JSON.stringify([{ id: 'old', text: 'Test storico', status: 'completed', result: answer.result }]);
  s.setItem('the-office:runtime-free:v1', old); const ws = office(s); ws.save();
  assert.equal(ws.state.jobs[0].result, answer.result); assert.equal(s.getItem('the-office:runtime-free:v1'), old);
  assert.ok(toMarkdown(ws.state.jobs[0]).includes(answer.result));
});
test('Corrupt storage is preserved and reports failure explicitly', () => {
  const s = memoryStorage(); s.setItem(STORE_KEY, '{broken'); const ws = office(s); ws.add('Bozza recuperabile', { draft:true });
  assert.equal(s.getItem(STORE_KEY), '{broken'); assert.equal(ws.readOnly, true); assert.ok(ws.storageError);
});
test('Storage quota failure keeps the answer in memory and warns', () => {
  const ws = office({ getItem: () => null, setItem: () => { throw Error('quota'); } }); ws.add('Nuovo documento', {draft:true});
  assert.equal(ws.state.jobs.length, 1); assert.match(ws.storageError, /Salvataggio/);
});
test('Duplicate submit while pending creates one job', () => {
  const ws = office(); const a = ws.add('Crea un piano'), b = ws.add('Crea un piano'); assert.equal(a.id, b.id); assert.equal(ws.state.jobs.length, 1);
});
test('Status patch preserves audit events', () => {
  const ws = office(), j = ws.add('Analizza'); ws.event('test-event', j.id); ws.patch(j.id, { status:'running' });
  assert.ok(ws.state.events.some(e => e.type === 'test-event'));
});
test('Feedback replaces rather than duplicates votes', () => {
  const ws = office(), j = ws.add('Prova'); ws.patch(j.id, { result:'utile', status:'completed' }); ws.rate(j.id,1); ws.rate(j.id,1);
  assert.equal(ws.metrics().ratings,1); ws.rate(j.id,-1); assert.equal(ws.metrics().helpful,0);
});
test('Retry preserves sensitivity and independent review requirement', () => {
  const ws = office(), j = ws.add('Confronta',{sensitivity:'private'}); ws.patch(j.id,{status:'blocked',reviewMode:'independent',memoryIds:['note']});
  const retry = ws.retry(j.id); assert.notEqual(retry.id,j.id); assert.equal(retry.sensitivity,'private'); assert.equal(retry.reviewMode,'independent');
});
test('Empty, failed or non-free responses never count as completed', () => {
  for (const out of [{result:'ok'}, {zeroCost:true,result:''}, {zeroCost:true,result:'ok',status:'failed'}]) assert.throws(() => normaliseResponse(out,'legacy'));
});
test('Uses actual response models and never trusts legacy independence claims', () => {
  const data = normaliseResponse({...answer, review:{independent:true}},'legacy');
  assert.equal(data.provenance.model,'actual-model'); assert.equal(data.review.independent,false); assert.equal(data.result,answer.result);
});
test('Escapes active HTML and flags obvious secrets before public transmission', () => {
  assert.equal(esc('<script>alert("x")</script>'),'&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.ok(detectSensitive('password: not-a-real-secret')); assert.ok(!detectSensitive('Come si scrive una password robusta?'));
});
test('Private jobs and explicit independent reviews never reach legacy network', async () => {
  for (const options of [{sensitivity:'private'}, {reviewMode:'independent'}]) {
    const ws = office(), j = ws.add('Analizza il materiale',options); if(options.reviewMode) ws.patch(j.id,options);
    const rt = new Runtime(ws,{fetcher:()=>{throw Error('must not call');},locks:null}); await rt.pump(); assert.equal(ws.state.jobs[0].status,'blocked');
  }
});
test('Cancellation cannot be overwritten by a late response', async () => {
  const ws=office(), j=ws.add('Calcola'); let resolve;
  const rt=new Runtime(ws,{fetcher:()=>new Promise(r=>resolve=r),locks:null}); const run=rt.pump();
  rt.cancel(j.id); resolve(response(answer)); await run;
  assert.equal(ws.state.jobs[0].status,'cancelled'); assert.equal(ws.state.jobs[0].result,'');
});
test('Timeout ends the waiting state and does not retry automatically', async () => {
  const ws=office(); ws.add('Calcola'); let calls=0;
  const rt=new Runtime(ws,{timeoutMs:10, locks:null, fetcher:(_url,{signal})=>{calls++;return new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));}});
  await rt.pump(); await rt.pump(); assert.equal(ws.state.jobs[0].status,'interrupted'); assert.equal(calls,1);
});
test('Reload recovery marks an unfinished job as interrupted', async () => {
  const s=memoryStorage(), ws=office(s),j=ws.add('Test');ws.patch(j.id,{status:'running'});
  const recovered=office(s);await new Runtime(recovered,{locks:null}).recover();assert.equal(recovered.state.jobs[0].status,'interrupted');
});
test('Public request excludes all saved memory', async () => {
  const ws=office(),m=ws.remember('Nota privata'),j=ws.add('Test'); ws.patch(j.id,{memoryIds:[m.id]}); let sent;
  const rt=new Runtime(ws,{locks:null,fetcher:async (_u,o)=>{sent=JSON.parse(o.body);return response(answer);}});await rt.pump();
  assert.deepEqual(sent.memory,[]); assert.equal(ws.state.jobs[0].status,'completed');
});
test('Stop office prevents queued requests from starting',async()=>{
  const ws=office();ws.add('One');ws.add('Two');let calls=0;const rt=new Runtime(ws,{locks:null,fetcher:()=>{calls++;}});rt.stopAll();await rt.pump();
  assert.equal(calls,0);assert.equal(ws.state.settings.paused,true);assert.ok(ws.state.jobs.every(j=>j.status==='cancelled'));
});
test('Imported archives cannot auto-run, import auth, or claim verified reviews',()=>{
  const ws=office(),j=ws.add('Test');ws.remember('Nota');ws.patch(j.id,{status:'running',result:'Test',review:{independent:true}});
  const restored=validateArchive(ws.state);assert.equal(restored.jobs[0].status,'interrupted');assert.equal(restored.jobs[0].review.independent,false);assert.equal(restored.memory[0].enabled,false);assert.equal(restored.settings,undefined);
  assert.throws(()=>validateArchive({...ws.state,jobs:[j,j]}));
});

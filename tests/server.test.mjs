import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHandler } from '../server/secure-function.mjs';
import { validateJob, createProvider, executeJob, isFreeModel, OfficeError } from '../server/engine.mjs';
import { seal, unseal } from '../server/store.mjs';
const token='test-session-token-with-at-least-32-characters';
const input=(extra={})=>({id:'test-job-123',text:'Confronta due alternative generiche',team:['Direttore'],mode:'fast',memory:[],intent:'draft-only',zeroCost:true,schemaVersion:3,...extra});
const json=(x,status=200)=>new Response(JSON.stringify(x),{status});
class TestStore {
  constructor(){this.rows=new Map();this.checkpoints=[];}
  async reserve(_owner,id,hash){const old=this.rows.get(id);if(old){if(old.hash!==hash)throw new OfficeError('id-conflict','Conflicting content',409);if(old.result)return{cached:old.result};throw new OfficeError('already-started','Pending',409);}this.rows.set(id,{hash});return{reserved:true};}
  async finish(_owner,id,value){this.rows.get(id).result=value;}
  async checkpoint(_owner,_id,value){this.checkpoints.push(value);}
}
const request=(body=input(),headers={})=>new Request('https://office.invalid/v1/jobs',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'Idempotency-Key':body.id,...headers},body:JSON.stringify(body)});
const provider={call:async(agent)=>({agent,model:'writer:free',provider:'test',text:'Risposta sintetica',usage:{cost:0}})};
test('Authentication fails closed before body parsing or provider access',async()=>{
  const h=createHandler({token,provider:{call:()=>{throw Error('must not call')}},store:new TestStore()});
  assert.equal((await h.fetch(request(input(),{Authorization:''}))).status,401);
  assert.equal((await h.fetch(request(input(),{Authorization:'Bearer wrong'}))).status,401);
  assert.equal((await h.fetch(request(input(),{Origin:'https://hostile.invalid'}))).status,403);
  assert.equal((await createHandler({provider,store:new TestStore()}).fetch(request())).status,503);
});
test('Health distinguishes connectivity from actual inference',async()=>{
  const h=createHandler({token,provider,store:new TestStore()});const r=await h.fetch(new Request('https://office.invalid/health'));const x=await r.json();
  assert.equal(x.authentication,'required');assert.equal(x.inferenceChecked,false);assert.equal(x.externalActions,false);assert.equal(x.ready,true);
});
test('Sensitive endpoints cannot be activated by prompt text or approval fields',async()=>{
  const h=createHandler({token,provider,store:new TestStore()});
  assert.equal((await h.fetch(new Request('https://office.invalid/v1/pay',{method:'POST',headers:{Authorization:`Bearer ${token}`}}))).status,404);
  for(const body of [input({approved:true}),input({intent:'execute'}),input({zeroCost:false}),input({model:'paid/model'}),input({memory:Array(9).fill({id:'n',text:'x'})})])assert.throws(()=>validateJob(body));
});
test('Success persists and replay returns result without a second inference',async()=>{
  let calls=0;const store=new TestStore(),h=createHandler({token,store,provider:{call:async agent=>{calls++;return provider.call(agent);}}});
  assert.equal((await h.fetch(request())).status,200);assert.equal((await h.fetch(request())).status,200);assert.equal(calls,1);
  assert.equal((await h.fetch(request(input({text:'Changed task'})))).status,409);assert.equal(calls,1);
});
test('Idempotency key must match body id',async()=>{
  const h=createHandler({token,provider,store:new TestStore()});assert.equal((await h.fetch(request(input(),{'Idempotency-Key':'different'}))).status,400);
});
test('Body sizes are bounded even without Content-Length',async()=>{
  const h=createHandler({token,provider,store:new TestStore()});assert.equal((await h.fetch(request(input({text:'x'.repeat(110000)})))).status,413);
});
test('Provider failures are sanitized and saved as failures',async()=>{
  const store=new TestStore(),h=createHandler({token,store,provider:{call:()=>{throw Error('secret credential must not leak');}}});
  const r=await h.fetch(request());assert.equal(r.status,503);assert.ok(!(await r.text()).includes('secret credential'));assert.ok(store.rows.get(input().id).result.error);
});
test('Free model checks reject paid, NaN, missing or nonzero prices',()=>{
  const free={id:'a/model:free',pricing:{prompt:'0',completion:'0'}};
  assert.equal(isFreeModel(free),true);
  for(const row of [{...free,id:'a/paid'},{...free,pricing:{prompt:'0'}},{...free,pricing:{prompt:'0',completion:'NaN'}},{...free,pricing:{...free.pricing,request:'0.001'}},{...free,pricing:{prompt:null,completion:'0'}}])assert.equal(isFreeModel(row),false);
});
test('Provider sends price cap, disallows fallback and no tools or paid plugins',async()=>{
  let sent;const p=createProvider({key:'fake-provider-key',models:['test/a:free'],fetcher:async(u,o)=>{
    if(u.endsWith('/models'))return json({data:[{id:'test/a:free',pricing:{prompt:'0',completion:'0'}}]});
    sent=JSON.parse(o.body);return json({model:'test/a:free',choices:[{message:{content:'ok'},finish_reason:'stop'}],usage:{cost:0}});
  }});await p.call('Direttore','test');assert.equal(sent.provider.max_price.prompt,0);assert.equal(sent.provider.max_price.completion,0);assert.equal(sent.provider.allow_fallbacks,false);assert.equal(sent.tools,undefined);assert.equal(sent.plugins,undefined);
});
test('Changed pricing fails before provider inference',async()=>{
  let calls=0;const p=createProvider({key:'fake',models:['test/a:free'],fetcher:async u=>{if(u.endsWith('/models'))return json({data:[{id:'test/a:free',pricing:{prompt:'1',completion:'0'}}]});calls++;return json({});}});
  await assert.rejects(p.call('Direttore','x'),/Nessun modello gratuito/);assert.equal(calls,0);
});
test('Claiming a different executed model is rejected',async()=>{
  const p=createProvider({key:'fake',models:['test/a:free'],fetcher:async u=>u.endsWith('/models')?json({data:[{id:'test/a:free',pricing:{prompt:'0',completion:'0'}}]}):json({model:'other/model',choices:[{message:{content:'x'}}]})});
  await assert.rejects(p.call('Direttore','x'),/diverso/);
});
test('Independent review checks the actual model, even if a provider ignores exclusion',async()=>{
  const j=validateJob(input({mode:'independent'}));const p={call:async agent=>({agent,model:'same-model',provider:'test',text:agent==='Verity'?'{"verdict":"pass","issues":[],"summary":"ok"}':'draft'})};
  const out=await executeJob(j,p);assert.equal(out.status,'partial');assert.equal(out.review.independent,false);assert.ok(out.failures.some(f=>f.error==='review-model-collision'));
});
test('Distinct reviewer rejection cannot be advertised as completed',async()=>{
  const j=validateJob(input({mode:'independent'}));const p={call:async agent=>({agent,model:agent==='Verity'?'reviewer':'writer',provider:'test',text:agent==='Verity'?'{"verdict":"reject","issues":["Prove mancanti"],"summary":"Rivedere"}':'draft'})};
  const out=await executeJob(j,p);assert.equal(out.status,'partial');assert.equal(out.review.status,'reject');assert.equal(out.result,'draft');
});
test('Separate successful review returns checked draft and recorded contributions',async()=>{
  const p={call:async agent=>({agent,model:agent==='Verity'?'reviewer':'writer',provider:'test',text:agent==='Verity'?'{"verdict":"pass","issues":[],"summary":"Nessun errore rilevato"}':'checked draft'})};
  const out=await executeJob(validateJob(input({mode:'independent'})),p);assert.equal(out.status,'completed');assert.equal(out.review.independent,true);assert.equal(out.contributions.length,4);
});
test('Encrypted checkpoints round-trip and reject tampering',()=>{
  const key=randomBytes(32),value={result:'private result'},cipher=seal(value,key);assert.ok(!cipher.includes('private'));assert.deepEqual(unseal(cipher,key),value);
  const [iv,tag,data]=cipher.split('.');const bytes=Buffer.from(data,'base64');bytes[0]^=1;assert.throws(()=>unseal([iv,tag,bytes.toString('base64')].join('.'),key));
});

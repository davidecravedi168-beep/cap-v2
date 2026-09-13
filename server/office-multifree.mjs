const ORIGIN='https://davidecravedi168-beep.github.io';
const POLLINATIONS_URL='https://text.pollinations.ai/openai';
const BLOCKRUN_URL='https://blockrun.ai/api/v1/chat/completions';
const VIREONIX_URL='https://vireonix.ai/v1/chat/completions';
const BLOCKRUN_MODELS=[
  'nvidia/nemotron-3.5-lightning',
  'nvidia/nemotron-3-ultra-550b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'nvidia/llama-3.2-11b-vision',
  'cohere/north-mini-code',
  'poolside/laguna-xs-2.1'
];
const HARD_DEADLINE_MS=26000;
const MIN_ATTEMPT_MS=2200;

function cors(req){
  const o=req.headers.get('origin')||'';
  if(o&&o!==ORIGIN)return null;
  return{
    'content-type':'application/json',
    'access-control-allow-origin':o||ORIGIN,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'Content-Type',
    'cache-control':'no-store'
  };
}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers});}
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rotatedModels(seed){const start=hash(seed)%BLOCKRUN_MODELS.length;return BLOCKRUN_MODELS.map((_,i)=>BLOCKRUN_MODELS[(start+i)%BLOCKRUN_MODELS.length]);}
function safeReason(provider,error){
  const m=String(error?.message||error||'').toLowerCase();
  if(m.includes('capacity')||m.includes('exhausted')||m.includes('overloaded'))return `${provider}: capacità gratuita occupata`;
  if(m.includes('429')||m.includes('rate')||m.includes('quota'))return `${provider}: limite gratuito temporaneo`;
  if(m.includes('401')||m.includes('403')||m.includes('auth'))return `${provider}: accesso gratuito non disponibile`;
  if(m.includes('timeout')||m.includes('abort'))return `${provider}: timeout`;
  if(m.includes('empty'))return `${provider}: risposta vuota`;
  return `${provider}: non disponibile`;
}
async function postJson(url,body,ms){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const raw=await r.text();let d={};try{d=JSON.parse(raw);}catch{}
    if(!r.ok){const detail=d?.error?.message||d?.error||`${r.status}`;throw new Error(String(detail));}
    return d;
  }catch(e){if(e?.name==='AbortError')throw new Error('timeout');throw e;}finally{clearTimeout(timer);}
}
async function callPollinations(system,user,ms){
  const d=await postJson(POLLINATIONS_URL,{model:'openai',messages:[{role:'system',content:system},{role:'user',content:user}],private:true,temperature:0.25},ms);
  const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';
  if(!String(text).trim())throw new Error('Pollinations empty response');
  return{provider:'Pollinations',model:d?.model||'openai',text:String(text)};
}
async function callProvider({name,url,model},system,user,ms){
  const d=await postJson(url,{model,messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:1500,temperature:0.25},ms);
  const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';
  if(!String(text).trim())throw new Error(`${name} empty response`);
  return{provider:name,model:d?.model||model,text:String(text)};
}
function teamPrompt(job){
  const team=[...new Set(Array.isArray(job?.team)?job.team:[])].filter(Boolean).slice(0,4);
  const roles=team.length?team:['Direttore'];
  return `Sei il motore operativo di The Office. Devi svolgere davvero l'incarico, senza fingere accessi o azioni non avvenute.\nRuoli richiesti: ${roles.join(', ')}.\nLavora in modo trasparente: se un dato non è disponibile dichiaralo.\nConsegna una risposta finale pratica e concisa. Se utile, separa brevemente i contributi dei ruoli, ma non inventare fonti.\nCosto richiesto: zero.`;
}
async function resilient(system,user){
  const failures=[];
  const deadline=Date.now()+HARD_DEADLINE_MS;
  const models=rotatedModels(user);
  try{return await callPollinations(system,user,Math.min(9000,deadline-Date.now()-350));}catch(e){failures.push({provider:'Pollinations',model:'openai',error:safeReason('Pollinations',e)});}
  const attempts=[
    {provider:'BlockRun',url:BLOCKRUN_URL,model:models[0],targetMs:6000},
    {provider:'Vireonix',url:VIREONIX_URL,model:'auto',targetMs:7500},
    ...models.slice(1).map(model=>({provider:'BlockRun',url:BLOCKRUN_URL,model,targetMs:3500}))
  ];
  for(const a of attempts){
    const remaining=deadline-Date.now()-350;
    if(remaining<MIN_ATTEMPT_MS)break;
    const timeout=Math.max(MIN_ATTEMPT_MS,Math.min(a.targetMs,remaining));
    try{return await callProvider({name:a.provider,url:a.url,model:a.model},system,user,timeout);}catch(e){failures.push({provider:a.provider,model:a.model,error:safeReason(a.provider,e)});}
  }
  const err=new Error('free-engines-unavailable');err.failures=failures;throw err;
}
async function execute(job){
  const text=String(job?.text||'').trim();if(!text)throw new Error('missing-job-text');
  const result=await resilient(teamPrompt(job),text);
  return{result:result.text,provider:result.provider,model:result.model,qualityReport:`Risposta completata tramite ${result.provider} (${result.model}). Modalità zero-euro; nessuna azione esterna eseguita.`,contributions:[{agent:'Direttore',provider:result.provider,model:result.model,text:result.text}],failures:[]};
}
export default{async fetch(req){
  const h=cors(req);if(!h)return json({error:'origin-not-allowed',zeroCost:true},403,{'content-type':'application/json'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});
  const u=new URL(req.url);
  if(req.method==='GET'&&u.pathname==='/health')return json({ok:true,zeroCost:true,providers:['Pollinations','BlockRun','Vireonix'],engines:BLOCKRUN_MODELS.length+2,strategy:'pollinations-first-multifree-fallback',hardDeadlineSeconds:HARD_DEADLINE_MS/1000},200,h);
  if(req.method==='POST'&&u.pathname==='/v1/jobs'){
    try{const job=await req.json();const out=await execute(job);return json({status:'completed',zeroCost:true,id:job.id||null,...out},200,h);}
    catch(e){
      if(String(e?.message||e)==='missing-job-text')return json({status:'failed',zeroCost:true,error:'Incarico vuoto.'},400,h);
      return json({status:'failed',zeroCost:true,retryable:true,error:'I motori gratuiti pubblici non hanno completato questa richiesta. Nessun costo è stato generato.',failures:Array.isArray(e?.failures)?e.failures:[]},503,h);
    }
  }
  return json({error:'not-found',zeroCost:true},404,h);
}};

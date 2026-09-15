const ORIGIN='https://davidecravedi168-beep.github.io';
const POLLINATIONS_URL='https://text.pollinations.ai/openai';
const BLOCKRUN_URL='https://blockrun.ai/api/v1/chat/completions';
const VIREONIX_URL='https://vireonix.ai/v1/chat/completions';

const HARD_DEADLINE_MS=28000;
const MIN_ATTEMPT_MS=2200;
export const MODEL_BOARD_VERSION='2026-09-15-v2';

const B=(model)=>({provider:'BlockRun',url:BLOCKRUN_URL,model,targetMs:4800});
const V=()=>({provider:'Vireonix',url:VIREONIX_URL,model:'auto',targetMs:5200});
const P=()=>({provider:'Pollinations',url:POLLINATIONS_URL,model:'openai',targetMs:6000,pollinations:true});

export const ROLE_MODEL_BOARD={
  Direttore:{purpose:'orchestrazione e sintesi',route:[B('nvidia/nemotron-3-ultra-550b'),P(),V()]},
  Lumen:{purpose:'ricerca sui materiali forniti e verifica',route:[B('nvidia/nemotron-3.5-lightning'),P(),B('nvidia/nemotron-3-ultra-550b'),V()]},
  Coda:{purpose:'coding, documenti e costruzione',route:[B('cohere/north-mini-code'),B('poolside/laguna-xs-2.1'),P(),B('nvidia/nemotron-3-ultra-550b'),V()]},
  Mosaic:{purpose:'materiali e multimodale quando l’input lo consente',route:[B('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'),B('nvidia/llama-3.2-11b-vision'),P(),B('nvidia/nemotron-3.5-lightning'),V()]},
  Sage:{purpose:'strategia e scenari',route:[B('nvidia/nemotron-3-ultra-550b'),P(),B('nvidia/nemotron-3.5-lightning'),V()]},
  Aegis:{purpose:'sicurezza, rischio e controlli',route:[B('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'),P(),B('nvidia/nemotron-3-ultra-550b'),V()]},
  Verity:{purpose:'controprova indipendente',route:[V(),B('nvidia/nemotron-3.5-lightning'),P(),B('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning')]},
  Ledger:{purpose:'numeri e finanza',route:[B('nvidia/nemotron-3-ultra-550b'),P(),B('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'),V()]},
  Archivist:{purpose:'memoria e sintesi del contesto fornito',route:[B('nvidia/nemotron-3.5-lightning'),P(),B('nvidia/nemotron-3-ultra-550b'),V()]},
  Qualita:{purpose:'quality gate',route:[V(),B('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'),P(),B('nvidia/nemotron-3.5-lightning')]},
};

export function routeForAgent(agent){return ROLE_MODEL_BOARD[agent]||ROLE_MODEL_BOARD.Direttore;}

const ROLE_RULES={
  Direttore:'Coordina e sintetizza. Consegna un risultato pratico e conciso.',
  Lumen:'Lavora solo sui dati e sulle fonti incluse nel prompt. Non fingere browsing o fonti non fornite.',
  Coda:'Produci artefatti, codice o testi concreti. Segnala ciò che non puoi eseguire.',
  Mosaic:'Organizza i materiali ricevuti. Non dichiarare di aver visto immagini/PDF se nel prompt non sono presenti contenuti multimodali reali.',
  Sage:'Confronta scenari, alternative, vincoli e conseguenze.',
  Aegis:'Cerca rischi, permessi mancanti, failure mode e problemi di sicurezza.',
  Verity:'Agisci da revisore severo: cerca errori, assunzioni e controesempi. Non approvare per cortesia.',
  Ledger:'Esplicita ipotesi, unità, passaggi e controlli numerici.',
  Archivist:'Riassumi solo il contesto fornito. Non inventare memoria persistente o accessi.',
  Qualita:'Esegui un quality gate indipendente e segnala difetti concreti.',
};

function cors(req){const o=req.headers.get('origin')||'';if(o&&o!==ORIGIN)return null;return{'content-type':'application/json','access-control-allow-origin':o||ORIGIN,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type','cache-control':'no-store'};}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers});}
function safeReason(provider,error){const m=String(error?.message||error||'').toLowerCase();if(m.includes('capacity')||m.includes('exhausted')||m.includes('overloaded'))return `${provider}: capacità gratuita occupata`;if(m.includes('429')||m.includes('rate')||m.includes('quota'))return `${provider}: limite gratuito temporaneo`;if(m.includes('401')||m.includes('403')||m.includes('auth'))return `${provider}: accesso gratuito non disponibile`;if(m.includes('timeout')||m.includes('abort'))return `${provider}: timeout`;if(m.includes('empty'))return `${provider}: risposta vuota`;return `${provider}: non disponibile`;}
async function postJson(url,body,ms){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const raw=await r.text();let d={};try{d=JSON.parse(raw);}catch{}if(!r.ok){const detail=d?.error?.message||d?.error||`${r.status}`;throw new Error(String(detail));}return d;}catch(e){if(e?.name==='AbortError')throw new Error('timeout');throw e;}finally{clearTimeout(timer);}}
async function callAttempt(a,system,user,ms){if(a.pollinations){const d=await postJson(a.url,{model:'openai',messages:[{role:'system',content:system},{role:'user',content:user}],private:true,temperature:0.2},ms);const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';if(!String(text).trim())throw new Error('Pollinations empty response');return{provider:'Pollinations',model:d?.model||a.model,text:String(text)};}const d=await postJson(a.url,{model:a.model,messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:1700,temperature:0.2},ms);const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';if(!String(text).trim())throw new Error(`${a.provider} empty response`);return{provider:a.provider,model:d?.model||a.model,text:String(text)};}
function systemPrompt(agent){return `Sei ${agent} di The Office. ${ROLE_RULES[agent]||ROLE_RULES.Direttore}\nRegole invariabili:\n- costo richiesto: zero;\n- non fingere browsing, strumenti, accessi, memoria, file o azioni esterne;\n- separa fatti, ipotesi e dati mancanti quando serve;\n- se il compito richiede una capacità non realmente disponibile, dichiaralo;\n- rispondi in italiano salvo richiesta diversa.`;}
async function resilient(agent,user){const failures=[];const deadline=Date.now()+HARD_DEADLINE_MS;for(const a of routeForAgent(agent).route){const remaining=deadline-Date.now()-350;if(remaining<MIN_ATTEMPT_MS)break;const timeout=Math.max(MIN_ATTEMPT_MS,Math.min(a.targetMs||5000,remaining));try{return{...(await callAttempt(a,systemPrompt(agent),user,timeout)),agent,failures};}catch(e){failures.push({provider:a.provider,model:a.model,error:safeReason(a.provider,e)});}}const err=new Error('free-engines-unavailable');err.failures=failures;throw err;}
function requestedAgent(job){const team=[...new Set((Array.isArray(job?.team)?job.team:[]).filter(Boolean))];return team.length===1&&ROLE_MODEL_BOARD[team[0]]?team[0]:'Direttore';}
async function execute(job){const text=String(job?.text||'').trim();if(!text)throw new Error('missing-job-text');const agent=requestedAgent(job);const result=await resilient(agent,text);const preferred=routeForAgent(agent).route[0];return{result:result.text,provider:result.provider,model:result.model,modelBoardVersion:MODEL_BOARD_VERSION,routedAgent:agent,preferred:{provider:preferred.provider,model:preferred.model},qualityReport:`${agent} ha lavorato tramite ${result.provider} (${result.model}). Routing Model Board ${MODEL_BOARD_VERSION}. Modalità zero-euro; nessuna azione esterna eseguita.`,contributions:[{agent,provider:result.provider,model:result.model,text:result.text}],failures:result.failures||[]};}
function publicBoard(){return Object.fromEntries(Object.entries(ROLE_MODEL_BOARD).map(([agent,row])=>[agent,{purpose:row.purpose,preferred:{provider:row.route[0].provider,model:row.route[0].model},fallbacks:row.route.slice(1).map(x=>({provider:x.provider,model:x.model}))}]));}
export default{async fetch(req){const h=cors(req);if(!h)return json({error:'origin-not-allowed',zeroCost:true},403,{'content-type':'application/json'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});const u=new URL(req.url);if(req.method==='GET'&&u.pathname==='/health')return json({ok:true,zeroCost:true,modelBoardVersion:MODEL_BOARD_VERSION,roleRouting:true,modelBoard:publicBoard(),providers:['BlockRun','Pollinations','Vireonix'],strategy:'role-aware-zero-cost-routing',hardDeadlineSeconds:HARD_DEADLINE_MS/1000},200,h);if(req.method==='POST'&&u.pathname==='/v1/jobs'){try{const job=await req.json();const out=await execute(job);return json({status:'completed',zeroCost:true,id:job.id||null,...out},200,h);}catch(e){if(String(e?.message||e)==='missing-job-text')return json({status:'failed',zeroCost:true,error:'Incarico vuoto.'},400,h);return json({status:'failed',zeroCost:true,retryable:true,error:'I motori gratuiti pubblici non hanno completato questa richiesta. Nessun costo è stato generato.',failures:Array.isArray(e?.failures)?e.failures:[]},503,h);}}return json({error:'not-found',zeroCost:true},404,h);}};

const ORIGIN='https://davidecravedi168-beep.github.io';
const VIREONIX_URL='https://vireonix.ai/v1/chat/completions';

const HARD_DEADLINE_MS=28000;
const ATTEMPT_MS=26000;
export const MODEL_BOARD_VERSION='2026-09-15-v4';

const V=()=>({provider:'Vireonix',url:VIREONIX_URL,model:'auto',targetMs:ATTEMPT_MS});

export const ROLE_MODEL_BOARD={
  Direttore:{purpose:'orchestrazione e sintesi',route:[V()]},
  Lumen:{purpose:'ricerca sui materiali forniti e verifica',route:[V()]},
  Coda:{purpose:'coding, documenti e costruzione',route:[V()]},
  Mosaic:{purpose:'materiali e multimodale quando l’input lo consente',route:[V()]},
  Sage:{purpose:'strategia e scenari',route:[V()]},
  Aegis:{purpose:'sicurezza, rischio e controlli',route:[V()]},
  Verity:{purpose:'controprova indipendente',route:[V()]},
  Ledger:{purpose:'numeri e finanza',route:[V()]},
  Archivist:{purpose:'memoria e sintesi del contesto fornito',route:[V()]},
  Qualita:{purpose:'quality gate',route:[V()]},
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
  Ledger:'Esplicita ipotesi, unità, passaggi e controlli numerici. In finanza non promettere rendimenti certi o trasformazioni garantite del capitale.',
  Archivist:'Riassumi solo il contesto fornito. Non inventare memoria persistente o accessi.',
  Qualita:'Esegui un quality gate indipendente e segnala difetti concreti.',
};

function cors(req){const o=req.headers.get('origin')||'';if(o&&o!==ORIGIN)return null;return{'content-type':'application/json','access-control-allow-origin':o||ORIGIN,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type','cache-control':'no-store'};}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers});}
export function isProviderErrorText(text){const s=String(text||'').trim();if(!s||s.length>1800)return false;return /the api key used for this request has reached its budget|raise the key budget|topping up the wallet does not raise this limit|insufficient (?:credits?|balance)|quota (?:has been )?exceeded|rate limit exceeded|billing limit|payment required/i.test(s);}
function safeReason(provider,error){const m=String(error?.message||error||'').toLowerCase();if(m.includes('budget')||m.includes('credit')||m.includes('billing')||m.includes('payment required')||m.includes('402'))return `${provider}: pagamento o budget non disponibile`;if(m.includes('capacity')||m.includes('exhausted')||m.includes('overloaded')||m.includes('503'))return `${provider}: capacità gratuita occupata`;if(m.includes('429')||m.includes('rate')||m.includes('quota'))return `${provider}: limite gratuito temporaneo`;if(m.includes('401')||m.includes('403')||m.includes('auth'))return `${provider}: accesso gratuito non disponibile`;if(m.includes('timeout')||m.includes('abort'))return `${provider}: timeout`;if(m.includes('empty'))return `${provider}: risposta vuota`;return `${provider}: non disponibile`;}
async function postJson(url,body,ms){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const raw=await r.text();let d={};try{d=JSON.parse(raw);}catch{}if(!r.ok){const detail=d?.error?.message||d?.error||raw||'';throw new Error(`${r.status} ${String(detail)}`.trim());}return d;}catch(e){if(e?.name==='AbortError')throw new Error('timeout');throw e;}finally{clearTimeout(timer);}}
async function callAttempt(a,system,user,ms){const d=await postJson(a.url,{model:a.model,messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:1700,temperature:0.2},ms);const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';if(!String(text).trim())throw new Error(`${a.provider} empty response`);if(isProviderErrorText(text))throw new Error(`${a.provider} provider budget or quota response`);return{provider:a.provider,model:d?.model||a.model,text:String(text)};}
function systemPrompt(agent){return `Sei ${agent} di The Office. ${ROLE_RULES[agent]||ROLE_RULES.Direttore}\nRegole invariabili:\n- costo richiesto: zero;\n- non fingere browsing, strumenti, accessi, memoria, file o azioni esterne;\n- separa fatti, ipotesi e dati mancanti quando serve;\n- se il compito richiede una capacità non realmente disponibile, dichiaralo;\n- rispondi in italiano salvo richiesta diversa.`;}
async function resilient(agent,user){const failures=[];const deadline=Date.now()+HARD_DEADLINE_MS;for(const a of routeForAgent(agent).route){const remaining=deadline-Date.now()-350;if(remaining<2200)break;const timeout=Math.max(2200,Math.min(a.targetMs||ATTEMPT_MS,remaining));try{return{...(await callAttempt(a,systemPrompt(agent),user,timeout)),agent,failures};}catch(e){failures.push({provider:a.provider,model:a.model,error:safeReason(a.provider,e)});}}const err=new Error('free-engines-unavailable');err.failures=failures;throw err;}
function requestedAgent(job){const team=[...new Set((Array.isArray(job?.team)?job.team:[]).filter(Boolean))];return team.length===1&&ROLE_MODEL_BOARD[team[0]]?team[0]:'Direttore';}
async function execute(job){const text=String(job?.text||'').trim();if(!text)throw new Error('missing-job-text');const agent=requestedAgent(job);const result=await resilient(agent,text);const preferred=routeForAgent(agent).route[0];return{result:result.text,provider:result.provider,model:result.model,modelBoardVersion:MODEL_BOARD_VERSION,routedAgent:agent,preferred:{provider:preferred.provider,model:preferred.model},qualityReport:`${agent} ha lavorato tramite ${result.provider} (${result.model}). Routing Model Board ${MODEL_BOARD_VERSION}. Modalità zero-euro; nessuna azione esterna eseguita.`,contributions:[{agent,provider:result.provider,model:result.model,text:result.text}],failures:result.failures||[]};}
function publicBoard(){return Object.fromEntries(Object.entries(ROLE_MODEL_BOARD).map(([agent,row])=>[agent,{purpose:row.purpose,preferred:{provider:row.route[0].provider,model:row.route[0].model},fallbacks:row.route.slice(1).map(x=>({provider:x.provider,model:x.model}))}]));}
export default{async fetch(req){const h=cors(req);if(!h)return json({error:'origin-not-allowed',zeroCost:true},403,{'content-type':'application/json'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});const u=new URL(req.url);if(req.method==='GET'&&u.pathname==='/health')return json({ok:true,zeroCost:true,modelBoardVersion:MODEL_BOARD_VERSION,roleRouting:true,modelBoard:publicBoard(),providers:['Vireonix'],disabledProviders:['BlockRun: richiede pagamento x402','Pollinations: budget key esaurito'],strategy:'role-aware-zero-cost-routing-v4',hardDeadlineSeconds:HARD_DEADLINE_MS/1000},200,h);if(req.method==='POST'&&u.pathname==='/v1/jobs'){try{const job=await req.json();const out=await execute(job);return json({status:'completed',zeroCost:true,id:job.id||null,...out},200,h);}catch(e){if(String(e?.message||e)==='missing-job-text')return json({status:'failed',zeroCost:true,error:'Incarico vuoto.'},400,h);return json({status:'failed',zeroCost:true,retryable:true,error:'Il provider gratuito pubblico non ha completato questa richiesta. Nessun costo è stato generato.',failures:Array.isArray(e?.failures)?e.failures:[]},503,h);}}return json({error:'not-found',zeroCost:true},404,h);}};

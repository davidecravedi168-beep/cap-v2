import http from 'node:http';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||8787);
const ALLOWED_ORIGIN=process.env.OFFICE_ALLOWED_ORIGIN||'https://davidecravedi168-beep.github.io';
const SESSION_TOKEN=process.env.OFFICE_SESSION_TOKEN||'';
const OPENROUTER_API_KEY=process.env.OPENROUTER_API_KEY||'';
const MAX_TEAM=Math.max(1,Math.min(6,Number(process.env.OFFICE_MAX_TEAM||5)));
const MAX_TOKENS=Math.max(1000,Math.min(32000,Number(process.env.OFFICE_MAX_OUTPUT_TOKENS||10000)));

const AGENTS={
  Direttore:{provider:'OpenAI',model:'openai/gpt-6-astra',reasoning:'max',system:'Sei il Direttore di The Office. Coordina specialisti, evidenzia conflitti, sintetizza il lavoro e consegna un risultato operativo. Non fingere azioni non eseguite.'},
  Lumen:{provider:'OpenAI',model:'openai/gpt-6-astra',reasoning:'high',web:true,system:'Sei Lumen, ricercatore di The Office. Cerca evidenze aggiornate, distingui fatti da inferenze, cita le fonti e segnala l’incertezza.'},
  Coda:{provider:'Anthropic',model:'anthropic/claude-fable-5.1',reasoning:'high',system:'Sei Coda, builder di The Office. Produci implementazioni concrete, robuste e verificabili. Esplicita assunzioni e test.'},
  Mosaic:{provider:'Meta',model:'meta/muse-spark-1.3',reasoning:'high',system:'Sei Mosaic, specialista multimodale di The Office. Analizza materiali e contesto con precisione e segnala ciò che non è leggibile o disponibile.'},
  Sage:{provider:'Anthropic',model:'anthropic/claude-opus-5',reasoning:'high',system:'Sei Sage, stratega di The Office. Costruisci scenari, trade-off, rischi e raccomandazioni motivate.'},
  Aegis:{provider:'OpenAI',model:'openai/gpt-5.6-sol',reasoning:'high',system:'Sei Aegis, reviewer di sicurezza di The Office. Cerca rischi, privacy, permessi, frodi, effetti irreversibili e assunzioni pericolose.'},
  Verity:{provider:'xAI',model:'x-ai/grok-4.6',reasoning:'xhigh',system:'Sei Verity, devil advocate indipendente di The Office. Prova a confutare il lavoro, cerca errori e alternative migliori. Non dissentire per sport: sii specifico.'},
  Ledger:{provider:'Z.ai',model:'z-ai/glm-5.3',reasoning:'max',system:'Sei Ledger, analista numerico e finanziario di The Office. Controlla formule, ipotesi, unità, scenari e sensibilità. Non inventare dati mancanti.'},
  Archivist:{provider:'Anthropic',model:'anthropic/claude-fable-5.1',reasoning:'medium',system:'Sei Archivist, memoria di The Office. Organizza contesto, decisioni, precedenti e lezioni; distingui ciò che è ricordato da ciò che è nuovo.'},
  Qualita:{provider:'Anthropic',model:'anthropic/claude-fable-5.1',reasoning:'high',system:'Sei il Direttore Qualità di The Office. Controlla completezza, coerenza, evidenze, assunzioni, errori e aderenza all’incarico. Non riscrivere tutto: emetti un quality report concreto con problemi bloccanti e miglioramenti.'},
  Executor:{provider:'OpenAI',model:'openai/gpt-6-astra',reasoning:'high',system:'Sei Executor di The Office. Trasforma una decisione approvata in un piano di esecuzione verificabile. Se manca autorizzazione o accesso, fermati e dichiara cosa serve; non fingere di aver eseguito azioni esterne.'}
};

function safeEqual(a,b){const aa=Buffer.from(a||''),bb=Buffer.from(b||'');return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb)}
function cors(req,res){const origin=req.headers.origin||'';if(origin&&origin!==ALLOWED_ORIGIN)return false;res.setHeader('Access-Control-Allow-Origin',origin||ALLOWED_ORIGIN);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');return true}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw new Error('payload-too-large')}return raw?JSON.parse(raw):{}}
function contentOf(message){if(typeof message?.content==='string')return message.content;if(Array.isArray(message?.content))return message.content.map(x=>x?.text||'').filter(Boolean).join('\n');return''}

async function callFrontier(agent,prompt){
  if(!OPENROUTER_API_KEY)throw new Error('OPENROUTER_API_KEY missing');
  const payload={model:agent.model,messages:[{role:'system',content:agent.system},{role:'user',content:prompt}],max_tokens:MAX_TOKENS,reasoning:{effort:agent.reasoning||'high'}};
  if(agent.web)payload.tools=[{type:'openrouter:web_search',parameters:{engine:'auto',max_total_results:12,search_context_size:'high'}}];
  const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':ALLOWED_ORIGIN,'X-OpenRouter-Title':'The Office'},body:JSON.stringify(payload)});
  const data=await r.json();
  if(!r.ok)throw new Error(`OpenRouter ${r.status}: ${data?.error?.message||'request failed'}`);
  const message=data?.choices?.[0]?.message||{};
  return{text:contentOf(message),annotations:message.annotations||[],usage:data.usage||null,model:data.model||agent.model};
}
async function runAgent(name,prompt){const a=AGENTS[name];if(!a)throw new Error(`Unknown agent: ${name}`);const out=await callFrontier(a,prompt);return{agent:name,provider:a.provider,model:out.model,text:out.text,annotations:out.annotations,usage:out.usage}}
async function execute(job){
  const text=String(job.text||'').trim();if(!text)throw new Error('Missing job text');
  const requested=Array.isArray(job.team)?job.team.filter(x=>AGENTS[x]&&!['Qualita','Executor'].includes(x)):[];
  const team=[...new Set(requested.length?requested:[job.owner&&AGENTS[job.owner]?job.owner:'Direttore'])].slice(0,MAX_TEAM);
  if(team.length===1&&team[0]!=='Direttore'){
    const one=await runAgent(team[0],text);
    const quality=await runAgent('Qualita',`INCARICO:\n${text}\n\nOUTPUT DA CONTROLLARE:\n${one.text}`);
    return{result:one.text,contributions:[one,quality],qualityReport:quality.text,failures:[]};
  }
  const specialists=team.filter(x=>x!=='Direttore');
  const settled=await Promise.allSettled(specialists.map(name=>runAgent(name,text)));
  const contributions=[],failures=[];
  settled.forEach((item,i)=>{if(item.status==='fulfilled')contributions.push(item.value);else failures.push({agent:specialists[i],error:String(item.reason?.message||item.reason)})});
  if(!contributions.length){const solo=await runAgent('Direttore',text);const quality=await runAgent('Qualita',`INCARICO:\n${text}\n\nOUTPUT DA CONTROLLARE:\n${solo.text}`);return{result:solo.text,contributions:[solo,quality],qualityReport:quality.text,failures}}
  const packet=contributions.map(c=>`### ${c.agent} (${c.model})\n${c.text}`).join('\n\n');
  const quality=await runAgent('Qualita',`INCARICO ORIGINALE:\n${text}\n\nCONTRIBUTI DEL TEAM:\n${packet}\n\nControlla il lavoro prima della sintesi finale.`);
  const directorPrompt=`INCARICO ORIGINALE:\n${text}\n\nCONTRIBUTI DEL TEAM:\n${packet}\n\nQUALITY REPORT:\n${quality.text}\n\nProduci la risposta finale correggendo i problemi reali segnalati. Evidenzia ciò che resta incerto e non fingere azioni esterne.`;
  const director=await runAgent('Direttore',directorPrompt);
  return{result:director.text,contributions:[...contributions,quality,director],qualityReport:quality.text,failures};
}

const server=http.createServer(async(req,res)=>{
  if(!cors(req,res))return json(res,403,{error:'origin-not-allowed'});
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  if(req.url==='/health'&&req.method==='GET')return json(res,200,{ok:true,runtime:'openrouter-frontier7',openrouter:Boolean(OPENROUTER_API_KEY),session:Boolean(SESSION_TOKEN),maxTeam:MAX_TEAM,maxOutputTokens:MAX_TOKENS,models:[...new Set(Object.values(AGENTS).map(a=>a.model))]});
  if(req.url==='/v1/jobs'&&req.method==='POST'){
    if(!SESSION_TOKEN)return json(res,503,{error:'OFFICE_SESSION_TOKEN not configured'});
    const auth=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!safeEqual(auth,SESSION_TOKEN))return json(res,401,{error:'unauthorized'});
    try{const job=await body(req);const out=await execute(job);return json(res,200,{status:'completed',id:job.id||null,...out})}catch(err){return json(res,500,{status:'failed',error:String(err?.message||err)})}
  }
  return json(res,404,{error:'not-found'});
});
server.listen(PORT,()=>console.log(`The Office frontier runtime listening on ${PORT}`));

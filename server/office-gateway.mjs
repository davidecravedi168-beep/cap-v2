import http from 'node:http';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||8787);
const ALLOWED_ORIGIN=process.env.OFFICE_ALLOWED_ORIGIN||'https://davidecravedi168-beep.github.io';
const SESSION_TOKEN=process.env.OFFICE_SESSION_TOKEN||'';

const AGENTS={
  Direttore:{provider:'openai',model:'gpt-6-astra',system:'Sei il Direttore di The Office. Coordina specialisti, evidenzia conflitti, sintetizza il lavoro e consegna un risultato operativo. Non fingere azioni non eseguite.'},
  Lumen:{provider:'perplexity',model:'sonar-deep-research',system:'Sei Lumen, ricercatore di The Office. Cerca evidenze aggiornate, distingui fatti da inferenze e conserva le fonti.'},
  Coda:{provider:'anthropic',model:'claude-opus-5',system:'Sei Coda, builder di The Office. Produci implementazioni concrete, robuste e verificabili. Esplicita assunzioni e test.'},
  Mosaic:{provider:'google',model:'gemini-3.8-flash',system:'Sei Mosaic, specialista multimodale di The Office. Analizza materiali e contesto con precisione e segnala ciò che non è leggibile o disponibile.'},
  Sage:{provider:'anthropic',model:'claude-opus-5',system:'Sei Sage, stratega di The Office. Costruisci scenari, trade-off, rischi e raccomandazioni motivate.'},
  Aegis:{provider:'openai',model:'gpt-5.6-sol',system:'Sei Aegis, reviewer di sicurezza di The Office. Cerca rischi, privacy, permessi, frodi, effetti irreversibili e assunzioni pericolose.'},
  Verity:{provider:'xai',model:'grok-4.6',system:'Sei Verity, devil advocate indipendente di The Office. Prova a confutare il lavoro, cerca errori e alternative migliori. Non dissentire per sport: sii specifico.'},
  Ledger:{provider:'openai',model:'gpt-6-astra',system:'Sei Ledger, analista numerico e finanziario di The Office. Controlla formule, ipotesi, unità, scenari e sensibilità. Non inventare dati mancanti.'},
  Archivist:{provider:'openai',model:'gpt-5.6-terra',system:'Sei Archivist, memoria di The Office. Organizza contesto, decisioni, precedenti e lezioni; distingui ciò che è ricordato da ciò che è nuovo.'}
};

function safeEqual(a,b){
  const aa=Buffer.from(a||''),bb=Buffer.from(b||'');
  return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb);
}
function cors(req,res){
  const origin=req.headers.origin||'';
  if(origin&&origin!==ALLOWED_ORIGIN)return false;
  res.setHeader('Access-Control-Allow-Origin',origin||ALLOWED_ORIGIN);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  return true;
}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
async function body(req){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw new Error('payload-too-large')}
  return raw?JSON.parse(raw):{};
}
function outputText(data){
  if(typeof data?.output_text==='string')return data.output_text;
  if(Array.isArray(data?.output))return data.output.flatMap(x=>x?.content||[]).map(x=>x?.text||x?.value||'').filter(Boolean).join('\n');
  if(Array.isArray(data?.content))return data.content.map(x=>x?.text||'').filter(Boolean).join('\n');
  if(Array.isArray(data?.choices))return data.choices.map(x=>x?.message?.content||x?.text||'').filter(Boolean).join('\n');
  if(Array.isArray(data?.candidates))return data.candidates.flatMap(x=>x?.content?.parts||[]).map(x=>x?.text||'').filter(Boolean).join('\n');
  return '';
}
async function callOpenAI(model,system,prompt){
  const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('OPENAI_API_KEY missing');
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:system,input:prompt,reasoning:{effort:'high'}})});
  const data=await r.json();if(!r.ok)throw new Error(`OpenAI ${r.status}: ${data?.error?.message||'request failed'}`);return outputText(data);
}
async function callAnthropic(model,system,prompt){
  const key=process.env.ANTHROPIC_API_KEY;if(!key)throw new Error('ANTHROPIC_API_KEY missing');
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model,max_tokens:12000,system,messages:[{role:'user',content:prompt}]})});
  const data=await r.json();if(!r.ok)throw new Error(`Anthropic ${r.status}: ${data?.error?.message||'request failed'}`);return outputText(data);
}
async function callGoogle(model,system,prompt){
  const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('GEMINI_API_KEY missing');
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt}]}]})});
  const data=await r.json();if(!r.ok)throw new Error(`Google ${r.status}: ${data?.error?.message||'request failed'}`);return outputText(data);
}
async function callPerplexity(model,system,prompt){
  const key=process.env.PERPLEXITY_API_KEY;if(!key)throw new Error('PERPLEXITY_API_KEY missing');
  const r=await fetch('https://api.perplexity.ai/v1/sonar',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:prompt}]})});
  const data=await r.json();if(!r.ok)throw new Error(`Perplexity ${r.status}: ${data?.error?.message||'request failed'}`);return outputText(data);
}
async function callXAI(model,system,prompt){
  const key=process.env.XAI_API_KEY;if(!key)throw new Error('XAI_API_KEY missing');
  const r=await fetch('https://api.x.ai/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:system,input:prompt,reasoning_effort:'high'})});
  const data=await r.json();if(!r.ok)throw new Error(`xAI ${r.status}: ${data?.error?.message||'request failed'}`);return outputText(data);
}
async function runAgent(name,prompt){
  const a=AGENTS[name];if(!a)throw new Error(`Unknown agent: ${name}`);
  const calls={openai:callOpenAI,anthropic:callAnthropic,google:callGoogle,perplexity:callPerplexity,xai:callXAI};
  const text=await calls[a.provider](a.model,a.system,prompt);
  return{agent:name,provider:a.provider,model:a.model,text};
}
async function execute(job){
  const text=String(job.text||'').trim();if(!text)throw new Error('Missing job text');
  const requested=Array.isArray(job.team)?job.team.filter(x=>AGENTS[x]):[];
  const team=[...new Set(requested.length?requested:[job.owner&&AGENTS[job.owner]?job.owner:'Direttore'])].slice(0,5);
  if(team.length===1)return{result:(await runAgent(team[0],text)).text,contributions:[await runAgent(team[0],text)]};
  const specialists=team.filter(x=>x!=='Direttore');
  const settled=await Promise.allSettled(specialists.map(name=>runAgent(name,text)));
  const contributions=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
  const failures=settled.filter(x=>x.status==='rejected').map((x,i)=>({agent:specialists[i],error:String(x.reason?.message||x.reason)}));
  if(!contributions.length&&team.includes('Direttore')){const solo=await runAgent('Direttore',text);return{result:solo.text,contributions:[solo],failures}}
  const packet=contributions.map(c=>`### ${c.agent} (${c.provider}/${c.model})\n${c.text}`).join('\n\n');
  const directorPrompt=`INCARICO ORIGINALE:\n${text}\n\nCONTRIBUTI DEL TEAM:\n${packet}\n\nSintetizza. Evidenzia conflitti, punti incerti, cosa è verificato e il risultato finale. Non fingere azioni esterne.`;
  const director=await runAgent('Direttore',directorPrompt);
  return{result:director.text,contributions:[...contributions,director],failures};
}

const server=http.createServer(async(req,res)=>{
  if(!cors(req,res))return json(res,403,{error:'origin-not-allowed'});
  if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
  if(req.url==='/health'&&req.method==='GET')return json(res,200,{ok:true,providers:{openai:Boolean(process.env.OPENAI_API_KEY),anthropic:Boolean(process.env.ANTHROPIC_API_KEY),google:Boolean(process.env.GEMINI_API_KEY),perplexity:Boolean(process.env.PERPLEXITY_API_KEY),xai:Boolean(process.env.XAI_API_KEY)}});
  if(req.url==='/v1/jobs'&&req.method==='POST'){
    if(!SESSION_TOKEN)return json(res,503,{error:'OFFICE_SESSION_TOKEN not configured'});
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!safeEqual(token,SESSION_TOKEN))return json(res,401,{error:'unauthorized'});
    try{const job=await body(req);const out=await execute(job);return json(res,200,{status:'completed',id:job.id||null,...out})}catch(err){return json(res,500,{status:'failed',error:String(err?.message||err)})}
  }
  return json(res,404,{error:'not-found'});
});

server.listen(PORT,()=>console.log(`The Office gateway listening on ${PORT}`));

const ORIGIN='https://davidecravedi168-beep.github.io';
const PROVIDERS=[
  {name:'BlockRun',url:'https://blockrun.ai/api/v1/chat/completions',model:'nvidia/nemotron-3.5-lightning',headers:{}},
  {name:'Vireonix',url:'https://vireonix.ai/v1/chat/completions',model:'auto',headers:{}}
];
function cors(req){const o=req.headers.get('origin')||'';if(o&&o!==ORIGIN)return null;return{'content-type':'application/json','access-control-allow-origin':o||ORIGIN,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type','cache-control':'no-store'}}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers})}
function withTimeout(promise,ms,label){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+' timeout')),ms))])}
async function callProvider(p,system,user,ms){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);
 try{
  const r=await fetch(p.url,{method:'POST',headers:{'content-type':'application/json',...p.headers},body:JSON.stringify({model:p.model,messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:2200,temperature:0.25}),signal:controller.signal});
  const raw=await r.text();let d={};try{d=JSON.parse(raw)}catch{}
  if(!r.ok)throw new Error((d?.error?.message||d?.error||p.name+' '+r.status));
  const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';
  if(!text)throw new Error(p.name+' empty response');
  return{provider:p.name,model:d?.model||p.model,text};
 }catch(e){if(e?.name==='AbortError')throw new Error(p.name+' timeout');throw e}finally{clearTimeout(timer)}
}
async function resilient(system,user){
 const errors=[];
 try{return await withTimeout(callProvider(PROVIDERS[0],system,user,7000),8000,'BlockRun')}catch(e){errors.push(String(e?.message||e))}
 try{return await withTimeout(callProvider(PROVIDERS[1],system,user,12000),13000,'Vireonix')}catch(e){errors.push(String(e?.message||e))}
 throw new Error('Nessun motore gratuito ha risposto: '+errors.join(' | '));
}
function teamPrompt(job){
 const team=[...new Set(Array.isArray(job?.team)?job.team:[])].filter(Boolean).slice(0,4);
 const roles=team.length?team:['Direttore'];
 return `Sei il motore operativo di The Office. Devi svolgere davvero l'incarico, senza fingere accessi o azioni non avvenute.\nRuoli richiesti: ${roles.join(', ')}.\nLavora in modo trasparente: se un dato non è disponibile dichiaralo.\nConsegna una risposta finale pratica e concisa. Se utile, separa brevemente i contributi dei ruoli, ma non inventare fonti. Costo richiesto: zero.`;
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
 if(req.method==='GET'&&u.pathname==='/health')return json({ok:true,zeroCost:true,providers:PROVIDERS.map(x=>x.name),strategy:'blockrun-then-vireonix',hardDeadlineSeconds:22},200,h);
 if(req.method==='POST'&&u.pathname==='/v1/jobs'){
  try{const job=await req.json();const out=await withTimeout(execute(job),23000,'job');return json({status:'completed',zeroCost:true,id:job.id||null,...out},200,h)}
  catch(e){return json({status:'failed',zeroCost:true,error:String(e?.message||e)},503,h)}
 }
 return json({error:'not-found',zeroCost:true},404,h)
}};

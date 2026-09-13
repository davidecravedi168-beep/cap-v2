const O='https://davidecravedi168-beep.github.io';
const BASE='https://blockrun.ai/api/v1/chat/completions';
const FREE={Direttore:'nvidia/nemotron-3-ultra-550b',Lumen:'nvidia/nemotron-3.5-lightning',Coda:'poolside/laguna-xs-2.1',Mosaic:'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',Sage:'nvidia/nemotron-3.5-lightning',Aegis:'nvidia/nemotron-3-ultra-550b',Verity:'nvidia/gpt-oss-20b',Ledger:'nvidia/nemotron-3-ultra-550b',Archivist:'nvidia/nemotron-3.5-lightning',Qualita:'cohere/north-mini-code',Executor:'poolside/laguna-xs-2.1'};
const FALLBACK='nvidia/gpt-oss-20b';
const ALLOWED=new Set(['nvidia/nemotron-3-ultra-550b','nvidia/nemotron-3.5-lightning','nvidia/nemotron-3-nano-omni-30b-a3b-reasoning','nvidia/llama-3.2-11b-vision','cohere/north-mini-code','poolside/laguna-xs-2.1','nvidia/gpt-oss-20b']);
function headers(req){const o=req.headers.get('origin')||'';if(o&&o!==O)return null;return{'content-type':'application/json','access-control-allow-origin':o||O,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type','cache-control':'no-store'}}
function json(body,status,h){return new Response(JSON.stringify(body),{status,headers:h})}
async function ask(model,agent,prompt,timeoutMs=12000){
 if(!ALLOWED.has(model))throw new Error('model-not-approved');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetch(BASE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:`Sei ${agent} di The Office. Lavora con precisione. Non fingere browsing live o azioni esterne. Se un dato richiede una fonte aggiornata non disponibile, dichiaralo.`},{role:'user',content:prompt}],max_tokens:2200,temperature:0.2}),signal:controller.signal});
  const text=await r.text();let d={};try{d=JSON.parse(text)}catch{}if(!r.ok)throw new Error(d?.error?.message||`BlockRun ${r.status}`);const out=d?.choices?.[0]?.message?.content||'';if(!out)throw new Error('empty-model-response');return{agent,model:d?.model||model,text:out}
 }catch(e){if(e?.name==='AbortError')throw new Error(`timeout-${model}`);throw e}finally{clearTimeout(timer)}
}
async function run(agent,prompt){const preferred=FREE[agent]||FREE.Direttore;try{return await ask(preferred,agent,prompt,12000)}catch(first){if(preferred===FALLBACK)throw first;try{return await ask(FALLBACK,agent,prompt,9000)}catch(second){throw new Error(`${first.message}; fallback: ${second.message}`)}}}
async function execute(job){
 const text=String(job?.text||'').trim();if(!text)throw new Error('missing-job-text');
 const raw=(Array.isArray(job?.team)?job.team:['Direttore']).filter(x=>FREE[x]);
 const specialists=[...new Set(raw.filter(x=>x!=='Direttore'&&x!=='Qualita'))].slice(0,2);
 const contributions=[],failures=[];
 if(specialists.length){const z=await Promise.allSettled(specialists.map(n=>run(n,text)));z.forEach((x,i)=>x.status==='fulfilled'?contributions.push(x.value):failures.push({agent:specialists[i],error:String(x.reason?.message||x.reason)}))}
 if(!contributions.length){const first=raw.find(x=>x!=='Qualita')||'Direttore';contributions.push(await run(first,text))}
 if(contributions.length===1&&contributions[0].agent==='Direttore')return{result:contributions[0].text,qualityReport:'Controllo qualità integrato nella risposta rapida del Direttore.',contributions,failures};
 const packet=contributions.map(x=>`### ${x.agent} (${x.model})\n${x.text}`).join('\n\n');
 try{
  const director=await run('Direttore',`INCARICO:\n${text}\n\nCONTRIBUTI:\n${packet}\n\nControlla contraddizioni e omissioni, poi produci una risposta finale operativa e concisa. Non inventare fonti o azioni.`);
  return{result:director.text,qualityReport:'Quality pass integrato nella sintesi finale per ridurre latenza e quota gratuita.',contributions:[...contributions,director],failures}
 }catch(e){failures.push({agent:'Direttore',error:String(e?.message||e)});return{result:contributions[0].text,qualityReport:'Sintesi del Direttore non disponibile entro il timeout; mostrato il miglior contributo completato.',contributions,failures}}
}
export default{async fetch(req){const h=headers(req);if(!h)return json({error:'origin-not-allowed',zeroCost:true},403,{'content-type':'application/json'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});const u=new URL(req.url);if(req.method==='GET'&&u.pathname==='/health')return json({ok:true,zeroCost:true,provider:'BlockRun free tier',accountRequired:false,walletRequired:false,timeoutGuard:true,models:[...ALLOWED],webSearch:false},200,h);if(req.method==='POST'&&u.pathname==='/v1/jobs'){try{const job=await req.json();const out=await execute(job);return json({status:'completed',zeroCost:true,accountRequired:false,walletRequired:false,id:job.id||null,...out},200,h)}catch(e){return json({status:'failed',zeroCost:true,error:String(e?.message||e)},500,h)}}return json({error:'not-found',zeroCost:true},404,h)}};
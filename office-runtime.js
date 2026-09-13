(function(){
'use strict';
const QUEUE_KEY='the-office:runtime-queue:v1';
const CFG_KEY='the-office:runtime-config:v1';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
function write(key,v){localStorage.setItem(key,JSON.stringify(v))}
function config(){const saved=read(CFG_KEY,{});return{apiBase:saved.apiBase||'',mode:saved.apiBase?'gateway':'local-queue'}}
function setApiBase(url){write(CFG_KEY,{apiBase:String(url||'').replace(/\/$/,'')});renderStatus();return config()}
function infer(text,source){
  if(source?.startsWith('avatar:'))return{owner:source.split(':')[1],team:[source.split(':')[1]]};
  let plan=null;try{plan=window.TheOfficeUniversal?.routePlan?.(text)}catch{}
  const team=(plan?.route?.team||['Direttore']).map(x=>x==='Atlas'?'Direttore':x);
  return{owner:'Direttore',team:[...new Set(['Direttore',...team])]};
}
function enqueue(job){const q=read(QUEUE_KEY,[]);q.unshift(job);write(QUEUE_KEY,q.slice(0,100));renderStatus();return job}
async function submit(text,source='office'){
  const assignment=infer(text,source),cfg=config(),job={id:`job-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,text,source,owner:assignment.owner,team:assignment.team,status:'queued',createdAt:new Date().toISOString(),models:assignment.team.reduce((a,n)=>{const m=window.OfficeModelBoard?.get?.(n);if(m)a[n]={provider:m.provider,model:m.model,label:m.label};return a},{})};
  enqueue(job);
  if(!cfg.apiBase)return{...job,transport:'local-queue'};
  try{
    job.status='sending';enqueue(job);
    const r=await fetch(`${cfg.apiBase}/v1/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(job)});
    if(!r.ok)throw new Error(`Gateway ${r.status}`);
    const out=await r.json();job.status=out.status||'accepted';job.remote=out;enqueue(job);return job;
  }catch(err){job.status='gateway-error';job.error=String(err?.message||err);enqueue(job);return job}
}
function queue(){return read(QUEUE_KEY,[])}
function renderStatus(){
  const line=document.querySelector('.hq-statusline');if(!line)return;
  let el=document.getElementById('officeRuntimeStatus');if(!el){el=document.createElement('span');el.id='officeRuntimeStatus';line.appendChild(el)}
  const cfg=config(),pending=queue().filter(x=>['queued','sending','gateway-error'].includes(x.status)).length;
  el.textContent=cfg.apiBase?`gateway AI collegato · ${pending} in coda`:`gateway AI da collegare · ${pending} in coda locale`;
  el.title=cfg.apiBase?cfg.apiBase:'Le chiavi dei provider devono restare solo sul server.';
}
function patch(){
  const api=window.TheOfficeUniversal;if(!api?.createWork||api.__runtimePatched)return false;
  const original=api.createWork.bind(api);
  api.createWork=function(text,source){const result=original(text,source);submit(text,source);return result};
  api.__runtimePatched=true;return true;
}
function mount(){renderStatus();let n=0;const t=setInterval(()=>{n++;if(patch()||n>40)clearInterval(t)},125)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.TheOfficeRuntime={submit,queue,config,setApiBase,infer};
})();

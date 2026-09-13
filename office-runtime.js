(function(){
'use strict';
const QUEUE_KEY='the-office:runtime-queue:v1';
const CFG_KEY='the-office:runtime-config:v1';
const TOKEN_KEY='the-office:runtime-session-token';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
function write(key,v){localStorage.setItem(key,JSON.stringify(v))}
function token(){try{return sessionStorage.getItem(TOKEN_KEY)||''}catch{return''}}
function config(){const saved=read(CFG_KEY,{});return{apiBase:saved.apiBase||'',mode:saved.apiBase?'gateway':'local-queue',authenticated:Boolean(token())}}
function setApiBase(url){write(CFG_KEY,{apiBase:String(url||'').trim().replace(/\/$/,'')});render();return config()}
function setSessionToken(value){try{if(value)sessionStorage.setItem(TOKEN_KEY,String(value));else sessionStorage.removeItem(TOKEN_KEY)}catch{}render();return config()}
function ensureCss(){if(document.querySelector('link[href^="office-runtime.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='office-runtime.css?v=1.0';document.head.appendChild(l)}
function infer(text,source){
  if(source?.startsWith('avatar:')){const owner=source.split(':')[1];return{owner,team:[owner]}}
  let plan=null;try{plan=window.TheOfficeUniversal?.routePlan?.(text)}catch{}
  const team=(plan?.route?.team||['Direttore']).map(x=>x==='Atlas'?'Direttore':x);
  return{owner:'Direttore',team:[...new Set(['Direttore',...team])]};
}
function queue(){return read(QUEUE_KEY,[])}
function saveJob(job){const q=queue().filter(x=>x.id!==job.id);q.unshift({...job});write(QUEUE_KEY,q.slice(0,100));render();return job}
async function submit(text,source='office'){
  const clean=String(text||'').trim();if(!clean)return null;
  const assignment=infer(clean,source),cfg=config(),job={id:`job-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,text:clean,source,owner:assignment.owner,team:assignment.team,status:'queued',createdAt:new Date().toISOString(),models:assignment.team.reduce((a,n)=>{const m=window.OfficeModelBoard?.get?.(n);if(m)a[n]={provider:m.provider,model:m.model,label:m.label};return a},{})};
  saveJob(job);
  if(!cfg.apiBase){job.transport='local-queue';return saveJob(job)}
  if(!token()){job.status='auth-required';job.error='Collega la sessione AI prima di eseguire il lavoro.';return saveJob(job)}
  try{
    job.status='sending';saveJob(job);
    const r=await fetch(`${cfg.apiBase}/v1/jobs`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token()}`},body:JSON.stringify(job)});
    const out=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(out?.error||`Gateway ${r.status}`);
    job.status=out.status||'completed';job.remote=out;job.result=out.result||'';job.contributions=out.contributions||[];job.failures=out.failures||[];job.completedAt=new Date().toISOString();return saveJob(job);
  }catch(err){job.status='gateway-error';job.error=String(err?.message||err);return saveJob(job)}
}
function connect(){
  const current=config();
  const url=window.prompt('URL del gateway sicuro di The Office:',current.apiBase||'');
  if(url===null)return;
  setApiBase(url);
  const secret=window.prompt('Codice sessione (resta solo in questa scheda, non viene salvato su GitHub):','');
  if(secret!==null)setSessionToken(secret);
}
function disconnect(){setSessionToken('');render()}
function statusLabel(){const cfg=config(),pending=queue().filter(x=>['queued','sending','auth-required','gateway-error'].includes(x.status)).length;if(!cfg.apiBase)return`AI non collegata · ${pending} in coda`;if(!cfg.authenticated)return`gateway pronto · autenticazione richiesta · ${pending} in coda`;return`AI operative · ${pending} in coda`}
function renderStatus(){
  const line=document.querySelector('.hq-statusline');if(!line)return;
  let wrap=document.getElementById('officeRuntimeStatusWrap');if(!wrap){wrap=document.createElement('span');wrap.id='officeRuntimeStatusWrap';wrap.className='runtime-status-wrap';wrap.innerHTML='<span id="officeRuntimeStatus"></span><button type="button" id="officeRuntimeConnect">Collega AI</button>';line.appendChild(wrap);wrap.querySelector('button').onclick=connect}
  const cfg=config(),el=document.getElementById('officeRuntimeStatus'),btn=document.getElementById('officeRuntimeConnect');if(el)el.textContent=statusLabel();if(btn)btn.textContent=cfg.authenticated?'Ricollega':'Collega AI';if(wrap)wrap.title=cfg.apiBase?cfg.apiBase:'Le chiavi dei provider restano solo sul server.';
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function renderResults(){
  const view=document.getElementById('view-tasks');if(!view)return;
  let host=document.getElementById('officeRuntimeResults');if(!host){host=document.createElement('section');host.id='officeRuntimeResults';host.className='runtime-results';view.prepend(host)}
  const jobs=queue().slice(0,8);if(!jobs.length){host.innerHTML='';return}
  host.innerHTML=`<div class="section-heading compact"><div><span class="eyebrow">AI RUNTIME</span><h2>Risultati e coda</h2></div><button type="button" class="ghost-btn" id="runtimeConnectFromQueue">${config().authenticated?'Riconnetti':'Collega AI'}</button></div><div class="runtime-job-list">${jobs.map(j=>`<article class="runtime-job ${esc(j.status)}"><div class="runtime-job-top"><div><span class="eyebrow">${esc((j.team||[]).join(' · ')||j.owner||'OFFICE')}</span><h3>${esc(j.text)}</h3></div><span class="status-pill ${j.status==='completed'?'live':j.status==='gateway-error'?'review':'queued'}">${esc(j.status.toUpperCase())}</span></div>${j.result?`<div class="runtime-answer">${esc(j.result).replace(/\n/g,'<br>')}</div>`:''}${j.error?`<div class="runtime-error">${esc(j.error)}</div>`:''}<div class="runtime-models">${Object.entries(j.models||{}).map(([n,m])=>`<span>${esc(n)} · ${esc(m.label||m.model)}</span>`).join('')}</div></article>`).join('')}</div>`;
  host.querySelector('#runtimeConnectFromQueue')?.addEventListener('click',connect);
}
function render(){renderStatus();renderResults()}
function patch(){
  const api=window.TheOfficeUniversal;if(!api?.createWork||api.__runtimePatched)return false;
  const original=api.createWork.bind(api);
  api.createWork=function(text,source){const result=original(text,source);submit(text,source);return result};
  api.__runtimePatched=true;return true;
}
function mount(){ensureCss();render();let n=0;const t=setInterval(()=>{n++;if(patch()||n>40)clearInterval(t)},125)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.TheOfficeRuntime={submit,queue,config,setApiBase,setSessionToken,connect,disconnect,infer,render};
})();

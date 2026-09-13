(function(){
'use strict';
const board=()=>window.OfficeModelBoard;
function syncProfiles(){
  if(!board()||!window.TheOfficeHQ?.profiles)return false;
  Object.entries(board().profiles).forEach(([name,m])=>{
    const p=window.TheOfficeHQ.profiles[name]; if(!p)return;
    p.engine=`${m.provider} · ${m.label}`;
    p.model=m.model; p.provider=m.provider; p.backup=m.backup;
  });
  document.querySelectorAll('.hq-agent').forEach(el=>{
    const m=board().get(el.dataset.agent); const label=el.querySelector('.hq-engine');
    if(m&&label) label.textContent=m.label;
    if(m) el.title=`${m.provider} · ${m.label} · backup ${m.backup}`;
  });
  return true;
}
function enhanceDrawer(name){
  const m=board()?.get(name); const body=document.getElementById('hqDrawerBody'); if(!m||!body)return;
  const card=body.querySelector('.hq-ai-card'); if(!card)return;
  const strong=card.querySelector('strong'); if(strong)strong.textContent=`${m.provider} · ${m.label}`;
  let extra=card.querySelector('.model-board-extra');
  if(!extra){
    extra=document.createElement('div');extra.className='model-board-extra';
    card.appendChild(extra);
  }
  extra.innerHTML=`<div><span>MODEL ID</span><b>${m.model}</b></div><div><span>BACKUP / SECONDA VIA</span><b>${m.backup}</b></div><p>Il ruolo resta stabile; il Model Board può cambiare il modello se qualità, disponibilità o tipo di lavoro lo richiedono.</p>`;
}
function bind(){
  document.addEventListener('click',e=>{
    const avatar=e.target.closest?.('.hq-agent'); if(avatar)setTimeout(()=>enhanceDrawer(avatar.dataset.agent),0);
  },true);
}
function mount(){
  let tries=0; const timer=setInterval(()=>{tries++;if(syncProfiles()||tries>30)clearInterval(timer)},100);
  bind();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.TheOfficeModelUI={syncProfiles,enhanceDrawer};
})();

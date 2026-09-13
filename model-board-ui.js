(function(){
'use strict';
const board=()=>window.OfficeModelBoard;
function syncProfiles(){
  if(!board()||!window.TheOfficeHQ?.profiles)return false;
  Object.entries(board().profiles).forEach(([name,m])=>{
    const p=window.TheOfficeHQ.profiles[name]; if(!p)return;
    p.engine=`${m.provider} · ${m.label}`;
    p.model=m.model;p.provider=m.provider;p.backup=m.backup;p.tier=m.tier;p.reason=m.reason;
  });
  document.querySelectorAll('.hq-agent').forEach(el=>{
    const m=board().get(el.dataset.agent);const label=el.querySelector('.hq-engine');
    if(m&&label)label.textContent=`${m.label} · ${m.tier}`;
    if(m)el.title=`${m.provider} · ${m.label} · ${m.tier} · backup ${m.backup}`;
  });
  return true;
}
function enhanceDrawer(name){
  const m=board()?.get(name);const body=document.getElementById('hqDrawerBody');if(!m||!body)return;
  const card=body.querySelector('.hq-ai-card');if(!card)return;
  const strong=card.querySelector('strong');if(strong)strong.textContent=`${m.provider} · ${m.label}`;
  let extra=card.querySelector('.model-board-extra');
  if(!extra){extra=document.createElement('div');extra.className='model-board-extra';card.appendChild(extra)}
  extra.innerHTML=`<div><span>LIVELLO</span><b>${m.tier}</b></div><div><span>MODEL ID</span><b>${m.model}</b></div><div><span>BACKUP TOP PLAYER</span><b>${m.backup}</b></div><div><span>PERCHÉ QUI</span><b>${m.reason}</b></div><p>Policy: nessun avatar operativo usa modelli di fascia media. Il ruolo resta stabile; il Model Board aggiorna soltanto con modelli frontier approvati.</p>`;
}
function bind(){document.addEventListener('click',e=>{const avatar=e.target.closest?.('.hq-agent');if(avatar)setTimeout(()=>enhanceDrawer(avatar.dataset.agent),0)},true)}
function mount(){let tries=0;const timer=setInterval(()=>{tries++;if(syncProfiles()||tries>30)clearInterval(timer)},100);bind()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.TheOfficeModelUI={syncProfiles,enhanceDrawer};
})();

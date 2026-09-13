(function(){
'use strict';
const EXTRA={
  Qualita:{icon:'🧪',role:'Direttore Qualità',engine:'Frontier 7',mode:'quality gate',fun:'Non mette il timbro finché non sa spiegarti perché il lavoro è davvero pronto.',skills:['Completezza','Coerenza','Evidenze','Quality gate']},
  Executor:{icon:'🛠️',role:'Executor',engine:'Frontier 7',mode:'execution',fun:'Trasforma le decisioni approvate in passi concreti e verificabili.',skills:['Esecuzione','Tool use','Workflow','Verifica']}
};
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function add(){
  const hq=window.TheOfficeHQ,room=document.querySelector('.hq-room');
  if(!hq?.profiles||!room)return false;
  Object.entries(EXTRA).forEach(([name,p])=>{
    hq.profiles[name]=p;
    if(document.querySelector(`.hq-agent[data-agent="${name}"]`))return;
    const b=document.createElement('button');b.className='hq-agent';b.dataset.agent=name;b.type='button';
    b.innerHTML=`<span class="hq-avatar">${p.icon}</span><b>${esc(name)}</b><small>${esc(p.role)}</small><span class="hq-engine">${esc(p.engine)}</span>`;
    b.addEventListener('click',()=>hq.openAgent(name));room.appendChild(b);
  });
  window.TheOfficeModelUI?.syncProfiles?.();
  return true;
}
function mount(){let n=0;const t=setInterval(()=>{n++;if(add()||n>40)clearInterval(t)},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();

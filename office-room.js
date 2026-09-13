(function(){
'use strict';
const POLL=1200;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const stageMeta={sending:['🟡','Sta iniziando'],queued:['🟡','In coda'],working:['🔵','Sta lavorando'],completed:['🟢','Finito'],"gateway-error":['🔴','Errore'],"setup-required":['🟠','Da configurare']};
function jobs(){try{return window.TheOfficeRuntime?.queue?.()||[]}catch{return[]}}
function current(){return jobs()[0]||null}
function stateFor(name,job){if(!job)return{label:'Libero',cls:'idle'};const involved=(job.team||[]).includes(name)||job.owner===name;if(!involved)return{label:'Libero',cls:'idle'};const st=job.status||'working';return{label:stageMeta[st]?.[1]||'Sta lavorando',cls:st==='completed'?'done':st.includes('error')?'error':'busy'}}
function scene(){
 const old=document.getElementById('hqScene');if(!old||document.getElementById('officeRoomV4'))return;
 const room=document.createElement('section');room.id='officeRoomV4';room.className='office-room-v4';
 room.innerHTML=`<div class="or-top"><div><span class="eyebrow">THE OFFICE · LIVE FLOOR</span><h2>Il tuo ufficio AI</h2><p>Un’unica stanza. Dai un incarico, guarda chi lo prende, chi lo sta controllando e quando è finito.</p></div><div class="or-live"><i></i><span id="orLiveText">Ufficio in attesa</span></div></div><div class="or-floor"><div class="or-wall"><div class="or-board"><span>INCARICO ATTUALE</span><strong id="orTaskTitle">Nessun lavoro in corso</strong><small id="orTaskStep">Scrivi un incarico al Direttore</small><div class="or-progress"><i id="orProgress"></i></div></div></div><div class="or-desks" id="orDesks"></div><div class="or-roundtable"><span>ROUND TABLE</span><div id="orRoundtableSeats"></div></div><div class="or-command"><input id="orBrief" placeholder="Scrivi cosa vuoi ottenere..."/><button id="orSend" type="button">Dallo al Direttore</button></div><div class="or-timeline" id="orTimeline"></div></div>`;
 old.replaceWith(room);renderDesks();bind();render();setInterval(render,POLL)
}
function profiles(){return window.TheOfficeHQ?.profiles||window.OfficeFreeModelBoard?.profiles||{}}
function renderDesks(){
 const host=document.getElementById('orDesks');if(!host)return;
 const ps=profiles();host.innerHTML=Object.entries(ps).slice(0,9).map(([name,p],i)=>`<button class="or-desk" data-agent="${esc(name)}" style="--i:${i}" type="button"><span class="or-person">${p.icon||'🤖'}</span><b>${esc(name)}</b><small>${esc(p.role||'AI')}</small><em class="or-status">Libero</em><span class="or-model">${esc(p.label||p.engine||'')}</span></button>`).join('');
 host.querySelectorAll('.or-desk').forEach(x=>x.addEventListener('click',()=>window.TheOfficeHQ?.openAgent?.(x.dataset.agent)))
}
function send(){const input=document.getElementById('orBrief');const text=input?.value.trim();if(!text)return;input.value='';window.TheOfficeHQ?.dispatch?(()=>{const legacy=document.getElementById('hqBrief');if(legacy){legacy.value=text;window.TheOfficeHQ.dispatch()}else window.TheOfficeRuntime?.submit?.(text,'office-room')})():window.TheOfficeRuntime?.submit?.(text,'office-room');setTimeout(render,100)}
function bind(){document.getElementById('orSend')?.addEventListener('click',send);document.getElementById('orBrief')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send()}})}
function render(){
 const j=current(),title=document.getElementById('orTaskTitle'),step=document.getElementById('orTaskStep'),live=document.getElementById('orLiveText'),bar=document.getElementById('orProgress');
 if(!title)return;
 if(!j){title.textContent='Nessun lavoro in corso';step.textContent='Scrivi un incarico al Direttore';live.textContent='Ufficio in attesa';bar.style.width='0%'}else{
  title.textContent=j.text||'Incarico';const meta=stageMeta[j.status]||['🔵','Sta lavorando'];step.textContent=`${meta[0]} ${meta[1]} · ${((j.team||[]).join(' → ')||j.owner||'Direttore')}`;live.textContent=meta[1];bar.style.width=j.status==='completed'?'100%':j.status==='sending'?'28%':j.status==='gateway-error'?'100%':'62%'
 }
 document.querySelectorAll('.or-desk').forEach(el=>{const s=stateFor(el.dataset.agent,j);el.classList.remove('busy','done','error','idle');el.classList.add(s.cls);const badge=el.querySelector('.or-status');if(badge)badge.textContent=s.label});
 const seats=document.getElementById('orRoundtableSeats');if(seats){const team=j?.team||[];seats.innerHTML=team.length?team.map(n=>`<span>${esc(n)}</span>`).join(''):'<small>Vuota</small>'}
 const line=document.getElementById('orTimeline');if(line){const items=[];if(j){items.push(`📥 Ricevuto · ${new Date(j.createdAt||Date.now()).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`);if(j.team?.length)items.push(`👥 Team · ${j.team.join(', ')}`);if(j.status==='completed')items.push('✅ Consegnato');else if(j.status==='gateway-error')items.push(`⚠️ ${j.error||'Errore di esecuzione'}`);else items.push('⚙️ Lavorazione in corso')}line.innerHTML=items.map(x=>`<span>${esc(x)}</span>`).join('')}
}
function css(){if(document.getElementById('officeRoomV4Css'))return;const l=document.createElement('link');l.id='officeRoomV4Css';l.rel='stylesheet';l.href='office-room.css?v=1.0';document.head.appendChild(l)}
function mount(){css();let n=0;const t=setInterval(()=>{n++;if(document.getElementById('hqScene')&&window.TheOfficeRuntime){clearInterval(t);scene()}else if(n>50){clearInterval(t);scene()}},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.TheOfficeRoom={render,current};
})();
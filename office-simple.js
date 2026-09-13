(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const statusMap={sending:{label:'Sta partendo',cls:'working',step:2},queued:{label:'In coda',cls:'wait',step:1},working:{label:'Sta lavorando',cls:'working',step:3},completed:{label:'Finito',cls:'done',step:4},'gateway-error':{label:'Errore',cls:'error',step:4},'setup-required':{label:'Non operativo',cls:'error',step:1},failed:{label:'Errore',cls:'error',step:4}};
function runtime(){return window.TheOfficeRuntime||null}
function jobs(){try{return runtime()?.queue?.()||[]}catch{return[]}}
function latest(){return jobs()[0]||null}
function profiles(){return window.OfficeFreeModelBoard?.profiles||window.OfficeModelBoard?.profiles||window.TheOfficeHQ?.profiles||{}}
function mountCss(){if(document.getElementById('officeSimpleCss'))return;const l=document.createElement('link');l.id='officeSimpleCss';l.rel='stylesheet';l.href='office-simple.css?v=2.1';document.head.appendChild(l)}
function appHtml(){return `<div class="simple-office" id="simpleOfficeApp"><div class="so-shell"><header class="so-top"><div class="so-brand"><span class="so-logo">✦</span><div><strong>The Office</strong><small>un ufficio, non una dashboard</small></div></div><nav class="so-tabs" aria-label="Schermate"><button class="so-tab active" data-so-view="office">Ufficio</button><button class="so-tab" data-so-view="details">Dettagli</button></nav></header><section class="so-screen active" id="so-office"><div class="so-hero"><article class="so-ask"><span class="so-kicker">PARLA SOLO COL DIRETTORE</span><h1>Cosa dobbiamo fare?</h1><p>Scrivilo come lo diresti a una persona. Il Direttore decide chi coinvolgere.</p><div class="so-command"><input id="soBrief" autocomplete="off" placeholder="Es. confronta questi preventivi e dimmi quale conviene davvero"><button id="soSend" type="button">Affida il lavoro</button></div></article><article class="so-current"><div class="so-current-top"><div><span class="so-kicker">INCARICO ATTUALE</span><h2 id="soCurrentTitle">Nessun lavoro in corso</h2></div><span class="so-status wait" id="soStatus"><i></i><span>In attesa</span></span></div><p id="soCurrentCopy">Quando assegni qualcosa, qui vedi immediatamente se è partito davvero.</p><div class="so-steps" id="soSteps"><span class="so-step">1 · Ricevuto</span><span class="so-step">2 · Team</span><span class="so-step">3 · Lavoro</span><span class="so-step">4 · Consegnato</span></div></article></div><section class="so-room" aria-label="Ufficio AI"><div class="so-window"></div><div class="so-clock" id="soClock">LIVE</div><div class="so-board"><small>LAVAGNA DEL DIRETTORE</small><strong id="soBoardTitle">Ufficio libero</strong><span id="soBoardSub">Nessun incarico attivo</span></div><div class="so-table"></div><div id="soPeople"></div><div class="so-room-footer"><span class="hint" id="soRoomHint">Gli avatar coinvolti si muovono e cambiano stato</span><button class="so-main-btn" type="button" id="soOpenDetails">Vedi dettagli</button></div></section></section><section class="so-screen" id="so-details"><div class="so-tech-head"><div><span class="so-kicker">DIETRO LE QUINTE</span><h1>Dettagli tecnici</h1></div><span class="so-cost" id="soCost">0 € hard limit</span></div><div class="so-tech-grid"><article class="so-tech-card"><h3>Stato sistema</h3><div id="soSystem"></div></article><article class="so-tech-card"><h3>Chi è chi</h3><div id="soModels"></div></article><article class="so-tech-card" style="grid-column:1/-1"><h3>Ultimi lavori</h3><div class="so-log" id="soLog"></div></article></div></section></div></div>`}
function ensureApp(){if(document.getElementById('simpleOfficeApp'))return;document.body.classList.add('simple-office-mode');document.body.insertAdjacentHTML('afterbegin',appHtml());bind();renderPeople();render();setInterval(render,700)}
function bind(){
 $$('.so-tab').forEach(b=>b.addEventListener('click',()=>show(b.dataset.soView)));
 $('#soOpenDetails')?.addEventListener('click',()=>show('details'));
 $('#soSend')?.addEventListener('click',send);
 $('#soBrief')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send()}})
}
function show(name){$$('.so-screen').forEach(x=>x.classList.remove('active'));$$('.so-tab').forEach(x=>x.classList.toggle('active',x.dataset.soView===name));$(`#so-${name}`)?.classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
async function send(){const input=$('#soBrief');const text=input?.value.trim();if(!text)return;input.value='';$('#soCurrentTitle').textContent=text;$('#soCurrentCopy').textContent='Inviato al Direttore. Verifico il primo motore gratuito…';$('#soStatus').className='so-status working';$('#soStatus span').textContent='Sta partendo';runtime()?.submit?.(text,'simple-office').catch?.(console.error);render()}
function renderPeople(){const host=$('#soPeople');if(!host)return;const ps=profiles();const chosen=['Direttore','Lumen','Coda','Mosaic','Sage','Aegis','Verity','Ledger','Archivist'].filter(n=>ps[n]);host.innerHTML=chosen.map(n=>{const p=ps[n]||{};return `<button class="so-person" type="button" data-agent="${esc(n)}"><span class="body">${p.icon||({'Direttore':'👔','Lumen':'🔎','Coda':'💻','Mosaic':'👁️','Sage':'♟️','Aegis':'🛡️','Verity':'😈','Ledger':'🧮','Archivist':'🗃️'}[n]||'🤖')}</span><b>${esc(n)}</b><small>${esc(p.role||'AI')}</small><em>Libero</em></button>`}).join('')}
function agentState(name,j){if(!j)return{label:'Libero',cls:''};const involved=(j.team||[]).includes(name)||j.owner===name;if(!involved)return{label:'Libero',cls:''};const st=statusMap[j.status]||{label:'Sta lavorando',cls:'working'};return{label:st.label,cls:j.status==='completed'?'done':j.status==='gateway-error'||j.status==='failed'||j.status==='setup-required'?'error':'busy meeting'}}
function render(){
 const j=latest(),meta=statusMap[j?.status]||null;
 const title=$('#soCurrentTitle'),copy=$('#soCurrentCopy'),status=$('#soStatus'),board=$('#soBoardTitle'),sub=$('#soBoardSub'),clock=$('#soClock');if(!title)return;
 let age=0;if(j?.createdAt){const t=Date.parse(j.createdAt);if(Number.isFinite(t))age=Math.max(0,Math.floor((Date.now()-t)/1000))}
 if(clock)clock.textContent=j&&!['completed','gateway-error','failed'].includes(j.status)?`${age}s`:'LIVE';
 if(!j){title.textContent='Nessun lavoro in corso';copy.textContent='Quando assegni qualcosa, qui vedi immediatamente se è partito davvero.';status.className='so-status wait';status.querySelector('span').textContent='In attesa';board.textContent='Ufficio libero';sub.textContent='Nessun incarico attivo'}else{
  title.textContent=j.text||'Incarico';const m=meta||{label:'Sta lavorando',cls:'working',step:3};status.className=`so-status ${m.cls}`;status.querySelector('span').textContent=m.label;board.textContent=j.text||'Incarico';sub.textContent=j.team?.length?`Team: ${j.team.join(' · ')}`:`Responsabile: ${j.owner||'Direttore'}`;
  if(j.status==='completed')copy.textContent=`Lavoro completato${j.provider?` con ${j.provider}`:''}. Apri Dettagli per il risultato.`;
  else if(j.status==='gateway-error'||j.status==='failed'||j.status==='setup-required')copy.textContent=`Il lavoro si è fermato: ${j.error||'motore non disponibile'}`;
  else if(age>=8)copy.textContent=`Il primo motore gratuito è lento: sto usando il backup. Tempo trascorso ${age}s, limite massimo 27s.`;
  else copy.textContent=`${m.label}. ${j.team?.length?`Coinvolti: ${j.team.join(', ')}.`:'Il Direttore sta formando il team.'} Tempo ${age}s.`
 }
 const step=meta?.step||0;$$('.so-step').forEach((x,i)=>x.classList.toggle('on',i<step));
 $$('.so-person').forEach(el=>{const s=agentState(el.dataset.agent,j);el.className=`so-person ${s.cls}`.trim();el.querySelector('em').textContent=s.label});
 const hint=$('#soRoomHint');if(hint)hint.textContent=j?(j.status==='completed'?'Il lavoro è sul tavolo del Direttore':j.status==='gateway-error'||j.status==='failed'?'Il tentativo è terminato: nessun blocco infinito':age>=8?'Backup gratuito attivato automaticamente':'Gli avatar evidenziati stanno lavorando sul compito'):'Gli avatar coinvolti si muovono e cambiano stato';
 renderTech(j)
}
function renderTech(j){
 const cfg=runtime()?.config?.()||{};
 const sys=$('#soSystem');
 if(sys){const rows=[['Modalità',cfg.mode||'browser'],['Backend',cfg.apiBase||'non collegato'],['Costo consentito',cfg.zeroCost?'0 €':'non verificato'],['Ultimo stato',j?.status||'nessun lavoro'],['Provider reale',j?.provider||'—'],['Modello reale',j?.actualModel||'—'],['Team attivo',j?.team?.join(', ')||'—'],['Errore',j?.error||'—']];sys.innerHTML=rows.map(([a,b])=>`<div class="so-tech-row"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}
 const mods=$('#soModels');
 if(mods){const ps=profiles();mods.innerHTML=Object.entries(ps).slice(0,11).map(([n,p])=>`<div class="so-tech-row"><span>${esc(n)}</span><b>${esc(p.label||p.engine||p.model||'—')}</b></div>`).join('')}
 const log=$('#soLog');
 if(log){const q=jobs().slice(0,8);log.innerHTML=q.length?q.map(x=>`<div class="so-log-item"><strong>${esc(x.text||'Incarico')}</strong><p>${esc(x.status||'—')} · ${esc((x.team||[]).join(', ')||x.owner||'Direttore')}${x.provider?` · ${esc(x.provider)}`:''}${x.error?` · ${esc(x.error)}`:''}</p>${x.result?`<p><b>Risultato:</b> ${esc(String(x.result).slice(0,260))}${String(x.result).length>260?'…':''}</p>`:''}</div>`).join(''):'<div class="so-empty">Nessun lavoro registrato.</div>'}
}
function mount(){mountCss();let n=0;const t=setInterval(()=>{n++;if((window.TheOfficeRuntime&&Object.keys(profiles()).length)||n>40){clearInterval(t);ensureApp()}},100)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.TheOfficeSimple={show,render,send};
})();
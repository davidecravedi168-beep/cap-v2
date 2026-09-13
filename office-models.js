(function(){
'use strict';
const TOP7=[
  {rank:1,provider:'OpenAI',model:'gpt-6-astra',label:'GPT-6 Astra'},
  {rank:2,provider:'Anthropic',model:'claude-fable-5',label:'Claude Fable 5.1'},
  {rank:3,provider:'Anthropic',model:'claude-opus-5',label:'Claude Opus 5'},
  {rank:4,provider:'Meta',model:'muse-spark-1.3',label:'Muse Spark 1.3'},
  {rank:5,provider:'OpenAI',model:'gpt-5.6-sol',label:'GPT-5.6 Sol'},
  {rank:6,provider:'Z.ai',model:'glm-5.3',label:'GLM-5.3'},
  {rank:7,provider:'xAI',model:'grok-4.6',label:'Grok 4.6'}
];
const PROFILES={
  Direttore:{provider:'OpenAI',model:'gpt-6-astra',label:'GPT-6 Astra',backup:'Claude Fable 5.1',tier:'TOP 7',reason:'orchestrazione end-to-end, computer use, coding e lavoro professionale complesso'},
  Lumen:{provider:'OpenAI',model:'gpt-6-astra',label:'GPT-6 Astra + Web',backup:'Claude Fable 5.1',tier:'TOP 7',reason:'ricerca verificata con browsing e capacità frontier di sintesi'},
  Coda:{provider:'Anthropic',model:'claude-fable-5',label:'Claude Fable 5.1',backup:'GPT-6 Astra',tier:'TOP 7',reason:'coding e knowledge work di lunga durata'},
  Mosaic:{provider:'Meta',model:'muse-spark-1.3',label:'Muse Spark 1.3',backup:'GPT-6 Astra',tier:'TOP 7',reason:'multimodale nativo, video, immagini, documenti e agentic workflow'},
  Sage:{provider:'Anthropic',model:'claude-opus-5',label:'Claude Opus 5',backup:'GPT-6 Astra',tier:'TOP 7',reason:'ragionamento profondo, scenari e trade-off'},
  Aegis:{provider:'OpenAI',model:'gpt-5.6-sol',label:'GPT-5.6 Sol',backup:'Claude Opus 5',tier:'TOP 7',reason:'review robusta, sicurezza e controllo dei rischi'},
  Verity:{provider:'xAI',model:'grok-4.6',label:'Grok 4.6',backup:'GLM-5.3',tier:'TOP 7',reason:'seconda opinione indipendente e agentic reasoning da provider diverso'},
  Ledger:{provider:'Z.ai',model:'glm-5.3',label:'GLM-5.3',backup:'GPT-6 Astra',tier:'TOP 7',reason:'analisi strutturata, calcoli, coding e long-horizon reasoning'},
  Archivist:{provider:'Anthropic',model:'claude-fable-5',label:'Claude Fable 5.1 + retrieval',backup:'GPT-6 Astra',tier:'TOP 7',reason:'contesto lungo, memoria, documenti e continuità tra lavori'}
};
function get(name){return PROFILES[name]||null}
window.OfficeModelBoard={profiles:PROFILES,top7:TOP7,get,version:'2026-09-13.3',principle:'Ogni dipendente usa solo modelli frontier top-player; ruolo stabile, modello aggiornabile dal Model Board.',verifiedAt:'2026-09-13'};
})();

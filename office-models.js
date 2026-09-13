(function(){
'use strict';
const TOP7=[
  {slot:1,provider:'OpenAI',model:'openai/gpt-6-astra',label:'GPT-6 Astra'},
  {slot:2,provider:'Anthropic',model:'anthropic/claude-fable-5.1',label:'Claude Fable 5.1'},
  {slot:3,provider:'Anthropic',model:'anthropic/claude-opus-5',label:'Claude Opus 5'},
  {slot:4,provider:'Meta',model:'meta/muse-spark-1.3',label:'Muse Spark 1.3'},
  {slot:5,provider:'OpenAI',model:'openai/gpt-5.6-sol',label:'GPT-5.6 Sol'},
  {slot:6,provider:'Z.ai',model:'z-ai/glm-5.3',label:'GLM-5.3'},
  {slot:7,provider:'xAI',model:'x-ai/grok-4.6',label:'Grok 4.6'}
];
const PROFILES={
  Direttore:{provider:'OpenAI',model:'openai/gpt-6-astra',label:'GPT-6 Astra',backup:'Claude Fable 5.1',tier:'FRONTIER 7',reason:'orchestrazione end-to-end, computer/browser work, coding e lavoro professionale complesso'},
  Lumen:{provider:'OpenAI',model:'openai/gpt-6-astra',label:'GPT-6 Astra + Web',backup:'Claude Fable 5.1',tier:'FRONTIER 7',web:true,reason:'ricerca verificata con web search server-side e sintesi frontier'},
  Coda:{provider:'Anthropic',model:'anthropic/claude-fable-5.1',label:'Claude Fable 5.1',backup:'GPT-6 Astra',tier:'FRONTIER 7',reason:'coding e knowledge work di lunga durata'},
  Mosaic:{provider:'Meta',model:'meta/muse-spark-1.3',label:'Muse Spark 1.3',backup:'GPT-6 Astra',tier:'FRONTIER 7',reason:'multimodale nativo, video, immagini, documenti e agentic workflow'},
  Sage:{provider:'Anthropic',model:'anthropic/claude-opus-5',label:'Claude Opus 5',backup:'GPT-6 Astra',tier:'FRONTIER 7',reason:'ragionamento profondo, scenari e trade-off'},
  Aegis:{provider:'OpenAI',model:'openai/gpt-5.6-sol',label:'GPT-5.6 Sol',backup:'Claude Opus 5',tier:'FRONTIER 7',reason:'review robusta, sicurezza e controllo dei rischi'},
  Verity:{provider:'xAI',model:'x-ai/grok-4.6',label:'Grok 4.6',backup:'GLM-5.3',tier:'FRONTIER 7',reason:'seconda opinione indipendente e agentic reasoning da provider diverso'},
  Ledger:{provider:'Z.ai',model:'z-ai/glm-5.3',label:'GLM-5.3',backup:'GPT-6 Astra',tier:'FRONTIER 7',reason:'analisi strutturata, calcoli, coding e long-horizon reasoning'},
  Archivist:{provider:'Anthropic',model:'anthropic/claude-fable-5.1',label:'Claude Fable 5.1 + retrieval',backup:'GPT-6 Astra',tier:'FRONTIER 7',reason:'contesto lungo, memoria, documenti e continuità tra lavori'}
};
function get(name){return PROFILES[name]||null}
window.OfficeModelBoard={profiles:PROFILES,top7:TOP7,get,version:'2026-09-13.4',principle:'Ogni dipendente usa soltanto il pool Frontier 7 approvato; ruolo stabile, modello sostituibile dal Model Board.',verifiedAt:'2026-09-13',benchmarkBasis:'Artificial Analysis Intelligence Index v4.3 + role fit + provider diversity'};
})();

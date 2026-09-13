(function(){
'use strict';
const PROFILES={
  Direttore:{provider:'OpenAI',model:'gpt-5.6-sol',label:'GPT-5.6 Sol',backup:'Claude Opus 5'},
  Lumen:{provider:'Perplexity',model:'agent-api:high',label:'Agent API · high',backup:'Agent API · medium'},
  Coda:{provider:'Anthropic',model:'claude-opus-5',label:'Claude Opus 5',backup:'GPT-5.6 Sol'},
  Mosaic:{provider:'Google',model:'gemini-3.8-flash',label:'Gemini 3.8 Flash',backup:'GPT-5.6 Sol'},
  Sage:{provider:'Anthropic',model:'claude-opus-5',label:'Claude Opus 5',backup:'GPT-5.6 Sol'},
  Aegis:{provider:'OpenAI',model:'gpt-5.6-sol',label:'GPT-5.6 Sol',backup:'Claude Opus 5'},
  Verity:{provider:'xAI',model:'grok-4.6',label:'Grok 4.6',backup:'Claude Sonnet 5'},
  Ledger:{provider:'OpenAI',model:'gpt-5.6-sol',label:'GPT-5.6 Sol',backup:'Claude Opus 5'},
  Archivist:{provider:'OpenAI + retrieval',model:'gpt-5.6-terra',label:'GPT-5.6 Terra + memoria',backup:'GPT-5.6 Sol'}
};
function get(name){return PROFILES[name]||null}
window.OfficeModelBoard={profiles:PROFILES,get,version:'2026-09-13.2',principle:'Ruolo stabile, modello sostituibile.',verifiedAt:'2026-09-13'};
})();

(function(){
'use strict';
const PROFILES={
  Direttore:{provider:'OpenAI',model:'gpt-6-astra',label:'GPT-6 Astra',backup:'Claude Opus 5'},
  Lumen:{provider:'Perplexity',model:'sonar-deep-research',label:'Sonar Deep Research',backup:'Sonar Pro'},
  Coda:{provider:'Anthropic',model:'claude-opus-5',label:'Claude Opus 5',backup:'GPT-6 Astra'},
  Mosaic:{provider:'Google',model:'gemini-3.8-flash',label:'Gemini 3.8 Flash',backup:'GPT-6 Astra'},
  Sage:{provider:'Anthropic',model:'claude-opus-5',label:'Claude Opus 5',backup:'GPT-6 Astra'},
  Aegis:{provider:'OpenAI',model:'gpt-5.6-sol',label:'GPT-5.6 Sol',backup:'Claude Opus 5'},
  Verity:{provider:'xAI',model:'grok-4.6',label:'Grok 4.6',backup:'Claude Sonnet 5'},
  Ledger:{provider:'OpenAI',model:'gpt-6-astra',label:'GPT-6 Astra',backup:'Claude Opus 5'},
  Archivist:{provider:'OpenAI + retrieval',model:'gpt-5.6-terra',label:'GPT-5.6 Terra + memoria',backup:'GPT-6 Astra'}
};
function get(name){return PROFILES[name]||null}
window.OfficeModelBoard={profiles:PROFILES,get,version:'2026-09-13.1',principle:'Ruolo stabile, modello sostituibile.'};
})();

(function(){
'use strict';
const FREE7=[
['NVIDIA','nvidia/nemotron-3-ultra-550b','Nemotron 3 Ultra 550B'],
['NVIDIA','nvidia/nemotron-3.5-lightning','Nemotron 3.5 Lightning'],
['NVIDIA','nvidia/nemotron-3-nano-omni-30b-a3b-reasoning','Nemotron 3 Nano Omni'],
['Meta/NVIDIA','nvidia/llama-3.2-11b-vision','Llama 3.2 11B Vision'],
['Cohere','cohere/north-mini-code','North Mini Code'],
['Poolside','poolside/laguna-xs-2.1','Laguna XS 2.1'],
['OpenAI/NVIDIA','nvidia/gpt-oss-20b','GPT-OSS 20B']
];
const p=(provider,model,label,backup,reason)=>({provider,model,label,backup,tier:'FREE 7 · 0 € · NO KEY',reason});
const PROFILES={
Direttore:p(...FREE7[0],FREE7[1][2],'orchestrazione e ragionamento multi-step'),
Lumen:p(...FREE7[1],FREE7[0][2],'ricerca sui materiali disponibili; browsing live non simulato'),
Coda:p(...FREE7[5],FREE7[4][2],'coding e implementazione'),
Mosaic:p(...FREE7[2],FREE7[3][2],'multimodale e analisi visiva'),
Sage:p(...FREE7[1],FREE7[0][2],'strategia e scenari'),
Aegis:p(...FREE7[0],FREE7[4][2],'review indipendente e controllo rischi'),
Verity:p(...FREE7[6],FREE7[1][2],'seconda opinione e contestazione'),
Ledger:p(...FREE7[0],FREE7[1][2],'analisi numerica e scenari'),
Archivist:p(...FREE7[1],FREE7[0][2],'memoria e contesto lungo'),
Qualita:p(...FREE7[4],FREE7[1][2],'quality gate finale'),
Executor:p(...FREE7[5],FREE7[4][2],'workflow e implementazioni approvate')
};
function apply(){const b=window.OfficeModelBoard;if(!b)return false;Object.entries(PROFILES).forEach(([name,v])=>b.profiles[name]={...(b.profiles[name]||{}),...v});b.top7=FREE7.map(([provider,model,label],i)=>({slot:i+1,provider,model,label}));b.free7=b.top7;b.zeroCost=true;b.noKey=true;b.version='2026-09-13.8-free-no-key';b.principle='Zero-cost hard guard: solo i sette modelli gratuiti no-key approvati. Nessun wallet, nessun fallback a pagamento.';window.TheOfficeModelUI?.syncProfiles?.();return true}
let n=0;const t=setInterval(()=>{n++;if(apply()||n>50)clearInterval(t)},80);
window.OfficeFreeModelBoard={profiles:PROFILES,free7:FREE7,apply};
})();
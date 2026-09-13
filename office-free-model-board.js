(function(){
'use strict';
const FREE7=[
['NVIDIA','nvidia/nemotron-3-ultra-550b-a55b:free','Nemotron 3 Ultra'],
['Poolside','poolside/laguna-s-2.1:free','Laguna S 2.1'],
['NVIDIA','nvidia/nemotron-3-super-120b-a12b:free','Nemotron 3 Super'],
['inclusionAI','inclusionai/ling-3.0-flash-vl:free','Ling 3.0 Flash VL'],
['inclusionAI','inclusionai/ling-3.0-flash-fin:free','Ling 3.0 Flash Fin'],
['Google','google/gemma-4-26b-a4b-it:free','Gemma 4 26B A4B'],
['OpenAI','openai/gpt-oss-20b:free','gpt-oss-20b']
];
const p=(provider,model,label,backup,reason)=>({provider,model,label,backup,tier:'FREE 7 · 0 €',reason});
const PROFILES={
Direttore:p(...FREE7[0],FREE7[2][2],'orchestrazione e ragionamento multi-step'),
Lumen:p(...FREE7[0],FREE7[2][2],'ricerca sui materiali disponibili; browsing a pagamento disattivato'),
Coda:p(...FREE7[1],FREE7[0][2],'coding e implementazione'),
Mosaic:p(...FREE7[3],FREE7[5][2],'multimodale, immagini e video'),
Sage:p(...FREE7[2],FREE7[0][2],'strategia e scenari'),
Aegis:p(...FREE7[5],FREE7[2][2],'review indipendente e controllo rischi'),
Verity:p(...FREE7[6],FREE7[5][2],'seconda opinione e contestazione'),
Ledger:p(...FREE7[4],FREE7[2][2],'analisi numerica e finanza'),
Archivist:p(...FREE7[0],FREE7[2][2],'memoria e contesto lungo'),
Qualita:p(...FREE7[2],FREE7[5][2],'quality gate finale'),
Executor:p(...FREE7[1],FREE7[0][2],'workflow e implementazioni approvate')
};
function apply(){const b=window.OfficeModelBoard;if(!b)return false;Object.entries(PROFILES).forEach(([name,v])=>b.profiles[name]={...(b.profiles[name]||{}),...v});b.top7=FREE7.map(([provider,model,label],i)=>({slot:i+1,provider,model,label}));b.free7=b.top7;b.zeroCost=true;b.version='2026-09-13.7-free';b.principle='Zero-cost hard guard: solo endpoint gratuiti. Se il prezzo non è zero, la richiesta deve fallire.';window.TheOfficeModelUI?.syncProfiles?.();return true}
let n=0;const t=setInterval(()=>{n++;if(apply()||n>50)clearInterval(t)},80);
window.OfficeFreeModelBoard={profiles:PROFILES,free7:FREE7,apply};
})();
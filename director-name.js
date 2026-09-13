(function(){
'use strict';
const FROM='Atlas';
const TO='Direttore';
function replaceText(root=document.body){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{if(node.nodeValue&&node.nodeValue.includes(FROM))node.nodeValue=node.nodeValue.replaceAll(FROM,TO)});
}
function patchLeague(){
  const league=window.TheOfficeLeague;
  if(!league||league.__directorPatched||typeof league.recordOutcome!=='function')return false;
  const original=league.recordOutcome.bind(league);
  league.recordOutcome=function(input={}){
    const next={...input};
    if(next.agent===TO)next.agent=FROM;
    if(Array.isArray(next.agents))next.agents=next.agents.map(x=>x===TO?FROM:x);
    if(Array.isArray(next.contributions))next.contributions=next.contributions.map(c=>({...c,agent:c.agent===TO?FROM:c.agent}));
    return original(next);
  };
  league.__directorPatched=true;
  return true;
}
function mount(){
  replaceText();
  patchLeague();
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      mutation.addedNodes.forEach(node=>{
        if(node.nodeType===Node.TEXT_NODE){if(node.nodeValue?.includes(FROM))node.nodeValue=node.nodeValue.replaceAll(FROM,TO)}
        else if(node.nodeType===Node.ELEMENT_NODE)replaceText(node);
      });
    }
    patchLeague();
  });
  observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();

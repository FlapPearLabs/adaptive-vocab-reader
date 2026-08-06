const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT=path.resolve(__dirname,'../../../..');
const puppeteer = require(path.join(ROOT,'node_modules/puppeteer-core'));
const DIST=path.join(ROOT,'dist');
function findChromeForTesting(){
 const chromeRoot=path.join(ROOT,'.cache','puppeteer','chrome');
 if(!fs.existsSync(chromeRoot))throw new Error('Chrome for Testing not found; run npm run setup:e2e');
 for(const name of fs.readdirSync(chromeRoot).sort().reverse()){
  const executable=path.join(chromeRoot,name,'chrome-mac-arm64','Google Chrome for Testing.app','Contents','MacOS','Google Chrome for Testing');
  if(fs.existsSync(executable))return executable;
 }
 throw new Error('Chrome for Testing executable not found');
}
const CHROME=findChromeForTesting();
const core=JSON.parse(fs.readFileSync(path.join(DIST,'data/dict-core.json')));
const forms=JSON.parse(fs.readFileSync(path.join(DIST,'data/forms.json')));
const bands=JSON.parse(fs.readFileSync(path.join(DIST,'data/frequency-bands.json')));
const WORD_RE=/[a-zA-Z]+(?:[''-][a-zA-Z]+)*/g;
const normalize=(raw)=>{let w=raw.toLowerCase().replace(/^["'([{\u201c\u2018]+|["')\]}\u201d\u2019.,;:!?]+$/g,'').replace(/(?:'s|s')$/,'');return !w||/^\d+$/.test(w)?null:w};
const lookup=(s)=>{const f=s.toLowerCase(); if(core[f])return f; const m=forms[f]; return m&&core[m]?m:null};
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19)}return()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return(h^=h>>>16)>>>0}}
function mulberry32(a){return()=>{a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function rng(seed,salt){return mulberry32(xmur3(`${seed}::${salt}`)())}
function shuffle(a,r){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const seed='analysis-seed-011e069f';
const byBand=Array.from({length:10},()=>[]); Object.keys(core).forEach(w=>byBand[bands[w]??9].push(w));
const tested=new Set(byBand.flatMap((pool,b)=>shuffle(pool,rng(seed,`band:${b}`)).slice(0,5)));

async function launch(){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'avr-live-'));
 const cp=spawn(CHROME,[`--user-data-dir=${profile}`,`--load-extension=${DIST}`,`--disable-extensions-except=${DIST}`,'--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--headless=new'],{stdio:['ignore','ignore','pipe']});
 const ws=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('devtools timeout')),15000);cp.stderr.on('data',d=>{const m=String(d).match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1])}});cp.on('exit',c=>reject(new Error('chrome exit '+c)))});
 return {cp,browser:await puppeteer.connect({browserWSEndpoint:ws,protocolTimeout:240000}),profile};
}
function summarize(texts,actual){
 const tokens=[]; for(const text of texts){for(const raw of text.match(WORD_RE)||[]){const w=normalize(raw);if(w)tokens.push(w)}}
 const keys=tokens.map(lookup); const success=keys.filter(Boolean); const fail=keys.length-success.length;
 const tokenTypes=new Set(tokens), successSurfaceTypes=new Set(tokens.filter(t=>lookup(t))), successTypes=new Set(success);
 const afterUnknown=success.filter(k=>!tested.has(k)); const afterKnown=success.filter(k=>tested.has(k));
 return {tokens:tokens.length,tokenTypes:tokenTypes.size,lookupSuccess:success.length,lookupFail:fail,lookupSuccessPct:+(100*success.length/tokens.length).toFixed(2),lookupFailPct:+(100*fail/tokens.length).toFixed(2),lookupSurfaceTypes:successSurfaceTypes.size,lookupSurfaceTypePct:+(100*successSurfaceTypes.size/tokenTypes.size).toFixed(2),lookupWordKeyTypes:successTypes.size,clear:{known:0,learning:0,noExplicit:success.length,light:success.length,strong:0,none:fail,interactive:success.length,lightPctAll:+(100*success.length/tokens.length).toFixed(2),interactivePctAll:+(100*success.length/tokens.length).toFixed(2)},afterFixed50AllKnown:{known:afterKnown.length,learning:0,noExplicit:afterUnknown.length,light:afterUnknown.length,strong:0,none:fail+afterKnown.length,interactive:afterUnknown.length,lightPctLookup:+(100*afterUnknown.length/success.length).toFixed(2),testedOverlapTokenCount:afterKnown.length,testedOverlapTypeCount:new Set(afterKnown).size},actualDom:actual};
}
(async()=>{
 const {cp,browser}=await launch();
 const pages=[
  ['GitHub repository','https://github.com/FlapPearLabs/adaptive-vocab-reader'],
  ['MDN JavaScript Guide','https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction'],
  ['Wikipedia AI','https://en.wikipedia.org/wiki/Artificial_intelligence'],
 ];
 const out={chrome:await browser.version(),seed,testedWordKeys:tested.size,pages:[]};
 try{
  for(const [name,url] of pages){
   const p=await browser.newPage(); await p.setViewport({width:1280,height:800});
   const errors=[]; p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
   await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   await new Promise(r=>setTimeout(r,7000));
   const data=await p.evaluate(()=>{
    // Reconstruct the original scan surface after annotation: include .avr-word text,
    // but exclude extension auxiliary UI and the same page regions as production.
    const sel=['script','style','noscript','code','pre','input','textarea','select','button','nav','header','footer','aside','svg','math','canvas','iframe','template','.avr-action-menu','.avr-tooltip','.avr-selection-action','[data-avr-skip]','.comment','.comments','.comment-section','[role="comment"]'].join(',');
    const texts=[]; const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n;
    while(n=w.nextNode()){const e=n.parentElement;if(!e||e.closest(sel))continue;const s=e.style;if(s.display==='none'||s.visibility==='hidden')continue;if((n.textContent||'').trim())texts.push(n.textContent||'')}
    const all=[...document.querySelectorAll('.avr-word')];
    return {title:document.title,texts,perf:document.documentElement.dataset.avrPerf||null,spans:all.length,light:document.querySelectorAll('.avr-light').length,strong:document.querySelectorAll('.avr-strong,.avr-strong-first').length,noneWrapped:all.filter(x=>!x.classList.contains('avr-light')&&!x.classList.contains('avr-strong')&&!x.classList.contains('avr-strong-first')).length};
   });
   out.pages.push({name,url,title:data.title,stats:summarize(data.texts,{spans:data.spans,light:data.light,strong:data.strong,noneWrapped:data.noneWrapped,perf:data.perf?JSON.parse(data.perf):null}),consoleErrors:errors.slice(0,10)});
   await p.close();
  }
  console.log(JSON.stringify(out,null,2));
 } finally {browser.disconnect();cp.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});

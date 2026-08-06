const {execFileSync,spawn}=require('node:child_process');
const fs=require('node:fs'); const https=require('node:https'); const os=require('node:os'); const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../../..'), DIST=path.join(ROOT,'dist');
const puppeteer=require(path.join(ROOT,'node_modules/puppeteer-core'));
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
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'avr-geometry-')); const cert=path.join(tmp,'cert.pem'),key=path.join(tmp,'key.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
const samples=['evaluating','improving','building','collecting','requires','published','environments','reinforcement','inference','framework','storing','drafted','reaches','customer'];
const sampleHtml=samples.map(w=>`<span id="sample-${w}">${w}</span>`).join(' ');
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:16px/1.5 Arial} .sticky{position:sticky;top:0;height:64px;background:#ffd;z-index:999999;padding:4px} .stage{position:relative;height:1900px;padding:20px}
#normal{display:inline-block;margin-top:80px} #nearsticky{position:absolute;left:500px;top:0} #right{position:absolute;right:0;top:380px} #left{position:absolute;left:0;top:520px} #bottom{position:fixed;bottom:0;left:300px} #scroll{position:absolute;top:1500px;left:200px}
.line{width:620px;margin-top:20px}.neighbors{display:inline}
</style></head><body><div class="sticky">Sticky header</div><main class="stage"><span id="nearsticky">ability</span><p id="samples">${sampleHtml}</p><p class="line"><span class="neighbors">Text immediately before </span><span id="normal">ability</span><span class="neighbors"> and immediately after the target word on this line.</span></p><span id="right">challenge</span><span id="left">ability</span><span id="bottom">challenge</span><span id="scroll">ability</span></main></body></html>`;
const server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(_,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html)});
const listen=()=>new Promise(r=>server.listen(18924,'127.0.0.1',r));
const launch=async()=>{const profile=path.join(tmp,'profile');const cp=spawn(CHROME,[`--user-data-dir=${profile}`,`--load-extension=${DIST}`,`--disable-extensions-except=${DIST}`,'--no-first-run','--no-default-browser-check','--ignore-certificate-errors','--remote-debugging-port=0','--headless=new'],{stdio:['ignore','ignore','pipe']});const ws=await new Promise((r,j)=>{const t=setTimeout(()=>j(new Error('timeout')),15000);cp.stderr.on('data',d=>{const m=String(d).match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);r(m[1])}})});return{cp,browser:await puppeteer.connect({browserWSEndpoint:ws})}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function measure(page,id){const sel=`#${id} .avr-word, #${id}.avr-word`;await page.hover(sel);await page.waitForFunction(()=>document.querySelector('.avr-tooltip')?.style.display==='block');return page.evaluate((s)=>{const w=document.querySelector(s),t=document.querySelector('.avr-tooltip');const wr=w.getBoundingClientRect(),tr=t.getBoundingClientRect();const ix=Math.max(0,Math.min(wr.right,tr.right)-Math.max(wr.left,tr.left)),iy=Math.max(0,Math.min(wr.bottom,tr.bottom)-Math.max(wr.top,tr.top));const sticky=document.querySelector('.sticky').getBoundingClientRect();return{scrollY,word:{left:wr.left,top:wr.top,right:wr.right,bottom:wr.bottom,width:wr.width,height:wr.height},tooltip:{left:tr.left,top:tr.top,right:tr.right,bottom:tr.bottom,width:tr.width,height:tr.height},overlapTargetPx2:+(ix*iy).toFixed(2),viewport:{width:innerWidth,height:innerHeight},sticky:{top:sticky.top,bottom:sticky.bottom},overlapsSticky:tr.bottom>sticky.top&&tr.top<sticky.bottom};},sel)}
(async()=>{await listen();const{cp,browser}=await launch();const out={chrome:await browser.version(),tmp,page:{}};try{const p=await browser.newPage();await p.setViewport({width:1280,height:800});await p.goto('https://localhost:18924/',{waitUntil:'networkidle0'});await wait(2500);
 out.page.sampleFacts=await p.evaluate((words)=>words.map(surfaceForm=>{const host=document.getElementById('sample-'+surfaceForm);const span=host?.matches('.avr-word')?host:host?.querySelector('.avr-word');return{surfaceForm,wrapped:!!span,className:span?.className||null,wordKey:span?.getAttribute('data-word')||null,hoverable:!!span,clickMenuReachable:!!span}}),samples);
 out.page.initialState=await (async()=>{const sw=browser.targets().find(t=>t.type()==='service_worker'&&t.url().endsWith('/worker.js'));const w=sw&&await sw.worker();return w?await w.evaluate(async()=>{const x=await chrome.storage.local.get('avr_vocab_snapshot');return x.avr_vocab_snapshot?.words||{}}):null})();
 out.page.geometry={}; out.page.geometry.nearSticky=await measure(p,'nearsticky');out.page.geometry.normal=await measure(p,'normal');out.page.geometry.right=await measure(p,'right');out.page.geometry.left=await measure(p,'left');out.page.geometry.bottom=await measure(p,'bottom');
 await p.evaluate(()=>document.getElementById('scroll').scrollIntoView({block:'center'}));await wait(300);out.page.geometry.scrolled=await measure(p,'scroll');
 // Real Puppeteer mouse drag (not Selection API injection) on a wrapped surface form.
 await p.evaluate(()=>scrollTo(0,0));await wait(200);const dragHandle=await p.$('#sample-improving.avr-word, #sample-improving .avr-word');const dragBox=dragHandle?await dragHandle.boundingBox():null;
 if(dragBox){await p.mouse.move(Math.max(0,dragBox.x-3),dragBox.y+dragBox.height/2);await p.mouse.down();await p.mouse.move(dragBox.x+dragBox.width+3,dragBox.y+dragBox.height/2,{steps:24});await p.mouse.up();await wait(300);}
 out.page.realMouseSelection=await p.evaluate(()=>({selected:window.getSelection()?.toString()||'',action:document.querySelector('.avr-selection-action')?.getAttribute('data-word')||null,visible:!!document.querySelector('.avr-selection-action')}));
 await p.evaluate(()=>{window.getSelection()?.removeAllRanges();document.querySelector('.avr-selection-action')?.remove()});
 // Make a wrapped word known through the real click/menu path; wrapper should disappear.
 await p.click('#sample-building.avr-word, #sample-building .avr-word');await p.click('.avr-action-menu button[data-avr-status="known"]');await wait(500);
 out.page.knownAfterAction=await p.evaluate(()=>({wrapped:!!document.querySelector('#sample-building.avr-word, #sample-building .avr-word'),stateHint:'queried from worker below'}));
 out.page.finalState=await (async()=>{const sw=browser.targets().find(t=>t.type()==='service_worker'&&t.url().endsWith('/worker.js'));const w=sw&&await sw.worker();return w?await w.evaluate(async()=>{const x=await chrome.storage.local.get('avr_vocab_snapshot');return x.avr_vocab_snapshot?.words||{}}):null})();
 console.log(JSON.stringify(out,null,2));await p.close();}finally{browser.disconnect();cp.kill('SIGTERM');server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});

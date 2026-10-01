// Optional integration test: npm install --no-save playwright@1.51.1
// npx playwright install chromium; node tests/adventure-browser.cjs
// It serves the shipped HTML and drives real controls in isolated browser contexts.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');
const results=[],errors=[],layoutErrors=[];let browser,server,page,touchMode=false;
const click=selector=>touchMode?page.locator(selector).tap():page.locator(selector).click();
const state=()=>page.evaluate(()=>window.adventure.getState());
const shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
async function fixed(){const before=await state();await page.waitForTimeout(300);const after=await state();assert.equal(after.ship.food,before.ship.food);assert.equal(after.clock.gameDays,before.clock.gameDays);}
async function continueSave(){await page.reload();await page.locator('#loader.done').waitFor();await click('#continue-game');}
async function layout(label){
  const bounds=await page.evaluate(()=>{
    const selectors=['#voyage-guide','.helm','.journey','.game-actions','.touch-helm','.resources','.chart','#sea-clue','.top-actions','.brand','#next-goal','.readout','.view-tools'];
    const visible=selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),css=getComputedStyle(e);
      return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,visible:!e.hidden&&css.display!=='none'&&css.visibility!=='hidden'&&r.width>0&&r.height>0};}).filter(e=>e.visible);
    const guide=document.querySelector('#voyage-guide'),gr=guide.getBoundingClientRect();
    const guideControls=gr.width&&gr.height?[...guide.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,visible:r.width>0&&r.height>0};}).filter(e=>e.visible):[];
    return {width:innerWidth,height:innerHeight,items:visible,guide:{x:gr.x,y:gr.y,right:gr.right,bottom:gr.bottom},guideControls,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({id:e.id,width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}))};
  });
  const result={label,bounds,passed:false,violations:[]};results.push(result);
  const check=(ok,message)=>{if(!ok){result.violations.push(message);layoutErrors.push(message);}};
  for(const d of bounds.dialogs){check(d.width<=bounds.width,label+' dialog width');check(d.scrollWidth<=d.clientWidth+1,label+' horizontal overflow');}
  for(const b of bounds.guideControls){check(b.w>=44&&b.h>=44,label+' guide touch size: '+b.id);check(b.x>=bounds.guide.x-1&&b.y>=bounds.guide.y-1&&b.right<=bounds.guide.right+1&&b.bottom<=bounds.guide.bottom+1,label+' clipped guide control: '+b.id);}
  if(!bounds.dialogs.length){
    for(const a of bounds.items){check(a.x>=-1&&a.y>=-1&&a.right<=bounds.width+1&&a.bottom<=bounds.height+1,label+' outside viewport: '+a.selector);}
    for(let i=0;i<bounds.items.length;i++)for(let j=i+1;j<bounds.items.length;j++){
      const a=bounds.items[i],b=bounds.items[j],overX=Math.min(a.right,b.right)-Math.max(a.x,b.x),overY=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
      check(overX<=2||overY<=2,label+' overlap: '+a.selector+' / '+b.selector);
    }
  }
  result.passed=result.violations.length===0;
}
async function bookInView(){const box=await page.locator('#book-heading').boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=page.viewportSize().height,'Book action must show its record heading');}
function listen(p){p.on('pageerror',e=>errors.push(String(e)));}
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const html=await fs.readFile(path.join(root,'adventure/index.html'),'utf8');
 const C=vm.runInNewContext(html.match(/<script id="adventure-core">([\s\S]*?)<\/script>/)[1]+'\nAdventureCore;');
 server=http.createServer(async(req,res)=>{
  try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname+(req.url.endsWith('/')?'index.html':''));
   if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(await fs.readFile(file));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/adventure/';
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1360,height:900},acceptDownloads:true});page=await context.newPage();listen(page);
 page.on('dialog',d=>d.accept());await page.goto(url);await page.locator('#loader.done').waitFor();
 assert.equal(await page.locator('#error').isVisible(),false,'WebGL must initialize');
 await click('#new-game');await click('#guide-next');await click('#guide-next');await click('#delivery-job');await click('#buy-wood');
 await click('[data-tab="supply"]');await click('#guide-next');await click('[data-tab="departure"]');await click('#depart-game');
 await click('#pause');await click('#pause');await click('#guide-next');await click('[data-speed="4"]');
 const motionSamples=await page.evaluate(async()=>{
  const samples=[];for(let i=0;i<18;i++){await new Promise(requestAnimationFrame);const s=window.__adventureRendererDebug.snapshot();samples.push({...s,lag:Math.hypot(s.targetX-s.x,s.targetZ-s.z)});}return samples;
 });
 assert.ok(motionSamples.some(s=>s.lag>1e-4),'Renderer should interpolate between 20 Hz navigation ticks instead of snapping to each tick');
 const movingFrames=motionSamples.slice(1).filter((s,i)=>Math.hypot(s.x-motionSamples[i].x,s.z-motionSamples[i].z)>1e-5).length;
 assert.ok(movingFrames>=Math.min(6,motionSamples.length-1),'Visual ship position should advance smoothly across render frames');
 await page.locator('#sighting[open]').waitFor({timeout:45000});await fixed();await shot('pc-sighting');await layout('pc-sighting');
 assert.equal((await state()).exploration.pending.kind,'SIGHTED');
 await page.locator('#sight-mark').press('Enter');await click('#open-map');await fixed();await shot('pc-map');
 assert.equal((await state()).exploration.buoys.buoy_shoal_01.marked,true);
 await click('#map-buoy');await click('#sight-approach');
 await page.locator('#observation[open]').waitFor({timeout:45000});
 await fixed();await shot('pc-observation-intro');await layout('pc-observation-intro');
 const arrival=await state();assert.equal(arrival.observations.activeId,'buoy_shoal_01');assert.equal(arrival.observations.records.buoy_shoal_01,null);
 await continueSave();assert.deepEqual((await state()).position,arrival.position);await page.locator('#observation[open]').waitFor();await fixed();
 assert.equal((await state()).observations.activeId,'buoy_shoal_01');await click('#close-observation');
 assert.equal((await state()).observations.records.buoy_shoal_01,null);assert.equal((await state()).paused,true);
 await click('#open-map');await click('#map-discovery');await click('#observe-confirm');await fixed();
 const surveyed=await state();assert.equal(surveyed.player.gold,arrival.player.gold);assert.deepEqual(surveyed.ship,arrival.ship);
 assert.equal(surveyed.observations.activeId,null);assert.equal(surveyed.observations.records.buoy_shoal_01.reportedPortId,null);
 assert.match(await page.locator('#observe-next').innerText(),/松帆港.*海図係/);assert.match(await page.locator('#observe-clue').innerText(),/訪問できない/);
 await layout('pc-observation-record');await shot('pc-observation-record');await click('#observe-log');
 await bookInView();await fixed();await shot('pc-observation-book');await layout('pc-observation-book');
 await click('#book-reopen');assert.deepEqual((await state()).observations,surveyed.observations);await click('#observe-onward');
 await page.waitForFunction(()=>!document.querySelector('#dock-game').disabled,null,{timeout:60000});await click('#dock-game');
 await click('[data-tab="observations"]');await fixed();assert.equal(await page.locator('#submit-observation').isEnabled(),true);
 const beforeReport=await state();await click('#submit-observation');const accepted=await state();
 assert.equal(accepted.player.gold,beforeReport.player.gold);assert.deepEqual(accepted.ship,beforeReport.ship);assert.deepEqual(accepted.clock,beforeReport.clock);
 assert.equal(accepted.observations.records.buoy_shoal_01.reportedPortId,'p_pine');assert.equal(await page.locator('#submit-observation').isDisabled(),true);
 assert.match(await page.locator('#registration-status').innerText(),/準備がそろいました/);await layout('pc-report');await shot('pc-report');
 await continueSave();await click('[data-tab="observations"]');assert.deepEqual((await state()).observations,accepted.observations);
 assert.equal(await page.locator('#submit-observation').isDisabled(),true);await click('[data-tab="market"]');
 await click('#sell-wood');await click('#delivery-job');await click('[data-tab="shipyard"]');await click('#upgrade-ship');
 assert.equal((await state()).player.gold,65);
 await click('[data-tab="supply"]');const beforeRefill=await state(),refillCost=Number((await page.locator('#food-full').innerText()).match(/(\d+)G$/)[1]);
 await click('#food-full');await click('[data-tab="departure"]');await click('#guide-next');await click('#save-game');
 const downloadPromise=page.waitForEvent('download');await click('#captain-log [data-export]');const download=await downloadPromise;
 const savePath=path.join(out,'round-trip-save.json');await download.saveAs(savePath);
 const exported=JSON.parse(await fs.readFile(savePath,'utf8'));C.validate(exported);
 assert.equal(exported.ship.tier,2);assert.equal(exported.player.gold,beforeRefill.player.gold-refillCost);assert.equal(exported.ship.food,45);
 assert.equal(exported.observations.records.buoy_shoal_01.reportedPortId,'p_pine');assert.equal(exported.observations.activeId,null);
 assert.equal(exported.exploration.buoys.buoy_shoal_01.approached,true);assert.equal(exported.exploration.buoys.buoy_shoal_01.marked,true);
 await click('#guide-next');await click('#guide-next');assert.equal((await state()).tutorial.status,'COMPLETED');
 await continueSave();assert.equal((await state()).tutorial.status,'COMPLETED');await shot('pc-completed');
 await page.locator('#import-file').setInputFiles(savePath);await page.waitForFunction(()=>window.adventure.getState().tutorial.step==='backup');
 assert.equal((await state()).exploration.buoys.buoy_shoal_01.marked,true);assert.deepEqual((await state()).observations,exported.observations);
 const bad=JSON.parse(JSON.stringify(exported));bad.observations.version=999;const badPath=path.join(out,'invalid-save.json');await fs.writeFile(badPath,JSON.stringify(bad));
 const preserved=await state();await page.locator('#import-file').setInputFiles(badPath);await page.waitForTimeout(300);assert.deepEqual(await state(),preserved);
 await context.close();results.push({label:'pc-complete-flow',passed:true});

 // Generated fixtures exercise actual saved states, without a second game implementation.
 const portFixture=C.create(exported);portFixture.skipGuide();const savedPort=JSON.parse(portFixture.export());
 const g=C.create();g.delivery();g.trade('buy',12);g.depart('p_pine');g.guide('sailing');g.setSpeed(4);
 for(let i=0;i<1000&&!g.snapshot().exploration.buoys.buoy_shoal_01.seen;i++)g.step(.05);
 g.setPaused(true);const fixture=JSON.parse(g.export());
 for(const [label,width,height,touch] of [['pc',1360,900,false],['portrait',390,844,true],['small',375,667,true],['landscape',844,390,true],['boundary',701,393,true],['compact-landscape',667,375,true]]){
  touchMode=touch;
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  await ctx.addInitScript(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:C.SAVE_KEY,save:fixture});
  page=await ctx.newPage();listen(page);page.on('dialog',d=>d.accept());await page.goto(url);await page.locator('#loader.done').waitFor();await click('#continue-game');
  await fixed();await layout(label+'-choice');await shot(label+'-choice');
  for(const selector of ['#sight-direct','#sight-approach','#sight-mark']){
   await page.locator(selector).scrollIntoViewIfNeeded();const box=await page.locator(selector).boundingBox();assert.ok(box.height>=44&&box.width>=44,label+' touch target');
  }
  await click('#close-sight');
  if(!touch){await page.locator('#sea').press('ArrowRight');assert.equal((await state()).navigation.auto,false);await click('#auto');}
  await layout(label+'-guide');await shot(label+'-guide');
  await click('#open-map');await fixed();await layout(label+'-map');await shot(label+'-map');
  if(touch)await page.locator('#map-buoy').tap();else await click('#map-buoy');
  await click('#sight-mark');await click('#guide-skip');await layout(label+'-free');await shot(label+'-free');
  await click('#open-map');await click('#map-discovery');await click('#sight-approach');
  await page.locator('#observation[open]').waitFor({timeout:45000});await fixed();await layout(label+'-observation-intro');await shot(label+'-observation-intro');
  await click('#close-observation');await layout(label+'-arrival');await shot(label+'-buoy-at-sea');
  await click('#sea-clue');await click('#observe-confirm');await fixed();await layout(label+'-observation-record');await shot(label+'-observation-record');
  await click('#observe-log');await bookInView();await layout(label+'-observation-book');await shot(label+'-observation-book');
  assert.match(await page.locator('#book-next').innerText(),/松帆港/);assert.equal(await page.locator('#book-report').isDisabled(),true);
  await click('#book-reopen');assert.equal(await page.locator('#observe-confirm').isVisible(),false);await click('#close-observation');
  if(touch){await page.setViewportSize({width:height,height:width});await page.waitForTimeout(250);assert.equal((await state()).exploration.buoys.buoy_shoal_01.approached,true);await layout(label+'-rotation');}
  const portSave=JSON.parse(JSON.stringify(savedPort));portSave.observations.records.buoy_shoal_01.reportedDay=null;portSave.observations.records.buoy_shoal_01.reportedPortId=null;
  const importPath=path.join(out,label+'-report-fixture.json');await fs.writeFile(importPath,JSON.stringify(portSave));
  await page.locator('#import-file').setInputFiles(importPath);await page.waitForFunction(()=>window.adventure.getState().phase==='PORT');
  await click('[data-tab="observations"]');await fixed();await layout(label+'-report-before');
  await click('#submit-observation');assert.equal((await state()).observations.records.buoy_shoal_01.reportedPortId,'p_pine');
  await layout(label+'-report');await shot(label+'-report');await click('#report-book');
  await bookInView();await fixed();await layout(label+'-accepted-book');await shot(label+'-accepted-book');
  assert.match(await page.locator('#book-next').innerText(),/通常航海/);await click('#book-report');
  assert.equal(await page.locator('#submit-observation').isDisabled(),true);await ctx.close();
 }
 touchMode=false;const old=JSON.parse(JSON.stringify(exported));delete old.exploration;delete old.tutorial;delete old.observations;old.discovery.fogChunks={};
 const ctx=await browser.newContext({viewport:{width:1360,height:900}});await ctx.addInitScript(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:C.SAVE_KEY,save:old});
 page=await ctx.newPage();listen(page);await page.goto(url);await page.locator('#loader.done').waitFor();await click('#continue-game');
 const migrated=await state();assert.equal(migrated.player.gold,old.player.gold);assert.equal(migrated.ship.tier,2);assert.equal(migrated.tutorial.step,'welcome');assert.equal(migrated.exploration.buoys.buoy_shoal_01.seen,false);assert.equal(migrated.observations.records.buoy_shoal_01,null);
 assert.deepEqual(errors,[],'No page exceptions');assert.deepEqual(layoutErrors,[],'All viewport layouts must fit without overlapping controls');results.push({label:'legacy-import',passed:true});
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,version:C.VERSION,results,errors},null,2));
 console.log('Browser observation, book, reporting, trade loop, persistence, JSON, legacy import and six viewport profiles passed.');
})().catch(async error=>{
 console.error(error);if(page)try{await shot('failure');}catch{}
 await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'results.json'),JSON.stringify({passed:false,results,errors,error:String(error)},null,2));process.exitCode=1;
}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});


// Run: node --test tests/*.test.cjs. Exercise the actual embedded game rules.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../adventure/index.html'),'utf8');
const C=vm.runInNewContext(html.match(/<script id="adventure-core">([\s\S]*?)<\/script>/)[1]+'\nAdventureCore;');
const plain=v=>JSON.parse(JSON.stringify(v)),record=g=>g.snapshot().exploration.buoys.buoy_shoal_01;
const buoy=C.BUOYS[0];
function until(g,predicate,limit=5000){for(let i=0;i<limit;i++){if(predicate(g.snapshot()))return;g.step(.05);}assert.fail('Route did not reach its target');}
function find(){const g=C.create();g.delivery();g.trade('buy',12);g.depart('p_pine');until(g,s=>s.exploration.buoys[buoy.id].seen);return g;}
function reachPort(g,id){const p=C.PORTS.find(p=>p.id===id);until(g,s=>Math.hypot(s.position.xNm-p.x,s.position.zNm-p.z)<=2);assert.equal(g.dock().ok,true);}

test('sighting is spatial, once per buoy, and independent of a running timer',()=>{
  const still=C.create();still.depart('p_pine');still.setSails(0);
  for(let i=0;i<800;i++)still.step(.05);
  assert.equal(record(still).seen,false);assert.deepEqual(plain(still.snapshot().discovery.fogChunks),{});
  const g=find(),s=g.snapshot();assert.equal(buoy.id,'buoy_shoal_01');
  assert.ok(s.clock.gameDays*60<30);assert.ok(s.position.xNm>30&&s.position.xNm<32);
  assert.equal(s.exploration.pending.kind,'SIGHTED');assert.equal(record(g).approached,false);
  for(let i=0;i<200;i++)g.step(.05);
  assert.equal(g.snapshot().journal.filter(l=>l.text.includes('を見つけた')).length,1);
  assert.equal(C.woodOwned(g.snapshot()),12);assert.equal(g.snapshot().quests.firstDelivery.status,'ACTIVE');
});
test('chart cells open along travel, encode negative chunks, and remain after reload',()=>{
  const g=C.create();g.depart('p_pine');g.waypoint(-120,-120);
  for(let i=0;i<1000;i++)g.step(.05);
  const s=g.snapshot(),chunks=plain(s.discovery.fogChunks);
  assert.ok(Object.keys(chunks).some(k=>k.includes('azure:-')));
  assert.ok(Object.values(chunks).every(v=>/^[0-9a-f]{16}$/.test(v)));
  assert.equal(C.fogKnown(s.discovery,-70,-70),true);assert.equal(C.fogKnown(s.discovery,240,60),false);
  assert.deepEqual(plain(s.discovery.ports),['p_light','p_pine']);
  const restored=C.create(JSON.parse(g.export()));assert.deepEqual(plain(restored.snapshot().discovery.fogChunks),chunks);
  restored.setSails(0);for(let i=0;i<100;i++)restored.step(.05);
  assert.deepEqual(plain(restored.snapshot().discovery.fogChunks),chunks);
});
test('a bookmark keeps the course and economy, survives JSON, and never becomes a survey',()=>{
  const g=find(),before=g.snapshot();assert.equal(g.chooseSight('mark').ok,true);
  const after=g.snapshot();for(const k of ['player','ship','navigation','completedRewardIds','quests'])assert.deepEqual(plain(after[k]),plain(before[k]));
  assert.deepEqual(plain(record(g)),{seen:true,marked:true,approached:false});assert.equal(after.exploration.pending,null);
  const once=g.export();g.chooseSight('mark');assert.equal(g.export(),once);
  const restored=C.create(JSON.parse(once));assert.equal(record(restored).marked,true);
  assert.equal(restored.explorationQuote().ok,true);assert.equal(restored.snapshot().navigation.destinationPortId,'p_pine');
});
test('detour and restored course arrive without collision or affecting delivery cargo',()=>{
  let g=find();assert.equal(g.chooseSight('approach').ok,true);
  assert.deepEqual(plain(g.snapshot().navigation.waypoint),[buoy.x,buoy.z]);
  assert.equal(g.snapshot().exploration.resumeCourse.destinationPortId,'p_pine');
  for(let i=0;i<70;i++)g.step(.05);
  g=C.create(JSON.parse(g.export()));until(g,s=>s.exploration.pending?.kind==='ARRIVED');
  assert.equal(record(g).approached,true);assert.equal(g.snapshot().paused,true);assert.equal(g.snapshot().navigation.blockedSeconds,0);
  assert.equal(g.snapshot().ship.hp,100);assert.equal(g.snapshot().player.gold,40);assert.equal(C.woodOwned(g.snapshot()),12);
  const stopped=g.export();g.step(.05);assert.equal(g.export(),stopped);
  g=C.create(JSON.parse(stopped));g.chooseSight('direct');reachPort(g,'p_pine');
  assert.equal(g.snapshot().ship.hp,100);assert.equal(g.snapshot().exploration.resumeCourse,null);
  assert.equal(g.trade('sell',12).total,105);assert.equal(g.delivery().ok,true);assert.equal(g.snapshot().player.gold,185);
});
test('detour can be cancelled, or redirected on the chart, then restored to its original port',()=>{
  const g=find();g.chooseSight('approach');for(let i=0;i<80;i++)g.step(.05);
  g.waypoint(90,-20);assert.equal(g.snapshot().exploration.activeTarget,null);
  assert.equal(g.snapshot().exploration.resumeCourse.destinationPortId,'p_pine');
  g.chooseSight('direct');assert.equal(g.snapshot().navigation.destinationPortId,'p_pine');
  assert.deepEqual(plain(g.snapshot().navigation.waypoint),[240,0]);
  reachPort(g,'p_pine');assert.equal(record(g).approached,false);
});
test('passing the buoy permits delivery, and a later voyage uses its own return course',()=>{
  const g=find();g.chooseSight('direct');reachPort(g,'p_pine');g.trade('sell',12);g.delivery();
  assert.equal(record(g).approached,false);assert.equal(g.snapshot().player.gold,185);
  g.depart('p_light');g.chooseSight('approach');assert.equal(g.snapshot().exploration.resumeCourse.destinationPortId,'p_light');
  until(g,s=>s.exploration.pending?.kind==='ARRIVED');g.chooseSight('direct');reachPort(g,'p_light');
  assert.equal(record(g).approached,true);assert.equal(g.snapshot().ship.hp,100);
});
test('food previews include harbor slowdown and a conservative return reserve',()=>{
  const base=find().export(),direct=C.create(JSON.parse(base)),detour=C.create(JSON.parse(base));
  const q=detour.explorationQuote(),starting=detour.snapshot().ship.food;
  assert.ok(q.detourFood>q.directFood);assert.ok(q.detourReserve>q.detourFood+q.returnFood);
  direct.chooseSight('direct');reachPort(direct,'p_pine');
  assert.ok(Math.abs(starting-direct.snapshot().ship.food-q.directFood)<.02);
  detour.chooseSight('approach');until(detour,s=>s.exploration.pending?.kind==='ARRIVED');detour.chooseSight('direct');reachPort(detour,'p_pine');
  assert.ok(Math.abs(starting-detour.snapshot().ship.food-q.detourFood)<.09);
  detour.depart('p_light');reachPort(detour,'p_light');
  assert.ok(starting-detour.snapshot().ship.food<q.detourReserve);
  const low=plain(JSON.parse(base));low.ship.food=1;low.ship.hp=20;
  assert.ok(C.create(low).explorationQuote().detourReserve>q.detourReserve);
});
test('a manual approach reaches the same coordinate and keeps the original course',()=>{
  let g=find();g.chooseSight('approach');
  const s=g.snapshot();s.navigation.auto=false;s.navigation.heading=Math.atan2(buoy.x-s.position.xNm,buoy.z-s.position.zNm);
  g=C.create(s);until(g,s=>s.exploration.pending?.kind==='ARRIVED');
  assert.equal(record(g).approached,true);assert.equal(g.snapshot().navigation.blockedSeconds,0);
  assert.equal(g.snapshot().exploration.resumeCourse.destinationPortId,'p_pine');
});
test('rescue retains discoveries and marks while clearing the active detour',()=>{
  const g=find();g.chooseSight('mark');g.chooseSight('approach');g.recover();
  assert.equal(record(g).seen,true);assert.equal(record(g).marked,true);
  const e=g.snapshot().exploration;assert.equal(e.activeTarget,null);assert.equal(e.resumeCourse,null);assert.equal(e.pending,null);
  assert.doesNotThrow(()=>C.validate(JSON.parse(g.export())));
  assert.equal(record(C.create()).seen,false);
});
test('legacy v0.1.0/1 saves keep their voyage without fabricating discoveries',()=>{
  const old=find().snapshot();delete old.exploration;old.discovery.fogChunks={};
  const restored=C.create(old).snapshot(),e=restored.exploration;delete restored.exploration;
  assert.deepEqual(plain(restored),plain(old));assert.deepEqual(plain(e.buoys[buoy.id]),{seen:false,marked:false,approached:false});
  delete old.tutorial;const earlier=C.create(old).snapshot();assert.equal(earlier.tutorial.step,'welcome');assert.equal(earlier.player.gold,40);
});
test('invalid discoveries, chunk encodings and unknown feature versions fail atomically',()=>{
  const mutations=[s=>s.exploration.version=2,s=>s.exploration.buoys[buoy.id].marked=true,
    s=>s.exploration.buoys[buoy.id].approached=true,s=>s.exploration.buoys.unknown={},
    s=>s.exploration.pending={id:buoy.id,kind:'REPORTED'},s=>s.exploration.activeTarget=buoy.id,
    s=>s.exploration.resumeCourse={waypoint:[240,10],destinationPortId:'p_pine'},
    s=>s.discovery.fogChunks['azure:-01:0']='0000000000000001',s=>s.discovery.fogChunks['azure:17:0']='0000000000000001',
    s=>s.discovery.fogChunks['azure:0:0']='ff',s=>s.discovery.fogChunks['azure:0:0']='z'.repeat(16),
    s=>Object.defineProperty(s.discovery.fogChunks,'__proto__',{value:'0000000000000000',enumerable:true})];
  for(const mutate of mutations){const s=plain(C.create().snapshot());mutate(s);assert.throws(()=>C.validate(s));}
  const g=C.create(),before=g.export();assert.equal(g.chooseSight('approach').ok,false);assert.equal(g.chooseSight('bad').ok,false);assert.equal(g.export(),before);
});

// Exercise the shipped rules, including travel rather than fabricated survey flags.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../adventure/index.html'),'utf8');
const C=vm.runInNewContext(html.match(/<script id="adventure-core">([\s\S]*?)<\/script>/)[1]+'\nAdventureCore;');
const plain=v=>JSON.parse(JSON.stringify(v)),id=C.OBSERVATION.id,buoy=C.BUOYS[0];
function until(g,predicate){for(let i=0;i<5000;i++){if(predicate(g.snapshot()))return;g.step(.05);}assert.fail('Target not reached');}
function reachPort(g,portId){const p=C.PORTS.find(p=>p.id===portId);until(g,s=>Math.hypot(s.position.xNm-p.x,s.position.zNm-p.z)<=2);assert.equal(g.dock().ok,true);}
const setup=C.create();setup.delivery();setup.trade('buy',12);setup.depart('p_pine');
until(setup,s=>s.exploration.buoys[id].seen);const seen=setup.export();
setup.chooseSight('mark');setup.chooseSight('approach');until(setup,s=>s.exploration.pending?.kind==='ARRIVED');const near=setup.export();
setup.beginObservation();const active=setup.export();setup.completeObservation();const observed=setup.export();
setup.chooseSight('direct');reachPort(setup,'p_pine');const reportable=setup.export();setup.reportObservation();const reported=setup.export();
const from=save=>C.create(JSON.parse(save));
const economicFields=['player','ship','position','navigation','clock','markets','quests','completedRewardIds','stats','discovery'];
function unchangedEconomy(before,after){for(const k of economicFields)assert.deepEqual(plain(after[k]),plain(before[k]),k);}

test('seeing, marking and approaching are not observations or reports',()=>{
  for(const save of [C.create().export(),seen,near]){
    const g=from(save),before=g.export();assert.equal(g.observationQuote().observed,false);assert.equal(g.observationQuote().reported,false);
    assert.equal(g.completeObservation().ok,false);assert.equal(g.reportObservation().ok,false);assert.equal(g.export(),before);
  }
  const g=from(seen),before=g.export();assert.equal(g.beginObservation().ok,false);assert.equal(g.export(),before);
});
test('an open unconfirmed observation freezes time and reloads its exact decision state',()=>{
  const g=from(near);assert.equal(g.beginObservation().ok,true);const before=g.export();
  assert.equal(g.snapshot().observations.activeId,id);assert.equal(g.snapshot().exploration.pending,null);
  for(let i=0;i<200;i++){g.setPaused(false);g.step(.05);}assert.equal(g.export(),before);
  const restored=from(before);assert.equal(restored.beginObservation().already,true);restored.step(.05);assert.equal(restored.export(),before);
  assert.equal(restored.observationQuote().observed,false);
});
test('closing and reopening keeps the position and produces a record only on confirmation',()=>{
  const g=from(active),before=g.snapshot();g.cancelObservation();
  assert.equal(g.snapshot().observations.activeId,null);assert.equal(g.snapshot().paused,true);unchangedEconomy(before,g.snapshot());
  assert.equal(g.observationQuote().observed,false);assert.equal(from(g.export()).beginObservation().ok,true);
  g.beginObservation();assert.equal(g.completeObservation().ok,true);assert.equal(g.observationQuote().observed,true);
});
test('confirmation gives information once without cargo, money, time or fog rewards',()=>{
  const g=from(active),before=g.snapshot();g.completeObservation();const after=g.snapshot();unchangedEconomy(before,after);
  assert.deepEqual(plain(after.observations.records[id]),{observedDay:before.clock.gameDays,reportedDay:null,reportedPortId:null});
  assert.equal(after.journal.length,before.journal.length+1);assert.equal(after.observations.activeId,null);
  const once=g.export();assert.equal(g.completeObservation().already,true);assert.equal(g.beginObservation().already,true);assert.equal(g.export(),once);
  const restored=from(once);assert.equal(restored.completeObservation().already,true);assert.equal(restored.export(),once);
});
test('observed information remains readable at sea and survives leaving and revisiting',()=>{
  const g=from(observed);g.chooseSight('direct');for(let i=0;i<200;i++)g.step(.05);
  assert.equal(g.observationQuote().near,false);const before=g.export();assert.equal(g.beginObservation().already,true);assert.equal(g.export(),before);
  g.chooseSight('approach');until(g,s=>s.exploration.pending?.kind==='ARRIVED');const revisit=g.export();
  assert.equal(g.beginObservation().already,true);assert.equal(g.completeObservation().already,true);assert.equal(g.export(),revisit);
  assert.equal(g.snapshot().journal.filter(e=>e.text.includes('観測し、航海帳に記録した')).length,1);
});
test('reports are accepted only in pine port after an actual observation',()=>{
  const notObserved=from(near);notObserved.chooseSight('direct');reachPort(notObserved,'p_pine');const empty=notObserved.export();
  assert.equal(notObserved.reportObservation().ok,false);assert.equal(notObserved.export(),empty);
  const sea=from(observed),before=sea.export();assert.equal(sea.reportObservation().ok,false);assert.equal(sea.export(),before);
  sea.recover();assert.equal(sea.snapshot().portId,'p_light');const wrong=sea.export();assert.equal(sea.reportObservation().ok,false);assert.equal(sea.export(),wrong);
  assert.equal(sea.observationQuote().observed,true);assert.equal(sea.observationQuote().registrationReady,false);
});
test('acceptance records its port and day once, and readiness does not unlock a route',()=>{
  const g=from(reportable),before=g.snapshot();assert.equal(g.observationQuote().canReport,true);assert.equal(g.observationQuote().registrationReady,false);
  assert.equal(g.reportObservation().ok,true);const after=g.snapshot();unchangedEconomy(before,after);
  const r=after.observations.records[id];assert.equal(r.reportedPortId,'p_pine');assert.equal(r.reportedDay,after.clock.gameDays);
  assert.equal(g.observationQuote().registrationReady,true);assert.equal(g.observationQuote().canReport,false);
  assert.deepEqual(plain(after.discovery.ports),['p_light','p_pine']);assert.equal(after.registeredRoutes,undefined);
  const once=g.export();g.reportObservation();assert.equal(g.export(),once);const restored=from(once);restored.reportObservation();assert.equal(restored.export(),once);
  assert.equal(after.journal.length,before.journal.length+1);
});
test('the delivery, trading and ship upgrade loop still has its original totals',()=>{
  const g=from(reported);assert.equal(g.trade('sell',12).total,105);assert.equal(g.delivery().ok,true);assert.equal(g.snapshot().player.gold,185);
  assert.equal(g.upgrade().ok,true);assert.equal(g.snapshot().player.gold,65);assert.equal(g.snapshot().ship.tier,2);
  assert.equal(g.observationQuote().reported,true);
});
test('observation records outlive the rolling journal and rescue',()=>{
  const g=from(reported);g.depart('p_light');for(let i=0;i<60;i++)g.chooseSight('direct');
  assert.equal(g.snapshot().journal.some(e=>e.text.includes('観測し、航海帳に記録した')),false);
  const r=plain(g.observationQuote().record);g.recover();assert.deepEqual(plain(g.observationQuote().record),r);
  assert.equal(g.observationQuote().reported,true);assert.equal(from(g.export()).observationQuote().registrationReady,true);
  const unconfirmed=from(active);unconfirmed.recover();assert.equal(unconfirmed.snapshot().observations.activeId,null);assert.equal(unconfirmed.observationQuote().observed,false);
});
test('v0.1.2 imports preserve all old fields while starting an empty observation book',()=>{
  for(const save of [seen,near]){
    const old=JSON.parse(save);delete old.observations;const migrated=from(JSON.stringify(old)).snapshot(),book=migrated.observations;delete migrated.observations;
    assert.deepEqual(plain(migrated),old);assert.deepEqual(plain(book),{version:1,activeId:null,records:{[id]:null}});
  }
});
test('invalid record versions, ids, dates and report correlations fail atomically',()=>{
  const mutations=[s=>s.observations.version=2,s=>s.observations.activeId='unknown',s=>s.observations.records.unknown=null,
    s=>delete s.observations.records[id],s=>s.observations.records[id].observedDay=-1,
    s=>s.observations.records[id].observedDay=s.clock.gameDays+1,s=>s.observations.records[id].reportedPortId='p_light',
    s=>s.observations.records[id].reportedDay=s.clock.gameDays+1,s=>s.observations.records[id].reportedDay=-1,
    s=>s.observations.records[id].reportedDay=null,s=>s.observations.records[id].reportedPortId=null,
    s=>s.exploration.buoys[id].approached=false,s=>delete s.exploration,s=>s.observations.activeId=id];
  const live=from(reported),before=live.export();for(const mutate of mutations){const s=JSON.parse(reported);mutate(s);assert.throws(()=>C.validate(s));assert.equal(live.export(),before);}
  for(const mutate of [s=>s.paused=false,s=>s.phase='PORT',s=>s.position.xNm+=10,s=>s.exploration.pending={id,kind:'ARRIVED'}]){
    const s=JSON.parse(active);mutate(s);assert.throws(()=>C.validate(s));
  }
});
test('unknown targets and failed position changes cannot destroy an active observation',()=>{
  const g=from(active),before=g.export();for(const method of ['beginObservation','completeObservation','reportObservation'])assert.equal(g[method]('unknown').ok,false);
  assert.equal(g.waypoint(NaN,0).ok,false);assert.equal(g.export(),before);
  assert.equal(g.waypoint(120,-10).ok,true);assert.equal(g.snapshot().observations.activeId,null);assert.equal(g.observationQuote().observed,false);
});

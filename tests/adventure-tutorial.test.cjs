// Run: node tests/adventure-tutorial.test.cjs. Tests the code delivered in the HTML.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../adventure/index.html'),'utf8');
const C=vm.runInNewContext(html.match(/<script id="adventure-core">([\s\S]*?)<\/script>/)[1]+'\nAdventureCore;');
const plain=v=>JSON.parse(JSON.stringify(v));
const voyage=g=>{g.depart('p_pine');for(let i=0;i<2300;i++)g.step(.05);g.dock();};
const withoutGuide=s=>{const p=plain(s);delete p.tutorial;return p;};

test('old saves gain an introduction while every existing voyage field is preserved',()=>{
  const g=C.create();g.trade('buy',12);voyage(g);g.trade('sell',12);g.upgrade();
  const old=withoutGuide(g.snapshot()),restored=C.create(old).snapshot();
  assert.deepEqual(withoutGuide(restored),old);
  assert.deepEqual(plain(restored.tutorial),{version:1,status:'ACTIVE',step:'welcome'});
});
test('guide progress, skipping and completion survive JSON reload',()=>{
  const g=C.create();g.guide('buy');const before=withoutGuide(g.snapshot());
  const restored=C.create(JSON.parse(g.export()));assert.equal(restored.snapshot().tutorial.step,'buy');
  restored.skipGuide();restored.syncGuide();assert.equal(restored.snapshot().tutorial.status,'SKIPPED');
  assert.deepEqual(withoutGuide(restored.snapshot()),before);
  restored.guide('welcome');restored.finishGuide();const again=C.create(JSON.parse(restored.export()));
  assert.deepEqual(plain(again.snapshot().tutorial),{version:1,status:'COMPLETED',step:'complete'});
  assert.deepEqual(withoutGuide(again.snapshot()),before);
});
test('only real trades, delivery and upgrade results move the action lessons',()=>{
  const g=C.create();g.guide('delivery');g.syncGuide();assert.equal(g.snapshot().tutorial.step,'delivery');
  g.delivery();g.syncGuide();assert.equal(g.snapshot().tutorial.step,'buy');
  g.trade('buy',200);g.syncGuide();assert.equal(g.snapshot().tutorial.step,'buy');
  g.trade('buy',12);g.syncGuide();assert.equal(g.snapshot().tutorial.step,'supply');
  g.guide('depart');g.depart('p_pine');g.syncGuide();assert.equal(g.snapshot().tutorial.step,'pause');
  g.setPaused(true);g.syncGuide();assert.equal(g.snapshot().tutorial.step,'resume');
  g.setPaused(false);g.syncGuide();assert.equal(g.snapshot().tutorial.step,'controls');
  g.guide('sailing');for(let i=0;i<2300;i++)g.step(.05);g.syncGuide();assert.equal(g.snapshot().tutorial.step,'dock');
  g.dock();g.syncGuide();assert.equal(g.snapshot().tutorial.step,'sell');
  g.trade('sell',5);g.syncGuide();assert.equal(g.snapshot().tutorial.step,'sell');
  g.trade('sell',7);g.syncGuide();assert.equal(g.snapshot().tutorial.step,'claim');
  g.delivery();g.syncGuide();assert.equal(g.snapshot().tutorial.step,'upgrade');
  g.upgrade();g.syncGuide();assert.equal(g.snapshot().tutorial.step,'refill');
  g.supply('foodFull');g.syncGuide();assert.equal(g.snapshot().tutorial.step,'nextVoyage');
});
test('reading lessons never advance just because time passed or a value is full',()=>{
  const g=C.create();for(const step of ['welcome','resources','supply','nextVoyage','save','backup','safety','complete']){
    g.guide(step);g.syncGuide();assert.equal(g.snapshot().tutorial.step,step);
  }
});
test('an already upgraded save is guided past completed work without another charge',()=>{
  const g=C.create();g.trade('buy',12);voyage(g);g.trade('sell',12);g.upgrade();
  const before=withoutGuide(g.snapshot());g.guide('upgrade');g.syncGuide();
  assert.equal(g.snapshot().tutorial.step,'refill');assert.deepEqual(withoutGuide(g.snapshot()),before);
  g.guide('sell');g.syncGuide();assert.equal(g.snapshot().tutorial.step,'refill');
});
test('rescue returns the guide to a receivable job and a new trade without granting cargo',()=>{
  const g=C.create();g.delivery();g.trade('buy',12);g.depart('p_pine');g.guide('sailing');g.recover();g.syncGuide();
  assert.equal(g.snapshot().tutorial.step,'delivery');assert.equal(g.snapshot().quests.firstDelivery.status,'FAILED');
  g.delivery();g.syncGuide();assert.equal(g.snapshot().tutorial.step,'supply');
  const empty=C.create();empty.depart('p_pine');empty.guide('sailing');empty.recover();empty.syncGuide();
  empty.delivery();empty.syncGuide();assert.equal(empty.snapshot().tutorial.step,'buy');
});
test('unknown guide versions and malformed progress are rejected atomically',()=>{
  for(const tutorial of [null,[],{version:2,status:'ACTIVE',step:'welcome'},
    {version:1,status:'unknown',step:'welcome'},{version:1,status:'ACTIVE',step:'javascript'},
    {version:1,status:'COMPLETED',step:'buy'}]){
    const s=C.create().snapshot();s.tutorial=tutorial;assert.throws(()=>C.validate(s));
  }
  const g=C.create(),before=g.export();assert.equal(g.guide('bad').ok,false);assert.equal(g.export(),before);
});
test('an old sailing save starts with sea controls instead of inaccessible port actions',()=>{
  const g=C.create();g.delivery();g.trade('buy',12);g.depart('p_pine');
  const old=withoutGuide(g.snapshot()),restored=C.create(old);restored.guide('delivery');restored.syncGuide();
  assert.equal(restored.snapshot().tutorial.step,'pause');assert.deepEqual(withoutGuide(restored.snapshot()),old);
});

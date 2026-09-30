// Run: node --test tests/adventure-core.test.cjs (Node 18+). No packages required.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../adventure/index.html'),'utf8');
const code=html.match(/<script id="adventure-core">([\s\S]*?)<\/script>/)[1];
const C=vm.runInNewContext(code+'\nAdventureCore;');
const plain=v=>JSON.parse(JSON.stringify(v));
const edit=(fn)=>{const s=C.create().snapshot();fn(s);return C.create(s);};
const sail=(g,seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++)g.step(.05);};
const reach=(g,id)=>{assert.equal(g.depart(id).ok,true);sail(g,115);assert.ok(g.nearestPort().distance<=2.001);assert.equal(g.dock().ok,true);};

test('first trade loop settles the specified totals and allows tier 2',()=>{
  const g=C.create();assert.equal(g.delivery().ok,true);
  const q=g.quote('buy',12);assert.equal(q.total,60);assert.equal(g.trade('buy',12).ok,true);
  reach(g,'p_pine');assert.equal(g.quote('sell',12).total,105);assert.equal(g.trade('sell',12).ok,true);
  assert.equal(g.delivery().ok,true);assert.equal(g.snapshot().player.gold,185);
  assert.equal(g.upgrade().ok,true);assert.equal(g.snapshot().player.gold,65);
  assert.equal(g.snapshot().ship.tier,2);assert.equal(C.cargoUsed(g.snapshot()),0);
  assert.equal(g.snapshot().stats.tradeProfit,45);C.validate(g.snapshot());
});

test('invalid or impossible trade never changes gold, cargo, stock, or journal',()=>{
  const g=C.create();const before=g.export();
  for(const [side,qty]of[['buy',0],['buy',1.5],['buy',21],['buy',200],['sell',1],['buy',NaN],['bad',1]]){
    assert.equal(g.trade(side,qty).ok,false);assert.equal(g.export(),before);
  }
  const poor=edit(s=>s.player.gold=0),old=poor.export();assert.equal(poor.trade('buy',1).ok,false);assert.equal(poor.export(),old);
});

test('bulk prices match sequential settlements; partial sales conserve acquisition cost',()=>{
  const a=C.create(),b=C.create();a.trade('buy',12);for(let i=0;i<12;i++)b.trade('buy',1);
  assert.equal(a.snapshot().player.gold,b.snapshot().player.gold);
  assert.deepEqual(plain(a.snapshot().ship.cargo),plain(b.snapshot().ship.cargo));
  const cost=a.snapshot().ship.cargo[0].paidGold;
  a.trade('sell',5);const remainder=a.snapshot().ship.cargo[0].paidGold;
  a.trade('sell',7);assert.equal(C.woodOwned(a.snapshot()),0);
  assert.ok(remainder<cost);assert.ok(a.snapshot().stats.tradeProfit<=0);
});

test('same-port immediate buy/sell cannot mint gold across stock and demand bounds',()=>{
  for(const p of C.PORTS)for(let stock=1;stock<=200;stock++)for(let demand=80;demand<=125;demand++){
    const ask=C.price(p.wood,stock,demand).ask,bid=C.price(p.wood,stock-1,demand).bid;
    assert.ok(bid<=ask,`${p.id}: stock ${stock}, demand ${demand}`);
  }
});

test('contract cargo cannot be sold and reward remains claimed after reload',()=>{
  const g=C.create();g.delivery();assert.equal(g.trade('sell',4).ok,false);assert.equal(g.delivery().ok,false);
  reach(g,'p_pine');g.delivery();const resumed=C.create(JSON.parse(g.export())),before=resumed.export();
  assert.equal(resumed.delivery().ok,false);assert.equal(resumed.export(),before);
  assert.deepEqual(plain(resumed.snapshot().completedRewardIds),['first_delivery']);
});

test('upgrade preserves damage and food, charges once, and changes storage limits',()=>{
  const g=edit(s=>{s.player.gold=200;s.ship.hp=70;s.ship.food=10;});
  g.upgrade();const s=g.snapshot();assert.equal(s.ship.hp,85);assert.equal(s.ship.food,10);assert.equal(s.player.gold,80);
  const before=g.export();assert.equal(g.upgrade().ok,false);assert.equal(g.export(),before);
});

test('fractional food and repair charges round only money and advance explicit stay',()=>{
  const g=edit(s=>{s.ship.food=29.3;s.ship.hp=90.1;});
  assert.equal(g.supplyQuote('foodFull').total,1);g.supply('foodFull');assert.equal(g.snapshot().ship.food,30);
  assert.equal(g.supplyQuote('repair').total,12);g.supply('repair');assert.equal(g.snapshot().ship.hp,100);
  assert.equal(g.snapshot().clock.gameDays,.25);assert.equal(g.snapshot().player.gold,87);
  const before=g.export();assert.equal(g.supply('repair').ok,false);assert.equal(g.export(),before);
});

test('port menus and pause consume no time or food; sailing advances fixed game time',()=>{
  const g=C.create();sail(g,10);assert.equal(g.snapshot().clock.gameDays,0);
  g.depart('p_pine');g.setPaused(true);const before=g.export();sail(g,20);assert.equal(g.export(),before);
  g.setPaused(false);sail(g,60);const s=g.snapshot();assert.ok(Math.abs(s.clock.gameDays-1)<1e-9);
  assert.ok(Math.abs(s.ship.food-26)<1e-8);assert.ok(Math.abs(s.position.xNm-144)<1e-7);
  assert.equal(C.create(JSON.parse(g.export())).export(),g.export());
});

test('market recovers once per elapsed day; explicit wait pays six gold',()=>{
  const g=C.create();g.trade('buy',12);assert.equal(g.snapshot().markets.p_light.wood.stock,88);
  g.waitDay();assert.equal(g.snapshot().markets.p_light.wood.stock,100);assert.equal(g.snapshot().player.gold,34);
  g.waitDay();assert.equal(g.snapshot().markets.p_light.wood.stock,100);assert.equal(g.snapshot().player.gold,28);
});

test('manual passage reaches the second port and 1/2/4x consume equal game-time resources',()=>{
  const manual=C.create();manual.depart('p_pine');manual.setAuto(false);sail(manual,100);
  assert.ok(manual.nearestPort().distance<.001);assert.equal(manual.dock().ok,true);
  const states=[];for(const multiplier of[1,2,4]){const g=C.create();g.depart('p_pine');g.setSpeed(multiplier);
    for(let frame=0;frame<1200/multiplier;frame++)for(let substep=0;substep<multiplier;substep++)g.step(.05);
    const s=g.snapshot();states.push([s.clock.gameDays,s.ship.food,s.ship.hp,s.position.xNm]);}
  assert.deepEqual(plain(states[0]),plain(states[1]));assert.deepEqual(plain(states[0]),plain(states[2]));
});

test('rescue costs, failed delivery, and a zero-gold restart do not deadlock',()=>{
  const g=C.create();g.delivery();g.trade('buy',12);g.depart('p_pine');g.recover();const s=g.snapshot();
  assert.equal(s.player.gold,32);assert.equal(C.woodOwned(s),8);assert.equal(s.ship.food,12);assert.equal(s.ship.hp,35);
  assert.equal(s.quests.firstDelivery.status,'FAILED');assert.equal(g.delivery().ok,true);C.validate(g.snapshot());
  const poor=edit(s=>s.player.gold=0);assert.equal(poor.errand().ok,true);assert.equal(poor.snapshot().player.gold,20);
  assert.equal(poor.errand().ok,false);assert.equal(poor.supply('foodFull').ok,false);
});

test('starvation damages only after food is gone; disabled sails still consume food',()=>{
  const g=edit(s=>{s.ship.food=.001;});g.depart('p_pine');g.setSails(0);sail(g,1);
  assert.equal(g.snapshot().navigation.distance,0);assert.equal(g.snapshot().ship.food,0);
  assert.ok(Math.abs(g.snapshot().ship.hp-(100-4*(1/60-.001/4)))<1e-9);
  const wreck=edit(s=>{s.ship.hp=.001;s.ship.food=0;});wreck.depart('p_pine');wreck.step(.05);assert.equal(wreck.snapshot().phase,'PORT');
});

test('land collision and map bounds preserve valid saves',()=>{
  const g=C.create();g.depart('p_pine');assert.equal(g.waypoint(0,9).ok,false);
  g.setAuto(false);const state=g.snapshot();state.navigation.heading=0;const north=C.create(state);sail(north,3);
  assert.ok(north.snapshot().position.zNm<1);C.validate(north.snapshot());
  const edge=g.snapshot();edge.position.xNm=999.99;edge.position.zNm=-100;edge.navigation.heading=Math.PI/2;
  const bound=C.create(edge);sail(bound,10);assert.ok(bound.snapshot().position.xNm<=1000);C.validate(bound.snapshot());
});

test('malformed or incompatible imports are rejected',()=>{
  const mutations=[s=>s.schemaVersion=2,s=>s.worldVersion='future',s=>s.player.gold=-1,s=>s.ship.tier='1',
    s=>s.ship.food=31,s=>s.ship.hp=Infinity,s=>s.portId='fake',s=>s.position.xNm=9999,
    s=>s.markets.p_light.wood.stock=-1,s=>s.navigation.waypoint=[null,0],
    s=>s.quests.firstDelivery.status='COMPLETED',s=>s.discovery.ports=['p_light','p_light'],
    s=>s.ship.cargo=[{goodId:'fake',qty:1,originPortId:'p_light',paidGold:0,stolen:false,victimFactionId:null,contractId:null}],
    s=>s.journal=[{day:1,text:'future'}]];
  for(const fn of mutations){const s=C.create().snapshot();fn(s);assert.throws(()=>C.validate(s));}
});

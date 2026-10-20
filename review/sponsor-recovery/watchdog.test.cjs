const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const {Contract} = require(process.env.CAW_ETHERS_PACKAGE || 'ethers');
const runner = fs.readFileSync(__dirname+'/runServices.ts','utf8');
const current = fs.readFileSync(__dirname+'/current.ts','utf8');
const base = 1700000000000;
async function scenario(mode, duration) {
  let now=base, seq=0;
  const timers=new Map(), starts=[], stops=[], logs=[], checkpoints=[];
  const flush=async()=>{for(let i=0;i<40;i++) await Promise.resolve();};
  function later(fn,ms){const id=++seq;timers.set(id,{at:now+ms,fn});return id;}
  const c=vm.createContext({
    Date:class extends Date {static now(){return now;}},
    console:{log(){},warn(...a){logs.push(a.join(' '));},error(...a){logs.push(a.join(' '));}},
    setTimeout:later,clearTimeout:id=>timers.delete(id),
    delay:ms=>new Promise(resolve=>later(resolve,ms)),
    saveCheckpoint:async(_r,_k,b)=>checkpoints.push(b),
  });
  const source=runner.slice(runner.indexOf('const DEFAULT_HEARTBEAT_TIMEOUT_MS'))+
    '\nglobalThis.run=runInstance;\n'+
    current.slice(current.indexOf('const FAILURE_BACKOFF_CAP_MS'),current.indexOf('export const _forTests'))+
    '\nglobalThis.poll=makePollLoop;';
  vm.runInContext(stripTypeScriptTypes(source),c);
  const handle=c.run({instance:'synthetic',config:{},service:{
    start(_cfg,ctx){
      starts.push(now-base);let alive=true;
      ctx.declareLoop('L2',180000);
      const contract=new Contract('0x1111111111111111111111111111111111111111',['event Swept(uint256 value)']);
      contract.queryFilter=async()=>[{blockNumber:11,index:0}];
      const loop=c.poll({
        label:'L2',provider:{getBlockNumber:()=>mode==='hung'?new Promise(()=>{}):Promise.resolve(11)},
        contract,redis:{},cpKey:'test',startBlock:10,maxBlocks:10,pollMs:60000,
        backoffCapMs:120000,heartbeat:ctx.heartbeat,heartbeatDegraded:ctx.heartbeatDegraded,
        alive:()=>alive,processEvents:async()=>{
          if(mode==='persistent'||(mode==='recover'&&now-base<120000))throw new Error('synthetic write failure');
        },
      });
      loop.start();
      return {started:Promise.resolve(),stats:async()=>'synthetic',stop:async()=>{alive=false;loop.stop();stops.push(now-base);}};
    },
  }});
  await flush();
  for(let step=0;step<5000;step++){
    const next=[...timers].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
    if(!next||next[1].at>base+duration)break;
    timers.delete(next[0]);now=next[1].at;next[1].fn();await flush();
    assert.ok(step<4999,'scheduler must terminate');
  }
  await handle.stop();timers.clear();
  console.log(JSON.stringify({mode,starts,stops,checkpointWrites:checkpoints.length}));
  return {starts,logs,checkpoints};
}
test('persistent failure remains degraded before eventual watchdog restart',async()=>{
  const r=await scenario('persistent',35*60000);
  assert.equal(r.starts.length,2);
  assert.ok(r.starts[1]>30*60000&&r.starts[1]<35*60000);
  assert.equal(r.checkpoints.length,0);
  assert.ok(r.logs.some(s=>s.includes('alive but not progressing')));
  assert.ok(r.logs.some(s=>s.includes('heartbeat stale')));
});
test('recovered writes clear degradation and avoid a later restart',async()=>{
  const r=await scenario('recover',35*60000);
  assert.equal(r.starts.length,1);
  assert.deepEqual(r.checkpoints,[11]);
});
test('hung poll still triggers stale-heartbeat restart',async()=>{
  const r=await scenario('hung',240000);
  assert.equal(r.starts.length,2);
  assert.ok(r.starts[1]>180000&&r.starts[1]<240000);
  assert.equal(r.checkpoints.length,0);
});

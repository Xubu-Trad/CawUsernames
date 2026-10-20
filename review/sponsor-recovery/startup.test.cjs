const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const ethers=require(process.env.CAW_ETHERS_PACKAGE || 'ethers');
const original=fs.readFileSync(__dirname+'/current.ts','utf8');
async function start(chains, mutate=false) {
  let source=original.replace(/^import .*$/gm,'');
  // Config validation is outside this wiring check; supply already parsed settings.
  const begin=source.indexOf('const Config = z.object(');
  const end=source.indexOf('type Config = z.infer<typeof Config>')+'type Config = z.infer<typeof Config>'.length+1;
  source=source.slice(0,begin)+source.slice(end);
  source=source.replace(/\bexport /g,'');
  if(mutate)source=source.replace('const redis = new Redis(cfg.redisUrl)',
    "ctx.declareLoop('SponsorRepayIndexer:L1', timeoutMs);ctx.declareLoop('SponsorRepayIndexer:L2', timeoutMs);const redis = new Redis(cfg.redisUrl)");
  const declarations=[], heartbeats=[], providers=[], calls=[], timers=new Map();
  let id=0;
  const c=vm.createContext({
    Config:{parse:x=>x},ethers,
    CAW_NAMES_MINTER_ADDRESS:undefined,CAW_NAMES_L2_ADDRESS:undefined,
    getL1HttpRpcUrl:x=>x,getL2HttpRpcUrl:x=>x,
    makeJsonRpcProvider:(url,chain)=>{providers.push(chain);return {getBlockNumber:async()=>11};},
    Redis:class {async get(){return null;} async set(){calls.push('set');} async quit(){calls.push('quit');}},
    prisma:{$connect:async()=>calls.push('connect'),$disconnect:async()=>calls.push('disconnect'),sponsorRepay:{count:async()=>0}},
    console:{log(){},error(){},warn(){}},
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:i=>timers.delete(i),
  });
  vm.runInContext(stripTypeScriptTypes(source)+'\nglobalThis.service=sponsorRepayIndexerService;',c);
  const address='0x1111111111111111111111111111111111111111';
  const cfg={pollIntervalMs:60000,maxBlocksPerPoll:10,l1ChainId:1,l2ChainId:2,redisUrl:'synthetic',
    l1RpcUrl:chains.includes(1)?'synthetic-l1':undefined,minterAddress:address,
    l2RpcUrl:chains.includes(2)?'synthetic-l2':undefined,ledgerAddress:address};
  const service=c.service.start(cfg,{
    declareLoop:(...args)=>declarations.push(args),
    heartbeat:n=>heartbeats.push(n),heartbeatDegraded:()=>{throw new Error('unexpected failure');},
  });
  await service.started;
  for(let i=0;i<30;i++)await Promise.resolve();
  const scheduled=timers.size;
  assert.equal(await service.stats(),'SponsorRepay rows: 0');
  await service.stop();
  assert.equal(timers.size,0);
  assert.deepEqual(calls,['connect','quit','disconnect']);
  return {declarations,heartbeats,providers,scheduled};
}
for(const chains of [[],[1],[2],[1,2]]) {
  test('actual startup declares only configured chains '+JSON.stringify(chains),async()=>{
    const r=await start(chains);
    assert.deepEqual(r.providers,chains);
    assert.deepEqual(r.declarations,chains.map(n=>['SponsorRepayIndexer:L'+n,180000]));
    assert.deepEqual(r.heartbeats,chains.map(n=>'SponsorRepayIndexer:L'+n));
    assert.equal(r.scheduled,chains.length);
  });
}
test('control: unconditional declarations recreate ghost loops with neither chain configured',async()=>{
  const r=await start([],true);
  assert.equal(r.declarations.length,2);
  assert.equal(r.heartbeats.length,0);
  assert.equal(r.scheduled,0);
});

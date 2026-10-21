const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(__dirname+'/current.ts','utf8');
const original=source.slice(source.indexOf('const FAILURE_BACKOFF_CAP_MS'),source.indexOf('export const _forTests'));
const before='lastBlock = to\n        await saveCheckpoint(opts.redis, opts.cpKey, to)';
const after='await saveCheckpoint(opts.redis, opts.cpKey, to)\n        lastBlock = to';
async function trial(candidate){
 let stored=10,attempts=0,healthy=0,degraded=0;
 const scheduled=[];
 assert.equal(original.split(before).length,2);
 const context=vm.createContext({console:{log(){},error(){}},setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},clearTimeout(){},saveCheckpoint:async(_r,_k,n)=>{if(++attempts===1)throw Error('synthetic Redis rejection');stored=n;}});
 vm.runInContext(stripTypeScriptTypes(candidate?original.replace(before,after):original)+'\nglobalThis.factory=makePollLoop;',context);
 const loop=context.factory({label:'test',provider:{getBlockNumber:async()=>11},contract:{interface:{fragments:[]}},redis:{},cpKey:'test',startBlock:10,maxBlocks:10,pollMs:60000,backoffCapMs:120000,heartbeat:()=>healthy++,heartbeatDegraded:()=>degraded++,alive:()=>true,processEvents:async()=>{}});
 const settle=async n=>{for(let i=0;i<100;i++){if(scheduled.length>=n)return;await new Promise(r=>setImmediate(r));}throw Error('poll did not settle');};
 loop.start();await settle(1);assert.equal(stored,10);assert.equal(degraded,1);
 scheduled[0]();await settle(2);loop.stop();return {stored,attempts,healthy,degraded};
}
test('pinned loop can report healthy at fixed tip with failed durable checkpoint',async()=>{assert.deepEqual(await trial(false),{stored:10,attempts:1,healthy:1,degraded:1});});
test('candidate commits in-memory position only after durable checkpoint succeeds',async()=>{assert.deepEqual(await trial(true),{stored:11,attempts:2,healthy:1,degraded:1});});

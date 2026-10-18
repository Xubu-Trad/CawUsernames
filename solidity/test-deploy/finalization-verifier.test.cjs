'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../scripts/verify-deploy-wiring.js'),'utf8');
const start=source.indexOf('async function verifyPathwayExpanderFinalized(');
const end=source.indexOf('async function verifyMainnetLibraryPins()',start);
assert.ok(start>=0 && end>start);
const address='0x'+'11'.repeat(20), sender='0x'+'22'.repeat(20), other='0x'+'33'.repeat(20), zero='0x'+'00'.repeat(20);
// Deterministic ABI doubles: tests verify orchestration, not Keccak/ABI encoding.
const data='0x12345678', topic='0x'+'ab'.repeat(32);
function fixture(change=()=>{}) {
  const f={checks:[],ownerReads:[],state:{deployments:{P:{transactionHash:'deploy',blockNumber:3}},finalizations:{P:{transactionHash:'final',blockNumber:5}}},
    A:{P:address},deploy:{status:1,contractAddress:address,blockNumber:3},
    receipt:{status:1,to:address,blockNumber:5,logs:[{address,topics:[topic],formerOwner:sender}]},
    tx:{to:address,from:sender,data},owner:zero};
  change(f);
  const provider={
    getTransactionReceipt:async hash=>{if(f.rpcError)throw Error('RPC unavailable');return hash==='deploy'?f.deploy:f.receipt;},
    getTransaction:async()=>f.tx,
  };
  const ctx={state:f.state,A:f.A,providerFor:()=>provider,console:{log(){}},ZERO:value=>value===zero,
    ok:(name,pass)=>f.checks.push({name,pass:!!pass}),eq:(name,a,b)=>f.checks.push({name,pass:a===b}),
    ethers:{id:()=>topic,Interface:class{
      encodeFunctionData(name){assert.equal(name,'finalizeBootstrap');return data;}
      parseLog(log){if(f.badLog)throw Error('malformed event');return {args:{formerOwner:log.formerOwner}};}
    },Contract:function(){return {owner:async options=>{f.ownerReads.push(options.blockTag);return f.owner;}};}},
  };
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx,{timeout:1000});
  f.run=()=>ctx.verifyPathwayExpanderFinalized('L1','P');return f;
}
test('complete action-bound evidence passes and reads historical owner',async()=>{
  const f=fixture();await f.run();assert.ok(f.checks.length>=12);assert.ok(f.checks.every(x=>x.pass));assert.deepEqual(f.ownerReads,[5]);
});
const cases={
  'missing address':f=>delete f.A.P,
  'missing deployment metadata':f=>delete f.state.deployments.P,
  'missing finalization metadata':f=>delete f.state.finalizations.P,
  'missing deployment receipt':f=>f.deploy=null,
  'failed deployment receipt':f=>f.deploy.status=0,
  'wrong deployed address':f=>f.deploy.contractAddress=other,
  'wrong deployment block':f=>f.deploy.blockNumber=4,
  'missing final receipt':f=>f.receipt=null,
  'failed final receipt':f=>f.receipt.status=0,
  'wrong final block':f=>f.receipt.blockNumber=6,
  'finalization before creation':f=>{f.receipt.blockNumber=2;f.state.finalizations.P.blockNumber=2;},
  'wrong receipt target':f=>f.receipt.to=other,
  'missing transaction':f=>f.tx=null,
  'wrong transaction target':f=>f.tx.to=other,
  'wrong calldata':f=>f.tx.data='0x',
  'missing event':f=>f.receipt.logs=[],
  'duplicate event':f=>f.receipt.logs.push({...f.receipt.logs[0]}),
  'wrong event emitter':f=>f.receipt.logs[0].address=other,
  'wrong event topic':f=>f.receipt.logs[0].topics=['0xdead'],
  'wrong former owner':f=>f.receipt.logs[0].formerOwner=other,
  'owner remains live':f=>f.owner=sender,
  'RPC failure':f=>f.rpcError=true,
  'malformed event':f=>f.badLog=true,
  'unrelated transfer after sealing':f=>{f.tx.to=other;f.tx.data='0x';f.receipt.to=other;f.receipt.logs=[];},
};
for(const [name,change] of Object.entries(cases))test(`${name} cannot pass`,async()=>{
  const f=fixture(change);await f.run();assert.ok(f.checks.some(x=>!x.pass),name);
});

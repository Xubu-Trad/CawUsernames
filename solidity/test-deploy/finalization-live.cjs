'use strict';
// Standalone, local-only check. Supply verified ethers UMD and solc output paths.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const ethers=require(path.resolve(process.argv[2]));
const output=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const url='http://127.0.0.1:18672';
async function rpc(method,params) {
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const data=await res.json(); if(data.error)throw Error(JSON.stringify(data.error));return data.result;
}
(async()=>{
  assert.equal(await rpc('eth_chainId',[]),'0x7a69');
  const [owner,other]=await rpc('eth_accounts',[]);
  const contract=output.contracts['contracts/PathwayExpander.sol'].PathwayExpander;
  const data='0x'+contract.evm.bytecode.object+ethers.AbiCoder.defaultAbiCoder().encode(['address'],[owner]).slice(2);
  async function send(tx){const hash=await rpc('eth_sendTransaction',[{from:owner,gas:'0xe4e1c0',...tx}]);let receipt;for(let i=0;i<50;i++){receipt=await rpc('eth_getTransactionReceipt',[hash]);if(receipt)break;await new Promise(r=>setTimeout(r,100));}assert.ok(receipt,'receipt timeout');assert.equal(receipt.status,'0x1');return {transactionHash:hash,blockNumber:Number(receipt.blockNumber),receipt};}
  const deploy=await send({data});const address=deploy.receipt.contractAddress;
  const iface=new ethers.Interface(['function finalizeBootstrap()']);
  const finalized=await send({to:address,data:iface.encodeFunctionData('finalizeBootstrap')});
  const unrelated=await send({to:other,value:'0x1'});
  const provider=new ethers.BrowserProvider({request:({method,params})=>rpc(method,params)},31337,{cacheTimeout:-1});
  const source=fs.readFileSync(path.join(__dirname,'../scripts/verify-deploy-wiring.js'),'utf8');
  const start=source.indexOf('async function verifyPathwayExpanderFinalized('),end=source.indexOf('async function verifyMainnetLibraryPins()',start);assert.ok(start>=0&&end>start);
  const results=[];
  for(const [name,proof] of [['genuine finalization',finalized],['unrelated successful transfer',unrelated]]){
    const checks=[];const ctx={ethers,console:{log(){}},A:{P:address},state:{deployments:{P:deploy},finalizations:{P:proof}},providerFor:()=>provider,ZERO:a=>a.toLowerCase()===ethers.ZeroAddress,ok:(name,pass)=>checks.push({name,pass:!!pass}),eq:(name,a,b)=>checks.push({name,pass:String(a).toLowerCase()===String(b).toLowerCase()})};
    vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx,{timeout:1000});await ctx.verifyPathwayExpanderFinalized('L1','P');
    const failed=checks.filter(c=>!c.pass);assert.ok(checks.length>=10);
    if(proof===finalized)assert.equal(failed.length,0,JSON.stringify(failed));else {assert.ok(failed.some(c=>c.name.includes('target')));assert.ok(failed.some(c=>c.name.includes('calldata')));}
    results.push({name,checks:checks.length,rejected:failed.map(c=>c.name)});
  }
  provider.destroy();console.log(JSON.stringify({scope:'actual verifier function, real ethers ABI and local Anvil RPC; not full main or LayerZero integration',ethers_version:ethers.version,results}));
})().catch(e=>{console.error(e);process.exitCode=1;});

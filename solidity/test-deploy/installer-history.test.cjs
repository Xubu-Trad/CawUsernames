const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const address='0x'+'ab'.repeat(20),other='0x'+'cd'.repeat(20),hash='0x'+'12'.repeat(32),blockHash='0x'+'34'.repeat(32);
function fixture(){
 const record={chainId:84532,contractAddress:address,transactionHash:hash,blockNumber:0,blockHash,transactionIndex:0};
 const provider={send:async()=> '0x14a34',getTransactionReceipt:async()=>({hash,to:null,status:1,contractAddress:address,blockNumber:0,blockHash,index:0}),getTransaction:async()=>({hash,to:null,chainId:84532n,blockNumber:0,blockHash,index:0}),getBlock:async()=>({number:0,hash:blockHash})};
 return {environment:'testnet',chainKey:'L2',chainId:84532,addresses:{CawActions:address},manifest:{schemaVersion:1,environment:'testnet',contracts:{CawActions_L2:record}},provider};
}
const load=()=>import('../../cli/src/steps/history-floor.mjs');
test('receipt-bound selection preserves block zero',async()=>{const {resolveHistoryFloor}=await load();const r=await resolveHistoryFloor(fixture());assert.equal(r.startBlock,0);assert.equal(r.chainId,84532);});
for(const [label,change] of Object.entries({
 'wrong environment':f=>f.manifest.environment='mainnet',
 'wrong address':f=>f.addresses.CawActions=other,
 'wrong chain':f=>f.chainId=1,
 'missing receipt':f=>delete f.manifest.contracts.CawActions_L2,
 'missing sibling receipt':f=>f.addresses.CawActionsERC1271=other,
 'invalid block':f=>f.manifest.contracts.CawActions_L2.blockNumber=-1,
 'legacy floor only':f=>{f.manifest.contracts={};f.manifest.l2DeployBlock=45547765;},
 'RPC chain mismatch':f=>f.provider.send=async()=> '0x1',
}))test(label+' rejects',async()=>{const {resolveHistoryFloor}=await load();const f=fixture();change(f);await assert.rejects(resolveHistoryFloor(f));});
function generator(extra={}){
 const source=fs.readFileSync(path.join(__dirname,'../../cli/src/steps/generate.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'').replace(/await import\('ethers'\)/g,'await injectedImport()');
 let writes=0;const ctx={path,fs:{writeFileSync(){writes++;}},process:{env:{}},section(){},resolveHistoryFloor(){throw Error('not reached');}};
 Object.assign(ctx,extra);vm.createContext(ctx);vm.runInContext(source+'\nglobalThis.api={generateConfig,buildServiceList,prepareHistoryFloor,buildEnvVars};',ctx);
 return {api:ctx.api,writes:()=>writes};
}
test('real service generator requires history and preserves selected chain and zero',()=>{
 const f=generator();assert.throws(()=>f.api.buildServiceList('validator',{}),/Verified creation/);
 const services=f.api.buildServiceList('validator',{}, {chainId:421614,startBlock:0});
 const scanner=services.find(x=>x.service==='RawEventsGatherer');assert.equal(scanner.config.chainId,421614);assert.equal(scanner.config.startBlock,0);
});
test('missing RPC fails actual generateConfig before filesystem writes',async()=>{
 const f=generator();await assert.rejects(f.api.generateConfig('validator',{},'/synthetic'),/RPC are required/);assert.equal(f.writes(),0);
});

test('actual preparation resolves network identity and manifest before returning history',async()=>{
 const {resolveHistoryFloor}=await load();const f=fixture();let destroyed=0;
 const txt=`export const deployments = {
  testnet: {
    L1: { CawNetworkManager: '${other}'
    },
    L2: { CawActions: '${address}'
    },
  },
}
export const lzEids = {
  testnet: { L1: 40161, L2: 40245,
  },
}`;
 const storage={...f.provider,destroy(){destroyed++;}};
 const l1={send:async()=> '0xaa36a7',destroy(){destroyed++;}};
 const g=generator({resolveHistoryFloor,makeProvider:(_e,url)=>url==='l1'?l1:storage,
 injectedImport:async()=>({ethers:{Contract:function(){return {getStorageChainEid:async()=>40245};}}}),
 fs:{readFileSync:file=>file.endsWith('deployments.ts')?txt:JSON.stringify(f.manifest)}});
 const h=await g.api.prepareHistoryFloor({l1RpcUrl:'l1',l2RpcUrl:'storage'},'/synthetic');assert.equal(h.startBlock,0);assert.equal(destroyed,2);
 storage.send=async()=> '0x1';await assert.rejects(g.api.prepareHistoryFloor({l1RpcUrl:'l1',l2RpcUrl:'storage'},'/synthetic'),/History verification failed/);assert.equal(destroyed,4);
});

async function fullInstall(role,chainId,eid,{missingReceipt=false,secondReadFails=false}={}) {
 const {resolveHistoryFloor}=await load();const f=fixture();let destroyed=0,networkReads=0;
 f.manifest.contracts={['CawActions_'+role]:{...f.manifest.contracts.CawActions_L2,chainId}};
 if(missingReceipt)f.manifest.contracts={};
 const txt=`export const deployments = {
  testnet: {
    L1: { CawNetworkManager: '${other}'
    },
    ${role}: { CawActions: '${address}', CawProfileLedger: '${other}'
    },
  },
}
export const lzEids = {
  testnet: { L1: 40161, ${role}: ${eid},
  },
}`;
 const files=new Map(),writes=[];const key=p=>path.normalize(p);
 const fakeFs={existsSync:p=>files.has(key(p)),writeFileSync:(p,data)=>{writes.push(key(p));files.set(key(p),data);},chmodSync(){},appendFileSync:(p,data)=>files.set(key(p),(files.get(key(p))||'')+data),readFileSync:p=>{
 if(p.endsWith('deployments.ts'))return txt;
 if(p.includes('creation-receipts.'))return JSON.stringify(f.manifest);
 if(!files.has(key(p)))throw Error('missing synthetic file');return files.get(key(p));
 }};
 const storage={...f.provider,send:async()=> '0x'+chainId.toString(16),getTransaction:async()=>({...await f.provider.getTransaction(),chainId:BigInt(chainId)}),destroy(){destroyed++;}};
 const l1={send:async()=> '0xaa36a7',destroy(){destroyed++;}};
 const g=generator({resolveHistoryFloor,fs:fakeFs,crypto:require('node:crypto'),console:{log(){}},success:x=>x,dim:x=>x,warn:x=>x,brand:x=>x,
 makeProvider:(_e,url)=>url==='l1'?l1:storage,injectedImport:async()=>({ethers:{Contract:function(){return {getStorageChainEid:async()=>{networkReads++;if(secondReadFails&&networkReads===2)throw Error('private RPC detail');return eid;}};}}})});
 const config={network:'testnet',networkId:1,l1RpcUrl:'l1',l2RpcUrl:'storage'};
 if(missingReceipt){await assert.rejects(g.api.generateConfig('validator',config,'/synthetic'),/History verification failed/);assert.equal(writes.length,0);return;}
 if(secondReadFails){await assert.rejects(g.api.generateConfig('validator',config,'/synthetic'),/installation incomplete/);assert.equal(destroyed,3);assert.ok(!files.has(key('/synthetic/client/src/abi/addresses.ts')));return;}
 await g.api.generateConfig('validator',config,'/synthetic');
 const services=JSON.parse(files.get(key('/synthetic/client/config.json')));
 const scanner=services.find(s=>s.service==='RawEventsGatherer');assert.equal(scanner.config.chainId,chainId);assert.equal(scanner.config.startBlock,0);
 assert.match(files.get(key('/synthetic/client/.env')),new RegExp('L2_CHAIN_ID='+chainId+'(?:\\r?\\n|$)'));
 assert.ok(files.get(key('/synthetic/client/src/abi/addresses.ts')).includes(address));
 assert.ok(files.has(key('/synthetic/ecosystem.config.cjs')));assert.equal(destroyed,3);
}
test('full generator keeps default chain, environment and address output consistent',()=>fullInstall('L2',84532,40245));
test('full generator keeps alternate chain, environment and address output consistent',()=>fullInstall('L2b',421614,40231));
test('full generator missing receipt produces no output files',()=>fullInstall('L2',84532,40245,{missingReceipt:true}));

test('full generator cannot report success when network recheck fails',()=>fullInstall('L2',84532,40245,{secondReadFails:true}));

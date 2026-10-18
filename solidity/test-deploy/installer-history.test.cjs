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
 Object.assign(ctx,extra);ctx.publishConfigOutputs=outputs=>{for(const o of outputs){ctx.fs.writeFileSync(o.file,o.content,o.mode?{mode:o.mode}:undefined);if(o.mode)ctx.fs.chmodSync(o.file,o.mode);if(o.verify)o.verify(o.file);}};vm.createContext(ctx);vm.runInContext(source+'\nglobalThis.api={generateConfig,buildServiceList,prepareHistoryFloor,buildEnvVars,writeAddressesForNetwork,applyAddressPlan};',ctx);
 return {api:ctx.api,writes:()=>writes};
}
test('service topology allows absent history but validates supplied history',()=>{
 const f=generator();assert.ok(!Object.hasOwn(f.api.buildServiceList('validator',{}).find(x=>x.service==='RawEventsGatherer').config,'startBlock'));assert.throws(()=>f.api.buildServiceList('validator',{}, {chainId:1,startBlock:-1}),/Verified creation/);
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
    L1: { CawNetworkManager: '${other}', CawProfile: '${other}'
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

async function fullInstall(role,chainId,eid,{missingReceipt=false,secondReadFails=false,missingManager=false,unknownChain=false,sponsorFailure=false}={}) {
 const {resolveHistoryFloor}=await load();const f=fixture();let destroyed=0,networkReads=0,deploymentReads=0;
 f.manifest.contracts={['CawActions_'+role]:{...f.manifest.contracts.CawActions_L2,chainId}};
 if(missingReceipt)f.manifest.contracts={};
 const txt=`export const deployments = {
  testnet: {
    L1: { CawNetworkManager: '${other}', CawProfile: '${other}'
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
 const fakeFs={existsSync:p=>files.has(key(p)),writeFileSync:(p,data)=>{writes.push(key(p));files.set(key(p),data);},chmodSync(){},appendFileSync:(p,data)=>{if(sponsorFailure)throw Error('private synthetic path');files.set(key(p),(files.get(key(p))||'')+data);},readFileSync:p=>{
 if(p.endsWith('deployments.ts')){deploymentReads++;return missingManager&&deploymentReads>1?txt.replace('CawNetworkManager:', 'MissingManager:'):txt;}
 if(p.includes('creation-receipts.'))return JSON.stringify(f.manifest);
 if(!files.has(key(p)))throw Error('missing synthetic file');return files.get(key(p));
 }};
 const storage={...f.provider,send:async()=> '0x'+chainId.toString(16),getTransaction:async()=>({...await f.provider.getTransaction(),chainId:BigInt(chainId)}),destroy(){destroyed++;}};
 const l1={send:async()=> '0xaa36a7',destroy(){destroyed++;}};
 const g=generator({resolveHistoryFloor,fs:fakeFs,crypto:require('node:crypto'),console:{log(){}},success:x=>x,dim:x=>x,warn:x=>x,brand:x=>x,
 makeProvider:(_e,url)=>url==='l1'?l1:storage,injectedImport:async()=>({ethers:{Contract:function(){return {getStorageChainEid:async()=>{networkReads++;if(secondReadFails&&networkReads===2)throw Error('private RPC detail');return unknownChain&&networkReads===2?99999:eid;}};}}})});
 const config={network:'testnet',networkId:1,l1RpcUrl:'l1',l2RpcUrl:'storage'};
 if(missingReceipt){await assert.rejects(g.api.generateConfig('validator',config,'/synthetic'),/History verification failed/);assert.equal(writes.length,0);return;}
 if(secondReadFails||missingManager||unknownChain){await assert.rejects(g.api.generateConfig('validator',config,'/synthetic'),/installation incomplete/);assert.equal(destroyed,missingManager?2:3);assert.equal(writes.length,0);assert.ok(!files.has(key('/synthetic/client/src/abi/addresses.ts')));return;}

 await g.api.generateConfig('validator',config,'/synthetic');
 const services=JSON.parse(files.get(key('/synthetic/client/config.json')));
 const scanner=services.find(s=>s.service==='RawEventsGatherer');assert.equal(scanner.config.chainId,chainId);assert.equal(scanner.config.startBlock,0);
 assert.match(files.get(key('/synthetic/client/.env')),new RegExp('L2_CHAIN_ID='+chainId+'(?:\\r?\\n|$)'));
 assert.ok(files.get(key('/synthetic/client/src/abi/addresses.ts')).includes(address));
 assert.match(files.get(key('/synthetic/client/.env')),new RegExp('CAW_NAMES_ADDRESS='+other));
 assert.ok(files.has(key('/synthetic/ecosystem.config.cjs')));assert.equal(destroyed,3);
}
test('full generator keeps default chain, environment and address output consistent',()=>fullInstall('L2',84532,40245));
test('full generator keeps alternate chain, environment and address output consistent',()=>fullInstall('L2b',421614,40231));
test('full generator missing receipt produces no output files',()=>fullInstall('L2',84532,40245,{missingReceipt:true}));

test('full generator cannot report success when network recheck fails',()=>fullInstall('L2',84532,40245,{secondReadFails:true}));

test('all diagnostic node types build without inventing a history floor',()=>{
 const g=generator();for(const type of ['full','frontend-api','api-only','validator','frontend-only']){
 const services=g.api.buildServiceList(type,{});const scan=services.find(x=>x.service==='RawEventsGatherer');if(scan)assert.ok(!Object.hasOwn(scan.config,'startBlock'));
 }
});
test('actual service drift identifies missing services without history acquisition',()=>{
 const g=generator();const config={network:'testnet',networkId:1};
 const installed=g.api.buildServiceList('full',config).filter(s=>!['DepositWatcher','StakeLedgerReconciler'].includes(s.service));
 const src=fs.readFileSync(path.join(__dirname,'../../cli/src/steps/serviceDrift.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
 let writes=0;const ctx={path,buildServiceList:g.api.buildServiceList,console:{log(){}},success:x=>x,warn:x=>x,dim:x=>x,brand:x=>x,
 fs:{existsSync:()=>true,readFileSync:p=>p.endsWith('.env')?'L1_CHAIN_ID=11155111\nNETWORK_ID=1\n':JSON.stringify(installed),writeFileSync(){writes++;}}};
 vm.createContext(ctx);vm.runInContext(src+'\nglobalThis.api={inferNodeType,diffServices,reportServiceDrift};',ctx);
 const diff=ctx.api.diffServices(installed,config);assert.equal(diff.nodeType,'full');assert.deepEqual(Array.from(diff.missing,x=>x.service).sort(),['DepositWatcher','StakeLedgerReconciler']);
 ctx.api.reportServiceDrift('/synthetic');assert.equal(writes,0);
});


test('full generator rejects missing manager metadata on final address pass',()=>fullInstall('L2',84532,40245,{missingManager:true}));
test('full generator rejects unknown storage chain on final address pass',()=>fullInstall('L2',84532,40245,{unknownChain:true}));
test('verified address generation rejects missing RPC without writes',async()=>{
 const g=generator({console:{log(){}},dim:x=>x});
 await assert.rejects(g.api.writeAddressesForNetwork({},'/synthetic',{chainKey:'L2',actions:address}),/installation incomplete/);
 assert.equal(g.writes(),0);
 await g.api.writeAddressesForNetwork({},'/synthetic');
 assert.equal(g.writes(),0);
});


function driftFixture(missingNames){
 const g=generator();const config={network:'testnet',networkId:1};
 const installed=g.api.buildServiceList('full',config).filter(s=>!missingNames.includes(s.service));
 const scanner=installed.find(s=>s.service==='RawEventsGatherer');if(scanner)scanner.config={chainId:421614,startBlock:123};
 let writes=0,output;const logs=[];const ctx={path,buildServiceList:g.api.buildServiceList,console:{log:x=>logs.push(x)},success:x=>x,warn:x=>x,dim:x=>x,brand:x=>x,
 fs:{existsSync:()=>true,readFileSync:p=>p.endsWith('.env')?'L1_CHAIN_ID=11155111\nNETWORK_ID=1\n':JSON.stringify(installed),writeFileSync:(_p,s)=>{writes++;output=JSON.parse(s);}}};
 const src=fs.readFileSync(path.join(__dirname,'../../cli/src/steps/serviceDrift.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'');
 vm.createContext(ctx);vm.runInContext(src+'\nglobalThis.report=reportServiceDrift;',ctx);
 return {run:fix=>ctx.report('/synthetic',{fix}),writes:()=>writes,output:()=>output,logs};
}
test('doctor fix refuses missing scanner before any config writes',()=>{
 const f=driftFixture(['RawEventsGatherer','DepositWatcher']);const result=f.run(true);
 assert.equal(result.fixed,false);assert.equal(result.reason,'verified history required');assert.equal(f.writes(),0);
});
test('doctor still repairs ordinary services and preserves existing scanner settings',()=>{
 const f=driftFixture(['DepositWatcher']);assert.equal(f.run(true).fixed,true);assert.equal(f.writes(),1);
 assert.deepEqual(f.output().find(s=>s.service==='RawEventsGatherer').config,{chainId:421614,startBlock:123});
});
async function regenFixture({missingScanner,dryRun=false}){
 const g=generator();let callback,writes=0,copies=0,output;const logs=[];
 const installed=g.api.buildServiceList('full',{}).filter(s=>s.service!=='DepositWatcher'&&(!missingScanner||s.service!=='RawEventsGatherer'));
 const scanner=installed.find(s=>s.service==='RawEventsGatherer');if(scanner)scanner.config={chainId:421614,startBlock:123};
 const source=fs.readFileSync(path.join(__dirname,'../../cli/bin/caw.js'),'utf8');const start=source.indexOf("  .command('regen-config')");assert.ok(start>0);
 const end=source.indexOf('\nprogram',start);assert.ok(end>start);
 const block='program'+source.slice(start,end).replace("await import('../src/steps/generate.js')",'await injectedImport()');
 const program={command(){return this;},description(){return this;},option(){return this;},action(fn){callback=fn;return this;}};
 const ctx={program,path,ROOT_DIR:'/synthetic',resolveInstallDir:()=>'/synthetic',loadEnvFile:()=>({NETWORK_ID:'1'}),isValidNetworkId:()=>true,
 injectedImport:async()=>({buildServiceList:g.api.buildServiceList}),success:x=>x,brand:x=>x,dim:x=>x,console:{log(){},error:(...v)=>logs.push(v.join(' '))},
 process:{exit:n=>{throw Error('exit '+n);}},fs:{existsSync:()=>true,readFileSync:()=>JSON.stringify(installed),copyFileSync(){copies++;},writeFileSync:(_p,s)=>{writes++;output=JSON.parse(s);}}};
 vm.createContext(ctx);vm.runInContext(block,ctx);
 if(missingScanner&&!dryRun){await assert.rejects(callback({nodeType:'full'}),/exit 1/);assert.ok(logs.some(x=>x.includes('verified deployment history')));}
 else await callback({nodeType:'full',dryRun});
 return {writes,copies,output};
}
test('actual regen-config handler refuses unverified scanner before backup or writes',async()=>{
 const r=await regenFixture({missingScanner:true});assert.equal(r.writes,0);assert.equal(r.copies,0);
});
test('actual regen-config dry run remains read-only with missing scanner',async()=>{
 const r=await regenFixture({missingScanner:true,dryRun:true});assert.equal(r.writes,0);assert.equal(r.copies,0);
});
test('actual regen-config adds ordinary services without changing existing scanner',async()=>{
 const r=await regenFixture({missingScanner:false});assert.equal(r.writes,1);assert.equal(r.copies,1);
 assert.deepEqual(r.output.find(s=>s.service==='RawEventsGatherer').config,{chainId:421614,startBlock:123});
});


function installCommandFixture(generate){
 let callback;const calls=[],errors=[],sections=[];
 const source=fs.readFileSync(path.join(__dirname,'../../cli/bin/caw.js'),'utf8');
 const start=source.indexOf("  .command('install')"),end=source.indexOf('\nprogram',start);assert.ok(start>0&&end>start);
 const program={command(){return this;},description(){return this;},option(){return this;},action(fn){callback=fn;return this;}};
 const style=x=>x;style.bold=style;
 const ctx={program,ROOT_DIR:'/synthetic',banner(){},console:{log(){},error:(...x)=>errors.push(x.join(' '))},dim:style,brand:style,success:style,
 section:x=>sections.push(x),process:{exit:n=>{throw Error('exit '+n);}},
 selectNodeType:async()=> 'validator',collectNetworkAndMode:async()=>({network:'testnet'}),setAddressesNetwork(){},
 collectL1Rpc:async()=>({}),collectValidatorConfig:async()=>({}),collectInfraEarly:async()=>({}),chainLabels:()=>({l2:'synthetic'}),
 collectL2Rpc:async()=>({}),collectReplicationConfig:async()=>({}),collectEmailConfig:async()=>({}),collectInfraLate:async()=>({}),collectOnboardingFeatures:async()=>({}),
 generateConfig:async(...args)=>{calls.push('generate');return generate(...args);},
 runInstall:async()=>calls.push('dependencies'),configureNginx:async()=>calls.push('nginx'),configureMediaNginx:async()=>calls.push('media'),startServices:async()=>calls.push('start')};
 vm.createContext(ctx);vm.runInContext('program'+source.slice(start,end),ctx);
 return {run:()=>callback({dir:'/synthetic'}),calls,errors,sections};
}
test('actual install command stops before dependencies when real generator rejects missing history RPC',async()=>{
 const g=generator();const f=installCommandFixture(g.api.generateConfig);
 await assert.rejects(f.run(),/exit 1/);assert.deepEqual(f.calls,['generate']);assert.equal(g.writes(),0);
 assert.ok(f.errors.some(x=>x.includes('RPC are required')));assert.ok(!f.sections.includes('Setup Complete!'));
});
test('actual install command stops after late configuration failure without starting services',async()=>{
 const f=installCommandFixture(async()=>{throw Error('installation incomplete');});
 await assert.rejects(f.run(),/exit 1/);assert.deepEqual(f.calls,['generate']);
 assert.ok(f.errors.some(x=>x.includes('installation incomplete')));assert.ok(!f.sections.includes('Setup Complete!'));
});
test('actual install command awaits successful configuration before later stages',async()=>{
 let release,entered;const ready=new Promise(r=>entered=r);const barrier=new Promise(r=>release=r);
 const f=installCommandFixture(async()=>{entered();await barrier;});const running=f.run();await ready;
 assert.deepEqual(f.calls,['generate']);release();await running;
 assert.deepEqual(f.calls,['generate','dependencies','nginx','media','start']);assert.ok(f.sections.includes('Setup Complete!'));
});

test('readonly doctor requires verified history without offering an unsafe scanner template',()=>{
 const f=driftFixture(['RawEventsGatherer','DepositWatcher']);const result=f.run(false);
 assert.equal(result.fixed,false);assert.equal(result.reason,'verified history required');assert.equal(f.writes(),0);
 assert.match(f.logs.join('\n'),/receipt-verified installer/);
 assert.doesNotMatch(f.logs.join('\n'),/doctor --fix|"chainId"|"startBlock"/);
});

test('full generator renders sponsor settings without a second env append',()=>fullInstall('L2',84532,40245,{sponsorFailure:true}));

for(const failure of ['read','append'])test('address publication rejects sponsor env '+failure+' failure',()=>{
 let addressWrites=0;const logs=[];
 const g=generator({console:{log:x=>logs.push(x)},success:x=>x,dim:x=>x,warn:x=>x,
 fs:{writeFileSync(){addressWrites++;},existsSync:()=>true,
 readFileSync(){if(failure==='read')throw Error('private input detail');return 'NETWORK_ID=1\n';},
 appendFileSync(){throw Error('private input detail');}}});
 assert.throws(()=>g.api.applyAddressPlan({out:'address fixture',networkId:1,chainKey:'L2',sponsorEnvAddrs:{CAW_NAMES_ADDRESS:address}},'/synthetic'),e=>{
 assert.match(e.message,/Sponsor environment update failed; installation incomplete/);assert.doesNotMatch(e.message,/private input detail/);return true;});
 assert.equal(addressWrites,1);assert.ok(!logs.some(x=>x.includes('Appended')));
});

test('frontend-only invalid network id rejects before any output writes',async()=>{
 const g=generator({crypto:require('node:crypto'),console:{log(){}},success:x=>x,dim:x=>x});
 await assert.rejects(g.api.generateConfig('frontend-only',{network:'testnet',networkId:'not-a-number'},'/synthetic'),/NETWORK_ID is invalid/);
 assert.equal(g.writes(),0);
});

test('late compose rendering failure rejects before planned env/config publication',async()=>{
 const g=generator({crypto:require('node:crypto'),console:{log(){}},success:x=>x,dim:x=>x});
 await assert.rejects(g.api.generateConfig('frontend-only',{network:'testnet',networkId:1,useDocker:'docker',dbUrl:{includes(){return false;},toString(){return 'postgresql://synthetic';},match(){throw Error('compose render failure');}}},'/synthetic'),/compose render failure/);
 assert.equal(g.writes(),0);
});

 'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const real=require(path.resolve(process.argv[2]));
const zero=real.ZeroAddress,pad=a=>real.zeroPadValue(a,32);
let reads=0;
async function rpc(method,params){if(method==='eth_call')reads++;const r=await fetch('http://127.0.0.1:18672',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const d=await r.json();if(d.error)throw Error(JSON.stringify(d.error));return d.result;}
(async()=>{
assert.equal(await rpc('eth_chainId',[]),'0x7a69');
const names=['CawProfile','CawProfileMinter','CawNetworkManager','CawProfileURI'];
for(const role of ['L1','L2','L2b'])for(const n of ['PathwayExpander','CawProfileLedger','CawActions','CawActionsERC1271','CawActionsArchive','CawChallengeRelay'])names.push(n+'_'+role);
const A=Object.fromEntries(names.map((n,i)=>[n,'0x'+(i+65536).toString(16).padStart(40,'0')]));
const eid={L1:40161,L2:40245,L2b:40231};
function lookup(name,method,args){
      if(name==='CawProfileMinter'){
        if(false&&method==='pathwayExpander')throw Error('read failed');
        if(method==='CawProfile')throw Error('current minter has no public profile getter');
        if(method==='pathwayExpander')return A.PathwayExpander_L1;
      }
      if(method==='peers'){
        const remote=Object.keys(eid).find(r=>eid[r]===args[0]);
        if(name==='CawProfile')return pad(A['CawProfileLedger_'+remote]);
        if(name.startsWith('CawProfileLedger'))return pad(A.CawProfile);
        return pad(A[(name.startsWith('CawActionsArchive')?'CawChallengeRelay_':'CawActionsArchive_')+remote]);
      }
      if(name==='CawProfile')return ({minter:A.CawProfileMinter,cawProfileLedger:A.CawProfileLedger_L1,owner:A.PathwayExpander_L1,networkManager:A.CawNetworkManager,uriGenerator:A.CawProfileURI})[method];
      if(name==='CawNetworkManager')return ({cawProfile:A.CawProfile,minter:A.CawProfileMinter})[method];
      const role=name.split('_')[1];
      if(name.startsWith('CawProfileLedger'))return ({cawProfile:role==='L1'?A.CawProfile:zero,cawActions:A['CawActions_'+role],erc1271Sibling:A['CawActionsERC1271_'+role],bypassLZ:role==='L1',owner:zero})[method];
      if(method==='owner')return A['PathwayExpander_'+role];
      throw Error('unexpected read '+name+'.'+method);
}
// Synthetic EVM response fixture: hash calldata, SLOAD, return one ABI word.
// No actual CAW or LayerZero contracts are deployed by this test.
const code='0x365f5f37365f20545f5260205ff3';
async function put(address,signature,args,value){
const iface=new real.Interface(['function '+signature]);const data=iface.encodeFunctionData(signature.split('(')[0],args);
const word=typeof value==='boolean'?real.toBeHex(value?1:0,32):pad(value);
await rpc('anvil_setStorageAt',[address,real.keccak256(data),word]);return real.keccak256(data);
}
for(const name of names){
const address=A[name];await rpc('anvil_setCode',[address,code]);
const methods=name==='CawProfile'?['minter','cawProfileLedger','owner','networkManager','uriGenerator']:name==='CawProfileMinter'?['pathwayExpander']:name==='CawNetworkManager'?['cawProfile','minter']:name.startsWith('CawProfileLedger')?['cawProfile','cawActions','erc1271Sibling','bypassLZ','owner']:name.startsWith('CawActionsArchive')||name.startsWith('CawChallengeRelay')?['owner']:[];
for(const method of methods)await put(address,method+'()',[],lookup(name,method,[]));
if(name==='CawProfile'||name.startsWith('CawProfileLedger')||name.startsWith('CawActionsArchive')||name.startsWith('CawChallengeRelay'))for(const e of Object.values(eid))await put(address,'peers(uint32)',[e],lookup(name,'peers',[e]));
}
const endpoint='0x6EDCE65403992e310A62460808c4b910D972f10f';await rpc('anvil_setCode',[endpoint,code]);
for(const name of names){const role=name==='CawProfile'?'L1':name.split('_')[1];if(role)await put(endpoint,'delegates(address)',[A[name]],A['PathwayExpander_'+role]);}
const source=fs.readFileSync(path.join(__dirname,'../scripts/verify-deploy-wiring.js'),'utf8');
async function run(){const logs=[],providers=[];let exit=0;
const ethers={...real,JsonRpcProvider:class{constructor(){const p=new real.BrowserProvider({request:({method,params})=>rpc(method,params)},31337,{cacheTimeout:-1});providers.push(p);return p;}}};
const ctx={__dirname:path.join(__dirname,'../scripts'),console:{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))},process:{env:{DEPLOY_ENV:'testnet',L1_RPC_URL:'local',L2_RPC_URL:'local',L2B_RPC_URL:'local'},exit:c=>{exit=c;}},require:n=>{if(n==='dotenv')return {config(){}};if(n==='fs')return {readFileSync:()=>JSON.stringify({addresses:A})};if(n==='path')return path;if(n==='ethers')return {ethers};if(n==='./lz-dvn-config')return {LZ_LIBRARIES_MAINNET:{}};throw Error(n);}};
try{vm.createContext(ctx);await vm.runInContext(source,ctx,{timeout:1000});return {exit,logs,summary:logs.find(l=>l.includes('Verification complete:'))};}finally{for(const p of providers)p.destroy();}}
const valid=await run();assert.equal(valid.exit,0,JSON.stringify(valid));assert.ok(valid.summary?.includes('0 failed'));
await put(A.CawProfileMinter,'pathwayExpander()',[],zero);const wrong=await run();assert.equal(wrong.exit,1);
await rpc('anvil_setCode',[A.CawProfileMinter,'0x']);const missing=await run();assert.equal(missing.exit,1);
console.log(JSON.stringify({scope:'whole verifier, real ABI and EVM RPC, synthetic response contracts; all roles share one local chain; unsealed testnet only',valid:{exit:valid.exit,summary:valid.summary},wrong_authority:wrong.exit,missing_code:missing.exit,eth_call_count:reads}));
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
// Local evidence only. This is not an acceptance path for arbitrary contracts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ethers=require(path.resolve(process.argv[2]));
const output=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
async function rpc(method,params){
 const r=await fetch('http://127.0.0.1:18672',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 const data=await r.json();if(data.error)throw Error(JSON.stringify(data.error));return data.result;
}
(async()=>{
 assert.equal(await rpc('eth_chainId',[]),'0x7a69');
 const [owner,profile,token]=await rpc('eth_accounts',[]);
 const minter=output.contracts['contracts/CawProfileMinter.sol'].CawProfileMinter;
 assert.ok(!minter.abi.some(x=>x.type==='function'&&x.name==='CawProfile'));
 const layout=minter.storageLayout;
 const field=layout.storage.find(x=>x.label==='CawProfile');assert.ok(field);
 assert.equal(field.offset,0);assert.equal(layout.types[field.type].numberOfBytes,'20');
 async function deploy(code,args=''){
  const hash=await rpc('eth_sendTransaction',[{from:owner,data:'0x'+code+args,gas:'0xe4e1c0'}]);
  let receipt;for(let i=0;i<50;i++){receipt=await rpc('eth_getTransactionReceipt',[hash]);if(receipt)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(receipt);assert.equal(receipt.status,'0x1');return receipt;
 }
 const router=await deploy(output.contracts['test-deploy/BindingRouter.sol'].BindingRouter.evm.bytecode.object);
 const args=ethers.AbiCoder.defaultAbiCoder().encode(['address','address','address','address'],[token,profile,router.contractAddress,owner]).slice(2);
 const init='0x'+minter.evm.bytecode.object+args;
 const priorBlock=await rpc('eth_blockNumber',[]);
 const nonce=await rpc('eth_getTransactionCount',[owner,priorBlock]);
 const predicted=ethers.getCreateAddress({from:owner,nonce:BigInt(nonce)});
 const replayRuntime=await rpc('eth_call',[{from:owner,data:init,gas:'0xe4e1c0'},priorBlock]);
 const receipt=await deploy(minter.evm.bytecode.object,args);
 assert.equal(receipt.contractAddress.toLowerCase(),predicted.toLowerCase());
 const creation=await rpc('eth_getTransactionByHash',[receipt.transactionHash]);
 assert.equal(creation.to,null);assert.equal(creation.from.toLowerCase(),owner.toLowerCase());
 assert.equal(creation.input.toLowerCase(),init.toLowerCase());
 const runtime=await rpc('eth_getCode',[receipt.contractAddress,receipt.blockNumber]);
 assert.ok(runtime.length>2);assert.equal(runtime,replayRuntime,'constructor replay runtime mismatch');
 // A storage-only constructor argument can change without changing runtime.
 // Demonstrate this boundary with actual EVM replay, rather than byte edits.
 const encode=(p,r,a)=>'0x'+minter.evm.bytecode.object+ethers.AbiCoder.defaultAbiCoder().encode(['address','address','address','address'],[token,p,r,a]).slice(2);
 const replay=async data=>rpc('eth_call',[{from:owner,data,gas:'0xe4e1c0'},priorBlock]);
 const wrongProfileInput=encode(owner,router.contractAddress,owner);
 const wrongProfileRuntime=await replay(wrongProfileInput);
 assert.equal(wrongProfileRuntime,runtime,'profile is stored, not embedded in runtime');
 assert.notEqual(wrongProfileInput.toLowerCase(),creation.input.toLowerCase(),'creation input distinguishes changed profile');
 const wrongAuthorityRuntime=await replay(encode(profile,router.contractAddress,profile));
 assert.notEqual(wrongAuthorityRuntime,runtime,'changed immutable authority must alter runtime');
 await assert.rejects(()=>replay(encode(profile,token,owner)));
 assert.notEqual(ethers.getCreateAddress({from:owner,nonce:BigInt(nonce)+1n}).toLowerCase(),receipt.contractAddress.toLowerCase());
 const word=await rpc('eth_getStorageAt',[receipt.contractAddress,ethers.toQuantity(BigInt(field.slot)),receipt.blockNumber]);
 const actual=ethers.getAddress('0x'+word.slice(-40));
 assert.equal(actual.toLowerCase(),profile.toLowerCase());
 assert.notEqual(actual.toLowerCase(),owner.toLowerCase());
 const selector=ethers.id('CawProfile()').slice(0,10);
 await assert.rejects(()=>rpc('eth_call',[{to:receipt.contractAddress,data:selector},receipt.blockNumber]));
 const authorityData=await rpc('eth_call',[{to:receipt.contractAddress,data:ethers.id('pathwayExpander()').slice(0,10)},receipt.blockNumber]);
 assert.equal(ethers.AbiCoder.defaultAbiCoder().decode(['address'],authorityData)[0].toLowerCase(),owner.toLowerCase());
 console.log(JSON.stringify({scope:'actual minter on fresh local Anvil, synthetic router and account addresses; compiler-derived layout only',slot:field.slot,offset:field.offset,matching_profile:true,wrong_profile_rejected:true,profile_getter_absent:true,authority_getter_matches:true,creation_input_matches:true,derived_address_matches:true,constructor_replay_matches_runtime:true,runtime_keccak:ethers.keccak256(runtime),negative_cases:{changed_profile_same_runtime:true,changed_profile_creation_input_mismatch:true,changed_authority_runtime_mismatch:true,router_without_code_rejected:true,wrong_nonce_address_mismatch:true}}));
})().catch(e=>{console.error(e);process.exitCode=1;});

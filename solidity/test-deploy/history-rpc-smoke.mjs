import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { resolveHistoryFloor } from '../../cli/src/steps/history-floor.mjs';
const require = createRequire(new URL('../../cli/package.json', import.meta.url));
const { ethers } = require('ethers');
// Synthetic transport fixture: no real chain, keys, signatures or finality claim.
const hash = n => '0x'+n.repeat(64);
const address = '0x'+'11'.repeat(20);
const txHash=hash('2'), blockHash=hash('3'), from='0x'+'44'.repeat(20);
const record={chainId:84532,contractAddress:address,transactionHash:txHash,blockNumber:12,blockHash,transactionIndex:0};
const manifest={schemaVersion:1,environment:'testnet',contracts:{CawActions_L2:record}};
let mode='valid';const calls=[];
function result(method){
 calls.push(method);
 if(method==='eth_chainId')return mode==='wrong-chain'?'0x1':'0x14a34';
 if(method==='eth_getTransactionReceipt')return mode==='missing-receipt'?null:{transactionHash:txHash,transactionIndex:'0x0',blockHash,blockNumber:'0xc',from,to:null,contractAddress:address,cumulativeGasUsed:'0x5208',gasUsed:'0x5208',effectiveGasPrice:'0x1',logs:[],logsBloom:'0x'+'00'.repeat(256),status:mode==='failed-receipt'?'0x0':'0x1',type:'0x0'};
 if(method==='eth_getTransactionByHash')return {hash:txHash,nonce:'0x0',blockHash,blockNumber:'0xc',transactionIndex:'0x0',from,to:null,value:'0x0',gas:'0x100000',gasPrice:'0x1',input:'0x6000',chainId:'0x14a34',type:'0x0',v:'0x2958b',r:hash('1'),s:hash('1')};
 if(method==='eth_getBlockByNumber')return {number:'0xc',hash:mode==='reorg'?hash('5'):blockHash,parentHash:hash('6'),timestamp:'0x1',nonce:'0x0000000000000000',difficulty:'0x0',gasLimit:'0x100000',gasUsed:'0x5208',miner:from,extraData:'0x',transactions:[txHash]};
 throw new Error('unexpected RPC method '+method);
}
const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);const reply=x=>({jsonrpc:'2.0',id:x.id,result:result(x.method)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(Array.isArray(data)?data.map(reply):reply(data)));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 for(mode of ['valid','wrong-chain','missing-receipt','failed-receipt','reorg','missing-sibling']){
  const provider=new ethers.JsonRpcProvider(`http://127.0.0.1:${server.address().port}`,undefined,{cacheTimeout:-1});
  try{
   const args={environment:'testnet',chainKey:'L2',chainId:84532,addresses:{CawActions:address,...(mode==='missing-sibling'?{CawActionsERC1271:'0x'+'77'.repeat(20)}:{})},manifest,provider};
   if(mode==='valid')assert.deepEqual(await resolveHistoryFloor(args),{chainId:84532,chainKey:'L2',actions:address,startBlock:12});
   else await assert.rejects(resolveHistoryFloor(args),mode==='wrong-chain'?/RPC chain mismatch/:mode==='missing-receipt'?/unavailable/:mode==='failed-receipt'?/unsuccessful/:mode==='reorg'?/canonical block/:/Missing creation metadata/);
   console.log('PASS '+mode);
  }finally{provider.destroy();}
 }
 assert(calls.includes('eth_getTransactionReceipt')&&calls.includes('eth_getTransactionByHash')&&calls.includes('eth_getBlockByNumber'));
 console.log('6 transport cases passed; synthetic RPC only');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

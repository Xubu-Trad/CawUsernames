const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const Redis=require('ioredis');
const {Contract}=require('ethers');
async function main(){
  assert.ok(process.env.CAW_REVIEW_SOCKET?.startsWith('/tmp/caw-db-review-'));
  const prisma=new PrismaClient();
  const redis=new Redis({path:process.env.CAW_REVIEW_SOCKET+'/redis.sock',retryStrategy:()=>null});
  const scheduled=[];
  const context=vm.createContext({getPrisma:()=>prisma,console,
    saveCheckpoint:async(r,k,b)=>r.set(k,String(b)),
    setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},clearTimeout(){},
  });
  vm.runInContext(fs.readFileSync(__dirname+'/pinned-functions.js','utf8'),context);
  const contract=new Contract('0x1111111111111111111111111111111111111111',[
    'event SponsorRepayRegistered(uint32 tokenId,uint32 sponsorTokenId,uint256 repayAmount)',
    'event SponsorRepaySwept(uint32 tokenId,uint32 sponsorTokenId,uint256 swept,uint256 remaining)',
  ]);
  contract.queryFilter=async filter=>{
    const topics=await filter.getTopicFilter();
    const name=contract.interface.getEvent(topics[0]).name;
    return [{eventName:name,blockNumber:11,index:name==='SponsorRepayRegistered'?0:1,
      args:name==='SponsorRepayRegistered'?[1,2,100n]:[1,2,60n,40n],transactionHash:'synthetic'}];
  };
  let alive=true,degraded=0,healthy=0;
  const waitPoll=async expected=>{for(let i=0;i<400;i++){if(scheduled.length>=expected)return;await new Promise(r=>setTimeout(r,25));}throw Error('poll timeout');};
  try{
    await prisma.$connect();
    await prisma.$executeRawUnsafe('ALTER TABLE "SponsorRepay" ADD CONSTRAINT review_reject_sweep CHECK ("currentRepayAmount" <> \'40\') NOT VALID');
    const loop=context.h.makePollLoop({label:'synthetic',provider:{getBlockNumber:async()=>11},contract,redis,
      cpKey:'review:checkpoint',startBlock:10,maxBlocks:10,pollMs:60000,backoffCapMs:120000,
      heartbeat:()=>healthy++,heartbeatDegraded:()=>degraded++,alive:()=>alive,
      processEvents:async events=>{for(const e of events){if(e.eventName==='SponsorRepayRegistered')await context.h.handleSponsorRepayRegistered(e.args,e.transactionHash);else await context.h.handleSponsorRepaySwept(e.args);}},
    });
    loop.start();await waitPoll(1);
    assert.equal(await redis.get('review:checkpoint'),null);
    assert.equal((await prisma.sponsorRepay.findUnique({where:{tokenId:1}})).currentRepayAmount,'100');
    assert.equal(degraded,1);
    await prisma.$executeRawUnsafe('ALTER TABLE "SponsorRepay" DROP CONSTRAINT review_reject_sweep');
    scheduled[0]();await waitPoll(2);
    assert.equal(await redis.get('review:checkpoint'),'11');
    assert.equal((await prisma.sponsorRepay.findUnique({where:{tokenId:1}})).currentRepayAmount,'40');
    assert.equal(healthy,1);alive=false;loop.stop();
    console.log('REAL_STORAGE_RETRY_PASS');
  }finally{alive=false;await redis.quit();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

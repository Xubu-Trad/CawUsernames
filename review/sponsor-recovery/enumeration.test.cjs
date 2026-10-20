const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { Contract, version } = require(process.env.CAW_ETHERS_PACKAGE || 'ethers');
const source = fs.readFileSync(__dirname + '/source.ts', 'utf8');
const pollSource = source.slice(source.indexOf('const FAILURE_BACKOFF_CAP_MS'), source.indexOf('export const _forTests'));
const abi = ['event SponsorRepaySet(uint32 indexed tokenId,uint32 sponsorTokenId,uint256 repayAmount,uint256 depositAmount)'];
async function run(corrected, current = false, fail = false) {
  const contract = new Contract('0x1111111111111111111111111111111111111111', abi);
  const queries = [], checkpoints = [], processed = [], degraded = [], waits = [];
  contract.queryFilter = async (...args) => {
    queries.push(args);
    return [{ blockNumber: 11, index: 0, eventName: 'SponsorRepaySet' }];
  };
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  let code = pollSource;
  if (current) {
    const s = fs.readFileSync(__dirname + '/current.ts', 'utf8');
    code = s.slice(s.indexOf('const FAILURE_BACKOFF_CAP_MS'), s.indexOf('export const _forTests'));
  }
  if (corrected) code = code.replace(
    "Object.keys(allFilters).filter(k => typeof allFilters[k] === 'function')",
    "opts.contract.interface.fragments.filter(f => f.type === 'event').map(f => f.format('sighash'))"
  );
  const context = vm.createContext({
    console: {log() {}, error() {}},
    setTimeout(_fn, ms) { waits.push(ms); finish(); return 1; }, clearTimeout() {},
    saveCheckpoint: async (_redis, _key, block) => checkpoints.push(block),
  });
  vm.runInContext(stripTypeScriptTypes(code) + '\nglobalThis.factory=makePollLoop;', context);
  context.factory({
    label: 'synthetic', provider: {getBlockNumber: async () => 11},
    contract, redis: {}, cpKey: 'synthetic', startBlock: 10, maxBlocks: 10,
    pollMs: 60000, backoffCapMs: 120000, heartbeat() {},
    heartbeatDegraded: (...args) => degraded.push(args), alive: () => true,
    processEvents: async events => { if (fail) throw new Error('synthetic write failure'); processed.push(...events); },
  }).start();
  await done;
  return {queries, checkpoints, processed, degraded, waits};
}
test('real ethers filter proxy has callable events but no enumerable keys', () => {
  console.log('ethers version:', version);
  const c = new Contract('0x1111111111111111111111111111111111111111', abi);
  assert.deepEqual(Object.keys(c.filters), []);
  assert.equal(typeof c.filters.SponsorRepaySet, 'function');
});
test('captured poll loop advances checkpoint without querying real ethers filters', async () => {
  const r = await run(false);
  assert.equal(r.queries.length, 0);
  assert.equal(r.processed.length, 0);
  assert.deepEqual(r.checkpoints, [11]);
});
test('local interface-fragment candidate queries and processes the same window', async () => {
  const r = await run(true);
  assert.equal(r.queries.length, 1);
  assert.equal(r.processed.length, 1);
  assert.deepEqual(r.checkpoints, [11]);
  assert.deepEqual(r.queries[0].slice(1), [11, 11]);
});
test('current upstream fix queries and processes instead of silently advancing', async () => {
  const r = await run(false, true);
  assert.equal(r.queries.length, 1);
  assert.equal(r.processed.length, 1);
  assert.deepEqual(r.checkpoints, [11]);
});
test('current failed write holds checkpoint and reports degraded heartbeat', async () => {
  const r = await run(false, true, true);
  assert.equal(r.queries.length, 1);
  assert.deepEqual(r.checkpoints, []);
  assert.equal(r.degraded.length, 1);
  assert.deepEqual(r.waits, [60000]);
});
function handlers() {
  const s = fs.readFileSync(__dirname + '/current.ts', 'utf8');
  const code = s.slice(s.indexOf('async function handleSponsorRepaySet'), s.indexOf('const FAILURE_BACKOFF_CAP_MS'));
  let row, now = 1000;
  const db = { sponsorRepay: {
    async upsert({create, update}) { row = row ? {...row, ...update} : {...create}; },
    async update({data}) {
      if (!row) throw Object.assign(new Error('missing'), {code: 'P2025'});
      row = {...row, ...data};
    },
  }};
  const c = vm.createContext({
    getPrisma: () => db, Date: class extends Date { constructor() { super(now); } },
    console: {log() {}, error() {}, warn() {}},
  });
  vm.runInContext(stripTypeScriptTypes(code) +
    '\nglobalThis.h={handleSponsorRepaySet,handleSponsorRepayRegistered,handleSponsorRepaySwept,handleSponsorRepayForgiven};', c);
  return {h:c.h, row:()=>row, time:t=>{now=t;}};
}
test('historical registration replay resets balance until later events replay and changes time', async () => {
  const x = handlers();
  await x.h.handleSponsorRepayRegistered([1,2,100], 'registration');
  await x.h.handleSponsorRepaySwept([1,2,60,40]);
  assert.equal(x.row().currentRepayAmount, '40');
  x.time(9000);
  await x.h.handleSponsorRepayRegistered([1,2,100], 'registration');
  assert.equal(x.row().currentRepayAmount, '100');
  assert.equal(+x.row().registeredAt, 9000);
  await x.h.handleSponsorRepaySwept([1,2,60,40]);
  assert.equal(x.row().currentRepayAmount, '40');
  assert.equal(+x.row().lastSweepAt, 9000);
});
test('missing registration makes sweep and forgiveness return without a reconstructed row', async () => {
  const x = handlers();
  await x.h.handleSponsorRepaySwept([1,2,60,40]);
  await x.h.handleSponsorRepayForgiven([1,2]);
  assert.equal(x.row(), undefined);
});
test('L1 set after L2 events preserves L2 balance', async () => {
  const x = handlers();
  await x.h.handleSponsorRepayRegistered([1,2,100], 'registration');
  await x.h.handleSponsorRepaySwept([1,2,60,40]);
  await x.h.handleSponsorRepaySet([1,2,100,200], 'l1');
  assert.equal(x.row().currentRepayAmount, '40');
  assert.equal(x.row().sponsoredDepositAmount, '200');
});

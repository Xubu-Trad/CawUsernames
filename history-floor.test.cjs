'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = process.env.CAW_DEPLOY_TEST_SOURCE || path.join(__dirname, 'client/src/services/RawEventsGatherer/listenForRawEvents.ts');
const source = fs.readFileSync(file, 'utf8');
const from = source.indexOf('  // Resolve the historical-scan start block.');
const to = source.indexOf('  // parentHash chain seed:', from);
assert.ok(from >= 0 && to > from, 'actual scanner selection block must be present');
// Only erase TypeScript annotations; all branch logic is the scanner source.
const guardStart = source.indexOf('  // An event checkpoint alone');
const guardEnd = source.indexOf('  let wsProvider:', guardStart);
const guard = guardStart >= 0 && guardEnd > guardStart ? source.slice(guardStart, guardEnd) : '';
const selection = (guard + source.slice(from, to)).replace('let startBlock: number', 'let startBlock').replaceAll('config.startBlock!', 'config.startBlock');
async function run(startBlock, last = null, floorAlreadyFilled = false) {
  let headReads = 0;
  const context = vm.createContext({config: {startBlock}, last, floorAlreadyFilled,
    httpProvider: {getBlockNumber: async () => { headReads++; return 999; }}, console: {log() {}}});
  const value = await vm.runInContext(`(async () => { ${selection}\n return {startBlock, resumingFromLast}; })()`, context, {timeout: 1000});
  assert.equal(headReads, 0, 'history floor must never be sampled from head');
  return JSON.parse(JSON.stringify(value));
}
for (const floor of [undefined, null, -1, 1.5, '100', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`reject unknown/invalid floor ${String(floor)} on fresh DB`, async () => {
    await assert.rejects(run(floor), /history startBlock/);
  });
}
test('a stray stored event does not establish an unknown historical floor', async () => {
  await assert.rejects(run(undefined, {blockNumber: 500}, false), /history startBlock/);
});
test('a filled flag without a configured floor cannot authorize resume', async () => {
  await assert.rejects(run(undefined, {blockNumber: 500}, true), /history startBlock/);
});
test('explicit block zero is supported', async () => {
  assert.deepEqual(await run(0), {startBlock: 0, resumingFromLast: false});
});
test('fresh DB begins at its configured floor', async () => {
  assert.deepEqual(await run(100), {startBlock: 100, resumingFromLast: false});
});
test('unfilled history starts below a stray later event', async () => {
  assert.deepEqual(await run(100, {blockNumber: 500}), {startBlock: 100, resumingFromLast: false});
});
test('an earlier stored event remains included', async () => {
  assert.deepEqual(await run(100, {blockNumber: 50}), {startBlock: 50, resumingFromLast: false});
});
test('known filled history retains checkpoint resume behavior', async () => {
  assert.deepEqual(await run(100, {blockNumber: 500}, true), {startBlock: 500, resumingFromLast: true});
});

// Parse the complete TypeScript scanner function with Node's built-in type
// erasure. Evaluate the actual function, not a reimplementation of its guard.
const { stripTypeScriptTypes } = require('node:module');
const functionStart = source.indexOf('export default async function listenForRawEvents(');
assert.ok(functionStart >= 0);
const functionJS = stripTypeScriptTypes(source.slice(functionStart).replace('export default ', ''), {mode: 'strip'});
for (const value of [undefined, -1, NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test(`complete scanner rejects ${String(value)} before opening providers or reading state`, async () => {
    let externalCalls = 0;
    const forbidden = () => { externalCalls++; throw new Error('unexpected external operation'); };
    const context = vm.createContext({getL2HttpRpcUrls: forbidden, makeVerifiedFallbackJsonRpcProvider: forbidden});
    const listener = vm.runInContext(`(${functionJS})`, context, {timeout: 1000});
    await assert.rejects(listener({startBlock: value, rawEventsProvider: {getLastProcessedEvent: forbidden, isFloorFilled: forbidden}}), /history startBlock/);
    assert.equal(externalCalls, 0);
  });
}

const callerSource = fs.readFileSync(process.env.CAW_HISTORY_PARENT_SOURCE || path.join(__dirname, 'client/src/services/RawEventsGatherer/index.ts'), 'utf8');
const callerJS = stripTypeScriptTypes(callerSource.replace(/^import .*\r?\n/gm, '').replace('export const rawEventsGathererService', 'const rawEventsGathererService'), {mode: 'strip'});
for (const missing of ['absent', 'database-error', 'unsafe-database-value', 'valid-l1-block']) {
  test(`parent service started promise rejects ${missing} floor`, async () => {
    let providerCalls = 0;
    const scanner = vm.runInNewContext(`(${functionJS})`, {
      getL2HttpRpcUrls() { providerCalls++; throw new Error('unexpected RPC'); }
    }, {timeout: 1000});
    // Schema parsing is stubbed: this verifies service-to-listener wiring,
    // not Zod itself, a live database, or a Redis connection.
    const chain = new Proxy({}, {get: () => () => chain});
    const prisma = {$connect: async () => {}, $disconnect: async () => {}, network: {findUnique: async () => {
      if (missing === 'database-error') throw new Error('database unavailable');
      if (missing === 'valid-l1-block') return {creationBlock: 300n};
      return missing === 'unsafe-database-value' ? {creationBlock: BigInt(Number.MAX_SAFE_INTEGER) + 1n} : null;
    }}};
    const context = vm.createContext({
      z: {number: () => chain, string: () => chain, object: () => ({parse: x => x})},
      Redis: class {}, prisma, listenForRawEvents: scanner,
      getRawEventsPollIntervalMs: () => 30000, getL2WsRpcUrl: () => 'http://test.invalid', getNetworkId: () => 1,
      CAW_ACTIONS_ADDRESS: '0x' + '1'.repeat(40), CAW_ACTIONS_ERC1271_ADDRESS: null,
      console: {log() {}, warn() {}}
    });
    const service = vm.runInContext(`${callerJS}\nrawEventsGathererService`, context, {timeout: 1000});
    const running = service.start({chainId: 1, rpcUrl: 'http://test.invalid'}, {declareLoop() {}});
    await assert.rejects(running.started, /history startBlock/);
    assert.equal(providerCalls, 0);
    await running.stop();
  });
}

for (const floor of [0, 100]) test(`explicit indexed-chain floor ${floor} reaches listener without database fallback`, async () => {
  let received, dbReads = 0;
  const chain = new Proxy({}, {get: () => () => chain});
  const context = vm.createContext({
    z: {number: () => chain, string: () => chain, object: () => ({parse: x => x})},
    Redis: class {}, prisma: {$connect: async () => {}, $disconnect: async () => {}, network: {findUnique: async () => {dbReads++; return {creationBlock: 300n};}}},
    listenForRawEvents: async config => {received = config.startBlock; return {stop() {}};},
    getRawEventsPollIntervalMs: () => 30000, getL2WsRpcUrl: () => 'http://test.invalid', getNetworkId: () => 1,
    CAW_ACTIONS_ADDRESS: '0x' + '1'.repeat(40), CAW_ACTIONS_ERC1271_ADDRESS: null,
    console: {log() {}, warn() {}}
  });
  const service = vm.runInContext(`${callerJS}\nrawEventsGathererService`, context, {timeout:1000});
  const running = service.start({chainId:84532, rpcUrl:'http://test.invalid', startBlock:floor}, {declareLoop() {}});
  await running.started;
  assert.equal(received, floor); assert.equal(dbReads, 0); await running.stop();
});

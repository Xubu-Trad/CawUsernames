'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/verify-deploy-wiring.js'), 'utf8');
const start = source.indexOf('async function verifyMainnetLibraryPins()');
const end = source.indexOf('async function main()', start);
assert.ok(start >= 0 && end > start);
const fn = source.slice(start, end);

function fixture(mode = 'ok', env = 'mainnet') {
  const checks = [], reads = [], contracts = [];
  const CHAINS = {}, libs = {}, A = {};
  for (const [i, chain] of ['L1', 'L2', 'L2b'].entries()) {
    CHAINS[chain] = { endpoint: chain, lzEid: i + 1 };
    libs[chain] = { sendUln302: 'send-' + chain, receiveUln302: 'recv-' + chain };
    for (const name of ['CawProfileLedger', 'CawChallengeRelay', 'CawActionsArchive']) A[name + '_' + chain] = name + '_' + chain;
  }
  A.CawProfile = 'CawProfile';
  if (mode === 'missing-chain') delete CHAINS.L2;
  if (mode === 'missing-library') delete libs.L2;
  if (mode === 'missing-oapp') delete A.CawProfileLedger_L2;
  const context = {
    ENV: env, CHAINS, A, LZ_LIBRARIES_MAINNET: libs, L2_CHAIN_KEYS: ['L2', 'L2b'],
    chainKeyFor: (_env, chain) => chain,
    providerFor: chain => chain,
    console: { log() {} },
    ok: (name, pass) => checks.push({ name, pass }),
    eq: (name, actual, expected) => checks.push({ name, pass: actual === expected }),
    ethers: { Contract: function(endpoint) {
      contracts.push(endpoint);
      return {
        async getSendLibrary(oapp, eid) {
          reads.push(['send', endpoint, oapp, eid]);
          if (mode === 'rpc-error') throw new Error('RPC unavailable');
          return mode === 'wrong-send' ? 'wrong' : libs[endpoint].sendUln302;
        },
        async isDefaultSendLibrary() { return mode === 'default-send' ? true : mode === 'malformed-default' ? undefined : false; },
        async getReceiveLibrary(oapp, eid) {
          reads.push(['recv', endpoint, oapp, eid]);
          return [mode === 'wrong-receive' ? 'wrong' : libs[endpoint].receiveUln302, mode === 'default-receive'];
        },
      };
    } },
  };
  vm.createContext(context);
  vm.runInContext(fn, context, { timeout: 1000 });
  return { run: () => context.verifyMainnetLibraryPins(), checks, reads, contracts };
}

test('explicit matching libraries verify every directed pathway', async () => {
  const f = fixture(); await f.run();
  assert.equal(f.checks.length, 32);
  assert.equal(f.checks.filter(c => !c.pass).length, 0);
  assert.equal(f.reads.length, 16);
  assert.equal(new Set(f.reads.map(r => JSON.stringify(r))).size, 16);
});

for (const mode of ['wrong-send', 'wrong-receive', 'default-send', 'default-receive',
  'malformed-default', 'missing-chain', 'missing-library', 'missing-oapp']) {
  test(`${mode} cannot produce an all-pass verification`, async () => {
    const f = fixture(mode); await f.run();
    assert.ok(f.checks.some(c => !c.pass));
  });
}

test('RPC error rejects instead of reporting success', async () => {
  const f = fixture('rpc-error');
  await assert.rejects(f.run(), /RPC unavailable/);
});

test('non-mainnet skips pin verification without reporting a pass', async () => {
  const f = fixture('ok', 'testnet'); await f.run();
  assert.equal(f.checks.length, 0);
  assert.equal(f.contracts.length, 0);
});

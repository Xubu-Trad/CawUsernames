import assert from 'node:assert/strict'
import { buildServiceList } from '../src/steps/generate.js'
import { STORAGE_CHAINS } from '../src/steps/clientCreator.js'

function rawEvents(storageChain, network = 'testnet') {
  const services = buildServiceList('validator', {
    network,
    networkId: 1,
    storageChain,
    validatorId: 1,
  })
  const raw = services.find(s => s.service === 'RawEventsGatherer')
  assert.ok(raw, 'RawEventsGatherer service missing')
  return raw.config
}

const base = STORAGE_CHAINS.testnet.find(c => c.deploymentKey === 'L2')
const arb = STORAGE_CHAINS.testnet.find(c => c.deploymentKey === 'L2b')
const l1 = STORAGE_CHAINS.testnet.find(c => c.deploymentKey === 'L1')

assert.deepEqual(
  { chainId: rawEvents(base).chainId, startBlock: rawEvents(base).startBlock },
  { chainId: 84532, startBlock: 45547482 },
)
assert.deepEqual(
  { chainId: rawEvents(arb).chainId, startBlock: rawEvents(arb).startBlock },
  { chainId: 421614, startBlock: 298656592 },
)
assert.deepEqual(
  { chainId: rawEvents(l1).chainId, startBlock: rawEvents(l1).startBlock },
  { chainId: 11155111, startBlock: 11499545 },
)

// Regen paths may only have the persisted L2_CHAIN_ID. They must still map
// that chain ID to the same deployment block rather than falling back to Base.
assert.deepEqual(
  { chainId: rawEvents(undefined).chainId, startBlock: rawEvents(undefined).startBlock },
  { chainId: 84532, startBlock: 45547482 },
)
const regenArb = buildServiceList('validator', {
  network: 'testnet',
  networkId: 2,
  l2ChainId: 421614,
  validatorId: 1,
}).find(s => s.service === 'RawEventsGatherer').config
assert.deepEqual(
  { chainId: regenArb.chainId, startBlock: regenArb.startBlock },
  { chainId: 421614, startBlock: 298656592 },
)

console.log('STORAGE_CHAIN_BOOTSTRAP_TEST=PASS')

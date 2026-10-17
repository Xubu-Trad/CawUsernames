import { expect } from 'chai'
import { resolveRawEventsStartBlock } from '../../src/services/RawEventsGatherer/startBlock'

describe('resolveRawEventsStartBlock', () => {
  it('starts a fresh DB at the configured storage-chain floor', () => {
    expect(resolveRawEventsStartBlock(45547482, null, false)).to.deep.equal({
      startBlock: 45547482,
      resumingFromLast: false,
      reason: 'configured',
    })
  })

  it('fails closed for a fresh DB when no startBlock exists', () => {
    expect(() => resolveRawEventsStartBlock(undefined, null, false)).to.throw(
      'fresh database requires config.startBlock'
    )
  })

  it('resumes an existing DB from its last event without requiring a floor', () => {
    expect(resolveRawEventsStartBlock(undefined, { blockNumber: 500 }, false)).to.deep.equal({
      startBlock: 500,
      resumingFromLast: true,
      reason: 'last',
    })
  })

  it('backfills below an early stray event when the floor is not filled', () => {
    expect(resolveRawEventsStartBlock(100, { blockNumber: 500 }, false)).to.deep.equal({
      startBlock: 100,
      resumingFromLast: false,
      reason: 'configured-backfill',
    })
  })

  it('resumes from the last event after the configured floor is filled', () => {
    expect(resolveRawEventsStartBlock(100, { blockNumber: 500 }, true)).to.deep.equal({
      startBlock: 500,
      resumingFromLast: true,
      reason: 'floor-filled',
    })
  })

  it('does not move a configured floor forward when last is earlier', () => {
    expect(resolveRawEventsStartBlock(500, { blockNumber: 100 }, false)).to.deep.equal({
      startBlock: 100,
      resumingFromLast: false,
      reason: 'configured',
    })
  })
})

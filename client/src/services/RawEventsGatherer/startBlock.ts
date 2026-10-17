export type LastRawEvent = { blockNumber: number } | null

export type RawEventsStartDecision = {
  startBlock: number
  resumingFromLast: boolean
  reason: 'floor-filled' | 'configured' | 'configured-backfill' | 'last'
}

/**
 * Pick the historical replay boundary without ever inventing one.
 *
 * A fresh database must have a storage-chain startBlock. Starting at the
 * current head creates a database that looks healthy but is permanently
 * incomplete below that point. Existing databases may resume from their last
 * stored event because their earlier history is already represented locally.
 */
export function resolveRawEventsStartBlock(
  configuredStartBlock: number | undefined,
  last: LastRawEvent,
  floorAlreadyFilled: boolean,
): RawEventsStartDecision {
  if (configuredStartBlock !== undefined && last && floorAlreadyFilled) {
    return {
      startBlock: last.blockNumber,
      resumingFromLast: true,
      reason: 'floor-filled',
    }
  }

  if (configuredStartBlock !== undefined) {
    return {
      startBlock: last ? Math.min(last.blockNumber, configuredStartBlock) : configuredStartBlock,
      resumingFromLast: false,
      reason: last && configuredStartBlock < last.blockNumber ? 'configured-backfill' : 'configured',
    }
  }

  if (last) {
    return {
      startBlock: last.blockNumber,
      resumingFromLast: true,
      reason: 'last',
    }
  }

  throw new Error(
    'RawEventsGatherer: fresh database requires config.startBlock for the selected storage chain; refusing to start at current head'
  )
}

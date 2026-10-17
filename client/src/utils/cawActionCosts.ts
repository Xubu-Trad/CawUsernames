// Per-action CAW costs, mirroring CawActions._applyAction (`solidity/contracts/CawActions.sol:619`).
//
// Three slots per action type:
//   - SPEND:    whole CAW the sender pays (subtracted from sender balance)
//   - COMMUNAL: whole CAW that inflates rewardMultiplier (everyone earns proportionally)
//   - RECEIVE:  whole CAW credited directly to the recipient's balance
//
// SPEND = COMMUNAL + RECEIVE for actions with a fixed protocol cost. The
// contract calls `spendDistributeAndAddTokensToBalance(sender, SPEND, COMMUNAL, recipient, RECEIVE)`
// for LIKE/RECAW/FOLLOW and `spendAndDistributeTokens(sender, SPEND, COMMUNAL)` for CAW.
//
// Variable-cost types (TIP via OTHER, WITHDRAW) carry their amounts in the
// action's `amounts[]` array — see ActionData. They have zero fixed cost
// here; the snapshotter reads the per-action amounts.

export type FixedCostActionType = 'CAW' | 'LIKE' | 'RECAW' | 'FOLLOW'

export interface ActionCost {
  spend: bigint
  communal: bigint
  receive: bigint
}

export const ACTION_BASELINE = {
  CAW:    5000n,
  LIKE:   2000n,
  RECAW:  4000n,
  FOLLOW: 30000n,
} as const

/**
 * Return the fixed protocol action cost.
 *
 * The extra arguments are retained as optional compatibility parameters for
 * callers that still have capState in memory. They intentionally have no
 * effect: published action costs are immutable protocol constants.
 */
export function getActionCost(
  typeName: FixedCostActionType,
  _capRatio: bigint = 0n,
  _lastUpdatedAt: bigint = 0n,
  _currentTimestampSeconds: bigint = 0n,
): ActionCost {
  const cost = ACTION_BASELINE[typeName]

  if (typeName === 'CAW') {
    return { spend: cost, communal: cost, receive: 0n }
  } else if (typeName === 'LIKE') {
    const communal = cost / 5n
    return { spend: cost, communal, receive: cost - communal }
  } else if (typeName === 'RECAW') {
    const communal = cost / 2n
    return { spend: cost, communal, receive: cost - communal }
  } else if (typeName === 'FOLLOW') {
    const communal = cost / 5n
    return { spend: cost, communal, receive: cost - communal }
  }
  return { spend: cost, communal: cost, receive: 0n }
}

export const ACTION_COST: Record<FixedCostActionType, ActionCost> = {
  CAW:    getActionCost('CAW', 0n),
  LIKE:   getActionCost('LIKE', 0n),
  RECAW:  getActionCost('RECAW', 0n),
  FOLLOW: getActionCost('FOLLOW', 0n),
}

// Numeric tag mapping. The contract uses a uint8 enum; the database uses
// the string enum (Prisma `ActionType`). The tags below mirror
// `solidity/contracts/CawActions.sol:619` ActionType ordering.
export const ACTION_TYPE_NUM_TO_NAME = {
  0: 'CAW',
  1: 'LIKE',
  2: 'UNLIKE',
  3: 'RECAW',
  4: 'FOLLOW',
  5: 'UNFOLLOW',
  6: 'WITHDRAW',
  7: 'OTHER',
} as const

export type ActionTypeName = (typeof ACTION_TYPE_NUM_TO_NAME)[keyof typeof ACTION_TYPE_NUM_TO_NAME]

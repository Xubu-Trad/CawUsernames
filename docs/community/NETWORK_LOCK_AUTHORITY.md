# network locks are not authority removal

source baseline: `97cd13f3a1423f702d411472fdd2b2a2e7bfbd59`, `solidity/contracts/CawNetworkManager.sol`.

both locks can be set while the same owner retains these powers:

| operation | gate | effect after both locks |
|---|---|---|
| fee setters, fee recipient, fee ceilings, tip target/ceiling | onlyNetworkOwnerNotFeeLocked | blocked |
| changeOwner | onlyNetworkOwnerNotOwnershipLocked | blocked; zero-address transfer is also rejected |
| addAuthorizedSponsor / removeAuthorizedSponsor | onlyNetworkOwner | still callable; changes deposit-fee exemptions |
| setGasOverride | onlyNetworkOwner | still callable; strictly increases the per-selector override up to MAX_GAS_OVERRIDE |

`onlyNetworkOwner` checks ownerAddress against msg.sender and does not check either lock. the lock functions set flags; neither clears ownerAddress. this is source evidence of retained per-network control, not a claim about any current deployment's state. PathwayExpander finalization is a separate authority boundary.

## terminal-state decisions still needed

- existing sponsor exemptions cannot simply be frozen without considering compromised sponsor keys. decide whether a terminal state disables exemptions, permits their continuation, or uses a separately agreed mechanism. the nested mapping is not an enumerable sponsor list.
- freezing gas overrides removes the current cross-chain recovery mechanism. making increases permissionless would let anyone raise costs to the cap. neither choice follows automatically from locking ownership.
- fee recipient and accrued fees are separate from owner authority. removing control does not by itself settle distribution policy or erase existing claims.
- define the terminal-state event and readback, and require tests that every affected owner entry point rejects after finalization while permissionless operations and user exits still work.

this change corrects the renounce-equivalent description only. it does not add a terminal state, change runtime behavior, settle economics, or establish manifesto compliance. a behavioral patch needs explicit sponsor/gas policy and corresponding regression coverage.

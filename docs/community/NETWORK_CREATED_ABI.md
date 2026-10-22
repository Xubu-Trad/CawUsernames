# network-created event signature correction

baseline: `97cd13f3a1423f702d411472fdd2b2a2e7bfbd59`.

CawNetworkManager emits NetworkCreated with the full16-field CawNetwork tuple.
ChainSyncService's minimal event ABI included only14 fields, omitting
`tipTargetWei` and `tipCeilingWei`. tuple types participate in the event signature,
so the old filter selects a different topic and does not match the current
contract's NetworkCreated logs. it is not merely discarding two decoded fields.

the patch adds the missing fields in contract order. no contract, database schema,
fee policy or deployment behavior changes. the existing periodic full network
sync is a separate fallback; this finding does not establish total network
invisibility or permanent data loss.

four focused checks pass using Node24.20.0 and ethers6.16.0: topic agreement with
the source-declared struct, complete field decoding, a baseline mismatch control,
and the real ethers query-filter topic. the test derives field order from the
repository's CawNetwork struct and checks the event declaration. RPC/storage and
a live deployment were not exercised; full client typecheck was not run.

from solidity/ with ethers6.16.0 available:

```sh
node --max-old-space-size=256 --test test-deploy/network-created-abi.test.cjs
```

CAW_ETHERS_PACKAGE can point to an existing verified CommonJS/UMD installation.
the checked local run used the existing verified ethers UMD, not a fresh dependency
installation. no source-to-bytecode equivalence claim is implied by this ABI test.

this supports independently reconstructing network registrations from chain
history. it does not resolve the existing finite lookback, cursor scoping, reorgs
or swallowed database failures in other handlers. the new draft NetworkFinalized
event in #342 is a separate change; this correction is valid on current master.

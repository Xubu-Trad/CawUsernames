# network finalization draft

proposal, not an agreed release policy. based on master
`97cd13f3a1423f702d411472fdd2b2a2e7bfbd59`; follows #334.

the [manifesto](https://github.com/cawdevelopment/manifesto) rejects a person or
group with ultimate control capable of crippling the system. the preserved
[R2 reading](https://github.com/Xubu-Trad/caw-lab/blob/canon/layers/R2-020_hex_transposition/MESSAGE.md)
requires no privileged deployer after deployment and peer-reviewed, agreed release.
removing per-network owner powers addresses one part of those requirements.
it does not establish complete compliance.

## concrete proposal

an owner may explicitly call `finalizeNetwork(id)`. the call sets both locks,
clears ownerAddress and emits NetworkFinalized. it makes no external call and adds
no storage slot. networkFinalized returns false for nonexistent IDs. repeat calls,
former-owner changes and attempts to restore an owner reject through existing
owner checks. this remains callable after either or both existing locks: choosing
to end authority is distinct from transferring authority to another address.

policy proposed for review:

- existing sponsor exemptions remain exactly as recorded. the former owner can
  neither add nor revoke them. **a compromised retained sponsor cannot be revoked
  afterward.** review all exemptions before finalization; the mapping is not
  enumerable on-chain. this draft does not establish a safe exemption set.
- gas overrides freeze at existing values. there is no privileged gas-recovery
  mechanism afterward. outstanding messages and future gas changes need liveness
  review; this draft does not prove cross-chain delivery remains possible.
- fee amounts, ceilings, recipient and balances are unchanged. CawProfile's
  existing owner check on withdrawFeesFor sees owner zero, so the former owner's
  delegated trigger loses authorization. direct recipient withdrawal remains a
  separate entitlement. if the former owner is also feeAddress, those recipient
  rights are retained. the full CawProfile withdrawal path was not executed here.
- independent instance owners retain register/update/activate/deactivate rights.
  no protocol-wide freeze, replacement council, proxy or new privileged key.

existing deployed immutable contracts cannot gain this function in place.
no deployment, migration, installer auto-finalization or fee-policy change is
included. nonfinalized networks continue to retain owner authority. this draft
must not be described as removing all authority across the protocol.

## local evidence

solc0.8.30, optimizer200, viaIR, evmVersion prague: zero compiler warnings/errors;
runtime12604 bytes. local Anvil1.8.1, ethers6.16.0 UMD, Node24.20.0.
actual compiled CawNetworkManager tested with synthetic local accounts:

- all four preexisting fee/ownership-lock combinations finalize;
- events, owner zero, both locks and terminal readback checked;
-81 rejection assertions total, covering unauthorized/nonexistent finalization,
 repeat finalization and all19 tested owner entry points across four networks;
- existing sponsor/gas values and all nonowner network fields unchanged;
- controls show existing dual locks still permit sponsor/gas edits before sealing;
- other accounts register/update/deactivate/reactivate instances after sealing.

initial test harness assumed instant receipt availability and failed; bounded
receipt polling corrected the harness. the rerun passed and its local chain was
stopped. no real money or live deployment was used.

reproduce from solidity/ using a verified solc0.8.30 binary:

```sh
python3 test-deploy/network-finalization-input.py > /tmp/network-input.json
solc --standard-json < /tmp/network-input.json > /tmp/network-output.json
anvil --host 127.0.0.1 --port 18672 --chain-id 31337
# in another terminal, with a verified ethers6.16.0 CommonJS/UMD file:
node --max-old-space-size=256 test-deploy/network-finalization-live.cjs /path/to/ethers.umd.cjs /tmp/network-output.json
```

use a fresh local chain. keep at least768MiB available memory and2GiB free disk;
use a45second test timeout and stop Anvil afterward. the local run enforced those
startup/timeout checks plus process limits. the complete repository build and
CawProfile integration are not covered by this standalone contract trial.

before acceptance: decide sponsor and gas policies explicitly; exercise real
fee withdrawal, message delivery, client/indexer handling of the new event and
owner-zero state, and full reproducible builds with independent reviewers.
other deployer/bootstrap, external library, economic, storage and proof-system
gaps remain open. #221 and #276 are separate proposals, not included here.

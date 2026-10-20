# sponsor indexer review checks

bounded evidence for GilgameshCaw/Caw#311, not a node recovery tool.

## reproduce

use a disposable directory with Python 3 and Node 24.20.0. the tests require
ethers 6.16.0. installing it is a separate dependency download:

```sh
python prepare.py
npm install --no-save --package-lock=false --ignore-scripts ethers@6.16.0
node --max-old-space-size=256 --test --test-isolation=none --test-concurrency=1 --test-timeout=10000 enumeration.test.cjs watchdog.test.cjs startup.test.cjs
```

alternatively set `CAW_ETHERS_PACKAGE` to an existing ethers 6.16.0 installation.
the dependency tree is not locked by this package. the checked local run used an
existing installation; it did not test the npm installation command above.

`prepare.py` downloads three exact revisions and checks their SHA-256 digests.
existing files must match; it does not overwrite them. upstream source is not
included or relicensed by this package. tests execute extracted source in a VM;
the VM is not a security sandbox. use only the pinned, verified inputs.

## observed

16 checks pass locally. the old filter enumeration skips queries while advancing
the checkpoint. the current version fetches events and retains the checkpoint on
a failed write. actual supervisor/poll functions under virtual time restart a
persistent failure at 1955 seconds and a hung poll at 215 seconds; recovery avoids
the restart. configured-chain startup declares only loops that run.

replay can reset a swept balance until subsequent events run and changes recorded
timestamps to replay time. missing registration causes later sweep/forgiveness
handlers to return without rebuilding the missing row.

## boundaries and remaining recovery work

RPC, Redis, Prisma, time and stats are mocked. configuration validation and real
environment fallback resolution are excluded. no real database, chain replay,
full installation or production loss was demonstrated.

the checked machine has no PostgreSQL/Redis/Docker executable available through
the inspected Windows/WSL paths. operational recovery remains untested.

before a real recovery trial:

1. provision isolated PostgreSQL and Redis with pinned versions and disposable
   data directories. never reuse an existing node database or checkpoint store.
2. preserve source database/checkpoints separately. avoid normal installer paths
   that invoke `prisma db push --accept-data-loss`.
3. establish per-chain deployment/registration start blocks and a recorded end
   block/hash. recover registration before sweep/forgiveness events.
4. replay into a separate dataset without concurrent live writers. compare
   balances, event coverage and retry behavior against an independent reference.
5. explicitly decide timestamp semantics, test interruptions and restart, then
   document cutover and rollback. do not switch a live node on these mock results.

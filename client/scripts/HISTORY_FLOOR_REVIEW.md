# Explicit history floors

RawEventsGatherer previously started a fresh database at the current chain head when neither config.startBlock nor Network.creationBlock was available. A stored event could also become the starting point without establishing that earlier history had been read.

The listener now rejects missing, negative, fractional, nonnumeric or unsafe-integer floors before opening its RPC provider or reading scanner state. The service's existing started promise propagates this rejection. Network.creationBlock is not used as a fallback: it can contain an L1 block number, not a floor on the indexed storage chain. Explicit block zero remains valid. Existing configured-floor backfill and filled-history checkpoint resume behavior are preserved.

## Upgrade requirement

Before restarting, set a reviewed startBlock for the selected chain/deployment. A database creationBlock alone is insufficient. Installations that depended on implicit current-head or checkpoint-only startup will now reject indexer startup. The enclosing node process can remain running: runServices retries start with a growing delay capped at 30 seconds and logs each failure. A live process therefore does not establish that indexing is running. Do not choose today's head merely to suppress the error. Recover the relevant creation record and verify chain, address and inclusion, then review the earliest required block for all indexed contracts (including any ERC-1271 sibling).

Keep the database and original configuration intact. This change neither clears partial history nor repairs it automatically. Review existing floor-filled markers before a deliberate historical rebuild; they are not generation-bound by this patch. An operator can still explicitly configure an incorrect or too-recent floor. A valid integer is not proof of complete history.

## Reproduction

From repository root, Node 24:

```
node --test --test-isolation=none --test-concurrency=1 --test-timeout=10000 history-floor.test.cjs
```

The tests exercise actual scanner selection code, the complete scanner's early rejection, and parent-service failure propagation with mocked dependencies. Node's built-in TypeScript erasure parses the full scanner function and parent service; it is not a TypeScript semantic typecheck. These are not live RPC, database, Redis or complete service-stack tests. Full client dependencies and generated Prisma types were unavailable in the review environment, so client tsc --noEmit remains a merge gate.

Separate remaining work: installer consumption of chain/address-bound public receipt metadata; generation-scoped floor-filled markers; independent complete historical acquisition and reorganization handling. This patch changes no contract, fees, deployment or chain state.

Based on upstream 97cd13f3a1423f702d411472fdd2b2a2e7bfbd59. Review integration with scanner polling PR #277 and adaptive-range PR #242; this change addresses startup-floor selection rather than RPC range sizing or live catch-up.

## installer integration dependency

At base `97cd13f3`, `cli/src/steps/generate.js` copies `l2DeployBlock` from the committed deployment state into a new indexer configuration. PR #328 removes that compatibility value when it has no matching creation receipt. The database fallback is now removed: ChainSync can populate `Network.creationBlock` from the L1 NetworkManager. Without an explicit indexed-chain floor, indexing remains stopped while the supervisor retries.

Do not land the combined installation path as operationally complete until the installer consumes chain/address-bound receipt metadata and operators have a recovery path for existing receipt-less state. Retaining an unverified legacy number as authoritative would conceal the missing provenance. This is an integration gate, not an assertion that the installer migration is implemented.

## cross-chain review correction

ahdmesh identified that a valid L1 creationBlock could silently become an L2 floor; tentencaw independently confirmed the source path. this behavior existed on master. the earlier claim that a reviewed database creationBlock was sufficient was too broad. this revision removes that fallback, including manually seeded database values without chain provenance. operators must configure the selected chain explicitly. PR #328 supplies a receipt-backed path, subject to its own verification and RPC availability gates.

regressions include a synthetic valid L1 block300 with no explicit L2 floor: startup must reject before opening the scanner RPC. explicit L2 floor100 and zero still reach the listener without reading the database fallback. these are service wiring tests with mocks, not a live ChainSync/database reproduction or proof of complete historical coverage. existing filled-history markers remain unbound to floor/deployment generations.

validation: 25/25 mocked checks pass; using the pre-change parent service with the same listener, 24 pass and the valid-L1-block regression fails. Node24.20.0, existing768MiB startup/512MiB process/heap256 limits retained. TypeScript erasure is not semantic typechecking.

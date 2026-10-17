# Explicit history floors

RawEventsGatherer previously started a fresh database at the current chain head when neither config.startBlock nor Network.creationBlock was available. A stored event could also become the starting point without establishing that earlier history had been read.

The listener now rejects missing, negative, fractional, nonnumeric or unsafe-integer floors before opening its RPC provider or reading scanner state. The service's existing started promise propagates this rejection. Configuration still takes precedence over Network.creationBlock. Explicit block zero remains valid. Existing configured-floor backfill and filled-history checkpoint resume behavior are preserved.

## Upgrade requirement

Before restarting, set a reviewed startBlock for the selected chain/deployment, or supply its reviewed Network.creationBlock. Installations that depended on implicit current-head or checkpoint-only startup will now stop. Do not choose today's head merely to suppress the error. Recover the relevant creation record and verify chain, address and inclusion, then review the earliest required block for all indexed contracts (including any ERC-1271 sibling).

Keep the database and original configuration intact. This change neither clears partial history nor repairs it automatically. Review existing floor-filled markers before a deliberate historical rebuild; they are not generation-bound by this patch. An operator can still explicitly configure an incorrect or too-recent floor. A valid integer is not proof of complete history.

## Reproduction

From repository root, Node 24:

```
node --test --test-isolation=none --test-concurrency=1 --test-timeout=10000 history-floor.test.cjs
```

The tests exercise actual scanner selection code, the complete scanner's early rejection, and parent-service failure propagation with mocked dependencies. Node's built-in TypeScript erasure parses the full scanner function and parent service; it is not a TypeScript semantic typecheck. These are not live RPC, database, Redis or complete service-stack tests. Full client dependencies and generated Prisma types were unavailable in the review environment, so client tsc --noEmit remains a merge gate.

Separate remaining work: installer consumption of chain/address-bound public receipt metadata; generation-scoped floor-filled markers; independent complete historical acquisition and reorganization handling. This patch changes no contract, fees, deployment or chain state.

Based on upstream 97cd13f3a1423f702d411472fdd2b2a2e7bfbd59. Review integration with scanner polling PR #277 and adaptive-range PR #242; this change addresses startup-floor selection rather than RPC range sizing or live catch-up.

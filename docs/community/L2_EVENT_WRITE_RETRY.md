# L2 event write retry

baseline: `97cd13f3a1423f702d411472fdd2b2a2e7bfbd59`.

session creation, revocation and network authentication handlers catch primary
database write errors and return normally. the poll then saves the range end.
a failed revocation can leave an active local row even though its chain event
was scanned. this is not evidence of a bypass of on-chain session validation.

the patch propagates those three errors into the existing range retry catch.
no contract, signature, fee or authorization policy changes. successful earlier
writes are replayed, not rolled back. the existing ordering remains intact.

## reproduce

with node 24 and ethers 6.16 installed, run from the repository root:

```sh
node --test solidity/test-deploy/l2-event-retry.test.cjs
```

six checks pass: create/revoke order, revoke/recreate order, each of three write
failures followed by successful retry, and a baseline control reproducing a
skipped revocation. the tests extract the actual poll and handlers, use real
ethers ABI encoding/decoding, and simulate RPC and database behavior. a failed
write holds block 10; recovery replays block 11 and saves it only after success.
the baseline advances to 11 while the local session remains active.

## boundaries

this does not fix cursor read failures (#290), the L1 fee event path (#345),
fresh-node lookback limits, missing session rows, reorganizations, concurrent
polling or complete cold-start recovery. nested best-effort TxQueue cleanup and
signature recovery catches are unchanged. no full client typecheck, real
database/RPC or full-service run is claimed. no release readiness is asserted.

#182 handles frontend revocation confirmation and #324 handles batch signer
recovery in DataCleaner; neither replaces these primary event-write retries.

independent nodes need reliable replay to avoid manual operator repair. this
supports the manifesto/R2 independence requirement but is not itself proof of
complete protocol decentralization or removal of contract authority.

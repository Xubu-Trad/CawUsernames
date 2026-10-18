# CLI command smoke checks

source: receipt-provenance branch at `a467dfe28e43e8896af329381f128b5e950164db`; Node 24.20.0 on Windows. the CLI files from baseline `97cd13f3` were overlaid with this branch's changed CLI files and receipt-verification modules.

76 dependencies were acquired at the CLI lockfile's exact registry URLs and verified against its integrity fields. no npm lifecycle scripts ran. archives were extracted into their lockfile paths in an isolated directory; this was not an npm-ci installation or bin-link validation. CLI lock SHA-256: `b6788fc18b501245d872fd9165e8103baac299fec9c9ec69ad625a417a00e2a9`.

| command / condition | observed result |
|---|---|
| `node cli/bin/caw.js --help` | exit 0; command list loads |
| `node cli/bin/caw.js --version` | exit 0; 0.1.0 |
| `regen-config --dir <synthetic-missing-scanner> --dry-run` | exit 0; lists missing scanner and DepositWatcher |
| same command without dry-run | exit 1 with verified-history requirement; config unchanged, no backup file created |
| `regen-config --dir <synthetic-existing-scanner>` | exit 0; adds DepositWatcher, creates original-config backup, preserves all original entries and scanner chainId 421614/startBlock 123 |

fixtures use the actual buildServiceList export with either RawEventsGatherer and DepositWatcher omitted, or only DepositWatcher omitted. `.env` contains NETWORK=testnet and NETWORK_ID=1. no wallet keys, RPC endpoints, database or service processes are used. the preserved chain/floor are synthetic operator settings, not validated deployment evidence. compared final JSON and original backup after execution; command exit codes alone were not the acceptance check.

resource guards retained: minimum available memory 768 MiB, disk 2 GiB; each Node process limited to 512 MiB and one process, Node heap capped at 256 MiB. command timeout 30 seconds. no production contract or CLI behavior changed in this evidence update.

this covers module loading and actual regen-config execution with locked dependencies. it does not cover an interactive complete installation, npm lifecycle/bin behavior, doctor database checks, Linux deployment, live RPC receipt acquisition, or frontend/prover builds. those remain separate gates.

## read-only doctor follow-up

with the diagnostic-guidance patch in this revision, `doctor --dir <synthetic-missing-scanner>` exits 1 and requires receipt-verified installation. it no longer recommends `doctor --fix` or prints an unverified scanner configuration template. all fixture file hashes remain identical; no files were added. 76 receipt/installer regression checks and serviceDrift syntax checking pass.

this executes the actual command with the locked dependencies described above. deployment-state and database checks are skipped because their inputs are absent; the CSP status line is not evidence of a complete frontend check. no live node health or complete recovery claim follows from this fixture.

## receipt RPC transport check

run `node solidity/test-deploy/history-rpc-smoke.mjs` after installing the locked CLI dependencies. the fixture uses the actual ethers JsonRpcProvider and history-floor/creation-receipt modules against a loopback HTTP server. six cases pass: matching metadata returns block 12; wrong chain, absent receipt, failed receipt, changed canonical block hash and missing ERC1271 sibling record each reject with the expected error. providers and server are closed afterward.

verified with Node 24.20.0 and the 76 integrity-checked CLI dependencies, under the resource guards above. no function substitution or provider doubles are used; the HTTP responses themselves are synthetic. transaction signatures/hashes are fixture placeholders, not independently authenticated blockchain evidence. this checks RPC serialization/parsing and rejection behavior, not finality, deployed bytecode, full config generation or a complete install. those remain open.

## full generator through loopback RPC — initial observation

the same smoke command now also calls the actual `generateConfig` export with real temporary files and the actual RPC provider. nine total cases pass, including these three additions:

- validator configuration succeeds with synthetic matching history; scanner chain 84532/start block 12, environment chain, generated action address and process configuration agree. both network-selection reads occur.
- absent receipt rejects before configuration, environment, addresses or process files are written.
- changed storage selection on the final read rejects, but configuration, environment and process files have already been written; addresses.ts is absent. this is an observed partial-output gap, not an atomic recovery guarantee. do not start services after the failed install.

fixture directories are newly created and removed by the test; no existing installation is modified. generated random environment values and local paths are not published. real filesystem writes and real provider parsing are covered, but the chain responses remain synthetic. the interactive installer, service startup, Linux permissions, live deployment receipts and runtime recovery remain outside this check. next recovery gate: prevent or safely stage partial outputs, including failure during final file publication.

## selection checks before output writes

the generator now prepares the address output and completes the second storage-selection read before writing configuration, environment or process files. it applies that prepared address output after the environment is generated. this removes the partial-output case caused by a failed/changed network-selection recheck.

76 regression checks and all nine transport/generation cases pass. the transport case starts with existing operator config, environment and process files and confirms all three remain byte-identical when selection changes. running this same assertion against the prior generator at dc27ba2007140349ecefc33288007d3d67925fba fails because it overwrites the operator config. missing-manager, failed-read and unknown-chain regression cases also require zero writes.

this is preflight validation, not a filesystem transaction. disk errors, permission errors, process interruption or later validation failures may still leave partial output. changes on-chain after the last observation remain possible. no atomic recovery or finality claim is made.

## sponsor environment failure propagation

address publication now throws if reading or appending the sponsor environment fails. the same helper serves verified installation and standalone address regeneration, so neither path silently treats this error as success. the message states that installation is incomplete and services must not start; raw filesystem error details are not echoed.

79 regression checks pass, including full-generator append failure and direct address-publication read/append failure. all three new assertions fail against the preceding generator at 94006f1f1566936352f0d432fa47b9bde9f60854. the nine real-provider transport/generation cases still pass. injected filesystem errors exercise propagation; no physical disk failure was induced. earlier files may already have been written. this is not rollback, durable recovery or a barrier against direct external process-manager commands.

## render and validate before publication

full generation now builds every output in memory before writing targets. backend/frontend network identifiers are validated before publication; env files retain readback validation after writes. sponsor settings join the first backend env write, removing the second append step from installation. standalone address regeneration retains its explicit append-failure rejection. process paths remain rooted in the requested installation directory.

81 regression checks pass, including invalid frontend-only network selection and a later compose-rendering failure with zero output writes. the full-generator sponsor test now confirms successful output even when any append would throw, and verifies the sponsor address in the resulting env. nine transport/generation cases pass with actual provider and filesystem; these additionally check sponsor output and process working directory.

this is in-memory preparation only. writes are still sequential: disk errors, chmod/readback errors, interruption and concurrent edits can leave partial output. no journal, rollback, secret backup or crash-recovery mechanism has been implemented.

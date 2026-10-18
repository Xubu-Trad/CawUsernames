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

## full generator through loopback RPC

the same smoke command now also calls the actual `generateConfig` export with real temporary files and the actual RPC provider. nine total cases pass, including these three additions:

- validator configuration succeeds with synthetic matching history; scanner chain 84532/start block 12, environment chain, generated action address and process configuration agree. both network-selection reads occur.
- absent receipt rejects before configuration, environment, addresses or process files are written.
- changed storage selection on the final read rejects, but configuration, environment and process files have already been written; addresses.ts is absent. this is an observed partial-output gap, not an atomic recovery guarantee. do not start services after the failed install.

fixture directories are newly created and removed by the test; no existing installation is modified. generated random environment values and local paths are not published. real filesystem writes and real provider parsing are covered, but the chain responses remain synthetic. the interactive installer, service startup, Linux permissions, live deployment receipts and runtime recovery remain outside this check. next recovery gate: prevent or safely stage partial outputs, including failure during final file publication.

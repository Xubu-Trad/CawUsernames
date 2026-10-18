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

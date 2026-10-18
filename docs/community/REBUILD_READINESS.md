# Independent rebuild readiness

Snapshot: `97cd13f3a1423f702d411472fdd2b2a2e7bfbd59`. This is a source review and a proposed acceptance checklist, not a completed rebuild or a release approval.

## What has been demonstrated

The captured Git history and PR heads can be restored independently. This establishes source recovery only. It does not establish availability of downloaded packages, compiler reproducibility, service operation or a matching proof circuit. A private preservation copy is not a substitute for public reproducibility evidence.

## Open build gates

| Gate | Observed source | Required evidence |
| --- | --- | --- |
| Fixed installer inputs | `install.sh` defaults to a mutable upstream branch, shallow-clones it, installs Node 22.x through an external setup script, installs global yarn/pm2 without versions, and uses npm install for the CLI | Pinned source revision, supported OS/runtime/package-manager versions, checksummed installers and a documented clean-host build |
| Package availability | Six npm locks contain 2,849 package entries across scopes, not unique packages. Two entries without registry integrity are local smltxt sources; the third is ethereumjs-abi pinned to a Git commit via SSH | Retain local source hashes; mirror/verifiably acquire exact remote dependencies, including Git revision ee3994657fa7a427238e6ba92a84d0b529bbcde0; test installation without original contributor credentials |
| Lockfile selection | client has both npm and Yarn locks; frontend has a Yarn lock | Declare the intended package manager per scope and prove lockfiles remain unchanged during a clean installation; do not assume the two resolution sets are identical |
| Prover toolchain | `solidity/zk/sig-recovery/rust-toolchain` names stable; upstream VKEY_REPRODUCIBILITY.md reports an unresolved guest-toolchain/expected-key mismatch | Pin the exact compiler/toolchain and source hashes; reproduce ELF and verification key on independent hosts and validate an actual proof against the selected contract |
| Original proving artifact | No tracked .elf file or /elf/ path was found in this source snapshot | Obtain a checksummed artifact with provenance or demonstrate reproducible construction; absence from this filename scan alone does not prove no artifact exists elsewhere |
| Infrastructure | Installer uses external OS repositories. Optional SigNoz installation clones main | Distinguish required services from optional telemetry; pin needed container images/packages and prove operation without optional telemetry |
| Generated and deployment-specific data | Prisma generation, contract ABIs, deployment addresses, circuit fixture and ZK_PROGRAM_VKEY affect integration | Reproduce generation from pinned sources; compare outputs; verify chain/address/receipt binding independently |
| Operational continuity | Source recovery does not include live data, transport endpoints, availability guarantees or archived external assets | Fresh-node historical replay, service recovery, original-operator outage and alternate-frontend tests |

The prover mismatch is **reported by the upstream document**, not independently reproduced by this review. Its statements about deployed values and past compiler experiments must be verified against the selected deployment. Do not infer every non-ZK path is unusable, and do not silently change an immutable key or redeploy to make a check pass.

Static inventory: `REBUILD_INPUT_INVENTORY.json`. Integrity-field absence is not automatically a vulnerability: local sources and Git-pinned dependencies have different provenance mechanisms. No dependency installs, remote installers, package lifecycle scripts, chain transactions or deployment were run for this inventory.

## Contribution continuity proposal #327

Reviewed head: `6d2715e7c133c650a21a65d837b745e94cf419b3` by ahdmesh: https://github.com/GilgameshCaw/Caw/pull/327 . It offers an optional portable handoff and a structural validator. This complements public coordination; it does not establish contract decentralization, evidence truth, contributor identity, review agreement or release authority.

The eight direct validator tests passed locally. Its two subprocess-based CLI tests could not launch under the existing one-process guard; the original suite therefore returned 8 passes and 2 failures in that environment. Both CLI cases were then run directly under the same guard: the example returned 0 with PASS, and missing input returned 2 with usage. This is not represented as an unmodified 10/10 suite pass. The guard was not weakened.

Useful optional additions for our own records: immutable base/head and file hashes, exact dependency/toolchain identities, observed versus expected results, archive retrieval/restore instructions, and explicit verification boundaries. These can remain evidence/unknown entries within the proposal's current schema; they do not require a mandatory gate or an appointed successor.

## Proposed integration order

1. Preserve source and contribution records; retain original authorship and notices.
2. Agree a requirements register and explicitly separate unresolved economic interpretations from implementation defects.
3. Reproduce the selected base build and proving artifacts. Record unavailable dependencies rather than substituting floating versions.
4. Review overlapping patch families independently: terminal authority (#221/#276 and network controls), history provenance/floor handling, identity and transfers, storage and replay.
5. Integrate reviewed patches in an isolated candidate branch; rerun cross-component tests. A preserved PR head is not a reviewed patch.
6. Produce a pinned release candidate for independent review and explicit release agreement. No mainnet readiness follows from completing steps 1 or 2.

Coordination proposal: https://github.com/cawdevelopment/manifesto/issues/5 . Its existence is not maintainer endorsement or adopted consensus.

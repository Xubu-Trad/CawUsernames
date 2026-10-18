# decentralization and continuity register

review baseline: `97cd13f3a1423f702d411472fdd2b2a2e7bfbd59`. updated 2026-10-18. this is a working register, not an exhaustive audit or release approval.

the supplied R2 reading calls for peer review, an agreed release, no developer backdoors/proxies/multisigs, and no privileged deployer after deployment. the [manifesto](https://github.com/cawdevelopment/manifesto) remains the detailed specification. interpretations below are review obligations, not newly adopted protocol rules.

| id | obligation and evidence | patch or discussion | remaining gate |
|---|---|---|---|
| D01 | remove persistent bootstrap authority; PathwayExpander owner-gated operations on baseline | [#221](https://github.com/GilgameshCaw/Caw/pull/221) | local lifecycle and synthetic wiring checks exist; actual multichain finalization and independent review remain open |
| D02 | inspect external message-library authority; PathwayExpander and wiring verifier | [#276](https://github.com/GilgameshCaw/Caw/pull/276), combined candidate `cfa8f39de9001fc265dff745c5141abad0d95a3c` | reconcile with D01; actual endpoint/library behavior remains unverified |
| D03 | remove indispensable network-owner control; CawNetworkManager sponsor authorizations and capped gas overrides survive fee/ownership locks | no patch assigned in this register | design terminal state, treatment of existing authorizations and gas liveness; check overlapping PRs before proposing code; no replacement council/multisig assumed |
| D04 | resolve deployer-linked economics; deploy.js network recipients, CawProfile.payFee, CawBuyAndBurn recipient allocation | specification decision; agreement not established | document source clauses, amounts and alternatives; do not silently choose a new distribution policy |
| D05 | assess sponsored withdrawal exit dependency; CawProfileMinter level-1 timed lock versus level-2+ external verification | #274 covers bootstrap wiring, not this policy gap | assess exit/liveness and accepted-spec evidence separately; do not describe all withdrawals as gated |
| D06 | chain/address-bound deployment history; deploy.js sampled floor and installer selection | [#328](https://github.com/GilgameshCaw/Caw/pull/328), head `2d96c5d9ce888d2fee0a58b02eea57fa1822a6af` | 67 local tests with doubles and syntax passed; current testnet creation receipts absent; real installer compatibility and late-output recovery open |
| D07 | no silent current-head cold start; RawEventsGatherer | [#329](https://github.com/GilgameshCaw/Caw/pull/329) | 22 mocked checks reported locally; full client typecheck/live integration and chain-scoped fallback review remain open; integrate with D06 |
| D08 | independent rebuild of immutable proof configuration; guest toolchain and expected key | [#330](https://github.com/GilgameshCaw/Caw/pull/330) | wrapper checks are not ELF/key reproduction; original artifact, pinned toolchain and independent actual proof remain open |
| D09 | reject unreadable minter authority; verify-deploy-wiring.js | [#332](https://github.com/GilgameshCaw/Caw/pull/332) | local negative cases exist; internal profile binding requires deployment/code/storage evidence, not a nonexistent getter |
| D10 | independently recover history and operate without original infrastructure | no comprehensive patch assigned | empty-database reconstruction, retention, reorgs, alternate endpoints/frontends and original-operator outage tests; a receipt floor alone is insufficient |
| D11 | public contribution and release agreement without one indispensable maintainer | [builder discussion](https://github.com/cawdevelopment/manifesto/issues/5); optional [#327](https://github.com/GilgameshCaw/Caw/pull/327) | proposal is not adopted governance; repository permissions need maintainer action; polls and merged code do not establish release agreement |
| D12 | detailed manifesto parity: costs, staking/distribution, text limits and ownership/transfer behavior | dedicated comparison incomplete | source-clause-to-code review and explicit agreement for deviations; do not label every economic algorithm a human backdoor |

## supporting tests

[#333](https://github.com/GilgameshCaw/Caw/pull/333), head `a09acc694bd7324e268fe82b0e700ef5ff9858dd`, adds nine Foundry scenarios with a mock SP1 verifier. source reviewed; its reported executions have not been independently rerun here. [requested coverage](https://github.com/GilgameshCaw/Caw/pull/333#issuecomment-6250172038) checks the exact key/public inputs passed to the verifier. this is test coverage, not a decentralization fix or proof verification.

## backup gates

| scope | status |
|---|---|
| captured Git references | 338/338 restored and hash-matched: 5 branch heads and 333 PR heads; no advertised tags at capture |
| current discussion snapshot | 1,065 conversation comments; all 333 PRs queried for submitted reviews, none returned; inline comments/releases empty |
| off-device checkpoint | seven files downloaded and byte-compared; incremental archive requires the earlier base and PR157 supplement |
| post-checkpoint updates | latest #333 review comment is saved locally and awaits the next discussion refresh |
| external dependencies/artifacts | not complete: package availability, historical LFS, attachments, workflow artifacts and proving artifact recovery |
| operational independence | not demonstrated: independent application/prover rebuild and cold-start operation remain open |

100% applies only to the captured Git-reference denominator. no overall recovery percentage is claimed. deleted or previously edited material cannot be recovered merely by querying current GitHub state.

## next work

prioritize new reviewer feedback, then D06 installer reproduction and D03 terminal-control design. for each newly confirmed implementation defect: identify an existing overlapping PR, reproduce it, make a focused patch, record validation boundaries, and submit it for review. specification choices remain explicit decisions. maintain separate preservation and integration branches; do not bulk-merge archived PRs.

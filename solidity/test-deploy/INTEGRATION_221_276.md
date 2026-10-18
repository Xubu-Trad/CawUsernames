# sealed deployment and library pinning candidate

review candidate combining #221 at `9bfe9ea1e94af4e7ac7cee3ba38908b1fcb3d7a2` and #276 at `47dfc2cd18fa663c87d88cb8ea7afc85c44a41cf`.

two textual conflicts are resolved. PathwayExpander keeps BootstrapFinalized and both library-pinning events. the deployment verifier keeps both complete verification functions and invokes both from main. other changes are the automatic git merge result.

124 mocked deployment-runner checks pass. deploy.js and verify-deploy-wiring.js pass syntax checking. 11 additional tests execute the actual library-selection verification function with deterministic endpoint doubles: eight directed pathways, wrong libraries, inherited defaults, missing configuration, malformed default flags, RPC failure and non-mainnet skip behavior. these are not live endpoint checks or Solidity compilation.

the combined PathwayExpander compiled successfully with Solidity `0.8.30+commit.73712a01`, OpenZeppelin contracts 4.9.6, viaIR enabled, optimizer enabled/runs 1, and evmVersion cancun. compilation covered PathwayExpander and its Ownable/Context imports, not the whole repository. zero compiler errors; one warning suggests pure mutability for the intentionally reverting transferOwnership override. runtime size: 8,872 bytes.

compiler: `https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/windows-amd64/solc-windows-amd64-v0.8.30+commit.73712a01.exe`, SHA-256 `ccbd3ed44d5fbd26fe039702d403421f1212d2e8752e3cbe3bfd074986911586`. OpenZeppelin package integrity was checked against package-lock.json before reading the two source units.

the portable `integration-solc-input.json` contains all three source units and settings. run a verified compiler with `solc --standard-json < solidity/test-deploy/integration-solc-input.json > output.json`. require no severity=error diagnostics and inspect the resulting contract output. input SHA-256: `441c865397c45dfad7a25f4ae053a42dd34a8ec23de2f90065db7f74e589ed23`. runtime bytecode SHA-256: `52cb6b5670a61050bba5bd3f888f01415fc4db12cc4f25dcaa5d56919a7fd7f7`. compilation is not execution or an independent reproduction.

the `PinSealHarness.sol` constructor completed 16 assertions in a successful transaction on fresh, unforked Anvil 1.8.1 (chain 31337). it deploys the actual combined PathwayExpander and a synthetic endpoint. cases cover unconfigured and unauthorized calls, successful send/receive pins, idempotent repeats, rejected replacement, rejected ownership transfer, finalization, and rejected owner calls afterward. endpoint pins remain unchanged. deployed expander bytecode matched the compiled runtime hash above. gas used for the complete harness creation: 2,699,259.

reproduce by compiling `integration-runtime-input.json` with the same verified compiler and deploying its `PinSealHarness` creation bytecode on a fresh local chain. require receipt success, `checks() == 16`, and a runtime hash match for `expander()`. constructor assertion failure reverts creation. no account keys or live RPC are needed in the input. input SHA-256: `42b855c22521cb34f30bdd23f99e24bed9fa4cf23ea45852cd0768fcf41628db`. the fake endpoint does not enforce or model the full LayerZero protocol; this is an EVM lifecycle check of the expander, not cross-chain acceptance.

25 tests now execute the actual finalization-verification function in isolation: one valid fixture and 24 invalid/error cases, including the unrelated-transfer-after-sealing case. all pass. RPC, ABI and contract boundaries are deterministic doubles; this does not verify cryptographic encoding, receipt inclusion, provider honesty or the complete main verifier. run `node --test solidity/test-deploy/finalization-verifier.test.cjs`.

before integration acceptance: exercise real endpoint integration, execute the full verifier with real ABI decoding and local-chain receipts, and complete independent multi-chain deployment/recovery checks. #221's constructor-binding regression is included; earlier results against older combined heads do not establish these checks for this candidate. run the library tests with `node --test solidity/test-deploy/library-verifier.test.cjs`.

this branch does not update either upstream pr head or establish release approval. pinning plus owner removal prevents later owner-driven library replacement for that sealed generation. replacement/migration remains a separate design and review decision.


### Real ABI and local receipt check

`finalization-live.cjs` executes the actual finalization verification function with ethers 6.16.0 and a fresh, unforked Anvil chain (31337, loopback port 18672). A directly deployed PathwayExpander is finalized by its synthetic owner. All 12 checks pass. A subsequent successful one-wei transfer is rejected for receipt target, transaction target, calldata and missing finalization event.

Supply the verified ethers UMD bundle and the solc output compiled from `integration-solc-input.json` as the two script arguments. The ethers tarball is verified against the repository lockfile integrity before extracting its bundle. Bundle SHA-256: `9a85a5aa81305f85e6546452fd2093a8a68932bed3cec4f6491e4d031a90bc95`. Local execution retains the existing memory and process guards; Anvil is stopped afterward.

This checks the individual function with genuine local RPC and ABI decoding. It does not execute the complete wiring verifier, a production endpoint, or a multichain deployment. The initial harness run exposed receipt availability timing; bounded receipt polling was added before the passing run.


### Required minter authority verification

Includes the verifier-only fix from PR #332 (`da429fa64932cf9250d2f5ce2e5b8433b6b0a973`). An unreadable minter authority now fails verification. The unused profile ABI entry and misleading header claim are removed: the current minter has no public profile getter, and profile-binding verification remains open.

Combined validation: 164/164 tests pass (124 deployment-runner, 25 finalization-function, 11 library-function and 4 complete-script minter tests). These use mocked boundaries. The separate real-ABI/local-Anvil finalization check passes again: 12 checks for genuine finalization; an unrelated successful transfer is rejected on four action-binding checks. Syntax passes. Local services were stopped afterward. Full multichain and production endpoint verification remain open.

From `solidity`, run `node --test test-deploy/sealed-wiring.test.cjs test-deploy/finalization-verifier.test.cjs test-deploy/library-verifier.test.cjs test-deploy/minter-verifier.test.cjs`. Local validation used serial execution and existing process and memory guards.


### Internal minter profile binding: bounded local evidence

The unmodified minter compiles with solc 0.8.30 and the locked OpenZeppelin 4.9.6 sources, with no compiler errors or warnings. `minter-binding-solc-input.json` preserves the compiler input (SHA-256 `ec413648faf0c6de9b96637a83d3d2ec46a2b71b2f407212bebf1851a10a9d03`). The compiler reports `CawProfile` at slot 1, offset 0, 20 bytes. Its ABI has no public profile getter.

`minter-binding-live.cjs` deploys that compiled minter on fresh local Anvil with a synthetic router and account addresses. Reading the compiler-derived slot at the creation block recovers the supplied profile address and distinguishes a different address. Calling `CawProfile()` reverts; the public authority getter returns the supplied authority. Existing resource guards were retained and the local chain stopped afterward.

Reproduce by compiling the preserved input with the pinned compiler, starting an unforked Anvil at localhost:18672, and passing the verified ethers UMD path and compiler output path to the script. This is storage-layout evidence for this exact build, not a production acceptance rule. The verifier still does not accept a profile binding from raw storage: code identity, chain identity and deployment provenance must be bound before that can be safe. It does not exercise minting or a real router.


### Constructor replay and runtime identity

The minter binding test now replays the exact compiled creation input at the preceding local block, derives the CREATE address from sender and nonce, and compares the replay result byte-for-byte with the deployed runtime at its creation block. Creation transaction input, sender and null target also match. The replay includes immutable values; no byte ranges are masked. The local result passed, alongside the existing storage/getter checks. Runtime Keccak: `0xf693be49cf57fdab3a92661319f8fcb102ad26d3cb964b0db9cbd58b3e1f6d7d`.

This remains bounded local-node evidence: it trusts RPC state and the preceding block, uses a synthetic router, and does not establish production chain finality or independent historical-state authenticity. No production verifier path changed. The first startup was stopped by the existing resource guard; a later resource check cleared the unchanged limit and the run passed.


### Negative constructor replay cases

Actual EVM replays establish five boundaries: changing the profile argument produces identical runtime; that changed argument is distinguishable in creation input; changing the immutable authority changes runtime; a router address without code causes replay to revert; and changing the creator nonce changes the predicted address. All assertions pass alongside the original local checks.

The first result is critical: matching runtime alone cannot authenticate a storage-only profile binding. Retain independent creation-input and storage checks. This evidence does not turn the local test into a production verifier, and RPC historical-state authenticity remains outside its scope.


### Complete unsealed verifier through local EVM RPC

`wiring-live.cjs` runs the complete verifier with real ethers ABI decoding and a local EVM response fixture. Matching wiring: 43 passed, 0 failed. Wrong minter authority and absent minter code both exit with failure. The three runs perform 96 eth_call requests.

This fixture installs synthetic response bytecode and storage through Anvil test methods; it does not deploy CAW or LayerZero contracts. All three role providers use one unforked local chain. It covers the unsealed testnet path only; finalization and mainnet library pinning are skipped by that path. Run with a fresh Anvil at localhost:18672 and the verified ethers UMD path as the first argument. The actual local run retained resource guards and stopped Anvil afterward.

During fixture development, the initial address range collided with a reserved precompile and returned empty ABI data; fixture addresses were moved out of that range. A subsequent console encoding problem was corrected by limiting the result output to summaries. The final guarded run passed. These were fixture failures, not protocol findings.


### Complete sealed verifier with actual finalization receipts

`wiring-sealed-live.cjs` deploys and finalizes three actual compiled PathwayExpanders on fresh local Anvil, then runs the complete verifier. Matching state: 79 passed, 0 failed. Replacing each role's finalization metadata with an unrelated successful transfer yields 74 passed, 4 failed for each of L1, L2 and L2b. Four runs perform 184 eth_call requests.

Other contracts remain synthetic EVM response fixtures; all roles share one local chain. This exercises the sealed testnet path, not mainnet library pinning, real endpoint behavior or actual cross-chain delivery. Run with the verified ethers UMD path and the compiler output from `integration-solc-input.json` as arguments, using a fresh Anvil at localhost:18672. Existing resource guards were retained; Anvil stopped afterward.

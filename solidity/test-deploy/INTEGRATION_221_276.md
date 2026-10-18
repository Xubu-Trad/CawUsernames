# sealed deployment and library pinning candidate

review candidate combining #221 at `9bfe9ea1e94af4e7ac7cee3ba38908b1fcb3d7a2` and #276 at `47dfc2cd18fa663c87d88cb8ea7afc85c44a41cf`.

two textual conflicts are resolved. PathwayExpander keeps BootstrapFinalized and both library-pinning events. the deployment verifier keeps both complete verification functions and invokes both from main. other changes are the automatic git merge result.

124 mocked deployment-runner checks pass. deploy.js and verify-deploy-wiring.js pass syntax checking. 11 additional tests execute the actual library-selection verification function with deterministic endpoint doubles: eight directed pathways, wrong libraries, inherited defaults, missing configuration, malformed default flags, RPC failure and non-mainnet skip behavior. these are not live endpoint checks or Solidity compilation.

the combined PathwayExpander compiled successfully with Solidity `0.8.30+commit.73712a01`, OpenZeppelin contracts 4.9.6, viaIR enabled, optimizer enabled/runs 1, and evmVersion cancun. compilation covered PathwayExpander and its Ownable/Context imports, not the whole repository. zero compiler errors; one warning suggests pure mutability for the intentionally reverting transferOwnership override. runtime size: 8,872 bytes.

compiler: `https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/windows-amd64/solc-windows-amd64-v0.8.30+commit.73712a01.exe`, SHA-256 `ccbd3ed44d5fbd26fe039702d403421f1212d2e8752e3cbe3bfd074986911586`. OpenZeppelin package integrity was checked against package-lock.json before reading the two source units.

the portable `integration-solc-input.json` contains all three source units and settings. run a verified compiler with `solc --standard-json < solidity/test-deploy/integration-solc-input.json > output.json`. require no severity=error diagnostics and inspect the resulting contract output. input SHA-256: `441c865397c45dfad7a25f4ae053a42dd34a8ec23de2f90065db7f74e589ed23`. runtime bytecode SHA-256: `52cb6b5670a61050bba5bd3f888f01415fc4db12cc4f25dcaa5d56919a7fd7f7`. compilation is not execution or an independent reproduction.

the `PinSealHarness.sol` constructor completed 16 assertions in a successful transaction on fresh, unforked Anvil 1.8.1 (chain 31337). it deploys the actual combined PathwayExpander and a synthetic endpoint. cases cover unconfigured and unauthorized calls, successful send/receive pins, idempotent repeats, rejected replacement, rejected ownership transfer, finalization, and rejected owner calls afterward. endpoint pins remain unchanged. deployed expander bytecode matched the compiled runtime hash above. gas used for the complete harness creation: 2,699,259.

reproduce by compiling `integration-runtime-input.json` with the same verified compiler and deploying its `PinSealHarness` creation bytecode on a fresh local chain. require receipt success, `checks() == 16`, and a runtime hash match for `expander()`. constructor assertion failure reverts creation. no account keys or live RPC are needed in the input. input SHA-256: `42b855c22521cb34f30bdd23f99e24bed9fa4cf23ea45852cd0768fcf41628db`. the fake endpoint does not enforce or model the full LayerZero protocol; this is an EVM lifecycle check of the expander, not cross-chain acceptance.

before integration acceptance: exercise real endpoint integration, execute the full verifier including false finalization proofs, and complete independent multi-chain deployment/recovery checks. #221's constructor-binding regression is included; earlier results against older combined heads do not establish these checks for this candidate. run the new dependency-free tests with `node --test solidity/test-deploy/library-verifier.test.cjs`.

this branch does not update either upstream pr head or establish release approval. pinning plus owner removal prevents later owner-driven library replacement for that sealed generation. replacement/migration remains a separate design and review decision.

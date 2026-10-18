# sealed deployment and library pinning candidate

review candidate combining #221 at `9bfe9ea1e94af4e7ac7cee3ba38908b1fcb3d7a2` and #276 at `47dfc2cd18fa663c87d88cb8ea7afc85c44a41cf`.

two textual conflicts are resolved. PathwayExpander keeps BootstrapFinalized and both library-pinning events. the deployment verifier keeps both complete verification functions and invokes both from main. other changes are the automatic git merge result.

124 mocked deployment-runner checks pass. deploy.js and verify-deploy-wiring.js pass syntax checking. 11 additional tests execute the actual library-selection verification function with deterministic endpoint doubles: eight directed pathways, wrong libraries, inherited defaults, missing configuration, malformed default flags, RPC failure and non-mainnet skip behavior. these are not live endpoint checks or Solidity compilation.

before integration acceptance: compile the combined contract, exercise library pinning transactions, execute the full verifier including false finalization proofs, and complete independent multi-chain deployment/recovery checks. #221's constructor-binding regression is included; earlier results against older combined heads do not establish these checks for this candidate. run the new dependency-free tests with `node --test solidity/test-deploy/library-verifier.test.cjs`.

this branch does not update either upstream pr head or establish release approval. pinning plus owner removal prevents later owner-driven library replacement for that sealed generation. replacement/migration remains a separate design and review decision.

# current testnet receipt recovery

status: open. this is a recovery inventory, not a creation manifest.

The addresses below come from committed deployment state at `97cd13f3a1423f702d411472fdd2b2a2e7bfbd59`. The state records a legacy `l2DeployBlock` of 45547765 but no creation receipts. A scoped history search for the Base CawActions address in `.deploy-state.json` identifies `2cb5e1326bfc2562bb9dd358914c5f1291fd37ea`; that commit records explorer verification claims, not creation transaction hashes. Those claims have not been independently verified in this recovery pass.

| deployment key | expected chain ID | committed address |
|---|---:|---|
| CawActions_L1 | 11155111 | `0xe33339b3D826E7fC61557D7e82A4348710790136` |
| CawActionsERC1271_L1 | 11155111 | `0x2418592Eb4bd5212b3c64408769f95F73dCb45c6` |
| CawActions_L2 | 84532 | `0x73246104f57001EDC6d0659Fa37Afb672a76E763` |
| CawActionsERC1271_L2 | 84532 | `0x78AB5d7be8Ba2BC722f58B862c16Ee77fEcbCF74` |
| CawActions_L2b | 421614 | `0x5D35790EE0E3f1641aea635C11882C4a9fca23a0` |
| CawActionsERC1271_L2b | 421614 | `0x5F41CB93b2a95aC6A77A4d73043dEB244EA3802F` |

## evidence needed

For each selected chain's contracts, recover the actual creation transaction hash, successful receipt with contract address and inclusion block/index, and corresponding canonical block hash. Verify using `verify-creation-receipt.js` against the expected chain/address, then review the public manifest. Never use the legacy block number as a substitute. Unrelated redeployments do not recover historical receipts.

Public read-only requests to the Base Sepolia Blockscout address API and the repository's default `https://sepolia.base.org` RPC returned HTTP 403 in this environment. Browser retrieval of the corresponding explorer pages was also unavailable. No creation hash or historical receipt was recovered. This is an access limitation here, not evidence that the contracts or receipts do not exist.

Builders can unblock recovery by sharing the public creation transaction hashes or a receipt manifest with reproducible read-only verification. Do not share wallet keys or credential-bearing RPC URLs. Fresh indexer installations remain gated until the selected deployment's required records can be checked. This inventory is not production readiness or proof of finality.

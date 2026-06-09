;; ⚠️ SUPERSEDED — LEGACY STACKS/CLARITY CONSOLE (2026-06-09)
;; These commands target the OLD Stacks multi-contract system (.router, .chess-token,
;; submit-move) from the original Chessify repo. Playchessify is Celo-only with off-chain
;; move relay + oracle settlement — there is no on-chain submit-move here. Kept for history
;; only. For current contract calls see celo-contracts/ and handover.md.

;; 1. Claim free CHESS tokens for two players
::set_tx_sender ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
(contract-call? .chess-token faucet-claim)

::set_tx_sender ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
(contract-call? .chess-token faucet-claim)

;; 2. Create a game (player 1)
::set_tx_sender ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
(contract-call? .router create-game u100000000)

;; 3. Join the game (player 2)
::set_tx_sender ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
(contract-call? .router join-game u0)

;; 4. Submit a move (player 1)
::set_tx_sender ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
(contract-call? .router submit-move u0 "e2e4")

;; 5. Check game state
(contract-call? .router get-game-info u0)
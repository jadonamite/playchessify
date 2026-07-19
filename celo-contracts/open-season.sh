#!/usr/bin/env bash
# Seed a concluded Weekly Grand Prix season into TournamentRewards.
#
# Usage:
#   ./open-season.sh <seasonId> <winner:amountUSD> [<winner:amountUSD> ...]
#
#   ./open-season.sh 1 0xAbc...:50 0xDef...:30 0x123...:20
#   ./open-season.sh 2 0xA:10 0xB:10 ... (any count / split)
#
# Pulls the exact pot in USDm from the owner wallet (DEPLOYER_PRIVATE_KEY in
# .env) in the openSeason tx; approve is set to the exact total first.
# Claim window: 30 days, after which unclaimed prizes can be swept back.
set -euo pipefail
cd "$(dirname "$0")"

RPC="${RPC_URL:-https://forno.celo.org}"
REWARDS="${REWARDS_ADDRESS:-0xd867C2467c41Ccbe315eF4fFa3B9eBFa0C2D8d24}"
USDM="0x765DE816845861e75A25fCA122bb6898B8B1282a"
CLAIM_WINDOW=$((30 * 24 * 3600))

[ $# -ge 2 ] || { echo "usage: $0 <seasonId> <winner:amountUSD> [...]"; exit 1; }
SEASON_ID="$1"; shift

set -a; source .env; set +a
OWNER=$(cast wallet address "$DEPLOYER_PRIVATE_KEY")

WINNERS=() AMOUNTS=() TOTAL_WEI=0
for pair in "$@"; do
  addr="${pair%%:*}"; usd="${pair##*:}"
  wei=$(cast to-wei "$usd" ether)
  WINNERS+=("$addr"); AMOUNTS+=("$wei")
  TOTAL_WEI=$(python3 -c "print($TOTAL_WEI + $wei)")
done

WINNERS_ARG="[$(IFS=,; echo "${WINNERS[*]}")]"
AMOUNTS_ARG="[$(IFS=,; echo "${AMOUNTS[*]}")]"

echo "Season S$SEASON_ID → ${#WINNERS[@]} winner(s), total $(cast from-wei "$TOTAL_WEI" ether) USDm"
echo "Owner:   $OWNER"
echo "Rewards: $REWARDS"

BAL=$(cast call "$USDM" "balanceOf(address)(uint256)" "$OWNER" --rpc-url "$RPC" | awk '{print $1}')
python3 -c "import sys; sys.exit(0 if $BAL >= $TOTAL_WEI else 1)" || {
  echo "ERROR: owner USDm balance $(cast from-wei "$BAL" ether) < pot. Fund $OWNER first."; exit 1; }

echo "→ approve exact pot"
cast send "$USDM" "approve(address,uint256)" "$REWARDS" "$TOTAL_WEI" \
  --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$RPC" >/dev/null

echo "→ openSeason"
cast send "$REWARDS" "openSeason(uint256,address,address[],uint256[],uint64)" \
  "$SEASON_ID" "$USDM" "$WINNERS_ARG" "$AMOUNTS_ARG" "$CLAIM_WINDOW" \
  --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$RPC" | grep -E "status|transactionHash"

echo "→ verify"
for i in "${!WINNERS[@]}"; do
  cast call "$REWARDS" "claimStatus(uint256,address)(uint256,bool,bool)" "$SEASON_ID" "${WINNERS[$i]}" --rpc-url "$RPC" \
    | head -1 | xargs -I{} echo "  ${WINNERS[$i]} → {}"
done
echo "Done. Winners can now claim in the lobby."

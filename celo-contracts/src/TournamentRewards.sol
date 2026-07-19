// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TournamentRewards — reusable prize-claim vault for Weekly Grand Prix seasons
/// @notice One deployment serves every season. After a season's board freezes, the
///         owner seeds it here with the winner whitelist and per-place amounts
///         (any count, any split — 3 winners at 50/30/20 or 10 at 10×10). Funding
///         is pulled in the same tx, so the vault only ever holds exactly what its
///         open seasons owe. Winners pull their own prize once; anyone else simply
///         has no allocation. Unclaimed prizes sweep back to the owner after the
///         season's claim deadline.
///
///         ERC2771Context: claims can arrive through the trusted forwarder, so a
///         winner on a zero-CELO wallet claims via a signed meta-tx (gas-sponsor
///         pays) — same rail as faucetClaim on PlaychessifyToken.
contract TournamentRewards is Ownable, ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    struct Season {
        address token;          // prize ERC20 (USDm today; per-season, not global)
        uint64  claimDeadline;  // after this the owner may sweep what's left
        uint128 funded;         // total pulled in at openSeason
        uint128 claimed;        // running total paid out to winners
        bool    swept;
    }

    mapping(uint256 => Season) public seasons;
    mapping(uint256 => mapping(address => uint256)) public allocation;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    /// @notice Highest season id seeded so far — what the app's claim card reads.
    uint256 public latestSeasonId;

    // ──────────────────────────────────────────────
    //  Events / Errors
    // ──────────────────────────────────────────────

    event SeasonOpened(uint256 indexed seasonId, address indexed token, uint256 total, uint256 winners, uint64 claimDeadline);
    event PrizeClaimed(uint256 indexed seasonId, address indexed winner, uint256 amount);
    event SeasonSwept(uint256 indexed seasonId, uint256 remainder);

    error SeasonAlreadyOpen();
    error SeasonNotOpen();
    error BadInput();
    error NothingToClaim();
    error AlreadyClaimed();
    error SeasonSweptOut();
    error DeadlineNotReached();

    constructor(address trustedForwarder)
        Ownable(msg.sender)
        ERC2771Context(trustedForwarder)
    {}

    // ──────────────────────────────────────────────
    //  Owner: seed a concluded season
    // ──────────────────────────────────────────────

    /// @notice Whitelist a season's winners and fund their pot in one tx.
    /// @param seasonId     Numeric season index (S4 → 4). Each id seeds once.
    /// @param token        Prize ERC20 pulled from the owner wallet.
    /// @param winners      Winner addresses, any length ≥ 1.
    /// @param amounts      Prize per winner, parallel to `winners`, in token units.
    /// @param claimWindow  Seconds winners have to claim before sweep unlocks.
    function openSeason(
        uint256 seasonId,
        address token,
        address[] calldata winners,
        uint256[] calldata amounts,
        uint64 claimWindow
    ) external onlyOwner {
        if (seasons[seasonId].token != address(0)) revert SeasonAlreadyOpen();
        if (winners.length == 0 || winners.length != amounts.length || token == address(0) || claimWindow == 0) {
            revert BadInput();
        }

        uint256 total;
        for (uint256 i = 0; i < winners.length; i++) {
            address w = winners[i];
            uint256 a = amounts[i];
            // Duplicate winners would let one claim erase the other's prize.
            if (w == address(0) || a == 0 || allocation[seasonId][w] != 0) revert BadInput();
            allocation[seasonId][w] = a;
            total += a;
        }

        seasons[seasonId] = Season({
            token: token,
            claimDeadline: uint64(block.timestamp) + claimWindow,
            funded: uint128(total),
            claimed: 0,
            swept: false
        });
        if (seasonId > latestSeasonId) latestSeasonId = seasonId;

        IERC20(token).safeTransferFrom(msg.sender, address(this), total);

        emit SeasonOpened(seasonId, token, total, winners.length, seasons[seasonId].claimDeadline);
    }

    // ──────────────────────────────────────────────
    //  Winners: claim
    // ──────────────────────────────────────────────

    /// @notice Pull your prize for a season. Claimable until the owner sweeps —
    ///         the deadline gates the sweep, it doesn't hard-stop a late winner.
    function claim(uint256 seasonId) external nonReentrant {
        Season storage s = seasons[seasonId];
        if (s.token == address(0)) revert SeasonNotOpen();
        if (s.swept) revert SeasonSweptOut();

        address winner = _msgSender();
        uint256 amount = allocation[seasonId][winner];
        if (amount == 0) revert NothingToClaim();
        if (hasClaimed[seasonId][winner]) revert AlreadyClaimed();

        hasClaimed[seasonId][winner] = true;
        s.claimed += uint128(amount);

        IERC20(s.token).safeTransfer(winner, amount);

        emit PrizeClaimed(seasonId, winner, amount);
    }

    // ──────────────────────────────────────────────
    //  Owner: reclaim unclaimed prizes
    // ──────────────────────────────────────────────

    /// @notice After the claim deadline, return whatever winners never collected.
    function sweep(uint256 seasonId) external onlyOwner {
        Season storage s = seasons[seasonId];
        if (s.token == address(0)) revert SeasonNotOpen();
        if (s.swept) revert SeasonSweptOut();
        if (block.timestamp <= s.claimDeadline) revert DeadlineNotReached();

        s.swept = true;
        uint256 remainder = s.funded - s.claimed;
        if (remainder > 0) IERC20(s.token).safeTransfer(owner(), remainder);

        emit SeasonSwept(seasonId, remainder);
    }

    // ──────────────────────────────────────────────
    //  Views (what the claim card reads)
    // ──────────────────────────────────────────────

    /// @return amount   the caller's prize for the season (0 → not a winner)
    /// @return claimed_ whether it was already collected
    /// @return open     season is seeded and not swept (claim would succeed)
    function claimStatus(uint256 seasonId, address who)
        external
        view
        returns (uint256 amount, bool claimed_, bool open)
    {
        Season storage s = seasons[seasonId];
        return (allocation[seasonId][who], hasClaimed[seasonId][who], s.token != address(0) && !s.swept);
    }

    // ──────────────────────────────────────────────
    //  ERC2771 plumbing
    // ──────────────────────────────────────────────

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}

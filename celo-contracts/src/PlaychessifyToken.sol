// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/// @title PlaychessifyToken — Free-to-play ERC20 for Chessify Protocol on Celo (v2)
/// @notice Faucet-based token. Users claim free CHESS tokens before playing.
///         Zero financial risk. Deployed first, then PlaychessifyEngine receives this address.
///
/// v2 changes over the original mainnet deployment:
///   - ERC20Permit: gasless approvals — PlaychessifyEngine's *WithPermit functions fold the
///     wager approval into a signature instead of a separate approve() transaction.
///   - ERC2771Context: faucetClaim can arrive through the trusted forwarder, so an
///     external EOA with zero CELO claims via a signed meta-tx (gas-sponsor pays).
///   - Faucet cooldown measured in seconds (block.timestamp), not block numbers —
///     the old 17,280-block constant assumed 5s blocks and became ~4.8h after the
///     Celo L2 migration moved mainnet to 1s blocks.
contract PlaychessifyToken is ERC20, ERC20Permit, Ownable, ERC2771Context {

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    uint8   private constant _DECIMALS      = 6;
    uint256 public  constant FAUCET_AMOUNT   = 1_000 * 10 ** _DECIMALS;   // 1,000 CHESS per claim
    uint256 public  constant FAUCET_COOLDOWN = 1 days;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    bool public mintEnabled = true;

    /// @notice Server wallet permitted to provision CHESS to gasless (MiniPay) wallets,
    ///         so a 0-balance EOA never has to spend gas on faucetClaim. Mints a valueless
    ///         faucet token only — it can never touch game escrow.
    address public minter;

    /// @notice Timestamp of each address's last faucet claim
    mapping(address => uint256) public lastFaucetClaim;

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error MintDisabled();
    error FaucetCooldown(uint256 secondsRemaining);
    error InvalidAmount();
    error NotMinter();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event FaucetClaimed(address indexed player, uint256 amount);
    event MintToggled(bool enabled);
    event MinterUpdated(address indexed minter);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyMinter() {
        if (msg.sender != minter) revert NotMinter();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address trustedForwarder)
        ERC20("Chess Token", "CHESS")
        ERC20Permit("Chess Token")
        Ownable(msg.sender)
        ERC2771Context(trustedForwarder)
    {}

    // ──────────────────────────────────────────────
    //  ERC20 Overrides
    // ──────────────────────────────────────────────

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    // ──────────────────────────────────────────────
    //  Faucet — Anyone claims 1,000 CHESS per day
    // ──────────────────────────────────────────────

    /// @notice Claim free CHESS tokens. One claim per 24 hours.
    ///         Forwarder-aware: works as a direct call or a meta-tx.
    function faucetClaim() external {
        if (!mintEnabled) revert MintDisabled();

        address claimer   = _msgSender();
        uint256 lastClaim = lastFaucetClaim[claimer];
        uint256 elapsed   = block.timestamp - lastClaim;

        if (lastClaim != 0 && elapsed < FAUCET_COOLDOWN) {
            revert FaucetCooldown(FAUCET_COOLDOWN - elapsed);
        }

        lastFaucetClaim[claimer] = block.timestamp;
        _mint(claimer, FAUCET_AMOUNT);

        emit FaucetClaimed(claimer, FAUCET_AMOUNT);
    }

    /// @notice Check how many seconds until next faucet claim is available
    function faucetCooldownRemaining(address account) external view returns (uint256) {
        uint256 lastClaim = lastFaucetClaim[account];
        if (lastClaim == 0) return 0;

        uint256 nextEligible = lastClaim + FAUCET_COOLDOWN;
        if (block.timestamp >= nextEligible) return 0;

        return nextEligible - block.timestamp;
    }

    // ──────────────────────────────────────────────
    //  Owner Mint — Seed tournaments, rewards, v1 balance migration
    // ──────────────────────────────────────────────

    /// @notice Owner mints tokens to a recipient (for tournaments, rewards, etc.)
    function mint(address to, uint256 amount) external onlyOwner {
        if (!mintEnabled) revert MintDisabled();
        if (amount == 0) revert InvalidAmount();
        _mint(to, amount);
    }

    /// @notice Batch mint to multiple recipients. Also used once at launch to
    ///         re-mint the v1 token's balance snapshot onto this contract.
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        if (!mintEnabled) revert MintDisabled();
        require(recipients.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }

    // ──────────────────────────────────────────────
    //  Minter — Server provisions CHESS to gasless wallets
    // ──────────────────────────────────────────────

    /// @notice Set the minter (server wallet that provisions CHESS to MiniPay users).
    function setMinter(address newMinter) external onlyOwner {
        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    /// @notice Minter provisions CHESS to a recipient (e.g. a fresh MiniPay wallet)
    ///         without that wallet spending gas on faucetClaim.
    function mintTo(address to, uint256 amount) external onlyMinter {
        if (!mintEnabled) revert MintDisabled();
        if (amount == 0) revert InvalidAmount();
        _mint(to, amount);
    }

    // ──────────────────────────────────────────────
    //  Owner Controls
    // ──────────────────────────────────────────────

    /// @notice Toggle minting on/off
    function setMintEnabled(bool enabled) external onlyOwner {
        mintEnabled = enabled;
        emit MintToggled(enabled);
    }

    // ──────────────────────────────────────────────
    //  ERC2771 plumbing — forwarder-aware sender resolution
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

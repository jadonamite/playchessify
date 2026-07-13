// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/// @title PlaychessifyEngine — On-chain chess protocol for Chessify on Celo (v2)
/// @notice Handles game lifecycle, wagers (CHESS token), escrow, and player stats.
///         Chess rules are validated server-side: the oracle replays the authoritative
///         move list (Redis relay) with chess.js and settles only terminal positions.
///
/// v2 changes over the original mainnet deployment:
///   - ERC2771Context: every player action (create/join/resign/draw/cancel/reclaim)
///     can arrive through the trusted forwarder as a signed meta-tx, so external
///     EOAs play truly gasless (the gas-sponsor wallet executes and pays).
///   - createGameWithPermit / joinGameWithPermit: the CHESS wager approval rides a
///     permit signature — no separate approve() transaction.
///   - Timestamps, not block numbers: createdAt/joinedAt are unix seconds. The old
///     block-number expiry assumed 5s blocks and drifted to ~4.8h after the Celo L2
///     migration to 1s blocks.
///   - JOIN_WINDOW: a Waiting game is joinable for only 10 minutes. Prevents a
///     joiner farming wins from long-abandoned lobbies; closeStaleGame() lets
///     anyone sweep an expired lobby (refund can only ever go to the creator).
///   - voidGame(): oracle voids a joined game in which no move was ever made —
///     both wagers refunded, no winner, no Elo. The joiner of an absent creator
///     gets their money back, not a free win.
///   - importStats(): one-time owner batch that seeds v1 player stats (Elo/W/L/D)
///     so the redeploy doesn't wipe player history. Locks permanently.
///   - gameNonce starts at 1 (the relay treats id 0 as invalid).
///
/// DEPLOYMENT ORDER:
///   1. Deploy ERC2771Forwarder
///   2. Deploy PlaychessifyToken(forwarder)
///   3. Deploy PlaychessifyEngine(chessTokenAddress, forwarder)
///   4. Owner calls setOracle(oracleAddress)
///   5. Owner seeds v1 stats via importStats(...), then lockStatsSeed()
///   6. Players approve (or permit) PlaychessifyToken for wagers
///
/// TRUST MODEL:
///   - createGame/joinGame/resign/proposeDraw/acceptDraw/cancelGame are
///     _msgSender()-based and self-custodial — identical for direct EOA calls,
///     ERC-4337 smart accounts, and forwarder meta-txs; a caller can only ever
///     hurt themselves. The forwarder is OpenZeppelin's audited ERC2771Forwarder:
///     it verifies the player's EIP-712 signature before relaying, so the
///     gas-sponsor executing it gains no authority over anyone's game.
///   - settleGame() is the ONLY way to declare a winner, and only the oracle may
///     call it. The oracle holds the same trust the move-relay already holds: it
///     independently replays the Redis move list (never trusting the client),
///     settles only terminal positions, and cross-checks the on-chain players.
///     It is a dedicated low-value hot key, rotatable by the owner via setOracle.
///     Funds can only ever go to white / black / split — never to the oracle.
///   - voidGame() lets the oracle refund (never redirect) a no-show game, and only
///     after VOID_MIN_IDLE has passed since the join.
///   - reclaimExpired() is an oracle-independent backstop: if the oracle is down,
///     either participant can recover the escrow after EXPIRY_TIME (split refund).

contract PlaychessifyEngine is ERC2771Context, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════
    //  Types
    // ══════════════════════════════════════════════

    enum GameStatus {
        Waiting,    // 0 — created, waiting for opponent
        Active,     // 1 — both players joined, game in progress
        Finished,   // 2 — game ended (win/loss)
        Cancelled,  // 3 — creator cancelled / lobby expired / voided / escrow reclaimed
        Draw        // 4 — game ended in draw
    }

    enum GameResult {
        None,       // 0 — game still in progress
        WhiteWins,  // 1
        BlackWins,  // 2
        DrawResult, // 3 — stalemate, agreement, repetition, etc.
        Cancelled   // 4
    }

    struct Game {
        address white;
        address black;
        uint256 wager;           // 0 = free game
        GameStatus status;
        GameResult result;
        uint256 createdAt;       // unix timestamp (seconds)
        uint256 joinedAt;        // unix timestamp (seconds); 0 until joined
        address drawProposer;    // who proposed draw (address(0) if none)
    }

    struct PlayerStats {
        uint256 wins;
        uint256 losses;
        uint256 draws;
        uint256 rating;          // Elo rating (starts at 1200)
        uint256 gamesPlayed;
    }

    // ══════════════════════════════════════════════
    //  State
    // ══════════════════════════════════════════════

    IERC20 public immutable chessToken;

    /// @notice Settlement oracle — the only address allowed to declare a winner/draw
    ///         or void a no-show game.
    address public oracle;

    uint256 public gameNonce = 1;                       // auto-incrementing game ID (0 reserved)
    uint256 public constant JOIN_WINDOW   = 10 minutes; // Waiting game joinable for this long
    uint256 public constant VOID_MIN_IDLE = 10 minutes; // oracle may void only after this idle
    uint256 public constant EXPIRY_TIME   = 1 days;     // reclaim backstop, from join
    uint256 public constant STARTING_ELO  = 1200;
    uint256 public constant K_FACTOR      = 32;
    uint256 public constant MIN_RATING    = 100;

    /// @notice Once true, importStats is disabled forever.
    bool public statsSeedLocked;

    mapping(uint256 => Game) public games;              // gameId → Game
    mapping(address => PlayerStats) public playerStats;  // player → stats

    // ══════════════════════════════════════════════
    //  Errors
    // ══════════════════════════════════════════════

    error GameNotFound();
    error NotYourGame();
    error GameNotWaiting();
    error GameNotActive();
    error CannotJoinOwnGame();
    error JoinWindowClosed();
    error JoinWindowStillOpen();
    error NoDrawProposed();
    error AlreadyProposedDraw();
    error CannotAcceptOwnDraw();
    error NotOracle();
    error InvalidResult();
    error NotExpired();
    error TooEarlyToVoid();
    error StatsSeedIsLocked();
    error LengthMismatch();

    // ══════════════════════════════════════════════
    //  Events
    // ══════════════════════════════════════════════

    event GameCreated(uint256 indexed gameId, address indexed white, uint256 wager);
    event GameJoined(uint256 indexed gameId, address indexed black);
    event GameResigned(uint256 indexed gameId, address indexed loser, address indexed winner);
    event DrawProposed(uint256 indexed gameId, address indexed proposer);
    event DrawAccepted(uint256 indexed gameId);
    event GameSettled(uint256 indexed gameId, GameResult result, address winner);
    event GameCancelled(uint256 indexed gameId, address indexed creator);
    event StaleGameClosed(uint256 indexed gameId, address indexed by);
    event GameVoided(uint256 indexed gameId);
    event WagerReclaimed(uint256 indexed gameId, address indexed by);
    event OracleUpdated(address indexed oracle);
    event StatsImported(uint256 count);
    event StatsSeedLocked();

    // ══════════════════════════════════════════════
    //  Modifiers
    // ══════════════════════════════════════════════

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    // ══════════════════════════════════════════════
    //  Constructor
    // ══════════════════════════════════════════════

    /// @param _chessToken Address of deployed PlaychessifyToken contract
    /// @param trustedForwarder OpenZeppelin ERC2771Forwarder for gasless meta-txs
    constructor(address _chessToken, address trustedForwarder)
        ERC2771Context(trustedForwarder)
        Ownable(msg.sender)
    {
        chessToken = IERC20(_chessToken);
    }

    // ══════════════════════════════════════════════
    //  Game Lifecycle
    // ══════════════════════════════════════════════

    /// @notice Create a new game. Pass wager = 0 for free game.
    ///         If wagering, caller must have approved this contract to spend CHESS tokens
    ///         (or use createGameWithPermit).
    function createGame(uint256 wager) external nonReentrant returns (uint256 gameId) {
        return _createGame(_msgSender(), wager);
    }

    /// @notice Create a wagered game with a permit signature instead of a prior
    ///         approve() transaction. The permit is best-effort: if it reverts
    ///         (e.g. front-run by a griefer), the transferFrom still succeeds as
    ///         long as the allowance is in place.
    function createGameWithPermit(
        uint256 wager,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant returns (uint256 gameId) {
        address player = _msgSender();
        _applyPermit(player, wager, deadline, v, r, s);
        return _createGame(player, wager);
    }

    /// @notice Join an open game. Wager is automatically matched. Reverts once the
    ///         lobby is older than JOIN_WINDOW — stale lobbies can't be joined.
    function joinGame(uint256 gameId) external nonReentrant {
        _joinGame(_msgSender(), gameId);
    }

    /// @notice Join with a permit signature covering the matched wager.
    function joinGameWithPermit(
        uint256 gameId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        address player = _msgSender();
        Game storage game = games[gameId];
        if (game.white == address(0)) revert GameNotFound();
        _applyPermit(player, game.wager, deadline, v, r, s);
        _joinGame(player, gameId);
    }

    /// @notice Resign — caller loses, opponent wins automatically.
    ///         "You can only hurt yourself" — no one can claim they won.
    function resign(uint256 gameId) external nonReentrant {
        address player = _msgSender();
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (player != game.white && player != game.black) revert NotYourGame();

        address winner = (player == game.white) ? game.black : game.white;
        GameResult result = (winner == game.white) ? GameResult.WhiteWins : GameResult.BlackWins;

        _endGame(game, GameStatus.Finished, result, winner, player);

        emit GameResigned(gameId, player, winner);
    }

    /// @notice Propose a draw (stalemate, agreement, repetition, 50-move rule, etc.)
    function proposeDraw(uint256 gameId) external {
        address player = _msgSender();
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (player != game.white && player != game.black) revert NotYourGame();
        if (game.drawProposer == player) revert AlreadyProposedDraw();

        game.drawProposer = player;

        emit DrawProposed(gameId, player);
    }

    /// @notice Accept a pending draw proposal. Both players get their wager back.
    function acceptDraw(uint256 gameId) external nonReentrant {
        address player = _msgSender();
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (player != game.white && player != game.black) revert NotYourGame();
        if (game.drawProposer == address(0)) revert NoDrawProposed();
        if (game.drawProposer == player) revert CannotAcceptOwnDraw();

        _endDraw(game);

        emit DrawAccepted(gameId);
    }

    /// @notice Settle a game to its terminal result. ORACLE ONLY.
    ///         The oracle replays the authoritative move list off-chain and submits the
    ///         result here. Idempotent: a non-Active game reverts, so either client may
    ///         safely trigger settlement.
    /// @param result Must be WhiteWins, BlackWins, or DrawResult.
    function settleGame(uint256 gameId, GameResult result) external onlyOracle nonReentrant {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();

        if (result == GameResult.WhiteWins || result == GameResult.BlackWins) {
            address winner = (result == GameResult.WhiteWins) ? game.white : game.black;
            address loser  = (result == GameResult.WhiteWins) ? game.black : game.white;
            _endGame(game, GameStatus.Finished, result, winner, loser);
            emit GameSettled(gameId, result, winner);
        } else if (result == GameResult.DrawResult) {
            _endDraw(game);
            emit GameSettled(gameId, result, address(0));
        } else {
            revert InvalidResult();
        }
    }

    /// @notice Void a joined game in which no move was ever made. ORACLE ONLY.
    ///         Both wagers are refunded; no winner, no stats, no Elo — a joiner of
    ///         an absent creator gets their money back, never a free win. Allowed
    ///         only after VOID_MIN_IDLE since the join, and funds can only ever
    ///         return to the two participants.
    function voidGame(uint256 gameId) external onlyOracle nonReentrant {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (block.timestamp - game.joinedAt < VOID_MIN_IDLE) revert TooEarlyToVoid();

        game.status = GameStatus.Cancelled;
        game.result = GameResult.Cancelled;

        if (game.wager > 0) {
            chessToken.safeTransfer(game.white, game.wager);
            chessToken.safeTransfer(game.black, game.wager);
        }

        emit GameVoided(gameId);
    }

    /// @notice Cancel a game that hasn't started yet. Only the creator can cancel.
    function cancelGame(uint256 gameId) external nonReentrant {
        address player = _msgSender();
        Game storage game = games[gameId];
        if (game.status != GameStatus.Waiting) revert GameNotWaiting();
        if (player != game.white) revert NotYourGame();

        game.status = GameStatus.Cancelled;
        game.result = GameResult.Cancelled;

        // Refund creator's wager
        if (game.wager > 0) {
            chessToken.safeTransfer(game.white, game.wager);
        }

        emit GameCancelled(gameId, player);
    }

    /// @notice Close a Waiting lobby whose join window has expired. Callable by
    ///         ANYONE (typically the settlement cron) — the refund can only ever
    ///         go to the creator, so an arbitrary caller can't gain from it.
    function closeStaleGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        if (game.white == address(0)) revert GameNotFound();
        if (game.status != GameStatus.Waiting) revert GameNotWaiting();
        if (block.timestamp - game.createdAt <= JOIN_WINDOW) revert JoinWindowStillOpen();

        game.status = GameStatus.Cancelled;
        game.result = GameResult.Cancelled;

        if (game.wager > 0) {
            chessToken.safeTransfer(game.white, game.wager);
        }

        emit StaleGameClosed(gameId, _msgSender());
    }

    /// @notice Oracle-independent backstop: after EXPIRY_TIME with the game still Active,
    ///         either participant reclaims the escrow (split refund). Prevents permanently
    ///         locked funds if the oracle is unavailable. The first call settles both sides.
    function reclaimExpired(uint256 gameId) external nonReentrant {
        address player = _msgSender();
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (player != game.white && player != game.black) revert NotYourGame();
        if (block.timestamp - game.joinedAt < EXPIRY_TIME) revert NotExpired();

        game.status = GameStatus.Cancelled;
        game.result = GameResult.Cancelled;

        if (game.wager > 0) {
            chessToken.safeTransfer(game.white, game.wager);
            chessToken.safeTransfer(game.black, game.wager);
        }

        emit WagerReclaimed(gameId, player);
    }

    // ══════════════════════════════════════════════
    //  Read Functions
    // ══════════════════════════════════════════════

    /// @notice Get full game data
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    /// @notice Get a player's stats
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    /// @notice Total number of games created (ids start at 1).
    function totalGames() external view returns (uint256) {
        return gameNonce - 1;
    }

    /// @notice Whether a Waiting game can still be joined.
    function canJoin(uint256 gameId) external view returns (bool) {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Waiting) return false;
        return block.timestamp - game.createdAt <= JOIN_WINDOW;
    }

    /// @notice Whether a game's escrow is reclaimable right now (expiry backstop reached).
    function canReclaim(uint256 gameId) external view returns (bool) {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) return false;
        return block.timestamp - game.joinedAt >= EXPIRY_TIME;
    }

    // ══════════════════════════════════════════════
    //  Owner Admin
    // ══════════════════════════════════════════════

    /// @notice Set the settlement oracle (rotatable for key compromise / rotation).
    function setOracle(address newOracle) external onlyOwner {
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    /// @notice One-time migration: seed player stats snapshotted from the v1
    ///         contract so the redeploy doesn't wipe Elo/history. Batchable
    ///         (call repeatedly for large player sets), then lock forever with
    ///         lockStatsSeed(). Overwrites whatever is stored — run pre-launch only.
    function importStats(address[] calldata players, PlayerStats[] calldata stats) external onlyOwner {
        if (statsSeedLocked) revert StatsSeedIsLocked();
        if (players.length != stats.length) revert LengthMismatch();

        for (uint256 i = 0; i < players.length; i++) {
            playerStats[players[i]] = stats[i];
        }

        emit StatsImported(players.length);
    }

    /// @notice Permanently disable importStats. Call once seeding is verified.
    function lockStatsSeed() external onlyOwner {
        statsSeedLocked = true;
        emit StatsSeedLocked();
    }

    // ══════════════════════════════════════════════
    //  Internal — Lifecycle
    // ══════════════════════════════════════════════

    /// @dev Shared create path for the plain and permit variants.
    function _createGame(address player, uint256 wager) internal returns (uint256 gameId) {
        gameId = gameNonce++;

        // Lock wager if not free
        if (wager > 0) {
            chessToken.safeTransferFrom(player, address(this), wager);
        }

        // Initialize player stats if first game
        _initPlayerIfNeeded(player);

        games[gameId] = Game({
            white: player,
            black: address(0),
            wager: wager,
            status: GameStatus.Waiting,
            result: GameResult.None,
            createdAt: block.timestamp,
            joinedAt: 0,
            drawProposer: address(0)
        });

        emit GameCreated(gameId, player, wager);
    }

    /// @dev Shared join path for the plain and permit variants.
    function _joinGame(address player, uint256 gameId) internal {
        Game storage game = games[gameId];
        if (game.white == address(0)) revert GameNotFound();
        if (game.status != GameStatus.Waiting) revert GameNotWaiting();
        if (player == game.white) revert CannotJoinOwnGame();
        if (block.timestamp - game.createdAt > JOIN_WINDOW) revert JoinWindowClosed();

        // Lock matching wager
        if (game.wager > 0) {
            chessToken.safeTransferFrom(player, address(this), game.wager);
        }

        // Initialize player stats if first game
        _initPlayerIfNeeded(player);

        game.black = player;
        game.status = GameStatus.Active;
        game.joinedAt = block.timestamp;

        emit GameJoined(gameId, player);
    }

    /// @dev Best-effort permit: tolerate a revert (permit front-running is a known
    ///      griefing vector) — the subsequent transferFrom is the real gate.
    function _applyPermit(
        address player,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        if (amount == 0) return;
        try IERC20Permit(address(chessToken)).permit(player, address(this), amount, deadline, v, r, s) {} catch {}
    }

    // ══════════════════════════════════════════════
    //  Internal — Game End + Elo
    // ══════════════════════════════════════════════

    /// @dev End a game with a winner and loser. Transfers pot + updates Elo.
    function _endGame(
        Game storage game,
        GameStatus status,
        GameResult result,
        address winner,
        address loser
    ) internal {
        game.status = status;
        game.result = result;

        // Transfer total pot to winner
        uint256 totalPot = game.wager * 2;
        if (totalPot > 0) {
            chessToken.safeTransfer(winner, totalPot);
        }

        // Update stats
        playerStats[winner].wins++;
        playerStats[winner].gamesPlayed++;
        playerStats[loser].losses++;
        playerStats[loser].gamesPlayed++;

        // Update Elo ratings
        _updateElo(winner, loser);
    }

    /// @dev End a game as a draw — refund both wagers and update draw stats.
    ///      Shared by acceptDraw (player agreement) and settleGame (oracle-detected draw).
    function _endDraw(Game storage game) internal {
        game.status = GameStatus.Draw;
        game.result = GameResult.DrawResult;

        // Refund both players
        if (game.wager > 0) {
            chessToken.safeTransfer(game.white, game.wager);
            chessToken.safeTransfer(game.black, game.wager);
        }

        // Update stats
        playerStats[game.white].draws++;
        playerStats[game.white].gamesPlayed++;
        playerStats[game.black].draws++;
        playerStats[game.black].gamesPlayed++;
    }

    /// @dev Simplified Elo calculation using integer math.
    ///      Underdog wins = bigger gain. Favorite wins = smaller gain.
    function _updateElo(address winner, address loser) internal {
        uint256 winnerRating = playerStats[winner].rating;
        uint256 loserRating  = playerStats[loser].rating;

        uint256 diff;
        uint256 winnerChange;
        uint256 loserChange;

        if (winnerRating >= loserRating) {
            // Winner was favored — smaller gain
            diff = winnerRating - loserRating;
            if (diff > 400) diff = 400;
            winnerChange = K_FACTOR * (400 - diff) / 800;
            loserChange  = K_FACTOR * (400 + diff) / 800;
        } else {
            // Winner was underdog — bigger gain
            diff = loserRating - winnerRating;
            if (diff > 400) diff = 400;
            winnerChange = K_FACTOR * (400 + diff) / 800;
            loserChange  = K_FACTOR * (400 - diff) / 800;
        }

        // Minimum change of 1
        if (winnerChange == 0) winnerChange = 1;
        if (loserChange == 0) loserChange = 1;

        playerStats[winner].rating += winnerChange;

        if (playerStats[loser].rating > loserChange + MIN_RATING) {
            playerStats[loser].rating -= loserChange;
        } else {
            playerStats[loser].rating = MIN_RATING;
        }
    }

    /// @dev Initialize a player's stats if this is their first game
    function _initPlayerIfNeeded(address player) internal {
        if (playerStats[player].rating == 0) {
            playerStats[player].rating = STARTING_ELO;
        }
    }

    // ══════════════════════════════════════════════
    //  ERC2771 plumbing — forwarder-aware sender resolution
    // ══════════════════════════════════════════════

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

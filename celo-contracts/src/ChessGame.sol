// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ChessGame — On-chain chess protocol for Chessify on Celo
/// @notice Handles game lifecycle, wagers (CHESS token), escrow, and player stats.
///         Chess rules are validated server-side: the oracle replays the authoritative
///         move list (Redis relay) with chess.js and settles only terminal positions.
///
/// DEPLOYMENT ORDER:
///   1. Deploy ChessToken
///   2. Deploy ChessGame(chessTokenAddress)
///   3. Owner calls setOracle(oracleAddress)
///   4. Players call ChessToken.approve(chessGameAddress, amount) before wagering
///
/// TRUST MODEL:
///   - createGame/joinGame/resign/proposeDraw/acceptDraw/cancelGame are msg.sender-based
///     and self-custodial — they work identically for EOAs and ERC-4337 smart accounts,
///     and a caller can only ever hurt themselves.
///   - settleGame() is the ONLY way to declare a winner, and only the oracle may call it.
///     The oracle holds the same trust the move-relay already holds: it independently
///     replays the Redis move list (never trusting the client), settles only terminal
///     positions, and cross-checks the on-chain players. It is a dedicated low-value hot
///     key, rotatable by the owner via setOracle. Funds can only ever go to white / black
///     / split — never to the oracle.
///   - reclaimExpired() is an oracle-independent backstop: if the oracle is down, either
///     participant can recover the escrow after EXPIRY_BLOCKS (split refund).

contract ChessGame is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════
    //  Types
    // ══════════════════════════════════════════════

    enum GameStatus {
        Waiting,    // 0 — created, waiting for opponent
        Active,     // 1 — both players joined, game in progress
        Finished,   // 2 — game ended (win/loss)
        Cancelled,  // 3 — creator cancelled before join, or expired escrow reclaimed
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
        uint256 createdAt;       // block number
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

    /// @notice Settlement oracle — the only address allowed to declare a winner/draw.
    address public oracle;

    uint256 public gameNonce;                           // auto-incrementing game ID
    uint256 public constant EXPIRY_BLOCKS = 17_280;     // ~1 day on Celo (5s blocks) — reclaim backstop
    uint256 public constant STARTING_ELO = 1200;
    uint256 public constant K_FACTOR = 32;
    uint256 public constant MIN_RATING = 100;

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
    error NoDrawProposed();
    error AlreadyProposedDraw();
    error CannotAcceptOwnDraw();
    error NotOracle();
    error InvalidResult();
    error NotExpired();

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
    event WagerReclaimed(uint256 indexed gameId, address indexed by);
    event OracleUpdated(address indexed oracle);

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

    /// @param _chessToken Address of deployed ChessToken contract
    constructor(address _chessToken) Ownable(msg.sender) {
        chessToken = IERC20(_chessToken);
    }

    // ══════════════════════════════════════════════
    //  Game Lifecycle
    // ══════════════════════════════════════════════

    /// @notice Create a new game. Pass wager = 0 for free game.
    ///         If wagering, caller must have approved this contract to spend CHESS tokens.
    function createGame(uint256 wager) external nonReentrant returns (uint256 gameId) {
        gameId = gameNonce++;

        // Lock wager if not free
        if (wager > 0) {
            chessToken.safeTransferFrom(msg.sender, address(this), wager);
        }

        // Initialize player stats if first game
        _initPlayerIfNeeded(msg.sender);

        games[gameId] = Game({
            white: msg.sender,
            black: address(0),
            wager: wager,
            status: GameStatus.Waiting,
            result: GameResult.None,
            createdAt: block.number,
            drawProposer: address(0)
        });

        emit GameCreated(gameId, msg.sender, wager);
    }

    /// @notice Join an open game. Wager is automatically matched.
    function joinGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        if (game.white == address(0)) revert GameNotFound();
        if (game.status != GameStatus.Waiting) revert GameNotWaiting();
        if (msg.sender == game.white) revert CannotJoinOwnGame();

        // Lock matching wager
        if (game.wager > 0) {
            chessToken.safeTransferFrom(msg.sender, address(this), game.wager);
        }

        // Initialize player stats if first game
        _initPlayerIfNeeded(msg.sender);

        game.black = msg.sender;
        game.status = GameStatus.Active;

        emit GameJoined(gameId, msg.sender);
    }

    /// @notice Resign — caller loses, opponent wins automatically.
    ///         "You can only hurt yourself" — no one can claim they won.
    function resign(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (msg.sender != game.white && msg.sender != game.black) revert NotYourGame();

        address winner = (msg.sender == game.white) ? game.black : game.white;
        GameResult result = (winner == game.white) ? GameResult.WhiteWins : GameResult.BlackWins;

        _endGame(game, GameStatus.Finished, result, winner, msg.sender);

        emit GameResigned(gameId, msg.sender, winner);
    }

    /// @notice Propose a draw (stalemate, agreement, repetition, 50-move rule, etc.)
    function proposeDraw(uint256 gameId) external {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (msg.sender != game.white && msg.sender != game.black) revert NotYourGame();
        if (game.drawProposer == msg.sender) revert AlreadyProposedDraw();

        game.drawProposer = msg.sender;

        emit DrawProposed(gameId, msg.sender);
    }

    /// @notice Accept a pending draw proposal. Both players get their wager back.
    function acceptDraw(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (msg.sender != game.white && msg.sender != game.black) revert NotYourGame();
        if (game.drawProposer == address(0)) revert NoDrawProposed();
        if (game.drawProposer == msg.sender) revert CannotAcceptOwnDraw();

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

    /// @notice Cancel a game that hasn't started yet. Only the creator can cancel.
    function cancelGame(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Waiting) revert GameNotWaiting();
        if (msg.sender != game.white) revert NotYourGame();

        game.status = GameStatus.Cancelled;
        game.result = GameResult.Cancelled;

        // Refund creator's wager
        if (game.wager > 0) {
            chessToken.safeTransfer(game.white, game.wager);
        }

        emit GameCancelled(gameId, msg.sender);
    }

    /// @notice Oracle-independent backstop: after EXPIRY_BLOCKS with the game still Active,
    ///         either participant reclaims the escrow (split refund). Prevents permanently
    ///         locked funds if the oracle is unavailable. The first call settles both sides.
    function reclaimExpired(uint256 gameId) external nonReentrant {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) revert GameNotActive();
        if (msg.sender != game.white && msg.sender != game.black) revert NotYourGame();
        if (block.number - game.createdAt < EXPIRY_BLOCKS) revert NotExpired();

        game.status = GameStatus.Cancelled;
        game.result = GameResult.Cancelled;

        if (game.wager > 0) {
            chessToken.safeTransfer(game.white, game.wager);
            chessToken.safeTransfer(game.black, game.wager);
        }

        emit WagerReclaimed(gameId, msg.sender);
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

    /// @notice Get total number of games created
    function totalGames() external view returns (uint256) {
        return gameNonce;
    }

    /// @notice Whether a game's escrow is reclaimable right now (expiry backstop reached).
    function canReclaim(uint256 gameId) external view returns (bool) {
        Game storage game = games[gameId];
        if (game.status != GameStatus.Active) return false;
        return block.number - game.createdAt >= EXPIRY_BLOCKS;
    }

    // ══════════════════════════════════════════════
    //  Owner Admin
    // ══════════════════════════════════════════════

    /// @notice Set the settlement oracle (rotatable for key compromise / rotation).
    function setOracle(address newOracle) external onlyOwner {
        oracle = newOracle;
        emit OracleUpdated(newOracle);
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
}

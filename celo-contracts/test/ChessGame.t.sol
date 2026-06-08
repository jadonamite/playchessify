// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ChessToken} from "../src/ChessToken.sol";
import {ChessGame} from "../src/ChessGame.sol";

contract ChessGameTest is Test {
    ChessToken token;
    ChessGame  game;

    address oracle = makeAddr("oracle");
    address white  = makeAddr("white");
    address black  = makeAddr("black");
    address rando  = makeAddr("rando");

    uint256 constant WAGER = 100e6;

    function setUp() public {
        token = new ChessToken();
        game  = new ChessGame(address(token));
        game.setOracle(oracle);

        // Seed players with CHESS and approvals
        token.mint(white, 10_000e6);
        token.mint(black, 10_000e6);
        vm.prank(white);
        token.approve(address(game), type(uint256).max);
        vm.prank(black);
        token.approve(address(game), type(uint256).max);
    }

    // ── helpers ────────────────────────────────────

    function _openWageredGame() internal returns (uint256 gameId) {
        vm.prank(white);
        gameId = game.createGame(WAGER);
        vm.prank(black);
        game.joinGame(gameId);
    }

    // ── create / join ──────────────────────────────

    function test_CreateFreeGame() public {
        vm.prank(white);
        uint256 id = game.createGame(0);
        ChessGame.Game memory g = game.getGame(id);
        assertEq(g.white, white);
        assertEq(uint8(g.status), uint8(ChessGame.GameStatus.Waiting));
    }

    function test_CreateWageredGame_LocksEscrow() public {
        vm.prank(white);
        game.createGame(WAGER);
        assertEq(token.balanceOf(address(game)), WAGER);
    }

    function test_Join_ActivatesAndMatchesWager() public {
        uint256 id = _openWageredGame();
        ChessGame.Game memory g = game.getGame(id);
        assertEq(g.black, black);
        assertEq(uint8(g.status), uint8(ChessGame.GameStatus.Active));
        assertEq(token.balanceOf(address(game)), WAGER * 2);
    }

    function test_Join_RevertsOwnGame() public {
        vm.startPrank(white);
        uint256 id = game.createGame(WAGER);
        vm.expectRevert(ChessGame.CannotJoinOwnGame.selector);
        game.joinGame(id);
        vm.stopPrank();
    }

    // ── settleGame ─────────────────────────────────

    function test_Settle_WhiteWins_PaysPot() public {
        uint256 id = _openWageredGame();
        uint256 before = token.balanceOf(white);
        vm.prank(oracle);
        game.settleGame(id, ChessGame.GameResult.WhiteWins);

        assertEq(token.balanceOf(white), before + WAGER * 2);
        ChessGame.Game memory g = game.getGame(id);
        assertEq(uint8(g.status), uint8(ChessGame.GameStatus.Finished));
        assertEq(game.getPlayerStats(white).wins, 1);
        assertEq(game.getPlayerStats(black).losses, 1);
    }

    function test_Settle_BlackWins_PaysPot() public {
        uint256 id = _openWageredGame();
        uint256 before = token.balanceOf(black);
        vm.prank(oracle);
        game.settleGame(id, ChessGame.GameResult.BlackWins);
        assertEq(token.balanceOf(black), before + WAGER * 2);
        assertEq(game.getPlayerStats(black).wins, 1);
    }

    function test_Settle_Draw_RefundsBoth() public {
        uint256 id = _openWageredGame();
        uint256 wBefore = token.balanceOf(white);
        uint256 bBefore = token.balanceOf(black);
        vm.prank(oracle);
        game.settleGame(id, ChessGame.GameResult.DrawResult);

        assertEq(token.balanceOf(white), wBefore + WAGER);
        assertEq(token.balanceOf(black), bBefore + WAGER);
        ChessGame.Game memory g = game.getGame(id);
        assertEq(uint8(g.status), uint8(ChessGame.GameStatus.Draw));
        assertEq(game.getPlayerStats(white).draws, 1);
        assertEq(game.getPlayerStats(black).draws, 1);
    }

    function test_Settle_RevertsForNonOracle() public {
        uint256 id = _openWageredGame();
        // a losing player trying to steal the pot directly
        vm.prank(black);
        vm.expectRevert(ChessGame.NotOracle.selector);
        game.settleGame(id, ChessGame.GameResult.BlackWins);
    }

    function test_Settle_DoubleSettle_Reverts() public {
        uint256 id = _openWageredGame();
        vm.startPrank(oracle);
        game.settleGame(id, ChessGame.GameResult.WhiteWins);
        vm.expectRevert(ChessGame.GameNotActive.selector);
        game.settleGame(id, ChessGame.GameResult.BlackWins);
        vm.stopPrank();
    }

    function test_Settle_InvalidResult_Reverts() public {
        uint256 id = _openWageredGame();
        vm.startPrank(oracle);
        vm.expectRevert(ChessGame.InvalidResult.selector);
        game.settleGame(id, ChessGame.GameResult.None);
        vm.expectRevert(ChessGame.InvalidResult.selector);
        game.settleGame(id, ChessGame.GameResult.Cancelled);
        vm.stopPrank();
    }

    function test_Settle_RevertsOnNonActiveGame() public {
        vm.prank(white);
        uint256 id = game.createGame(WAGER); // still Waiting
        vm.prank(oracle);
        vm.expectRevert(ChessGame.GameNotActive.selector);
        game.settleGame(id, ChessGame.GameResult.WhiteWins);
    }

    // ── resign / draw / cancel ─────────────────────

    function test_Resign_OpponentWins() public {
        uint256 id = _openWageredGame();
        uint256 before = token.balanceOf(black);
        vm.prank(white);
        game.resign(id);
        assertEq(token.balanceOf(black), before + WAGER * 2);
        assertEq(game.getPlayerStats(black).wins, 1);
    }

    function test_AcceptDraw_RefundsBoth() public {
        uint256 id = _openWageredGame();
        uint256 wBefore = token.balanceOf(white);
        uint256 bBefore = token.balanceOf(black);
        vm.prank(white);
        game.proposeDraw(id);
        vm.prank(black);
        game.acceptDraw(id);
        assertEq(token.balanceOf(white), wBefore + WAGER);
        assertEq(token.balanceOf(black), bBefore + WAGER);
    }

    function test_AcceptDraw_RevertsAcceptOwn() public {
        uint256 id = _openWageredGame();
        vm.startPrank(white);
        game.proposeDraw(id);
        vm.expectRevert(ChessGame.CannotAcceptOwnDraw.selector);
        game.acceptDraw(id);
        vm.stopPrank();
    }

    function test_CancelGame_RefundsCreator() public {
        vm.startPrank(white);
        uint256 id = game.createGame(WAGER);
        uint256 before = token.balanceOf(white);
        game.cancelGame(id);
        vm.stopPrank();
        assertEq(token.balanceOf(white), before + WAGER);
    }

    // ── reclaimExpired ─────────────────────────────

    function test_ReclaimExpired_RevertsBeforeExpiry() public {
        uint256 id = _openWageredGame();
        vm.prank(white);
        vm.expectRevert(ChessGame.NotExpired.selector);
        game.reclaimExpired(id);
    }

    function test_ReclaimExpired_RefundsBothAfterWindow() public {
        uint256 id = _openWageredGame();
        uint256 wBefore = token.balanceOf(white);
        uint256 bBefore = token.balanceOf(black);

        vm.roll(block.number + game.EXPIRY_BLOCKS());
        assertTrue(game.canReclaim(id));

        vm.prank(black);
        game.reclaimExpired(id);

        assertEq(token.balanceOf(white), wBefore + WAGER);
        assertEq(token.balanceOf(black), bBefore + WAGER);
        ChessGame.Game memory g = game.getGame(id);
        assertEq(uint8(g.status), uint8(ChessGame.GameStatus.Cancelled));
    }

    function test_ReclaimExpired_RevertsForNonParticipant() public {
        uint256 id = _openWageredGame();
        vm.roll(block.number + game.EXPIRY_BLOCKS());
        vm.prank(rando);
        vm.expectRevert(ChessGame.NotYourGame.selector);
        game.reclaimExpired(id);
    }

    function test_ReclaimExpired_DoubleReverts() public {
        uint256 id = _openWageredGame();
        vm.roll(block.number + game.EXPIRY_BLOCKS());
        vm.prank(white);
        game.reclaimExpired(id);
        vm.prank(black);
        vm.expectRevert(ChessGame.GameNotActive.selector);
        game.reclaimExpired(id);
    }

    // ── oracle admin ───────────────────────────────

    function test_SetOracle_OnlyOwner() public {
        game.setOracle(rando);
        assertEq(game.oracle(), rando);
    }

    function test_SetOracle_RevertsForNonOwner() public {
        vm.prank(rando);
        vm.expectRevert();
        game.setOracle(rando);
    }

    // ── Elo ────────────────────────────────────────

    function test_Elo_EqualRatings_WinnerGainsLoserLoses() public {
        uint256 id = _openWageredGame();
        vm.prank(oracle);
        game.settleGame(id, ChessGame.GameResult.WhiteWins);
        // equal 1200 vs 1200: change = 32*(400-0)/800 = 16
        assertEq(game.getPlayerStats(white).rating, 1200 + 16);
        assertEq(game.getPlayerStats(black).rating, 1200 - 16);
    }
}

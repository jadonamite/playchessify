// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {PlaychessifyToken} from "../src/PlaychessifyToken.sol";
import {PlaychessifyEngine} from "../src/PlaychessifyEngine.sol";

contract PlaychessifyEngineTest is Test {
    ERC2771Forwarder forwarder;
    PlaychessifyToken token;
    PlaychessifyEngine  game;

    address oracle = makeAddr("oracle");
    address white;
    uint256 whiteKey;
    address black;
    uint256 blackKey;
    address rando  = makeAddr("rando");

    uint256 constant WAGER = 100e6;

    function setUp() public {
        (white, whiteKey) = makeAddrAndKey("white");
        (black, blackKey) = makeAddrAndKey("black");

        forwarder = new ERC2771Forwarder("PlaychessifyForwarder");
        token = new PlaychessifyToken(address(forwarder));
        game  = new PlaychessifyEngine(address(token), address(forwarder));
        game.setOracle(oracle);

        // Seed players with CHESS and approvals
        token.mint(white, 10_000e6);
        token.mint(black, 10_000e6);
        vm.prank(white);
        token.approve(address(game), type(uint256).max);
        vm.prank(black);
        token.approve(address(game), type(uint256).max);

        // Start at a realistic timestamp so window math never underflows.
        vm.warp(1_760_000_000);
    }

    // ── helpers ────────────────────────────────────

    function _openWageredGame() internal returns (uint256 gameId) {
        vm.prank(white);
        gameId = game.createGame(WAGER);
        vm.prank(black);
        game.joinGame(gameId);
    }

    // ── create / join ──────────────────────────────

    function test_GameIdsStartAtOne() public {
        vm.prank(white);
        uint256 id = game.createGame(0);
        assertEq(id, 1);
        assertEq(game.totalGames(), 1);
    }

    function test_CreateFreeGame() public {
        vm.prank(white);
        uint256 id = game.createGame(0);
        PlaychessifyEngine.Game memory g = game.getGame(id);
        assertEq(g.white, white);
        assertEq(g.createdAt, block.timestamp);
        assertEq(uint8(g.status), uint8(PlaychessifyEngine.GameStatus.Waiting));
    }

    function test_CreateWageredGame_LocksEscrow() public {
        vm.prank(white);
        game.createGame(WAGER);
        assertEq(token.balanceOf(address(game)), WAGER);
    }

    function test_Join_ActivatesAndMatchesWager() public {
        uint256 id = _openWageredGame();
        PlaychessifyEngine.Game memory g = game.getGame(id);
        assertEq(g.black, black);
        assertEq(g.joinedAt, block.timestamp);
        assertEq(uint8(g.status), uint8(PlaychessifyEngine.GameStatus.Active));
        assertEq(token.balanceOf(address(game)), WAGER * 2);
    }

    function test_Join_RevertsOwnGame() public {
        vm.startPrank(white);
        uint256 id = game.createGame(WAGER);
        vm.expectRevert(PlaychessifyEngine.CannotJoinOwnGame.selector);
        game.joinGame(id);
        vm.stopPrank();
    }

    // ── join window ────────────────────────────────

    function test_Join_RevertsAfterWindow() public {
        vm.prank(white);
        uint256 id = game.createGame(WAGER);
        vm.warp(block.timestamp + game.JOIN_WINDOW() + 1);
        assertFalse(game.canJoin(id));
        vm.prank(black);
        vm.expectRevert(PlaychessifyEngine.JoinWindowClosed.selector);
        game.joinGame(id);
    }

    function test_Join_WorksAtWindowEdge() public {
        vm.prank(white);
        uint256 id = game.createGame(WAGER);
        vm.warp(block.timestamp + game.JOIN_WINDOW());
        assertTrue(game.canJoin(id));
        vm.prank(black);
        game.joinGame(id);
    }

    function test_CloseStale_RefundsCreator_AnyCaller() public {
        vm.prank(white);
        uint256 id = game.createGame(WAGER);
        uint256 before = token.balanceOf(white);

        vm.warp(block.timestamp + game.JOIN_WINDOW() + 1);
        vm.prank(rando); // sweeper — gains nothing, refund goes to creator
        game.closeStaleGame(id);

        assertEq(token.balanceOf(white), before + WAGER);
        assertEq(uint8(game.getGame(id).status), uint8(PlaychessifyEngine.GameStatus.Cancelled));
    }

    function test_CloseStale_RevertsWhileWindowOpen() public {
        vm.prank(white);
        uint256 id = game.createGame(WAGER);
        vm.prank(rando);
        vm.expectRevert(PlaychessifyEngine.JoinWindowStillOpen.selector);
        game.closeStaleGame(id);
    }

    function test_CloseStale_RevertsOnActiveGame() public {
        uint256 id = _openWageredGame();
        vm.warp(block.timestamp + game.JOIN_WINDOW() + 1);
        vm.prank(rando);
        vm.expectRevert(PlaychessifyEngine.GameNotWaiting.selector);
        game.closeStaleGame(id);
    }

    // ── voidGame ───────────────────────────────────

    function test_Void_RefundsBoth_NoStats() public {
        uint256 id = _openWageredGame();
        uint256 wBefore = token.balanceOf(white);
        uint256 bBefore = token.balanceOf(black);

        vm.warp(block.timestamp + game.VOID_MIN_IDLE());
        vm.prank(oracle);
        game.voidGame(id);

        assertEq(token.balanceOf(white), wBefore + WAGER);
        assertEq(token.balanceOf(black), bBefore + WAGER);
        assertEq(uint8(game.getGame(id).status), uint8(PlaychessifyEngine.GameStatus.Cancelled));
        // no winner, no Elo, no games played
        assertEq(game.getPlayerStats(white).gamesPlayed, 0);
        assertEq(game.getPlayerStats(black).gamesPlayed, 0);
        assertEq(game.getPlayerStats(black).wins, 0);
    }

    function test_Void_RevertsTooEarly() public {
        uint256 id = _openWageredGame();
        vm.prank(oracle);
        vm.expectRevert(PlaychessifyEngine.TooEarlyToVoid.selector);
        game.voidGame(id);
    }

    function test_Void_RevertsForNonOracle() public {
        uint256 id = _openWageredGame();
        vm.warp(block.timestamp + game.VOID_MIN_IDLE());
        vm.prank(black);
        vm.expectRevert(PlaychessifyEngine.NotOracle.selector);
        game.voidGame(id);
    }

    // ── permit flows ───────────────────────────────

    function _signPermit(
        uint256 key,
        address owner_,
        uint256 value,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(abi.encode(
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
            owner_,
            address(game),
            value,
            token.nonces(owner_),
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(key, digest);
    }

    function test_CreateGameWithPermit_NoPriorApproval() public {
        (address fresh, uint256 freshKey) = makeAddrAndKey("fresh");
        token.mint(fresh, 1_000e6);
        // no approve() ever called by fresh

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermitFor(freshKey, fresh, WAGER, deadline);

        vm.prank(fresh);
        uint256 id = game.createGameWithPermit(WAGER, deadline, v, r, s);

        assertEq(game.getGame(id).white, fresh);
        assertEq(token.balanceOf(address(game)), WAGER);
    }

    function test_JoinGameWithPermit_NoPriorApproval() public {
        vm.prank(white);
        uint256 id = game.createGame(WAGER);

        (address fresh, uint256 freshKey) = makeAddrAndKey("fresh2");
        token.mint(fresh, 1_000e6);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermitFor(freshKey, fresh, WAGER, deadline);

        vm.prank(fresh);
        game.joinGameWithPermit(id, deadline, v, r, s);

        assertEq(game.getGame(id).black, fresh);
        assertEq(token.balanceOf(address(game)), WAGER * 2);
    }

    function _signPermitFor(
        uint256 key,
        address owner_,
        uint256 value,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        return _signPermit(key, owner_, value, deadline);
    }

    // ── ERC-2771 meta-tx ───────────────────────────

    bytes32 private constant _FORWARD_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );

    function _forwarderDigest(ERC2771Forwarder.ForwardRequestData memory req, uint256 nonce)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(abi.encode(
            _FORWARD_TYPEHASH,
            req.from,
            req.to,
            req.value,
            req.gas,
            nonce,
            req.deadline,
            keccak256(req.data)
        ));
        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("PlaychessifyForwarder")),
            keccak256(bytes("1")),
            block.chainid,
            address(forwarder)
        ));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _metaTx(uint256 key, address from, address to, bytes memory data) internal {
        ERC2771Forwarder.ForwardRequestData memory req = ERC2771Forwarder.ForwardRequestData({
            from: from,
            to: to,
            value: 0,
            gas: 1_000_000,
            deadline: uint48(block.timestamp + 1 hours),
            data: data,
            signature: ""
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, _forwarderDigest(req, forwarder.nonces(from)));
        req.signature = abi.encodePacked(r, s, v);

        vm.prank(rando); // anyone (the gas-sponsor in prod) executes and pays gas
        forwarder.execute(req);
    }

    function test_MetaTx_CreateGame_SenderIsPlayer() public {
        _metaTx(whiteKey, white, address(game), abi.encodeCall(PlaychessifyEngine.createGame, (WAGER)));

        PlaychessifyEngine.Game memory g = game.getGame(1);
        assertEq(g.white, white); // NOT the forwarder, NOT the executor
        assertEq(token.balanceOf(address(game)), WAGER);
    }

    function test_MetaTx_FullGaslessGame_ResignSettles() public {
        uint256 id = _openWageredGame();
        uint256 before = token.balanceOf(black);

        // white resigns via meta-tx — black paid nothing, black wins the pot
        _metaTx(whiteKey, white, address(game), abi.encodeCall(PlaychessifyEngine.resign, (id)));

        assertEq(token.balanceOf(black), before + WAGER * 2);
        assertEq(game.getPlayerStats(black).wins, 1);
    }

    /// Attribution-tag interaction: a DIRECT call with trailing suffix bytes in
    /// calldata (the ERC-8021 attribution tag pattern) must NOT be mistaken for a
    /// forwarder call — _msgSender() only trusts the suffix when msg.sender is the
    /// forwarder itself.
    function test_AttributionSuffix_DirectCall_DoesNotSpoofSender() public {
        bytes memory call = abi.encodeCall(PlaychessifyEngine.createGame, (0));
        // Append 20 bytes that decode as `rando` — a spoof attempt / innocent tag.
        bytes memory tagged = bytes.concat(call, bytes20(rando));

        vm.prank(white);
        (bool ok, ) = address(game).call(tagged);
        assertTrue(ok);

        // The game belongs to the real msg.sender, not the suffix address.
        assertEq(game.getGame(1).white, white);
    }

    // ── settleGame ─────────────────────────────────

    function test_Settle_WhiteWins_PaysPot() public {
        uint256 id = _openWageredGame();
        uint256 before = token.balanceOf(white);
        vm.prank(oracle);
        game.settleGame(id, PlaychessifyEngine.GameResult.WhiteWins);

        assertEq(token.balanceOf(white), before + WAGER * 2);
        PlaychessifyEngine.Game memory g = game.getGame(id);
        assertEq(uint8(g.status), uint8(PlaychessifyEngine.GameStatus.Finished));
        assertEq(game.getPlayerStats(white).wins, 1);
        assertEq(game.getPlayerStats(black).losses, 1);
    }

    function test_Settle_BlackWins_PaysPot() public {
        uint256 id = _openWageredGame();
        uint256 before = token.balanceOf(black);
        vm.prank(oracle);
        game.settleGame(id, PlaychessifyEngine.GameResult.BlackWins);
        assertEq(token.balanceOf(black), before + WAGER * 2);
        assertEq(game.getPlayerStats(black).wins, 1);
    }

    function test_Settle_Draw_RefundsBoth() public {
        uint256 id = _openWageredGame();
        uint256 wBefore = token.balanceOf(white);
        uint256 bBefore = token.balanceOf(black);
        vm.prank(oracle);
        game.settleGame(id, PlaychessifyEngine.GameResult.DrawResult);

        assertEq(token.balanceOf(white), wBefore + WAGER);
        assertEq(token.balanceOf(black), bBefore + WAGER);
        PlaychessifyEngine.Game memory g = game.getGame(id);
        assertEq(uint8(g.status), uint8(PlaychessifyEngine.GameStatus.Draw));
        assertEq(game.getPlayerStats(white).draws, 1);
        assertEq(game.getPlayerStats(black).draws, 1);
    }

    function test_Settle_RevertsForNonOracle() public {
        uint256 id = _openWageredGame();
        // a losing player trying to steal the pot directly
        vm.prank(black);
        vm.expectRevert(PlaychessifyEngine.NotOracle.selector);
        game.settleGame(id, PlaychessifyEngine.GameResult.BlackWins);
    }

    function test_Settle_DoubleSettle_Reverts() public {
        uint256 id = _openWageredGame();
        vm.startPrank(oracle);
        game.settleGame(id, PlaychessifyEngine.GameResult.WhiteWins);
        vm.expectRevert(PlaychessifyEngine.GameNotActive.selector);
        game.settleGame(id, PlaychessifyEngine.GameResult.BlackWins);
        vm.stopPrank();
    }

    function test_Settle_InvalidResult_Reverts() public {
        uint256 id = _openWageredGame();
        vm.startPrank(oracle);
        vm.expectRevert(PlaychessifyEngine.InvalidResult.selector);
        game.settleGame(id, PlaychessifyEngine.GameResult.None);
        vm.expectRevert(PlaychessifyEngine.InvalidResult.selector);
        game.settleGame(id, PlaychessifyEngine.GameResult.Cancelled);
        vm.stopPrank();
    }

    function test_Settle_RevertsOnNonActiveGame() public {
        vm.prank(white);
        uint256 id = game.createGame(WAGER); // still Waiting
        vm.prank(oracle);
        vm.expectRevert(PlaychessifyEngine.GameNotActive.selector);
        game.settleGame(id, PlaychessifyEngine.GameResult.WhiteWins);
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
        vm.expectRevert(PlaychessifyEngine.CannotAcceptOwnDraw.selector);
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
        vm.expectRevert(PlaychessifyEngine.NotExpired.selector);
        game.reclaimExpired(id);
    }

    function test_ReclaimExpired_RefundsBothAfterWindow() public {
        uint256 id = _openWageredGame();
        uint256 wBefore = token.balanceOf(white);
        uint256 bBefore = token.balanceOf(black);

        vm.warp(block.timestamp + game.EXPIRY_TIME());
        assertTrue(game.canReclaim(id));

        vm.prank(black);
        game.reclaimExpired(id);

        assertEq(token.balanceOf(white), wBefore + WAGER);
        assertEq(token.balanceOf(black), bBefore + WAGER);
        PlaychessifyEngine.Game memory g = game.getGame(id);
        assertEq(uint8(g.status), uint8(PlaychessifyEngine.GameStatus.Cancelled));
    }

    function test_ReclaimExpired_RevertsForNonParticipant() public {
        uint256 id = _openWageredGame();
        vm.warp(block.timestamp + game.EXPIRY_TIME());
        vm.prank(rando);
        vm.expectRevert(PlaychessifyEngine.NotYourGame.selector);
        game.reclaimExpired(id);
    }

    function test_ReclaimExpired_DoubleReverts() public {
        uint256 id = _openWageredGame();
        vm.warp(block.timestamp + game.EXPIRY_TIME());
        vm.prank(white);
        game.reclaimExpired(id);
        vm.prank(black);
        vm.expectRevert(PlaychessifyEngine.GameNotActive.selector);
        game.reclaimExpired(id);
    }

    // ── stats migration ────────────────────────────

    function test_ImportStats_SeedsAndLocks() public {
        address[] memory players = new address[](1);
        players[0] = rando;
        PlaychessifyEngine.PlayerStats[] memory stats = new PlaychessifyEngine.PlayerStats[](1);
        stats[0] = PlaychessifyEngine.PlayerStats({ wins: 7, losses: 3, draws: 2, rating: 1350, gamesPlayed: 12 });

        game.importStats(players, stats);
        assertEq(game.getPlayerStats(rando).rating, 1350);
        assertEq(game.getPlayerStats(rando).wins, 7);

        game.lockStatsSeed();
        vm.expectRevert(PlaychessifyEngine.StatsSeedIsLocked.selector);
        game.importStats(players, stats);
    }

    function test_ImportStats_RevertsForNonOwner() public {
        address[] memory players = new address[](0);
        PlaychessifyEngine.PlayerStats[] memory stats = new PlaychessifyEngine.PlayerStats[](0);
        vm.prank(rando);
        vm.expectRevert();
        game.importStats(players, stats);
    }

    /// Seeded Elo must feed the live Elo math (not be a dead display value).
    function test_ImportStats_SeededRatingUsedInElo() public {
        address[] memory players = new address[](1);
        players[0] = white;
        PlaychessifyEngine.PlayerStats[] memory stats = new PlaychessifyEngine.PlayerStats[](1);
        stats[0] = PlaychessifyEngine.PlayerStats({ wins: 0, losses: 0, draws: 0, rating: 1600, gamesPlayed: 0 });
        game.importStats(players, stats);

        uint256 id = _openWageredGame();
        vm.prank(oracle);
        game.settleGame(id, PlaychessifyEngine.GameResult.WhiteWins);

        // favored 1600 beats 1200: diff=400 → winner +0→min 1
        assertEq(game.getPlayerStats(white).rating, 1601);
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
        game.settleGame(id, PlaychessifyEngine.GameResult.WhiteWins);
        // equal 1200 vs 1200: change = 32*(400-0)/800 = 16
        assertEq(game.getPlayerStats(white).rating, 1200 + 16);
        assertEq(game.getPlayerStats(black).rating, 1200 - 16);
    }
}

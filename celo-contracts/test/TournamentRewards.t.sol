// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {TournamentRewards} from "../src/TournamentRewards.sol";

contract MockUSD is ERC20 {
    constructor() ERC20("Mento Dollar", "USDm") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract TournamentRewardsTest is Test {
    ERC2771Forwarder forwarder;
    TournamentRewards rewards;
    MockUSD usd;

    address first;
    uint256 firstKey;
    address second = makeAddr("second");
    address third  = makeAddr("third");
    address rando  = makeAddr("rando");

    uint64 constant WINDOW = 30 days;

    function setUp() public {
        (first, firstKey) = makeAddrAndKey("first");
        forwarder = new ERC2771Forwarder("PlaychessifyForwarder");
        rewards = new TournamentRewards(address(forwarder));
        usd = new MockUSD();
        usd.approve(address(rewards), type(uint256).max);
    }

    function _winners3() internal view returns (address[] memory w, uint256[] memory a) {
        w = new address[](3);
        a = new uint256[](3);
        w[0] = first;  a[0] = 50e18;
        w[1] = second; a[1] = 30e18;
        w[2] = third;  a[2] = 20e18;
    }

    function _open(uint256 id) internal {
        (address[] memory w, uint256[] memory a) = _winners3();
        rewards.openSeason(id, address(usd), w, a, WINDOW);
    }

    // ── seeding ────────────────────────────────────────────────────────────────

    function test_openSeason_pullsExactPot_andRecordsAllocations() public {
        _open(1);
        assertEq(usd.balanceOf(address(rewards)), 100e18);
        assertEq(rewards.allocation(1, first), 50e18);
        assertEq(rewards.allocation(1, second), 30e18);
        assertEq(rewards.allocation(1, third), 20e18);
        assertEq(rewards.allocation(1, rando), 0);
        assertEq(rewards.latestSeasonId(), 1);
    }

    function test_openSeason_variableWinnerCount() public {
        address[] memory w = new address[](10);
        uint256[] memory a = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            w[i] = address(uint160(0x1000 + i));
            a[i] = 10e18;
        }
        rewards.openSeason(2, address(usd), w, a, WINDOW);
        assertEq(usd.balanceOf(address(rewards)), 100e18);
        assertEq(rewards.allocation(2, w[9]), 10e18);
    }

    function test_openSeason_rejects_duplicateWinner() public {
        address[] memory w = new address[](2);
        uint256[] memory a = new uint256[](2);
        w[0] = first; a[0] = 50e18;
        w[1] = first; a[1] = 30e18;
        vm.expectRevert(TournamentRewards.BadInput.selector);
        rewards.openSeason(1, address(usd), w, a, WINDOW);
    }

    function test_openSeason_rejects_reseed() public {
        _open(1);
        (address[] memory w, uint256[] memory a) = _winners3();
        vm.expectRevert(TournamentRewards.SeasonAlreadyOpen.selector);
        rewards.openSeason(1, address(usd), w, a, WINDOW);
    }

    function test_openSeason_onlyOwner() public {
        (address[] memory w, uint256[] memory a) = _winners3();
        vm.prank(rando);
        vm.expectRevert();
        rewards.openSeason(1, address(usd), w, a, WINDOW);
    }

    function test_latestSeasonId_neverRegresses() public {
        _open(5);
        _open(3);
        assertEq(rewards.latestSeasonId(), 5);
    }

    // ── claiming ───────────────────────────────────────────────────────────────

    function test_claim_paysWinnerOnce() public {
        _open(1);
        vm.prank(first);
        rewards.claim(1);
        assertEq(usd.balanceOf(first), 50e18);

        vm.prank(first);
        vm.expectRevert(TournamentRewards.AlreadyClaimed.selector);
        rewards.claim(1);
    }

    function test_claim_nonWinnerReverts() public {
        _open(1);
        vm.prank(rando);
        vm.expectRevert(TournamentRewards.NothingToClaim.selector);
        rewards.claim(1);
    }

    function test_claim_unopenedSeasonReverts() public {
        vm.prank(first);
        vm.expectRevert(TournamentRewards.SeasonNotOpen.selector);
        rewards.claim(9);
    }

    function test_claim_stillWorksAfterDeadline_untilSwept() public {
        _open(1);
        vm.warp(block.timestamp + WINDOW + 1);
        vm.prank(first);
        rewards.claim(1);
        assertEq(usd.balanceOf(first), 50e18);
    }

    function test_seasons_isolated() public {
        _open(1);
        _open(2);
        vm.startPrank(first);
        rewards.claim(1);
        rewards.claim(2);
        vm.stopPrank();
        assertEq(usd.balanceOf(first), 100e18);
    }

    // ── meta-tx claim (gasless rail) ───────────────────────────────────────────

    function test_claim_viaForwarder() public {
        _open(1);

        bytes memory data = abi.encodeCall(TournamentRewards.claim, (1));
        ERC2771Forwarder.ForwardRequestData memory req = ERC2771Forwarder.ForwardRequestData({
            from: first,
            to: address(rewards),
            value: 0,
            gas: 200_000,
            deadline: uint48(block.timestamp + 300),
            data: data,
            signature: ""
        });
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"),
                req.from, req.to, req.value, req.gas, forwarder.nonces(first), req.deadline, keccak256(req.data)
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                keccak256(abi.encode(
                    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                    keccak256(bytes("PlaychessifyForwarder")),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(forwarder)
                )),
                structHash
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(firstKey, digest);
        req.signature = abi.encodePacked(r, s, v);

        forwarder.execute(req);
        assertEq(usd.balanceOf(first), 50e18);
        (, bool claimed_,) = rewards.claimStatus(1, first);
        assertTrue(claimed_);
    }

    // ── sweep ──────────────────────────────────────────────────────────────────

    function test_sweep_returnsUnclaimed_afterDeadline() public {
        _open(1);
        vm.prank(first);
        rewards.claim(1);

        uint256 before = usd.balanceOf(address(this));
        vm.warp(block.timestamp + WINDOW + 1);
        rewards.sweep(1);
        assertEq(usd.balanceOf(address(this)) - before, 50e18); // second + third unclaimed
        assertEq(usd.balanceOf(address(rewards)), 0);
    }

    function test_sweep_beforeDeadlineReverts() public {
        _open(1);
        vm.expectRevert(TournamentRewards.DeadlineNotReached.selector);
        rewards.sweep(1);
    }

    function test_claim_afterSweepReverts() public {
        _open(1);
        vm.warp(block.timestamp + WINDOW + 1);
        rewards.sweep(1);
        vm.prank(first);
        vm.expectRevert(TournamentRewards.SeasonSweptOut.selector);
        rewards.claim(1);
    }

    function test_sweep_onlyOwner() public {
        _open(1);
        vm.warp(block.timestamp + WINDOW + 1);
        vm.prank(rando);
        vm.expectRevert();
        rewards.sweep(1);
    }

    // ── views ──────────────────────────────────────────────────────────────────

    function test_claimStatus_shapes() public {
        _open(1);
        (uint256 amt, bool claimed_, bool open) = rewards.claimStatus(1, first);
        assertEq(amt, 50e18); assertFalse(claimed_); assertTrue(open);

        (amt, claimed_, open) = rewards.claimStatus(1, rando);
        assertEq(amt, 0); assertFalse(claimed_); assertTrue(open);

        (,, open) = rewards.claimStatus(7, first);
        assertFalse(open);
    }
}

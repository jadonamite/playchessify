// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {PlaychessifyToken} from "../src/PlaychessifyToken.sol";

contract PlaychessifyTokenTest is Test {
    ERC2771Forwarder forwarder;
    PlaychessifyToken token;

    address owner  = address(this);
    address minter = makeAddr("minter");
    address user   = makeAddr("user");
    address rando  = makeAddr("rando");

    function setUp() public {
        forwarder = new ERC2771Forwarder("PlaychessifyForwarder");
        token = new PlaychessifyToken(address(forwarder));
        vm.warp(1_760_000_000);
    }

    function test_Decimals() public view {
        assertEq(token.decimals(), 6);
    }

    function test_FaucetClaim() public {
        vm.prank(user);
        token.faucetClaim();
        assertEq(token.balanceOf(user), token.FAUCET_AMOUNT());
    }

    function test_FaucetCooldownReverts() public {
        vm.startPrank(user);
        token.faucetClaim();
        vm.expectRevert();
        token.faucetClaim();
        vm.stopPrank();
    }

    function test_FaucetCooldown_IsTimeBased24h() public {
        vm.startPrank(user);
        token.faucetClaim();
        vm.warp(block.timestamp + 1 days - 1);
        vm.expectRevert();
        token.faucetClaim();
        vm.warp(block.timestamp + 1);
        token.faucetClaim(); // exactly 24h later — allowed
        vm.stopPrank();
        assertEq(token.balanceOf(user), token.FAUCET_AMOUNT() * 2);
    }

    function test_Permit_SetsAllowanceFromSignature() public {
        (address holder, uint256 holderKey) = makeAddrAndKey("holder");
        token.mint(holder, 1_000e6);

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(abi.encode(
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
            holder,
            rando,
            500e6,
            token.nonces(holder),
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holderKey, digest);

        token.permit(holder, rando, 500e6, deadline, v, r, s);
        assertEq(token.allowance(holder, rando), 500e6);
    }

    function test_BatchMint_MigrationSnapshot() public {
        address[] memory recipients = new address[](2);
        recipients[0] = user;
        recipients[1] = rando;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1_234e6;
        amounts[1] = 42e6;

        token.batchMint(recipients, amounts);
        assertEq(token.balanceOf(user), 1_234e6);
        assertEq(token.balanceOf(rando), 42e6);
    }

    function test_SetMinter_OnlyOwner() public {
        token.setMinter(minter);
        assertEq(token.minter(), minter);
    }

    function test_SetMinter_RevertsForNonOwner() public {
        vm.prank(rando);
        vm.expectRevert();
        token.setMinter(minter);
    }

    function test_MintTo_OnlyMinter() public {
        token.setMinter(minter);
        vm.prank(minter);
        token.mintTo(user, 500e6);
        assertEq(token.balanceOf(user), 500e6);
    }

    function test_MintTo_RevertsForNonMinter() public {
        token.setMinter(minter);
        vm.prank(rando);
        vm.expectRevert(PlaychessifyToken.NotMinter.selector);
        token.mintTo(user, 500e6);
    }

    function test_MintTo_RevertsZeroAmount() public {
        token.setMinter(minter);
        vm.prank(minter);
        vm.expectRevert(PlaychessifyToken.InvalidAmount.selector);
        token.mintTo(user, 0);
    }

    function test_MintTo_RevertsWhenMintDisabled() public {
        token.setMinter(minter);
        token.setMintEnabled(false);
        vm.prank(minter);
        vm.expectRevert(PlaychessifyToken.MintDisabled.selector);
        token.mintTo(user, 100e6);
    }

    function test_OwnerMintStillWorks() public {
        token.mint(user, 1000e6);
        assertEq(token.balanceOf(user), 1000e6);
    }
}

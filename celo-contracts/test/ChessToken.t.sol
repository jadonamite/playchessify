// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ChessToken} from "../src/ChessToken.sol";

contract ChessTokenTest is Test {
    ChessToken token;

    address owner  = address(this);
    address minter = makeAddr("minter");
    address user   = makeAddr("user");
    address rando  = makeAddr("rando");

    function setUp() public {
        token = new ChessToken();
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
        vm.expectRevert(ChessToken.NotMinter.selector);
        token.mintTo(user, 500e6);
    }

    function test_MintTo_RevertsZeroAmount() public {
        token.setMinter(minter);
        vm.prank(minter);
        vm.expectRevert(ChessToken.InvalidAmount.selector);
        token.mintTo(user, 0);
    }

    function test_MintTo_RevertsWhenMintDisabled() public {
        token.setMinter(minter);
        token.setMintEnabled(false);
        vm.prank(minter);
        vm.expectRevert(ChessToken.MintDisabled.selector);
        token.mintTo(user, 100e6);
    }

    function test_OwnerMintStillWorks() public {
        token.mint(user, 1000e6);
        assertEq(token.balanceOf(user), 1000e6);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {EclimAiCarbonCredit} from "../src/EclimAiCarbonCredit.sol";

contract EclimAiCarbonCreditTest is Test {
    EclimAiCarbonCredit public token;
    
    address public admin = address(1);
    address public issuer = address(2);
    address public user1 = address(3);
    address public user2 = address(4);

    function setUp() public {
        vm.startPrank(admin);
        token = new EclimAiCarbonCredit("https://api.eclimai.com/metadata/{id}.json");
        token.grantRole(token.ISSUER_ROLE(), issuer);
        vm.stopPrank();
        
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }

    // 1. Unauthorized user cannot issue a credit
    function test_RevertWhen_UnauthorizedMint() public {
        vm.prank(user1);
        vm.expectRevert();
        token.mint(1, 100, "Bldg A", "2024", "2025", "REG-001", "0xHash", "");
    }

    // 2. Same source credit cannot be issued twice
    function test_RevertWhen_DuplicateIssuance() public {
        vm.startPrank(issuer);
        token.mint(1, 100, "Bldg A", "2024", "2025", "REG-001", "0xHash", "");
        
        vm.expectRevert("Duplicate issuance: credit already exists");
        // Re-using the exact same projectId, vintage, and registryReference
        token.mint(2, 50, "Bldg A", "2024", "2025", "REG-001", "0xHash", "");
        vm.stopPrank();
    }

    // 3. Seller cannot sell a credit they don't own
    function test_RevertWhen_ListingUnownedCredit() public {
        vm.prank(user1);
        vm.expectRevert("Insufficient balance to list");
        token.list(1, 10, 1 ether);
    }

    // 4. Ownership changes after a successful purchase
    function test_OwnershipTransferOnPurchase() public {
        vm.prank(issuer);
        token.mint(1, 100, "Bldg A", "2024", "2025", "REG-001", "0xHash", "");

        // Issuer transfers to user1 (e.g., initial allocation)
        vm.prank(issuer);
        token.safeTransferFrom(issuer, user1, 1, 100, "");

        vm.prank(user1);
        token.list(1, 10, 1 ether); // List 10 tokens at 1 ETH each
        
        vm.prank(user2);
        token.buy{value: 10 ether}(1, 10);
        
        assertEq(token.balanceOf(user2, 1), 10);
        assertEq(token.balanceOf(user1, 1), 90);
    }

    // 5. A retired credit cannot be transferred or sold
    function test_RevertWhen_TransferringRetiredCredit() public {
        vm.prank(issuer);
        token.mint(1, 100, "Bldg A", "2024", "2025", "REG-001", "0xHash", "");

        vm.prank(issuer);
        token.safeTransferFrom(issuer, user1, 1, 100, "");

        vm.startPrank(user1);
        token.retire(1, "Microsoft", "Q3 Offsets");
        
        vm.expectRevert("Cannot transfer a retired credit");
        token.safeTransferFrom(user1, user2, 1, 10, "");
        vm.stopPrank();
    }

    // 6. A credit cannot be retired twice
    function test_RevertWhen_DoubleRetirement() public {
        vm.prank(issuer);
        token.mint(1, 100, "Bldg A", "2024", "2025", "REG-001", "0xHash", "");

        vm.prank(issuer);
        token.safeTransferFrom(issuer, user1, 1, 100, "");

        vm.startPrank(user1);
        token.retire(1, "Microsoft", "Q3 Offsets");
        
        vm.expectRevert("Credit is already retired");
        token.retire(1, "Google", "Q4 Offsets");
        vm.stopPrank();
    }

    // 7. Batch minting issues multiple credits correctly
    function test_BatchMintMultipleCredits() public {
        vm.startPrank(issuer);
        
        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = 10;
        tokenIds[1] = 11;
        
        uint256[] memory quantities = new uint256[](2);
        quantities[0] = 50;
        quantities[1] = 75;
        
        EclimAiCarbonCredit.TokenMetadata[] memory metadatas = new EclimAiCarbonCredit.TokenMetadata[](2);
        metadatas[0] = EclimAiCarbonCredit.TokenMetadata({
            buildingId: "Bldg B",
            periodStart: "2024",
            periodEnd: "2025",
            registryReference: "REG-002",
            evidenceHash: "0xHash2",
            verificationStatus: EclimAiCarbonCredit.VerificationStatus.Draft
        });
        metadatas[1] = EclimAiCarbonCredit.TokenMetadata({
            buildingId: "Bldg C",
            periodStart: "2024",
            periodEnd: "2025",
            registryReference: "REG-003",
            evidenceHash: "0xHash3",
            verificationStatus: EclimAiCarbonCredit.VerificationStatus.Draft
        });
        
        token.mintBatch(tokenIds, quantities, metadatas, "");
        vm.stopPrank();
        
        assertEq(token.balanceOf(issuer, 10), 50);
        assertEq(token.balanceOf(issuer, 11), 75);
    }
}

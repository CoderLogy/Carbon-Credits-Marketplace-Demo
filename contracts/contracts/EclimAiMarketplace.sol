// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract EclimAiMarketplace is AccessControl, Pausable, ReentrancyGuard {
    IERC1155 public carbonCreditToken;

    struct Listing {
        uint256 id;
        address seller;
        uint256 tokenId;
        uint256 quantity;
        uint256 pricePerTonne;
        bool isActive;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    event CreditListed(uint256 indexed listingId, address indexed seller, uint256 tokenId, uint256 quantity, uint256 pricePerTonne);
    event CreditSold(uint256 indexed listingId, address indexed buyer, uint256 quantity, uint256 totalPrice);
    event ListingCancelled(uint256 indexed listingId);

    constructor(address _carbonCreditToken) {
        carbonCreditToken = IERC1155(_carbonCreditToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function listCredit(uint256 tokenId, uint256 quantity, uint256 pricePerTonne) public whenNotPaused {
        require(carbonCreditToken.balanceOf(msg.sender, tokenId) >= quantity, "EclimAi: insufficient balance to list");
        require(carbonCreditToken.isApprovedForAll(msg.sender, address(this)), "EclimAi: marketplace not approved");

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            id: listingId,
            seller: msg.sender,
            tokenId: tokenId,
            quantity: quantity,
            pricePerTonne: pricePerTonne,
            isActive: true
        });

        emit CreditListed(listingId, msg.sender, tokenId, quantity, pricePerTonne);
    }

    function buyCredit(uint256 listingId, uint256 quantityToBuy) public payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "EclimAi: listing is not active");
        require(listing.quantity >= quantityToBuy, "EclimAi: insufficient quantity in listing");
        
        uint256 totalPrice = quantityToBuy * listing.pricePerTonne;
        require(msg.value >= totalPrice, "EclimAi: insufficient payment");

        // Update listing
        listing.quantity -= quantityToBuy;
        if (listing.quantity == 0) {
            listing.isActive = false;
        }

        // Transfer funds to seller
        (bool success, ) = payable(listing.seller).call{value: totalPrice}("");
        require(success, "EclimAi: payment transfer failed");

        // Transfer tokens to buyer
        carbonCreditToken.safeTransferFrom(listing.seller, msg.sender, listing.tokenId, quantityToBuy, "");

        // Refund excess payment
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - totalPrice}("");
            require(refundSuccess, "EclimAi: refund failed");
        }

        emit CreditSold(listingId, msg.sender, quantityToBuy, totalPrice);
    }

    function cancelListing(uint256 listingId) public whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "EclimAi: listing is not active");
        require(listing.seller == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "EclimAi: not seller or admin");

        listing.isActive = false;
        emit ListingCancelled(listingId);
    }
}

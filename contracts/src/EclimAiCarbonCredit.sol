// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "lib/openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Pausable} from "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract EclimAiCarbonCredit is ERC1155, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant MARKETPLACE_ADMIN_ROLE = keccak256("MARKETPLACE_ADMIN_ROLE");

    // Duplicate issuance guard
    mapping(bytes32 => bool) public issuedSourceHashes;
    
    // Retirement tracking
    mapping(uint256 => bool) public retired;

    enum VerificationStatus {
        Draft,
        PendingReview,
        Approved,
        Issued,
        Sold,
        Listed,
        Retired,
        Transferred
    }

    // Token Metadata
    struct TokenMetadata {
        string buildingId;
        string periodStart;
        string periodEnd;
        string registryReference;
        string evidenceHash;
        VerificationStatus verificationStatus;
    }
    mapping(uint256 => TokenMetadata) public tokenData;

    // Listings for the marketplace
    struct Listing {
        uint256 quantity;
        uint256 price;
        address seller;
    }
    mapping(uint256 => Listing) public listings;

    event CreditIssued(uint256 indexed tokenId, string buildingId, uint256 quantity, string registryReference);
    event ProjectVerified(string projectId, string notes);
    event Listed(uint256 indexed tokenId, address seller, uint256 quantity, uint256 price);
    event Sold(uint256 indexed tokenId, address buyer, address seller, uint256 quantity, uint256 price);
    event Retired(uint256 indexed tokenId, address retiree, string beneficiary, string purpose);
    event VerificationStatusUpdated(uint256 indexed tokenId, VerificationStatus status);

    constructor(string memory uri_) ERC1155(uri_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        _grantRole(MARKETPLACE_ADMIN_ROLE, msg.sender);
    }

    function pause() external onlyRole(MARKETPLACE_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MARKETPLACE_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // TEST 1 & 2: Access control and duplicate prevention
    function mint(
        uint256 tokenId,
        uint256 quantity,
        string memory buildingId,
        string memory periodStart,
        string memory periodEnd,
        string memory registryReference,
        string memory evidenceHash,
        bytes memory data
    ) external onlyRole(ISSUER_ROLE) whenNotPaused {
        bytes32 sourceHash = keccak256(abi.encodePacked(buildingId, periodStart, periodEnd, registryReference));
        require(!issuedSourceHashes[sourceHash], "Duplicate issuance: credit already exists");
        
        issuedSourceHashes[sourceHash] = true;
        
        tokenData[tokenId] = TokenMetadata({
            buildingId: buildingId,
            periodStart: periodStart,
            periodEnd: periodEnd,
            registryReference: registryReference,
            evidenceHash: evidenceHash,
            verificationStatus: VerificationStatus.Issued
        });

        _mint(msg.sender, tokenId, quantity, data);
        emit CreditIssued(tokenId, buildingId, quantity, registryReference);
    }

    function mintBatch(
        uint256[] memory tokenIds,
        uint256[] memory quantities,
        TokenMetadata[] memory metadatas,
        bytes memory data
    ) external onlyRole(ISSUER_ROLE) whenNotPaused {
        require(tokenIds.length == quantities.length && tokenIds.length == metadatas.length, "Array length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            TokenMetadata memory meta = metadatas[i];
            bytes32 sourceHash = keccak256(abi.encodePacked(meta.buildingId, meta.periodStart, meta.periodEnd, meta.registryReference));
            require(!issuedSourceHashes[sourceHash], "Duplicate issuance: credit already exists");
            issuedSourceHashes[sourceHash] = true;
            meta.verificationStatus = VerificationStatus.Issued;
            tokenData[tokenIds[i]] = meta;
        }
        _mintBatch(msg.sender, tokenIds, quantities, data);
    }

    function verifyProject(string memory projectId, string memory notes) external onlyRole(VERIFIER_ROLE) {
        emit ProjectVerified(projectId, notes);
    }

    // TEST 3: Seller ownership check
    function list(uint256 tokenId, uint256 quantity, uint256 price) external whenNotPaused {
        require(!retired[tokenId], "Cannot list a retired credit");
        require(balanceOf(msg.sender, tokenId) >= quantity, "Insufficient balance to list");
        
        listings[tokenId] = Listing({
            quantity: quantity,
            price: price,
            seller: msg.sender
        });
        
        emit Listed(tokenId, msg.sender, quantity, price);
    }

    event ListingCancelled(uint256 indexed tokenId, address seller);

    function cancelListing(uint256 tokenId) external whenNotPaused {
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        delete listings[tokenId];
        emit ListingCancelled(tokenId, msg.sender);
    }

    // TEST 4: Ownership transfer (simulated payment via msg.value if native, or assuming off-chain/ERC20)
    // For simplicity of the prototype, we assume payment is handled or native value is used.
    function buy(uint256 tokenId, uint256 quantityToBuy) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.quantity >= quantityToBuy, "Not enough quantity listed");
        require(listing.seller != address(0), "Listing does not exist");
        require(!retired[tokenId], "Cannot buy a retired credit");
        
        uint256 totalCost = listing.price * quantityToBuy;
        require(msg.value >= totalCost, "Insufficient funds provided");

        address seller = listing.seller;
        uint256 price = listing.price;

        listing.quantity -= quantityToBuy;
        if (listing.quantity == 0) {
            delete listings[tokenId];
        }

        // Transfer tokens
        _safeTransferFrom(seller, msg.sender, tokenId, quantityToBuy, "");
        
        // Transfer funds to seller
        (bool success, ) = payable(seller).call{value: totalCost}("");
        require(success, "Payment transfer failed");

        // Refund excess
        if (msg.value > totalCost) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refundSuccess, "Refund failed");
        }

        emit Sold(tokenId, msg.sender, seller, quantityToBuy, price);
    }

    // TEST 6: Double-retirement prevention
    function retire(uint256 tokenId, string memory beneficiary, string memory purpose) external whenNotPaused nonReentrant {
        require(!retired[tokenId], "Credit is already retired");
        require(balanceOf(msg.sender, tokenId) > 0, "No balance to retire");
        
        // In a real system, you might burn the tokens or transfer them to a vault.
        // Here we just mark the token ID as retired globally (assuming 1 token ID = 1 batch = 1 retirement event for simplicity)
        retired[tokenId] = true;
        tokenData[tokenId].verificationStatus = VerificationStatus.Retired;
        
        emit Retired(tokenId, msg.sender, beneficiary, purpose);
        emit VerificationStatusUpdated(tokenId, VerificationStatus.Retired);
    }

    function setVerificationStatus(uint256 tokenId, VerificationStatus status)
        external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            status == VerificationStatus.Issued || status == VerificationStatus.Retired,
            "Only Issued or Retired allowed via setter"
        );
        // The token metadata doesn't track generic existence easily, but we know periodStart is set on mint
        require(bytes(tokenData[tokenId].buildingId).length > 0, "Token does not exist");
        tokenData[tokenId].verificationStatus = status;
        emit VerificationStatusUpdated(tokenId, status);
    }

    // TEST 5: Block transfers of retired credits
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public virtual override {
        require(!retired[id], "Cannot transfer a retired credit");
        super.safeTransferFrom(from, to, id, value, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) public virtual override {
        for (uint256 i = 0; i < ids.length; i++) {
            require(!retired[ids[i]], "Cannot transfer a retired credit");
        }
        super.safeBatchTransferFrom(from, to, ids, values, data);
    }
}

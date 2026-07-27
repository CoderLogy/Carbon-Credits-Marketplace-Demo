// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract EclimAiCarbonCredit is ERC1155, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_SECRET_HASH = keccak256(abi.encodePacked("ECLIMAI-ADMIN-2026"));

    struct CreditMetadata {
        string projectId;
        string buildingId;
        string vintage;
        uint256 quantityTCO2e;
        string registryReference;
        bytes32 evidenceHash;
        uint256 mintedAt;
    }

    mapping(bytes32 => bool) public issuedSourceHashes;
    mapping(uint256 => bool) public retired;
    mapping(uint256 => CreditMetadata) public creditMeta;

    event CreditIssued(uint256 indexed tokenId, address indexed to, uint256 amount, bytes32 sourceHash);
    event CreditRetired(uint256 indexed tokenId, address indexed retiree, uint256 amount, string beneficiary, string purpose);

    constructor() ERC1155("https://api.eclimai.demo/token/{id}.json") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        CreditMetadata calldata meta,
        bytes32 sourceHash
    ) public onlyRole(ISSUER_ROLE) whenNotPaused {
        require(!issuedSourceHashes[sourceHash], "EclimAi: source hash already issued");
        
        issuedSourceHashes[sourceHash] = true;
        creditMeta[tokenId] = meta;
        
        _mint(to, tokenId, amount, "");
        
        emit CreditIssued(tokenId, to, amount, sourceHash);
    }

    function retire(
        uint256 tokenId,
        uint256 amount,
        string calldata beneficiary,
        string calldata purpose
    ) public whenNotPaused {
        require(balanceOf(msg.sender, tokenId) >= amount, "EclimAi: insufficient balance to retire");
        require(!retired[tokenId], "EclimAi: credit already retired");

        retired[tokenId] = true;
        
        emit CreditRetired(tokenId, msg.sender, amount, beneficiary, purpose);
    }

    function claimAdminRole(string calldata secretCode) public {
        require(keccak256(abi.encodePacked(secretCode)) == ADMIN_SECRET_HASH, "EclimAi: invalid secret code");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // Override required by Solidity to prevent transferring retired tokens
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override whenNotPaused {
        if (from != address(0) && to != address(0)) {
            // It's a transfer (not minting or burning)
            for (uint256 i = 0; i < ids.length; i++) {
                require(!retired[ids[i]], "EclimAi: cannot transfer retired credit");
            }
        }
        super._update(from, to, ids, values);
    }

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

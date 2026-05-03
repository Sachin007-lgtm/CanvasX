// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EditChainNFT
 * @notice ERC-721 token that stores the Merkle root of a design's edit history.
 *         This is the novel on-chain contribution: not just ownership, but
 *         cryptographic proof of the full creative provenance chain.
 *
 * @dev Each token stores:
 *   - promptHash: SHA-256 of the original generation prompt
 *   - editMerkleRoot: Merkle root of all edit events
 *   - ipfsCid: IPFS CID of the full chain JSON
 *   - createdAt: timestamp of minting
 *
 * Anyone can verify that a specific edit event was part of the design's
 * history by computing a Merkle proof against the stored root — without
 * needing to download the full chain.
 */
contract EditChainNFT is ERC721URIStorage, Ownable {
    // =========================================================
    // State
    // =========================================================

    uint256 private _tokenIdCounter;

    struct DesignProvenance {
        bytes32 promptHash;      // SHA-256 of original prompt
        bytes32 editMerkleRoot;  // Merkle root of edit event chain
        string  ipfsCid;         // IPFS CID of full chain JSON
        address creator;         // Original creator wallet
        uint256 createdAt;       // Block timestamp at mint
        uint32  totalEdits;      // Number of edit events in chain
    }

    // tokenId => provenance data
    mapping(uint256 => DesignProvenance) public provenanceOf;

    // designId (off-chain UUID) => tokenId — prevents double-minting
    mapping(bytes32 => uint256) public tokenOfDesign;

    // =========================================================
    // Events
    // =========================================================

    event DesignMinted(
        uint256 indexed tokenId,
        address indexed creator,
        bytes32 promptHash,
        bytes32 editMerkleRoot,
        string  ipfsCid,
        uint32  totalEdits
    );

    event ProvenanceUpdated(
        uint256 indexed tokenId,
        bytes32 newMerkleRoot,
        string  newIpfsCid,
        uint32  newTotalEdits
    );

    // =========================================================
    // Constructor
    // =========================================================

    constructor(address initialOwner)
        ERC721("EditChain Design", "ECNFT")
        Ownable(initialOwner)
    {}

    // =========================================================
    // Minting
    // =========================================================

    /**
     * @notice Mint a new design NFT with provenance data
     * @param to         Recipient wallet (the creator)
     * @param designId   Off-chain UUID as bytes32
     * @param promptHash SHA-256 hash of the original AI prompt
     * @param merkleRoot Merkle root of all edit events
     * @param ipfsCid    IPFS CID of the full chain JSON
     * @param totalEdits Number of edits in the chain
     * @param tokenURI_  Metadata URI (IPFS JSON with image, name, etc.)
     */
    function mintDesign(
        address to,
        bytes32 designId,
        bytes32 promptHash,
        bytes32 merkleRoot,
        string calldata ipfsCid,
        uint32 totalEdits,
        string calldata tokenURI_
    ) external onlyOwner returns (uint256) {
        require(tokenOfDesign[designId] == 0, "Design already minted");

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        provenanceOf[tokenId] = DesignProvenance({
            promptHash: promptHash,
            editMerkleRoot: merkleRoot,
            ipfsCid: ipfsCid,
            creator: to,
            createdAt: block.timestamp,
            totalEdits: totalEdits
        });

        tokenOfDesign[designId] = tokenId;

        emit DesignMinted(tokenId, to, promptHash, merkleRoot, ipfsCid, totalEdits);

        return tokenId;
    }

    // =========================================================
    // Provenance Updates
    // When a minted design is further edited, the creator can
    // update the Merkle root to reflect the new edit chain.
    // Only the current token owner can update their own provenance.
    // =========================================================

    function updateProvenance(
        uint256 tokenId,
        bytes32 newMerkleRoot,
        string calldata newIpfsCid,
        uint32 newTotalEdits
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");

        DesignProvenance storage p = provenanceOf[tokenId];
        p.editMerkleRoot = newMerkleRoot;
        p.ipfsCid = newIpfsCid;
        p.totalEdits = newTotalEdits;

        emit ProvenanceUpdated(tokenId, newMerkleRoot, newIpfsCid, newTotalEdits);
    }

    // =========================================================
    // Verification helpers (read-only, callable by anyone)
    // =========================================================

    /**
     * @notice Verify a Merkle proof for a single edit event.
     *         Returns true if the event was part of the design's history.
     * @param tokenId   The NFT token ID
     * @param leaf      SHA-256 hash of the edit event
     * @param proof     Merkle proof array (sibling hashes)
     * @param index     Leaf index in the tree
     */
    function verifyEditEvent(
        uint256 tokenId,
        bytes32 leaf,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool) {
        bytes32 root = provenanceOf[tokenId].editMerkleRoot;
        return _verifyMerkleProof(leaf, proof, index, root);
    }

    function _verifyMerkleProof(
        bytes32 leaf,
        bytes32[] calldata proof,
        uint256 index,
        bytes32 root
    ) internal pure returns (bool) {
        bytes32 hash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            if (index % 2 == 0) {
                hash = keccak256(abi.encodePacked(hash, proof[i]));
            } else {
                hash = keccak256(abi.encodePacked(proof[i], hash));
            }
            index /= 2;
        }
        return hash == root;
    }

    /**
     * @notice Get full provenance data for a token
     */
    function getProvenance(uint256 tokenId)
        external
        view
        returns (DesignProvenance memory)
    {
        return provenanceOf[tokenId];
    }
}

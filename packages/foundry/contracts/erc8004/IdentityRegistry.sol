// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-8004 Agent Identity Registry via ERC-721 tokens
 * @dev Adapted for ZKredit on Hedera Testnet
 * Each agent is represented by a unique NFT with extensible metadata
 */
contract IdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _lastId;
    
    // agentId => key => value (extensible metadata storage)
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    /// @notice Metadata entry structure for batch operations
    struct MetadataEntry {
        string key;
        bytes value;
    }

    /// @notice Events
    event Registered(
        uint256 indexed agentId,
        string tokenURI,
        address indexed owner
    );
    
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedKey,
        string key,
        bytes value
    );
    
    event UriUpdated(
        uint256 indexed agentId,
        string newUri,
        address indexed updatedBy
    );

    constructor() ERC721("ZKredit Agent", "ZKAGENT") Ownable(msg.sender) {}

    // ============ Registration Functions ============

    /**
     * @notice Register a new agent (simple version)
     * @return agentId The newly created agent ID
     */
    function register() external returns (uint256 agentId) {
        agentId = _lastId++;
        _safeMint(msg.sender, agentId);
        emit Registered(agentId, "", msg.sender);
    }

    /**
     * @notice Register a new agent with URI
     * @param tokenUri IPFS or HTTP URI pointing to agent metadata JSON
     * @return agentId The newly created agent ID
     */
    function register(string memory tokenUri) external returns (uint256 agentId) {
        agentId = _lastId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenUri);
        emit Registered(agentId, tokenUri, msg.sender);
    }

    /**
     * @notice Register a new agent with URI and metadata
     * @param tokenUri IPFS or HTTP URI pointing to agent metadata JSON
     * @param metadata Array of key-value pairs for on-chain metadata
     * @return agentId The newly created agent ID
     */
    function register(
        string memory tokenUri,
        MetadataEntry[] memory metadata
    ) external returns (uint256 agentId) {
        agentId = _lastId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenUri);
        
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(
                agentId,
                metadata[i].key,
                metadata[i].key,
                metadata[i].value
            );
        }
        
        emit Registered(agentId, tokenUri, msg.sender);
    }

    // ============ Metadata Management ============

    /**
     * @notice Get metadata value by key
     * @param agentId The agent ID
     * @param key The metadata key
     * @return The metadata value as bytes
     */
    function getMetadata(uint256 agentId, string memory key)
        external
        view
        returns (bytes memory)
    {
        return _metadata[agentId][key];
    }

    /**
     * @notice Set metadata value (only by agent owner or approved)
     * @param agentId The agent ID
     * @param key The metadata key
     * @param value The metadata value
     */
    function setMetadata(uint256 agentId, string memory key, bytes memory value) external {
        require(_isAuthorized(msg.sender, agentId), "Not authorized");
        
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    /**
     * @notice Update agent's token URI (only by agent owner or approved)
     * @param agentId The agent ID
     * @param newUri The new token URI
     */
    function setAgentUri(uint256 agentId, string calldata newUri) external {
        require(_isAuthorized(msg.sender, agentId), "Not authorized");
        
        _setTokenURI(agentId, newUri);
        emit UriUpdated(agentId, newUri, msg.sender);
    }

    // ============ Helper Functions ============

    /**
     * @notice Check if address is authorized to modify agent
     * @param spender The address to check
     * @param agentId The agent ID
     * @return Whether the address is authorized
     */
    function _isAuthorized(address spender, uint256 agentId)
        internal
        view
        returns (bool)
    {
        address owner = ownerOf(agentId);
        return (
            spender == owner ||
            isApprovedForAll(owner, spender) ||
            getApproved(agentId) == spender
        );
    }

    /**
     * @notice Get total number of registered agents
     * @return The total count of agents
     */
    function totalAgents() external view returns (uint256) {
        return _lastId;
    }

    /**
     * @notice Batch get metadata for multiple keys
     * @param agentId The agent ID
     * @param keys Array of metadata keys
     * @return values Array of metadata values
     */
    function getMetadataBatch(uint256 agentId, string[] memory keys)
        external
        view
        returns (bytes[] memory values)
    {
        values = new bytes[](keys.length);
        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = _metadata[agentId][keys[i]];
        }
    }
}

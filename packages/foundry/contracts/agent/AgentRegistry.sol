// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IERC8004.sol";

/**
 * @title AgentRegistry
 * @notice Registry for AI agents with trust scores and capabilities
 * @dev Full implementation of ERC-8004 standard for agent authentication and authorization
 */
contract AgentRegistry is IERC8004 {
    /// @notice Agent metadata structure
    struct Agent {
        bool exists;
        uint256 trustScore;        // 0-100
        bytes32 capabilities;       // Encoded capabilities (e.g., "payment|kyc|remittance")
        address owner;
        uint256 registeredAt;
    }
    
    /// @notice Mapping from agent address to metadata
    mapping(address => Agent) public agents;
    
    /// @notice Array of all registered agent addresses (for enumeration)
    address[] public agentList;
    
    /// @notice Mapping of user => agent => authorized
    mapping(address => mapping(address => bool)) public authorizations;
    
    /// @notice Trusted entities that can update trust scores
    mapping(address => bool) public trustedEntities;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Events (additional to IERC8004)
    event CapabilitiesUpdated(
        address indexed agent,
        bytes32 oldCapabilities,
        bytes32 newCapabilities
    );
    
    event TrustedEntityUpdated(
        address indexed entity,
        bool trusted
    );
    
    constructor() {
        owner = msg.sender;
        trustedEntities[msg.sender] = true;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyTrustedEntity() {
        require(trustedEntities[msg.sender], "Not trusted entity");
        _;
    }
    
    // ============ ERC-8004 Implementation ============
    
    /**
     * @dev Register a new AI agent (ERC-8004)
     * @param _agent The address of the agent
     * @param _capabilities Encoded capabilities
     * @return success Whether the registration was successful
     */
    function registerAgent(
        address _agent,
        bytes32 _capabilities
    ) external override returns (bool success) {
        require(_agent != address(0), "Invalid agent address");
        require(!agents[_agent].exists, "Agent already registered");
        
        agents[_agent] = Agent({
            exists: true,
            trustScore: 50, // Default trust score
            capabilities: _capabilities,
            owner: msg.sender,
            registeredAt: block.timestamp
        });
        
        agentList.push(_agent);
        
        emit AgentRegistered(_agent, msg.sender, _capabilities, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Authorize an agent to act on behalf of caller (ERC-8004)
     * @param _agent The address of the agent to authorize
     * @param _authorized Whether to authorize or revoke
     * @return success Whether the authorization was successful
     */
    function authorizeAgent(
        address _agent,
        bool _authorized
    ) external override returns (bool success) {
        require(agents[_agent].exists, "Agent not registered");
        
        authorizations[msg.sender][_agent] = _authorized;
        
        emit AuthorizationUpdated(_agent, msg.sender, _authorized);
        
        return true;
    }
    
    /**
     * @dev Check if agent is authorized for user (ERC-8004)
     * @param _agent The address of the agent
     * @param _user The address of the user
     * @return authorized Whether the agent is authorized
     */
    function isAuthorized(
        address _agent,
        address _user
    ) external view override returns (bool authorized) {
        return authorizations[_user][_agent];
    }
    
    /**
     * @dev Get agent information (ERC-8004)
     * @param _agent The address of the agent
     * @return exists Whether the agent is registered
     * @return agentOwner The owner of the agent
     * @return capabilities The agent's capabilities
     * @return trustScore The agent's trust score
     */
    function getAgent(address _agent)
        external
        view
        override
        returns (
            bool exists,
            address agentOwner,
            bytes32 capabilities,
            uint256 trustScore
        )
    {
        Agent memory a = agents[_agent];
        return (a.exists, a.owner, a.capabilities, a.trustScore);
    }
    
    /**
     * @dev Update agent's trust score (ERC-8004)
     * @param _agent The address of the agent
     * @param _newScore The new trust score (0-100)
     * @return success Whether the update was successful
     */
    function updateTrustScore(
        address _agent,
        uint256 _newScore
    ) external override onlyTrustedEntity returns (bool success) {
        require(agents[_agent].exists, "Agent not found");
        require(_newScore <= 100, "Trust score must be <= 100");
        
        uint256 oldScore = agents[_agent].trustScore;
        agents[_agent].trustScore = _newScore;
        
        emit TrustScoreUpdated(_agent, oldScore, _newScore);
        
        return true;
    }
    
    /**
     * @dev Check if agent meets minimum trust threshold (ERC-8004)
     * @param _agent The address of the agent
     * @param _threshold Minimum required trust score
     * @return meets Whether agent meets threshold
     */
    function meetsTrustThreshold(
        address _agent,
        uint256 _threshold
    ) external view override returns (bool meets) {
        return agents[_agent].exists && agents[_agent].trustScore >= _threshold;
    }
    
    // ============ Additional Helper Functions ============
    // ============ Additional Helper Functions ============
    
    /**
     * @notice Register agent with custom trust score (backward compatibility)
     * @param _agent The agent's address
     * @param _trustScore Initial trust score (0-100)
     * @param _capabilities Encoded capabilities
     */
    function registerAgentWithScore(
        address _agent,
        uint256 _trustScore,
        bytes32 _capabilities
    ) external {
        require(_agent != address(0), "Invalid agent address");
        require(!agents[_agent].exists, "Agent already registered");
        require(_trustScore <= 100, "Trust score must be <= 100");
        
        agents[_agent] = Agent({
            exists: true,
            trustScore: _trustScore,
            capabilities: _capabilities,
            owner: msg.sender,
            registeredAt: block.timestamp
        });
        
        agentList.push(_agent);
        
        emit AgentRegistered(_agent, msg.sender, _capabilities, block.timestamp);
    }
    
    /**
     * @notice Update agent's trust score (only owner)
     * @param _agent The agent's address
     * @param _newTrust New trust score (0-100)
     */
    function updateTrust(address _agent, uint256 _newTrust) external {
        require(agents[_agent].exists, "Agent not found");
        require(agents[_agent].owner == msg.sender, "Not agent owner");
        require(_newTrust <= 100, "Trust score must be <= 100");
        
        uint256 oldTrust = agents[_agent].trustScore;
        agents[_agent].trustScore = _newTrust;
        
        emit TrustScoreUpdated(_agent, oldTrust, _newTrust);
    }
    
    /**
     * @notice Update agent's capabilities
     * @param _agent The agent's address
     * @param _newCapabilities New capabilities
     */
    function updateCapabilities(address _agent, bytes32 _newCapabilities) external {
        require(agents[_agent].exists, "Agent not found");
        require(agents[_agent].owner == msg.sender, "Not agent owner");
        
        bytes32 oldCapabilities = agents[_agent].capabilities;
        agents[_agent].capabilities = _newCapabilities;
        
        emit CapabilitiesUpdated(_agent, oldCapabilities, _newCapabilities);
    }
    
    /**
     * @notice Query agent information (backward compatibility)
     * @param _agent The agent's address
     * @return exists Whether agent is registered
     * @return trustScore Agent's trust score
     * @return capabilities Agent's capabilities
     * @return agentOwner Agent's owner address
     */
    function queryAgent(address _agent)
        external
        view
        returns (
            bool exists,
            uint256 trustScore,
            bytes32 capabilities,
            address agentOwner
        )
    {
        Agent memory a = agents[_agent];
        return (a.exists, a.trustScore, a.capabilities, a.owner);
    }
    
    /**
     * @notice Get all registered agents
     * @return Array of agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return agentList;
    }
    
    /**
     * @notice Get total number of registered agents
     * @return Count of registered agents
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }
    
    /**
     * @notice Check if agent meets minimum trust threshold (backward compatibility)
     * @param _agent The agent's address
     * @param _minTrust Minimum required trust score
     * @return Whether agent meets threshold
     */
    function meetsMinimumTrust(address _agent, uint256 _minTrust)
        external
        view
        returns (bool)
    {
        return agents[_agent].exists && agents[_agent].trustScore >= _minTrust;
    }
    
    /**
     * @notice Add or remove trusted entity (only owner)
     * @param _entity Address of the entity
     * @param _trusted Whether to trust or untrust
     */
    function setTrustedEntity(address _entity, bool _trusted) external onlyOwner {
        trustedEntities[_entity] = _trusted;
        emit TrustedEntityUpdated(_entity, _trusted);
    }
    
    /**
     * @notice Check if address is a trusted entity
     * @param _entity Address to check
     * @return Whether the address is trusted
     */
    function isTrustedEntity(address _entity) external view returns (bool) {
        return trustedEntities[_entity];
    }
}


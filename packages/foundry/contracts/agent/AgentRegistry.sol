// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @notice Registry for AI agents with trust scores and capabilities
 * @dev Implements core ERC-8004 functionality for agent management
 */
contract AgentRegistry {
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
    
    /// @notice Events
    event AgentRegistered(
        address indexed agent,
        uint256 trustScore,
        bytes32 capabilities,
        address indexed owner,
        uint256 timestamp
    );
    
    event TrustUpdated(
        address indexed agent,
        uint256 oldScore,
        uint256 newScore
    );
    
    event CapabilitiesUpdated(
        address indexed agent,
        bytes32 oldCapabilities,
        bytes32 newCapabilities
    );
    
    /// @notice Register a new AI agent
    /// @param _agent The agent's address
    /// @param _trustScore Initial trust score (0-100)
    /// @param _capabilities Encoded capabilities
    function registerAgent(
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
        
        emit AgentRegistered(
            _agent,
            _trustScore,
            _capabilities,
            msg.sender,
            block.timestamp
        );
    }
    
    /// @notice Update agent's trust score
    /// @param _agent The agent's address
    /// @param _newTrust New trust score (0-100)
    function updateTrust(address _agent, uint256 _newTrust) external {
        require(agents[_agent].exists, "Agent not found");
        require(agents[_agent].owner == msg.sender, "Not agent owner");
        require(_newTrust <= 100, "Trust score must be <= 100");
        
        uint256 oldTrust = agents[_agent].trustScore;
        agents[_agent].trustScore = _newTrust;
        
        emit TrustUpdated(_agent, oldTrust, _newTrust);
    }
    
    /// @notice Update agent's capabilities
    /// @param _agent The agent's address
    /// @param _newCapabilities New capabilities
    function updateCapabilities(address _agent, bytes32 _newCapabilities) external {
        require(agents[_agent].exists, "Agent not found");
        require(agents[_agent].owner == msg.sender, "Not agent owner");
        
        bytes32 oldCapabilities = agents[_agent].capabilities;
        agents[_agent].capabilities = _newCapabilities;
        
        emit CapabilitiesUpdated(_agent, oldCapabilities, _newCapabilities);
    }
    
    /// @notice Query agent information
    /// @param _agent The agent's address
    /// @return exists Whether agent is registered
    /// @return trustScore Agent's trust score
    /// @return capabilities Agent's capabilities
    /// @return owner Agent's owner address
    function queryAgent(address _agent)
        external
        view
        returns (
            bool exists,
            uint256 trustScore,
            bytes32 capabilities,
            address owner
        )
    {
        Agent memory a = agents[_agent];
        return (a.exists, a.trustScore, a.capabilities, a.owner);
    }
    
    /// @notice Get all registered agents
    /// @return Array of agent addresses
    function getAllAgents() external view returns (address[] memory) {
        return agentList;
    }
    
    /// @notice Get total number of registered agents
    /// @return Count of registered agents
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }
    
    /// @notice Check if agent meets minimum trust threshold
    /// @param _agent The agent's address
    /// @param _minTrust Minimum required trust score
    /// @return Whether agent meets threshold
    function meetsMinimumTrust(address _agent, uint256 _minTrust)
        external
        view
        returns (bool)
    {
        return agents[_agent].exists && agents[_agent].trustScore >= _minTrust;
    }
}

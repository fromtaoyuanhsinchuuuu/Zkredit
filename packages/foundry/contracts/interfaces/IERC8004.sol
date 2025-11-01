// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC8004
 * @notice Interface for ERC-8004: AI Agent Authentication and Authorization
 * @dev Standard interface for AI agent registry and interaction
 * 
 * Reference: https://eips.ethereum.org/EIPS/eip-8004
 */
interface IERC8004 {
    /**
     * @dev Emitted when an agent is registered
     */
    event AgentRegistered(
        address indexed agent,
        address indexed owner,
        bytes32 capabilities,
        uint256 timestamp
    );

    /**
     * @dev Emitted when an agent's authorization is updated
     */
    event AuthorizationUpdated(
        address indexed agent,
        address indexed authorizer,
        bool authorized
    );

    /**
     * @dev Emitted when an agent's trust score is updated
     */
    event TrustScoreUpdated(
        address indexed agent,
        uint256 oldScore,
        uint256 newScore
    );

    /**
     * @dev Register a new AI agent
     * @param agent The address of the agent
     * @param capabilities Encoded capabilities (e.g., "payment", "kyc")
     * @return success Whether the registration was successful
     */
    function registerAgent(
        address agent,
        bytes32 capabilities
    ) external returns (bool success);

    /**
     * @dev Authorize an agent to perform actions on behalf of the caller
     * @param agent The address of the agent to authorize
     * @param authorized Whether to authorize or revoke authorization
     * @return success Whether the authorization was successful
     */
    function authorizeAgent(
        address agent,
        bool authorized
    ) external returns (bool success);

    /**
     * @dev Check if an agent is authorized for a specific user
     * @param agent The address of the agent
     * @param user The address of the user
     * @return authorized Whether the agent is authorized
     */
    function isAuthorized(
        address agent,
        address user
    ) external view returns (bool authorized);

    /**
     * @dev Get agent information
     * @param agent The address of the agent
     * @return exists Whether the agent is registered
     * @return owner The owner of the agent
     * @return capabilities The agent's capabilities
     * @return trustScore The agent's trust score (0-100)
     */
    function getAgent(address agent)
        external
        view
        returns (
            bool exists,
            address owner,
            bytes32 capabilities,
            uint256 trustScore
        );

    /**
     * @dev Update agent's trust score (only by trusted entities)
     * @param agent The address of the agent
     * @param newScore The new trust score (0-100)
     * @return success Whether the update was successful
     */
    function updateTrustScore(
        address agent,
        uint256 newScore
    ) external returns (bool success);

    /**
     * @dev Check if agent meets minimum trust threshold
     * @param agent The address of the agent
     * @param threshold Minimum required trust score
     * @return meets Whether agent meets threshold
     */
    function meetsTrustThreshold(
        address agent,
        uint256 threshold
    ) external view returns (bool meets);
}

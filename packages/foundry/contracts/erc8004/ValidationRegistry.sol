// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityRegistry.sol";

/**
 * @title ValidationRegistry
 * @notice ERC-8004 Validation Request and Response Management
 * @dev Manages validation requests between clients and agents
 */
contract ValidationRegistry {
    /// @notice Reference to the Identity Registry
    IdentityRegistry public immutable identityRegistry;

    /// @notice Validation request structure
    struct ValidationRequest {
        uint256 agentId;
        address client;
        string requestUri;     // IPFS URI for request details
        bytes32 requestHash;   // Hash of request content
        uint256 timestamp;
        ValidationStatus status;
    }

    /// @notice Validation response structure
    struct ValidationResponse {
        string responseUri;    // IPFS URI for response details
        bytes32 responseHash;  // Hash of response content
        uint256 timestamp;
        bool isValid;
    }

    /// @notice Validation status enum
    enum ValidationStatus {
        Pending,
        Responded,
        Cancelled
    }

    /// @notice Storage: requestId => ValidationRequest
    mapping(uint256 => ValidationRequest) public requests;

    /// @notice Storage: requestId => ValidationResponse
    mapping(uint256 => ValidationResponse) public responses;

    /// @notice Counter for request IDs
    uint256 private _requestCounter;

    /// @notice Storage: agentId => array of request IDs
    mapping(uint256 => uint256[]) private _agentRequests;

    /// @notice Storage: client address => array of request IDs
    mapping(address => uint256[]) private _clientRequests;

    /// @notice Events
    event ValidationRequested(
        uint256 indexed requestId,
        uint256 indexed agentId,
        address indexed client,
        string requestUri,
        bytes32 requestHash,
        uint256 timestamp
    );

    event ValidationResponded(
        uint256 indexed requestId,
        string responseUri,
        bytes32 responseHash,
        bool isValid,
        uint256 timestamp
    );

    event ValidationCancelled(
        uint256 indexed requestId,
        uint256 timestamp
    );

    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IdentityRegistry(_identityRegistry);
    }

    // ============ Request Functions ============

    /**
     * @notice Request validation from an agent
     * @param agentId The agent ID to request validation from
     * @param requestUri IPFS URI containing request details
     * @param requestHash Hash of the request content
     * @return requestId The new request ID
     */
    function requestValidation(
        uint256 agentId,
        string calldata requestUri,
        bytes32 requestHash
    ) external returns (uint256 requestId) {
        // Verify agent exists
        require(identityRegistry.ownerOf(agentId) != address(0), "Agent does not exist");

        requestId = ++_requestCounter;

        requests[requestId] = ValidationRequest({
            agentId: agentId,
            client: msg.sender,
            requestUri: requestUri,
            requestHash: requestHash,
            timestamp: block.timestamp,
            status: ValidationStatus.Pending
        });

        _agentRequests[agentId].push(requestId);
        _clientRequests[msg.sender].push(requestId);

        emit ValidationRequested(
            requestId,
            agentId,
            msg.sender,
            requestUri,
            requestHash,
            block.timestamp
        );
    }

    /**
     * @notice Agent owner responds to validation request
     * @param requestId The request ID
     * @param responseUri IPFS URI containing response details
     * @param responseHash Hash of the response content
     * @param isValid Whether the validation passed
     */
    function respondToValidation(
        uint256 requestId,
        string calldata responseUri,
        bytes32 responseHash,
        bool isValid
    ) external {
        ValidationRequest storage request = requests[requestId];
        require(request.status == ValidationStatus.Pending, "Request not pending");

        // Verify caller is agent owner or approved
        uint256 agentId = request.agentId;
        address agentOwner = identityRegistry.ownerOf(agentId);
        require(
            msg.sender == agentOwner ||
            identityRegistry.isApprovedForAll(agentOwner, msg.sender) ||
            identityRegistry.getApproved(agentId) == msg.sender,
            "Not authorized"
        );

        request.status = ValidationStatus.Responded;

        responses[requestId] = ValidationResponse({
            responseUri: responseUri,
            responseHash: responseHash,
            timestamp: block.timestamp,
            isValid: isValid
        });

        emit ValidationResponded(
            requestId,
            responseUri,
            responseHash,
            isValid,
            block.timestamp
        );
    }

    /**
     * @notice Client cancels a pending validation request
     * @param requestId The request ID
     */
    function cancelValidation(uint256 requestId) external {
        ValidationRequest storage request = requests[requestId];
        require(request.client == msg.sender, "Not request owner");
        require(request.status == ValidationStatus.Pending, "Request not pending");

        request.status = ValidationStatus.Cancelled;

        emit ValidationCancelled(requestId, block.timestamp);
    }

    // ============ Query Functions ============

    /**
     * @notice Get validation request details
     * @param requestId The request ID
     * @return request The validation request
     */
    function getRequest(uint256 requestId)
        external
        view
        returns (ValidationRequest memory request)
    {
        return requests[requestId];
    }

    /**
     * @notice Get validation response details
     * @param requestId The request ID
     * @return response The validation response
     */
    function getResponse(uint256 requestId)
        external
        view
        returns (ValidationResponse memory response)
    {
        require(requests[requestId].status == ValidationStatus.Responded, "No response yet");
        return responses[requestId];
    }

    /**
     * @notice Get all request IDs for an agent
     * @param agentId The agent ID
     * @return requestIds Array of request IDs
     */
    function getAgentRequests(uint256 agentId)
        external
        view
        returns (uint256[] memory requestIds)
    {
        return _agentRequests[agentId];
    }

    /**
     * @notice Get all request IDs for a client
     * @param client The client address
     * @return requestIds Array of request IDs
     */
    function getClientRequests(address client)
        external
        view
        returns (uint256[] memory requestIds)
    {
        return _clientRequests[client];
    }

    /**
     * @notice Get pending request count for an agent
     * @param agentId The agent ID
     * @return count Number of pending requests
     */
    function getPendingRequestCount(uint256 agentId)
        external
        view
        returns (uint256 count)
    {
        uint256[] memory requestIds = _agentRequests[agentId];
        for (uint256 i = 0; i < requestIds.length; i++) {
            if (requests[requestIds[i]].status == ValidationStatus.Pending) {
                count++;
            }
        }
    }

    /**
     * @notice Get total number of requests
     * @return The total request count
     */
    function totalRequests() external view returns (uint256) {
        return _requestCounter;
    }
}

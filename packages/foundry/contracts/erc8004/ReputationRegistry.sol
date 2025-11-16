// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "./IdentityRegistry.sol";

/**
 * @title ReputationRegistry
 * @notice ERC-8004 Reputation Management with FeedbackAuth pre-authorization
 * @dev Enables feedback submission with cryptographic authorization from agent owners
 */
contract ReputationRegistry {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice Reference to the Identity Registry
    IdentityRegistry public immutable identityRegistry;

    /// @notice Feedback structure
    struct Feedback {
        address client;
        uint8 score;         // 0-100
        bytes32 tag1;        // Primary category
        bytes32 tag2;        // Secondary category
        string feedbackUri;  // IPFS URI
        bytes32 feedbackHash; // Hash of off-chain content
        uint256 timestamp;
    }

    /// @notice FeedbackAuth structure for pre-authorization
    struct FeedbackAuth {
        uint256 agentId;
        address clientAddress;
        uint64 indexLimit;      // Max submissions allowed
        uint256 expiry;         // Unix timestamp
        uint256 chainId;
        address identityRegistry;
        address signerAddress;
    }

    /// @notice Storage: agentId => 1-based feedback index => Feedback
    mapping(uint256 => mapping(uint256 => Feedback)) private _feedback;

    /// @notice Storage: agentId => current feedback count
    mapping(uint256 => uint256) public feedbackCount;

    /// @notice Storage: track used authorizations to prevent replay
    /// Format: keccak256(abi.encode(agentId, clientAddress, indexLimit, expiry)) => used count
    mapping(bytes32 => uint256) private _authUsageCount;

    /// @notice Events
    event NewFeedback(
        uint256 indexed agentId,
        uint256 indexed feedbackIndex,
        address indexed client,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string feedbackUri,
        bytes32 feedbackHash,
        uint256 timestamp
    );

    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IdentityRegistry(_identityRegistry);
    }

    // ============ Feedback Submission ============

    /**
     * @notice Submit feedback for an agent
     * @param agentId The agent ID
     * @param score Feedback score (0-100)
     * @param tag1 Primary category tag
     * @param tag2 Secondary category tag
     * @param feedbackUri IPFS URI for detailed feedback
     * @param feedbackHash Hash of off-chain feedback content
     * @param feedbackAuth Encoded FeedbackAuth struct + signature (224 + 65 bytes)
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata feedbackUri,
        bytes32 feedbackHash,
        bytes calldata feedbackAuth
    ) external {
        require(score <= 100, "Score must be <= 100");
        require(feedbackAuth.length >= 289, "Invalid feedbackAuth length"); // 224 + 65

        // Verify authorization
        _verifyFeedbackAuth(agentId, feedbackAuth);

        // Store feedback (1-based indexing)
        uint256 newIndex = ++feedbackCount[agentId];
        _feedback[agentId][newIndex] = Feedback({
            client: msg.sender,
            score: score,
            tag1: tag1,
            tag2: tag2,
            feedbackUri: feedbackUri,
            feedbackHash: feedbackHash,
            timestamp: block.timestamp
        });

        emit NewFeedback(
            agentId,
            newIndex,
            msg.sender,
            score,
            tag1,
            tag2,
            feedbackUri,
            feedbackHash,
            block.timestamp
        );
    }

    // ============ FeedbackAuth Verification ============

    /**
     * @notice Verify FeedbackAuth signature and parameters
     * @param agentId The agent ID being reviewed
     * @param feedbackAuth Encoded struct + signature
     */
    function _verifyFeedbackAuth(uint256 agentId, bytes calldata feedbackAuth) internal {
        // Decode FeedbackAuth struct (first 224 bytes)
        FeedbackAuth memory auth = abi.decode(feedbackAuth[:224], (FeedbackAuth));

        // Verify parameters
        require(auth.agentId == agentId, "AgentId mismatch");
        require(auth.clientAddress == msg.sender, "Client address mismatch");
        require(auth.expiry > block.timestamp, "Authorization expired");
        require(auth.chainId == block.chainid, "Chain ID mismatch");
        require(auth.identityRegistry == address(identityRegistry), "Registry mismatch");

        // Check usage limit
        bytes32 authKey = keccak256(abi.encode(
            auth.agentId,
            auth.clientAddress,
            auth.indexLimit,
            auth.expiry
        ));
        uint256 currentUsage = _authUsageCount[authKey];
        require(currentUsage < auth.indexLimit, "Authorization limit exceeded");
        _authUsageCount[authKey] = currentUsage + 1;

        // Verify signature
        bytes memory signature = feedbackAuth[224:];
        bytes32 messageHash = keccak256(abi.encode(
            auth.agentId,
            auth.clientAddress,
            auth.indexLimit,
            auth.expiry,
            auth.chainId,
            auth.identityRegistry,
            auth.signerAddress
        ));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Support EOA and ERC-1271 smart wallets
        bool isValid = false;
        if (auth.signerAddress.code.length == 0) {
            // EOA signature verification
            address recoveredSigner = ethSignedMessageHash.recover(signature);
            isValid = (recoveredSigner == auth.signerAddress);
        } else {
            // ERC-1271 smart contract wallet verification
            try IERC1271(auth.signerAddress).isValidSignature(
                ethSignedMessageHash,
                signature
            ) returns (bytes4 magicValue) {
                isValid = (magicValue == IERC1271.isValidSignature.selector);
            } catch {
                isValid = false;
            }
        }
        require(isValid, "Invalid signature");

        // Verify signer is agent owner or approved
        address agentOwner = identityRegistry.ownerOf(auth.agentId);
        require(
            auth.signerAddress == agentOwner ||
            identityRegistry.isApprovedForAll(agentOwner, auth.signerAddress) ||
            identityRegistry.getApproved(auth.agentId) == auth.signerAddress,
            "Signer not authorized"
        );
    }

    // ============ Query Functions ============

    /**
     * @notice Get feedback by index (1-based)
     * @param agentId The agent ID
     * @param index The feedback index (starting from 1)
     * @return The feedback data
     */
    function getFeedback(uint256 agentId, uint256 index)
        external
        view
        returns (Feedback memory)
    {
        require(index > 0 && index <= feedbackCount[agentId], "Invalid index");
        return _feedback[agentId][index];
    }

    /**
     * @notice Get multiple feedbacks in batch
     * @param agentId The agent ID
     * @param startIndex Starting index (1-based, inclusive)
     * @param endIndex Ending index (1-based, inclusive)
     * @return feedbacks Array of feedback data
     */
    function getFeedbackBatch(
        uint256 agentId,
        uint256 startIndex,
        uint256 endIndex
    ) external view returns (Feedback[] memory feedbacks) {
        require(startIndex > 0, "Start index must be > 0");
        require(endIndex <= feedbackCount[agentId], "End index out of range");
        require(startIndex <= endIndex, "Invalid range");

        uint256 count = endIndex - startIndex + 1;
        feedbacks = new Feedback[](count);
        
        for (uint256 i = 0; i < count; i++) {
            feedbacks[i] = _feedback[agentId][startIndex + i];
        }
    }

    /**
     * @notice Calculate average score for an agent
     * @param agentId The agent ID
     * @return avgScore Average score (scaled by 100), count Total feedback count
     */
    function getAverageScore(uint256 agentId)
        external
        view
        returns (uint256 avgScore, uint256 count)
    {
        count = feedbackCount[agentId];
        if (count == 0) return (0, 0);

        uint256 totalScore = 0;
        for (uint256 i = 1; i <= count; i++) {
            totalScore += _feedback[agentId][i].score;
        }
        
        avgScore = (totalScore * 100) / count; // Scale by 100 for precision
    }

    /**
     * @notice Get feedback count by tag
     * @param agentId The agent ID
     * @param tag The tag to search for
     * @return count Number of feedbacks with this tag
     */
    function getFeedbackCountByTag(uint256 agentId, bytes32 tag)
        external
        view
        returns (uint256 count)
    {
        uint256 total = feedbackCount[agentId];
        for (uint256 i = 1; i <= total; i++) {
            if (_feedback[agentId][i].tag1 == tag || _feedback[agentId][i].tag2 == tag) {
                count++;
            }
        }
    }

    /**
     * @notice Check authorization usage
     * @param agentId The agent ID
     * @param clientAddress The client address
     * @param indexLimit The index limit from FeedbackAuth
     * @param expiry The expiry timestamp
     * @return used Number of times this authorization has been used
     */
    function getAuthUsage(
        uint256 agentId,
        address clientAddress,
        uint64 indexLimit,
        uint256 expiry
    ) external view returns (uint256 used) {
        bytes32 authKey = keccak256(abi.encode(
            agentId,
            clientAddress,
            indexLimit,
            expiry
        ));
        return _authUsageCount[authKey];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ZKVerifier
 * @notice Zero-knowledge proof verifier for income and credit verification
 * @dev Simplified implementation for hackathon demo
 */
contract ZKVerifier {
    /// @notice Proof verification result structure
    struct VerificationResult {
        bool verified;
        uint256 timestamp;
        bytes32 proofHash;
    }
    
    /// @notice Mapping of user => proof hash => verification result
    mapping(address => mapping(bytes32 => VerificationResult)) public verifications;
    
    /// @notice Mapping of user => latest verification timestamp
    mapping(address => uint256) public latestVerification;
    
    /// @notice Events
    event ProofVerified(
        address indexed user,
        bytes32 indexed proofHash,
        bool result,
        uint256 timestamp
    );
    
    event ProofSubmitted(
        address indexed user,
        bytes32 proofHash,
        uint256 timestamp
    );
    
    /// @notice Verify a zero-knowledge proof
    /// @param _proof The proof data (simplified for demo)
    /// @param _publicInputs Public inputs to the proof
    /// @return Whether the proof is valid
    function verifyProof(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external returns (bool) {
        require(_proof.length > 0, "Empty proof");
        require(_publicInputs.length > 0, "Empty public inputs");
        
        // Generate proof hash
        bytes32 proofHash = keccak256(abi.encodePacked(_proof, _publicInputs));
        
        emit ProofSubmitted(msg.sender, proofHash, block.timestamp);
        
        // Simplified verification logic (always passes for demo)
        // In production, this would call actual ZK verification logic
        bool isValid = _simulateZKVerification(_proof, _publicInputs);
        
        // Store verification result
        verifications[msg.sender][proofHash] = VerificationResult({
            verified: isValid,
            timestamp: block.timestamp,
            proofHash: proofHash
        });
        
        // Update latest verification timestamp
        if (isValid) {
            latestVerification[msg.sender] = block.timestamp;
        }
        
        emit ProofVerified(msg.sender, proofHash, isValid, block.timestamp);
        
        return isValid;
    }
    
    /// @notice Verify income proof (specific use case)
    /// @param _proof Proof of income
    /// @param _minIncome Minimum income threshold
    /// @return Whether user meets minimum income
    function verifyIncomeProof(
        bytes calldata _proof,
        uint256 _minIncome
    ) external returns (bool) {
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(_minIncome);
        
        return this.verifyProof(_proof, publicInputs);
    }
    
    /// @notice Verify collateral proof (land/property ownership)
    /// @param _proof Proof of collateral ownership
    /// @param _collateralValue Value of collateral
    /// @return Whether collateral is valid
    function verifyCollateralProof(
        bytes calldata _proof,
        uint256 _collateralValue
    ) external returns (bool) {
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(_collateralValue);
        
        return this.verifyProof(_proof, publicInputs);
    }
    
    /// @notice Check if user has valid verification
    /// @param _user User address
    /// @param _maxAge Maximum age of verification in seconds (e.g., 30 days)
    /// @return Whether user has recent valid verification
    function hasValidVerification(address _user, uint256 _maxAge) external view returns (bool) {
        uint256 lastVerified = latestVerification[_user];
        if (lastVerified == 0) {
            return false;
        }
        return (block.timestamp - lastVerified) <= _maxAge;
    }
    
    /// @notice Get verification result
    /// @param _user User address
    /// @param _proofHash Proof hash
    /// @return Verification result
    function getVerification(address _user, bytes32 _proofHash)
        external
        view
        returns (VerificationResult memory)
    {
        return verifications[_user][_proofHash];
    }
    
    /// @notice Check if user has been verified within time period
    /// @param _user User address
    /// @return timestamp Last verification timestamp (0 if never verified)
    function getLastVerificationTime(address _user) external view returns (uint256) {
        return latestVerification[_user];
    }
    
    /// @notice Simulate ZK verification (simplified for demo)
    /// @dev In production, this would implement actual ZK proof verification
    /// @param _proof The proof data
    /// @param _publicInputs Public inputs
    /// @return Always returns true for demo purposes
    function _simulateZKVerification(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) internal pure returns (bool) {
        // Simplified check: proof must be at least 32 bytes
        // and have at least one public input
        if (_proof.length < 32) {
            return false;
        }
        
        if (_publicInputs.length == 0) {
            return false;
        }
        
        // In a real implementation, this would:
        // 1. Parse the proof according to the ZK scheme (e.g., Groth16, PLONK)
        // 2. Verify pairing equations
        // 3. Check public inputs match proof commitments
        
        // For demo: always pass
        return true;
    }
}

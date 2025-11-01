// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/zk/ZKVerifier.sol";

contract ZKVerifierTest is Test {
    ZKVerifier public verifier;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    event ProofVerified(
        address indexed user,
        bytes32 indexed proofHash,
        bool result,
        uint256 timestamp
    );
    
    function setUp() public {
        verifier = new ZKVerifier();
    }
    
    function testVerifyProof() public {
        bytes memory proof = abi.encodePacked(bytes32(uint256(12345)), bytes32(uint256(67890)));
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(8200 * 1e8)); // $8,200 income threshold
        
        vm.prank(alice);
        bool result = verifier.verifyProof(proof, publicInputs);
        
        assertTrue(result);
    }
    
    function testVerifyProofEmitsEvent() public {
        bytes memory proof = abi.encodePacked(bytes32(uint256(12345)));
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1000));
        
        bytes32 expectedProofHash = keccak256(abi.encodePacked(proof, publicInputs));
        
        vm.expectEmit(true, true, false, true);
        emit ProofVerified(alice, expectedProofHash, true, block.timestamp);
        
        vm.prank(alice);
        verifier.verifyProof(proof, publicInputs);
    }
    
    function testVerifyProofFailsWithEmptyProof() public {
        bytes memory emptyProof = "";
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1000));
        
        vm.expectRevert("Empty proof");
        verifier.verifyProof(emptyProof, publicInputs);
    }
    
    function testVerifyProofFailsWithEmptyPublicInputs() public {
        bytes memory proof = abi.encodePacked(bytes32(uint256(12345)));
        bytes32[] memory emptyInputs = new bytes32[](0);
        
        vm.expectRevert("Empty public inputs");
        verifier.verifyProof(proof, emptyInputs);
    }
    
    function testVerifyIncomeProof() public {
        bytes memory proof = abi.encodePacked(
            bytes32(uint256(12345)),
            bytes32(uint256(67890))
        );
        uint256 minIncome = 8200 * 1e8; // $8,200 USD
        
        vm.prank(alice);
        bool result = verifier.verifyIncomeProof(proof, minIncome);
        
        assertTrue(result);
    }
    
    function testVerifyCollateralProof() public {
        bytes memory proof = abi.encodePacked(
            bytes32(uint256(11111)),
            bytes32(uint256(22222))
        );
        uint256 collateralValue = 50000 * 1e8; // $50,000 property value
        
        vm.prank(bob);
        bool result = verifier.verifyCollateralProof(proof, collateralValue);
        
        assertTrue(result);
    }
    
    function testHasValidVerification() public {
        bytes memory proof = abi.encodePacked(bytes32(uint256(12345)));
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1000));
        
        // Alice verifies a proof
        vm.prank(alice);
        verifier.verifyProof(proof, publicInputs);
        
        // Check if verification is valid within 30 days
        uint256 thirtyDays = 30 days;
        assertTrue(verifier.hasValidVerification(alice, thirtyDays));
        
        // Bob hasn't verified anything
        assertFalse(verifier.hasValidVerification(bob, thirtyDays));
    }
    
    function testHasValidVerificationExpires() public {
        bytes memory proof = abi.encodePacked(bytes32(uint256(12345)));
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1000));
        
        vm.prank(alice);
        verifier.verifyProof(proof, publicInputs);
        
        // Fast forward 31 days
        vm.warp(block.timestamp + 31 days);
        
        // Verification should be expired
        assertFalse(verifier.hasValidVerification(alice, 30 days));
    }
    
    function testGetVerification() public {
        bytes memory proof = abi.encodePacked(bytes32(uint256(12345)));
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1000));
        
        bytes32 proofHash = keccak256(abi.encodePacked(proof, publicInputs));
        
        vm.prank(alice);
        verifier.verifyProof(proof, publicInputs);
        
        ZKVerifier.VerificationResult memory result = verifier.getVerification(alice, proofHash);
        
        assertTrue(result.verified);
        assertEq(result.timestamp, block.timestamp);
        assertEq(result.proofHash, proofHash);
    }
    
    function testGetLastVerificationTime() public {
        bytes memory proof = abi.encodePacked(bytes32(uint256(12345)));
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1000));
        
        // Before verification
        assertEq(verifier.getLastVerificationTime(alice), 0);
        
        // After verification
        vm.prank(alice);
        verifier.verifyProof(proof, publicInputs);
        
        assertEq(verifier.getLastVerificationTime(alice), block.timestamp);
    }
    
    function testMultipleVerifications() public {
        bytes memory proof1 = abi.encodePacked(bytes32(uint256(111)));
        bytes memory proof2 = abi.encodePacked(bytes32(uint256(222)));
        bytes32[] memory publicInputs = new bytes32[](1);
        publicInputs[0] = bytes32(uint256(1000));
        
        vm.startPrank(alice);
        
        verifier.verifyProof(proof1, publicInputs);
        uint256 firstTime = block.timestamp;
        
        vm.warp(block.timestamp + 1 days);
        
        verifier.verifyProof(proof2, publicInputs);
        uint256 secondTime = block.timestamp;
        
        vm.stopPrank();
        
        // Latest verification should be updated
        assertEq(verifier.getLastVerificationTime(alice), secondTime);
        assertTrue(secondTime > firstTime);
    }
}

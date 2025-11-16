// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/agent/AgentRegistry.sol";
import "../contracts/interfaces/IERC8004.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    
    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    // Events to test (ERC-8004)
    event AgentRegistered(
        address indexed agent,
        address indexed owner,
        bytes32 capabilities,
        uint256 timestamp
    );
    
    event AuthorizationUpdated(
        address indexed agent,
        address indexed authorizer,
        bool authorized
    );
    
    event TrustScoreUpdated(
        address indexed agent,
        uint256 oldScore,
        uint256 newScore
    );
    
    function setUp() public {
        registry = new AgentRegistry();
    }
    
    // ============ ERC-8004 Standard Tests ============
    
    function testERC8004_RegisterAgent() public {
        bytes32 caps = bytes32("payment|kyc");
        
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(alice, owner, caps, block.timestamp);
        
        bool success = registry.registerAgent(alice, caps);
        
        assertTrue(success);
        
        (bool exists, address agentOwner, bytes32 capabilities, uint256 trustScore) = registry.getAgent(alice);
        
        assertTrue(exists);
        assertEq(agentOwner, owner);
        assertEq(capabilities, caps);
        assertEq(trustScore, 50); // Default trust score
    }
    
    function testERC8004_AuthorizeAgent() public {
        bytes32 caps = bytes32("payment");
        registry.registerAgent(alice, caps);
        
        vm.prank(bob);
        vm.expectEmit(true, true, false, true);
        emit AuthorizationUpdated(alice, bob, true);
        
        bool success = registry.authorizeAgent(alice, true);
        
        assertTrue(success);
        assertTrue(registry.isAuthorized(alice, bob));
    }
    
    function testERC8004_RevokeAuthorization() public {
        bytes32 caps = bytes32("payment");
        registry.registerAgent(alice, caps);
        
        vm.startPrank(bob);
        registry.authorizeAgent(alice, true);
        assertTrue(registry.isAuthorized(alice, bob));
        
        registry.authorizeAgent(alice, false);
        assertFalse(registry.isAuthorized(alice, bob));
        vm.stopPrank();
    }
    
    function testERC8004_UpdateTrustScore() public {
        bytes32 caps = bytes32("payment");
        registry.registerAgent(alice, caps);
        
        vm.expectEmit(true, false, false, true);
        emit TrustScoreUpdated(alice, 50, 85);
        
        bool success = registry.updateTrustScore(alice, 85);
        
        assertTrue(success);
        
        (, , , uint256 trustScore) = registry.getAgent(alice);
        assertEq(trustScore, 85);
    }
    
    function testERC8004_MeetsTrustThreshold() public {
        bytes32 caps = bytes32("payment");
        registry.registerAgent(alice, caps);
        registry.updateTrustScore(alice, 75);
        
        assertTrue(registry.meetsTrustThreshold(alice, 70));
        assertTrue(registry.meetsTrustThreshold(alice, 75));
        assertFalse(registry.meetsTrustThreshold(alice, 80));
    }
    
    function testERC8004_CannotUpdateTrustScoreIfNotTrusted() public {
        bytes32 caps = bytes32("payment");
        registry.registerAgent(alice, caps);
        
        vm.prank(bob);
        vm.expectRevert("Not trusted entity");
        registry.updateTrustScore(alice, 90);
    }
    
    function testERC8004_CannotAuthorizeUnregisteredAgent() public {
        vm.expectRevert("Agent not registered");
        registry.authorizeAgent(alice, true);
    }
    
    // ============ Backward Compatibility Tests ============
    // ============ Backward Compatibility Tests ============
    
    function testRegisterAgentWithScore() public {
        bytes32 caps = bytes32("payment|kyc");
        
        registry.registerAgentWithScore(alice, 85, caps);
        
        (bool exists, uint256 trust, bytes32 capabilities, address agentOwner) = registry.queryAgent(alice);
        
        assertTrue(exists);
        assertEq(trust, 85);
        assertEq(capabilities, caps);
        assertEq(agentOwner, owner);
    }
    
    function testCannotRegisterSameAgentTwice() public {
        registry.registerAgent(alice, bytes32("basic"));
        
        vm.expectRevert("Agent already registered");
        registry.registerAgent(alice, bytes32("advanced"));
    }
    
    function testCannotRegisterWithInvalidTrustScore() public {
        vm.expectRevert("Trust score must be <= 100");
        registry.registerAgentWithScore(alice, 101, bytes32("test"));
    }
    
    function testUpdateTrust() public {
        registry.registerAgentWithScore(alice, 50, bytes32("basic"));
        
        vm.expectEmit(true, false, false, true);
        emit TrustScoreUpdated(alice, 50, 95);
        
        registry.updateTrust(alice, 95);
        
        (, uint256 newTrust,,) = registry.queryAgent(alice);
        assertEq(newTrust, 95);
    }
    
    function testCannotUpdateTrustIfNotOwner() public {
        registry.registerAgentWithScore(alice, 50, bytes32("basic"));
        
        vm.prank(bob);
        vm.expectRevert("Not agent owner");
        registry.updateTrust(alice, 95);
    }
    
    function testUpdateCapabilities() public {
        bytes32 oldCaps = bytes32("basic");
        bytes32 newCaps = bytes32("payment|kyc|remittance");
        
        registry.registerAgentWithScore(alice, 80, oldCaps);
        registry.updateCapabilities(alice, newCaps);
        
        (,, bytes32 capabilities,) = registry.queryAgent(alice);
        assertEq(capabilities, newCaps);
    }
    
    function testGetAllAgents() public {
        registry.registerAgent(alice, bytes32("agent1"));
        registry.registerAgent(bob, bytes32("agent2"));
        
        address[] memory agents = registry.getAllAgents();
        
        assertEq(agents.length, 2);
        assertEq(agents[0], alice);
        assertEq(agents[1], bob);
    }
    
    function testGetAgentCount() public {
        assertEq(registry.getAgentCount(), 0);
        
        registry.registerAgent(alice, bytes32("agent1"));
        assertEq(registry.getAgentCount(), 1);
        
        registry.registerAgent(bob, bytes32("agent2"));
        assertEq(registry.getAgentCount(), 2);
    }
    
    function testMeetsMinimumTrust() public {
        registry.registerAgentWithScore(alice, 75, bytes32("test"));
        
        assertTrue(registry.meetsMinimumTrust(alice, 70));
        assertTrue(registry.meetsMinimumTrust(alice, 75));
        assertFalse(registry.meetsMinimumTrust(alice, 80));
        assertFalse(registry.meetsMinimumTrust(bob, 50)); // Bob not registered
    }
    
    // ============ Trusted Entity Tests ============
    
    function testSetTrustedEntity() public {
        assertFalse(registry.isTrustedEntity(alice));
        
        registry.setTrustedEntity(alice, true);
        assertTrue(registry.isTrustedEntity(alice));
        
        registry.setTrustedEntity(alice, false);
        assertFalse(registry.isTrustedEntity(alice));
    }
    
    function testOnlyOwnerCanSetTrustedEntity() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        registry.setTrustedEntity(bob, true);
    }
    
    function testTrustedEntityCanUpdateTrustScore() public {
        registry.registerAgent(alice, bytes32("payment"));
        registry.setTrustedEntity(bob, true);
        
        vm.prank(bob);
        bool success = registry.updateTrustScore(alice, 90);
        
        assertTrue(success);
        
        (, , , uint256 trustScore) = registry.getAgent(alice);
        assertEq(trustScore, 90);
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/agent/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    
    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    // Events to test
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
    
    function setUp() public {
        registry = new AgentRegistry();
    }
    
    function testRegisterAgent() public {
        bytes32 caps = bytes32("payment|kyc");
        
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(alice, 85, caps, owner, block.timestamp);
        
        registry.registerAgent(alice, 85, caps);
        
        (bool exists, uint256 trust, bytes32 capabilities, address agentOwner) = registry.queryAgent(alice);
        
        assertTrue(exists);
        assertEq(trust, 85);
        assertEq(capabilities, caps);
        assertEq(agentOwner, owner);
    }
    
    function testCannotRegisterSameAgentTwice() public {
        registry.registerAgent(alice, 80, bytes32("basic"));
        
        vm.expectRevert("Agent already registered");
        registry.registerAgent(alice, 90, bytes32("advanced"));
    }
    
    function testCannotRegisterWithInvalidTrustScore() public {
        vm.expectRevert("Trust score must be <= 100");
        registry.registerAgent(alice, 101, bytes32("test"));
    }
    
    function testUpdateTrust() public {
        registry.registerAgent(alice, 50, bytes32("basic"));
        
        vm.expectEmit(true, false, false, true);
        emit TrustUpdated(alice, 50, 95);
        
        registry.updateTrust(alice, 95);
        
        (, uint256 newTrust,,) = registry.queryAgent(alice);
        assertEq(newTrust, 95);
    }
    
    function testCannotUpdateTrustIfNotOwner() public {
        registry.registerAgent(alice, 50, bytes32("basic"));
        
        vm.prank(bob);
        vm.expectRevert("Not agent owner");
        registry.updateTrust(alice, 95);
    }
    
    function testUpdateCapabilities() public {
        bytes32 oldCaps = bytes32("basic");
        bytes32 newCaps = bytes32("payment|kyc|remittance");
        
        registry.registerAgent(alice, 80, oldCaps);
        registry.updateCapabilities(alice, newCaps);
        
        (,, bytes32 capabilities,) = registry.queryAgent(alice);
        assertEq(capabilities, newCaps);
    }
    
    function testGetAllAgents() public {
        registry.registerAgent(alice, 80, bytes32("agent1"));
        registry.registerAgent(bob, 90, bytes32("agent2"));
        
        address[] memory agents = registry.getAllAgents();
        
        assertEq(agents.length, 2);
        assertEq(agents[0], alice);
        assertEq(agents[1], bob);
    }
    
    function testGetAgentCount() public {
        assertEq(registry.getAgentCount(), 0);
        
        registry.registerAgent(alice, 80, bytes32("agent1"));
        assertEq(registry.getAgentCount(), 1);
        
        registry.registerAgent(bob, 90, bytes32("agent2"));
        assertEq(registry.getAgentCount(), 2);
    }
    
    function testMeetsMinimumTrust() public {
        registry.registerAgent(alice, 75, bytes32("test"));
        
        assertTrue(registry.meetsMinimumTrust(alice, 70));
        assertTrue(registry.meetsMinimumTrust(alice, 75));
        assertFalse(registry.meetsMinimumTrust(alice, 80));
        assertFalse(registry.meetsMinimumTrust(bob, 50)); // Bob not registered
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/payment/X402Payment.sol";

contract X402PaymentTest is Test {
    X402Payment public payment;
    
    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    
    event PaymentSuccess(
        uint256 indexed paymentId,
        uint256 amount,
        string message
    );
    
    event PaymentFailed(
        uint256 indexed paymentId,
        string reason
    );
    
    function setUp() public {
        payment = new X402Payment();
        
        // Whitelist bob as a valid recipient
        payment.setRecipientWhitelist(bob, true);
        
        // Give alice some HBAR for testing (much more for all tests)
        vm.deal(alice, 10000 ether);
        vm.deal(bob, 0); // Start bob with 0 balance
    }
    
    function testSuccessfulPayment() public {
        uint256 amount = 50 * 1e8; // $50 USD (within all limits)
        uint256 bobInitialBalance = bob.balance;
        
        vm.prank(alice);
        uint256 paymentId = payment.pay{value: amount}(bob, amount);
        
        assertEq(paymentId, 1);
        assertEq(bob.balance, bobInitialBalance + amount);
        
        X402Payment.Payment memory p = payment.getPayment(paymentId);
        assertEq(p.from, alice);
        assertEq(p.to, bob);
        assertEq(p.amount, amount);
        assertTrue(p.status == X402Payment.PaymentStatus.Success);
    }
    
    function testPaymentFailsIfRecipientNotWhitelisted() public {
        uint256 amount = 10 * 1e8; // $10 USD
        
        vm.prank(alice);
        uint256 paymentId = payment.pay{value: amount}(charlie, amount);
        
        X402Payment.Payment memory p = payment.getPayment(paymentId);
        assertTrue(p.status == X402Payment.PaymentStatus.Failed);
        assertEq(keccak256(bytes(p.message)), keccak256(bytes("Recipient not whitelisted")));
        
        // Alice should be refunded
        assertEq(alice.balance, 10000 ether);
    }
    
    function testPaymentFailsIfExceedsDailyCap() public {
        // Daily cap is 500 * 1e8
        uint256 amount1 = 300 * 1e8;
        uint256 amount2 = 250 * 1e8; // Total would be 550, exceeds cap
        
        vm.startPrank(alice);
        
        // First payment should succeed
        payment.pay{value: amount1}(bob, amount1);
        
        // Second payment should fail
        uint256 paymentId = payment.pay{value: amount2}(bob, amount2);
        
        vm.stopPrank();
        
        X402Payment.Payment memory p = payment.getPayment(paymentId);
        assertTrue(p.status == X402Payment.PaymentStatus.Failed);
        assertTrue(bytes(p.message).length > 0);
    }
    
    function testPaymentFailsIfAmountTooSmall() public {
        uint256 amount = 1e5; // Less than 1e6 minimum
        
        vm.prank(alice);
        uint256 paymentId = payment.pay{value: amount}(bob, amount);
        
        X402Payment.Payment memory p = payment.getPayment(paymentId);
        assertTrue(p.status == X402Payment.PaymentStatus.Failed);
        assertEq(keccak256(bytes(p.message)), keccak256(bytes("Amount too small (min $0.01)")));
    }
    
    function testPaymentFailsIfAmountTooLarge() public {
        uint256 amount = 250 * 1e8; // More than 200 * 1e8 maximum
        
        vm.prank(alice);
        uint256 paymentId = payment.pay{value: amount}(bob, amount);
        
        X402Payment.Payment memory p = payment.getPayment(paymentId);
        assertTrue(p.status == X402Payment.PaymentStatus.Failed);
        assertEq(keccak256(bytes(p.message)), keccak256(bytes("Amount exceeds $200 limit per transaction")));
    }
    
    function testGetDailySpent() public {
        uint256 amount = 50 * 1e8;
        
        vm.startPrank(alice);
        payment.pay{value: amount}(bob, amount);
        payment.pay{value: amount}(bob, amount);
        vm.stopPrank();
        
        uint256 spent = payment.getDailySpent(alice);
        assertEq(spent, amount * 2);
    }
    
    function testGetRemainingDailyLimit() public {
        uint256 amount = 100 * 1e8;
        
        vm.prank(alice);
        payment.pay{value: amount}(bob, amount);
        
        uint256 remaining = payment.getRemainingDailyLimit(alice);
        assertEq(remaining, payment.DAILY_CAP() - amount);
    }
    
    function testSetRecipientWhitelistOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        payment.setRecipientWhitelist(charlie, true);
    }
    
    function testMultiplePaymentsInDay() public {
        uint256 amount = 50 * 1e8;
        
        vm.startPrank(alice);
        
        // Send 5 payments of $50 each = $250 total (within $500 cap)
        for (uint i = 0; i < 5; i++) {
            uint256 paymentId = payment.pay{value: amount}(bob, amount);
            X402Payment.Payment memory p = payment.getPayment(paymentId);
            assertTrue(p.status == X402Payment.PaymentStatus.Success);
        }
        
        vm.stopPrank();
        
        assertEq(payment.getDailySpent(alice), amount * 5);
    }
    
    function testPaymentRevertIfIncorrectValue() public {
        vm.prank(alice);
        vm.expectRevert("Incorrect value sent");
        payment.pay{value: 5 ether}(bob, 10 ether);
    }
}

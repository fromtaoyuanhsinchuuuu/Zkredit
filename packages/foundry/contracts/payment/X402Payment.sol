// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title X402Payment
 * @notice x402 compliant payment system for cross-border remittances
 * @dev Implements compliance checks and daily spending caps
 */
contract X402Payment {
    /// @notice Payment status enum
    enum PaymentStatus {
        Pending,
        Success,
        Failed
    }
    
    /// @notice Payment record structure
    struct Payment {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        PaymentStatus status;
        string message;
    }
    
    /// @notice Daily spending cap (in wei, equivalent to $500 USD)
    uint256 public constant DAILY_CAP = 500 * 1e8; // 500 USD assuming 1e8 = 1 USD
    
    /// @notice Payment counter
    uint256 public paymentCounter;
    
    /// @notice Mapping of payment ID to payment data
    mapping(uint256 => Payment) public payments;
    
    /// @notice Mapping of user => day => amount spent
    mapping(address => mapping(uint256 => uint256)) public dailySpent;
    
    /// @notice Whitelisted recipients (for compliance)
    mapping(address => bool) public whitelistedRecipients;
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Events
    event PaymentRequest(
        uint256 indexed paymentId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    
    event PaymentSuccess(
        uint256 indexed paymentId,
        uint256 amount,
        string message
    );
    
    event PaymentFailed(
        uint256 indexed paymentId,
        string reason
    );
    
    event RecipientWhitelisted(
        address indexed recipient,
        bool status
    );
    
    event ComplianceCheck(
        address indexed user,
        uint256 amount,
        bool passed,
        string reason
    );
    
    /// @notice Constructor
    constructor() {
        owner = msg.sender;
        // Whitelist contract itself for testing
        whitelistedRecipients[address(this)] = true;
    }
    
    /// @notice Modifier for owner-only functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    /// @notice Add/remove recipient from whitelist
    /// @param _recipient Recipient address
    /// @param _status Whitelist status
    function setRecipientWhitelist(address _recipient, bool _status) external onlyOwner {
        whitelistedRecipients[_recipient] = _status;
        emit RecipientWhitelisted(_recipient, _status);
    }
    
    /// @notice Execute a payment with compliance checks
    /// @param _to Recipient address
    /// @param _amount Amount to send (in wei)
    /// @return paymentId The ID of the payment
    function pay(address _to, uint256 _amount) external payable returns (uint256) {
        require(_to != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be > 0");
        require(msg.value == _amount, "Incorrect value sent");
        
        paymentCounter++;
        uint256 paymentId = paymentCounter;
        
        // Create payment record
        payments[paymentId] = Payment({
            from: msg.sender,
            to: _to,
            amount: _amount,
            timestamp: block.timestamp,
            status: PaymentStatus.Pending,
            message: ""
        });
        
        emit PaymentRequest(paymentId, msg.sender, _to, _amount, block.timestamp);
        
        // Run compliance checks
        (bool compliant, string memory reason) = checkCompliance(msg.sender, _to, _amount);
        
        if (!compliant) {
            payments[paymentId].status = PaymentStatus.Failed;
            payments[paymentId].message = reason;
            emit PaymentFailed(paymentId, reason);
            
            // Refund
            payable(msg.sender).transfer(_amount);
            return paymentId;
        }
        
        // Update daily spent
        uint256 today = block.timestamp / 1 days;
        dailySpent[msg.sender][today] += _amount;
        
        // Execute transfer
        (bool success, ) = payable(_to).call{value: _amount}("");
        require(success, "Transfer failed");
        
        payments[paymentId].status = PaymentStatus.Success;
        payments[paymentId].message = "Payment completed successfully";
        
        emit PaymentSuccess(paymentId, _amount, "HBAR transfer completed");
        
        return paymentId;
    }
    
    /// @notice Check if payment complies with x402 rules
    /// @param _from Sender address
    /// @param _to Recipient address
    /// @param _amount Payment amount
    /// @return compliant Whether payment is compliant
    /// @return reason Reason if not compliant
    function checkCompliance(
        address _from,
        address _to,
        uint256 _amount
    ) public returns (bool compliant, string memory reason) {
        // Check 1: Recipient whitelist
        if (!whitelistedRecipients[_to]) {
            emit ComplianceCheck(_from, _amount, false, "Recipient not whitelisted");
            return (false, "Recipient not whitelisted");
        }
        
        // Check 2: Daily spending cap
        uint256 today = block.timestamp / 1 days;
        uint256 spentToday = dailySpent[_from][today];
        
        if (spentToday + _amount > DAILY_CAP) {
            string memory msg = string(
                abi.encodePacked(
                    "Exceeds daily cap of ",
                    uint2str(DAILY_CAP / 1e8),
                    " USD"
                )
            );
            emit ComplianceCheck(_from, _amount, false, msg);
            return (false, msg);
        }
        
        // Check 3: Amount validation (not too small or too large)
        if (_amount < 1e6) { // Min $0.01
            emit ComplianceCheck(_from, _amount, false, "Amount too small");
            return (false, "Amount too small (min $0.01)");
        }
        
        if (_amount > 200 * 1e8) { // Max $200 per transaction
            emit ComplianceCheck(_from, _amount, false, "Amount too large");
            return (false, "Amount exceeds $200 limit per transaction");
        }
        
        emit ComplianceCheck(_from, _amount, true, "Compliant");
        return (true, "");
    }
    
    /// @notice Get payment details
    /// @param _paymentId Payment ID
    /// @return Payment struct
    function getPayment(uint256 _paymentId) external view returns (Payment memory) {
        return payments[_paymentId];
    }
    
    /// @notice Get daily spent amount for user
    /// @param _user User address
    /// @return Amount spent today
    function getDailySpent(address _user) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return dailySpent[_user][today];
    }
    
    /// @notice Get remaining daily limit for user
    /// @param _user User address
    /// @return Remaining amount user can spend today
    function getRemainingDailyLimit(address _user) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        uint256 spent = dailySpent[_user][today];
        if (spent >= DAILY_CAP) {
            return 0;
        }
        return DAILY_CAP - spent;
    }
    
    /// @notice Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
    
    /// @notice Allow contract to receive ETH/HBAR
    receive() external payable {}
}

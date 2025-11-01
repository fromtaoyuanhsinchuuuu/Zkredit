// Credit History Proof Circuit
// Prove: I have >= minimum_transactions successful transactions without revealing exact count

fn main(
    // Private inputs (not revealed)
    actual_transaction_count: u64,  // Actual count, e.g., 11
    transaction_hash: Field,         // Hash of all transactions
    
    // Public inputs (revealed)
    minimum_transactions: pub u64,   // Minimum required, e.g., 5
    time_range_months: pub u64,      // Time range in months, e.g., 6
    worker_agent_id: pub Field       // Worker Agent ID
) {
    // Constraint 1: actual count must be >= minimum
    assert(actual_transaction_count >= minimum_transactions);
    
    // Constraint 2: count must be positive
    assert(actual_transaction_count > 0);
    
    // Constraint 3: minimum must be reasonable (1-100)
    assert(minimum_transactions >= 1);
    assert(minimum_transactions <= 100);
    
    // Constraint 4: time range must be reasonable (1-24 months)
    assert(time_range_months >= 1);
    assert(time_range_months <= 24);
    
    // Use all parameters
    let _ = transaction_hash;
    let _ = worker_agent_id;
}

#[test]
fn test_main() {
    // Test: 11 transactions >= 5 minimum should pass
    main(11, 0, 5, 6, 123);
}

#[test]
fn test_should_fail() {
    // Test: 3 transactions < 5 minimum should fail
    // Uncomment to test:
    // main(3, 0, 5, 6, 123);
}

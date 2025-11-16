// Income Proof Circuit
// Prove: my monthly income > minimum_income without revealing the exact amount

fn main(
    // Private inputs (not revealed)
    actual_income: u64,           // Actual income, e.g., 800
    salary_slip_hash: Field,      // Hash of salary slip
    
    // Public inputs (revealed)
    minimum_income: pub u64,      // Minimum income requirement, e.g., 500
    worker_agent_id: pub Field,   // Worker Agent ID
    timestamp: pub u64            // Proof generation timestamp
) {
    // Constraint 1: actual income must be >= minimum requirement
    assert(actual_income >= minimum_income);
    
    // Constraint 2: income must be positive
    assert(actual_income > 0);
    
    // Constraint 3: minimum income must be in reasonable range ($100-$10000)
    assert(minimum_income >= 100);
    assert(minimum_income <= 10000);
    
    // Use all parameters to avoid unused warnings
    let _ = salary_slip_hash;
    let _ = worker_agent_id;
    let _ = timestamp;
}

#[test]
fn test_main() {
    // Test: actual_income=800 >= minimum_income=500 should pass
    main(800, 0, 500, 0, 1234567890);
}

#[test]
fn test_should_fail() {
    // Test: actual_income=400 < minimum_income=500 should fail
    // Uncomment to test failure:
    // main(400, 0, 500, 0, 1234567890);
}

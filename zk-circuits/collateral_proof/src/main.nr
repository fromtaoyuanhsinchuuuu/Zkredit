// Collateral Proof Circuit
// Prove: my collateral value > minimum_value without revealing exact value or location

fn main(
    // Private inputs (not revealed)
    actual_value: u64,               // Actual value, e.g., 15000
    land_title_hash: Field,          // Hash of land title document
    gps_lat: u32,                    // GPS latitude (not revealed)
    gps_lon: u32,                    // GPS longitude (not revealed)
    
    // Public inputs (revealed)
    minimum_value: pub u64,          // Minimum value required, e.g., 10000
    country_code: pub u32,           // Country code, e.g., 95 for Myanmar
    worker_agent_id: pub Field       // Worker Agent ID
) {
    // Constraint 1: actual value must be >= minimum
    assert(actual_value >= minimum_value);
    
    // Constraint 2: value must be positive
    assert(actual_value > 0);
    
    // Constraint 3: minimum value must be reasonable ($1000-$1000000)
    assert(minimum_value >= 1000);
    assert(minimum_value <= 1000000);
    
    // Constraint 4: GPS coordinates must be valid (simplified check)
    assert(gps_lat < 180);
    assert(gps_lon < 360);
    
    // Use all parameters
    let _ = land_title_hash;
    let _ = country_code;
    let _ = worker_agent_id;
}

#[test]
fn test_main() {
    // Test: $15000 >= $10000 minimum should pass
    main(15000, 0, 16, 96, 10000, 95, 123);
}

#[test]
fn test_should_fail() {
    // Test: $8000 < $10000 minimum should fail
    // Uncomment to test:
    // main(8000, 0, 16, 96, 10000, 95, 123);
}

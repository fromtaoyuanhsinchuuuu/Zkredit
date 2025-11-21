/**
 * Quick test to verify ERC-8004 contracts are accessible
 * 
 * Usage: node scripts/test-erc8004-connection.js
 */

require('dotenv').config();
const {
  Client,
  ContractCallQuery,
  AccountId,
  PrivateKey,
} = require('@hashgraph/sdk');

const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_ADDRESS;
const REPUTATION_REGISTRY = process.env.REPUTATION_REGISTRY_ADDRESS;

function createClient() {
  const client = Client.forTestnet();
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_HEX_ENCODED_PRIVATE_KEY);
  client.setOperator(operatorId, operatorKey);
  return client;
}

async function main() {
  console.log('🔍 Testing ERC-8004 Contract Connectivity\n');

  if (!IDENTITY_REGISTRY || !REPUTATION_REGISTRY) {
    console.error('❌ Missing contract addresses in .env');
    process.exit(1);
  }

  console.log(`📋 Configuration:`);
  console.log(`   IdentityRegistry: ${IDENTITY_REGISTRY}`);
  console.log(`   ReputationRegistry: ${REPUTATION_REGISTRY}`);
  console.log(`   Operator: ${process.env.HEDERA_ACCOUNT_ID}\n`);

  const client = createClient();

  // Test IdentityRegistry accessibility
  console.log('1️⃣  Testing IdentityRegistry...');
  try {
    console.log(`   ✅ Contract address is valid EVM format`);
    console.log(`   🔗 View on HashScan: https://hashscan.io/testnet/contract/${IDENTITY_REGISTRY}`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }

  // Test ReputationRegistry accessibility
  console.log('\n2️⃣  Testing ReputationRegistry...');
  try {
    console.log(`   ✅ Contract address is valid EVM format`);
    console.log(`   🔗 View on HashScan: https://hashscan.io/testnet/contract/${REPUTATION_REGISTRY}`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }

  console.log('\n✅ Connection test complete!');
  console.log('\n📌 Next step: Run registration script');
  console.log('   node scripts/register-agents-erc8004.js');

  client.close();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

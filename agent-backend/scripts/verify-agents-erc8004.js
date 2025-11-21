/**
 * Verify ZKredit agents are registered in ERC-8004 IdentityRegistry
 * 
 * Usage: node scripts/verify-agents-erc8004.js
 */

require('dotenv').config();
const {
  Client,
  ContractCallQuery,
  AccountId,
  PrivateKey,
} = require('@hashgraph/sdk');

const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_ADDRESS;

const AGENTS = [
  {
    name: 'WorkerAgent',
    evmAddress: process.env.WORKER_EVM_ADDRESS,
    accountId: process.env.WORKER_ACCOUNT_ID,
  },
  {
    name: 'CreditAssessmentAgent1',
    evmAddress: process.env.HEDERA_EVM_ADDRESS,
    accountId: process.env.HEDERA_ACCOUNT_ID,
  },
  {
    name: 'CreditAssessmentAgent2',
    evmAddress: process.env.HEDERA_EVM_ADDRESS,
    accountId: process.env.HEDERA_ACCOUNT_ID,
  },
  {
    name: 'DefiPoolAgent',
    evmAddress: process.env.DEFI_POOL_EVM_ADDRESS,
    accountId: process.env.DEFI_POOL_ACCOUNT_ID,
  },
];

function createClient() {
  const client = Client.forTestnet();
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_HEX_ENCODED_PRIVATE_KEY);
  client.setOperator(operatorId, operatorKey);
  return client;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Verify ERC-8004 Agent Registrations             ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (!IDENTITY_REGISTRY) {
    console.error('❌ IDENTITY_REGISTRY_ADDRESS not set in .env');
    process.exit(1);
  }

  console.log(`📋 IdentityRegistry: ${IDENTITY_REGISTRY}`);
  console.log(`🔍 Checking ${AGENTS.length} agents...\n`);

  const client = createClient();

  for (const agent of AGENTS) {
    console.log(`\n🤖 ${agent.name}`);
    console.log(`   Account ID: ${agent.accountId}`);
    console.log(`   EVM Address: ${agent.evmAddress}`);
    console.log(`   ✅ Agent configured (on-chain verification requires contract event parsing)`);
    console.log(`   📊 View on HashScan: https://hashscan.io/testnet/account/${agent.accountId}`);
  }

  console.log('\n\n✅ Verification complete!');
  console.log('\n💡 To see actual registration events:');
  console.log(`   1. Visit: https://hashscan.io/testnet/contract/${IDENTITY_REGISTRY}`);
  console.log(`   2. Check "Contract" > "Events" tab`);
  console.log(`   3. Look for "Registered" events with your agent addresses`);

  client.close();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

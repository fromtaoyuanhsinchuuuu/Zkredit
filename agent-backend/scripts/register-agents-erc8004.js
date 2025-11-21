/**
 * Register all ZKredit agents to ERC-8004 IdentityRegistry
 * Run this script ONCE before demo to register agents on-chain
 * 
 * Usage: node scripts/register-agents-erc8004.js
 */

require('dotenv').config();
const {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  PrivateKey,
  AccountId,
  ContractCallQuery,
} = require('@hashgraph/sdk');

// ERC-8004 Contract addresses from .env
const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_ADDRESS;
const REPUTATION_REGISTRY = process.env.REPUTATION_REGISTRY_ADDRESS;

// Agent configurations
const AGENTS = [
  {
    name: 'WorkerAgent',
    accountId: process.env.WORKER_ACCOUNT_ID,
    evmAddress: process.env.WORKER_EVM_ADDRESS,
    privateKey: process.env.HEDERA_HEX_ENCODED_PRIVATE_KEY,
    description: 'Remittance worker agent with ZK proof generation capabilities',
    capabilities: ['remittance', 'zk-proof-generation', 'credit-application'],
    endpoint: 'http://localhost:3003/api/worker',
  },
  {
    name: 'CreditAssessmentAgent1',
    accountId: process.env.HEDERA_ACCOUNT_ID, // Using operator account for demo
    evmAddress: process.env.HEDERA_EVM_ADDRESS,
    privateKey: process.env.HEDERA_HEX_ENCODED_PRIVATE_KEY,
    description: 'ZK verifier agent - validates credit history proofs',
    capabilities: ['credit-assessment', 'zk-verification', 'ai-decision'],
    endpoint: 'http://localhost:3003/api/credit-agent-1',
  },
  {
    name: 'CreditAssessmentAgent2',
    accountId: process.env.HEDERA_ACCOUNT_ID, // Using operator account for demo
    evmAddress: process.env.HEDERA_EVM_ADDRESS,
    privateKey: process.env.HEDERA_HEX_ENCODED_PRIVATE_KEY,
    description: 'Alternative credit agent with zkAttributes analysis',
    capabilities: ['credit-assessment', 'zk-attributes', 'risk-analysis'],
    endpoint: 'http://localhost:3003/api/credit-agent-2',
  },
  {
    name: 'DefiPoolAgent',
    accountId: process.env.DEFI_POOL_ACCOUNT_ID,
    evmAddress: process.env.DEFI_POOL_EVM_ADDRESS,
    privateKey: process.env.DEFI_POOL_PRIVATE_KEY,
    description: 'DeFi liquidity pool agent for loan disbursement',
    capabilities: ['loan-disbursement', 'liquidity-management'],
    endpoint: 'http://localhost:3003/api/defi-pool',
  },
];

// Create Hedera client
function createClient() {
  const client = Client.forTestnet();
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_HEX_ENCODED_PRIVATE_KEY);
  client.setOperator(operatorId, operatorKey);
  return client;
}

// Generate metadata JSON for agent (would be hosted on IPFS in production)
function generateMetadataJson(agent) {
  return {
    name: agent.name,
    description: agent.description,
    version: '1.0.0',
    capabilities: agent.capabilities,
    endpoint: agent.endpoint,
    accountId: agent.accountId,
    evmAddress: agent.evmAddress,
    registeredAt: new Date().toISOString(),
    standard: 'ERC-8004',
    network: 'hedera-testnet',
  };
}

// For demo, we'll encode metadata as base64 and use as tokenURI
function encodeMetadataUri(metadata) {
  const json = JSON.stringify(metadata);
  const base64 = Buffer.from(json).toString('base64');
  return `data:application/json;base64,${base64}`;
}

// Register single agent to IdentityRegistry
async function registerAgent(client, agent) {
  console.log(`\n📝 Registering ${agent.name}...`);
  console.log(`   Account ID: ${agent.accountId}`);
  console.log(`   EVM Address: ${agent.evmAddress}`);

  try {
    // Generate metadata URI
    const metadata = generateMetadataJson(agent);
    const tokenUri = encodeMetadataUri(metadata);
    
    console.log(`   Metadata:`, metadata);
    console.log(`   Token URI length: ${tokenUri.length} chars`);

    // Build metadata entries for on-chain storage
    const metadataEntries = [
      { key: 'name', value: Buffer.from(agent.name) },
      { key: 'type', value: Buffer.from('ai-agent') },
      { key: 'capabilities', value: Buffer.from(agent.capabilities.join(',')) },
      { key: 'accountId', value: Buffer.from(agent.accountId) },
    ];

    // Prepare contract function parameters
    const functionParams = new ContractFunctionParameters()
      .addString(tokenUri);

    // Note: Hedera SDK doesn't have direct array of struct support
    // For demo, we'll use the simpler register(string) function
    // In production, you might need to call setMetadata separately

    // Execute registration transaction
    const transaction = new ContractExecuteTransaction()
      .setContractId(IDENTITY_REGISTRY)
      .setGas(800_000) // Higher gas for complex operations
      .setFunction('register', functionParams);

    console.log(`   🔄 Executing registration transaction...`);
    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);

    console.log(`   ✅ Registration successful!`);
    console.log(`   Transaction ID: ${txResponse.transactionId.toString()}`);
    console.log(`   Status: ${receipt.status.toString()}`);

    // Try to get the agent ID from contract (optional)
    // This would require parsing contract events or calling a getter function

    return {
      success: true,
      transactionId: txResponse.transactionId.toString(),
      agent: agent.name,
    };

  } catch (error) {
    console.error(`   ❌ Registration failed:`, error.message);
    return {
      success: false,
      error: error.message,
      agent: agent.name,
    };
  }
}

// Query agent count from IdentityRegistry
async function getAgentCount(client) {
  try {
    // ERC721 totalSupply or custom function
    const query = new ContractCallQuery()
      .setContractId(IDENTITY_REGISTRY)
      .setGas(100_000)
      .setFunction('totalSupply'); // If available

    const result = await query.execute(client);
    // Parse result - this depends on your contract implementation
    console.log(`   Total registered agents (raw):`, result);
    
  } catch (error) {
    console.log(`   ⚠️  Could not query agent count:`, error.message);
  }
}

// Main execution
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ZKredit Agent Registration to ERC-8004 IdentityRegistry ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Validate environment
  if (!IDENTITY_REGISTRY || !REPUTATION_REGISTRY) {
    console.error('❌ Missing ERC-8004 contract addresses in .env');
    console.error('   Please set:');
    console.error('   - IDENTITY_REGISTRY_ADDRESS');
    console.error('   - REPUTATION_REGISTRY_ADDRESS');
    process.exit(1);
  }

  console.log(`📋 Configuration:`);
  console.log(`   Network: Hedera Testnet`);
  console.log(`   IdentityRegistry: ${IDENTITY_REGISTRY}`);
  console.log(`   ReputationRegistry: ${REPUTATION_REGISTRY}`);
  console.log(`   Agents to register: ${AGENTS.length}`);

  const client = createClient();

  // Check initial state
  console.log(`\n🔍 Checking registry state...`);
  await getAgentCount(client);

  // Register all agents
  const results = [];
  for (const agent of AGENTS) {
    const result = await registerAgent(client, agent);
    results.push(result);
    
    // Wait 2 seconds between registrations to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n\n╔══════════════════════════════════════════════╗');
  console.log('║  Registration Summary                         ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${AGENTS.length}`);
  successful.forEach(r => {
    console.log(`   - ${r.agent}: ${r.transactionId}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${AGENTS.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.agent}: ${r.error}`);
    });
  }

  console.log('\n🎉 Registration process complete!');
  console.log('\n📌 Next steps:');
  console.log('   1. Verify registrations on HashScan:');
  console.log(`      https://hashscan.io/testnet/contract/${IDENTITY_REGISTRY}`);
  console.log('   2. Run verification script: node scripts/verify-agents-erc8004.js');
  console.log('   3. Start backend: npm start');

  client.close();
}

// Execute
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

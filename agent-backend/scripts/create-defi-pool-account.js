/**
 * Auto-create DeFi Pool account on Hedera Testnet
 * This script transfers HBAR to an EVM address, triggering auto account creation
 */

require('dotenv').config();
const {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  TransferTransaction,
  AccountInfoQuery,
} = require('@hashgraph/sdk');

async function createDefiPoolAccount() {
  console.log('🚀 Creating DeFi Pool Account via Auto-Creation...\n');

  // 1. Initialize client with operator account (your funded account)
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(
    process.env.HEDERA_HEX_ENCODED_PRIVATE_KEY.replace('0x', '')
  );

  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  console.log(`📋 Operator Account: ${operatorId.toString()}`);
  console.log(`   EVM Address: ${process.env.HEDERA_EVM_ADDRESS}\n`);

  // 2. The EVM address you want to turn into a Hedera account
  const targetEvmAddress = '0x947ff365b7099ac8b90e4f1024fc8a2f6d2f3ed4';
  console.log(`🎯 Target EVM Address: ${targetEvmAddress}`);
  console.log(`   This will become the DeFi Pool Agent wallet\n`);

  // 3. Create alias account ID from EVM address
  const aliasAccountId = AccountId.fromEvmAddress(0, 0, targetEvmAddress);
  console.log(`📝 Alias Account ID: ${aliasAccountId.toString()}\n`);

  // 4. Check if account already exists
  console.log('🔍 Checking if account already exists...');
  try {
    const existingInfo = await new AccountInfoQuery()
      .setAccountId(aliasAccountId)
      .execute(client);
    
    console.log('✅ Account already exists!');
    console.log(`   Account ID: ${existingInfo.accountId.toString()}`);
    console.log(`   Balance: ${existingInfo.balance.toString()}`);
    console.log(`   EVM Alias: ${existingInfo.contractAccountId || targetEvmAddress}\n`);
    
    console.log('✨ Update your .env with:');
    console.log(`DEFI_POOL_ACCOUNT_ID=${existingInfo.accountId.toString()}`);
    console.log(`DEFI_POOL_EVM_ADDRESS=${targetEvmAddress}`);
    console.log(`DEFI_POOL_PRIVATE_KEY=b0c3c92c1ee1c26cf6da10b77ffdb866359d0110550c6b8fa5a3e2d955c0321a`);
    
    client.close();
    return;
  } catch (error) {
    if (error.message.includes('INVALID_ACCOUNT_ID') || error.status?._code === 15) {
      console.log('⚠️  Account does not exist yet. Creating...\n');
    } else {
      console.log('⚠️  Could not query account (might not exist yet):', error.message, '\n');
    }
  }

  // 5. Transfer HBAR to create the account
  const transferAmount = 10; // Transfer 10 HBAR
  console.log(`💸 Transferring ${transferAmount} HBAR to ${targetEvmAddress}...`);
  console.log(`   This will trigger auto account creation\n`);

  try {
    const transferTx = await new TransferTransaction()
      .addHbarTransfer(operatorId, new Hbar(-transferAmount))
      .addHbarTransfer(aliasAccountId, new Hbar(transferAmount))
      .execute(client);

    console.log(`📤 Transaction submitted: ${transferTx.transactionId.toString()}`);

    const receipt = await transferTx.getReceipt(client);
    console.log(`✅ Transfer status: ${receipt.status.toString()}\n`);

    // 6. Wait a moment for the account to be created
    console.log('⏳ Waiting for account creation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 7. Query the newly created account
    console.log('🔍 Querying new account information...\n');
    const accountInfo = await new AccountInfoQuery()
      .setAccountId(aliasAccountId)
      .execute(client);

    console.log('🎉 SUCCESS! DeFi Pool Account Created:');
    console.log('='.repeat(60));
    console.log(`   Account ID: ${accountInfo.accountId.toString()}`);
    console.log(`   EVM Address: ${targetEvmAddress}`);
    console.log(`   Balance: ${accountInfo.balance.toString()}`);
    console.log(`   Key: ECDSA secp256k1`);
    console.log('='.repeat(60));
    console.log('');

    console.log('✨ Update your .env with these values:');
    console.log('='.repeat(60));
    console.log(`DEFI_POOL_ACCOUNT_ID=${accountInfo.accountId.toString()}`);
    console.log(`DEFI_POOL_EVM_ADDRESS=${targetEvmAddress}`);
    console.log(`DEFI_POOL_PRIVATE_KEY=b0c3c92c1ee1c26cf6da10b77ffdb866359d0110550c6b8fa5a3e2d955c0321a`);
    console.log('='.repeat(60));
    console.log('');

    console.log('🔗 View on HashScan:');
    console.log(`   https://hashscan.io/testnet/account/${accountInfo.accountId.toString()}`);

  } catch (error) {
    console.error('❌ Error during account creation:', error.message);
    if (error.status) {
      console.error(`   Status Code: ${error.status._code}`);
    }
    throw error;
  } finally {
    client.close();
  }
}

// Run the script
createDefiPoolAccount()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

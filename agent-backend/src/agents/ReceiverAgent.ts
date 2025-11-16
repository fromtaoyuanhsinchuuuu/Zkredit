import { Client, PrivateKey, AccountId, AccountBalanceQuery } from '@hashgraph/sdk';
import * as crypto from 'crypto';

/**
 * Receiver Agent - Beneficiary
 * Represents the family member or beneficiary receiving remittances
 * Confirms receipts and updates sender reputation
 */
export class ReceiverAgent {
  private agentId: bigint;
  private client: Client;
  private privateKey: PrivateKey;
  private accountId: AccountId;
  
  private contractAddresses = {
    identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS || '0x1FCE50d8F7B53d18d458Cf009dA2AD7cf0F2464d',
    reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS || '0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a'
  };

  // Pending receipts
  private pendingReceipts: Map<string, any> = new Map();

  constructor(agentId: bigint, client: Client, privateKey: PrivateKey, accountId: AccountId) {
    this.agentId = agentId;
    this.client = client;
    this.privateKey = privateKey;
    this.accountId = accountId;
  }

  /**
   * Receive remittance notification
   * Called when a remittance is sent to this agent
   */
  async receiveRemittanceNotification(notification: {
    senderAgentId: string;
    amount: number;
    transactionHash: string;
    timestamp: number;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    console.log('\n\n📥 === REMITTANCE RECEIVED ===');
    console.log(`📤 From: Agent #${notification.senderAgentId}`);
    console.log(`💰 Amount: $${notification.amount}`);
    console.log(`📝 TX Hash: ${notification.transactionHash.slice(0, 20)}...`);

    // Add to pending receipts
    this.pendingReceipts.set(notification.transactionHash, {
      ...notification,
      status: 'pending_confirmation',
      receivedAt: Date.now()
    });

    console.log('⏳ Added to pending confirmations');
    console.log('📥 === NOTIFICATION PROCESSED ===\n');

    return {
      success: true,
      message: `Remittance of $${notification.amount} from Agent #${notification.senderAgentId} pending confirmation`
    };
  }

  /**
   * Confirm receipt of remittance
   * Verifies funds arrived and updates sender's reputation
   */
  async confirmReceipt(transactionHash: string): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
  }> {
    console.log('\n\n✅ === CONFIRMING RECEIPT ===');
    console.log(`📝 TX Hash: ${transactionHash.slice(0, 20)}...`);

    // Get pending receipt
    const receipt = this.pendingReceipts.get(transactionHash);
    if (!receipt) {
      console.log('❌ Receipt not found in pending list');
      return {
        success: false,
        verified: false,
        message: 'Transaction not found'
      };
    }

    // Step 1: Verify funds arrived
    const fundsVerified = await this.verifyFundsReceived(transactionHash, receipt.amount);
    
    if (!fundsVerified) {
      console.log('❌ Funds verification failed');
      return {
        success: false,
        verified: false,
        message: 'Funds not received'
      };
    }

    console.log('✅ Funds verified in account');

    // Step 2: Update sender's reputation on ERC-8004
    await this.updateSenderReputation({
      senderAgentId: receipt.senderAgentId,
      receiverAgentId: this.agentId.toString(),
      transactionHash: transactionHash,
      amount: receipt.amount,
      feedback: 'received_successfully'
    });

    // Step 3: Remove from pending
    this.pendingReceipts.delete(transactionHash);

    console.log('✅ Receipt confirmed successfully');
    console.log('📈 Sender reputation updated');
    console.log('✅ === CONFIRMATION COMPLETE ===\n');

    return {
      success: true,
      verified: true,
      message: `Successfully confirmed receipt of $${receipt.amount}`
    };
  }

  /**
   * Verify that funds actually arrived in the account
   * In production: check Hedera account balance or token transfers
   */
  private async verifyFundsReceived(transactionHash: string, expectedAmount: number): Promise<boolean> {
    console.log('🔍 Verifying funds received...');

    try {
      // In production: query Hedera account balance or check transaction details
      // For demo: simulate verification
      
      // Mock verification delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Simulate 95% success rate
      const verified = Math.random() > 0.05;

      if (verified) {
        console.log(`✅ Verified: $${expectedAmount} received`);
      } else {
        console.log(`❌ Verification failed: funds not found`);
      }

      return verified;
    } catch (error) {
      console.error('❌ Verification error:', error);
      return false;
    }
  }

  /**
   * Update sender's reputation on ERC-8004
   * Successful receipt confirmation improves sender's credit score
   */
  private async updateSenderReputation(data: {
    senderAgentId: string;
    receiverAgentId: string;
    transactionHash: string;
    amount: number;
    feedback: string;
  }): Promise<void> {
    console.log('📝 Updating sender reputation on ERC-8004...');

    try {
      // In production: call ReputationRegistry.giveFeedback()
      // Receiver confirms successful delivery
      
      const feedbackData = {
        agentId: data.senderAgentId, // Sender gets the reputation boost
        fromAgent: data.receiverAgentId,
        rating: 100, // Perfect rating for successful delivery
        tag: 'confirmed_receipt',
        metadata: {
          transactionHash: data.transactionHash,
          amountHash: crypto.createHash('sha256').update(data.amount.toString()).digest('hex'),
          timestamp: Date.now(),
          feedback: data.feedback
        }
      };

      console.log('✅ Reputation update submitted:');
      console.log(`   Sender Agent: ${data.senderAgentId}`);
      console.log(`   Rating: ${feedbackData.rating}/100`);
      console.log(`   Tag: ${feedbackData.tag}`);
      console.log('   📈 Sender credit score improved');
      console.log('   🔐 Transaction data hashed for privacy');

      // This confirmation adds to sender's credit history
      // Can be used in future ZK proofs
      
    } catch (error) {
      console.error('❌ Reputation update failed:', error);
    }
  }

  /**
   * Request emergency loan guarantee
   * Receiver can request loan on behalf of sender (using sender's credit)
   */
  async requestLoanGuarantee(request: {
    senderAgentId: string;
    amount: number;
    reason: string;
  }): Promise<{
    success: boolean;
    message: string;
    guaranteeId?: string;
  }> {
    console.log('\n\n🆘 === LOAN GUARANTEE REQUEST ===');
    console.log(`📤 For Sender: Agent #${request.senderAgentId}`);
    console.log(`💰 Amount: $${request.amount}`);
    console.log(`📝 Reason: ${request.reason}`);

    // Verify relationship with sender
    const relationship = await this.verifyRelationship(request.senderAgentId);
    
    if (!relationship.verified) {
      console.log('❌ Relationship verification failed');
      return {
        success: false,
        message: 'Cannot request guarantee: relationship not verified'
      };
    }

    console.log('✅ Relationship verified: ' + relationship.totalReceived + ' transactions');

    // Generate guarantee ID
    const guaranteeId = 'guarantee_' + crypto.randomBytes(16).toString('hex');

    // In production: create smart contract guarantee
    // Receiver vouches for sender's creditworthiness
    
    console.log('✅ Guarantee request created');
    console.log(`   Guarantee ID: ${guaranteeId}`);
    console.log('   📤 Forwarded to Credit Agent for approval');
    console.log('🆘 === GUARANTEE REQUEST COMPLETE ===\n');

    return {
      success: true,
      message: `Guarantee request created for Agent #${request.senderAgentId}`,
      guaranteeId
    };
  }

  /**
   * Verify relationship with sender
   * Checks history of remittances received
   */
  private async verifyRelationship(senderAgentId: string): Promise<{
    verified: boolean;
    totalReceived: number;
    firstTransaction?: number;
  }> {
    // In production: query ERC-8004 for transaction history
    // For demo: simulate based on agent ID
    
    const mockHistory = Array.from(this.pendingReceipts.values())
      .filter(r => r.senderAgentId === senderAgentId);

    // Assume some past history
    const totalReceived = mockHistory.length + 5; // Mock past transactions

    return {
      verified: totalReceived > 0,
      totalReceived,
      firstTransaction: Date.now() - (6 * 30 * 24 * 60 * 60 * 1000) // 6 months ago
    };
  }

  /**
   * Get pending receipts
   */
  getPendingReceipts(): any[] {
    return Array.from(this.pendingReceipts.values());
  }

  /**
   * Get receipt statistics
   */
  getStatistics(): {
    totalPending: number;
    totalConfirmed: number;
    totalValue: number;
  } {
    const pending = Array.from(this.pendingReceipts.values());
    
    return {
      totalPending: pending.length,
      totalConfirmed: 0, // Would query from blockchain
      totalValue: pending.reduce((sum, r) => sum + r.amount, 0)
    };
  }

  // Getters
  getAgentId() { return this.agentId; }
  getAccountId() { return this.accountId; }
}

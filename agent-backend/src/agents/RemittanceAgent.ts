import { Client, PrivateKey, TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk';
import * as crypto from 'crypto';

/**
 * Remittance Agent - Payment Router
 * Handles cross-border remittances with low fees
 * Records transactions to ERC-8004 for credit building
 */
export class RemittanceAgent {
  private agentId: bigint;
  private client: Client;
  private privateKey: PrivateKey;
  
  private contractAddresses = {
    identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS || '0x1FCE50d8F7B53d18d458Cf009dA2AD7cf0F2464d',
    reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS || '0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a',
    x402Payment: process.env.X402_PAYMENT_ADDRESS || '0x...'
  };

  // Fee structure
  private fees = {
    remittancePercentage: 0.007, // 0.7%
    minimumFee: 0.5,             // $0.50
    x402ServiceFee: 0.0001       // $0.0001 per API call
  };

  constructor(agentId: bigint, client: Client, privateKey: PrivateKey) {
    this.agentId = agentId;
    this.client = client;
    this.privateKey = privateKey;
  }

  /**
   * Process remittance request
   * Main entry point for sending money
   */
  async processRemittance(request: {
    senderAgentId: string;
    receiverAgentId: string;
    amount: number;
    currency: string;
    paymentProof?: string;
  }): Promise<{
    success: boolean;
    transactionHash: string;
    fee: number;
    netAmount: number;
    message: string;
  }> {
    console.log('\n\n💸 === REMITTANCE START ===');
    console.log(`📤 Sender: Agent #${request.senderAgentId}`);
    console.log(`📥 Receiver: Agent #${request.receiverAgentId}`);
    console.log(`💰 Amount: $${request.amount} ${request.currency}`);

    // Step 1: Calculate fees
    const fee = this.calculateFee(request.amount);
    const netAmount = request.amount - fee;
    
    console.log(`💵 Fee: $${fee.toFixed(2)} (0.7%)`);
    console.log(`💵 Net Amount: $${netAmount.toFixed(2)}`);

    // Step 2: Verify x402 payment (if service fee required)
    if (request.paymentProof) {
      const paymentValid = await this.verifyX402Payment(request.paymentProof);
      if (!paymentValid) {
        console.log('❌ x402 payment verification failed');
        return {
          success: false,
          transactionHash: '',
          fee: 0,
          netAmount: 0,
          message: 'Payment verification failed'
        };
      }
      console.log('✅ x402 service fee verified');
    }

    // Step 3: Execute transfer
    const transferResult = await this.executeTransfer(
      request.senderAgentId,
      request.receiverAgentId,
      netAmount
    );

    if (!transferResult.success) {
      console.log('❌ Transfer failed');
      return {
        success: false,
        transactionHash: '',
        fee,
        netAmount,
        message: transferResult.message
      };
    }

    console.log(`✅ Transfer successful: ${transferResult.txHash}`);

    // Step 4: Record to ERC-8004 (CRITICAL for credit building)
    await this.recordToERC8004({
      senderAgentId: request.senderAgentId,
      receiverAgentId: request.receiverAgentId,
      amount: request.amount,
      transactionHash: transferResult.txHash,
      timestamp: Date.now(),
      status: 'completed'
    });

    console.log('✅ Transaction recorded to ERC-8004');
    console.log('📈 Sender reputation +1 successful transaction');
    console.log('💸 === REMITTANCE COMPLETE ===\n');

    return {
      success: true,
      transactionHash: transferResult.txHash,
      fee,
      netAmount,
      message: `Successfully sent $${netAmount.toFixed(2)} to Agent #${request.receiverAgentId}`
    };
  }

  /**
   * Calculate remittance fee
   */
  private calculateFee(amount: number): number {
    const percentageFee = amount * this.fees.remittancePercentage;
    return Math.max(percentageFee, this.fees.minimumFee);
  }

  /**
   * Verify x402 payment proof
   * In production: verify HTTP 402 payment with x402 protocol
   */
  private async verifyX402Payment(paymentProof: string): Promise<boolean> {
    // Mock verification for demo
    // In production: verify signature and payment on Hedera
    console.log('🔍 Verifying x402 payment...');
    
    if (!paymentProof || paymentProof.length < 10) {
      return false;
    }

    // Simulate verification
    return paymentProof.startsWith('0x') || paymentProof.startsWith('payment_');
  }

  /**
   * Execute Hedera transfer
   * In production: use USDC or stablecoin transfers
   */
  private async executeTransfer(
    senderAgentId: string,
    receiverAgentId: string,
    amount: number
  ): Promise<{
    success: boolean;
    txHash: string;
    message: string;
  }> {
    console.log('⏳ Executing transfer on Hedera...');

    try {
      // In production: transfer USDC via Hedera Token Service
      // For demo: simulate transfer with mock transaction
      
      // Generate mock transaction hash
      const txHash = crypto.randomBytes(32).toString('hex');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('✅ Transfer executed on Hedera');
      console.log(`   TX: ${txHash.slice(0, 10)}...`);

      return {
        success: true,
        txHash: '0x' + txHash,
        message: 'Transfer successful'
      };
    } catch (error: any) {
      console.error('❌ Transfer error:', error.message);
      return {
        success: false,
        txHash: '',
        message: error.message
      };
    }
  }

  /**
   * Record transaction to ERC-8004 ReputationRegistry
   * CRITICAL: This builds credit history for future loan applications
   */
  private async recordToERC8004(data: {
    senderAgentId: string;
    receiverAgentId: string;
    amount: number;
    transactionHash: string;
    timestamp: number;
    status: string;
  }): Promise<void> {
    console.log('📝 Recording to ERC-8004 ReputationRegistry...');

    try {
      // In production: call ReputationRegistry.giveFeedback()
      // This creates a record that can be used for ZK credit history proofs
      
      const feedbackData = {
        agentId: data.senderAgentId,
        rating: 100, // Successful transaction = perfect score
        tag: 'successful_remittance',
        metadata: {
          receiver: data.receiverAgentId,
          // Hash amount for privacy (used in ZK proofs)
          amountHash: crypto.createHash('sha256').update(data.amount.toString()).digest('hex'),
          txHash: data.transactionHash,
          timestamp: data.timestamp,
          status: data.status
        }
      };

      console.log('✅ Transaction metadata recorded:');
      console.log(`   Agent: ${data.senderAgentId}`);
      console.log(`   Rating: ${feedbackData.rating}/100`);
      console.log(`   Tag: ${feedbackData.tag}`);
      console.log('   🔐 Amount hashed for future ZK proofs');
      console.log('   📊 Sender can now use this in credit history proof');

      // Future: Worker can generate ZK proof showing "I have 5+ successful remittances"
      // without revealing amounts or specific details
      
    } catch (error) {
      console.error('❌ ERC-8004 recording failed:', error);
    }
  }

  /**
   * Get remittance history for an agent
   * Used to build credit profile
   */
  async getRemittanceHistory(agentId: string, limit: number = 10): Promise<any[]> {
    console.log(`📊 Fetching remittance history for Agent #${agentId}...`);
    
    // In production: query ERC-8004 ReputationRegistry
    // Return list of transactions for credit analysis
    
    // Mock data for demo
    const mockHistory = Array.from({ length: Math.min(limit, 7) }, (_, i) => ({
      id: i + 1,
      timestamp: Date.now() - (i * 30 * 24 * 60 * 60 * 1000), // Monthly
      amountHash: crypto.randomBytes(32).toString('hex'),
      status: 'completed',
      rating: 100
    }));

    console.log(`✅ Found ${mockHistory.length} transactions`);
    return mockHistory;
  }

  /**
   * Calculate remittance statistics
   */
  async getStatistics(agentId: string): Promise<{
    totalTransactions: number;
    successRate: number;
    averageAmount: number;
    totalVolume: number;
  }> {
    const history = await this.getRemittanceHistory(agentId, 100);
    
    const stats = {
      totalTransactions: history.length,
      successRate: history.filter(tx => tx.status === 'completed').length / history.length * 100,
      averageAmount: 200, // Mock
      totalVolume: history.length * 200 // Mock
    };

    console.log('📊 Remittance Statistics:');
    console.log(`   Total Transactions: ${stats.totalTransactions}`);
    console.log(`   Success Rate: ${stats.successRate.toFixed(1)}%`);
    console.log(`   Average Amount: $${stats.averageAmount}`);
    console.log(`   Total Volume: $${stats.totalVolume}`);

    return stats;
  }

  // Getters
  getAgentId() { return this.agentId; }
  getFees() { return this.fees; }
}

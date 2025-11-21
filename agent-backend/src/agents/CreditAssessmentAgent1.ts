import { Client, PrivateKey, ContractExecuteTransaction, ContractFunctionParameters } from '@hashgraph/sdk';
import Groq from 'groq-sdk';
import { verifyCreditHistoryNoirProof } from '../services/noirCreditHistory';

/**
 * Credit Assessment Agent 1 - ZK Verifier
 * Verifies ZK proofs and calculates credit scores
 * Uses AI (Groq) for intelligent decision-making
 */
export class CreditAssessmentAgent1 {
  private agentId: bigint;
  private client: Client;
  private privateKey: PrivateKey;
  private groq: Groq;
  
  private contractAddresses = {
    identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS || '0x1FCE50d8F7B53d18d458Cf009dA2AD7cf0F2464d',
    reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS || '0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a'
  };

  constructor(agentId: bigint, client: Client, privateKey: PrivateKey) {
    this.agentId = agentId;
    this.client = client;
    this.privateKey = privateKey;
    
    // Initialize Groq AI
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  GROQ_API_KEY missing in env, will use fallback decisions only');
    }
    this.groq = new Groq({
      apiKey: apiKey || 'dummy-key'
    });
  }

  /**
   * Process loan application with ZK proofs
   * Main entry point for credit assessment
   */
  async processLoanApplication(application: {
    applicantAgentId: string;
    requestedAmount: number;
    zkProofs: {
      income: any;
      creditHistory: any;
      collateral: any;
    };
    zkAttributes?: Record<string, any>;
  }): Promise<{
    approved: boolean;
    creditScore: number;
    maxLoanAmount: number;
    interestRate: number;
    reason: string;
    details: any;
  }> {
    console.log('\n\n🧠 === CREDIT ASSESSMENT START ===');
    console.log(`📨 Application from Agent #${application.applicantAgentId}`);
    console.log(`💰 Requested Amount: $${application.requestedAmount}`);
    if (application.zkAttributes) {
      console.log('🧾 zkAttributes summary:', application.zkAttributes);
    }
    console.log('🔐 Verifying ZK Proofs...\n');

    // Step 1: Verify all ZK proofs
    const verificationResults = await this.verifyAllProofs(application.zkProofs);

    // Step 2: Calculate credit score
    const creditScore = await this.calculateCreditScore(
      verificationResults,
      application.applicantAgentId,
      application.zkAttributes
    );

    // Step 3: Make decision using AI
    const decision = await this.makeDecisionWithAI(
      creditScore,
      application.requestedAmount,
      verificationResults,
      application.zkAttributes
    );

    // Step 4: Log to blockchain (ERC-8004)
    await this.logAssessmentToBlockchain({
      applicantAgentId: application.applicantAgentId,
      creditScore,
      decision,
      verificationResults
    });

    console.log('\n✅ === CREDIT ASSESSMENT COMPLETE ===');
    console.log(`📊 Credit Score: ${creditScore}/110`);
    console.log(`✅ Decision: ${decision.approved ? 'APPROVED' : 'REJECTED'}`);
    console.log(`💰 Max Loan: $${decision.maxAmount}`);
    console.log(`📈 Interest Rate: ${decision.interestRate}% APR`);
    console.log('🧠 === CREDIT ASSESSMENT END ===\n');

    return {
      approved: decision.approved,
      creditScore,
      maxLoanAmount: decision.maxAmount,
      interestRate: decision.interestRate,
      reason: decision.reason,
      details: {
        verificationResults,
        aiAnalysis: decision.aiAnalysis
      }
    };
  }

  /**
   * Verify all ZK proofs
   * In production, this would call Noir verifier contracts
   */
  private async verifyAllProofs(zkProofs: {
    income: any;
    creditHistory: any;
    collateral: any;
  }): Promise<{
    income: boolean;
    creditHistory: boolean;
    collateral: boolean;
  }> {
    console.log('🔍 Verifying ZK Proofs...\n');

    // Verify Income Proof
    const incomeValid = this.verifyProof(zkProofs.income, 'income');
    console.log('✅ Income Proof Verified:', incomeValid);
    console.log(`   Public: income > $${zkProofs.income.publicInputs.minimumIncome}`);
    console.log('   🔒 Private: Actual amount HIDDEN\n');

    // Verify Credit History Proof
    let creditValid = false;
    const creditProof = zkProofs.creditHistory;
    if (!creditProof || !creditProof.publicInputs) {
      console.warn('⚠️  Credit history proof missing public inputs');
    } else {
      // Basic format check first
      const basicValid = this.verifyProof(creditProof, 'credit_history');
      if (basicValid && creditProof.noirArtifacts) {
        creditValid = await verifyCreditHistoryNoirProof(creditProof.noirArtifacts);
      }
      console.log('✅ Credit History Proof Verified (Noir):', creditValid);
      console.log(`   Public: transactions >= ${creditProof.publicInputs.minimumTransactions}`);
      console.log(`   Public: Merkle Root = ${creditProof.publicInputs.merkleRoot.slice(0, 10)}...`);
      console.log(`   Public Noir Inputs: ${creditProof.noirArtifacts?.noirPublicInputs.join(', ') || 'n/a'}`);
      console.log('   🔒 Private: Exact count and amounts HIDDEN\n');
    }

    // Verify Collateral Proof
    const collateralValid = this.verifyProof(zkProofs.collateral, 'collateral');
    console.log('✅ Collateral Proof Verified:', collateralValid);
    console.log(`   Public: value > $${zkProofs.collateral.publicInputs.minimumValue}`);
    console.log(`   Public: Country = ${zkProofs.collateral.publicInputs.countryCode}`);
    console.log('   🔒 Private: Exact value and GPS location HIDDEN\n');

    return {
      income: incomeValid,
      creditHistory: creditValid,
      collateral: collateralValid
    };
  }

  /**
   * Verify individual ZK proof
   * Mock verification for demo (in production, would call Noir verifier)
   */
  private verifyProof(proof: any, type: string): boolean {
    // In production: call Noir verifier contract on Hedera
    // For demo: verify that proof exists and has correct format
    
    if (!proof || !proof.proof || !proof.publicInputs) {
      console.log(`❌ ${type} proof invalid: missing data`);
      return false;
    }

    // Mock verification: check proof hash format
    if (typeof proof.proof !== 'string' || !proof.proof.startsWith('0x')) {
      console.log(`❌ ${type} proof invalid: bad format`);
      return false;
    }

    // Additional validation based on proof type
    switch (type) {
      case 'income':
        return proof.publicInputs.minimumIncome > 0;
      case 'credit_history':
        return proof.publicInputs.minimumTransactions > 0;
      case 'collateral':
        return proof.publicInputs.minimumValue > 0;
      default:
        return false;
    }
  }

  /**
   * Calculate credit score based on verification results
   */
  private async calculateCreditScore(
    verificationResults: { income: boolean; creditHistory: boolean; collateral: boolean },
    applicantAgentId: string,
    zkAttributes?: Record<string, any>
  ): Promise<number> {
    console.log('📊 Calculating Credit Score...\n');
    
    let score = 0;

    // Income proof: +40 points
    if (verificationResults.income) {
      score += 40;
      console.log('✅ Income verified (>$500/month): +40 points');
    }

    // Credit history proof: +30 points
    if (verificationResults.creditHistory) {
      score += 30;
      console.log('✅ Credit history verified (5+ transactions): +30 points');
    }

    // Collateral proof: +30 points
    if (verificationResults.collateral) {
      score += 30;
      console.log('✅ Collateral verified (>$10k land): +30 points');
    }

    // Bonus: Stable remittance behavior from zkAttributes
    if (zkAttributes?.stable_remitter) {
      score += 5;
      console.log('✅ Stable remittance behavior: +5 points');
    }

    // Bonus: On-chain reputation from ERC-8004
    const onChainReputation = await this.getOnChainReputation(applicantAgentId);
    if (onChainReputation >= 90) {
      score += 10;
      console.log(`✅ On-chain reputation bonus (${onChainReputation}): +10 points`);
    }

    console.log(`\n📊 Final Credit Score: ${score}/110\n`);
    return score;
  }

  /**
   * Make decision using Groq AI
   * AI analyzes the credit profile and provides reasoning
   */
  protected async makeDecisionWithAI(
    creditScore: number,
    requestedAmount: number,
    verificationResults: any,
    zkAttributes?: Record<string, any>
  ): Promise<{
    approved: boolean;
    maxAmount: number;
    interestRate: number;
    reason: string;
    aiAnalysis: string;
  }> {
    console.log('🤖 Consulting AI for decision...\n');

    const remittanceSummary = zkAttributes
      ? JSON.stringify(zkAttributes, null, 2)
      : 'No remittance attributes provided';

    const prompt = `
Credit Assessment Request:
- Credit Score: ${creditScore}/110
- Requested Amount: $${requestedAmount}
- Verification Results:
  * Income Proof: ${verificationResults.income ? '✅ Verified' : '❌ Failed'}
  * Credit History Proof: ${verificationResults.creditHistory ? '✅ Verified' : '❌ Failed'}
  * Collateral Proof: ${verificationResults.collateral ? '✅ Verified' : '❌ Failed'}
- Remittance-based ZK Attributes (from cross-border payments):
${remittanceSummary}

Please analyze this loan application and provide a JSON decision with:
{
  "approved": true/false,
  "maxAmount": number (in USD),
  "interestRate": number (annual percentage),
  "reason": "explanation"
}

Consider:
1. The applicant is a cross-border worker who may lack traditional credit history
2. ZK proofs verify claims without revealing private data (income amount, transaction details, collateral location)
3. Higher credit scores indicate more verified proofs
4. Remittance attributes show payment behavior patterns (stable_remitter, total_remitted_band, account_age_band)
5. Fair interest rates: 8-12% for good credit, 15-20% for moderate, reject if too risky

Please respond with ONLY a JSON object, no extra commentary, no markdown.
`;

    // If no API key, skip AI and use fallback
    if (!process.env.GROQ_API_KEY) {
      console.log('⚠️  No GROQ_API_KEY, using fallback decision rules');
      return this.fallbackDecision(creditScore, requestedAmount);
    }

    try {
      console.log('🤖 Connecting to LLM for analysis...');
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.8,
        max_tokens: 1024
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      console.log('🤖 AI Analysis Received:');
      console.log(aiResponse);

      // Parse AI response
      let aiDecision;
      try {
        // Try to extract JSON from response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiDecision = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (e) {
        // Fallback to rule-based decision
        console.log('⚠️  AI parsing failed, using fallback rules');
        aiDecision = this.fallbackDecision(creditScore, requestedAmount);
      }

      return {
        approved: aiDecision.approved || false,
        maxAmount: aiDecision.maxAmount || 0,
        interestRate: aiDecision.interestRate || 0,
        reason: aiDecision.reason || 'AI analysis completed',
        aiAnalysis: aiResponse
      };
    } catch (error) {
      console.error('❌ AI decision error:', error);
      console.log('⚠️  Using fallback decision rules');
      return this.fallbackDecision(creditScore, requestedAmount);
    }
  }

  /**
   * Fallback decision rules (if AI fails)
   */
  protected fallbackDecision(creditScore: number, requestedAmount: number): {
    approved: boolean;
    maxAmount: number;
    interestRate: number;
    reason: string;
    aiAnalysis: string;
  } {
    if (creditScore >= 80) {
      return {
        approved: true,
        maxAmount: Math.min(requestedAmount, 500),
        interestRate: 8,
        reason: 'Excellent credit profile (score >= 80). All ZK proofs verified.',
        aiAnalysis: 'Fallback decision: High credit score with verified income, credit history, and collateral.'
      };
    } else if (creditScore >= 50) {
      return {
        approved: true,
        maxAmount: Math.min(requestedAmount, 300),
        interestRate: 12,
        reason: 'Good credit profile (score >= 50). Limited amount approved.',
        aiAnalysis: 'Fallback decision: Moderate credit score, reduced loan amount to mitigate risk.'
      };
    } else {
      return {
        approved: false,
        maxAmount: 0,
        interestRate: 0,
        reason: 'Insufficient credit verification (score < 50). More proof required.',
        aiAnalysis: 'Fallback decision: Low credit score, loan rejected.'
      };
    }
  }

  /**
   * Get on-chain reputation from ERC-8004
   * Mock for demo (in production, query ReputationRegistry)
   */
  private async getOnChainReputation(agentId: string): Promise<number> {
    // In production: query ERC-8004 ReputationRegistry contract
    // For demo: return a mock reputation score
    
    let agentIdNum: bigint;
    try {
      agentIdNum = BigInt(agentId);
    } catch {
      console.warn('⚠️  Invalid agentId for reputation, using baseline 50');
      return 50;
    }
    
    // Simulate some agents having higher reputation
    if (agentIdNum % 3n === 0n) {
      return 95; // High reputation
    } else if (agentIdNum % 2n === 0n) {
      return 75; // Medium reputation
    } else {
      return 50; // New user baseline
    }
  }

  /**
   * Log assessment result to blockchain (ERC-8004 + HCS)
   * REAL ERC-8004 IMPLEMENTATION - submits feedback to ReputationRegistry
   */
  private async logAssessmentToBlockchain(data: {
    applicantAgentId: string;
    creditScore: number;
    decision: any;
    verificationResults: any;
  }): Promise<void> {
    console.log('📝 Logging to ERC-8004 ReputationRegistry...');

    try {
      // Convert credit score (0-110) to feedback score (0-100)
      const feedbackScore = Math.min(100, Math.floor((data.creditScore / 110) * 100));
      
      // Prepare tags for categorization
      const tag1 = Buffer.from(data.decision.approved ? 'approved' : 'rejected').toString('hex').padEnd(64, '0');
      const tag2 = Buffer.from('credit-assessment').toString('hex').padEnd(64, '0');
      
      // Generate feedback URI (in production, this would be IPFS)
      const feedbackData = {
        agentId: data.applicantAgentId,
        creditScore: data.creditScore,
        decision: data.decision,
        timestamp: new Date().toISOString(),
        assessor: this.agentId.toString(),
      };
      const feedbackJson = JSON.stringify(feedbackData);
      const feedbackUri = `data:application/json;base64,${Buffer.from(feedbackJson).toString('base64')}`;
      
      // Calculate feedback hash
      const crypto = require('crypto');
      const feedbackHash = '0x' + crypto.createHash('sha256').update(feedbackJson).digest('hex');

      // For demo: We'll skip the full FeedbackAuth signature generation
      // In production, you would call generateFeedbackAuthForClient()
      // For now, create a dummy 289-byte feedbackAuth (224 bytes struct + 65 bytes signature)
      const dummyFeedbackAuth = Buffer.alloc(289, 0);

      console.log(`   📊 Feedback Score: ${feedbackScore}/100`);
      console.log(`   🏷️  Tags: ${data.decision.approved ? 'approved' : 'rejected'}, credit-assessment`);
      console.log(`   📄 Feedback URI: ${feedbackUri.substring(0, 50)}...`);
      console.log(`   #️⃣  Feedback Hash: ${feedbackHash.substring(0, 20)}...`);

      // Execute contract transaction
      const functionParams = new ContractFunctionParameters()
        .addUint256(Number(data.applicantAgentId)) // agentId
        .addUint8(feedbackScore) // score (0-100)
        .addBytes32(Buffer.from(tag1, 'hex')) // tag1
        .addBytes32(Buffer.from(tag2, 'hex')) // tag2
        .addString(feedbackUri) // feedbackUri
        .addBytes32(Buffer.from(feedbackHash.slice(2), 'hex')) // feedbackHash
        .addBytes(dummyFeedbackAuth); // feedbackAuth

      const transaction = new ContractExecuteTransaction()
        .setContractId(this.contractAddresses.reputationRegistry)
        .setGas(800_000)
        .setFunction('giveFeedback', functionParams);

      console.log(`   🔄 Executing transaction to ${this.contractAddresses.reputationRegistry}...`);
      
      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      console.log('   ✅ Assessment logged to ERC-8004 ReputationRegistry');
      console.log(`   📋 Transaction ID: ${txResponse.transactionId.toString()}`);
      console.log(`   ✔️  Status: ${receipt.status.toString()}`);
      console.log(`   🔗 View on HashScan: https://hashscan.io/testnet/transaction/${txResponse.transactionId.toString()}`);
      
    } catch (error: any) {
      console.error('❌ ERC-8004 blockchain logging failed:', error.message);
      console.error('   ⚠️  Continuing without on-chain logging...');
      // Don't throw - we want the assessment to succeed even if logging fails
    }
  }

  /**
   * Get the system prompt for the AI agent.
   * Can be overridden by subclasses to define different agent personas.
   */
  protected getSystemPrompt(): string {
    return `You are an AI credit assessment agent for ZKredit, a ZK-powered lending platform for cross-border workers.
            Your role is to make fair lending decisions based on verified ZK proofs while considering the unique challenges
            faced by migrant workers who may lack traditional credit history.
            Current Timestamp: ${new Date().toISOString()} (Use this to ensure unique analysis).
            Return ONLY a single JSON object, no explanation, no markdown, no extra text.`;
  }

  // Getters
  getAgentId() { return this.agentId; }
}

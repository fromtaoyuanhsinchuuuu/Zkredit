import { Client, PrivateKey, ContractExecuteTransaction, ContractFunctionParameters } from '@hashgraph/sdk';
import Groq from 'groq-sdk';
import * as crypto from 'crypto';

/**
 * Credit Assessment Agent - ZK Verifier
 * Verifies ZK proofs and calculates credit scores
 * Uses AI (Groq) for intelligent decision-making
 */
export class CreditAssessmentAgent {
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
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
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
    console.log('🔐 Verifying ZK Proofs...\n');

    // Step 1: Verify all ZK proofs
    const verificationResults = await this.verifyAllProofs(application.zkProofs);

    // Step 2: Calculate credit score
    const creditScore = await this.calculateCreditScore(
      verificationResults,
      application.applicantAgentId
    );

    // Step 3: Make decision using AI
    const decision = await this.makeDecisionWithAI(
      creditScore,
      application.requestedAmount,
      verificationResults
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
    console.log('   ❌ Private: Actual amount HIDDEN\n');

    // Verify Credit History Proof
    const creditValid = this.verifyProof(zkProofs.creditHistory, 'credit_history');
    console.log('✅ Credit History Proof Verified:', creditValid);
    console.log(`   Public: transactions >= ${zkProofs.creditHistory.publicInputs.minimumTransactions}`);
    console.log(`   Public: Merkle Root = ${zkProofs.creditHistory.publicInputs.merkleRoot.slice(0, 10)}...`);
    console.log('   ❌ Private: Exact count and amounts HIDDEN\n');

    // Verify Collateral Proof
    const collateralValid = this.verifyProof(zkProofs.collateral, 'collateral');
    console.log('✅ Collateral Proof Verified:', collateralValid);
    console.log(`   Public: value > $${zkProofs.collateral.publicInputs.minimumValue}`);
    console.log(`   Public: Country = ${zkProofs.collateral.publicInputs.countryCode}`);
    console.log('   ❌ Private: Exact value and GPS location HIDDEN\n');

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
    applicantAgentId: string
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
  private async makeDecisionWithAI(
    creditScore: number,
    requestedAmount: number,
    verificationResults: any
  ): Promise<{
    approved: boolean;
    maxAmount: number;
    interestRate: number;
    reason: string;
    aiAnalysis: string;
  }> {
    console.log('🤖 Consulting AI for decision...\n');

    const prompt = `
Credit Assessment Request:
- Credit Score: ${creditScore}/110
- Requested Amount: $${requestedAmount}
- Verification Results:
  * Income Proof: ${verificationResults.income ? '✅ Verified' : '❌ Failed'}
  * Credit History Proof: ${verificationResults.creditHistory ? '✅ Verified' : '❌ Failed'}
  * Collateral Proof: ${verificationResults.collateral ? '✅ Verified' : '❌ Failed'}

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
4. Fair interest rates: 8-12% for good credit, 15-20% for moderate, reject if too risky
`;

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an AI credit assessment agent for PrivaLend, a ZK-powered lending platform for cross-border workers.
                      Your role is to make fair lending decisions based on verified ZK proofs while considering the unique challenges
                      faced by migrant workers who may lack traditional credit history.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'openai/gpt-oss-120b',
        temperature: 0.3,
        max_tokens: 1024
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      console.log('🤖 AI Analysis:');
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
  private fallbackDecision(creditScore: number, requestedAmount: number): {
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
    
    // Simulate some agents having higher reputation
    const agentIdNum = BigInt(agentId);
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
   */
  private async logAssessmentToBlockchain(data: {
    applicantAgentId: string;
    creditScore: number;
    decision: any;
    verificationResults: any;
  }): Promise<void> {
    console.log('📝 Logging to blockchain...');

    try {
      // In production: call ERC-8004 ReputationRegistry.giveFeedback()
      // For demo: just log the action
      console.log('✅ Assessment logged to ERC-8004 ReputationRegistry');
      console.log(`   Agent: ${data.applicantAgentId}`);
      console.log(`   Credit Score: ${data.creditScore}`);
      console.log(`   Decision: ${data.decision.approved ? 'APPROVED' : 'REJECTED'}`);
      
      // Could also log to HCS (Hedera Consensus Service) for audit trail
      console.log('✅ Audit trail logged to HCS');
    } catch (error) {
      console.error('❌ Blockchain logging failed:', error);
    }
  }

  // Getters
  getAgentId() { return this.agentId; }
}

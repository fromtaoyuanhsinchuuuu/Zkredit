import { Client, PrivateKey } from '@hashgraph/sdk';
import * as crypto from 'crypto';

export class WorkerAgent {
  private agentId: bigint;
  private client: Client;
  private privateKey: PrivateKey;
  
  private privateData: {
    monthlyIncome: number;
    transactionHistory: any[];
    landValue: number;
    landTitleIPFS: string;
    gpsCoordinates: [number, number];
    employerSignature: string;
  };

  constructor(agentId: bigint, client: Client, privateKey: PrivateKey, privateData?: any) {
    this.agentId = agentId;
    this.client = client;
    this.privateKey = privateKey;
    this.privateData = {
      monthlyIncome: privateData?.monthlyIncome || 800,
      transactionHistory: privateData?.transactionHistory || [],
      landValue: privateData?.landValue || 15000,
      landTitleIPFS: privateData?.landTitleIPFS || 'QmLandTitle',
      gpsCoordinates: privateData?.gpsCoordinates || [16.8661, 96.1951],
      employerSignature: privateData?.employerSignature || '0xemployer'
    };
  }

  async generateIncomeProof(minimumIncome: number = 500) {
    console.log('\nIncome ZK Proof: actual=$' + this.privateData.monthlyIncome + ', proving >$' + minimumIncome);
    if (this.privateData.monthlyIncome < minimumIncome) {
      throw new Error('Income too low');
    }
    const timestamp = Date.now();
    const proof = this.mockProof({ actualIncome: this.privateData.monthlyIncome, minimumIncome, timestamp });
    return { proof, publicInputs: { minimumIncome, workerAgentId: this.agentId.toString(), timestamp }, proofType: 'income' };
  }

  async generateCreditHistoryProof(minimumTransactions: number = 1) {
    const count = this.privateData.transactionHistory.length;
    console.log('\nCredit History ZK Proof: actual=' + count + ', proving >=' + minimumTransactions);
    if (count < minimumTransactions) {
      throw new Error('Not enough transactions');
    }
    const merkleRoot = this.buildMerkleRoot(this.privateData.transactionHistory);
    const proof = this.mockProof({ count, minimumTransactions, merkleRoot });
    return { proof, publicInputs: { minimumTransactions, timeRangeMonths: 6, workerAgentId: this.agentId.toString(), merkleRoot }, proofType: 'credit_history' };
  }

  async generateCollateralProof(minimumValue: number = 10000) {
    console.log('\nCollateral ZK Proof: actual=$' + this.privateData.landValue + ', proving >$' + minimumValue);
    if (this.privateData.landValue < minimumValue) {
      throw new Error('Collateral value too low');
    }
    const proof = this.mockProof({ actualValue: this.privateData.landValue, minimumValue });
    return { proof, publicInputs: { minimumValue, countryCode: 'MM', workerAgentId: this.agentId.toString() }, proofType: 'collateral' };
  }

  async applyForLoan(amount: number) {
    console.log('\n=== LOAN APPLICATION: $' + amount + ' ===');
    const income = await this.generateIncomeProof(500);
    const credit = await this.generateCreditHistoryProof(1);
    const collateral = await this.generateCollateralProof(10000);
    console.log('=== ALL ZK PROOFS GENERATED ===\n');
    return { success: true, message: 'Loan application submitted', zkProofs: { income, creditHistory: credit, collateral } };
  }

  addTransaction(tx: any) {
    this.privateData.transactionHistory.push(tx);
    console.log('Transaction added. Total: ' + this.privateData.transactionHistory.length);
  }

  private mockProof(inputs: any): string {
    const hash = crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
    return '0x' + hash + hash.slice(0, 64);
  }

  private buildMerkleRoot(txs: any[]): string {
    if (txs.length === 0) return crypto.createHash('sha256').update('empty').digest('hex');
    const concat = txs.map(tx => tx.hash || crypto.randomBytes(32).toString('hex')).join('');
    return crypto.createHash('sha256').update(concat).digest('hex');
  }

  getAgentId() { return this.agentId; }
  getMonthlyIncome() { return this.privateData.monthlyIncome; }
  getTransactionCount() { return this.privateData.transactionHistory.length; }
  getLandValue() { return this.privateData.landValue; }
  getGPSCoordinates() { return this.privateData.gpsCoordinates; }
}

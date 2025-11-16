import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import zkreditPlugin from './plugins/zkreditPlugin';
import { generateFeedbackAuthForClient } from './services/feedbackAuthService';
import { WorkerAgent } from './agents/WorkerAgent';
import { CreditAssessmentAgent } from './agents/CreditAssessmentAgent';
import { RemittanceAgent } from './agents/RemittanceAgent';
import { ReceiverAgent } from './agents/ReceiverAgent';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Hedera client
const initializeHederaClient = () => {
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID || '0.0.7178277');
  const operatorKey = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!);

  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);

  return { client, operatorId, operatorKey };
};

const { client, operatorId, operatorKey } = initializeHederaClient();

// Plugin context
const context = {
  client,
  accountId: operatorId,
  privateKey: operatorKey,
};

// Load tools from plugin
const tools = zkreditPlugin.tools(context);

// Initialize agents for demo
let demoWorkerAgent: WorkerAgent | null = null;
let demoCreditAgent: CreditAssessmentAgent | null = null;
let demoRemittanceAgent: RemittanceAgent | null = null;
let demoReceiverAgent: ReceiverAgent | null = null;

/**
 * Auto-initialize all demo agents on startup
 */
const initializeDemoAgents = () => {
  console.log('🤖 Initializing demo agents...');
  
  try {
    // Worker Agent (Agent #1)
    demoWorkerAgent = new WorkerAgent(
      BigInt(1),
      client,
      operatorKey,
      {
        monthlyIncome: 800,
        landValue: 15000,
        gpsCoordinates: { latitude: 16.8661, longitude: 96.1951 }
      }
    );
    console.log('   ✅ Worker Agent #1 initialized');

    // Credit Assessment Agent (Agent #2)
    demoCreditAgent = new CreditAssessmentAgent(
      BigInt(2),
      client,
      operatorKey
    );
    console.log('   ✅ Credit Assessment Agent #2 initialized');

    // Remittance Agent (Agent #3)
    demoRemittanceAgent = new RemittanceAgent(
      BigInt(3),
      client,
      operatorKey
    );
    console.log('   ✅ Remittance Agent #3 initialized');

    // Receiver Agent (Agent #4)
    demoReceiverAgent = new ReceiverAgent(
      BigInt(4),
      client,
      operatorKey,
      operatorId
    );
    console.log('   ✅ Receiver Agent #4 initialized');
    
    console.log('🎉 All demo agents ready!\n');
  } catch (error: any) {
    console.error('❌ Failed to initialize demo agents:', error.message);
    console.error('   Please check your environment variables and Hedera configuration.');
  }
};

// Initialize agents on startup
initializeDemoAgents();

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'zkredit-agent-backend',
    version: '1.0.0',
    hedera: {
      network: 'testnet',
      accountId: operatorId.toString(),
    },
  });
});

/**
 * Get available tools
 */
app.get('/tools', (req, res) => {
  const toolList = tools.map(tool => ({
    method: tool.method,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters.shape,
  }));

  res.json({
    plugin: {
      name: zkreditPlugin.name,
      version: zkreditPlugin.version,
      description: zkreditPlugin.description,
    },
    tools: toolList,
  });
});

/**
 * Execute tool
 * POST /tools/:method
 */
app.post('/tools/:method', async (req, res) => {
  const { method } = req.params;
  const params = req.body;

  try {
    // Find tool
    const tool = tools.find(t => t.method === method);
    if (!tool) {
      return res.status(404).json({
        error: 'Tool not found',
        availableMethods: tools.map(t => t.method),
      });
    }

    // Validate parameters
    const validationResult = tool.parameters.safeParse(params);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: validationResult.error.errors,
      });
    }

    // Execute tool
    const result = await tool.execute(client, context, validationResult.data);

    res.json({
      success: true,
      method,
      result,
    });
  } catch (error: any) {
    console.error(`Tool execution error (${method}):`, error);
    res.status(500).json({
      error: 'Tool execution failed',
      message: error.message,
      method,
    });
  }
});

/**
 * Generate FeedbackAuth
 * POST /feedbackauth/generate
 */
app.post('/feedbackauth/generate', async (req, res) => {
  try {
    const {
      agentId,
      clientAddress,
      indexLimit = 10,
      expiryHours = 24,
    } = req.body;

    if (!agentId || !clientAddress) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['agentId', 'clientAddress'],
      });
    }

    const feedbackAuth = await generateFeedbackAuthForClient(
      BigInt(agentId),
      clientAddress,
      operatorKey.toStringRaw(),
      {
        indexLimit: BigInt(indexLimit),
        expiryHours: Number(expiryHours),
      }
    );

    res.json({
      success: true,
      feedbackAuth,
      params: {
        agentId,
        clientAddress,
        indexLimit,
        expiryHours,
      },
    });
  } catch (error: any) {
    console.error('FeedbackAuth generation error:', error);
    res.status(500).json({
      error: 'FeedbackAuth generation failed',
      message: error.message,
    });
  }
});

/**
 * Contract addresses
 */
app.get('/contracts', (req, res) => {
  res.json({
    identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS,
    reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS,
    validationRegistry: process.env.VALIDATION_REGISTRY_ADDRESS,
  });
});

/**
 * ========================================
 * AGENT ENDPOINTS
 * ========================================
 */

/**
 * Create Worker Agent
 * POST /agents/worker/create
 */
app.post('/agents/worker/create', async (req, res) => {
  try {
    const { agentId, privateData } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId required' });
    }

    demoWorkerAgent = new WorkerAgent(
      BigInt(agentId),
      client,
      operatorKey,
      privateData
    );

    res.json({
      success: true,
      message: 'Worker Agent created',
      agentId: agentId,
      stats: {
        monthlyIncome: demoWorkerAgent.getMonthlyIncome(),
        transactionCount: demoWorkerAgent.getTransactionCount(),
        landValue: demoWorkerAgent.getLandValue()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate ZK Proofs
 * POST /agents/worker/generate-proofs
 */
app.post('/agents/worker/generate-proofs', async (req, res) => {
  try {
    if (!demoWorkerAgent) {
      return res.status(400).json({ error: 'Worker agent not initialized. Call /agents/worker/create first' });
    }

    const { minimumIncome, minimumTransactions, minimumValue } = req.body;

    const incomeProof = await demoWorkerAgent.generateIncomeProof(minimumIncome);
    const creditProof = await demoWorkerAgent.generateCreditHistoryProof(minimumTransactions);
    const collateralProof = await demoWorkerAgent.generateCollateralProof(minimumValue);

    res.json({
      success: true,
      message: 'All ZK proofs generated',
      zkProofs: {
        income: incomeProof,
        creditHistory: creditProof,
        collateral: collateralProof
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Apply for Loan
 * POST /agents/worker/apply-loan
 */
app.post('/agents/worker/apply-loan', async (req, res) => {
  try {
    if (!demoWorkerAgent) {
      return res.status(400).json({ error: 'Worker agent not initialized' });
    }

    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'amount required' });
    }

    const result = await demoWorkerAgent.applyForLoan(amount);

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create Credit Assessment Agent
 * POST /agents/credit/create
 */
app.post('/agents/credit/create', async (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId required' });
    }

    demoCreditAgent = new CreditAssessmentAgent(
      BigInt(agentId),
      client,
      operatorKey
    );

    res.json({
      success: true,
      message: 'Credit Assessment Agent created',
      agentId: agentId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process Loan Application
 * POST /agents/credit/process-loan
 */
app.post('/agents/credit/process-loan', async (req, res) => {
  try {
    if (!demoCreditAgent) {
      return res.status(400).json({ error: 'Credit agent not initialized. Call /agents/credit/create first' });
    }

    const { applicantAgentId, requestedAmount, zkProofs } = req.body;

    if (!applicantAgentId || !requestedAmount || !zkProofs) {
      return res.status(400).json({ 
        error: 'applicantAgentId, requestedAmount, and zkProofs required' 
      });
    }

    const result = await demoCreditAgent.processLoanApplication({
      applicantAgentId,
      requestedAmount,
      zkProofs
    });

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create Remittance Agent
 * POST /agents/remittance/create
 */
app.post('/agents/remittance/create', async (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId required' });
    }

    demoRemittanceAgent = new RemittanceAgent(
      BigInt(agentId),
      client,
      operatorKey
    );

    res.json({
      success: true,
      message: 'Remittance Agent created',
      agentId: agentId,
      fees: demoRemittanceAgent.getFees()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process Remittance
 * POST /agents/remittance/send
 */
app.post('/agents/remittance/send', async (req, res) => {
  try {
    if (!demoRemittanceAgent) {
      return res.status(400).json({ error: 'Remittance agent not initialized. Call /agents/remittance/create first' });
    }

    const { senderAgentId, receiverAgentId, amount, currency, paymentProof } = req.body;

    if (!senderAgentId || !receiverAgentId || !amount) {
      return res.status(400).json({ 
        error: 'senderAgentId, receiverAgentId, and amount required' 
      });
    }

    const result = await demoRemittanceAgent.processRemittance({
      senderAgentId,
      receiverAgentId,
      amount,
      currency: currency || 'USD',
      paymentProof
    });

    // If worker agent exists, add transaction to history
    if (demoWorkerAgent && result.success) {
      demoWorkerAgent.addTransaction({
        hash: result.transactionHash,
        amount: result.netAmount,
        timestamp: Date.now(),
        recipient: receiverAgentId
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Remittance History
 * GET /agents/remittance/history/:agentId
 */
app.get('/agents/remittance/history/:agentId', async (req, res) => {
  try {
    if (!demoRemittanceAgent) {
      return res.status(400).json({ error: 'Remittance agent not initialized' });
    }

    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await demoRemittanceAgent.getRemittanceHistory(agentId, limit);
    const stats = await demoRemittanceAgent.getStatistics(agentId);

    res.json({
      success: true,
      agentId,
      history,
      statistics: stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create Receiver Agent
 * POST /agents/receiver/create
 */
app.post('/agents/receiver/create', async (req, res) => {
  try {
    const { agentId, accountId } = req.body;
    
    if (!agentId || !accountId) {
      return res.status(400).json({ error: 'agentId and accountId required' });
    }

    demoReceiverAgent = new ReceiverAgent(
      BigInt(agentId),
      client,
      operatorKey,
      AccountId.fromString(accountId)
    );

    res.json({
      success: true,
      message: 'Receiver Agent created',
      agentId: agentId,
      accountId: accountId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Receive Remittance Notification
 * POST /agents/receiver/notify
 */
app.post('/agents/receiver/notify', async (req, res) => {
  try {
    if (!demoReceiverAgent) {
      return res.status(400).json({ error: 'Receiver agent not initialized. Call /agents/receiver/create first' });
    }

    const { senderAgentId, amount, transactionHash, timestamp } = req.body;

    if (!senderAgentId || !amount || !transactionHash) {
      return res.status(400).json({ 
        error: 'senderAgentId, amount, and transactionHash required' 
      });
    }

    const result = await demoReceiverAgent.receiveRemittanceNotification({
      senderAgentId,
      amount,
      transactionHash,
      timestamp: timestamp || Date.now()
    });

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Confirm Receipt
 * POST /agents/receiver/confirm
 */
app.post('/agents/receiver/confirm', async (req, res) => {
  try {
    if (!demoReceiverAgent) {
      return res.status(400).json({ error: 'Receiver agent not initialized' });
    }

    const { transactionHash } = req.body;

    if (!transactionHash) {
      return res.status(400).json({ error: 'transactionHash required' });
    }

    const result = await demoReceiverAgent.confirmReceipt(transactionHash);

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Pending Receipts
 * GET /agents/receiver/pending
 */
app.get('/agents/receiver/pending', async (req, res) => {
  try {
    if (!demoReceiverAgent) {
      return res.status(400).json({ error: 'Receiver agent not initialized' });
    }

    const pending = demoReceiverAgent.getPendingReceipts();
    const stats = demoReceiverAgent.getStatistics();

    res.json({
      success: true,
      pending,
      statistics: stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Complete Demo Flow
 * POST /demo/complete-flow
 * Runs the entire flow: create agents -> send remittance -> apply for loan
 */
app.post('/demo/complete-flow', async (req, res) => {
  try {
    console.log('\n\n🎬 === COMPLETE DEMO FLOW START ===\n');

    const { workerAgentId, receiverAgentId, creditAgentId, remittanceAgentId } = req.body;

    // Step 1: Create all agents
    console.log('📝 Step 1: Creating agents...');
    const worker = new WorkerAgent(BigInt(workerAgentId || 1), client, operatorKey, {
      monthlyIncome: 800,
      transactionHistory: [
        { hash: '0xabc', amount: 200, timestamp: Date.now() - 5 * 30 * 24 * 60 * 60 * 1000 },
        { hash: '0xdef', amount: 150, timestamp: Date.now() - 4 * 30 * 24 * 60 * 60 * 1000 },
        { hash: '0xghi', amount: 300, timestamp: Date.now() - 3 * 30 * 24 * 60 * 60 * 1000 },
        { hash: '0xjkl', amount: 200, timestamp: Date.now() - 2 * 30 * 24 * 60 * 60 * 1000 },
        { hash: '0xmno', amount: 250, timestamp: Date.now() - 1 * 30 * 24 * 60 * 60 * 1000 },
      ],
      landValue: 15000
    });
    const credit = new CreditAssessmentAgent(BigInt(creditAgentId || 2), client, operatorKey);
    const remittance = new RemittanceAgent(BigInt(remittanceAgentId || 3), client, operatorKey);
    const receiver = new ReceiverAgent(BigInt(receiverAgentId || 4), client, operatorKey, operatorId);

    // Step 2: Process a remittance
    console.log('\n📝 Step 2: Processing remittance...');
    const remittanceResult = await remittance.processRemittance({
      senderAgentId: workerAgentId || '1',
      receiverAgentId: receiverAgentId || '4',
      amount: 200,
      currency: 'USD',
      paymentProof: 'payment_demo'
    });

    // Add transaction to worker history
    worker.addTransaction({
      hash: remittanceResult.transactionHash,
      amount: remittanceResult.netAmount,
      timestamp: Date.now(),
      recipient: receiverAgentId || '4'
    });

    // Step 3: Receiver confirms receipt
    console.log('\n📝 Step 3: Confirming receipt...');
    await receiver.receiveRemittanceNotification({
      senderAgentId: workerAgentId || '1',
      amount: remittanceResult.netAmount,
      transactionHash: remittanceResult.transactionHash,
      timestamp: Date.now()
    });
    const confirmResult = await receiver.confirmReceipt(remittanceResult.transactionHash);

    // Step 4: Apply for loan with ZK proofs
    console.log('\n📝 Step 4: Applying for loan with ZK proofs...');
    const loanApplication = await worker.applyForLoan(300);

    // Step 5: Credit agent processes loan
    console.log('\n📝 Step 5: Credit agent processing loan...');
    const creditResult = await credit.processLoanApplication({
      applicantAgentId: workerAgentId || '1',
      requestedAmount: 300,
      zkProofs: loanApplication.zkProofs
    });

    console.log('\n🎬 === COMPLETE DEMO FLOW END ===\n');

    res.json({
      success: true,
      message: 'Complete demo flow executed',
      results: {
        step1_agents: {
          worker: workerAgentId,
          credit: creditAgentId,
          remittance: remittanceAgentId,
          receiver: receiverAgentId
        },
        step2_remittance: remittanceResult,
        step3_confirmation: confirmResult,
        step4_loan_application: loanApplication,
        step5_credit_decision: creditResult
      },
      summary: {
        remittanceSent: `$${remittanceResult.netAmount}`,
        receiptConfirmed: confirmResult.verified,
        loanRequested: `$${300}`,
        loanApproved: creditResult.approved,
        loanAmount: `$${creditResult.maxLoanAmount}`,
        interestRate: `${creditResult.interestRate}%`,
        creditScore: `${creditResult.creditScore}/110`
      }
    });
  } catch (error: any) {
    console.error('❌ Demo flow error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * Contract addresses
 */

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 ZKredit Agent Backend');
  console.log('='.repeat(50));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌐 Hedera Network: Testnet`);
  console.log(`👤 Operator Account: ${operatorId.toString()}`);
  console.log(`🔧 Plugin: ${zkreditPlugin.name} v${zkreditPlugin.version}`);
  console.log(`🛠️  Available tools: ${tools.length}`);
  console.log('');
  console.log(`🤖 Demo Agents Status:`);
  console.log(`   Worker Agent #1: ${demoWorkerAgent ? '✅ Ready' : '❌ Not initialized'}`);
  console.log(`   Credit Agent #2: ${demoCreditAgent ? '✅ Ready' : '❌ Not initialized'}`);
  console.log(`   Remittance Agent #3: ${demoRemittanceAgent ? '✅ Ready' : '❌ Not initialized'}`);
  console.log(`   Receiver Agent #4: ${demoReceiverAgent ? '✅ Ready' : '❌ Not initialized'}`);
  console.log('');
  console.log('📍 Endpoints:');
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Tools: http://localhost:${PORT}/tools`);
  console.log(`   Demo: http://localhost:3000/demo`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  client.close();
  process.exit(0);
});

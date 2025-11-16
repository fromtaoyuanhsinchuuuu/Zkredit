import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AccountId } from '@hashgraph/sdk';
import zkreditPlugin from './plugins/zkreditPlugin';
import { createCreditAssessmentPluginTools } from './plugins/creditAssessmentPlugin';
import { generateFeedbackAuthForClient } from './services/feedbackAuthService';
import { WorkerAgent } from './agents/WorkerAgent';
import { CreditAssessmentAgent } from './agents/CreditAssessmentAgent';
import { CreditAssessmentAgent2 } from './agents/CreditAssessmentAgent2';
import { RemittanceAgent } from './agents/RemittanceAgent';
import { ReceiverAgent } from './agents/ReceiverAgent';
import { getHederaAgentTools } from './services/agentToolkit';
import { getHederaClient, getOperatorAccountId, getOperatorPrivateKey } from './services/hederaClient';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const client = getHederaClient();
const operatorId = getOperatorAccountId();
const operatorKey = getOperatorPrivateKey();

// Plugin context
const context = {
  client,
  accountId: operatorId,
  privateKey: operatorKey,
};

const registryTools = zkreditPlugin.tools(context);
const creditAssessmentTools = createCreditAssessmentPluginTools({ client, operatorKey });
const tools: any[] = [...registryTools, ...creditAssessmentTools];

type CreditAgentProfile = {
  id: string;
  name: string;
  corridor: string;
  sponsor: string;
  agentType: 'ngo' | 'defi' | 'experimental';
  status: 'active' | 'coming_soon';
  description: string;
  tagline: string;
  strengths: string[];
  instance?: CreditAssessmentAgent;
};

const DEFAULT_CORRIDOR = 'middle-east-to-philippines';

const creditAgentDirectory: CreditAgentProfile[] = [
  {
    id: 'credit_agent_low_interest',
    name: 'NGO Low-Interest Agent',
    corridor: DEFAULT_CORRIDOR,
    sponsor: 'Solidarity NGO',
    agentType: 'ngo',
    status: 'active',
    description: 'Community-backed agent that prioritizes low interest loans for domestic workers.',
    tagline: 'Trust-based loans capped at 8% APR',
    strengths: ['Community reputation', 'Short tenors', 'ERC-8004 verified'],
  },
  {
    id: 'credit_agent_defi_plus',
    name: 'DeFi Liquidity Pool Agent',
    corridor: DEFAULT_CORRIDOR,
    sponsor: 'Cross-Border DeFi LP',
    agentType: 'defi',
    status: 'active',
    description: 'Commercial agent that prices risk dynamically and settles via HTS + x402.',
    tagline: 'Bigger tickets for zk_verified borrowers',
    strengths: ['HTS liquidity', 'x402 native', 'AI underwriting'],
  },
  {
    id: 'credit_agent_experimental',
    name: 'Experimental Credit Lab',
    corridor: DEFAULT_CORRIDOR,
    sponsor: 'Research Collective',
    agentType: 'experimental',
    status: 'coming_soon',
    description: 'Early-stage agent piloting programmable repayments and FX hedging.',
    tagline: 'Future multi-corridor agent (waitlist open)',
    strengths: ['Programmable repayments', 'Multi-currency roadmap'],
  },
];

const loanOfferTemplates: Record<string, {
  amount: number;
  interestRate: number;
  tenureMonths: number;
  disbursementHours: number;
  repaymentFrequency: string;
}> = {
  credit_agent_low_interest: { amount: 100, interestRate: 8, tenureMonths: 3, disbursementHours: 4, repaymentFrequency: 'monthly' },
  credit_agent_defi_plus: { amount: 150, interestRate: 10, tenureMonths: 4, disbursementHours: 2, repaymentFrequency: 'monthly' },
};

const loanAnalysisTemplates: Record<string, {
  incomeBand: string;
  employmentMonths: number;
  repaymentHistory: string;
  hcsTopic: string;
}> = {
  credit_agent_low_interest: {
    incomeBand: 'USD 650-820 / month',
    employmentMonths: 18,
    repaymentHistory: '3/3 on-time transfers logged on HCS topic 0.0.920393',
    hcsTopic: '0.0.920393',
  },
  credit_agent_defi_plus: {
    incomeBand: 'USD 700-900 / month',
    employmentMonths: 20,
    repaymentHistory: '5 settlements verified via ERC-8004 feedback proofs',
    hcsTopic: '0.0.920393',
  },
};

type WorkerZkProofs = {
  income: any;
  creditHistory: any;
  collateral: any;
};

type CreditAssessmentDecision = Awaited<ReturnType<CreditAssessmentAgent['processLoanApplication']>>;

type LoanOfferTemplate = {
  amount: number;
  interestRate: number;
  tenureMonths: number;
  disbursementHours: number;
  repaymentFrequency: string;
};

const DEFAULT_LOAN_TEMPLATE: LoanOfferTemplate = {
  amount: 120,
  interestRate: 12,
  tenureMonths: 3,
  disbursementHours: 6,
  repaymentFrequency: 'monthly',
};

const getCreditAgentProfile = (profileId: string) =>
  creditAgentDirectory.find((profile) => profile.id === profileId);

const getLoanTemplateForProfile = (profileId: string): LoanOfferTemplate =>
  loanOfferTemplates[profileId] || DEFAULT_LOAN_TEMPLATE;

const getAnalysisTemplateForProfile = (profileId: string) =>
  loanAnalysisTemplates[profileId];

const syncCreditAgentDirectoryInstances = () => {
  creditAgentDirectory.forEach((profile) => {
    if (profile.id === 'credit_agent_low_interest') {
      profile.instance = demoCreditAgent || undefined;
    } else if (profile.id === 'credit_agent_defi_plus') {
      profile.instance = demoCreditAgentB || undefined;
    }
  });
};

type EvaluateCorridorCreditOffersInput = {
  workerAgentId: string;
  requestedAmount: number;
  zkProofs: WorkerZkProofs;
  agentOverrides?: Partial<Record<string, CreditAssessmentAgent>>;
};

const evaluateCorridorCreditOffers = async ({
  workerAgentId,
  requestedAmount,
  zkProofs,
  agentOverrides = {},
}: EvaluateCorridorCreditOffersInput) => {
  const activeProfiles = creditAgentDirectory.filter(
    (profile) => profile.status === 'active'
  );

  const offers = [] as Array<{
    agentId: string;
    agentName: string;
    sponsor: string;
    corridor: string;
    agentType: string;
    tagline: string;
    strengths: string[];
    status: string;
    offer: {
      amount: number;
      apr: number;
      tenureMonths: number;
      disbursementHours: number;
      repaymentFrequency: string;
      approved: boolean;
      rationale: string;
      creditScore: number;
    };
    underwritingSummary?: {
      incomeBand: string;
      employmentMonths: number;
      repaymentHistory: string;
      hcsTopic: string;
    };
    decision: CreditAssessmentDecision;
    rank?: number;
  }>;

  for (const profile of activeProfiles) {
    const instance = agentOverrides[profile.id] || profile.instance;
    if (!instance) {
      continue;
    }

    const decision = await instance.processLoanApplication({
      applicantAgentId: workerAgentId,
      requestedAmount,
      zkProofs,
    });

    const template = getLoanTemplateForProfile(profile.id);
    const analysisTemplate = getAnalysisTemplateForProfile(profile.id);

    offers.push({
      agentId: profile.id,
      agentName: profile.name,
      sponsor: profile.sponsor,
      corridor: profile.corridor,
      agentType: profile.agentType,
      tagline: profile.tagline,
      strengths: profile.strengths,
      status: profile.status,
      offer: {
        amount: decision.maxLoanAmount || template.amount,
        apr: decision.interestRate || template.interestRate,
        tenureMonths: template.tenureMonths,
        disbursementHours: template.disbursementHours,
        repaymentFrequency: template.repaymentFrequency,
        approved: decision.approved,
        rationale: decision.reason,
        creditScore: decision.creditScore,
      },
      underwritingSummary: analysisTemplate,
      decision,
    });
  }

  offers.sort((a, b) => {
    if (b.offer.amount !== a.offer.amount) {
      return b.offer.amount - a.offer.amount;
    }
    if (a.offer.apr !== b.offer.apr) {
      return a.offer.apr - b.offer.apr;
    }
    return a.offer.disbursementHours - b.offer.disbursementHours;
  });

  offers.forEach((offer, index) => {
    offer.rank = index + 1;
  });

  return {
    corridor: DEFAULT_CORRIDOR,
    requestedAmount,
    workerAgentId,
    offers,
    selectedOffer: offers[0] || null,
    comparedAgents: offers.length,
    selectionCriteria: 'Prefers highest amount, lowest APR, then fastest disbursement',
  };
};

// Initialize agents for demo
let demoWorkerAgent: WorkerAgent | null = null;
let demoCreditAgent: CreditAssessmentAgent | null = null;
let demoCreditAgentB: CreditAssessmentAgent | null = null;
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

    // Credit Assessment Agent B (Agent #2B)
    demoCreditAgentB = new CreditAssessmentAgent2(
      BigInt(5),
      client,
      operatorKey
    );
    console.log('   ✅ Credit Assessment Agent #2B initialized (alternative offer)');

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
    
  syncCreditAgentDirectoryInstances();
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
 * Hedera Agent Kit Tools
 */
app.get('/agent-kit/tools', (req, res) => {
  const hederaTools = getHederaAgentTools();
  res.json({
    count: hederaTools.length,
    tools: hederaTools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
    })),
  });
});

app.post('/agent-kit/tools/:name', async (req, res) => {
  const { name } = req.params;
  const hederaTools = getHederaAgentTools();
  const tool = hederaTools.find((t: any) => t.name === name);

  if (!tool) {
    return res.status(404).json({
      error: 'Hedera Agent Kit tool not found',
      availableTools: hederaTools.map((t: any) => t.name),
    });
  }

  try {
    const result = await tool.invoke(req.body);
    res.json({ success: true, tool: tool.name, result });
  } catch (error: any) {
    console.error(`Hedera Agent Kit tool error (${name}):`, error);
    res.status(500).json({
      error: 'Hedera Agent Kit tool execution failed',
      message: error.message,
    });
  }
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

  const executionContext = (creditAssessmentTools as any[]).includes(tool)
      ? { accountId: operatorId.toString() }
      : context;

    const result = await tool.execute(client, executionContext as any, validationResult.data);

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
 * Credit Agent Directory
 * GET /agents/credit/directory
 */
app.get('/agents/credit/directory', (req, res) => {
  const corridor = typeof req.query.corridor === 'string' ? req.query.corridor : DEFAULT_CORRIDOR;
  const agents = creditAgentDirectory
    .filter((profile) => profile.corridor === corridor)
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      sponsor: profile.sponsor,
      corridor: profile.corridor,
      agentType: profile.agentType,
      status: profile.status,
      tagline: profile.tagline,
      strengths: profile.strengths,
      description: profile.description,
      online: Boolean(profile.instance),
    }));

  res.json({
    success: true,
    corridor,
    agents,
  });
});

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
    const { agentId, profileId = 'credit_agent_low_interest' } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId required' });
    }

    const numericAgentId = BigInt(agentId);
    const supportedProfiles = ['credit_agent_low_interest', 'credit_agent_defi_plus'];

    if (!supportedProfiles.includes(profileId)) {
      return res.status(400).json({ error: `Unsupported credit agent profile ${profileId}` });
    }

    if (profileId === 'credit_agent_low_interest') {
      demoCreditAgent = new CreditAssessmentAgent(
        numericAgentId,
        client,
        operatorKey
      );
    } else if (profileId === 'credit_agent_defi_plus') {
      demoCreditAgentB = new CreditAssessmentAgent2(
        numericAgentId,
        client,
        operatorKey
      );
    }

    syncCreditAgentDirectoryInstances();

    res.json({
      success: true,
      message: 'Credit Assessment Agent created',
      agentId: agentId,
      profileId,
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
    const { applicantAgentId, requestedAmount, zkProofs, profileId = 'credit_agent_low_interest' } = req.body;

    const agentInstance = profileId === 'credit_agent_defi_plus' ? demoCreditAgentB : demoCreditAgent;
    if (!agentInstance) {
      return res.status(400).json({ error: `Credit agent (${profileId}) not initialized. Call /agents/credit/create first` });
    }

    if (!applicantAgentId || !requestedAmount || !zkProofs) {
      return res.status(400).json({ 
        error: 'applicantAgentId, requestedAmount, and zkProofs required' 
      });
    }

    const result = await agentInstance.processLoanApplication({
      applicantAgentId,
      requestedAmount,
      zkProofs
    });

    const profile = getCreditAgentProfile(profileId);

    res.json({
      success: true,
      profileId,
      agentName: profile?.name,
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Fetch multi-agent credit offers for a worker
 * POST /agents/credit/offers
 */
app.post('/agents/credit/offers', async (req, res) => {
  try {
    const {
      workerAgentId = '1',
      requestedAmount = 120,
      zkProofs,
    } = req.body;

    let preparedProofs = zkProofs as WorkerZkProofs | undefined;

    if (!preparedProofs) {
      if (!demoWorkerAgent) {
        return res.status(400).json({ error: 'No zkProofs supplied and demo worker agent not initialized.' });
      }

      const application = await demoWorkerAgent.applyForLoan(requestedAmount);
      preparedProofs = application.zkProofs as WorkerZkProofs;
    }

    const offers = await evaluateCorridorCreditOffers({
      workerAgentId: workerAgentId.toString(),
      requestedAmount,
      zkProofs: preparedProofs,
    });

    res.json({
      success: true,
      autoGeneratedProofs: !zkProofs,
      offers,
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
    const normalizedWorkerAgentId = (workerAgentId || '1').toString();
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
    const primaryCreditAgentId = BigInt(creditAgentId || 2);
    const secondaryCreditAgentId = primaryCreditAgentId + 100n;
    const credit = new CreditAssessmentAgent(primaryCreditAgentId, client, operatorKey);
    const creditAlt = new CreditAssessmentAgent2(secondaryCreditAgentId, client, operatorKey);
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
    const requestedLoanAmount = 300;
    const loanApplication = await worker.applyForLoan(requestedLoanAmount);

    // Step 5: Compare multi-agent credit offers
    console.log('\n📝 Step 5: Comparing corridor credit offers...');
    const corridorOffers = await evaluateCorridorCreditOffers({
      workerAgentId: normalizedWorkerAgentId,
      requestedAmount: requestedLoanAmount,
      zkProofs: loanApplication.zkProofs as WorkerZkProofs,
      agentOverrides: {
        credit_agent_low_interest: credit,
        credit_agent_defi_plus: creditAlt,
      },
    });

    corridorOffers.offers.forEach((offer) => {
      console.log(`   • ${offer.agentName} (${offer.sponsor}) -> $${offer.offer.amount} at ${offer.offer.apr}% APR for ${offer.offer.tenureMonths} months`);
    });

    const selectedOffer = corridorOffers.selectedOffer;
    if (selectedOffer) {
      console.log(`\n🏆 Worker Agent selects ${selectedOffer.agentName} because it offers $${selectedOffer.offer.amount} at ${selectedOffer.offer.apr}% with ${selectedOffer.offer.tenureMonths} month tenor.`);
    }

    const creditResult = selectedOffer?.decision || null;

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
        step5_credit_marketplace: corridorOffers,
        step5_credit_decision: creditResult
      },
      summary: {
        remittanceSent: `$${remittanceResult.netAmount}`,
        receiptConfirmed: confirmResult.verified,
        loanRequested: `$${requestedLoanAmount}`,
        loanApproved: creditResult?.approved ?? false,
        loanAmount: creditResult ? `$${creditResult.maxLoanAmount}` : 'N/A',
        interestRate: creditResult ? `${creditResult.interestRate}%` : 'N/A',
        creditScore: creditResult ? `${creditResult.creditScore}/110` : 'N/A',
        selectedCreditAgent: selectedOffer?.agentName || 'No offer available'
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
  console.log(`   Credit Agent #2B: ${demoCreditAgentB ? '✅ Ready' : '❌ Not initialized'}`);
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

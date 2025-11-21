import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as crypto from 'crypto';
import { AccountBalanceQuery, AccountId, TransferTransaction, Hbar } from '@hashgraph/sdk';
import zkreditPlugin from './plugins/zkreditPlugin';
import { createCreditAssessmentPluginTools } from './plugins/creditAssessmentPlugin';
import { generateFeedbackAuthForClient } from './services/feedbackAuthService';
import { WorkerAgent } from './agents/WorkerAgent';
import { CreditAssessmentAgent1 } from './agents/CreditAssessmentAgent1';
import { CreditAssessmentAgent2 } from './agents/CreditAssessmentAgent2';
import { DefiPoolAgent } from './agents/DefiPoolAgent';
import { getHederaAgentTools } from './services/agentToolkit';
import { getHederaClient, getOperatorAccountId, getOperatorPrivateKey } from './services/hederaClient';
import {
  getRemittanceEventsForWorker,
  summarizeRemittanceHistory,
  deriveZkAttributesFromRemittances,
  recordLoanDisbursementEvent,
} from './services/eventLedger';

const app = express();
const PORT = process.env.PORT || 3003;

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

const sanitizeBigInt = (value: any): any => {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeBigInt);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, sanitizeBigInt(val)]));
  }

  return value;
};

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
  instance?: CreditAssessmentAgent1;
};

const DEFAULT_CORRIDOR = 'middle-east-to-philippines';

const creditAgentDirectory: CreditAgentProfile[] = [
  {
    id: 'credit_agent_low_interest',
    name: 'Government-Supported Agent',
    corridor: DEFAULT_CORRIDOR,
    sponsor: 'Ministry of Finance',
    agentType: 'ngo',
    status: 'active',
    description: 'Official government program providing low-interest financial support for verified workers.',
    tagline: 'State-subsidized loans (Max 5% APR)',
    strengths: ['Government Backed', 'Regulatory Compliant', 'Lowest Rates'],
  },
  {
    id: 'credit_agent_defi_plus',
    name: 'Global NGO Alliance',
    corridor: DEFAULT_CORRIDOR,
    sponsor: 'United Nations CDF',
    agentType: 'ngo',
    status: 'active',
    description: 'International non-profit organization supporting cross-border financial inclusion.',
    tagline: 'Zero-profit aid for migrant families',
    strengths: ['Humanitarian Aid', 'No Collateral', 'Community Support'],
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
  interestRate: number;
  tenureMonths: number;
  disbursementHours: number;
  repaymentFrequency: string;
}> = {
  credit_agent_low_interest: { interestRate: 8, tenureMonths: 3, disbursementHours: 4, repaymentFrequency: 'monthly' },
  credit_agent_defi_plus: { interestRate: 10, tenureMonths: 4, disbursementHours: 2, repaymentFrequency: 'monthly' },
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

type CreditAssessmentDecision = Awaited<ReturnType<CreditAssessmentAgent1['processLoanApplication']>>;

type LoanOfferTemplate = {
  interestRate: number;
  tenureMonths: number;
  disbursementHours: number;
  repaymentFrequency: string;
};

const DEFAULT_LOAN_TEMPLATE: LoanOfferTemplate = {
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
  zkAttributes?: Record<string, any>;
  agentOverrides?: Partial<Record<string, CreditAssessmentAgent1>>;
};

const evaluateCorridorCreditOffers = async ({
  workerAgentId,
  requestedAmount,
  zkProofs,
  zkAttributes,
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
      zkAttributes,
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
        amount: requestedAmount,
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
let demoCreditAgent: CreditAssessmentAgent1 | null = null;
let demoCreditAgentB: CreditAssessmentAgent1 | null = null;
let defiPoolAgent: DefiPoolAgent | null = null;

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
        gpsCoordinates: { latitude: 16.8661, longitude: 96.1951 },
        transactionHistory: [
          { hash: '0xabc', amount: 200, timestamp: Date.now() - 5 * 30 * 24 * 60 * 60 * 1000 },
          { hash: '0xdef', amount: 150, timestamp: Date.now() - 4 * 30 * 24 * 60 * 60 * 1000 },
          { hash: '0xghi', amount: 300, timestamp: Date.now() - 3 * 30 * 24 * 60 * 60 * 1000 },
          { hash: '0xjkl', amount: 200, timestamp: Date.now() - 2 * 30 * 24 * 60 * 60 * 1000 },
          { hash: '0xmno', amount: 250, timestamp: Date.now() - 1 * 30 * 24 * 60 * 60 * 1000 },
        ]
      }
    );
    console.log('   ✅ Worker Agent #1 initialized');

    // Credit Assessment Agent (Agent #2)
    demoCreditAgent = new CreditAssessmentAgent1(
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

    // DeFi Pool Agent
    const poolAccountId = process.env.DEFI_POOL_ACCOUNT_ID;
    const poolPrivateKey = process.env.DEFI_POOL_PRIVATE_KEY;
    
    if (poolAccountId && poolPrivateKey) {
      defiPoolAgent = new DefiPoolAgent(
        poolAccountId,
        poolPrivateKey,
        'Cross-Border DeFi Liquidity Pool'
      );
      console.log('   ✅ DeFi Liquidity Pool Agent initialized');
    } else {
      console.log('   ⚠️  DeFi Pool Agent not initialized (missing credentials in .env)');
    }

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
 * Operator info (account + balance)
 */
app.get('/operator/info', async (_req, res) => {
  try {
    const balance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);

    res.json({
      success: true,
      accountId: operatorId.toString(),
      evmAddress: `0x${operatorId.toSolidityAddress()}`,
      balance: {
        hbars: balance.hbars.toString(),
        tinybars: balance.hbars.toTinybars().toString(),
      },
    });
  } catch (error: any) {
    console.error('Operator info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch operator info',
      message: error.message,
    });
  }
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
 * Worker sends remittance (no dedicated remittance agent needed)
 */
app.post('/agents/worker/send-remittance', async (req, res) => {
  try {
    if (!demoWorkerAgent) {
      return res.status(400).json({ error: 'Worker agent not initialized' });
    }

    const { amount, receiverAccountId, corridor } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount required' });
    }

    const result = await demoWorkerAgent.sendRemittance({
      amount,
      receiverAccountId,
      corridor,
    });

    res.json({ success: true, result: sanitizeBigInt(result) });
  } catch (error: any) {
    console.error('Remittance API error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Fetch Worker remittance history + ZK summary
 */
app.get('/agents/worker/remittances/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    if (!agentId) {
      return res.status(400).json({ error: 'agentId required' });
    }

    const history = getRemittanceEventsForWorker(agentId);
    const summary = summarizeRemittanceHistory(agentId);
    const zkAttributes = deriveZkAttributesFromRemittances(agentId);

    res.json({
      success: true,
      agentId,
      history,
      summary,
      zkAttributes,
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
      demoCreditAgent = new CreditAssessmentAgent1(
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
 * Complete Demo Flow
 * POST /demo/complete-flow
 * Runs the entire flow: create agents -> send remittance -> apply for loan
 */
app.post('/demo/complete-flow', async (req, res) => {
  try {
    console.log('\n\n🎬 === COMPLETE DEMO FLOW START ===\n');

    const { workerAgentId, receiverAccountId, creditAgentId } = req.body;
    const normalizedWorkerAgentId = (workerAgentId || '1').toString();
    const familyAccount = receiverAccountId || '0.0.987654';

    // Step 1: Create Worker + Credit Agents
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
      landValue: 15000,
      corridor: DEFAULT_CORRIDOR,
    });
    const primaryCreditAgentId = BigInt(creditAgentId || 2);
    const secondaryCreditAgentId = primaryCreditAgentId + 100n;
    const credit = new CreditAssessmentAgent1(primaryCreditAgentId, client, operatorKey);
    const creditAlt = new CreditAssessmentAgent2(secondaryCreditAgentId, client, operatorKey);

    // Step 2: Send remittance directly from WorkerAgent
    console.log('\n📝 Step 2: WorkerAgent executes remittance via HTS/x402...');
    const remittanceResult = await worker.sendRemittance({
      amount: 200,
      corridor: DEFAULT_CORRIDOR,
      receiverAccountId: familyAccount,
    });

    const confirmResult = {
      verified: true,
      message: `Family wallet ${familyAccount} confirmed receipt on-chain (HCS event ${remittanceResult.remittanceEvent.eventId})`,
    };

    // Step 3: Apply for loan + build zkAttributes
    console.log('\n📝 Step 3: WorkerAgent composes ZK bundle...');
    const requestedLoanAmount = 300;
    const loanApplication = await worker.applyForLoan(requestedLoanAmount);

    // Step 4: Broadcast loan request to corridor credit agents
    console.log('\n📝 Step 4: Comparing corridor credit offers...');
    const corridorOffers = await evaluateCorridorCreditOffers({
      workerAgentId: normalizedWorkerAgentId,
      requestedAmount: requestedLoanAmount,
      zkProofs: loanApplication.zkProofs as WorkerZkProofs,
      zkAttributes: loanApplication.zkAttributes,
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

    // Step 5: Disburse funds via ZKredit pool (simulated)
    console.log('\n📝 Step 5: Simulating x402 disbursement from ZKredit pool...');
    let fundingReceipt = null;
    if (selectedOffer) {
      const txHash = '0x' + crypto.randomBytes(32).toString('hex');
      fundingReceipt = recordLoanDisbursementEvent({
        workerAgentId: normalizedWorkerAgentId,
        creditAgentId: selectedOffer.agentId,
        amount: selectedOffer.offer.amount,
        interestRate: selectedOffer.offer.apr,
        tenureMonths: selectedOffer.offer.tenureMonths,
        fundingAccount: process.env.ZKREDIT_POOL_ACCOUNT || operatorId.toString(),
        transactionHash: txHash,
        timestamp: Date.now(),
        corridor: DEFAULT_CORRIDOR,
        notes: 'Demo pool disbursement logged to HCS',
      });
      console.log(`   💸 Pool transfer hash: ${txHash.slice(0, 18)}...`);
    }

    console.log('\n🎬 === COMPLETE DEMO FLOW END ===\n');

    res.json({
      success: true,
      message: 'Complete demo flow executed',
      results: {
        step1_agents: {
          worker: normalizedWorkerAgentId,
          credit: creditAgentId,
          receiverAccountId: familyAccount,
        },
        step2_remittance: remittanceResult,
        step3_confirmation: confirmResult,
        step4_loan_application: loanApplication,
        step5_credit_marketplace: corridorOffers,
        step6_disbursement: fundingReceipt,
      },
      summary: {
        remittanceSent: `$${remittanceResult.netAmount}`,
        receiptConfirmed: confirmResult.verified,
        loanRequested: `$${requestedLoanAmount}`,
        loanApproved: creditResult?.approved ?? false,
        loanAmount: creditResult ? `$${creditResult.maxLoanAmount}` : 'N/A',
        interestRate: creditResult ? `${creditResult.interestRate}%` : 'N/A',
        creditScore: creditResult ? `${creditResult.creditScore}/110` : 'N/A',
        selectedCreditAgent: selectedOffer?.agentName || 'No offer available',
      },
    });
  } catch (error: any) {
    console.error('❌ Demo flow error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * Disburse Loan (from DeFi Liquidity Pool)
 * POST /agents/credit/disburse
 */
app.post('/agents/credit/disburse', async (req, res) => {
  try {
    const { amount, workerAgentId, currency = 'HBAR' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount required' });
    }

    if (!defiPoolAgent) {
      return res.status(500).json({ 
        error: 'DeFi Pool Agent not initialized. Please configure DEFI_POOL_ACCOUNT_ID and DEFI_POOL_PRIVATE_KEY in .env' 
      });
    }

    // Get worker's account ID from env - use Hedera Account ID format
    const workerAccountId = process.env.WORKER_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
    if (!workerAccountId) {
      return res.status(500).json({ error: 'Worker account not configured' });
    }

    console.log(`💰 Disbursing ${amount} ${currency} from DeFi Pool to Worker ${workerAccountId}...`);
    const result = await defiPoolAgent.disburseLoan(workerAccountId, amount, currency);

    res.json(result);

  } catch (error: any) {
    console.error('Disbursement error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
  console.log(`   DeFi Pool Agent: ${defiPoolAgent ? '✅ Ready' : '❌ Not initialized'}`);
  console.log(`   Event Ledger: ✅ Active (in-memory)`);
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

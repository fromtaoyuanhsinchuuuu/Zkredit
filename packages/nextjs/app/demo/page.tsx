"use client";

import React, { useEffect, useState } from "react";

type DemoStep = "profile" | "remittance" | "confirm" | "zkproof" | "loan" | "offers" | "result" | "savings";

interface AgentProfile {
  role: "worker" | "receiver";
  name: string;
  monthlyIncome?: number;
  landValue?: number;
}

interface RemittanceEvent {
  eventId: string;
  workerAgentId: string;
  remittanceAgentId: string;
  receiverAgentId: string;
  corridor: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  transactionHash: string;
  timestamp: number;
}

interface RemittanceResult {
  success: boolean;
  transactionHash: string;
  fee: number;
  netAmount: number;
  corridor: string;
  currency: string;
  remittanceEvent: RemittanceEvent;
  message: string;
}

interface RemittanceLedgerData {
  history: RemittanceEvent[];
  summary: {
    monthsWithRemittance: number;
    totalVolume: number;
    accountAgeMonths: number;
    totalTransactions: number;
    events: RemittanceEvent[];
  };
  zkAttributes: {
    stable_remitter: boolean;
    total_remitted_band: string;
    account_age_band: string;
    months_with_activity: number;
    total_transactions: number;
    [key: string]: unknown;
  };
}

interface LoanResult {
  approved: boolean;
  creditScore: number;
  maxLoanAmount: number;
  interestRate: number;
  reason: string;
  aiAnalysis?: string;
  details?: {
    aiAnalysis?: string;
    [key: string]: unknown;
  };
}

interface CreditOffer {
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
  decision: LoanResult;
  rank?: number;
}

const formatAddress = (address: string) => {
  if (!address) {
    return "";
  }
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState<DemoStep>("profile");
  const [workerProfile, setWorkerProfile] = useState<AgentProfile>({
    role: "worker",
    name: "Ahmad",
    monthlyIncome: 800,
    landValue: 15000,
  });
  const [receiverProfile, setReceiverProfile] = useState<AgentProfile>({
    role: "receiver",
    name: "Fatima",
  });
  const [familyAccountId, setFamilyAccountId] = useState("");
  const initialRemittanceAmount = 200;
  const [remittanceAmount, setRemittanceAmount] = useState(initialRemittanceAmount);
  const [remittanceAmountInput, setRemittanceAmountInput] = useState(initialRemittanceAmount.toString());
  const [loanAmount, setLoanAmount] = useState(300);
  const [loanAmountInput, setLoanAmountInput] = useState("300");
  const [remittanceResult, setRemittanceResult] = useState<RemittanceResult | null>(null);
  const [remittanceLedger, setRemittanceLedger] = useState<RemittanceLedgerData | null>(null);
  const [loanMarketplace, setLoanMarketplace] = useState<any | null>(null);
  const [loanOffers, setLoanOffers] = useState<CreditOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<CreditOffer | null>(null);
  const [loanResult, setLoanResult] = useState<LoanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [operatorInfo, setOperatorInfo] = useState<{
    accountId: string;
    evmAddress: string;
    balanceHbars: string;
  } | null>(null);
  const [operatorInfoError, setOperatorInfoError] = useState<string | null>(null);

  // Savings Step State
  const [savingsChatHistory, setSavingsChatHistory] = useState<
    { sender: "agent" | "user"; text: React.ReactNode; options?: { label: string; value: string }[] }[]
  >([]);
  const [isSavingsExecuting, setIsSavingsExecuting] = useState(false);

  // API 調用
  const API_BASE = "http://localhost:3003";
  const DEMO_WORKER_AGENT_ID = "1";
  // Enable Demo Mode if not on localhost (e.g. Vercel)
  const IS_DEMO_MODE = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);

  useEffect(() => {
    console.log("Running in:", typeof window !== "undefined" ? window.location.hostname : "server", "| Demo Mode:", IS_DEMO_MODE);

    const fetchOperatorInfo = async () => {
      try {
        if (IS_DEMO_MODE) {
          // Mock response for Demo Mode
          setOperatorInfo({
            accountId: "0.0.123456",
            evmAddress: "0x71C...3A19",
            balanceHbars: "1000.00",
          });
          setOperatorInfoError(null);
          return;
        }

        const response = await fetch(`${API_BASE}/operator/info`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Unknown backend error");
        }

        setOperatorInfo({
          accountId: data.accountId,
          evmAddress: data.evmAddress,
          balanceHbars: data.balance?.hbars ?? "",
        });
        setOperatorInfoError(null);
      } catch (error: any) {
        console.error("Failed to fetch operator info", error);
        setOperatorInfo(null);
        setOperatorInfoError(error.message || "Unable to load operator info");
      }
    };

    fetchOperatorInfo();
  }, []);

  const applyOfferSelection = (offer: CreditOffer | null) => {
    setSelectedOffer(offer);
    if (offer) {
      setLoanResult({
        approved: offer.decision.approved,
        creditScore: offer.decision.creditScore,
        maxLoanAmount: offer.decision.maxLoanAmount,
        interestRate: offer.decision.interestRate,
        reason: offer.decision.reason,
        aiAnalysis: offer.decision.aiAnalysis || offer.decision.details?.aiAnalysis || offer.offer.rationale,
        details: offer.decision.details,
      });
    } else {
      setLoanResult(null);
    }
  };

  const handleRemittanceAmountChange = (rawValue: string) => {
    if (rawValue === "") {
      setRemittanceAmountInput("");
      setRemittanceAmount(0);
      return;
    }

    const normalizedValue = rawValue.replace(/^0+(?=\d)/, "");
    const displayValue = normalizedValue === "" ? "0" : normalizedValue;
    setRemittanceAmountInput(displayValue);

    const numericValue = Number(displayValue);
    if (!Number.isNaN(numericValue)) {
      setRemittanceAmount(numericValue);
    }
  };

  const handleLoanAmountChange = (rawValue: string) => {
    if (rawValue === "") {
      setLoanAmountInput("");
      setLoanAmount(0);
      return;
    }

    const normalizedValue = rawValue.replace(/^0+(?=\d)/, "");
    const displayValue = normalizedValue === "" ? "0" : normalizedValue;
    setLoanAmountInput(displayValue);

    const numericValue = Number(displayValue);
    if (!Number.isNaN(numericValue)) {
      setLoanAmount(numericValue);
    }
  };

  const handleSendRemittance = async () => {
    if (!familyAccountId) {
      alert("Please provide a receiver account ID before sending remittances.");
      return;
    }

    setLoading(true);
    try {
      let data;
      if (IS_DEMO_MODE) {
        // Mock response for Demo Mode
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        data = {
          success: true,
          result: {
            success: true,
            transactionHash: "0xmocktransactionhash123456789",
            fee: 1.5,
            netAmount: remittanceAmount - 1.5,
            corridor: "US-MX",
            currency: "HBAR",
            remittanceEvent: {
              eventId: "evt-mock-001",
              workerAgentId: "1",
              remittanceAgentId: "remit-01",
              receiverAgentId: "recv-01",
              corridor: "US-MX",
              amount: remittanceAmount,
              fee: 1.5,
              netAmount: remittanceAmount - 1.5,
              currency: "HBAR",
              transactionHash: "0xmocktransactionhash123456789",
              timestamp: Date.now(),
            },
            message: "Remittance processed successfully (Demo Mode)",
          },
        };
      } else {
        const response = await fetch(`${API_BASE}/agents/worker/send-remittance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: remittanceAmount,
            receiverAccountId: familyAccountId,
          }),
        });
        data = await response.json();
      }

      if (data.success && data.result) {
        setRemittanceResult(data.result);
        setRemittanceLedger(null);
        setCurrentStep("confirm");
      } else {
        throw new Error(data.error || "Remittance failed");
      }
    } catch (error) {
      console.error("Remittance error:", error);
      alert("Failed to send remittance. Make sure backend is running on port 3003!");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!remittanceResult) {
      alert("No remittance to verify yet.");
      return;
    }

    setLoading(true);
    try {
      let data;
      if (IS_DEMO_MODE) {
        // Mock response for Demo Mode
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        data = {
          success: true,
          history: [
            {
              eventId: "evt-mock-001",
              workerAgentId: "1",
              remittanceAgentId: "remit-01",
              receiverAgentId: "recv-01",
              corridor: "US-MX",
              amount: 200,
              fee: 1.5,
              netAmount: 198.5,
              currency: "HBAR",
              transactionHash: "0xmocktransactionhash123456789",
              timestamp: Date.now(),
            },
          ],
          summary: {
            monthsWithRemittance: 6,
            totalVolume: 1200,
            accountAgeMonths: 12,
            totalTransactions: 6,
            events: [],
          },
          zkAttributes: {
            stable_remitter: true,
            total_remitted_band: "1000-5000",
            account_age_band: "12m+",
            months_with_activity: 6,
            total_transactions: 6,
          },
        };
      } else {
        const response = await fetch(`${API_BASE}/agents/worker/remittances/${DEMO_WORKER_AGENT_ID}`);
        data = await response.json();
      }

      if (!data.success) {
        throw new Error(data.error || "Ledger sync failed");
      }

      setRemittanceLedger({
        history: data.history || [],
        summary: data.summary || {
          monthsWithRemittance: 0,
          totalVolume: 0,
          accountAgeMonths: 0,
          totalTransactions: 0,
          events: [],
        },
        zkAttributes: {
          stable_remitter: Boolean(data.zkAttributes?.stable_remitter),
          total_remitted_band: data.zkAttributes?.total_remitted_band || "0-300",
          account_age_band: data.zkAttributes?.account_age_band || "0-3m",
          months_with_activity: data.zkAttributes?.months_with_activity || 0,
          total_transactions: data.zkAttributes?.total_transactions || 0,
        },
      });
      setCurrentStep("zkproof");
    } catch (error) {
      console.error("Confirmation error:", error);
      alert("Could not sync remittance ledger. Check the backend logs.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLoan = async () => {
    setLoading(true);
    try {
      let proofsData;
      if (IS_DEMO_MODE) {
        // Mock response for Demo Mode
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
        proofsData = {
          success: true,
          result: {
            zkProofs: {
              incomeProof: "mock-proof-income",
              identityProof: "mock-proof-identity",
            },
            zkAttributes: {
              creditScore: 750,
            },
          },
        };
      } else {
        // Step 1: Generate ZK proofs
        const proofsResponse = await fetch(`${API_BASE}/agents/worker/apply-loan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: loanAmount,
          }),
        });
        proofsData = await proofsResponse.json();
      }

      if (!proofsData.success || !proofsData.result?.zkProofs) {
        throw new Error("Failed to generate ZK proofs");
      }

      let loanData;
      if (IS_DEMO_MODE) {
        // Mock response for Demo Mode
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
        loanData = {
          success: true,
          offers: {
            offers: [
              {
                agentId: "agent-alpha",
                agentName: "Alpha Credit",
                sponsor: "Global Bank",
                corridor: "US-MX",
                agentType: "Bank",
                tagline: "Low rates for stable remitters",
                strengths: ["Low APR", "High Approval"],
                status: "active",
                offer: {
                  amount: loanAmount,
                  apr: 5.5,
                  tenureMonths: 12,
                  disbursementHours: 24,
                  repaymentFrequency: "Monthly",
                  approved: true,
                  rationale: "Strong remittance history",
                  creditScore: 750,
                },
                decision: {
                  approved: true,
                  creditScore: 750,
                  maxLoanAmount: 500,
                  interestRate: 5.5,
                  reason: "Good history",
                  aiAnalysis: "User shows consistent remittance patterns.",
                },
              },
              {
                agentId: "agent-beta",
                agentName: "Beta Microfinance",
                sponsor: "Community Fund",
                corridor: "US-MX",
                agentType: "Microfinance",
                tagline: "Fast approval for everyone",
                strengths: ["Instant Disbursement"],
                status: "active",
                offer: {
                  amount: loanAmount,
                  apr: 8.0,
                  tenureMonths: 6,
                  disbursementHours: 1,
                  repaymentFrequency: "Weekly",
                  approved: true,
                  rationale: "Acceptable risk profile",
                  creditScore: 750,
                },
                decision: {
                  approved: true,
                  creditScore: 750,
                  maxLoanAmount: 300,
                  interestRate: 8.0,
                  reason: "Acceptable risk",
                  aiAnalysis: "Good candidate for micro-loan.",
                },
              },
            ],
            selectedOffer: {
              agentId: "agent-alpha",
            },
          },
        };
      } else {
        // Step 2: Broadcast to corridor AI credit agents marketplace
        const loanResponse = await fetch(`${API_BASE}/agents/credit/offers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerAgentId: DEMO_WORKER_AGENT_ID,
            requestedAmount: loanAmount,
            zkProofs: proofsData.result.zkProofs,
            zkAttributes: proofsData.result.zkAttributes,
          }),
        });
        loanData = await loanResponse.json();
      }

      if (loanData.success && loanData.offers) {
        const marketplace = loanData.offers;
        const normalizedOffers: CreditOffer[] = (marketplace.offers || []).map((offer: CreditOffer) => {
          const rawDecision = offer.decision || ({} as LoanResult);
          return {
            ...offer,
            decision: {
              ...rawDecision,
              aiAnalysis: rawDecision.aiAnalysis || rawDecision.details?.aiAnalysis || offer.offer.rationale,
              details: rawDecision.details,
            },
          };
        });

        setLoanMarketplace(marketplace);
        setLoanOffers(normalizedOffers);

        const preferredOfferId = marketplace.selectedOffer?.agentId;
        const defaultOffer = normalizedOffers.find(o => o.agentId === preferredOfferId) || normalizedOffers[0] || null;
        applyOfferSelection(defaultOffer);
        setCurrentStep("offers");
      } else {
        throw new Error(loanData.error || "Loan marketplace unavailable");
      }
    } catch (error) {
      console.error("Loan application error:", error);
      alert("Failed to apply for loan. Make sure backend is running on port 3003!");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteLoan = async () => {
    if (!selectedOffer) {
      alert("Please select an offer first.");
      return;
    }

    setLoading(true);
    try {
      let data;
      if (IS_DEMO_MODE) {
        // Mock response for Demo Mode
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        data = {
          success: true,
          transactionHash: "0xmockdisbursementhash123",
        };
      } else {
        const response = await fetch(`${API_BASE}/agents/credit/disburse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: selectedOffer.offer.amount,
            workerAgentId: DEMO_WORKER_AGENT_ID,
            currency: "HBAR",
          }),
        });
        data = await response.json();
      }

      if (data.success) {
        setCurrentStep("result");
      } else {
        throw new Error(data.error || "Disbursement failed");
      }
    } catch (error) {
      console.error("Disbursement error:", error);
      alert("Failed to disburse loan. Make sure backend is running on port 3003!");
    } finally {
      setLoading(false);
    }
  };

  const handleSavingsOption = async (value: string) => {
    // 1. User response
    let userText = "";
    if (value === "yes") userText = "Yes, help me invest";
    else if (value === "no") userText = "No, thanks";
    else if (value === "option1") userText = "I choose Option 1 (Bonzo)";
    else if (value === "option2") userText = "I choose Option 2 (SaucerSwap)";

    setSavingsChatHistory((prev) => [
      ...prev,
      { sender: "user", text: userText },
    ]);

    // 2. Agent response logic
    if (value === "yes") {
      setTimeout(() => {
        setSavingsChatHistory((prev) => [
          ...prev,
          {
            sender: "agent",
            text: (
              <span>
                Great! I&apos;ve filtered the safest options on Hedera for you:
                <br /><br />
                <strong>1. Conservative (Bonzo Finance)</strong>
                <br />• Return: <strong>4.5% APY</strong>
                <br />• Risk: Low (Over-collateralized lending)
                <br /><br />
                <strong>2. Balanced (SaucerSwap)</strong>
                <br />• Return: <strong>8.2% APY</strong>
                <br />• Risk: Medium (Liquidity provision)
                <br /><br />
                I recommend <strong>Option 1</strong> for short-term safety.
              </span>
            ),
            options: [
              { label: "Option 1 (Bonzo)", value: "option1" },
              { label: "Option 2 (SaucerSwap)", value: "option2" },
            ],
          },
        ]);
      }, 1000);
    } else if (value === "no") {
      setTimeout(() => {
        setSavingsChatHistory((prev) => [
          ...prev,
          { sender: "agent", text: "Understood. Your funds are available in your wallet whenever you need them." },
        ]);
      }, 1000);
    } else if (value === "option1" || value === "option2") {
      setIsSavingsExecuting(true);
      
      // Simulate execution
      setTimeout(() => {
        setIsSavingsExecuting(false);
        const protocol = value === "option1" ? "Bonzo Finance" : "SaucerSwap";
        const apy = value === "option1" ? "4.5%" : "8.2%";
        const rawBalance = Number(operatorInfo?.balanceHbars || "0");
        const balance = rawBalance.toFixed(1);
        const randomTxId = `0.0.${Math.floor(Math.random() * 800000) + 100000}@${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 1000000000)}`;
        
        setSavingsChatHistory((prev) => [
          ...prev,
          {
            sender: "agent",
            text: (
              <span>
                ✅ <strong>Transaction Confirmed!</strong>
                <br />
                Successfully deposited {balance} HBAR into <strong>{protocol}</strong>.
                <br />
                You are now earning <strong>{apy} APY</strong>.
                <br />
                <span className="text-xs opacity-70">Tx Hash: {randomTxId}</span>
              </span>
            ),
          },
        ]);
      }, 2500);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "remittance", label: "Send $", icon: "💸" },
      { id: "confirm", label: "Confirm", icon: "✓" },
      { id: "zkproof", label: "ZK Proof", icon: "🔐" },
      { id: "loan", label: "Loan", icon: "💰" },
      { id: "offers", label: "Offers", icon: "📋" },
      { id: "result", label: "Result", icon: "🎉" },
      { id: "savings", label: "Savings", icon: "📈" },
    ];

    const currentIndex = steps.findIndex(s => s.id === currentStep);

    return (
      <div className="flex justify-center items-center mb-8 overflow-x-auto">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex flex-col items-center ${index <= currentIndex ? "text-primary" : "text-base-300"}`}>
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 ${
                  index <= currentIndex ? "bg-primary text-primary-content" : "bg-base-300"
                }`}
              >
                {step.icon}
              </div>
              <span className="text-xs font-medium">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-1 w-8 mx-2 mb-6 ${index < currentIndex ? "bg-primary" : "bg-base-300"}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">🔐 ZKredit</h1>
        <p className="text-lg text-base-content/70">The Autonomous Agent Lending On Privacy-Preserved Credit system</p>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Main Content */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {/* Step 1: Profile Setup */}
          {currentStep === "profile" && (
            <div>
              <h2 className="card-title text-2xl mb-4">Setup Your Profile</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Worker Profile */}
                <div className="border border-primary rounded-lg p-4">
                  <h3 className="text-xl font-bold mb-4">👷 Worker (You)</h3>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Name</span>
                    </label>
                    <input
                      type="text"
                      value={workerProfile.name}
                      onChange={e => setWorkerProfile({ ...workerProfile, name: e.target.value })}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="form-control mb-3">
                    <label className="label">
                      <span className="label-text">Monthly Income (USD)</span>
                    </label>
                    <input
                      type="number"
                      value={workerProfile.monthlyIncome}
                      onChange={e => setWorkerProfile({ ...workerProfile, monthlyIncome: Number(e.target.value) })}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Land Value (USD)</span>
                    </label>
                    <input
                      type="number"
                      value={workerProfile.landValue}
                      onChange={e => setWorkerProfile({ ...workerProfile, landValue: Number(e.target.value) })}
                      className="input input-bordered"
                    />
                  </div>
                </div>

                {/* Receiver Profile */}
                <div className="border border-secondary rounded-lg p-4">
                  <h3 className="text-xl font-bold mb-4">👨‍👩‍👧 Family (Receiver)</h3>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Name</span>
                    </label>
                    <input
                      type="text"
                      value={receiverProfile.name}
                      onChange={e => setReceiverProfile({ ...receiverProfile, name: e.target.value })}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="form-control mt-3">
                    <label className="label">
                      <span className="label-text">Hedera Account ID</span>
                    </label>
                    <input
                      type="text"
                      value={familyAccountId}
                      onChange={e => setFamilyAccountId(e.target.value)}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="mt-4 p-3 bg-secondary/10 rounded">
                    <p className="text-sm">
                      💡 Your family wallet will confirm receipt on-chain so remittances feed into your credit
                      reputation.
                    </p>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary w-full mt-6" onClick={() => setCurrentStep("remittance")}>
                Continue to Remittance →
              </button>
            </div>
          )}

          {/* Step 3: Send Remittance */}
          {currentStep === "remittance" && (
            <div>
              <h2 className="card-title text-2xl mb-4">💸 Send Remittance</h2>
              <div className="bg-base-200 p-6 rounded-lg mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-base-content/70">From</p>
                    <p className="font-bold">{receiverProfile.name} (Family)</p>
                  </div>
                  <div className="text-3xl">→</div>
                  <div>
                    <p className="text-sm text-base-content/70">To</p>
                    <p className="font-bold">{workerProfile.name} (Worker)</p>
                    <p className="text-xs text-base-content/60">Acct: {familyAccountId}</p>
                  </div>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Amount (HBAR)</span>
                  </label>
                  <input
                    type="number"
                    value={remittanceAmountInput}
                    onChange={e => handleRemittanceAmountChange(e.target.value)}
                    className="input input-bordered input-lg text-2xl"
                    step="0.01"
                    max="200"
                  />
                </div>
                <div className="mt-4 p-3 bg-info/10 rounded">
                  <p className="text-sm">
                    <strong>Fee:</strong> 0.7% ({(remittanceAmount * 0.007).toFixed(4)} HBAR, min 0.5)
                    <br />
                    <strong>Net Amount:</strong> {(remittanceAmount * 0.993).toFixed(4)} HBAR
                    <br />
                    <strong>Via:</strong> x402 Payment Protocol on Hedera
                  </p>
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={handleSendRemittance} disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : "Send Remittance →"}
              </button>
            </div>
          )}

          {/* Step 4: Confirm Receipt */}
          {currentStep === "confirm" && remittanceResult && (
            <div>
              <h2 className="card-title text-2xl mb-4">✓ Confirm Receipt</h2>
              <div className="alert alert-success mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Remittance sent successfully!</span>
              </div>
              <div className="bg-base-200 p-6 rounded-lg mb-6 space-y-3">
                <div className="flex justify-between">
                  <span>Transaction Hash:</span>
                  <code className="text-xs break-all">
                    {remittanceResult.transactionHash || "Processing..."}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span>Corridor:</span>
                  <span>Middle East → Philippines</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Sent:</span>
                  <span className="font-bold">{remittanceAmount} HBAR</span>
                </div>
                <div className="flex justify-between">
                  <span>Fee:</span>
                  <span>{remittanceResult.fee.toFixed(4)} HBAR</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Amount Received:</span>
                  <span className="font-bold text-success">{remittanceResult.netAmount.toFixed(4)} HBAR</span>
                </div>
              </div>
              <div className="mb-6">
                <p className="mb-2">
                  Sync the family wallet ({familyAccountId}) with the Hedera Consensus Service to log this transfer.
                </p>
                <div className="bg-base-200 p-4 rounded space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sender</span>
                    <span className="font-semibold">{receiverProfile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Account ID</span>
                    <span className="font-mono">{familyAccountId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ledger Topic</span>
                    <span className="font-mono">0.0.920393</span>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={handleConfirmReceipt} disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : "Generate ZK proof to apply loan application →"}
              </button>
            </div>
          )}

          {/* Step 5: Generate ZK Proofs */}
          {currentStep === "zkproof" && (
            <div>
              <h2 className="card-title text-2xl mb-4">🔐 Generate Zero-Knowledge Proofs</h2>
              <p className="mb-6">Generate cryptographic proofs without revealing your private data:</p>
              <div className="space-y-4">
                {/* Income Proof */}
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-lg">📊 Income Proof</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-base-content/70">Public Claim:</p>
                        <p className="font-mono">&quot;I earn {">"}$500/month&quot;</p>
                      </div>
                      <div className="badge badge-success">✓ Verifiable</div>
                    </div>
                  </div>
                </div>

                {/* Credit History Proof */}
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-lg">📈 Credit History Proof</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-base-content/70">Public Claim:</p>
                        <p className="font-mono">&quot;I have ≥ 1 transaction&quot;</p>
                      </div>
                      <div className="badge badge-success">✓ Verifiable</div>
                    </div>
                  </div>
                </div>

                {/* Collateral Proof */}
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-lg">🏡 Collateral Proof</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-base-content/70">Public Claim:</p>
                        <p className="font-mono">&quot;I own land {">"}$10,000&quot;</p>
                      </div>
                      <div className="badge badge-success">✓ Verifiable</div>
                    </div>
                  </div>
                </div>

                {remittanceLedger && (
                  <div className="card bg-base-200 border border-primary/30">
                    <div className="card-body">
                      <h3 className="card-title text-lg">🌐 Remittance zkAttributes</h3>
                      <p className="text-sm text-base-content/70">
                        Derived automatically from HCS events — no additional input required.
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                        <div>
                          <p className="text-xs text-base-content/60">Months Active</p>
                          <p className="font-semibold">{remittanceLedger.summary.monthsWithRemittance}</p>
                        </div>
                        <div>
                          <p className="text-xs text-base-content/60">Total Volume</p>
                          <p className="font-semibold">${remittanceLedger.summary.totalVolume.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-base-content/60">Stable Remitter</p>
                          <p className="font-semibold">
                            {remittanceLedger.zkAttributes?.stable_remitter ? "Yes" : "Not yet"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-base-content/60">Total Band</p>
                          <p className="font-semibold">
                            {remittanceLedger.zkAttributes?.total_remitted_band as string}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button className="btn btn-primary w-full mt-6" onClick={() => setCurrentStep("loan")}>
                Continue to Loan Application →
              </button>
            </div>
          )}

          {/* Step 6: Apply for Loan */}
          {currentStep === "loan" && (
            <div>
              <h2 className="card-title text-2xl mb-4">💰 Apply for Loan</h2>
              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text font-medium">Loan Amount (HBAR)</span>
                </label>
                <input
                  type="number"
                  value={loanAmountInput}
                  onChange={e => handleLoanAmountChange(e.target.value)}
                  className="input input-bordered input-lg text-2xl"
                />
              </div>
              <div className="bg-base-200 p-6 rounded-lg mb-6">
                <h3 className="font-bold mb-3">📋 Application Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>✓ Income Proof:</span>
                    <span className="text-success">Verified</span>
                  </div>
                  <div className="flex justify-between">
                    <span>✓ Credit History:</span>
                    <span className="text-success">Verified</span>
                  </div>
                  <div className="flex justify-between">
                    <span>✓ Collateral Proof:</span>
                    <span className="text-success">Verified</span>
                  </div>
                  <div className="divider my-2"></div>
                  <div className="flex justify-between">
                    <span>✓ On-chain Reputation:</span>
                    <span className="text-success">Good (recent confirmation)</span>
                  </div>
                  {remittanceLedger && (
                    <>
                      <div className="flex justify-between">
                        <span>✓ Remittance History:</span>
                        <span className="text-success">
                          {remittanceLedger.summary.totalTransactions} tx / {remittanceLedger.summary.monthsWithRemittance} months
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>✓ Stable Remitter:</span>
                        <span className="text-success">
                          {remittanceLedger.zkAttributes.stable_remitter ? "Yes" : "Building"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={handleApplyLoan} disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : "Submit to AI Credit Agent →"}
              </button>
            </div>
          )}

          {/* Step 7: Offers */}
          {currentStep === "offers" && (
            <div>
              <h2 className="card-title text-2xl mb-2 justify-center">🏦 Hedera AI Credit Marketplace</h2>
              <p className="text-center text-sm text-base-content/70 mb-6">
                Broadcasted to {loanMarketplace?.comparedAgents ?? loanOffers.length} corridor agents for
                {loanMarketplace?.corridor?.replace(/-/g, " ") || "Middle East → Philippines"}.
                <span className="block">Choose the offer that best fits Ahmad&apos;s goals.</span>
              </p>
              {loanOffers.length > 0 ? (
                <>
                  <div className="grid md:grid-cols-2 gap-4 mb-8">
                    {loanOffers.map(offer => (
                      <div
                        key={offer.agentId}
                        className={`card border transition-all ${
                          selectedOffer?.agentId === offer.agentId
                            ? "border-2 border-primary shadow-xl"
                            : "border-base-300"
                        }`}
                      >
                        <div className="card-body space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-bold">{offer.agentName}</h3>
                              <p className="text-sm text-base-content/70">{offer.sponsor}</p>
                            </div>
                            <div className="text-right space-y-1">
                              {offer.rank === 1 && (
                                <span className="badge badge-primary badge-outline">Best terms</span>
                              )}
                              <span className="badge badge-neutral badge-outline uppercase">{offer.agentType}</span>
                            </div>
                          </div>
                          <p className="text-sm text-base-content/70">{offer.tagline}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-base-content/60">Amount</p>
                              <p className="text-2xl font-bold">{loanAmount} HBAR</p>
                            </div>
                            <div>
                              <p className="text-xs text-base-content/60">Interest Rate</p>
                              <p className="text-2xl font-bold">{offer.offer.apr}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-base-content/60">Duration</p>
                              <p className="text-xl font-semibold">{offer.offer.tenureMonths} months</p>
                            </div>
                            <div>
                              <p className="text-xs text-base-content/60">Disbursement</p>
                              <p className="text-xl font-semibold text-success">Immediate</p>
                            </div>
                          </div>
                          <div className="bg-base-200/60 rounded p-3 text-xs space-y-1 mt-3">
                            <p className="font-semibold text-base-content/80">🤖 AI Analysis</p>
                            <p className="italic">&quot;{offer.offer.rationale}&quot;</p>
                          </div>
                          <ul className="text-xs space-y-1">
                            {offer.strengths.map(str => (
                              <li key={str}>• {str}</li>
                            ))}
                          </ul>
                          <button
                            className={`btn btn-sm ${
                              selectedOffer?.agentId === offer.agentId ? "btn-primary" : "btn-outline"
                            }`}
                            onClick={() => applyOfferSelection(offer)}
                            disabled={selectedOffer?.agentId === offer.agentId}
                          >
                            {selectedOffer?.agentId === offer.agentId ? "Selected" : "Choose offer"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={handleExecuteLoan} 
                    disabled={!selectedOffer || loading}
                  >
                    {loading ? <span className="loading loading-spinner"></span> : "Execute Loan Agreement →"}
                  </button>
                </>
              ) : (
                <div className="alert alert-warning">
                  <span>No credit agents responded. Please try again or adjust the loan amount.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 8: Result */}
          {currentStep === "result" && selectedOffer && loanResult && (
            <div>
              <h2 className="card-title text-2xl mb-2 justify-center">🎉 Loan Disbursed!</h2>
              <div className="alert alert-success mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{selectedOffer.agentName} has wired {selectedOffer.offer.amount} HBAR to your wallet.</span>
              </div>
              
              <div className="stats stats-vertical lg:stats-horizontal shadow w-full mb-6">
                <div className="stat">
                  <div className="stat-title">Credit Score</div>
                  <div className="stat-value text-primary">{loanResult.creditScore}/110</div>
                  <div className="stat-desc">All proofs verified</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Approved Amount</div>
                  <div className="stat-value text-success">{loanResult.maxLoanAmount} HBAR</div>
                  <div className="stat-desc">Matches corridor cap</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Interest Rate</div>
                  <div className="stat-value text-info">{loanResult.interestRate ?? 0}%</div>
                  <div className="stat-desc">Annual APR</div>
                </div>
              </div>

              <div className="card bg-base-200 mb-6">
                <div className="card-body">
                  <h3 className="card-title">🤖 AI Analysis</h3>
                  <p className="text-sm">{loanResult.reason}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="card bg-error/10">
                  <div className="card-body">
                    <h4 className="font-bold">🏦 Traditional Bank</h4>
                    <ul className="text-sm space-y-1">
                      <li>❌ 5+ documents required</li>
                      <li>❌ Privacy exposed</li>
                      <li>❌ 7-14 days processing</li>
                      <li>❌ 24% APR</li>
                      <li>❌ $200 appraisal fee</li>
                    </ul>
                  </div>
                </div>
                <div className="card bg-success/10">
                  <div className="card-body">
                    <h4 className="font-bold">🤝 {selectedOffer.agentName}</h4>
                    <ul className="text-sm space-y-1">
                      <li>✅ Zero documents</li>
                      <li>✅ 100% privacy protected</li>
                      <li>✅ 3 minutes processing</li>
                      <li>✅ {loanResult.interestRate ?? 0}% APR (67% lower!)</li>
                      <li>✅ $0.01 verification fee</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-success/20 p-4 rounded-lg">
                <p className="text-center font-bold">
                  💰 Savings vs. 24% bank APR: 
                  {loanResult.maxLoanAmount
                    ? (((24 - (loanResult.interestRate ?? 0)) * loanResult.maxLoanAmount) / 100).toFixed(2)
                    : "0.00"} HBAR
                  /year
                </p>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  className="btn btn-outline flex-1"
                  onClick={() => {
                    setCurrentStep("profile");
                    setRemittanceResult(null);
                    setLoanMarketplace(null);
                    setLoanOffers([]);
                    setSelectedOffer(null);
                    setLoanResult(null);
                    setSavingsChatHistory([]);
                  }}
                >
                  Start New Demo
                </button>
                <button
                  className="btn btn-primary flex-1"
                  onClick={() => {
                    setCurrentStep("savings");
                    // Initialize chat
                    const rawBalance = Number(operatorInfo?.balanceHbars || "0");
                    const balance = rawBalance.toFixed(1);
                    setSavingsChatHistory([
                      {
                        sender: "agent",
                        text: (
                          <span>
                            Hello. I noticed your wallet balance is currently <strong>{balance} HBAR</strong>.
                            <br />
                            Instead of leaving these funds idle, you have the option to deposit them into a decentralized investment protocol.
                            <br />
                            This could generate additional yield on your assets. Would you like to explore the available investment strategies?
                          </span>
                        ),
                        options: [
                          { label: "Yes, show me options", value: "yes" },
                          { label: "No, thanks", value: "no" },
                        ],
                      },
                    ]);
                  }}
                >
                  Next: Financial Advice →
                </button>
              </div>
            </div>
          )}

          {/* Step 9: Savings (Chat Interface) */}
          {currentStep === "savings" && (
            <div className="max-w-2xl mx-auto">
              <h2 className="card-title text-2xl mb-6 justify-center">📈 Smart Investment Advisor</h2>
              
              <div className="bg-base-200 rounded-xl p-4 min-h-[400px] max-h-[600px] overflow-y-auto mb-4 space-y-4">
                {savingsChatHistory.map((msg, idx) => (
                  <div key={idx} className={`chat ${msg.sender === "agent" ? "chat-start" : "chat-end"}`}>
                    <div className="chat-image avatar">
                      <div className="w-10 rounded-full border border-base-300">
                        <span className="text-2xl flex items-center justify-center h-full">
                          {msg.sender === "agent" ? "🤖" : "👷"}
                        </span>
                      </div>
                    </div>
                    <div className={`chat-bubble ${msg.sender === "agent" ? "chat-bubble-primary" : "chat-bubble-secondary"}`}>
                      {msg.text}
                    </div>
                    {msg.sender === "agent" && msg.options && idx === savingsChatHistory.length - 1 && (
                      <div className="chat-footer opacity-100 mt-2 flex gap-2">
                        {msg.options.map((opt) => (
                          <button
                            key={opt.value}
                            className="btn btn-sm btn-outline bg-base-100"
                            onClick={() => handleSavingsOption(opt.value)}
                            disabled={isSavingsExecuting}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isSavingsExecuting && (
                  <div className="chat chat-start">
                    <div className="chat-image avatar">
                      <div className="w-10 rounded-full border border-base-300">
                        <span className="text-2xl flex items-center justify-center h-full">🤖</span>
                      </div>
                    </div>
                    <div className="chat-bubble chat-bubble-primary">
                      <span className="loading loading-dots loading-md"></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  className="input input-bordered w-full" 
                  disabled 
                />
                <button className="btn btn-square btn-primary" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>

              <button
                className="btn btn-ghost btn-sm w-full"
                onClick={() => {
                  setCurrentStep("profile");
                  setRemittanceResult(null);
                  setLoanMarketplace(null);
                  setLoanOffers([]);
                  setSelectedOffer(null);
                  setLoanResult(null);
                  setSavingsChatHistory([]);
                }}
              >
                End Demo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

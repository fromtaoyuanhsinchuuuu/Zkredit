"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";

type DemoStep = "wallet" | "profile" | "remittance" | "confirm" | "zkproof" | "loan" | "result";

interface AgentProfile {
  role: "worker" | "receiver";
  name: string;
  monthlyIncome?: number;
  landValue?: number;
}

interface RemittanceResult {
  success: boolean;
  transactionHash: string;
  fee: number;
  netAmount: number;
  message: string;
}

interface LoanResult {
  approved: boolean;
  creditScore: number;
  maxLoanAmount: number;
  interestRate: number;
  reason: string;
  aiAnalysis: string;
}

export default function DemoPage() {
  const { address: connectedAddress, isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState<DemoStep>("wallet");
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
  const [remittanceAmount, setRemittanceAmount] = useState(200);
  const [loanAmount, setLoanAmount] = useState(300);
  const [remittanceResult, setRemittanceResult] = useState<RemittanceResult | null>(null);
  const [loanResult, setLoanResult] = useState<LoanResult | null>(null);
  const [loading, setLoading] = useState(false);

  // API 調用
  const API_BASE = "http://localhost:3003";

  const handleSendRemittance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/agents/remittance/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderAgentId: "1",
          receiverAgentId: "4",
          amount: remittanceAmount,
          currency: "USD",
        }),
      });
      const data = await response.json();

      // Backend returns {success: true, result: {...}}
      if (data.success && data.result) {
        setRemittanceResult(data.result);
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
    setLoading(true);
    try {
      await fetch(`${API_BASE}/agents/receiver/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverAgentId: "4",
          transactionHash: remittanceResult?.transactionHash,
        }),
      });
      setCurrentStep("zkproof");
    } catch (error) {
      console.error("Confirmation error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLoan = async () => {
    setLoading(true);
    try {
      // Step 1: Generate ZK proofs
      const proofsResponse = await fetch(`${API_BASE}/agents/worker/apply-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: loanAmount,
        }),
      });
      const proofsData = await proofsResponse.json();

      // Backend returns {success: true, result: {...}}
      if (!proofsData.success || !proofsData.result) {
        throw new Error("Failed to generate ZK proofs");
      }

      // Step 2: Submit to credit agent
      const loanResponse = await fetch(`${API_BASE}/agents/credit/process-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantAgentId: "1",
          requestedAmount: loanAmount,
          zkProofs: proofsData.result.zkProofs,
        }),
      });
      const loanData = await loanResponse.json();

      // Backend returns {success: true, result: {...}}
      if (loanData.success && loanData.result) {
        setLoanResult(loanData.result);
        setCurrentStep("result");
      } else {
        throw new Error(loanData.error || "Loan processing failed");
      }
    } catch (error) {
      console.error("Loan application error:", error);
      alert("Failed to apply for loan. Make sure backend is running on port 3003!");
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: "wallet", label: "Connect", icon: "🔗" },
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "remittance", label: "Send $", icon: "💸" },
      { id: "confirm", label: "Confirm", icon: "✓" },
      { id: "zkproof", label: "ZK Proof", icon: "🔐" },
      { id: "loan", label: "Loan", icon: "💰" },
      { id: "result", label: "Result", icon: "🎉" },
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
        <p className="text-lg text-base-content/70">Zero-Knowledge Credit System for Cross-Border Workers</p>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Main Content */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {/* Step 1: Connect Wallet */}
          {currentStep === "wallet" && (
            <div className="text-center">
              <h2 className="card-title justify-center text-2xl mb-4">Connect Your Wallet</h2>
              {isConnected ? (
                <div>
                  <p className="mb-4">✅ Wallet Connected!</p>
                  <Address address={connectedAddress} />
                  <button className="btn btn-primary mt-6" onClick={() => setCurrentStep("profile")}>
                    Continue to Profile →
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-4">Please connect your wallet to continue</p>
                  <p className="text-sm text-base-content/70">
                    Use the &quot;Connect Wallet&quot; button in the header
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Profile Setup */}
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
                  <div className="mt-4 p-3 bg-secondary/10 rounded">
                    <p className="text-sm">
                      💡 Your family will confirm receipt of remittance to build your credit reputation
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
                    <p className="font-bold">{workerProfile.name} (Worker)</p>
                  </div>
                  <div className="text-3xl">→</div>
                  <div>
                    <p className="text-sm text-base-content/70">To</p>
                    <p className="font-bold">{receiverProfile.name} (Family)</p>
                  </div>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Amount (USD)</span>
                  </label>
                  <input
                    type="number"
                    value={remittanceAmount}
                    onChange={e => setRemittanceAmount(Number(e.target.value))}
                    className="input input-bordered input-lg text-2xl"
                  />
                </div>
                <div className="mt-4 p-3 bg-info/10 rounded">
                  <p className="text-sm">
                    <strong>Fee:</strong> 0.7% (${(remittanceAmount * 0.007).toFixed(2)})
                    <br />
                    <strong>Net Amount:</strong> ${(remittanceAmount * 0.993).toFixed(2)}
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
                  <code className="text-xs">
                    {remittanceResult.transactionHash
                      ? remittanceResult.transactionHash.slice(0, 20) + "..."
                      : "Processing..."}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span>Amount Sent:</span>
                  <span className="font-bold">${remittanceAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fee:</span>
                  <span>${remittanceResult.fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Amount Received:</span>
                  <span className="font-bold text-success">${remittanceResult.netAmount.toFixed(2)}</span>
                </div>
              </div>
              <div className="mb-6">
                <p className="mb-2">
                  <strong>{receiverProfile.name}</strong> needs to confirm receipt:
                </p>
                <div className="mockup-phone">
                  <div className="camera"></div>
                  <div className="display">
                    <div className="artboard artboard-demo phone-1 bg-base-300 p-4">
                      <p className="text-sm mb-2">📱 SMS Notification</p>
                      <p className="text-xs">
                        You received ${remittanceResult.netAmount.toFixed(2)} from {workerProfile.name}
                      </p>
                      <button className="btn btn-xs btn-success mt-2 w-full">Confirm Receipt</button>
                    </div>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={handleConfirmReceipt} disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : "Family Confirmed Receipt →"}
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
                    <div className="bg-error/10 p-3 rounded mt-2">
                      <p className="text-xs text-error">
                        🔒 <strong>Private:</strong> Actual income (${workerProfile.monthlyIncome}) stays hidden
                      </p>
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
                    <div className="bg-error/10 p-3 rounded mt-2">
                      <p className="text-xs text-error">
                        🔒 <strong>Private:</strong> Exact count and amounts stay hidden
                      </p>
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
                    <div className="bg-error/10 p-3 rounded mt-2">
                      <p className="text-xs text-error">
                        🔒 <strong>Private:</strong> GPS location (${workerProfile.landValue}) and exact value hidden
                      </p>
                    </div>
                  </div>
                </div>
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
                  <span className="label-text font-medium">Loan Amount (USD)</span>
                </label>
                <input
                  type="number"
                  value={loanAmount}
                  onChange={e => setLoanAmount(Number(e.target.value))}
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
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={handleApplyLoan} disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : "Submit to AI Credit Agent →"}
              </button>
            </div>
          )}

          {/* Step 7: Result */}
          {currentStep === "result" && loanResult && (
            <div>
              <h2 className="card-title text-2xl mb-4 justify-center">
                {loanResult.approved ? "🎉 Loan Approved!" : "❌ Loan Denied"}
              </h2>
              {loanResult.approved ? (
                <div>
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
                    <span>Your loan has been approved!</span>
                  </div>
                  <div className="stats stats-vertical lg:stats-horizontal shadow w-full mb-6">
                    <div className="stat">
                      <div className="stat-title">Credit Score</div>
                      <div className="stat-value text-primary">{loanResult.creditScore}/110</div>
                      <div className="stat-desc">Excellent</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Approved Amount</div>
                      <div className="stat-value text-success">${loanResult.maxLoanAmount}</div>
                      <div className="stat-desc">Max available</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Interest Rate</div>
                      <div className="stat-value text-info">{loanResult.interestRate}%</div>
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
                        <h4 className="font-bold">🔐 ZKredit</h4>
                        <ul className="text-sm space-y-1">
                          <li>✅ Zero documents</li>
                          <li>✅ 100% privacy protected</li>
                          <li>✅ 3 minutes processing</li>
                          <li>✅ {loanResult.interestRate}% APR (67% lower!)</li>
                          <li>✅ $0.01 verification fee</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="bg-success/20 p-4 rounded-lg">
                    <p className="text-center font-bold">
                      💰 You save ${(((24 - loanResult.interestRate) * loanResult.maxLoanAmount) / 100).toFixed(2)} in
                      interest per year!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="alert alert-error">
                  <span>{loanResult.reason}</span>
                </div>
              )}
              <button
                className="btn btn-outline w-full mt-6"
                onClick={() => {
                  setCurrentStep("wallet");
                  setRemittanceResult(null);
                  setLoanResult(null);
                }}
              >
                Start New Demo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="stroke-current shrink-0 w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <div>
          <h3 className="font-bold">🚀 Make sure agent backend is running!</h3>
          <div className="text-xs">
            Terminal: <code>cd agent-backend && npm start</code>
          </div>
        </div>
      </div>
    </div>
  );
}

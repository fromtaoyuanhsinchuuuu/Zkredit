"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Address } from "~~/components/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5 max-w-4xl w-full">
          <h1 className="text-center mb-8">
            <span className="block text-5xl font-bold mb-4">🔐 ZKredit</span>
            <span className="block text-2xl text-base-content/70">
              Zero-Knowledge Credit System for Cross-Border Workers
            </span>
          </h1>

          {/* Hero Section */}
          <div className="card bg-gradient-to-br from-primary to-secondary text-primary-content mb-8">
            <div className="card-body">
              <h2 className="card-title text-3xl justify-center mb-4">
                Prove Creditworthiness Without Revealing Private Data
              </h2>
              <div className="grid md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-4xl mb-2">🔒</div>
                  <p className="font-bold">100% Privacy</p>
                  <p className="text-sm opacity-80">Data never leaves your device</p>
                </div>
                <div>
                  <div className="text-4xl mb-2">⚡</div>
                  <p className="font-bold">3 Minutes</p>
                  <p className="text-sm opacity-80">vs 7-14 days traditional</p>
                </div>
                <div>
                  <div className="text-4xl mb-2">💰</div>
                  <p className="font-bold">8-9% APR</p>
                  <p className="text-sm opacity-80">vs 24% traditional</p>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Address */}
          {connectedAddress && (
            <div className="flex justify-center items-center space-x-2 mb-6">
              <p className="font-medium">Connected:</p>
              <Address address={connectedAddress} />
            </div>
          )}

          {/* Main CTA */}
          <div className="text-center mb-8">
            <Link href="/demo" className="btn btn-primary btn-lg">
              🚀 Try Interactive Demo
            </Link>
          </div>

          {/* Problem & Solution */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="card bg-error/10">
              <div className="card-body">
                <h3 className="card-title text-error">😞 Traditional Banking</h3>
                <ul className="space-y-2 text-sm">
                  <li>❌ Share sensitive data (income, GPS, transaction history)</li>
                  <li>❌ Privacy leaks and discrimination risks</li>
                  <li>❌ High interest rates (18-36% APR)</li>
                  <li>❌ Expensive appraisals ($150-200)</li>
                  <li>❌ Slow processing (7-14 days)</li>
                  <li>❌ 5+ documents required</li>
                </ul>
              </div>
            </div>
            <div className="card bg-success/10">
              <div className="card-body">
                <h3 className="card-title text-success">😊 ZKredit Solution</h3>
                <ul className="space-y-2 text-sm">
                  <li>✅ Zero-Knowledge Proofs protect all private data</li>
                  <li>✅ 100% privacy guaranteed</li>
                  <li>✅ Fair rates (8-9% APR, 67% lower!)</li>
                  <li>✅ Near-zero verification cost ($0.01)</li>
                  <li>✅ Instant processing (3 minutes)</li>
                  <li>✅ Zero documents needed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* How it Works */}
          <div className="card bg-base-200 mb-8">
            <div className="card-body">
              <h3 className="card-title text-2xl mb-4">How It Works</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="text-3xl">1️⃣</div>
                  <div>
                    <p className="font-bold">Send Remittance</p>
                    <p className="text-sm text-base-content/70">
                      Send money to family, building credit history on-chain
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-3xl">2️⃣</div>
                  <div>
                    <p className="font-bold">Family Confirms</p>
                    <p className="text-sm text-base-content/70">Receipt confirmation boosts your reputation score</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-3xl">3️⃣</div>
                  <div>
                    <p className="font-bold">Generate ZK Proofs</p>
                    <p className="text-sm text-base-content/70">
                      Prove income, credit history, and collateral without revealing data
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-3xl">4️⃣</div>
                  <div>
                    <p className="font-bold">AI Credit Decision</p>
                    <p className="text-sm text-base-content/70">
                      GPT-OSS-120B analyzes proofs and approves loan in seconds
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technology Stack */}
          <div className="card bg-base-100 mb-8">
            <div className="card-body">
              <h3 className="card-title text-2xl mb-4">🛠️ Technology Stack</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-bold mb-2">🔐 Zero-Knowledge:</p>
                  <p className="text-base-content/70">Noir circuits (by Aztec) for privacy-preserving proofs</p>
                </div>
                <div>
                  <p className="font-bold mb-2">⛓️ Blockchain:</p>
                  <p className="text-base-content/70">Hedera Hashgraph (fast, low-cost, carbon-negative)</p>
                </div>
                <div>
                  <p className="font-bold mb-2">🤖 AI:</p>
                  <p className="text-base-content/70">Groq GPT-OSS-120B for intelligent credit decisions</p>
                </div>
                <div>
                  <p className="font-bold mb-2">📜 Standards:</p>
                  <p className="text-base-content/70">ERC-8004 for agent identity and reputation</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col md:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;

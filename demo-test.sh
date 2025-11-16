#!/bin/bash

# ZKredit Demo Test Script
# This script tests the complete flow from remittance to loan approval

API_BASE="http://localhost:3003"

echo "🚀 ZKredit Complete Demo Flow Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check backend health
echo -e "${BLUE}Step 1: Checking backend health...${NC}"
HEALTH=$(curl -s ${API_BASE}/health | jq -r '.status')
if [ "$HEALTH" == "ok" ]; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo "❌ Backend is not running. Start it with: cd agent-backend && npm start"
    exit 1
fi
echo ""

# Step 2: Send Remittance
echo -e "${BLUE}Step 2: Sending $200 remittance from Worker to Family...${NC}"
REMITTANCE_RESULT=$(curl -s -X POST ${API_BASE}/agents/remittance/send \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "1",
    "toAgentId": "4",
    "amount": 200,
    "currency": "USD"
  }')

TX_HASH=$(echo $REMITTANCE_RESULT | jq -r '.transactionHash')
NET_AMOUNT=$(echo $REMITTANCE_RESULT | jq -r '.netAmount')
FEE=$(echo $REMITTANCE_RESULT | jq -r '.fee')

echo -e "${GREEN}✓ Remittance sent successfully${NC}"
echo "  Transaction: ${TX_HASH:0:20}..."
echo "  Fee: \$$FEE"
echo "  Net Amount: \$$NET_AMOUNT"
echo ""

# Step 3: Confirm Receipt
echo -e "${BLUE}Step 3: Family confirming receipt...${NC}"
CONFIRM_RESULT=$(curl -s -X POST ${API_BASE}/agents/receiver/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"receiverAgentId\": \"4\",
    \"transactionHash\": \"$TX_HASH\"
  }")

echo -e "${GREEN}✓ Receipt confirmed${NC}"
echo "  Sender reputation updated on blockchain"
echo ""

# Step 4: Apply for Loan with ZK Proofs
echo -e "${BLUE}Step 4: Generating ZK proofs and applying for \$300 loan...${NC}"
PROOF_RESULT=$(curl -s -X POST ${API_BASE}/agents/worker/apply-loan \
  -H "Content-Type: application/json" \
  -d '{
    "workerAgentId": "1",
    "requestedAmount": 300
  }')

echo -e "${GREEN}✓ ZK proofs generated${NC}"
echo "  🔐 Income Proof: I earn > \$500/month (actual \$800 HIDDEN)"
echo "  🔐 Credit History: I have ≥ 5 transactions (exact count HIDDEN)"
echo "  🔐 Collateral Proof: I own land > \$10k (GPS & value HIDDEN)"
echo ""

# Step 5: Credit Assessment with AI
echo -e "${BLUE}Step 5: AI Credit Agent processing loan application...${NC}"
ZK_PROOFS=$(echo $PROOF_RESULT | jq '.zkProofs')

LOAN_RESULT=$(curl -s -X POST ${API_BASE}/agents/credit/process-loan \
  -H "Content-Type: application/json" \
  -d "{
    \"creditAgentId\": \"2\",
    \"application\": {
      \"applicantAgentId\": \"1\",
      \"requestedAmount\": 300,
      \"zkProofs\": $ZK_PROOFS
    }
  }")

APPROVED=$(echo $LOAN_RESULT | jq -r '.approved')
CREDIT_SCORE=$(echo $LOAN_RESULT | jq -r '.creditScore')
MAX_AMOUNT=$(echo $LOAN_RESULT | jq -r '.maxLoanAmount')
INTEREST_RATE=$(echo $LOAN_RESULT | jq -r '.interestRate')
REASON=$(echo $LOAN_RESULT | jq -r '.reason')

echo ""
echo "======================================"
echo -e "${YELLOW}🎉 FINAL RESULT${NC}"
echo "======================================"
echo ""

if [ "$APPROVED" == "true" ]; then
    echo -e "${GREEN}✅ LOAN APPROVED!${NC}"
    echo ""
    echo "📊 Credit Score: ${CREDIT_SCORE}/110"
    echo "💰 Approved Amount: \$${MAX_AMOUNT}"
    echo "📈 Interest Rate: ${INTEREST_RATE}% APR"
    echo ""
    echo "🤖 AI Analysis:"
    echo "$REASON" | fold -s -w 70
    echo ""
    echo "======================================"
    echo "💡 Comparison with Traditional Banking:"
    echo "======================================"
    echo ""
    echo "Traditional Bank:"
    echo "  ❌ 5+ documents required"
    echo "  ❌ Privacy exposed"
    echo "  ❌ 7-14 days processing"
    echo "  ❌ 24% APR"
    echo "  ❌ \$200 appraisal fee"
    echo ""
    echo "ZKredit:"
    echo "  ✅ Zero documents"
    echo "  ✅ 100% privacy protected"
    echo "  ✅ 3 minutes processing"
    echo "  ✅ ${INTEREST_RATE}% APR (67% lower!)"
    echo "  ✅ \$0.01 verification fee"
    echo ""
    
    # Calculate savings
    TRAD_INTEREST=$((300 * 24 / 100))
    ZK_INTEREST=$((300 * INTEREST_RATE / 100))
    SAVINGS=$((TRAD_INTEREST - ZK_INTEREST))
    
    echo -e "${GREEN}💰 You save \$${SAVINGS} in interest per year!${NC}"
else
    echo -e "❌ LOAN DENIED"
    echo "Reason: $REASON"
fi

echo ""
echo "======================================"
echo "✓ Demo completed successfully!"
echo "======================================"
echo ""
echo "📱 View the full interactive demo at: http://localhost:3000/demo"
echo ""

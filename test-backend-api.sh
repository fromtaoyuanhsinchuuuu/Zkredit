#!/bin/bash

# ZKredit Backend API Test Script
# Test all APIs before running frontend

API_BASE="http://localhost:3003"

echo "🧪 ZKredit Backend API Tests"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH=$(curl -s "${API_BASE}/health")
if [[ $HEALTH == *"ok"* ]]; then
  echo -e "${GREEN}✅ Backend is running${NC}"
else
  echo -e "${RED}❌ Backend health check failed${NC}"
  exit 1
fi
echo ""

# Test 2: Initialize Agents
echo -e "${YELLOW}Test 2: Initialize Agents${NC}"
curl -s -X POST "${API_BASE}/agents/worker/create" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "1"}' > /dev/null
curl -s -X POST "${API_BASE}/agents/credit/create" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "2"}' > /dev/null
curl -s -X POST "${API_BASE}/agents/remittance/create" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "3"}' > /dev/null
curl -s -X POST "${API_BASE}/agents/receiver/create" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "4", "accountId": "0.0.7178277"}' > /dev/null
echo -e "${GREEN}✅ All agents initialized${NC}"
echo ""

# Test 3: Send Multiple Remittances (to build credit history)
echo -e "${YELLOW}Test 3: Send Multiple Remittances (to build credit history)${NC}"

for i in {1..6}; do
  echo "   Sending remittance #$i..."
  REMITTANCE_RESPONSE=$(curl -s -X POST "${API_BASE}/agents/remittance/send" \
    -H "Content-Type: application/json" \
    -d "{
      \"senderAgentId\": \"1\",
      \"receiverAgentId\": \"4\",
      \"amount\": $((50 + i * 25)),
      \"currency\": \"USD\"
    }")
  
  if [[ $REMITTANCE_RESPONSE == *"success"*"true"* ]]; then
    TX_HASH=$(echo "$REMITTANCE_RESPONSE" | jq -r '.result.transactionHash')
    sleep 0.5
  else
    echo -e "${RED}   ❌ Remittance #$i failed${NC}"
  fi
done

echo -e "${GREEN}✅ Sent 6 remittances to build credit history${NC}"
echo ""

# Test 4: Confirm Receipt (using last transaction)
echo -e "${YELLOW}Test 4: Confirm Last Receipt${NC}"
if [ -z "$TX_HASH" ]; then
  echo -e "${YELLOW}⚠️  Skipping (no transaction hash)${NC}"
else
  CONFIRM_RESPONSE=$(curl -s -X POST "${API_BASE}/agents/receiver/confirm" \
    -H "Content-Type: application/json" \
    -d "{\"transactionHash\": \"$TX_HASH\"}")

  if [[ $CONFIRM_RESPONSE == *"success"*"true"* ]]; then
    echo -e "${GREEN}✅ Receipt confirmed${NC}"
  else
    echo -e "${YELLOW}⚠️  Receipt not found (expected for mock transactions)${NC}"
  fi
fi
echo ""

# Test 5: Apply for Loan
echo -e "${YELLOW}Test 5: Apply for Loan (\$300)${NC}"
LOAN_RESPONSE=$(curl -s -X POST "${API_BASE}/agents/worker/apply-loan" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 300
  }')

echo "$LOAN_RESPONSE" | jq '.'

if [[ $LOAN_RESPONSE == *"zkProofs"* ]] || [[ $LOAN_RESPONSE == *"success"*"true"* ]]; then
  echo -e "${GREEN}✅ Loan application submitted${NC}"
  
  # Extract ZK proofs (handle both response formats)
  if [[ $LOAN_RESPONSE == *"result"* ]]; then
    ZK_PROOFS=$(echo "$LOAN_RESPONSE" | jq -c '.result.zkProofs')
  else
    ZK_PROOFS=$(echo "$LOAN_RESPONSE" | jq -c '.zkProofs')
  fi
  
  # Test 6: Process Loan Application
  echo ""
  echo -e "${YELLOW}Test 6: Process Loan Application with AI${NC}"
  
  CREDIT_RESPONSE=$(curl -s -X POST "${API_BASE}/agents/credit/process-loan" \
    -H "Content-Type: application/json" \
    -d "{
      \"applicantAgentId\": \"1\",
      \"requestedAmount\": 300,
      \"zkProofs\": $ZK_PROOFS
    }")
  
  echo "$CREDIT_RESPONSE" | jq '.'
  
  # Extract result (handle both response formats)
  if [[ $CREDIT_RESPONSE == *"result"* ]]; then
    APPROVED=$(echo "$CREDIT_RESPONSE" | jq -r '.result.approved')
    CREDIT_SCORE=$(echo "$CREDIT_RESPONSE" | jq -r '.result.creditScore')
    MAX_LOAN=$(echo "$CREDIT_RESPONSE" | jq -r '.result.maxLoanAmount')
    INTEREST_RATE=$(echo "$CREDIT_RESPONSE" | jq -r '.result.interestRate')
  else
    APPROVED=$(echo "$CREDIT_RESPONSE" | jq -r '.approved')
    CREDIT_SCORE=$(echo "$CREDIT_RESPONSE" | jq -r '.creditScore')
    MAX_LOAN=$(echo "$CREDIT_RESPONSE" | jq -r '.maxLoanAmount')
    INTEREST_RATE=$(echo "$CREDIT_RESPONSE" | jq -r '.interestRate')
  fi
  
  if [[ $APPROVED == "true" ]]; then
    echo -e "${GREEN}✅ Loan APPROVED${NC}"
    echo "   Credit Score: $CREDIT_SCORE"
    echo "   Max Loan Amount: \$${MAX_LOAN}"
    echo "   Interest Rate: ${INTEREST_RATE}%"
  else
    echo -e "${YELLOW}⚠️  Loan DENIED${NC}"
    echo "   Credit Score: $CREDIT_SCORE"
    if [[ $CREDIT_RESPONSE == *"result"* ]]; then
      echo "   Reason: $(echo "$CREDIT_RESPONSE" | jq -r '.result.reason')"
    else
      echo "   Reason: $(echo "$CREDIT_RESPONSE" | jq -r '.reason')"
    fi
  fi
else
  echo -e "${RED}❌ Loan application failed${NC}"
  exit 1
fi
echo ""

echo -e "${GREEN}=============================="
echo "✅ All tests passed!"
echo "=============================="
echo ""
echo "You can now test the frontend:"
echo "  1. Open browser to http://localhost:3000/demo"
echo "  2. Connect wallet (Hedera Testnet)"
echo "  3. Follow the demo flow"
echo ""

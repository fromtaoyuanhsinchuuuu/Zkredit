#!/bin/bash

# Test ZKredit Agent Backend API

BASE_URL="http://localhost:3002"

echo "======================================"
echo "Testing ZKredit Agent Backend API"
echo "======================================"
echo ""

# Test 1: Health Check
echo "1. Testing /health endpoint..."
curl -s "$BASE_URL/health" | jq '.'
echo ""
echo ""

# Test 2: Get Tools List
echo "2. Testing /tools endpoint..."
curl -s "$BASE_URL/tools" | jq '.'
echo ""
echo ""

# Test 3: Get Contracts
echo "3. Testing /contracts endpoint..."
curl -s "$BASE_URL/contracts" | jq '.'
echo ""
echo ""

# Test 4: Generate FeedbackAuth
echo "4. Testing /feedbackauth/generate endpoint..."
curl -s -X POST "$BASE_URL/feedbackauth/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "1",
    "clientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "indexLimit": 10,
    "expiryHours": 24
  }' | jq '.'
echo ""
echo ""

echo "======================================"
echo "All tests completed!"
echo "======================================"

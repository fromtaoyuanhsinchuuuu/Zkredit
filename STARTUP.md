# 🚀 ZKredit 快速啟動指南

## 📋 前置檢查

確認以下服務正在運行：

```bash
# 檢查 Backend (應該顯示 node 進程)
lsof -i :3003

# 檢查 Frontend (應該顯示 node 進程)
lsof -i :3000
```

---

## 🔧 啟動步驟

### 1. 啟動 Backend (如果未運行)

**終端 1:**
```bash
cd /home/higobear/Coding/zkredit/agent-backend
npm start
```

**預期輸出:**
```
🚀 ZKredit Agent Backend starting...
✅ Hedera client initialized
   Network: testnet
   Account: 0.0.7178277
🎯 Server running on port 3003
```

### 2. 啟動 Frontend (如果未運行)

**終端 2:**
```bash
cd /home/higobear/Coding/zkredit/packages/nextjs
yarn dev
```

**預期輸出:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- info Loaded env from /home/higobear/Coding/zkredit/packages/nextjs/.env.local
```

---

## 🧪 測試 Backend API

運行測試腳本確認所有 API 正常：

```bash
cd /home/higobear/Coding/zkredit
./test-backend-api.sh
```

**測試內容:**
- ✅ Health check
- ✅ 初始化 4 個 agents
- ✅ 發送 6 筆匯款（建立信用歷史）
- ✅ 確認收據
- ✅ 申請貸款（生成 ZK 證明）
- ✅ AI 信用評估（GPT-OSS-120B）

---

## 🌐 訪問 Demo

### 1. 打開瀏覽器

```
http://localhost:3000/demo
```

### 2. 連接錢包到 Hedera Testnet

**重要設置:**
- **Network**: Hedera Testnet
- **Chain ID**: 296
- **RPC URL**: https://testnet.hashio.io/api
- **Currency**: HBAR

**支持的錢包:**
- MetaMask (需要手動添加 Hedera Testnet)
- Rainbow Wallet
- Coinbase Wallet
- WalletConnect

**如何添加 Hedera Testnet 到 MetaMask:**

1. 打開 MetaMask
2. 點擊網路下拉選單
3. 選擇「Add Network」→「Add a network manually」
4. 輸入以下資訊:
   - **Network Name**: Hedera Testnet
   - **RPC URL**: https://testnet.hashio.io/api
   - **Chain ID**: 296
   - **Currency Symbol**: HBAR
   - **Block Explorer**: https://hashscan.io/testnet

### 3. 跟隨 Demo 流程

Demo 共有 7 個步驟：

1. **🔗 Connect Wallet** - 連接到 Hedera Testnet
2. **👤 Profile Setup** - 設定 Worker 和 Receiver 資料
3. **💸 Send Remittance** - Worker 發送 $200 匯款
4. **✓ Confirm Receipt** - Receiver 確認收到款項
5. **🔐 Generate ZK Proofs** - 生成 3 個零知識證明:
   - Income Proof (收入證明)
   - Credit History Proof (信用歷史證明)
   - Collateral Proof (抵押品證明)
6. **💰 Apply for Loan** - 提交貸款申請
7. **🎉 Loan Decision** - AI 信用評估結果

---

## 🐛 故障排除

### Backend 無法啟動

**錯誤:** `Error: HEDERA_PRIVATE_KEY is not valid`

**解決方法:**
```bash
# 檢查 .env 文件
cat agent-backend/.env

# 確保包含正確的 key (不是 placeholder)
HEDERA_ACCOUNT_ID=0.0.7178277
HEDERA_PRIVATE_KEY=YOUR_HEDERA_PRIVATE_KEY_HERE
GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
```

### Frontend 無法連接 Backend

**錯誤:** `HttpRequestError: HTTP request failed`

**檢查:**
```bash
# 確認 backend 正在運行
curl http://localhost:3003/health

# 應該返回:
{"status":"ok","service":"zkredit-agent-backend","version":"1.0.0",...}
```

### 錢包無法連接到 Hedera Testnet

**問題:** MetaMask 顯示「Connection failed」

**解決方法:**
1. 確認已正確添加 Hedera Testnet (Chain ID 296)
2. 檢查 RPC URL: `https://testnet.hashio.io/api`
3. 嘗試重新連接錢包
4. 清除瀏覽器緩存

### Demo 頁面顯示錯誤

**錯誤:** `Cannot read properties of undefined (reading 'slice')`

**已修復!** 最新版本已處理以下問題:
- ✅ Backend API 響應格式 (`{success: true, result: {...}}`)
- ✅ Transaction hash 可能為空的情況
- ✅ Hedera Testnet 網路配置

**如果仍有問題:**
```bash
# 重啟 frontend
cd packages/nextjs
yarn dev
```

### AI 決策失敗

**錯誤:** `Groq API Error: 404 Model not found`

**檢查:**
```bash
# 確認 .env 中的 Groq API Key
cat agent-backend/.env | grep GROQ_API_KEY

# 確認使用正確的模型
# 應該是: openai/gpt-oss-120b (不是 llama-3.1-70b-versatile)
```

---

## 📊 監控運行狀態

### Backend 日誌

```bash
# 如果在終端運行，可以直接看到日誌
# 包含:
💸 === REMITTANCE START ===
📤 Sender: Agent #1
📥 Receiver: Agent #4
💰 Amount: $200 USD
✅ Transfer successful
✅ Transaction recorded to ERC-8004
💸 === REMITTANCE COMPLETE ===
```

### Frontend 控制台

打開瀏覽器開發者工具 (F12) → Console

**正常輸出:**
- API 請求成功
- ZK proofs 已生成
- Loan decision 已接收

**錯誤輸出:**
- 紅色錯誤訊息 → 檢查 backend 是否運行
- CORS 錯誤 → 檢查 backend cors 設定

---

## 🎯 快速測試命令

### 完整測試流程 (CLI)

```bash
# 1. 測試 Backend API
./test-backend-api.sh

# 2. 測試單一 API
curl -X POST http://localhost:3003/agents/remittance/send \
  -H "Content-Type: application/json" \
  -d '{
    "senderAgentId": "1",
    "receiverAgentId": "4",
    "amount": 200,
    "currency": "USD"
  }' | jq '.'

# 3. 查看合約地址
curl http://localhost:3003/contracts | jq '.'
```

### 檢查服務狀態

```bash
# Backend health
curl http://localhost:3003/health | jq '.'

# Frontend (應該顯示 HTML)
curl http://localhost:3000 | head -20
```

---

## 📝 環境變數說明

### Backend (.env)

```bash
# Hedera 帳戶
HEDERA_ACCOUNT_ID=0.0.XXXXXXX          # Testnet 帳戶 ID
HEDERA_PRIVATE_KEY=YOUR_PRIVATE_KEY    # ECDSA 私鑰 (DER 格式)

# 智能合約地址 (已部署到 Hedera Testnet)
IDENTITY_REGISTRY_ADDRESS=0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a
REPUTATION_REGISTRY_ADDRESS=0x423cB049eDCDa6CeB046005e523145615B724003
VALIDATION_REGISTRY_ADDRESS=0x1f048B6A06a382f466D1AA8D25cBc65460601C3f

# AI 模型
GROQ_API_KEY=YOUR_GROQ_API_KEY         # Groq AI API Key
# 使用模型: openai/gpt-oss-120b

# 服務設定
PORT=3003
NODE_ENV=development
```

### Frontend (.env.local) - 可選

```bash
# 如果需要自定義 RPC
NEXT_PUBLIC_HEDERA_RPC=https://testnet.hashio.io/api

# WalletConnect Project ID (已內建)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=3a8170812b534d0ff9d794f19a901d64
```

---

## 🔍 驗證合約部署

在 Hedera 瀏覽器查看已部署的合約：

```bash
# IdentityRegistry
https://hashscan.io/testnet/contract/0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a

# ReputationRegistry
https://hashscan.io/testnet/contract/0x423cB049eDCDa6CeB046005e523145615B724003

# ValidationRegistry
https://hashscan.io/testnet/contract/0x1f048B6A06a382f466D1AA8D25cBc65460601C3f
```

---

## ✅ 成功指標

當一切正常時，你應該看到：

1. ✅ Backend 運行在 port 3003
2. ✅ Frontend 運行在 port 3000
3. ✅ 測試腳本全部通過
4. ✅ Demo 頁面可以連接錢包
5. ✅ 可以完成完整的 7 步驟流程
6. ✅ AI 決策顯示貸款批准/拒絕

---

## 📞 需要幫助？

如果遇到問題：

1. **檢查日誌** - Backend 和 Frontend 的終端輸出
2. **運行測試** - `./test-backend-api.sh` 確認 backend 正常
3. **查看文檔** - `README.md` 和 `ARCHITECTURE.md`
4. **重啟服務** - 停止並重新啟動 backend/frontend

---

**Last Updated:** 2025年11月2日
**Version:** 1.0.0
**Status:** ✅ All systems operational

# ZKredit Agent Backend

Hedera Agent Kit 後端服務，整合 ERC-8004 agent registry 標準。

## 功能特色

- ✅ **Agent 註冊**: 使用 IdentityRegistry 註冊新 agent（ERC-721 NFT）
- ✅ **回饋提交**: 使用 FeedbackAuth 加密授權提交 agent 評價
- ✅ **信譽查詢**: 查詢 agent 評價和信譽數據
- ✅ **驗證請求**: 創建和管理 agent 驗證請求
- ✅ **Hedera 整合**: 完整的 Hedera SDK 支援

## 架構

```
agent-backend/
├── src/
│   ├── index.ts              # Express API server
│   ├── plugins/
│   │   └── zkreditPlugin.ts  # Hedera Agent Kit 自定義插件
│   └── services/
│       └── feedbackAuthService.ts  # FeedbackAuth 簽名服務
├── .env                       # 環境變數配置
└── package.json
```

## 已部署合約（Hedera Testnet）

- **IdentityRegistry**: `0x1FCE50d8F7B53d18d458Cf009dA2AD7cf0F2464d`
- **ReputationRegistry**: `0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a`
- **ValidationRegistry**: `0x423cB049eDCDa6CeB046005e523145615B724003`

## 安裝

```bash
npm install
```

## 啟動

### 開發模式
```bash
npm run dev
# 或
npx tsx watch src/index.ts
```

### 生產模式
```bash
npm run build
npm start
```

## API Endpoints

### 1. Health Check
```bash
GET /health
```

回應：
```json
{
  "status": "ok",
  "service": "zkredit-agent-backend",
  "version": "1.0.0",
  "hedera": {
    "network": "testnet",
    "accountId": "0.0.7178277"
  }
}
```

### 2. 取得可用工具
```bash
GET /tools
```

回應：
```json
{
  "plugin": {
    "name": "zkredit",
    "version": "1.0.0",
    "description": "ZKredit agent management plugin"
  },
  "tools": [
    {
      "method": "registerAgent",
      "name": "Register Agent",
      "description": "Register a new agent in the IdentityRegistry",
      "parameters": {...}
    },
    ...
  ]
}
```

### 3. 註冊 Agent
```bash
POST /tools/registerAgent
Content-Type: application/json

{
  "tokenUri": "ipfs://QmXXX...",
  "metadata": ["key1", "value1", "key2", "value2"]
}
```

### 4. 提交回饋
```bash
POST /tools/submitFeedback
Content-Type: application/json

{
  "agentId": "1",
  "rating": 5,
  "comment": "Excellent service!",
  "clientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "indexLimit": "10",
  "expiryHours": 24
}
```

### 5. 生成 FeedbackAuth
```bash
POST /feedbackauth/generate
Content-Type: application/json

{
  "agentId": "1",
  "clientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "indexLimit": 10,
  "expiryHours": 24
}
```

回應：
```json
{
  "success": true,
  "feedbackAuth": "0x00000000...65bytesignature",
  "params": {
    "agentId": "1",
    "clientAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "indexLimit": 10,
    "expiryHours": 24
  }
}
```

### 6. 取得合約地址
```bash
GET /contracts
```

## ZKredit Plugin

Plugin 實作了 Hedera Agent Kit 的標準介面：

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;
  tools: (context: Context) => Tool[];
}
```

### 可用工具

1. **registerAgent**: 註冊新 agent 到 IdentityRegistry
2. **submitFeedback**: 提交 agent 評價（含 FeedbackAuth）
3. **getAgentReputation**: 查詢 agent 信譽數據
4. **requestValidation**: 創建驗證請求

## FeedbackAuth 機制

FeedbackAuth 是一個 289 bytes 的加密授權結構：

- **Struct (224 bytes)**: ABI 編碼的 7 個參數
  - agentId (uint256)
  - clientAddress (address)
  - indexLimit (uint64)
  - expiry (uint256)
  - chainId (uint256)
  - identityRegistry (address)
  - signerAddress (address)

- **Signature (65 bytes)**: ECDSA 簽名
  - r (32 bytes)
  - s (32 bytes)
  - v (1 byte)

### 簽名流程

1. ABI encode struct → 224 bytes
2. keccak256(encoded) → 32 bytes hash
3. Apply EIP-191 prefix: `\x19Ethereum Signed Message:\n32` + hash
4. Sign with Hedera private key → 65 bytes signature
5. Concatenate: struct + signature = 289 bytes

## 環境變數

在 `.env` 檔案中配置：

```env
# Hedera Testnet
HEDERA_ACCOUNT_ID=0.0.7178277
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...

# 已部署合約
IDENTITY_REGISTRY_ADDRESS=0x1FCE50d8F7B53d18d458Cf009dA2AD7cf0F2464d
REPUTATION_REGISTRY_ADDRESS=0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a
VALIDATION_REGISTRY_ADDRESS=0x423cB049eDCDa6CeB046005e523145615B724003

# Server
PORT=3002
```

## 測試

執行 API 測試腳本：

```bash
./test-api.sh
```

## 技術棧

- **Hedera SDK**: `@hashgraph/sdk@^2.49.2`
- **Web3 工具**: `viem@^2.21.55`
- **API 框架**: `express@^4.21.2`
- **參數驗證**: `zod@^3.24.1`
- **TypeScript**: `^5.7.3`

## 後續整合

### 前端整合（Next.js）

在 `packages/nextjs` 中創建 agent 管理介面：

```typescript
// 呼叫 backend API
const response = await fetch('http://localhost:3002/tools/registerAgent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenUri: 'ipfs://QmXXX...',
    metadata: ['name', 'Alice', 'country', 'Thailand']
  })
});
```

### x402 支付整合

增強 X402Payment.sol 並在 plugin 中加入支付工具：

```typescript
// 在執行 agent 操作前先驗證支付
await x402PaymentTool.execute(client, context, {
  amount: '0.01',
  apiEndpoint: '/tools/submitFeedback'
});
```

## License

MIT

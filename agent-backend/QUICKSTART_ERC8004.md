# ERC-8004 Quick Start Checklist

## 🚀 3 分鐘快速啟動指南

### 第一步: 測試連接 (30 秒)
```bash
cd /home/higobear/Coding/zkredit/agent-backend
node scripts/test-erc8004-connection.js
```
✅ 應該看到兩個合約地址都是 valid

### 第二步: 註冊 Agents (2 分鐘)
```bash
node scripts/register-agents-erc8004.js
```
✅ 應該看到 4/4 agents registered successfully
⚠️ 這個步驟只需要執行一次！

### 第三步: 啟動系統
```bash
npm run build && npm start
```

### 第四步: 測試 Demo
1. 打開 http://localhost:3000/demo
2. 完成貸款申請流程
3. 查看 console logs 應該有:
```
✅ Assessment logged to ERC-8004 ReputationRegistry
📋 Transaction ID: 0.0.7178277@...
```

### 第五步: 驗證鏈上數據
複製 Transaction ID，打開:
```
https://hashscan.io/testnet/transaction/{transactionId}
```

## 🎯 Demo 展示流程

1. **打開 IdentityRegistry 合約頁面** (30 秒)
   - https://hashscan.io/testnet/contract/0x1FCE50d8F7B53d18d458Cf009dA2AD7cf0F2464d
   - 點擊 "Events" 標籤
   - 展示 `Registered` 事件

2. **執行貸款流程** (2 分鐘)
   - 前端操作
   - 展示 backend console logs

3. **展示 Transaction** (1 分鐘)
   - 打開剛才的 transaction URL
   - 展示 `NewFeedback` 事件
   - 說明: "這是區塊鏈上永久不可竄改的記錄"

## ✅ 檢查項目

- [ ] 合約地址在 .env 中已設定
- [ ] 執行過註冊腳本（只需一次）
- [ ] Backend 啟動正常
- [ ] 測試過完整貸款流程
- [ ] 確認 HashScan 上有交易記錄

## 🆘 疑難排解

**Q: 註冊腳本失敗，顯示 "insufficient gas"**
A: 增加 setGas() 的值，或確保 operator account 有足夠 HBAR

**Q: 看不到 Registered 事件**
A: 檢查 HashScan URL 是否正確，events 可能需要幾秒鐘才會顯示

**Q: giveFeedback 交易失敗**
A: 確認 REPUTATION_REGISTRY_ADDRESS 正確，且 agent 已註冊

**Q: 想重新註冊**
A: ERC-721 NFT 一個地址只能註冊一次，除非使用不同的地址

## 📊 成功指標

✅ HashScan 上看到 4 個 `Registered` 事件
✅ 每次貸款評估後看到 `NewFeedback` 事件  
✅ Transaction logs 顯示 "Assessment logged to ERC-8004"
✅ Console 沒有錯誤訊息

---

**準備好了嗎？開始執行第一步吧！** 🚀

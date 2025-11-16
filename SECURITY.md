# 🔒 Security Checklist for ZKredit

## ✅ Completed Security Measures

### 1. Environment Variables Protection
- ✅ `.env` files added to `.gitignore`
- ✅ `agent-backend/.env` explicitly ignored
- ✅ All documentation uses placeholder values
- ✅ Real API keys never committed to GitHub

### 2. Sensitive Data Removed
- ✅ Groq API Key replaced with `YOUR_GROQ_API_KEY`
- ✅ Hedera Private Key replaced with `YOUR_PRIVATE_KEY`
- ✅ Hedera Account ID replaced with `0.0.XXXXXXX`

### 3. Git History Cleaned
- ✅ Previous commit amended to remove secrets
- ✅ Force pushed clean history to GitHub
- ✅ GitHub push protection satisfied

---

## 🚨 Never Commit These Files

```
# ❌ DO NOT COMMIT
agent-backend/.env
packages/nextjs/.env.local
*.key
*.pem
```

---

## 📋 Setup Instructions for New Developers

### 1. Copy Environment Template
```bash
# Backend
cp agent-backend/.env.example agent-backend/.env

# Frontend (optional)
cp packages/nextjs/.env.local.example packages/nextjs/.env.local
```

### 2. Fill in Your Credentials

**Backend (.env):**
```bash
# Get from https://console.hedera.com
HEDERA_ACCOUNT_ID=0.0.XXXXXXX
HEDERA_PRIVATE_KEY=your_private_key_here

# Get from https://console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# Contract addresses (already deployed)
IDENTITY_REGISTRY_ADDRESS=0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a
REPUTATION_REGISTRY_ADDRESS=0x423cB049eDCDa6CeB046005e523145615B724003
VALIDATION_REGISTRY_ADDRESS=0x1f048B6A06a382f466D1AA8D25cBc65460601C3f

PORT=3003
NODE_ENV=development
```

### 3. Verify .gitignore
```bash
# Check .env is ignored
git check-ignore agent-backend/.env
# Should output: agent-backend/.env

# Check no secrets in staging
git diff --cached
```

---

## 🔐 Where to Get API Keys

### Hedera Testnet Account
1. Go to https://portal.hedera.com
2. Create a new testnet account
3. Get your Account ID (0.0.XXXXXXX)
4. Download your private key

### Groq API Key
1. Go to https://console.groq.com
2. Sign up / Log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `gsk_`)

---

## ⚠️ If You Accidentally Commit Secrets

### Immediate Actions:

1. **Revoke the exposed keys immediately**
   - Hedera: Generate new private key
   - Groq: Delete and create new API key

2. **Remove from Git history**
```bash
# Amend last commit
git add .
git commit --amend --no-edit
git push origin main --force-with-lease

# For older commits, use git filter-repo
# Install: pip install git-filter-repo
git filter-repo --path-match '*.env' --invert-paths
```

3. **Update .env with new keys**
```bash
# Update your local .env with new credentials
nano agent-backend/.env
```

4. **Notify team members**
   - Let everyone know keys were rotated
   - Share new keys through secure channels (NOT GitHub)

---

## 🛡️ Best Practices

### DO ✅
- Use environment variables for all secrets
- Use `.env.example` as template (with fake values)
- Add `.env` to `.gitignore`
- Use GitHub Secrets for CI/CD
- Rotate keys regularly (every 90 days)
- Use different keys for dev/staging/prod

### DON'T ❌
- Never hardcode API keys in source code
- Never commit `.env` files
- Never share keys in Slack/Discord/Email
- Never use production keys in development
- Never push directly without checking `git diff`
- Never ignore GitHub push protection warnings

---

## 🔍 Pre-Commit Checklist

Before every commit:
```bash
# 1. Check what you're committing
git diff --cached

# 2. Verify no .env files
git status | grep .env

# 3. Search for API key patterns
git diff --cached | grep -E "(gsk_|0x[a-f0-9]{64}|302e020100)"

# 4. Run lint
yarn lint

# 5. Commit
git commit -m "your message"
```

---

## 📝 Documentation Security

All documentation files should use:
- ✅ `YOUR_API_KEY_HERE`
- ✅ `0.0.XXXXXXX`
- ✅ `your_private_key_here`
- ✅ `REPLACE_WITH_YOUR_KEY`

Never use real values in:
- README.md
- ARCHITECTURE.md
- STARTUP.md
- Code comments
- Example files

---

## 🚀 Deployment Security

### Vercel/Netlify (Frontend)
```bash
# Set environment variables in dashboard
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_id
```

### Render/Railway (Backend)
```bash
# Set in deployment settings
HEDERA_ACCOUNT_ID=0.0.XXXXXXX
HEDERA_PRIVATE_KEY=your_key
GROQ_API_KEY=gsk_xxxx
```

### GitHub Actions (CI/CD)
```yaml
# Use GitHub Secrets
env:
  GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
  HEDERA_PRIVATE_KEY: ${{ secrets.HEDERA_PRIVATE_KEY }}
```

---

## 📞 Security Contact

If you discover a security vulnerability:
1. **DO NOT** open a public GitHub issue
2. Email: [your-security-email@example.com]
3. Use GitHub Security Advisories
4. Report to project maintainers privately

---

## ✅ Current Security Status

| Item | Status | Last Updated |
|------|--------|--------------|
| .gitignore configured | ✅ | 2025-11-02 |
| Documentation sanitized | ✅ | 2025-11-02 |
| Git history clean | ✅ | 2025-11-02 |
| API keys rotated | ⚠️ Recommended | - |
| Pre-commit hooks | ✅ (husky) | 2025-11-02 |

---

**Last Updated:** 2025年11月2日  
**Security Version:** 1.0.0  
**Status:** 🔒 Secure

# 🎯 Problem-Driven Model Selection System

## Overview

Instead of silent automatic failover, **HAL now actively recommends models** based on what you're trying to do.

**You describe the problem → HAL suggests the best model + explains why.**

---

## The Lineup (7 Models)

### 🟢 LOCAL & FREE (Runs on Your Mac)

**Ollama Llama 3.3 13B** (Default)
- Speed: Instant
- Cost: $0
- Best for: General tasks, chat, when speed matters
- RAM: ~15GB of your 24GB

**Ollama DeepSeek-R1 8B** (Reasoning)
- Speed: Instant (but slower than Llama)
- Cost: $0
- Best for: Complex problems, reasoning, code
- RAM: ~8GB of your 24GB

### 🔵 CLOUD & CHEAP (Cloud API)

**Together AI DeepSeek-V3** (Advanced)
- Speed: Fast
- Cost: $0.00014 per 1M tokens (~90% cheaper than Anthropic)
- Best for: Advanced reasoning, complex coding
- When to use: Local models can't handle it

**Together AI Llama 3.3 70B Turbo** (Fast Cloud)
- Speed: Fast
- Cost: $0.00088 per 1M tokens
- Best for: Fallback when local is slow
- When to use: When Ollama is overloaded

### 🟠 PREMIUM (Anthropic Claude)

**Claude Haiku**
- Speed: Fast
- Cost: $0.002 per request (~$2 per million tokens)
- Best for: Chat, vision, when quality matters
- Special: Vision (image) support

**Claude Sonnet 4.5**
- Speed: Normal
- Cost: $0.009 per request (~$9 per million tokens)
- Best for: Complex code, advanced reasoning, best quality
- Special: Vision + reasoning

### 🔴 FALLBACK (Last Resort)

**OpenAI GPT-4o Mini**
- Speed: Fast
- Cost: $0.00075 per 1M tokens
- Best for: Emergency, vision when Claude unavailable
- When to use: Everything else failed

---

## How It Works

### Automatic Detection

When you ask something, HAL analyzes it:

```
"That's slow, give me a faster response"
→ Detects: speed priority
→ Suggests: Ollama Llama (instant, free)

"Explain why quantum computing works"
→ Detects: reasoning needed
→ Suggests: DeepSeek-R1 (free, good reasoning)

"Fix this Python bug in my code"
→ Detects: coding task
→ Suggests: DeepSeek-R1 (or V3 if complex)

"Look at this image and describe it"
→ Detects: vision needed
→ Suggests: Claude Haiku (only local model without vision)

"I'm on a budget"
→ Detects: cost-conscious
→ Suggests: Ollama Llama (free)
```

### Manual Control

You always can switch manually:

```
/model list              # See all available models
/model suggest           # Get recommendation for last message
/model ollama/llama3.3:13b  # Use Llama
/model together/deepseek-ai/DeepSeek-V3  # Use cloud DeepSeek
/model anthropic/claude-haiku-4-5-20251001  # Use Claude
/model default           # Back to primary (Ollama Llama)
```

---

## Setup Instructions

### Step 1: Install Ollama

```bash
bash /Users/mac/.openclaw/workspace/setup-ollama.sh
```

This will:
1. Install Ollama (if not already)
2. Pull Llama 3.3 13B (~15GB)
3. Pull DeepSeek-R1 8B (~8GB)
4. Start Ollama service

**What it downloads:** ~23GB (fits in your 24GB Mac)

### Step 2: Add API Keys

Edit `~/.zshrc` and add:

```bash
export TOGETHER_API_KEY="YOUR_KEY"        # https://together.ai (free account + $5 free credits)
export ANTHROPIC_API_KEY="YOUR_KEY"       # https://console.anthropic.com
export GOOGLE_API_KEY="YOUR_KEY"          # https://aistudio.google.com
export OPENAI_API_KEY="YOUR_KEY"          # https://platform.openai.com
```

Then reload:
```bash
source ~/.zshrc
```

### Step 3: Update OpenClaw Config

Copy the model config into your `~/.openclaw/openclaw.json`:

```bash
cat /Users/mac/.openclaw/workspace/model-config.json5 >> ~/.openclaw/openclaw.json
```

Then reload OpenClaw:
```bash
openclaw gateway restart
```

### Step 4: Verify Setup

Test local models:
```bash
ollama list
```

Test cloud providers:
```bash
curl -H "Authorization: Bearer $TOGETHER_API_KEY" https://api.together.xyz/v1/models
```

Test recommendation system:
```bash
node /Users/mac/.openclaw/workspace/model-recommender.js "explain quantum computing"
```

---

## Cost Breakdown

### Monthly Estimates (Typical Usage)

| Task | Model | Cost |
|------|-------|------|
| Chat (100K tokens) | Ollama Llama | $0 |
| Reasoning (100K tokens) | Ollama DeepSeek-R1 | $0 |
| Complex coding (100K tokens) | Together DeepSeek-V3 | $0.014 |
| Vision task (10 images) | Claude Haiku | $0.01-0.02 |
| **Total** (mixed usage) | Mix of above | **$0.03-0.50/month** |

### Savings vs Anthropic-Only

| Scenario | With old setup | With new setup | Savings |
|----------|---|---|---|
| All Haiku | $2.40/mo | $0 (local) | $2.40 |
| Half Haiku, half reasoning | $2.40 | $0 (local) | $2.40 |
| Complex + budget | $10+ | $0.02 | $10 |

---

## Problem Detection Keywords

**Speed:** "slow", "fast", "instant", "quick", "hurry"
**Reasoning:** "explain", "why", "logic", "think", "complex"
**Coding:** "code", "bug", "function", "algorithm", "python"
**Vision:** "image", "photo", "screenshot", "look at", "design"
**Budget:** "cost", "cheap", "free", "money", "budget"

---

## When to Use Each Model

### Use Ollama Llama 3.3 13B If:
- ✅ General chat or question answering
- ✅ You want instant response
- ✅ You want to save money
- ✅ No vision/images needed
- ✅ Simple coding questions

### Use Ollama DeepSeek-R1 8B If:
- ✅ Complex reasoning needed
- ✅ Multi-step problem solving
- ✅ Code debugging or design
- ✅ You want free + reasoning
- ⚠️ Slower than Llama (still instant, but a few seconds)

### Use Together AI DeepSeek-V3 If:
- ✅ Local models struggling
- ✅ Very complex reasoning needed
- ✅ Long-context tasks (65K tokens)
- ✅ Advanced code architecture
- 💰 Cost: $0.00028 per 1K tokens (very cheap)

### Use Claude Haiku If:
- ✅ Vision/image analysis needed
- ✅ Want best quality chat
- ✅ Need vision + general chat
- 💰 Cost: ~$0.002 per request

### Use Claude Sonnet 4.5 If:
- ✅ Best quality code needed
- ✅ Advanced reasoning matters
- ✅ Vision + reasoning combo
- 💰 Cost: ~$0.009 per request (expensive)

### Use GPT-4o Only If:
- ⚠️ Claude isn't available
- ⚠️ Only as emergency fallback
- 💰 Cost: Most expensive

---

## Troubleshooting

### "Model not found"
```bash
/model list
```
Shows all available models. Make sure you pulled them with Ollama or have API keys set.

### "Ollama not responding"
```bash
ollama serve
```
Make sure Ollama daemon is running. Or pull models again:
```bash
ollama pull llama3.3:13b
ollama pull deepseek-r1:8b
```

### "API key error for Together AI"
1. Visit https://together.ai
2. Create free account
3. Get API key
4. Export: `export TOGETHER_API_KEY="your-key"`

### "Response is slow"
Try a smaller model:
```
/model ollama/deepseek-r1:8b  # Uses less RAM
/model together/meta-llama/Llama-3.3-70B-Instruct-Turbo  # Fast cloud
```

### "Running out of VRAM"
You have 24GB. Two models max:
- Llama 13B (~15GB) + DeepSeek-R1 8B (~8GB) = 23GB ✅
- Llama 13B + Llama 70B = 85GB ❌ (won't fit)

---

## Advanced: Customize Problem Detection

Edit `/Users/mac/.openclaw/workspace/model-recommender.js`:

Add keywords to detect your specific patterns:
```javascript
myDomain: {
  keywords: ['your-word', 'another-word'],
  weight: 2
}
```

Then the system will detect that problem type and recommend accordingly.

---

## Files Reference

- **setup-ollama.sh** — Installs Ollama + models
- **model-config.json5** — Full model provider config (copy to ~/.openclaw/openclaw.json)
- **model-recommender.js** — Problem detection + recommendation engine
- **MODELS-README.md** — This file

---

## Summary

✅ **Problem-driven** — Suggests models based on task
✅ **Cost-optimized** — Prefer free local → cheap cloud → premium
✅ **RAM-aware** — Configured for your 24GB Mac
✅ **Easy switching** — `/model` command to try anything
✅ **Transparent** — Shows cost + reasoning for each suggestion
✅ **Never locked out** — 7 fallback options

**Start with:** `bash setup-ollama.sh` to get running.

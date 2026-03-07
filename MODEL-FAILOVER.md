# OpenClaw Model Failover Strategy

## Problem
- You were getting locked out on Anthropic (bad keys, overruns)
- No fallback chain
- No alerts for token depletion
- Single point of failure

## Solution

### Model Chain (Primary → Fallback)
```
Anthropic Claude Haiku 4.5 (primary, fast + cheap)
  ↓ (on auth fail, token limit, or rate limit)
DeepSeek (ultra-cheap, good for reasoning)
  ↓ (on auth fail)
OpenAI GPT-4o (premium fallback)
```

### Configuration
See `~/.openclaw/openclaw.json` section: `agents.defaults.model`

**Primary:** `anthropic/claude-haiku-4-5-20251001`
**Fallbacks:** `deepseek/deepseek-chat`, `openai/gpt-4o`

### API Key Management

**All three providers required:**

1. **Anthropic**
   - Get key: https://console.anthropic.com/keys
   - Store: `ANTHROPIC_API_KEY` (env var)
   - Monthly budget: Set in console

2. **DeepSeek**
   - Get key: https://platform.deepseek.com/keys
   - Store: `DEEPSEEK_API_KEY` (env var)
   - Cost: ~1/10 of OpenAI

3. **OpenAI**
   - Get key: https://platform.openai.com/keys
   - Store: `OPENAI_API_KEY` (env var)
   - Premium fallback only

### Token Usage Alerts

**Anthropic quota alerts:**

```bash
# Check current usage (requires API key)
node ~/.openclaw/workspace/monitor-anthropic-usage.js

# Output:
# 📊 Anthropic Usage Report
# ├─ Usage: 65% of monthly quota
# ├─ Estimated remaining: $120 / $300
# └─ ⚠️  ALERT: 65% used - PURCHASE MORE TOKENS NOW
```

**Auto-alerts:**
- Runs daily at 9 AM
- Sends Telegram alert if > 70% used
- Telegram alert if > 90% used (CRITICAL)

### Switching Models in Chat

In your main session, use `/model` to switch:

```
/model anthropic/claude-sonnet-4-5    # Upgrade to better model
/model deepseek/deepseek-chat         # Switch to DeepSeek fallback
/model default                        # Back to primary
```

### Testing Failover

**Intentional failover test:**

1. Kill Anthropic key temporarily:
   ```bash
   unset ANTHROPIC_API_KEY
   ```

2. Send a message to HAL
   - Should fail Anthropic auth
   - Auto-fallback to DeepSeek
   - Message processes fine ✅

3. Restore Anthropic key:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

4. Next message uses Anthropic again

### Monitoring

**Check active provider per request:**
```bash
openclaw logs --tail 20 | grep "model:"
```

Look for lines like:
```
[model: anthropic/claude-haiku-4-5-20251001 ✅]
[model: deepseek/deepseek-chat (fallback) 🔄]
[model: openai/gpt-4o (premium fallback) 💎]
```

### Cost Breakdown

**Monthly estimates (100K tokens/day usage):**

| Provider | Cost/1M tokens | Est. monthly (3M tokens) |
|----------|---|---|
| Claude Haiku | $0.80 | ~$2.40 |
| DeepSeek | $0.14 | ~$0.42 |
| GPT-4o | $2.50 | ~$7.50 |
| **Total** | - | ~$10 |

**Strategy:**
- Use Anthropic Haiku for everything (cheapest, good quality)
- DeepSeek fallback when Anthropic is down/expensive
- GPT-4o only for premium reasoning when you really need it

### Emergency: All Providers Down

If all three APIs fail:
1. HAL can still use local reasoning
2. Most tools still work (file ops, execution, etc.)
3. Only chat responses will be slow/unavailable

Fallback: SSH into your Mac and use OpenClaw CLI directly.

---

## Next Steps

1. ✅ Verify all three API keys are set in env
2. ✅ Run token usage monitor daily
3. ✅ Set budget alerts in Anthropic console ($300/mo recommended)
4. ✅ Test failover with `/model` command

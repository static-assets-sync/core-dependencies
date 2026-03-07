#!/usr/bin/env node

/**
 * Problem-Driven Model Recommender
 * Analyzes user request and recommends the best model
 * Integrated into HAL's decision-making
 */

const fs = require('fs');
const path = require('path');

// Model metadata
const MODELS = {
  // LOCAL (FREE)
  'ollama/llama3.3:13b': {
    name: 'Llama 3.3 13B',
    category: 'local-free',
    speed: 'instant',
    cost: 0,
    reasoning: false,
    vision: false,
    coding: 7,
    chat: 8,
    bestFor: ['general', 'chat', 'quick', 'low-cost'],
    tags: ['fast', 'reliable', 'free']
  },
  'ollama/deepseek-r1:8b': {
    name: 'DeepSeek-R1 8B',
    category: 'local-free',
    speed: 'instant',
    cost: 0,
    reasoning: true,
    vision: false,
    coding: 8,
    chat: 7,
    bestFor: ['reasoning', 'complex', 'free'],
    tags: ['reasoning', 'free', 'chain-of-thought']
  },

  // CLOUD (CHEAP)
  'together/deepseek-ai/DeepSeek-V3': {
    name: 'DeepSeek-V3 (Cloud)',
    category: 'cloud-cheap',
    speed: 'fast',
    cost: 0.00014,
    reasoning: true,
    vision: false,
    coding: 9,
    chat: 8,
    bestFor: ['advanced-reasoning', 'complex-code', 'long-context'],
    tags: ['cheap', 'reasoning', 'coding']
  },
  'together/meta-llama/Llama-3.3-70B-Instruct-Turbo': {
    name: 'Llama 70B Turbo (Cloud)',
    category: 'cloud-cheap',
    speed: 'fast',
    cost: 0.00088,
    reasoning: false,
    vision: false,
    coding: 8,
    chat: 8,
    bestFor: ['fallback', 'general', 'when-local-slow'],
    tags: ['cheap', 'fast-cloud']
  },

  // PREMIUM
  'anthropic/claude-haiku-4-5-20251001': {
    name: 'Claude Haiku',
    category: 'premium',
    speed: 'fast',
    cost: 0.002,
    reasoning: false,
    vision: true,
    coding: 8,
    chat: 9,
    bestFor: ['chat', 'vision', 'quality'],
    tags: ['premium', 'chat', 'vision']
  },
  'anthropic/claude-sonnet-4-5-20250514': {
    name: 'Claude Sonnet',
    category: 'premium',
    speed: 'normal',
    cost: 0.009,
    reasoning: true,
    vision: true,
    coding: 9,
    chat: 9,
    bestFor: ['complex-code', 'advanced-reasoning', 'best-quality'],
    tags: ['premium', 'best', 'expensive']
  },

  // FALLBACK
  'openai/gpt-4o-mini': {
    name: 'GPT-4o Mini',
    category: 'fallback',
    speed: 'fast',
    cost: 0.00075,
    reasoning: false,
    vision: true,
    coding: 7,
    chat: 7,
    bestFor: ['emergency', 'vision'],
    tags: ['fallback']
  }
};

/**
 * PROBLEM DETECTION
 * Analyzes user message to detect problem type
 */
function detectProblem(message) {
  const lower = message.toLowerCase();
  
  const problems = {
    slow: {
      keywords: ['slow', 'fast', 'instant', 'speed', 'quick', 'hurry'],
      weight: 1
    },
    reasoning: {
      keywords: ['explain', 'why', 'reason', 'logic', 'think', 'complex', 'deep', 'philosophy', 'understand'],
      weight: 2
    },
    coding: {
      keywords: ['code', 'function', 'bug', 'debug', 'algorithm', 'implement', 'class', 'script', 'python', 'javascript', 'typescript', 'bash'],
      weight: 3
    },
    vision: {
      keywords: ['image', 'picture', 'photo', 'screenshot', 'look at', 'see', 'visual', 'draw', 'design', 'ui', 'diagram'],
      weight: 3
    },
    chat: {
      keywords: ['tell me', 'hello', 'hi', 'hey', 'what', 'who', 'where', 'when', 'summarize', 'explain briefly'],
      weight: 1
    },
    budget: {
      keywords: ['budget', 'cheap', 'free', 'cost', 'money', 'expensive', 'afford', 'tokens'],
      weight: 2
    }
  };

  const detected = {};
  for (const [problem, data] of Object.entries(problems)) {
    const matches = data.keywords.filter(kw => lower.includes(kw)).length;
    if (matches > 0) {
      detected[problem] = matches * data.weight;
    }
  }

  return detected;
}

/**
 * MODEL RECOMMENDATION ENGINE
 * Suggests best model based on problem + constraints
 */
function recommendModel(problemType) {
  // Default: Llama (free, reliable)
  if (!problemType || Object.keys(problemType).length === 0) {
    return {
      model: 'ollama/llama3.3:13b',
      reason: 'Default: Local Llama (fast, free, reliable)',
      score: 100,
      rationale: 'General purpose task - no special requirements detected'
    };
  }

  // Budget-conscious?
  if (problemType.budget && problemType.budget > 2) {
    return {
      model: 'ollama/deepseek-r1:8b',
      reason: 'FREE local reasoning',
      score: 95,
      rationale: 'Budget priority detected - using free local DeepSeek-R1',
      costSavings: 'Saves ~$0.001 vs cloud alternatives'
    };
  }

  // Slow response? Try local first, else cloud
  if (problemType.slow && problemType.slow > 1) {
    return {
      model: 'ollama/llama3.3:13b',
      reason: 'Local instant response',
      score: 90,
      rationale: 'Speed priority - using local Llama for instant results',
      speedNote: 'Runs on your Mac, no network latency'
    };
  }

  // Complex reasoning needed?
  if (problemType.reasoning && problemType.reasoning > 2) {
    return {
      model: 'ollama/deepseek-r1:8b',
      reason: 'LOCAL reasoning with chain-of-thought',
      score: 85,
      rationale: 'Complex reasoning detected - using local DeepSeek-R1 (free)',
      upgrade: 'For bigger reasoning, try: /model together/deepseek-ai/DeepSeek-V3'
    };
  }

  // Advanced reasoning or very complex?
  if (problemType.reasoning && problemType.reasoning > 4) {
    return {
      model: 'together/deepseek-ai/DeepSeek-V3',
      reason: 'Advanced reasoning + coding',
      score: 92,
      rationale: 'Very complex reasoning detected - cloud DeepSeek-V3 has stronger reasoning',
      cost: '$0.00028 per 1K tokens (~$0.28 per million)',
      freeAlternative: 'Or try: ollama/deepseek-r1:8b (free but smaller)'
    };
  }

  // Coding needed?
  if (problemType.coding && problemType.coding > 2) {
    return {
      model: 'ollama/deepseek-r1:8b',
      reason: 'Local coding with reasoning',
      score: 88,
      rationale: 'Coding task detected - DeepSeek-R1 is strong for code (free)',
      upgrade: 'For complex architecture: /model together/deepseek-ai/DeepSeek-V3',
      cost: 'Free locally, $0.00028/1K tokens for cloud'
    };
  }

  // Vision needed?
  if (problemType.vision && problemType.vision > 1) {
    return {
      model: 'anthropic/claude-haiku-4-5-20251001',
      reason: 'Vision support required',
      score: 80,
      rationale: 'Image/vision task detected - Claude Haiku has best vision',
      cost: '~$0.002 per request',
      warning: 'Local models cannot process images. Using Claude.'
    };
  }

  // Default chat
  return {
    model: 'ollama/llama3.3:13b',
    reason: 'Default chat model',
    score: 85,
    rationale: 'General chat - using fast local Llama'
  };
}

/**
 * COST TRACKER
 */
function estimateCost(model, inputTokens = 100, outputTokens = 200) {
  const m = MODELS[model];
  if (!m) return { error: 'Model not found' };

  const inputCost = (inputTokens / 1000000) * (m.cost * 1000);
  const outputCost = (outputTokens / 1000000) * (m.cost * 1000);
  const totalCost = inputCost + outputCost;

  return {
    model: m.name,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost: totalCost.toFixed(6),
    costPerMillion: `$${(m.cost * 1000).toFixed(4)}`,
    category: m.category
  };
}

/**
 * PUBLIC API
 */
module.exports = {
  detectProblem,
  recommendModel,
  estimateCost,
  MODELS,

  // Helper: Get recommendation + explanation
  suggest(userMessage) {
    const problem = detectProblem(userMessage);
    const rec = recommendModel(problem);
    const model = MODELS[rec.model];

    return {
      recommendation: rec,
      model: model,
      detectdProblems: problem,
      command: `\`/model ${rec.model.split('/')[1]}\``,
      message: `
🎯 **RECOMMENDATION:** ${rec.reason}
📌 **Why:** ${rec.rationale}
⏱️ **Speed:** ${model.speed}
💰 **Cost:** ${model.cost === 0 ? 'FREE' : `$${(model.cost * 1000).toFixed(4)}/1M tokens`}
🔧 **Coding:** ${model.coding}/10
💬 **Chat:** ${model.chat}/10
🧠 **Reasoning:** ${model.reasoning ? 'Yes' : 'No'}

Use: \`/model ${rec.model.split('/')[1]}\`
      `
    };
  }
};

// CLI usage
if (require.main === module) {
  const message = process.argv[2] || 'tell me about machine learning';
  const result = module.exports.suggest(message);
  console.log(result.message);
  console.log('Details:', JSON.stringify(result, null, 2));
}

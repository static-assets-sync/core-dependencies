#!/bin/bash

# Ollama Setup for OpenClaw
# Installs Ollama + pulls optimized models for 24GB Mac

echo "🦙 OLLAMA SETUP FOR 24GB MAC"
echo "===================================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
  echo "📥 Installing Ollama..."
  curl -fsSL https://ollama.ai/install.sh | sh
  echo "✅ Ollama installed"
else
  echo "✅ Ollama already installed"
fi

echo ""
echo "📍 Starting Ollama service..."
# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "   Starting ollama serve in background..."
  ollama serve &
  sleep 3
else
  echo "✅ Ollama already running"
fi

echo ""
echo "🎯 Pulling optimized models for 24GB RAM..."
echo ""

echo "   1️⃣  Llama 3.3 13B (Main workhorse - ~15GB)..."
ollama pull llama3.3:13b
echo "      ✅ Llama 3.3 13B ready"

echo ""
echo "   2️⃣  DeepSeek-R1 8B (Reasoning - ~8GB)..."
ollama pull deepseek-r1:8b
echo "      ✅ DeepSeek-R1 8B ready"

echo ""
echo "===================================="
echo "✅ OLLAMA SETUP COMPLETE"
echo "===================================="
echo ""
echo "Models installed:"
ollama list
echo ""
echo "📊 Verify Ollama is running:"
curl http://localhost:11434/api/tags | jq '.models[].name' 2>/dev/null || echo "   curl check failed (Ollama may still be starting)"
echo ""
echo "🚀 Next step: Run OpenClaw with new config"
echo "   openclaw gateway --port 18789"
echo ""

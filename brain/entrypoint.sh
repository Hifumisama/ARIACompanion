#!/bin/bash
set -e

# Start Ollama server in background
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
until curl -s http://localhost:11434/ > /dev/null 2>&1; do
    sleep 1
done
echo "Ollama is ready."

# Pull the model if not already present
MODEL="${OLLAMA_MODEL:-gemma3:1b}"
echo "Pulling model: $MODEL ..."
ollama pull "$MODEL"
echo "Model $MODEL is ready."

# Keep the server running
wait

#!/bin/bash
set -e

MODEL_PATH="/models/${MODEL_FILE:-model.gguf}"

if [ ! -f "$MODEL_PATH" ]; then
    echo "ERROR: Model file not found at $MODEL_PATH"
    echo "Please download a GGUF model and place it in brain/models/"
    echo "Example: huggingface-cli download bartowski/gemma-2-2b-it-GGUF --include 'gemma-2-2b-it-Q4_K_M.gguf' --local-dir brain/models/"
    exit 1
fi

echo "Starting llama-server with model: $MODEL_PATH"
exec llama-server \
    -m "$MODEL_PATH" \
    --host 0.0.0.0 \
    --port 8080 \
    -ngl "${GPU_LAYERS:-0}" \
    -c "${CONTEXT_SIZE:-4096}" \
    --threads "${THREADS:-4}"

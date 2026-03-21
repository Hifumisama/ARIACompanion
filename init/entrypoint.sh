#!/bin/bash
set -e

MODEL_FILE="${MODEL_FILE:-hades-v1.gguf}"
LLM_REPO_ID="${LLM_REPO_ID:-Hifumisama/hades-finetune-llm-gguf}"

# ── LLM model ───────────────────────────────────────────────────────────────
if [ -f "/models/llm/$MODEL_FILE" ]; then
    echo "[init] LLM model already present: $MODEL_FILE"
else
    echo "[init] Downloading LLM model from $LLM_REPO_ID / $MODEL_FILE ..."
    python3 -c "
from huggingface_hub import hf_hub_download
hf_hub_download(
    repo_id='${LLM_REPO_ID}',
    filename='${MODEL_FILE}',
    local_dir='/models/llm',
)
print('[init] LLM model downloaded.')
"
fi

echo "[init] Models ready!"

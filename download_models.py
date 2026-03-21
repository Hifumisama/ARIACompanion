"""
Download required models from Hugging Face Hub.

Usage:
    pip install huggingface_hub
    python download_models.py            # download all models
    python download_models.py --llm      # download LLM only
    python download_models.py --whisper  # download Whisper only
"""

import argparse
import os
import sys
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"

# ── Model registry ──────────────────────────────────────────────────────────
MODELS = {
    "llm": {
        "repo_id": os.getenv("LLM_REPO_ID", "Hifumisama/hades-finetune-llm-gguf"),
        "filename": os.getenv("MODEL_FILE", "hades-v1.gguf"),
        "dest": MODELS_DIR / "llm",
        "description": "LLM (GGUF)",
    },
    "whisper": {
        "repo_id": os.getenv("WHISPER_REPO_ID", "Systran/faster-whisper-small"),
        "dest": MODELS_DIR / "whisper",
        "description": "Whisper STT",
    },
}


def download_llm(info: dict) -> None:
    from huggingface_hub import hf_hub_download

    dest = info["dest"]
    dest.mkdir(parents=True, exist_ok=True)

    target = dest / info["filename"]
    if target.exists():
        print(f"  [skip] {target} already exists")
        return

    print(f"  Downloading {info['repo_id']} / {info['filename']} ...")
    hf_hub_download(
        repo_id=info["repo_id"],
        filename=info["filename"],
        local_dir=str(dest),
    )
    print(f"  -> saved to {dest / info['filename']}")


def download_whisper(info: dict) -> None:
    from huggingface_hub import snapshot_download

    dest = info["dest"]
    dest.mkdir(parents=True, exist_ok=True)

    # faster-whisper uses the HF cache layout; download the whole repo snapshot
    print(f"  Downloading {info['repo_id']} ...")
    snapshot_download(
        repo_id=info["repo_id"],
        local_dir=str(dest / info["repo_id"].replace("/", "--")),
    )
    print(f"  -> saved to {dest}")


DOWNLOADERS = {
    "llm": download_llm,
    "whisper": download_whisper,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Download ARIA models from Hugging Face")
    parser.add_argument("--llm", action="store_true", help="Download LLM model only")
    parser.add_argument("--whisper", action="store_true", help="Download Whisper model only")
    args = parser.parse_args()

    # If no flag is set, download everything
    selected = []
    if args.llm:
        selected.append("llm")
    if args.whisper:
        selected.append("whisper")
    if not selected:
        selected = list(MODELS.keys())

    try:
        import huggingface_hub  # noqa: F401
    except ImportError:
        print("huggingface_hub is required. Install it with:")
        print("  pip install huggingface_hub")
        sys.exit(1)

    for key in selected:
        info = MODELS[key]
        print(f"\n{'='*50}")
        print(f"  {info['description']}  ({info['repo_id']})")
        print(f"{'='*50}")
        DOWNLOADERS[key](info)

    print("\nAll done!")


if __name__ == "__main__":
    main()

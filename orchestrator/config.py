import os


BRAIN_URL = os.getenv("BRAIN_URL", "http://localhost:8080")

# Path to Aria's system prompt
SYSTEM_PROMPT_PATH = os.getenv("SYSTEM_PROMPT_PATH", "/prompts/aria.txt")

# Memory settings
MEMORY_FILE = os.getenv("MEMORY_FILE", "/app/data/memory.json")
SUMMARY_INTERVAL = int(os.getenv("SUMMARY_INTERVAL", "10"))

# STT (Whisper) settings
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "fr")

# TTS (Piper) settings
PIPER_MODEL_PATH = os.getenv("PIPER_MODEL_PATH", "/models/piper/model.onnx")
PIPER_CONFIG_PATH = os.getenv("PIPER_CONFIG_PATH", "/models/piper/model.onnx.json")

# Fallback system prompt if file not found
DEFAULT_SYSTEM_PROMPT = (
    "Tu es Aria, une IA compagnon au ton direct et sarcastique mais bienveillant. "
    "Réponds TOUJOURS en JSON : "
    '{"text": "...", "emotion": "...", "tone": "..."}'
)

import os

BRAIN_URL = os.getenv("BRAIN_URL", "http://aria-brain-models:11434")
VOICE_URL = os.getenv("VOICE_URL", "http://aria-voice:8000")
CHARACTER_FORGE_URL = os.getenv("CHARACTER_FORGE_URL", "http://aria-character-forge-backend:8000")

ACTIVE_CHARACTER_ID = os.getenv("ACTIVE_CHARACTER_ID", "")

# Ollama model name
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# TTS WebSocket streaming chunk size (bytes)
TTS_CHUNK_SIZE = int(os.getenv("TTS_CHUNK_SIZE", "16384"))

# Interruption keywords (comma-separated)
INTERRUPTION_KEYWORDS = os.getenv("INTERRUPTION_KEYWORDS", "stop,arrête,tais-toi")

# Fallback system prompt if no character is configured
DEFAULT_SYSTEM_PROMPT = (
    "Tu es Aria, une IA compagnon au ton direct et sarcastique mais bienveillant. "
    "Réponds TOUJOURS en JSON : "
    '{"text": "...", "emotion": "...", "tone": "..."}'
)

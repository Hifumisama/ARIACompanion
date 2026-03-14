import os


BRAIN_URL = os.getenv("BRAIN_URL", "http://localhost:11434")
MEMORY_URL = os.getenv("MEMORY_URL", "http://localhost:8001")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:1b")

# Path to Aria's system prompt
SYSTEM_PROMPT_PATH = os.getenv("SYSTEM_PROMPT_PATH", "/prompts/aria.txt")

# Fallback system prompt if file not found
DEFAULT_SYSTEM_PROMPT = (
    "Tu es Aria, une IA compagnon au ton direct et sarcastique mais bienveillant. "
    "Réponds TOUJOURS en JSON : "
    '{"text": "...", "emotion": "...", "intensity": 0.0-1.0, "tone": "..."}'
)

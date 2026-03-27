import os

# STT (Whisper) settings
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "fr")
WHISPER_MODEL_DIR = os.getenv("WHISPER_MODEL_DIR", "/app/models/whisper")

# TTS (Piper) settings
PIPER_MODEL_PATH = os.getenv("PIPER_MODEL_PATH", "/app/models/piper/model.onnx")
PIPER_CONFIG_PATH = os.getenv("PIPER_CONFIG_PATH", "/app/models/piper/model.onnx.json")

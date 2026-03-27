import io
import wave
import logging
from piper import PiperVoice

from config import PIPER_MODEL_PATH, PIPER_CONFIG_PATH

logger = logging.getLogger("aria.tts")

_voice: PiperVoice | None = None


def get_voice() -> PiperVoice:
    global _voice
    if _voice is None:
        logger.info("Loading Piper voice from '%s'...", PIPER_MODEL_PATH)
        _voice = PiperVoice.load(PIPER_MODEL_PATH, config_path=PIPER_CONFIG_PATH)
        logger.info("Piper voice ready.")
    return _voice


def synthesize(text: str) -> bytes:
    """Synthesize text to WAV audio bytes using Piper."""
    voice = get_voice()
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        voice.synthesize(text, wav_file)
    audio_bytes = buffer.getvalue()
    logger.info("Synthesized %d bytes of audio for: %s", len(audio_bytes), text[:80])
    return audio_bytes

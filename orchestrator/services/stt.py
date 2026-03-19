import io
import logging
from faster_whisper import WhisperModel

from config import WHISPER_MODEL, WHISPER_LANGUAGE, WHISPER_MODEL_DIR

logger = logging.getLogger("aria.stt")

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        logger.info("Loading Whisper model '%s' (CPU, int8)...", WHISPER_MODEL)
        _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8", download_root=WHISPER_MODEL_DIR)
        logger.info("Whisper model ready.")
    return _model


def transcribe(audio_bytes: bytes) -> str:
    """Transcribe audio bytes to text using faster-whisper."""
    model = get_model()
    segments, info = model.transcribe(
        io.BytesIO(audio_bytes),
        language=WHISPER_LANGUAGE,
        vad_filter=True,
    )
    text = " ".join(segment.text.strip() for segment in segments)
    logger.info("Transcribed (%s, %.1fs): %s", info.language, info.duration, text[:100])
    return text

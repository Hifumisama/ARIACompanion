import logging

import httpx

from config import VOICE_URL

logger = logging.getLogger("aria.voice-client")


async def transcribe(audio_bytes: bytes) -> str:
    """Call aria-voice STT endpoint."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{VOICE_URL}/stt",
            files={"file": ("audio.wav", audio_bytes, "audio/wav")},
        )
        response.raise_for_status()
        data = response.json()
        text = data.get("text", "")
        logger.info("STT result: %s", text[:100])
        return text


async def synthesize(text: str) -> bytes:
    """Call aria-voice TTS endpoint."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{VOICE_URL}/tts",
            json={"text": text},
        )
        response.raise_for_status()
        logger.info("TTS synthesized %d bytes", len(response.content))
        return response.content

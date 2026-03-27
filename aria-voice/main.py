import asyncio
import logging

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import Response

from services import stt, tts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aria.voice")

app = FastAPI(
    title="ARIA Voice",
    description="Service STT (Speech-to-Text) et TTS (Text-to-Speech) pour ARIACompanion.",
    version="1.0.0",
)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "aria-voice"}


@app.post(
    "/stt",
    tags=["STT"],
    summary="Transcrire un fichier audio en texte",
    response_description="Texte transcrit",
)
async def speech_to_text(file: UploadFile = File(..., description="Fichier audio (WAV, WebM, etc.)")):
    """Transcrit un fichier audio uploadé en texte via Whisper."""
    audio_bytes = await file.read()
    text = await asyncio.to_thread(stt.transcribe, audio_bytes)
    return {"text": text}


@app.post(
    "/tts",
    tags=["TTS"],
    summary="Synthétiser du texte en audio WAV",
    response_description="Fichier audio WAV",
    response_class=Response,
    responses={
        200: {"content": {"audio/wav": {}}, "description": "Audio WAV synthétisé"},
        400: {"description": "Champ 'text' manquant ou vide"},
    },
)
async def text_to_speech(body: dict):
    """Synthétise du texte en audio WAV via Piper TTS."""
    text = body.get("text", "")
    if not text:
        return Response(status_code=400, content="Missing 'text' field")
    audio_bytes = await asyncio.to_thread(tts.synthesize, text)
    return Response(content=audio_bytes, media_type="audio/wav")

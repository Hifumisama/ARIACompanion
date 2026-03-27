import asyncio
import json
import logging
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import TTS_CHUNK_SIZE
from pipeline import process_message, process_message_stream, reload_system_prompt
from services import voice
from services.interruption import InterruptionService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aria")

app = FastAPI(
    title="ARIA Orchestrator",
    description="Coordinateur central d'ARIACompanion. "
                "Gère le WebSocket avec le frontend et coordonne les appels vers "
                "aria-brain-models (LLM), aria-voice (STT/TTS) et aria-character-forge.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "aria-orchestrator"}


@app.post("/reload-prompt", tags=["Config"], summary="Recharger le system prompt depuis character-forge")
async def reload_prompt():
    prompt = await reload_system_prompt()
    return {"status": "reloaded", "length": len(prompt)}


async def _stream_response(ws: WebSocket, user_message: str, tts_enabled: bool):
    """Stream LLM response to client, then optionally send TTS audio."""
    response_text = None
    try:
        async for event in process_message_stream(user_message):
            await ws.send_json(event)
            if event.get("type") == "response":
                response_text = event.get("text")
    except asyncio.CancelledError:
        logger.info("Generation cancelled for: %s", user_message[:60])
        await ws.send_json({"type": "interrupted", "reason": "cancelled"})
        return

    if tts_enabled and response_text:
        await _send_tts(ws, response_text)


async def _send_tts(ws: WebSocket, text: str):
    """Synthesize TTS via aria-voice and send audio as binary chunks over WebSocket."""
    request_id = str(uuid.uuid4())
    try:
        audio_bytes = await voice.synthesize(text)
        await ws.send_json({"type": "tts_start", "request_id": request_id})
        for i in range(0, len(audio_bytes), TTS_CHUNK_SIZE):
            await ws.send_bytes(audio_bytes[i : i + TTS_CHUNK_SIZE])
        await ws.send_json({"type": "tts_end", "request_id": request_id})
    except asyncio.CancelledError:
        logger.info("TTS cancelled")
    except Exception:
        logger.exception("TTS streaming error")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("Client connected")

    current_task: asyncio.Task | None = None
    pending_audio_format: str | None = None
    tts_enabled = False
    interruption = InterruptionService()

    # Greeting
    try:
        await ws.send_json({"type": "status", "status": "thinking"})
        greeting = await process_message(
            "[SYSTÈME] Une nouvelle âme perdue vient d'arriver dans ton bureau. "
            "Accueille-la à ta manière. C'est ta première impression, sois mémorable."
        )
        await ws.send_json({
            "type": "response",
            "text": greeting["text"],
            "emotion": greeting["emotion"],
            "tone": greeting["tone"],
        })
    except Exception:
        logger.exception("Greeting error")

    async def _cancel_current():
        nonlocal current_task
        if current_task and not current_task.done():
            current_task.cancel()
            try:
                await current_task
            except asyncio.CancelledError:
                pass

    try:
        while True:
            message = await ws.receive()

            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    await ws.send_json({"type": "error", "message": "Invalid JSON"})
                    continue

                msg_type = data.get("type")

                if msg_type == "message" and data.get("content"):
                    user_message = data["content"]
                    logger.info("User: %s", user_message[:100])
                    await _cancel_current()
                    current_task = asyncio.create_task(
                        _stream_response(ws, user_message, tts_enabled)
                    )

                elif msg_type == "audio":
                    pending_audio_format = data.get("format", "wav")

                elif msg_type == "interrupt":
                    reason = data.get("reason", "manual")
                    logger.info("Interrupt requested: %s", reason)
                    await _cancel_current()
                    await ws.send_json({"type": "interrupted", "reason": reason})

                elif msg_type == "control":
                    action = data.get("action")
                    if action == "tts_enable":
                        tts_enabled = True
                    elif action == "tts_disable":
                        tts_enabled = False

                else:
                    await ws.send_json({"type": "error", "message": "Unknown message type"})

            elif "bytes" in message:
                if pending_audio_format:
                    audio_bytes = message["bytes"]
                    fmt = pending_audio_format
                    pending_audio_format = None
                    logger.info("Received audio (%d bytes, format=%s)", len(audio_bytes), fmt)

                    # Transcribe via aria-voice
                    text = await voice.transcribe(audio_bytes)

                    # Check for interruption keywords
                    result = interruption.check(text)
                    if result:
                        keyword, action = result
                        logger.info("Keyword '%s' detected -> %s", keyword, action)
                        if action == "stop_generation":
                            await _cancel_current()
                            await ws.send_json({"type": "interrupted", "reason": "keyword"})
                    elif text.strip():
                        await ws.send_json({"type": "stt_result", "text": text})

    except WebSocketDisconnect:
        logger.info("Client disconnected")
        if current_task and not current_task.done():
            current_task.cancel()

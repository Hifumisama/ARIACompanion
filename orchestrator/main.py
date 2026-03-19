import json
import logging

from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from pipeline import process_message
from services.memory import memory
from services import stt, tts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aria")

app = FastAPI(title="ARIA Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "orchestrator"}


@app.delete("/memory/purge")
def purge_memory():
    """Purge all conversation memory."""
    memory.purge()
    return {"status": "purged"}


@app.post("/stt")
async def speech_to_text(file: UploadFile):
    """Transcribe uploaded audio to text."""
    audio_bytes = await file.read()
    text = stt.transcribe(audio_bytes)
    return {"text": text}


@app.post("/tts")
async def text_to_speech(body: dict):
    """Synthesize text to WAV audio."""
    text = body.get("text", "")
    if not text:
        return Response(status_code=400, content="Missing 'text' field")
    audio_bytes = tts.synthesize(text)
    return Response(content=audio_bytes, media_type="audio/wav")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("Client connected")

    # Hadès accueille l'âme perdue
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
    except Exception as e:
        logger.exception("Greeting error")

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            if data.get("type") != "message" or not data.get("content"):
                await ws.send_json({"type": "error", "message": "Expected {type: 'message', content: '...'}"})
                continue

            user_message = data["content"]
            logger.info("User: %s", user_message[:100])

            # Send thinking status
            await ws.send_json({"type": "status", "status": "thinking"})

            try:
                response = await process_message(user_message)
                await ws.send_json({
                    "type": "response",
                    "text": response["text"],
                    "emotion": response["emotion"],
                    "tone": response["tone"],
                })
            except Exception as e:
                logger.exception("Pipeline error")
                await ws.send_json({"type": "error", "message": str(e)})

    except WebSocketDisconnect:
        logger.info("Client disconnected")

import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import httpx

from config import MEMORY_URL
from pipeline import process_message

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
async def purge_memory():
    """Proxy purge request to memory service."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(f"{MEMORY_URL}/memory/purge")
        resp.raise_for_status()
        return resp.json()


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
            "intensity": greeting["intensity"],
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
                    "intensity": response["intensity"],
                    "tone": response["tone"],
                })
            except Exception as e:
                logger.exception("Pipeline error")
                await ws.send_json({"type": "error", "message": str(e)})

    except WebSocketDisconnect:
        logger.info("Client disconnected")

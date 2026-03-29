import json
import logging
from collections.abc import AsyncGenerator

import httpx

from config import BRAIN_URL, OLLAMA_MODEL

logger = logging.getLogger("aria.brain")

_GENERATION_OPTIONS = {
    "temperature": 0.9,
    "top_p": 0.9,
    "top_k": 50,
    "repeat_penalty": 1.15,
}


def _build_messages(prompt: str, system: str) -> list[dict]:
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]


async def generate(prompt: str, system: str) -> str:
    """Call Ollama native chat API (non-streaming)."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BRAIN_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": _build_messages(prompt, system),
                "options": _GENERATION_OPTIONS,
                "format": "json",
                "stream": False,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"]


async def generate_stream(prompt: str, system: str) -> AsyncGenerator[str, None]:
    """Stream tokens from Ollama native chat API (NDJSON)."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{BRAIN_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": _build_messages(prompt, system),
                "options": _GENERATION_OPTIONS,
                "format": "json",
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    if chunk.get("done"):
                        break
                    content = chunk.get("message", {}).get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError):
                    logger.debug("Skipping malformed NDJSON chunk: %s", line[:100])

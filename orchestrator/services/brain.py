import httpx

from config import BRAIN_URL, OLLAMA_MODEL


async def generate(prompt: str, system: str) -> str:
    """Call Ollama Chat API with proper message roles."""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BRAIN_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.9,
                    "top_p": 0.9,
                    "top_k": 50,
                    "repeat_penalty": 1.15,
                    "repeat_last_n": 64,
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "")

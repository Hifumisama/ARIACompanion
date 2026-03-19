import httpx

from config import BRAIN_URL


async def generate(prompt: str, system: str) -> str:
    """Call llama-server via OpenAI-compatible Chat API."""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BRAIN_URL}/v1/chat/completions",
            json={
                "messages": messages,
                "temperature": 0.9,
                "top_p": 0.9,
                "top_k": 50,
                "repeat_penalty": 1.15,
                "response_format": {"type": "json_object"},
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

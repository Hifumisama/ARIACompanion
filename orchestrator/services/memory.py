import httpx

from config import MEMORY_URL


async def store(text: str, role: str = "user") -> dict:
    """Store a message in memory."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{MEMORY_URL}/memory/store",
            json={"text": text, "role": role},
        )
        resp.raise_for_status()
        return resp.json()


async def search(query: str, n_results: int = 3) -> list[dict]:
    """Search memory for relevant context."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{MEMORY_URL}/memory/search",
            json={"query": query, "n_results": n_results},
        )
        resp.raise_for_status()
        return resp.json().get("results", [])


async def get_recent(limit: int = 5) -> list[dict]:
    """Get recent messages."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{MEMORY_URL}/memory/recent",
            params={"limit": limit},
        )
        resp.raise_for_status()
        return resp.json().get("messages", [])


async def store_background(fact: str, category: str = "general") -> dict:
    """Store a long-term fact about the user."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{MEMORY_URL}/memory/background",
            json={"fact": fact, "category": category},
        )
        resp.raise_for_status()
        return resp.json()

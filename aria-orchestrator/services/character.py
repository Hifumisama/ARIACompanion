import logging

import httpx

from config import CHARACTER_FORGE_URL

logger = logging.getLogger("aria.character-client")


async def get_system_prompt(character_id: str) -> str:
    """Fetch system prompt from aria-character-forge."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{CHARACTER_FORGE_URL}/api/characters/{character_id}/system-prompt",
        )
        response.raise_for_status()
        data = response.json()
        prompt = data.get("prompt", "")
        logger.info("Loaded system prompt for character %s (%d chars)", character_id, len(prompt))
        return prompt


async def get_character(character_id: str) -> dict:
    """Fetch character data from aria-character-forge."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{CHARACTER_FORGE_URL}/api/characters/{character_id}",
        )
        response.raise_for_status()
        return response.json()

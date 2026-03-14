import json
import logging
import pathlib

from config import DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_PATH
from services import brain, memory

logger = logging.getLogger("aria.pipeline")


def load_system_prompt() -> str:
    """Load Aria's system prompt from file, falling back to default."""
    path = pathlib.Path(SYSTEM_PROMPT_PATH)
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return DEFAULT_SYSTEM_PROMPT


SYSTEM_PROMPT = load_system_prompt()
logger.info("System prompt loaded (%d chars): %s...", len(SYSTEM_PROMPT), SYSTEM_PROMPT[:80])


def build_context_prompt(
    user_message: str,
    recent: list[dict],
) -> str:
    """Build the full prompt with recent conversation context."""
    parts: list[str] = []

    if recent:
        parts.append("=== Conversation récente ===")
        for msg in reversed(recent):
            role = msg.get("metadata", {}).get("role", "?")
            parts.append(f"[{role}] {msg['text']}")

    parts.append(f"\n[user] {user_message}")
    return "\n".join(parts)


def parse_response(raw: str) -> dict:
    """Parse the JSON response from the LLM. Handle common issues."""
    raw = raw.strip()
    # Try to extract JSON if wrapped in markdown code blocks
    if raw.startswith("```"):
        lines = raw.split("\n")
        json_lines = []
        inside = False
        for line in lines:
            if line.startswith("```") and not inside:
                inside = True
                continue
            if line.startswith("```") and inside:
                break
            if inside:
                json_lines.append(line)
        raw = "\n".join(json_lines)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM response as JSON: %s", raw[:200])
        data = {
            "text": raw,
            "emotion": "neutral",
            "intensity": 0.5,
            "tone": "fallback",
        }

    # Ensure all expected keys exist
    data.setdefault("text", "...")
    data.setdefault("emotion", "neutral")
    data.setdefault("intensity", 0.5)
    data.setdefault("tone", "neutral")
    return data


async def process_message(user_message: str) -> dict:
    """Full pipeline: memory lookup → LLM call → memory store → return."""
    # 1. Get recent conversation for context
    recent = await memory.get_recent(limit=10)

    # 2. Build prompt (recent messages only, no RAG search for now)
    prompt = build_context_prompt(user_message, recent)

    # 3. Call the LLM
    raw_response = await brain.generate(prompt=prompt, system=SYSTEM_PROMPT)

    # 4. Parse the response
    response = parse_response(raw_response)

    # 5. Store user message + aria's response in memory
    await memory.store(user_message, role="user")
    await memory.store(response["text"], role="aria")

    return response

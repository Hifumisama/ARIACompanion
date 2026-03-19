import json
import logging
import pathlib

from config import DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_PATH
from services import brain
from services.memory import memory

logger = logging.getLogger("aria.pipeline")


def load_system_prompt() -> str:
    """Load Aria's system prompt from file, falling back to default."""
    path = pathlib.Path(SYSTEM_PROMPT_PATH)
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return DEFAULT_SYSTEM_PROMPT


SYSTEM_PROMPT = load_system_prompt()
logger.info("System prompt loaded (%d chars): %s...", len(SYSTEM_PROMPT), SYSTEM_PROMPT[:80])

SUMMARY_PROMPT = (
    "Tu es un assistant qui résume des conversations. "
    "Produis un résumé concis en français qui conserve : "
    "les informations clés sur l'utilisateur, le contexte important, "
    "les décisions prises, et le ton de la relation. "
    "Réponds UNIQUEMENT avec le résumé, sans formatage JSON."
)


def build_context_prompt(
    user_message: str,
    context: dict,
) -> str:
    """Build the full prompt with summary + recent conversation context."""
    parts: list[str] = []

    if context["summary"]:
        parts.append("=== Résumé de la conversation ===")
        parts.append(context["summary"])
        parts.append("")

    if context["recent"]:
        parts.append("=== Messages récents ===")
        for msg in context["recent"]:
            parts.append(f"[{msg['role']}] {msg['text']}")

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
            "emotion": "calm",
            "tone": "fallback",
        }

    # Ensure all expected keys exist
    data.setdefault("text", "...")
    data.setdefault("emotion", "calm")
    data.setdefault("tone", "neutral")
    return data


async def maybe_summarize():
    """If enough messages have accumulated, generate a sliding summary."""
    if not memory.needs_summary():
        return

    logger.info("Generating conversation summary...")
    context = memory.get_context()

    # Build the text to summarize
    parts = []
    if context["summary"]:
        parts.append(f"Résumé précédent : {context['summary']}")
    parts.append("Messages à intégrer :")
    for msg in memory.messages:
        parts.append(f"[{msg['role']}] {msg['text']}")

    summary_input = "\n".join(parts)

    try:
        raw_summary = await brain.generate(prompt=summary_input, system=SUMMARY_PROMPT)
        # The summary response is plain text, not JSON
        new_summary = raw_summary.strip()
        # If the LLM wrapped it in JSON anyway, extract the text
        if new_summary.startswith("{"):
            try:
                parsed = json.loads(new_summary)
                new_summary = parsed.get("text", parsed.get("summary", new_summary))
            except json.JSONDecodeError:
                pass
        memory.update_summary(new_summary)
    except Exception as e:
        logger.warning("Failed to generate summary: %s", e)


async def process_message(user_message: str) -> dict:
    """Full pipeline: memory context → LLM call → memory store → return."""
    # 1. Get conversation context (summary + recent messages)
    context = memory.get_context()

    # 2. Build prompt with context
    prompt = build_context_prompt(user_message, context)

    # 3. Call the LLM
    raw_response = await brain.generate(prompt=prompt, system=SYSTEM_PROMPT)

    # 4. Parse the response
    response = parse_response(raw_response)

    # 5. Store user message + aria's response in memory
    memory.store(user_message, role="user")
    memory.store(response["text"], role="aria")

    # 6. Generate summary if needed
    await maybe_summarize()

    return response

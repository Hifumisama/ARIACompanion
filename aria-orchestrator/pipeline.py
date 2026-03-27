import json
import logging
import re
from collections.abc import AsyncGenerator

from config import ACTIVE_CHARACTER_ID, DEFAULT_SYSTEM_PROMPT
from services import brain, character

logger = logging.getLogger("aria.pipeline")

# Cached system prompt (loaded on first request)
_system_prompt: str | None = None


async def get_system_prompt() -> str:
    """Load system prompt from character-forge, or use default fallback."""
    global _system_prompt
    if _system_prompt is not None:
        return _system_prompt

    if ACTIVE_CHARACTER_ID:
        try:
            _system_prompt = await character.get_system_prompt(ACTIVE_CHARACTER_ID)
            logger.info("System prompt loaded from character '%s' (%d chars)", ACTIVE_CHARACTER_ID, len(_system_prompt))
            return _system_prompt
        except Exception as e:
            logger.warning("Failed to load character prompt: %s. Using default.", e)

    _system_prompt = DEFAULT_SYSTEM_PROMPT
    return _system_prompt


async def reload_system_prompt() -> str:
    """Force reload the system prompt from character-forge."""
    global _system_prompt
    _system_prompt = None
    return await get_system_prompt()


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

    data.setdefault("text", "...")
    data.setdefault("emotion", "calm")
    data.setdefault("tone", "neutral")
    return data


class _JsonTextExtractor:
    """Streaming parser that extracts the value of the "text" field from a
    JSON object being received token by token.

    States:
      - BEFORE_TEXT: buffering until we find `"text"` key and its opening quote
      - IN_TEXT: yielding characters that belong to the text value
      - AFTER_TEXT: text field closed, just accumulating the rest
    """

    BEFORE_TEXT = 0
    IN_TEXT = 1
    AFTER_TEXT = 2

    def __init__(self):
        self._state = self.BEFORE_TEXT
        self._buffer = ""
        self._escape = False

    def feed(self, chunk: str) -> str:
        """Feed a chunk of tokens. Returns extractable text content (may be empty)."""
        if self._state == self.AFTER_TEXT:
            self._buffer += chunk
            return ""

        result = []
        for ch in chunk:
            if self._state == self.BEFORE_TEXT:
                self._buffer += ch
                stripped = self._buffer.lstrip()
                if _ends_with_text_value_start(stripped):
                    self._state = self.IN_TEXT
                    self._escape = False

            elif self._state == self.IN_TEXT:
                if self._escape:
                    escape_map = {"n": "\n", "t": "\t", "r": "\r", '"': '"', "\\": "\\", "/": "/"}
                    result.append(escape_map.get(ch, ch))
                    self._escape = False
                elif ch == "\\":
                    self._escape = True
                elif ch == '"':
                    self._state = self.AFTER_TEXT
                    self._buffer = ""
                else:
                    result.append(ch)

        return "".join(result)

    @property
    def done(self) -> bool:
        return self._state == self.AFTER_TEXT


def _ends_with_text_value_start(s: str) -> bool:
    """Check if the buffer ends with the pattern `"text" : "` (opening of the text value)."""
    return bool(re.search(r'"text"\s*:\s*"$', s))


async def process_message(user_message: str) -> dict:
    """Full pipeline: LLM call -> return parsed response."""
    system = await get_system_prompt()
    raw_response = await brain.generate(prompt=user_message, system=system)
    return parse_response(raw_response)


async def process_message_stream(user_message: str) -> AsyncGenerator[dict, None]:
    """Streaming pipeline: yields status, token, and final response events."""
    system = await get_system_prompt()

    yield {"type": "status", "status": "streaming"}

    extractor = _JsonTextExtractor()
    full_raw = ""
    seq = 0

    async for token in brain.generate_stream(prompt=user_message, system=system):
        full_raw += token
        text_content = extractor.feed(token)
        if text_content:
            yield {"type": "token", "text": text_content, "seq": seq}
            seq += 1

    response = parse_response(full_raw)

    yield {
        "type": "response",
        "text": response["text"],
        "emotion": response["emotion"],
        "tone": response["tone"],
    }

import logging

from config import INTERRUPTION_KEYWORDS

logger = logging.getLogger("aria.interruption")


class InterruptionService:
    """Extensible keyword-based interruption service.

    Maps keywords to action strings. When transcribed speech matches a keyword,
    the associated action is returned for the caller to handle.
    """

    def __init__(self):
        self._handlers: dict[str, str] = {}
        self._register_defaults()

    def _register_defaults(self):
        for keyword in INTERRUPTION_KEYWORDS.split(","):
            keyword = keyword.strip()
            if keyword:
                self.register(keyword, "stop_generation")

    def register(self, keyword: str, action: str):
        """Register a keyword -> action mapping."""
        self._handlers[keyword.lower()] = action
        logger.debug("Registered keyword '%s' -> '%s'", keyword, action)

    def unregister(self, keyword: str):
        """Remove a keyword mapping."""
        self._handlers.pop(keyword.lower(), None)

    def check(self, text: str) -> tuple[str, str] | None:
        """Check if transcribed text contains an interruption keyword.

        Returns (keyword, action) if found, None otherwise.
        Only triggers if the text is short (likely a command, not conversation).
        """
        text_lower = text.lower().strip()
        if not text_lower:
            return None

        words = text_lower.split()
        if len(words) > 5:
            return None

        for keyword, action in self._handlers.items():
            if keyword in text_lower:
                return (keyword, action)
        return None

    @property
    def keywords(self) -> list[str]:
        """List all registered keywords."""
        return list(self._handlers.keys())

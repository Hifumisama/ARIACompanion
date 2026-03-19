import json
import logging
import pathlib

from config import MEMORY_FILE, SUMMARY_INTERVAL

logger = logging.getLogger("aria.memory")


class ConversationMemory:
    """Local conversation memory with sliding summary.

    Keeps recent messages in a list and periodically asks the LLM
    to produce a summary. Everything is persisted to a JSON file.
    """

    def __init__(self):
        self._path = pathlib.Path(MEMORY_FILE)
        self.messages: list[dict] = []
        self.summary: str = ""
        self._load()

    def _load(self):
        if self._path.exists():
            try:
                data = json.loads(self._path.read_text(encoding="utf-8"))
                self.messages = data.get("messages", [])
                self.summary = data.get("summary", "")
                logger.info("Memory loaded: %d messages, summary=%d chars",
                            len(self.messages), len(self.summary))
            except (json.JSONDecodeError, OSError) as e:
                logger.warning("Failed to load memory file: %s", e)

    def _save(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps({
                "messages": self.messages,
                "summary": self.summary,
            }, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def store(self, text: str, role: str):
        """Store a message in the conversation history."""
        self.messages.append({"role": role, "text": text})
        self._save()

    def get_context(self) -> dict:
        """Return current summary + recent messages for prompt building."""
        return {
            "summary": self.summary,
            "recent": self.messages[-10:],
        }

    def needs_summary(self) -> bool:
        """Check if we've accumulated enough messages to warrant a new summary."""
        return (len(self.messages) >= SUMMARY_INTERVAL
                and len(self.messages) % SUMMARY_INTERVAL == 0)

    def update_summary(self, new_summary: str):
        """Replace the summary and trim old messages."""
        self.summary = new_summary
        # Keep only the last few messages as raw context after summarizing
        self.messages = self.messages[-6:]
        self._save()
        logger.info("Summary updated (%d chars), trimmed to %d messages",
                     len(new_summary), len(self.messages))

    def purge(self):
        """Wipe all memory."""
        self.messages = []
        self.summary = ""
        self._save()
        logger.info("Memory purged")


memory = ConversationMemory()

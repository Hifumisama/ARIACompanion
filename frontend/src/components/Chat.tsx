import { useEffect, useRef, useState } from "react";
import type { Message, ServerMessage } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { EmotionIndicator } from "./EmotionIndicator";

export function Chat() {
  const { connected, lastMessage, sendMessage } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState({
    emotion: "calm",
    intensity: 0.5,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "status") {
      setThinking(lastMessage.status === "thinking");
      return;
    }

    if (lastMessage.type === "response") {
      setThinking(false);
      setCurrentEmotion({
        emotion: lastMessage.emotion,
        intensity: lastMessage.intensity,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "aria",
          text: lastMessage.text,
          emotion: lastMessage.emotion,
          intensity: lastMessage.intensity,
          tone: lastMessage.tone,
          timestamp: Date.now(),
        },
      ]);
    }

    if (lastMessage.type === "error") {
      setThinking(false);
    }
  }, [lastMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        text,
        timestamp: Date.now(),
      },
    ]);
    sendMessage(text);
    setInput("");
  };

  const handlePurge = async () => {
    if (!confirm("Purger toute la mémoire d'Hadès ?")) return;
    try {
      await fetch("http://localhost:8000/memory/purge", { method: "DELETE" });
      setMessages([]);
      setCurrentEmotion({ emotion: "neutral", intensity: 0.5 });
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="header-left">
          <h1>HADES</h1>
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
        <div className="header-right">
          <EmotionIndicator
            emotion={currentEmotion.emotion}
            intensity={currentEmotion.intensity}
          />
          <button className="purge-btn" onClick={handlePurge} title="Purger la mémoire">
            purge
          </button>
        </div>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            Une âme perdue de plus dans la salle d'attente... Envoie un message.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="bubble">{msg.text}</div>
          </div>
        ))}
        {thinking && (
          <div className="message aria">
            <div className="bubble thinking">Hadès consulte ses dossiers...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? "Parle à Hadès..." : "Connexion au Tartare..."}
          disabled={!connected}
        />
        <button onClick={handleSend} disabled={!connected || !input.trim()}>
          Envoyer
        </button>
      </div>
    </div>
  );
}

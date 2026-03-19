import { useEffect, useRef, useState } from "react";
import type { Message, ServerMessage } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { useAudioRecording } from "../hooks/useAudioRecording";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { EmotionIndicator } from "./EmotionIndicator";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4545";

export function Chat() {
  const { connected, lastMessage, sendMessage } = useWebSocket();
  const { recording, transcribing, startRecording, stopRecording } =
    useAudioRecording();
  const { playing, speak, stop: stopAudio } = useAudioPlayback();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [currentEmotion, setCurrentEmotion] = useState({
    emotion: "calm",
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
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "aria",
          text: lastMessage.text,
          emotion: lastMessage.emotion,
          tone: lastMessage.tone,
          timestamp: Date.now(),
        },
      ]);

      // Auto-play TTS if enabled
      if (ttsEnabled && lastMessage.text) {
        speak(lastMessage.text);
      }
    }

    if (lastMessage.type === "error") {
      setThinking(false);
    }
  }, [lastMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: msg,
        timestamp: Date.now(),
      },
    ]);
    sendMessage(msg);
    if (!text) setInput("");
  };

  const handleMicClick = async () => {
    if (recording) {
      const text = await stopRecording();
      if (text) {
        handleSend(text);
      }
    } else {
      await startRecording();
    }
  };

  const handlePurge = async () => {
    if (!confirm("Purger toute la mémoire d'Hadès ?")) return;
    try {
      await fetch(`${API_URL}/memory/purge`, { method: "DELETE" });
      setMessages([]);
      setCurrentEmotion({ emotion: "calm" });
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
          <EmotionIndicator emotion={currentEmotion.emotion} />
          <button
            className={`tts-btn ${ttsEnabled ? "active" : ""}`}
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (playing) stopAudio();
            }}
            title={ttsEnabled ? "Couper la voix" : "Activer la voix"}
          >
            {ttsEnabled ? "VOX" : "MUTE"}
          </button>
          <button
            className="purge-btn"
            onClick={handlePurge}
            title="Purger la mémoire"
          >
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
            <div className="bubble thinking">
              Hadès consulte ses dossiers...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <button
          className={`mic-btn ${recording ? "recording" : ""} ${transcribing ? "transcribing" : ""}`}
          onClick={handleMicClick}
          disabled={!connected || transcribing}
          title={recording ? "Arrêter l'enregistrement" : "Parler à Hadès"}
        >
          {transcribing ? "..." : recording ? "REC" : "MIC"}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            connected ? "Parle à Hadès..." : "Connexion au Tartare..."
          }
          disabled={!connected}
        />
        <button
          onClick={() => handleSend()}
          disabled={!connected || !input.trim()}
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}

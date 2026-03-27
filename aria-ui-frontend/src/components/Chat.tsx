import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { useAudioRecording } from "../hooks/useAudioRecording";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { useVAD } from "../hooks/useVAD";
import { EmotionIndicator } from "./EmotionIndicator";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4545";

export function Chat() {
  const {
    connected,
    lastMessage,
    sendMessage,
    sendAudio,
    sendInterrupt,
    sendControl,
    onTtsCompleteRef,
  } = useWebSocket();
  const { recording, transcribing, startRecording, stopRecording } =
    useAudioRecording();
  const { playing, speak, speakFromBlob, stop: stopAudio } =
    useAudioPlayback();

  const handleSendRef = useRef<(text?: string) => void>(() => {});

  const handleVADTranscription = useCallback((text: string) => {
    handleSendRef.current(text);
  }, []);

  const handleSpeechStart = useCallback(() => {
    // If ARIA is speaking when user starts talking, interrupt
    if (playing) {
      stopAudio();
      sendInterrupt("user_speech");
    }
  }, [playing, stopAudio, sendInterrupt]);

  const {
    listening,
    transcribing: vadTranscribing,
    toggle: toggleVAD,
    clearTranscribing,
  } = useVAD({
    onTranscription: handleVADTranscription,
    onSpeechStart: handleSpeechStart,
    sendAudio,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [currentEmotion, setCurrentEmotion] = useState({
    emotion: "calm",
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");

  // Wire up TTS-over-WS: when audio blob is assembled, play it
  useEffect(() => {
    onTtsCompleteRef.current = (blob: Blob) => {
      if (ttsEnabled) {
        speakFromBlob(blob);
      }
    };
  }, [ttsEnabled, speakFromBlob, onTtsCompleteRef]);

  // Sync TTS enabled state with server
  useEffect(() => {
    sendControl(ttsEnabled ? "tts_enable" : "tts_disable");
  }, [ttsEnabled, sendControl]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "status") {
      if (lastMessage.status === "thinking") {
        setThinking(true);
        setStreaming(false);
        setStreamingText("");
        streamingTextRef.current = "";
      } else if (lastMessage.status === "streaming") {
        setThinking(false);
        setStreaming(true);
      }
      return;
    }

    if (lastMessage.type === "token") {
      setThinking(false);
      setStreaming(true);
      streamingTextRef.current += lastMessage.text;
      setStreamingText(streamingTextRef.current);
      return;
    }

    if (lastMessage.type === "response") {
      setThinking(false);
      setStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
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

      // TTS via REST fallback if server-side TTS-over-WS is not active
      // (server sends tts_start/tts_end when tts_enabled, so REST is fallback)
      if (ttsEnabled && lastMessage.text && !onTtsCompleteRef.current) {
        speak(lastMessage.text);
      }
    }

    if (lastMessage.type === "stt_result") {
      clearTranscribing();
      if (lastMessage.text?.trim()) {
        handleSendRef.current(lastMessage.text.trim());
      }
    }

    if (lastMessage.type === "interrupted") {
      setThinking(false);
      setStreaming(false);
      const partial = streamingTextRef.current;
      if (partial.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "aria",
            text: partial + "...",
            timestamp: Date.now(),
          },
        ]);
      }
      setStreamingText("");
      streamingTextRef.current = "";
      stopAudio();
    }

    if (lastMessage.type === "error") {
      setThinking(false);
      setStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
    }
  }, [lastMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking, streamingText]);

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
  handleSendRef.current = handleSend;

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

  const handleStop = () => {
    stopAudio();
    sendInterrupt("manual");
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

  const isGenerating = thinking || streaming;

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
            className={`vad-btn ${listening ? "active" : ""} ${vadTranscribing ? "transcribing" : ""}`}
            onClick={toggleVAD}
            disabled={!connected}
            title={
              listening
                ? "Désactiver le mode mains libres"
                : "Activer le mode mains libres"
            }
          >
            {vadTranscribing ? "..." : "AUTO"}
          </button>
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
          {(isGenerating || playing) && (
            <button
              className="stop-btn"
              onClick={handleStop}
              title="Interrompre Hadès"
            >
              STOP
            </button>
          )}
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
        {messages.length === 0 && !thinking && !streaming && (
          <div className="empty-state">
            Une âme perdue de plus dans la salle d'attente... Envoie un message.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="bubble">{msg.text}</div>
          </div>
        ))}
        {streaming && streamingText && (
          <div className="message aria">
            <div className="bubble streaming">{streamingText}</div>
          </div>
        )}
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

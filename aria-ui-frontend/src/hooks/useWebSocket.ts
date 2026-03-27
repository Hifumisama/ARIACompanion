import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage } from "../types";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4545/ws";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);

  // TTS audio chunk accumulation
  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const onTtsCompleteRef = useRef<((audio: Blob) => void) | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => setConnected(true);

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data) as ServerMessage;

          if (data.type === "tts_start") {
            audioChunksRef.current = [];
          } else if (data.type === "tts_end") {
            const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
            audioChunksRef.current = [];
            onTtsCompleteRef.current?.(blob);
          }

          setLastMessage(data);
        } catch {
          // ignore malformed messages
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary frame = TTS audio chunk
        audioChunksRef.current.push(event.data);
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
    }
  }, []);

  const sendAudio = useCallback((audioBytes: ArrayBuffer, format: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "audio", format }));
      ws.send(audioBytes);
    }
  }, []);

  const sendInterrupt = useCallback((reason: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt", reason }));
    }
  }, []);

  const sendControl = useCallback((action: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "control", action }));
    }
  }, []);

  return {
    connected,
    lastMessage,
    sendMessage,
    sendAudio,
    sendInterrupt,
    sendControl,
    onTtsCompleteRef,
  };
}

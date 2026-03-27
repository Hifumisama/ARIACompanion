import { useCallback, useRef, useState } from "react";
import { MicVAD } from "@ricky0123/vad-web";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4545";

interface UseVADOptions {
  onTranscription: (text: string) => void;
  onSpeechStart?: () => void;
  sendAudio?: (audioBytes: ArrayBuffer, format: string) => void;
}

export function useVAD({ onTranscription, onSpeechStart, sendAudio }: UseVADOptions) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const vadRef = useRef<MicVAD | null>(null);

  const start = useCallback(async () => {
    if (vadRef.current) return;

    try {
      const vad = await MicVAD.new({
        baseAssetPath: "/",
        onnxWASMBasePath: "/",
        onSpeechStart: () => {
          onSpeechStart?.();
        },
        onSpeechEnd: async (audio: Float32Array) => {
          const wavBuffer = float32ToWavBuffer(audio, 16000);

          // Prefer WebSocket path if available
          if (sendAudio) {
            setTranscribing(true);
            sendAudio(wavBuffer, "wav");
            // Transcription result will come back via WS stt_result message
            // We set transcribing=false when Chat.tsx handles the result
            return;
          }

          // REST fallback
          const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
          setTranscribing(true);
          try {
            const form = new FormData();
            form.append("file", wavBlob, "recording.wav");
            const resp = await fetch(`${API_URL}/stt`, {
              method: "POST",
              body: form,
            });
            if (!resp.ok) throw new Error(`STT error: ${resp.status}`);
            const data = await resp.json();
            if (data.text?.trim()) {
              onTranscription(data.text.trim());
            }
          } catch (err) {
            console.error("VAD transcription failed:", err);
          } finally {
            setTranscribing(false);
          }
        },
      });

      vad.start();
      vadRef.current = vad;
      setListening(true);
    } catch (err) {
      console.error("VAD start failed:", err);
    }
  }, [onTranscription, onSpeechStart, sendAudio]);

  const stop = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
    }
    setListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (listening) {
      stop();
    } else {
      await start();
    }
  }, [listening, start, stop]);

  const clearTranscribing = useCallback(() => {
    setTranscribing(false);
  }, []);

  return { listening, transcribing, toggle, start, stop, clearTranscribing };
}

/**
 * Convert a Float32Array of PCM samples to a WAV ArrayBuffer.
 */
function float32ToWavBuffer(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM data: clamp and convert float32 to int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

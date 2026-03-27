import { useCallback, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4545";

export function useAudioRecording() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, []);

  const stopRecording = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          resolve(null);
          return;
        }

        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("file", blob, "recording.webm");
          const resp = await fetch(`${API_URL}/stt`, {
            method: "POST",
            body: form,
          });
          if (!resp.ok) throw new Error(`STT error: ${resp.status}`);
          const data = await resp.json();
          resolve(data.text || null);
        } catch (err) {
          console.error("Transcription failed:", err);
          resolve(null);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  return { recording, transcribing, startRecording, stopRecording };
}

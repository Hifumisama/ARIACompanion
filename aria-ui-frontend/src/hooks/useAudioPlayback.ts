import { useCallback, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4545";

export function useAudioPlayback() {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const _cleanup = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    audioRef.current = null;
  };

  const _playBlob = useCallback(async (blob: Blob) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      _cleanup();
    }

    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const audio = new Audio(url);

    audio.onplay = () => setPlaying(true);
    audio.onended = () => {
      setPlaying(false);
      _cleanup();
    };
    audio.onerror = () => {
      setPlaying(false);
      _cleanup();
    };

    audioRef.current = audio;
    await audio.play();
  }, []);

  const speakFromBlob = useCallback(
    async (blob: Blob) => {
      try {
        await _playBlob(blob);
      } catch (err) {
        console.error("TTS playback from blob failed:", err);
        setPlaying(false);
      }
    },
    [_playBlob],
  );

  const speak = useCallback(
    async (text: string) => {
      try {
        const resp = await fetch(`${API_URL}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!resp.ok) throw new Error(`TTS error: ${resp.status}`);
        const blob = await resp.blob();
        await _playBlob(blob);
      } catch (err) {
        console.error("TTS playback failed:", err);
        setPlaying(false);
      }
    },
    [_playBlob],
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      _cleanup();
    }
  }, []);

  return { playing, speak, speakFromBlob, stop };
}

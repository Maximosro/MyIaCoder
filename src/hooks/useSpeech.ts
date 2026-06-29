import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Text-to-speech hook (Flujo 3). Speaks text via the Python sidecar
 * (window.electronAPI.voiceSynthesize), which renders it with the Piper es-AR
 * voice, and plays back the returned WAV.
 *
 * To start fast on large documents, the text is split into chunks (paragraphs,
 * further split on sentences if a paragraph is huge) and played as a queue:
 * playback of chunk N starts as soon as its audio arrives, while chunk N+1 is
 * already being synthesized in the background. So the first words play after
 * ~one chunk's synth time, not the whole document's.
 *
 * `isLoading` is the "generando…" window before the very first chunk plays.
 * `stop()` cancels playback and any in-flight/queued chunks.
 */

interface UseSpeech {
  isSpeaking: boolean;
  isLoading: boolean;
  isSupported: boolean;
  error: string | null;
  speak: (text: string) => void;
  stop: () => void;
}

// Keep chunks small enough to start fast, large enough to avoid choppy seams.
const MAX_CHUNK_CHARS = 400;

/** Split text into speakable chunks: by paragraph, then by sentence if needed. */
function chunkText(text: string): string[] {
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: string[] = [];
  for (const para of paras) {
    if (para.length <= MAX_CHUNK_CHARS) {
      out.push(para);
      continue;
    }
    // Long paragraph: split on sentence boundaries, packing up to the limit.
    const sentences = para.match(/[^.!?…]+[.!?…]*\s*/g) ?? [para];
    let buf = '';
    for (const s of sentences) {
      if (buf && buf.length + s.length > MAX_CHUNK_CHARS) {
        out.push(buf.trim());
        buf = '';
      }
      buf += s;
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}

export function useSpeech(): UseSpeech {
  const isSupported = typeof window !== 'undefined' && !!window.electronAPI?.voiceSynthesize;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  // Bumped on every stop()/speak() so stale async work can't resume playback.
  const genRef = useRef(0);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    revokeUrl();
    setIsSpeaking(false);
    setIsLoading(false);
  }, [revokeUrl]);

  // Synthesize one chunk to a playable Object URL. Throws on sidecar error.
  const synth = useCallback(async (text: string): Promise<string> => {
    const res = await window.electronAPI.voiceSynthesize(text);
    if (!res.ok) throw new Error(res.error);
    return URL.createObjectURL(new Blob([res.audio], { type: 'audio/wav' }));
  }, []);

  // Play one already-synthesized Object URL to completion.
  const playUrl = useCallback(
    (url: string, gen: number) =>
      new Promise<void>((resolve, reject) => {
        if (gen !== genRef.current) return resolve();
        revokeUrl();
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(`Audio no reproducible (code ${audio.error?.code ?? '?'}).`));
        audio.play().catch(reject);
      }),
    [revokeUrl],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!isSupported || !text.trim()) return;
      stop();
      const gen = genRef.current;
      setError(null);
      setIsLoading(true);

      const chunks = chunkText(text);
      try {
        // Prefetch the next chunk while the current one plays (1-deep pipeline).
        let next: Promise<string> | null = chunks.length ? synth(chunks[0]) : null;
        for (let i = 0; i < chunks.length; i++) {
          const url = await next!;
          if (gen !== genRef.current) {
            URL.revokeObjectURL(url);
            return;
          }
          next = i + 1 < chunks.length ? synth(chunks[i + 1]) : null;
          if (i === 0) {
            setIsLoading(false);
            setIsSpeaking(true);
          }
          await playUrl(url, gen);
          if (gen !== genRef.current) return;
        }
        if (gen === genRef.current) stop();
      } catch (err) {
        if (gen !== genRef.current) return;
        setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        setIsLoading(false);
        setIsSpeaking(false);
      }
    },
    [isSupported, stop, synth, playUrl],
  );

  // Stop playback on unmount so audio never outlives the editor.
  useEffect(() => () => stop(), [stop]);

  return { isSpeaking, isLoading, isSupported, error, speak, stop };
}

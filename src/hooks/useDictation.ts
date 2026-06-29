import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice dictation hook (Flujo 1). Records microphone audio and transcribes it
 * via the Python sidecar (window.electronAPI.voiceTranscribe).
 *
 * Segmentation is driven by silence detection (VAD), not a fixed timer: a Web
 * Audio AnalyserNode watches the mic level and a segment is only closed —and
 * sent to the sidecar— once the user pauses. This avoids cutting words in half
 * the way fixed-interval chunking did. faster-whisper is not streaming, so
 * `interimText` is just a "transcribing…" hint while a segment is in flight and
 * `finalText` accumulates the recognized text.
 *
 * A hard MAX_SEGMENT_MS cap forces a cut during very long pause-less monologues
 * (rare). Pure-silence segments are recycled without transcribing.
 */

interface UseDictation {
  isListening: boolean;
  isSupported: boolean;
  interimText: string;
  finalText: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
}

// VAD tuning. RMS is normalized 0..1 on the mic waveform.
const SILENCE_RMS = 0.012;      // below this counts as silence
const SILENCE_MS = 800;         // pause length that closes a segment
const MIN_SEGMENT_MS = 600;     // ignore blips shorter than this
const MAX_SEGMENT_MS = 15000;   // hard cap so a pause-less rant still gets sent
const TICK_MS = 100;            // how often we sample the mic level
const MAX_PENDING = 4;          // backlog cap (drop newest if we fall behind)

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export function useDictation(): UseDictation {
  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const listeningRef = useRef(false);

  // Web Audio level-monitor refs.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Current segment state.
  const recRef = useRef<MediaRecorder | null>(null);
  const segStartRef = useRef(0);
  const lastSpeechRef = useRef(0);
  const hadSpeechRef = useRef(false);
  const discardRef = useRef(false);

  // Single-flight transcription queue: one chunk at a time, in order, so the
  // CPU-bound model never thrashes or builds an unbounded backlog.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (blob.size === 0) return;
    try {
      const buf = await blob.arrayBuffer();
      const res = await window.electronAPI.voiceTranscribe(buf, blob.type || 'audio/webm');
      if (res.ok) {
        const text = res.text.trim();
        if (text) setFinalText((prev) => (prev ? `${prev} ${text}` : text));
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (pendingRef.current <= 1) setInterimText('');
    }
  }, []);

  const enqueueTranscribe = useCallback((blob: Blob) => {
    if (pendingRef.current >= MAX_PENDING) return;
    pendingRef.current += 1;
    setInterimText('…');
    queueRef.current = queueRef.current
      .then(() => transcribeBlob(blob))
      .finally(() => {
        pendingRef.current -= 1;
      });
  }, [transcribeBlob]);

  // Starts a fresh MediaRecorder for the next segment. Fresh per segment so each
  // webm blob carries its own container header and is independently decodable.
  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !listeningRef.current) return;

    const mimeType = pickMimeType();
    const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recRef.current = rec;
    segStartRef.current = performance.now();
    lastSpeechRef.current = performance.now();
    hadSpeechRef.current = false;
    discardRef.current = false;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      // Only transcribe segments that actually contained speech.
      if (!discardRef.current && hadSpeechRef.current) {
        enqueueTranscribe(new Blob(chunks, { type: rec.mimeType }));
      }
      if (listeningRef.current) startSegment();
    };
    rec.start();
  }, [enqueueTranscribe]);

  // Closes the current segment. onstop handles transcription + chaining.
  const cutSegment = useCallback((discard: boolean) => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null; // prevent the monitor from cutting again before restart
    discardRef.current = discard;
    if (rec.state !== 'inactive') rec.stop();
  }, []);

  // Samples mic level every TICK_MS and decides when to close a segment.
  const monitor = useCallback(() => {
    const analyser = analyserRef.current;
    const wave = waveRef.current;
    if (!analyser || !wave || !recRef.current || !listeningRef.current) return;

    analyser.getByteTimeDomainData(wave);
    let sumSq = 0;
    for (let i = 0; i < wave.length; i++) {
      const v = (wave[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / wave.length);

    const now = performance.now();
    if (rms > SILENCE_RMS) {
      hadSpeechRef.current = true;
      lastSpeechRef.current = now;
    }
    const elapsed = now - segStartRef.current;
    const sinceSpeech = now - lastSpeechRef.current;

    if (hadSpeechRef.current && sinceSpeech >= SILENCE_MS && elapsed >= MIN_SEGMENT_MS) {
      cutSegment(false); // natural pause → send what we have
    } else if (hadSpeechRef.current && elapsed >= MAX_SEGMENT_MS) {
      cutSegment(false); // pause-less monologue → hard cap
    } else if (!hadSpeechRef.current && elapsed >= MAX_SEGMENT_MS) {
      cutSegment(true); // pure silence → recycle, don't transcribe
    }
  }, [cutSegment]);

  const teardown = useCallback(() => {
    listeningRef.current = false;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    waveRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setInterimText('');
    teardown();
  }, [teardown]);

  const startListening = useCallback(async () => {
    if (!isSupported || listeningRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      waveRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));

      listeningRef.current = true;
      setIsListening(true);
      startSegment();
      tickRef.current = setInterval(monitor, TICK_MS);
    } catch (err) {
      // NotAllowedError when the user denies the mic permission.
      const name = err instanceof DOMException ? err.name : '';
      setError(name === 'NotAllowedError' ? 'not-allowed' : err instanceof Error ? err.message : String(err));
      teardown();
      setIsListening(false);
    }
  }, [isSupported, startSegment, monitor, teardown]);

  // Stop everything on unmount so the mic never stays on.
  useEffect(() => teardown, [teardown]);

  return { isListening, isSupported, interimText, finalText, error, startListening, stopListening };
}

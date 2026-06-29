"""Voice STT sidecar for MyIaCoder (Flujo 1 — dictado).

Spawned by electron/services/voice.ts. Receives audio chunks from the renderer
(captured with MediaRecorder, usually webm/opus) and transcribes them with
faster-whisper. The model is loaded once at startup.

Protocol:
  - Binds to an ephemeral port (0 -> OS assigns) and prints "PORT <n>" to stdout
    so the parent process can discover it. Then serves forever.
  - POST /transcribe  (multipart/form-data, field "audio") -> { "text": str }
  - GET  /health      -> { "status": "ok", "model_loaded": bool }

Run "python voice_sidecar.py --selftest" for a dependency-free self-check.
"""

import io
import os
import sys
import tempfile

# ponytail: "small" balances quality and CPU speed for live Spanish dictation.
# "base"/"tiny" are faster but sloppier; "medium" is more accurate but heavy.
# Override with VOICE_MODEL. VOICE_LANG overrides the language.
MODEL_NAME = os.environ.get("VOICE_MODEL", "small")
LANG = os.environ.get("VOICE_LANG", "es")

# Flujo 3 — texto a voz (TTS). Path to a Piper voice .onnx (its .onnx.json must
# sit next to it). Bundled offline in packaged builds via VOICE_TTS_MODEL.
TTS_MODEL = os.environ.get("VOICE_TTS_MODEL", "")
# ponytail: Piper's default cadence (1.0) is the natural pace; >1 slows it down,
# <1 speeds it up. Override with VOICE_TTS_LENGTH.
TTS_LENGTH_SCALE = float(os.environ.get("VOICE_TTS_LENGTH", "1.0"))

_model = None
_tts_voice = None
# The CTranslate2 model is not thread-safe and is CPU-bound; serialize requests
# so concurrent chunks queue instead of thrashing the CPU (which makes each one
# slower and builds an unbounded backlog).
import threading

_model_lock = threading.Lock()
# Piper's onnx voice is likewise not thread-safe and CPU-bound — its own lock.
_tts_lock = threading.Lock()


def get_model():
    """Lazy-load the faster-whisper model once (~hundreds of MB, load once).

    VOICE_MODEL may be a model name ("small") to download, or a path to a
    pre-bundled model folder (the packaged installer ships one) — in that case
    we load strictly offline so the target machine never needs internet.
    """
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        # ponytail: derive thread count from the target machine — leave ~2 cores
        # for the UI/desktop, clamp to [1, 8]. Works whether the installer lands
        # on a 4-core laptop or a 12-core desktop. VOICE_CPU_THREADS overrides.
        cores = os.cpu_count() or 4
        default_threads = max(1, min(8, cores - 2))
        threads = int(os.environ.get("VOICE_CPU_THREADS", str(default_threads)))
        is_local = os.path.isdir(MODEL_NAME)
        _model = WhisperModel(
            MODEL_NAME,
            device="cpu",
            compute_type="int8",
            cpu_threads=threads,
            local_files_only=is_local,
        )
    return _model


# ponytail: greedy decoding (beam_size=1) is ~2x faster than the beam_size=5
# default for a small accuracy hit — the right trade for near-real-time dictation.
# Raise VOICE_BEAM for more accuracy at the cost of latency.
BEAM = int(os.environ.get("VOICE_BEAM", "1"))


def transcribe_file(path: str) -> str:
    """Transcribe one audio file to text. faster-whisper decodes via PyAV,
    so webm/opus/wav all work without an external ffmpeg. Serialized via a lock
    because the model is not thread-safe and CPU-bound.

    No vad_filter: the renderer already segments on silence (its own VAD), so
    whisper's onnxruntime-based VAD is redundant — dropping it removes a whole
    native dependency from the frozen installer build."""
    with _model_lock:
        segments, _info = get_model().transcribe(path, language=LANG, beam_size=BEAM)
        return "".join(seg.text for seg in segments).strip()


def get_tts_voice():
    """Lazy-load the Piper voice once. The config (.onnx.json) is auto-derived
    from the model path. espeak-ng phoneme data ships inside the piper wheel, so
    this works fully offline."""
    global _tts_voice
    if _tts_voice is None:
        if not TTS_MODEL:
            raise RuntimeError("VOICE_TTS_MODEL no configurado (ruta al .onnx de Piper).")
        if not os.path.isfile(TTS_MODEL):
            raise RuntimeError(f"Voz Piper no encontrada en {TTS_MODEL}")
        from piper import PiperVoice

        _tts_voice = PiperVoice.load(TTS_MODEL)
    return _tts_voice


def synthesize_wav(text: str) -> bytes:
    """Synthesize text to a WAV byte string (with header). Serialized via a lock
    because the Piper voice is not thread-safe and CPU-bound."""
    import wave

    from piper import SynthesisConfig

    with _tts_lock:
        voice = get_tts_voice()
        cfg = SynthesisConfig(length_scale=TTS_LENGTH_SCALE)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            voice.synthesize_wav(text, wav_file, syn_config=cfg)
        return buf.getvalue()


def build_app():
    from flask import Flask, Response, jsonify, request

    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify(
            status="ok",
            model_loaded=_model is not None,
            tts_loaded=_tts_voice is not None,
        )

    @app.post("/transcribe")
    def transcribe():
        audio = request.files.get("audio")
        if audio is None:
            return jsonify(error="missing 'audio' field"), 400
        # Suffix matters: PyAV sniffs the container, but a hint helps.
        suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        try:
            audio.save(tmp.name)
            tmp.close()
            text = transcribe_file(tmp.name)
            return jsonify(text=text)
        except Exception as exc:  # noqa: BLE001 — surface any decode/transcribe error
            return jsonify(error=str(exc)), 500
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    @app.post("/synthesize")
    def synthesize():
        data = request.get_json(silent=True) or {}
        text = (data.get("text") or "").strip()
        if not text:
            return jsonify(error="missing 'text' field"), 400
        try:
            wav = synthesize_wav(text)
            return Response(wav, mimetype="audio/wav")
        except Exception as exc:  # noqa: BLE001 — surface any load/synthesize error
            return jsonify(error=str(exc)), 500

    return app


def serve():
    """Bind to an ephemeral port, announce it on stdout, then serve."""
    from werkzeug.serving import make_server

    # Warm whisper in the background so the port is announced immediately and a
    # TTS-only caller isn't blocked on the (heavy) STT model load. Guarded by
    # _model_lock so it can't race a concurrent /transcribe into a double-load.
    def _warm_model():
        with _model_lock:
            get_model()

    threading.Thread(target=_warm_model, daemon=True).start()
    app = build_app()
    srv = make_server("127.0.0.1", 0, app, threaded=True)
    print(f"PORT {srv.server_port}", flush=True)
    srv.serve_forever()


def selftest() -> int:
    """Run a tiny silent WAV through transcribe, and (if a Piper voice is
    configured) synthesize a short phrase. The smallest check that fails if the
    STT or TTS load/decode path breaks."""
    import struct
    import wave

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    try:
        with wave.open(tmp.name, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(struct.pack("<" + "h" * 16000, *([0] * 16000)))  # 1s silence
        text = transcribe_file(tmp.name)
        assert isinstance(text, str), f"expected str, got {type(text)}"
        print(f"selftest STT OK (model={MODEL_NAME}, text={text!r})")
        if TTS_MODEL and os.path.isfile(TTS_MODEL):
            wav = synthesize_wav("Hola, esto es una prueba.")
            assert wav[:4] == b"RIFF", f"expected WAV bytes, got {wav[:4]!r}"
            print(f"selftest TTS OK (voice={TTS_MODEL}, bytes={len(wav)})")
        else:
            print("selftest TTS skipped (VOICE_TTS_MODEL not set)")
        return 0
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    serve()

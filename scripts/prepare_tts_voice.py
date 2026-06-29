"""Build-time helper: download a Piper es-ES voice into a plain folder so it can
be bundled into the installer (shipped offline, no first-run download).

Usage (from repo root, run by the `build:tts` npm script):
    python scripts/prepare_tts_voice.py [voice] [output_dir]
Defaults: voice="es_ES-davefx-medium", output_dir="sidecar-dist/tts".

Downloads <voice>.onnx and <voice>.onnx.json from HuggingFace
rhasspy/piper-voices. At runtime the sidecar is pointed at the .onnx via
VOICE_TTS_MODEL and Piper loads it (plus the sibling .onnx.json) with the
espeak-ng data bundled inside the piper wheel, so the target machine never needs
internet.
"""

import sys
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"


def voice_url_path(voice: str) -> str:
    # Voice id "es_ES-davefx-medium" -> "es/es_ES/davefx/medium".
    lang, name, quality = voice.split("-", 2)  # es_ES, davefx, medium
    family = lang.split("_")[0]  # es
    return f"{family}/{lang}/{name}/{quality}"


def main() -> int:
    voice = sys.argv[1] if len(sys.argv) > 1 else "es_ES-davefx-medium"
    output_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "sidecar-dist/tts")
    output_dir.mkdir(parents=True, exist_ok=True)

    rel = voice_url_path(voice)
    for suffix in (".onnx", ".onnx.json"):
        url = f"{BASE}/{rel}/{voice}{suffix}"
        dest = output_dir / f"{voice}{suffix}"
        print(f"==> Downloading {url}")
        urllib.request.urlretrieve(url, dest)
        print(f"    -> {dest} ({dest.stat().st_size} bytes)")

    print(f"voice '{voice}' ready at: {output_dir / (voice + '.onnx')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

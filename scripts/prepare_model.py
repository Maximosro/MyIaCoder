"""Build-time helper: materialize a faster-whisper model into a plain folder so
it can be bundled into the installer (shipped offline, no first-run download).

Usage (from repo root, run by the `build:model` npm script):
    python scripts/prepare_model.py [model] [output_dir]
Defaults: model="small", output_dir="sidecar-dist/model".

The model lands as real files (model.bin, config.json, tokenizer.json, ...).
At runtime the sidecar is pointed at this folder via VOICE_MODEL and loads it
with local_files_only, so the target machine never needs internet.
"""

import sys

from faster_whisper.utils import download_model


def main() -> int:
    model = sys.argv[1] if len(sys.argv) > 1 else "small"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "sidecar-dist/model"
    path = download_model(model, output_dir=output_dir)
    print(f"model '{model}' ready at: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

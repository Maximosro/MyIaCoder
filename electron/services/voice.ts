import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { existsSync, appendFileSync, readdirSync } from 'node:fs';
import { app } from 'electron';

/**
 * Manages the Python STT sidecar for voice dictation.
 *
 * In packaged builds it runs a self-contained `voice_sidecar.exe` (frozen with
 * PyInstaller, shipped via electron-builder extraResources) so the target
 * machine needs no Python. In dev it runs the sidecar script with Python.
 *
 * The sidecar captures nothing itself — the renderer records audio with
 * MediaRecorder and ships chunks here via IPC; we forward them to the sidecar's
 * HTTP endpoint and return the transcribed text. Started lazily on the first
 * transcribe and killed on app quit.
 */

let child: ChildProcess | null = null;
let resolvedPython: string | null = null;
let portPromise: Promise<number> | null = null;

// ponytail: debug log so spawn/transcribe failures are visible (the renderer
// only shows a short error). Path printed once at startup.
const LOG = path.join(app.getPath('userData'), 'voice-sidecar.log');
function log(msg: string): void {
  try {
    appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* ignore logging errors */
  }
}

/** Dev-only: resolves the sidecar script path. */
function sidecarScriptPath(): string {
  const candidates = [
    path.join(process.cwd(), 'scripts', 'voice_sidecar.py'),
    path.join(__dirname, '..', '..', 'scripts', 'voice_sidecar.py'),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

/**
 * Dev-only: finds a Python that actually runs. On Windows, a bare `python` often
 * resolves to the Microsoft Store alias stub in WindowsApps, which silently dies
 * when spawned non-interactively. We probe candidates with `--version` and pick
 * the first that works — preferring the `py` launcher and VOICE_PYTHON override.
 */
function resolvePython(): string {
  if (resolvedPython) return resolvedPython;
  const candidates = [
    process.env.VOICE_PYTHON,
    process.platform === 'win32' ? 'py' : null,
    'python3',
    'python',
  ].filter((c): c is string => !!c);

  for (const cmd of candidates) {
    try {
      const out = execFileSync(cmd, ['--version'], { encoding: 'utf8', windowsHide: true });
      if (/Python \d/.test(out)) {
        resolvedPython = cmd;
        log(`resolved python: ${cmd} (${out.trim()})`);
        return cmd;
      }
    } catch {
      // Try the next candidate. The Store stub exits non-zero / prints nothing.
    }
  }
  resolvedPython = 'python';
  log('no working python found; falling back to "python"');
  return 'python';
}

/** Picks the command to launch: embedded python when packaged, dev python otherwise. */
function sidecarCommand(): { cmd: string; args: string[] } {
  if (app.isPackaged) {
    // Embedded Python bundle shipped in resources/voice/ (see build-embedded-python.ps1).
    const py = path.join(process.resourcesPath, 'voice', 'python', 'python.exe');
    const script = path.join(process.resourcesPath, 'voice', 'voice_sidecar.py');
    return { cmd: py, args: [script] };
  }
  return { cmd: resolvePython(), args: [sidecarScriptPath()] };
}

/**
 * Environment for the sidecar. In packaged builds, point VOICE_MODEL at the
 * model folder bundled in resources/voice/model so transcription works fully
 * offline (no first-run download). Dev keeps whatever VOICE_MODEL is set, or the
 * sidecar's own default.
 */
function sidecarEnv(): NodeJS.ProcessEnv {
  if (app.isPackaged) {
    const modelDir = path.join(process.resourcesPath, 'voice', 'model');
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (existsSync(modelDir)) {
      env.VOICE_MODEL = modelDir;
    }
    // Point Piper at the bundled es-ES voice so TTS works fully offline.
    const ttsDir = path.join(process.resourcesPath, 'voice', 'tts');
    const voice = existsSync(ttsDir) ? findOnnx(ttsDir) : null;
    if (voice) {
      env.VOICE_TTS_MODEL = voice;
    }
    return env;
  }
  return process.env;
}

/** First *.onnx file in a folder (the bundled Piper voice). */
function findOnnx(dir: string): string | null {
  try {
    const onnx = readdirSync(dir).find((f) => f.endsWith('.onnx'));
    return onnx ? path.join(dir, onnx) : null;
  } catch {
    return null;
  }
}

/**
 * Spawns the sidecar and resolves with the ephemeral port it prints as
 * "PORT <n>" on stdout. Memoized: concurrent callers share one process.
 */
export function startVoiceSidecar(): Promise<number> {
  if (portPromise) return portPromise;

  portPromise = new Promise<number>((resolve, reject) => {
    const { cmd, args } = sidecarCommand();
    log(`spawning: ${cmd} ${args.join(' ')} (cwd=${process.cwd()})`);
    const proc = spawn(cmd, args, { windowsHide: true, env: sidecarEnv() });
    child = proc;

    let stderr = '';
    let settled = false;

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      portPromise = null;
      child = null;
      log(`FAIL: ${msg}`);
      reject(new Error(msg));
    };

    proc.on('error', (err) => {
      // Most common in dev: python not on PATH. In packaged: missing exe.
      fail(`Failed to start voice sidecar (is Python installed?): ${err.message}`);
    });

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      log(`stdout: ${chunk.trim()}`);
      const match = chunk.match(/PORT (\d+)/);
      if (match && !settled) {
        settled = true;
        log(`ready on port ${match[1]}`);
        resolve(Number(match[1]));
      }
    });

    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      log(`stderr: ${chunk.trim()}`);
    });

    proc.on('exit', (code) => {
      child = null;
      portPromise = null;
      fail(
        `Voice sidecar exited (code ${code}) before it was ready.` +
          (stderr ? ` Did you install scripts/requirements.txt? ${stderr.trim().slice(-400)}` : ''),
      );
    });
  });

  return portPromise;
}

/**
 * Transcribes one audio chunk. Lazily starts the sidecar, POSTs the audio as
 * multipart/form-data, and returns the recognized text ('' if silence).
 */
export async function transcribe(audio: Buffer, mimeType = 'audio/webm'): Promise<string> {
  const port = await startVoiceSidecar();
  const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm';

  const form = new FormData();
  form.append('audio', new Blob([Uint8Array.from(audio)], { type: mimeType }), `chunk.${ext}`);

  const res = await fetch(`http://127.0.0.1:${port}/transcribe`, { method: 'POST', body: form });
  const data = (await res.json()) as { text?: string; error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || `Transcribe failed (HTTP ${res.status})`);
  }
  return data.text ?? '';
}

/**
 * Synthesizes text to speech (Flujo 3). Lazily starts the sidecar, POSTs the
 * text, and returns the WAV audio bytes produced by the Piper voice.
 */
export async function synthesize(text: string): Promise<Buffer> {
  const port = await startVoiceSidecar();
  const res = await fetch(`http://127.0.0.1:${port}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Synthesize failed (HTTP ${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** True once the sidecar process is running. */
export function isVoiceSidecarRunning(): boolean {
  return child !== null;
}

/** Kills the sidecar (called on app quit). */
export function stopVoiceSidecar(): void {
  if (child) {
    child.kill();
    child = null;
  }
  portPromise = null;
}

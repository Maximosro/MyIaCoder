import { ipcMain } from 'electron';
import { transcribe, synthesize, isVoiceSidecarRunning } from '../services/voice';

/**
 * Registers voice/STT IPC. The renderer records audio (MediaRecorder) and sends
 * each chunk as an ArrayBuffer; we forward it to the Python sidecar and return
 * the transcribed text. The sidecar is started lazily on the first transcribe.
 */
export function registerVoiceIpc(): void {
  ipcMain.handle('voice:transcribe', async (_event, audio: ArrayBuffer, mimeType: string) => {
    try {
      const text = await transcribe(Buffer.from(audio), mimeType);
      return { ok: true as const, text };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('voice:synthesize', async (_event, text: string) => {
    try {
      const audio = await synthesize(text);
      // Return an ArrayBuffer so it crosses the IPC boundary as transferable bytes.
      return { ok: true as const, audio: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('voice:status', () => ({ running: isVoiceSidecarRunning() }));
}

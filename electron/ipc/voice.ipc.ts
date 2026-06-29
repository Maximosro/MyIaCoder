import { ipcMain } from 'electron';
import { transcribe, isVoiceSidecarRunning } from '../services/voice';

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

  ipcMain.handle('voice:status', () => ({ running: isVoiceSidecarRunning() }));
}

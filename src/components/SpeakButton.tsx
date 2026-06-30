import { Volume2, Square, Loader2, AlertTriangle } from 'lucide-react';
import { VoiceToggleButton } from './VoiceToggleButton';

interface SpeakButtonProps {
  isSpeaking: boolean;
  isLoading: boolean;
  isSupported: boolean;
  error: string | null;
  onToggle: () => void;
}

/**
 * Toolbar text-to-speech toggle for the FileEditor (Flujo 3). Shows a spinner
 * while Piper renders the audio, a stop square while playing, and an error
 * state on failure.
 */
export function SpeakButton({ isSpeaking, isLoading, isSupported, error, onToggle }: SpeakButtonProps) {
  const active = isSpeaking || isLoading;
  const title = error
    ? `Error de lectura: ${error}`
    : isLoading
      ? 'Generando audio…'
      : isSpeaking
        ? 'Detener lectura (Ctrl+Shift+R)'
        : 'Leer en voz alta (Ctrl+Shift+R)';

  return (
    <VoiceToggleButton
      active={active}
      error={error}
      isSupported={isSupported}
      onToggle={onToggle}
      title={title}
      activeClass="text-[#d4784a] hover:text-[#e8956a] bg-[#1f1a15]/50"
    >
      {error && !active ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isSpeaking ? (
        <Square className="w-3.5 h-3.5" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </VoiceToggleButton>
  );
}

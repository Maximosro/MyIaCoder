import { Volume2, Square, Loader2, AlertTriangle } from 'lucide-react';

interface SpeakButtonProps {
  isSpeaking: boolean;
  isLoading: boolean;
  isSupported: boolean;
  error: string | null;
  onToggle: () => void;
}

/**
 * Toolbar text-to-speech toggle for the FileEditor (Flujo 3). Renders nothing
 * when the platform can't synthesize. Shows a spinner while Piper renders the
 * audio, a stop square while playing, and an error state on failure.
 */
export function SpeakButton({ isSpeaking, isLoading, isSupported, error, onToggle }: SpeakButtonProps) {
  if (!isSupported) return null;

  const active = isSpeaking || isLoading;
  const title = error
    ? `Error de lectura: ${error}`
    : isLoading
      ? 'Generando audio…'
      : isSpeaking
        ? 'Detener lectura (Ctrl+Shift+R)'
        : 'Leer en voz alta (Ctrl+Shift+R)';

  return (
    <button
      onClick={onToggle}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`p-1 rounded transition-all duration-200 ${
        active
          ? 'text-[#d4784a] hover:text-[#e8956a] bg-[#1f1a15]/50'
          : error
            ? 'text-[#e05555] hover:bg-[#0f0f0f]'
            : 'text-[#8b5a3c] hover:text-[#d4784a] hover:bg-[#0f0f0f]'
      }`}
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
    </button>
  );
}

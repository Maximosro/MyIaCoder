import { Mic, AlertTriangle } from 'lucide-react';

interface MicButtonProps {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  onToggle: () => void;
}

/**
 * Toolbar dictation toggle for the FileEditor. Renders nothing when the
 * platform can't record audio. Pulses red while listening; shows the error
 * state when transcription/permission fails.
 */
export function MicButton({ isListening, isSupported, error, onToggle }: MicButtonProps) {
  if (!isSupported) return null;

  const title = error
    ? `Dictation error: ${error === 'not-allowed' ? 'microphone permission denied' : error}`
    : isListening
      ? 'Recording… (Ctrl+Shift+V to stop)'
      : 'Dictate (Ctrl+Shift+V)';

  return (
    <button
      onClick={onToggle}
      title={title}
      aria-label={title}
      aria-pressed={isListening}
      className={`p-1 rounded transition-all duration-200 ${
        isListening
          ? 'mic-active bg-[#1f1a15]/50'
          : error
            ? 'text-[#e05555] hover:bg-[#0f0f0f]'
            : 'text-[#8b5a3c] hover:text-[#d4784a] hover:bg-[#0f0f0f]'
      }`}
    >
      {error && !isListening ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : (
        <Mic className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

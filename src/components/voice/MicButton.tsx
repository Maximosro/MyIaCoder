import { Mic, AlertTriangle } from 'lucide-react';
import { VoiceToggleButton } from './VoiceToggleButton';

interface MicButtonProps {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  onToggle: () => void;
}

/**
 * Toolbar dictation toggle for the FileEditor. Pulses red while listening;
 * shows the error state when transcription/permission fails.
 */
export function MicButton({ isListening, isSupported, error, onToggle }: MicButtonProps) {
  const title = error
    ? `Dictation error: ${error === 'not-allowed' ? 'microphone permission denied' : error}`
    : isListening
      ? 'Recording… (Ctrl+Shift+V to stop)'
      : 'Dictate (Ctrl+Shift+V)';

  return (
    <VoiceToggleButton
      active={isListening}
      error={error}
      isSupported={isSupported}
      onToggle={onToggle}
      title={title}
      activeClass="mic-active bg-[#1f1a15]/50"
    >
      {error && !isListening ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : (
        <Mic className="w-3.5 h-3.5" />
      )}
    </VoiceToggleButton>
  );
}

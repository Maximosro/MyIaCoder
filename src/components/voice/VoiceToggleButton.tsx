import type { ReactNode } from 'react';

interface VoiceToggleButtonProps {
  active: boolean;
  error: string | null;
  isSupported: boolean;
  onToggle: () => void;
  title: string;
  /** Tailwind classes applied when `active` is true. */
  activeClass: string;
  children: ReactNode;
}

/**
 * Shared toolbar toggle for the FileEditor voice controls (dictation + TTS).
 * Renders nothing when unsupported. The caller supplies the title, the active
 * style and the icon for the current state; the idle/error styles are shared.
 */
export function VoiceToggleButton({ active, error, isSupported, onToggle, title, activeClass, children }: VoiceToggleButtonProps) {
  if (!isSupported) return null;

  return (
    <button
      onClick={onToggle}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`p-1 rounded transition-all duration-200 ${
        active
          ? activeClass
          : error
            ? 'text-[#e05555] hover:bg-[#0f0f0f]'
            : 'text-[#8b5a3c] hover:text-[#d4784a] hover:bg-[#0f0f0f]'
      }`}
    >
      {children}
    </button>
  );
}

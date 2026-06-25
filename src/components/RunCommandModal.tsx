import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Play } from 'lucide-react';

interface RunCommandModalProps {
  open: boolean;
  projectName: string;
  /** Previously saved command for this project, pre-filled into the input. */
  defaultCommand?: string;
  /** Default shell choice (saved value, or the global WSL2 setting). */
  defaultUseWsl: boolean;
  onClose: () => void;
  onConfirm: (command: string, useWsl: boolean) => void;
}

export function RunCommandModal({ open, projectName, defaultCommand, defaultUseWsl, onClose, onConfirm }: RunCommandModalProps) {
  const [command, setCommand] = useState('');
  const [useWsl, setUseWsl] = useState(defaultUseWsl);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCommand(defaultCommand ?? '');
    setUseWsl(defaultUseWsl);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }, [open, defaultCommand, defaultUseWsl]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const container = document.getElementById('root') || document.body;
  const trimmed = command.trim();
  const canRun = trimmed.length > 0;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleConfirm = () => {
    if (!canRun) return;
    onConfirm(trimmed, useWsl);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-[440px] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15]">
          <div className="flex items-center gap-2.5">
            <Play className="w-4 h-4 text-[#6ba86b]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              RUN COMMAND
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#1f1a15] transition-colors duration-150"
          >
            <X className="w-4 h-4 text-[#8b5a3c]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <label className="text-[11px] font-mono text-[#8b5a3c] tracking-wider uppercase">
            Command for {projectName}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="npm run dev"
            spellCheck={false}
            className="w-full bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-[12px] font-mono text-[#f0ece8] placeholder:text-[#4a2a1a] focus:border-[#d4784a]/50 focus:outline-none transition-colors duration-150"
          />

          {/* Shell choice */}
          <label className="text-[11px] font-mono text-[#8b5a3c] tracking-wider uppercase">
            Shell
          </label>
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setUseWsl(false)}
              className={`flex-1 px-3 py-2 text-[11px] font-mono rounded border transition-colors duration-150 ${
                !useWsl
                  ? 'text-[#f0ece8] bg-[#d4784a]/20 border-[#d4784a]/40'
                  : 'text-[#8b5a3c] border-[#1f1a15] hover:bg-[#0f0f0f]'
              }`}
            >
              Windows
            </button>
            <button
              type="button"
              onClick={() => setUseWsl(true)}
              className={`flex-1 px-3 py-2 text-[11px] font-mono rounded border transition-colors duration-150 ${
                useWsl
                  ? 'text-[#f0ece8] bg-[#d4784a]/20 border-[#d4784a]/40'
                  : 'text-[#8b5a3c] border-[#1f1a15] hover:bg-[#0f0f0f]'
              }`}
            >
              WSL
            </button>
          </div>

          <p className="text-[10px] font-mono text-[#4a2a1a]">
            Saved for this project. Enter to run.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1f1a15]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-mono text-[#8b5a3c] border border-[#1f1a15] rounded hover:bg-[#0f0f0f] transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canRun}
            className="px-3 py-1.5 text-[11px] font-mono text-[#f0ece8] bg-[#6ba86b]/20 border border-[#6ba86b]/40 rounded hover:bg-[#6ba86b]/30 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Play className="w-3 h-3" />
            Run
          </button>
        </div>
      </div>
    </div>,
    container,
  );
}

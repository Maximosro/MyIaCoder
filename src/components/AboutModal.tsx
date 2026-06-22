import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const [version, setVersion] = useState('');
  const [easterEgg, setEasterEgg] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      window.electronAPI.getAppVersion().then((v) => setVersion(v || '0.0.0')).catch(() => setVersion('0.0.0'));
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-[400px] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15]">
          <div className="flex items-center gap-2.5">
            <span className="text-[#d4784a] text-sm">◈</span>
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              ABOUT
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center px-8 py-8 space-y-4">
          {/* Logo */}
          <img
            src="./logo.svg"
            alt="Focusxide"
            className="w-16 h-16 opacity-90"
            style={{ filter: 'drop-shadow(0 0 12px rgba(212,120,74,0.3))' }}
          />

          {/* Name */}
          <h3 className="text-lg font-mono font-semibold text-[#f0ece8] tracking-wide">
            Focusxide Code Manager
          </h3>

          {/* Version badge */}
          <span className="text-xs font-mono text-[#d4784a] bg-[#d4784a]/10 border border-[#d4784a]/20 rounded px-3 py-1">
            {version ? `v${version}` : <span className="inline-block w-10 h-3 bg-[#d4784a]/20 rounded animate-pulse align-middle" />}
          </span>

          {/* Description */}
          <p className="text-xs text-[#8b5a3c] text-center leading-relaxed max-w-[280px]">
            Desktop app to manage multiple projects with integrated AI coding terminals
          </p>

          {/* Divider */}
          <div className="w-full border-t border-[#1f1a15]" />

          {/* Stack */}
          <p className="text-[10px] font-mono text-[#4a2a1a] tracking-wider uppercase whitespace-nowrap">
            Electron · React · TypeScript · TailwindCSS · xterm.js
          </p>

          {/* Credits */}
          <p className="text-[10px] text-[#8b5a3c]">
            by{' '}
            <span
              className="text-[#d4784a] cursor-pointer hover:underline"
              onClick={() => setEasterEgg(true)}
              title="click me"
            >
              Rothar
            </span>
          </p>
          {/* Easter egg overlay */}
          {easterEgg && (
            <div
              className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center cursor-pointer"
              onClick={() => setEasterEgg(false)}
            >
              <img
                src="./granny.gif"
                alt="easter egg"
                className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
              />
              <p className="absolute bottom-8 text-[#8b5a3c] text-xs font-mono">
                click anywhere to close
              </p>
            </div>
          )}
          <p className="text-[9px] text-[#4a2a1a]">
            built with <span className="text-[#d4784a]/80">DeepSeek V4 Pro</span>
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center px-5 py-4 border-t border-[#1f1a15]">
          <button
            onClick={onClose}
            className="px-6 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] transition-all font-mono"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

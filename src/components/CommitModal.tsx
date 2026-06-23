import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, GitCommit, RefreshCw } from 'lucide-react';

interface CommitModalProps {
  open: boolean;
  projectPath: string;
  onClose: () => void;
  onCommitted: () => void;
}

export function CommitModal({ open, projectPath, onClose, onCommitted }: CommitModalProps) {
  const [message, setMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setMessage('');
      setError(null);
      setCommitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
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

  const handleCommit = async () => {
    if (!message.trim() || committing) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await window.electronAPI.gitCommit(projectPath, message.trim());
      if (result.ok) {
        onCommitted();
        onClose();
      } else {
        setError(result.error || 'Commit failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter to commit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
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
            <GitCommit className="w-4 h-4 text-[#d4784a]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              COMMIT
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
            Message
          </label>
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your changes..."
            rows={4}
            className="w-full bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-[12px] font-mono text-[#f0ece8] placeholder:text-[#4a2a1a] focus:border-[#d4784a]/50 focus:outline-none resize-none transition-colors duration-150"
          />
          <p className="text-[10px] font-mono text-[#4a2a1a]">
            Stages all changes (git add -A) before committing. Ctrl+Enter to confirm.
          </p>

          {error && (
            <div className="px-3 py-2 rounded bg-[#e05555]/10 border border-[#e05555]/30">
              <span className="text-[11px] font-mono text-[#e05555]">{error}</span>
            </div>
          )}
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
            onClick={handleCommit}
            disabled={!message.trim() || committing}
            className="px-3 py-1.5 text-[11px] font-mono text-[#f0ece8] bg-[#d4784a]/20 border border-[#d4784a]/40 rounded hover:bg-[#d4784a]/30 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {committing && <RefreshCw className="w-3 h-3 animate-spin" />}
            Commit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

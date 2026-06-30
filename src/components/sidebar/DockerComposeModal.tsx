import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Boxes, RefreshCw, FileSearch, Play } from 'lucide-react';
import type { DockerResult } from '../../../electron/services/docker';

interface DockerComposeModalProps {
  open: boolean;
  onClose: () => void;
  projectPath?: string | null;
}

export function DockerComposeModal({ open, onClose, projectPath }: DockerComposeModalProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DockerResult | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFilePath(null);
    setRunning(false);
    setResult(null);
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  const container = document.getElementById('root') || document.body;

  const handlePick = async () => {
    const picked = await window.electronAPI.pickComposeFile(projectPath ?? undefined);
    if (picked) {
      setFilePath(picked);
      setResult(null);
    }
  };

  const handleRun = async () => {
    if (!filePath || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await window.electronAPI.dockerComposeUp(filePath);
      setResult(res);
      // On failure, also open a live terminal so the user sees the detail.
      if (!res.ok) window.electronAPI.dockerComposeTerminal(filePath);
    } catch (err) {
      setResult({ ok: false, output: err instanceof Error ? err.message : 'docker compose failed' });
    } finally {
      setRunning(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-[520px] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#7b9ec4]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15]">
          <div className="flex items-center gap-2.5">
            <Boxes className="w-4 h-4 text-[#7b9ec4]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              DOCKER COMPOSE UP
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
            Compose file
          </label>
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={filePath ?? ''}
              placeholder="Select a docker-compose.yml…"
              className="flex-1 min-w-0 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-[12px] font-mono text-[#f0ece8] placeholder:text-[#4a2a1a] focus:outline-none"
            />
            <button
              onClick={handlePick}
              className="px-3 py-2 text-[11px] font-mono text-[#7b9ec4] border border-[#1f1a15] rounded hover:bg-[#0a1520] transition-colors duration-150 flex items-center gap-1.5"
            >
              <FileSearch className="w-3.5 h-3.5" />
              Browse
            </button>
          </div>

          <p className="text-[10px] font-mono text-[#4a2a1a]">
            Runs <span className="text-[#8b5a3c]">docker compose -f &lt;file&gt; up -d</span> inside WSL. If it fails, a terminal opens with the live detail.
          </p>

          {result && (
            <div
              className={`px-3 py-2 rounded border ${
                result.ok
                  ? 'bg-[#6ba86b]/10 border-[#6ba86b]/30'
                  : 'bg-[#e05555]/10 border-[#e05555]/30'
              }`}
            >
              <p className={`text-[11px] font-mono mb-1 ${result.ok ? 'text-[#6ba86b]' : 'text-[#e05555]'}`}>
                {result.ok ? 'OK — compose is up' : 'FAILED'}
              </p>
              {result.output && (
                <pre className="text-[10px] font-mono text-[#b0a89a] whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {result.output}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1f1a15]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-mono text-[#8b5a3c] border border-[#1f1a15] rounded hover:bg-[#0f0f0f] transition-colors duration-150"
          >
            Close
          </button>
          <button
            onClick={handleRun}
            disabled={!filePath || running}
            className="px-3 py-1.5 text-[11px] font-mono text-[#f0ece8] bg-[#7b9ec4]/20 border border-[#7b9ec4]/40 rounded hover:bg-[#7b9ec4]/30 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Up
          </button>
        </div>
      </div>
    </div>,
    container,
  );
}

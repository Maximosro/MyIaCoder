import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeftRight, RefreshCw, Check } from 'lucide-react';
import type { GitBranchList } from '../../../electron/services/git';

interface SwitchBranchModalProps {
  open: boolean;
  projectPath: string;
  onClose: () => void;
  onSwitched: () => void;
}

export function SwitchBranchModal({ open, projectPath, onClose, onSwitched }: SwitchBranchModalProps) {
  const [branches, setBranches] = useState<GitBranchList | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFilter('');
    setError(null);
    setSwitching(null);
    setBranches(null);
    setLoading(true);
    window.electronAPI
      .gitListBranches(projectPath)
      .then(setBranches)
      .catch(() => setError('Could not load branches'))
      .finally(() => {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      });
  }, [open, projectPath]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Local branches + remote-only branches (DWIM short name), filtered.
  const items = useMemo(() => {
    if (!branches) return [];
    const localSet = new Set(branches.local);
    const locals = branches.local.map((b) => ({ label: b, target: b, remote: false }));
    const remotes = branches.remote
      .map((r) => ({ full: r, short: r.replace(/^[^/]+\//, '') }))
      .filter((x) => x.short && !localSet.has(x.short))
      .map((x) => ({ label: x.full, target: x.short, remote: true }));
    const all = [...locals, ...remotes];
    const f = filter.trim().toLowerCase();
    return f ? all.filter((i) => i.label.toLowerCase().includes(f)) : all;
  }, [branches, filter]);

  if (!open) return null;
  const container = document.getElementById('root') || document.body;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleSwitch = async (target: string) => {
    if (switching || target === branches?.current) return;
    setSwitching(target);
    setError(null);
    try {
      const result = await window.electronAPI.gitSwitchBranch(projectPath, target);
      if (result.ok) {
        onSwitched();
        onClose();
      } else {
        setError(result.error || 'Branch switch failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Branch switch failed');
    } finally {
      setSwitching(null);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-[440px] max-h-[70vh] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15]">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="w-4 h-4 text-[#d4784a]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              SWITCH BRANCH
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#1f1a15] transition-colors duration-150"
          >
            <X className="w-4 h-4 text-[#8b5a3c]" />
          </button>
        </div>

        {/* Filter */}
        <div className="px-5 pt-4">
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter branches…"
            spellCheck={false}
            className="w-full bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-[12px] font-mono text-[#f0ece8] placeholder:text-[#4a2a1a] focus:border-[#d4784a]/50 focus:outline-none transition-colors duration-150"
          />
        </div>

        {/* List */}
        <div className="px-5 py-3 flex-1 overflow-y-auto min-h-[80px]">
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
              <span className="text-[11px] font-mono text-[#8b5a3c]">loading branches…</span>
            </div>
          )}
          {!loading && items.length === 0 && (
            <span className="text-[11px] font-mono text-[#4a2a1a]">No branches match.</span>
          )}
          {!loading && items.map((item) => {
            const isCurrent = item.target === branches?.current;
            return (
              <button
                key={(item.remote ? 'r:' : 'l:') + item.label}
                onClick={() => handleSwitch(item.target)}
                disabled={isCurrent || !!switching}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left font-mono text-[12px] transition-colors duration-150 ${
                  isCurrent
                    ? 'text-[#6ba86b] cursor-default'
                    : 'text-[#f0ece8] hover:bg-[#1f1a15] disabled:opacity-40'
                }`}
              >
                {isCurrent ? (
                  <Check className="w-3 h-3 flex-shrink-0" />
                ) : switching === item.target ? (
                  <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin text-[#d4784a]" />
                ) : (
                  <span className="w-3 flex-shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
                {item.remote && (
                  <span className="ml-auto text-[9px] text-[#8b5a3c] uppercase tracking-wider flex-shrink-0">remote</span>
                )}
                {isCurrent && (
                  <span className="ml-auto text-[9px] text-[#6ba86b] uppercase tracking-wider flex-shrink-0">current</span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mx-5 mb-4 px-3 py-2 rounded bg-[#e05555]/10 border border-[#e05555]/30">
            <span className="text-[11px] font-mono text-[#e05555]">{error}</span>
          </div>
        )}
      </div>
    </div>,
    container,
  );
}

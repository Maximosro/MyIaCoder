import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, GitBranchPlus, RefreshCw } from 'lucide-react';
import { BRANCH_PREFIXES, sanitizeBranchName } from '../utils/branchPrefixes';
import type { GitBranchList } from '../../electron/services/git';

interface NewBranchModalProps {
  open: boolean;
  projectPath: string;
  onClose: () => void;
  onCreated: () => void;
}

export function NewBranchModal({ open, projectPath, onClose, onCreated }: NewBranchModalProps) {
  const [prefix, setPrefix] = useState<string>(BRANCH_PREFIXES[0]);
  const [name, setName] = useState('');
  const [base, setBase] = useState('');
  const [branches, setBranches] = useState<GitBranchList | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPrefix(BRANCH_PREFIXES[0]);
    setName('');
    setError(null);
    setCreating(false);
    setBranches(null);
    setLoading(true);
    window.electronAPI
      .gitListBranches(projectPath)
      .then((list) => {
        setBranches(list);
        setBase(list.current || list.local[0] || '');
      })
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

  if (!open) return null;

  const container = document.getElementById('root') || document.body;
  const slug = sanitizeBranchName(name);
  const finalName = prefix + slug;
  const canCreate = !!slug && !creating && !loading;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const result = await window.electronAPI.gitCreateBranch(projectPath, finalName, base || undefined);
      if (result.ok) {
        onCreated();
        onClose();
      } else {
        setError(result.error || 'Branch creation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Branch creation failed');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCreate();
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
            <GitBranchPlus className="w-4 h-4 text-[#d4784a]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              NEW BRANCH
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
          {/* Base / origin */}
          <label className="text-[11px] font-mono text-[#8b5a3c] tracking-wider uppercase">
            Start from
          </label>
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            disabled={loading}
            className="w-full bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-[12px] font-mono text-[#f0ece8] focus:border-[#d4784a]/50 focus:outline-none transition-colors duration-150 disabled:opacity-40"
          >
            {loading && <option>loading…</option>}
            {branches && (
              <>
                <optgroup label="Local">
                  {branches.local.map((b) => (
                    <option key={b} value={b}>
                      {b === branches.current ? `${b} (current)` : b}
                    </option>
                  ))}
                </optgroup>
                {branches.remote.length > 0 && (
                  <optgroup label="Remote">
                    {branches.remote.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </optgroup>
                )}
              </>
            )}
          </select>

          {/* Prefix + name */}
          <label className="text-[11px] font-mono text-[#8b5a3c] tracking-wider uppercase">
            Branch
          </label>
          <div className="flex items-stretch gap-2">
            <select
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="bg-[#050505] border border-[#1f1a15] rounded px-2 py-2 text-[12px] font-mono text-[#d4784a] focus:border-[#d4784a]/50 focus:outline-none transition-colors duration-150"
            >
              {BRANCH_PREFIXES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="short-description"
              spellCheck={false}
              className="flex-1 min-w-0 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-[12px] font-mono text-[#f0ece8] placeholder:text-[#4a2a1a] focus:border-[#d4784a]/50 focus:outline-none transition-colors duration-150"
            />
          </div>

          {/* Preview */}
          <p className="text-[10px] font-mono text-[#4a2a1a]">
            {slug
              ? <>Creates <span className="text-[#8b5a3c]">{finalName}</span> from <span className="text-[#8b5a3c]">{base || 'HEAD'}</span>. Ctrl+Enter to confirm.</>
              : <>Type a name. Ctrl+Enter to confirm.</>}
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
            onClick={handleCreate}
            disabled={!canCreate}
            className="px-3 py-1.5 text-[11px] font-mono text-[#f0ece8] bg-[#d4784a]/20 border border-[#d4784a]/40 rounded hover:bg-[#d4784a]/30 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {creating && <RefreshCw className="w-3 h-3 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>,
    container,
  );
}

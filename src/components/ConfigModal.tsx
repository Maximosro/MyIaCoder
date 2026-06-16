import { useState, useEffect, useRef } from 'react';
import { FolderOpen, X } from 'lucide-react';

interface ConfigModalProps {
  open: boolean;
  workspacePath: string;
  plansPath: string;
  onClose: () => void;
  onSave: (workspacePath: string, plansPath: string) => void;
}

export function ConfigModal({ open, workspacePath, plansPath, onClose, onSave }: ConfigModalProps) {
  const [wp, setWp] = useState(workspacePath);
  const [pp, setPp] = useState(plansPath);
  const [saving, setSaving] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setWp(workspacePath);
      setPp(plansPath);
    }
  }, [open, workspacePath, plansPath]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleBrowseWorkspace = async () => {
    const folder = await window.electronAPI.pickFolder('Select Workspace Folder');
    if (folder) setWp(folder);
  };

  const handleBrowsePlans = async () => {
    const folder = await window.electronAPI.pickFolder('Select Plans Folder');
    if (folder) setPp(folder);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(wp, pp);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-[480px] max-h-[90vh] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15]">
          <div className="flex items-center gap-2.5">
            <span className="text-[#d4784a] text-sm">◈</span>
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              CONFIGURATION
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
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Workspace Path */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
              Workspace Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={wp}
                onChange={(e) => setWp(e.target.value)}
                className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                placeholder="C:\Workspace"
                spellCheck={false}
              />
              <button
                onClick={handleBrowseWorkspace}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] hover:border-[#d4784a]/30 transition-all font-mono whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                BROWSE
              </button>
            </div>
            <p className="text-[10px] text-[#4a2a1a] font-mono">
              Root folder scanned for projects with .git directories
            </p>
          </div>

          {/* Plans Path */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
              Plans Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pp}
                onChange={(e) => setPp(e.target.value)}
                className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                placeholder="C:\Users\...\.claude\plans"
                spellCheck={false}
              />
              <button
                onClick={handleBrowsePlans}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] hover:border-[#d4784a]/30 transition-all font-mono whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                BROWSE
              </button>
            </div>
            <p className="text-[10px] text-[#4a2a1a] font-mono">
              Folder containing .claude/plans structure for the plans tree
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#1f1a15]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#e05555] border border-[#1f1a15] transition-all font-mono"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs rounded bg-[#d4784a]/10 hover:bg-[#d4784a]/20 text-[#d4784a] border border-[#d4784a]/30 hover:border-[#d4784a]/50 transition-all font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

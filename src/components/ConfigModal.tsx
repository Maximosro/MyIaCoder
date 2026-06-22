import { useState, useEffect, useRef } from 'react';
import { FolderOpen, X } from 'lucide-react';
import type { ClientsConfig } from '../../electron/preload';

interface ConfigModalProps {
  open: boolean;
  workspacePath: string;
  plansPath: string;
  skillsPath: string;
  promptsPath: string;
  clients: ClientsConfig;
  terminalScrollback: number;
  backgroundMusic: boolean;
  isOnboarding?: boolean;
  onClose: () => void;
  onSave: (workspacePath: string, plansPath: string, skillsPath: string, promptsPath: string, clients: ClientsConfig, terminalScrollback: number, backgroundMusic: boolean) => void;
}

const CLIENT_LABELS: { key: keyof ClientsConfig; label: string; supportLevel?: 'limited' }[] = [
  { key: 'claude', label: 'Claude' },
  { key: 'copilot', label: 'Copilot' },
  { key: 'codewhale', label: 'Codewhale', supportLevel: 'limited' },
  { key: 'reasonix', label: 'Reasonix' },
  { key: 'opencode', label: 'Opencode', supportLevel: 'limited' },
];

export function ConfigModal({ open, workspacePath, plansPath, skillsPath, promptsPath, clients, terminalScrollback, backgroundMusic, isOnboarding, onClose, onSave }: ConfigModalProps) {
  const [wp, setWp] = useState(workspacePath);
  const [pp, setPp] = useState(plansPath);
  const [sp, setSp] = useState(skillsPath);
  const [prp, setPrp] = useState(promptsPath);
  const [cl, setCl] = useState<ClientsConfig>(clients);
  const [scrollback, setScrollback] = useState(terminalScrollback);
  const [bgMusic, setBgMusic] = useState(backgroundMusic);
  const [saving, setSaving] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setWp(workspacePath);
      setPp(plansPath);
      setSp(skillsPath);
      setPrp(promptsPath);
      setCl(clients);
      setScrollback(terminalScrollback);
      setBgMusic(backgroundMusic);
    }
  }, [open, workspacePath, plansPath, skillsPath, promptsPath, clients, terminalScrollback, backgroundMusic]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isOnboarding) onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, isOnboarding]);

  if (!open) return null;

  const handleBrowseWorkspace = async () => {
    const folder = await window.electronAPI.pickFolder('Select Workspace Folder');
    if (folder) setWp(folder);
  };

  const handleBrowsePlans = async () => {
    const folder = await window.electronAPI.pickFolder('Select Plans Folder');
    if (folder) setPp(folder);
  };

  const handleBrowseSkills = async () => {
    const folder = await window.electronAPI.pickFolder('Select Skills Folder');
    if (folder) setSp(folder);
  };

  const handleBrowsePrompts = async () => {
    const folder = await window.electronAPI.pickFolder('Select Prompts Folder');
    if (folder) setPrp(folder);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(wp, pp, sp, prp, cl, scrollback, bgMusic);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current && !isOnboarding) onClose();
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
          {!isOnboarding && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          )}
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

          {/* Skills Path */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
              Skills Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sp}
                onChange={(e) => setSp(e.target.value)}
                className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                placeholder="C:\Users\...\.claude\skills"
                spellCheck={false}
              />
              <button
                onClick={handleBrowseSkills}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] hover:border-[#d4784a]/30 transition-all font-mono whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                BROWSE
              </button>
            </div>
            <p className="text-[10px] text-[#4a2a1a] font-mono">
              Folder containing .claude/skills structure for the skills tree
            </p>
          </div>

          {/* Prompts Path */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
              Prompts Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prp}
                onChange={(e) => setPrp(e.target.value)}
                className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                placeholder="C:\Users\...\.claude\prompts"
                spellCheck={false}
              />
              <button
                onClick={handleBrowsePrompts}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] hover:border-[#d4784a]/30 transition-all font-mono whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                BROWSE
              </button>
            </div>
            <p className="text-[10px] text-[#4a2a1a] font-mono">
              Folder where markdown prompts are created and listed
            </p>
          </div>

          {/* Clients */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
              Clients
            </label>
            <div className="space-y-1.5">
              {CLIENT_LABELS.map(({ key, label, supportLevel }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 px-3 py-2 rounded bg-[#050505] border border-[#1f1a15] hover:border-[#d4784a]/30 cursor-pointer transition-all"
                >
                  <input
                    type="checkbox"
                    checked={cl[key]}
                    onChange={(e) => setCl((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="accent-[#d4784a] w-3.5 h-3.5"
                  />
                  <span className="text-xs font-mono text-[#f0ece8] tracking-wider">
                    {label}
                    {supportLevel === 'limited' && (
                      <span className="ml-1.5 text-[9px] font-mono text-[#8b5a3c] bg-[#0f0f0f] border border-[#1f1a15] rounded px-1.5 py-px align-middle">
                        LIMITED
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-[#4a2a1a] font-mono">
              Disabled clients are hidden from the project launch menu. The Tasks tab is hidden when both Claude and Copilot are off.
            </p>
          </div>

          {/* Terminal Scrollback */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
              Terminal Scrollback
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1000}
                max={100000}
                step={1000}
                value={scrollback}
                onChange={(e) => setScrollback(Number(e.target.value))}
                className="flex-1 accent-[#d4784a] h-1.5"
              />
              <span className="text-xs font-mono text-[#d4784a] min-w-[60px] text-right tabular-nums">
                {scrollback.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-[9px] font-mono text-[#4a2a1a]">
              <span>1K</span>
              <span>100K</span>
            </div>
            <p className="text-[10px] text-[#4a2a1a] font-mono">
              Lines of scrollback history per terminal tab. Higher values use more RAM.
            </p>
          </div>

          {/* Background Music */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
              Audio
            </label>
            <label className="flex items-center gap-2.5 px-3 py-2 rounded bg-[#050505] border border-[#1f1a15] hover:border-[#d4784a]/30 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={bgMusic}
                onChange={(e) => setBgMusic(e.target.checked)}
                className="accent-[#d4784a] w-3.5 h-3.5"
              />
              <span className="text-xs font-mono text-[#f0ece8] tracking-wider">
                Background Music
              </span>
            </label>
            <p className="text-[10px] text-[#4a2a1a] font-mono">
              Play ambient focus music on startup
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#1f1a15]">
          {!isOnboarding && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#e05555] border border-[#1f1a15] transition-all font-mono"
          >
            CANCEL
          </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (isOnboarding && !wp.trim())}
            className="px-4 py-2 text-xs rounded bg-[#d4784a]/10 hover:bg-[#d4784a]/20 text-[#d4784a] border border-[#d4784a]/30 hover:border-[#d4784a]/50 transition-all font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'SAVING...' : isOnboarding ? 'GET STARTED' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

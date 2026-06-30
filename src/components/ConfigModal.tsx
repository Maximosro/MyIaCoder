import { useState, useEffect, useRef } from 'react';
import { FolderOpen, X } from 'lucide-react';
import type { ClientsConfig } from '../../electron/preload';

interface ConfigModalProps {
  open: boolean;
  workspacePath: string;
  plansPath: string;
  skillsPath: string;
  promptsPath: string;
  templatesPath: string;
  clients: ClientsConfig;
  terminalScrollback: number;
  backgroundMusic: boolean;
  useWsl2Git: boolean;
  wslDistro: string;
  isOnboarding?: boolean;
  onClose: () => void;
  onSave: (workspacePath: string, plansPath: string, skillsPath: string, promptsPath: string, templatesPath: string, clients: ClientsConfig, terminalScrollback: number, backgroundMusic: boolean, useWsl2Git: boolean, wslDistro: string) => void;
}

const CLIENT_LABELS: { key: keyof ClientsConfig; label: string; supportLevel?: 'limited' }[] = [
  { key: 'claude', label: 'Claude' },
  { key: 'copilot', label: 'Copilot' },
  { key: 'codewhale', label: 'Codewhale', supportLevel: 'limited' },
  { key: 'reasonix', label: 'Reasonix' },
  { key: 'opencode', label: 'Opencode', supportLevel: 'limited' },
];

const SHORTCUTS = [
  ['Ctrl+Shift+F', 'Buscar proyectos; dentro de terminal, buscar en terminal'],
  ['Ctrl+Tab / Ctrl+Shift+Tab', 'Siguiente / anterior tab'],
  ['Ctrl+1..9', 'Ir a tab por posicion'],
  ['Ctrl+W', 'Cerrar tab activa'],
  ['F5 / Shift+F5', 'Levantar / detener app'],
  ['Alt+F / Alt+G / Alt+T', 'Files / Changes / Tasks'],
  ['Ctrl+B o Alt+B', 'Cambiar rama'],
  ['Ctrl+Alt+N', 'Nueva rama'],
  ['Ctrl+Alt+Enter', 'Commit'],
  ['Ctrl+`', 'Abrir terminal'],
  ['Ctrl+Alt+1..5', 'Claude / Copilot / Reasonix / Codewhale / Opencode'],
  ['Ctrl+Alt+D', 'Docker'],
  ['Ctrl+Shift+R', 'Refrescar'],
  ['Ctrl+S', 'Guardar editor'],
  ['Ctrl+E', 'Bloquear/desbloquear editor'],
  ['Ctrl+M', 'Preview/source markdown'],
] as const;

// ponytail: 4 tabs — general first, advanced last for WSL.
type ConfigTab = 'general' | 'paths' | 'terminal' | 'advanced';

export function ConfigModal({ open, workspacePath, plansPath, skillsPath, promptsPath, templatesPath, clients, terminalScrollback, backgroundMusic, useWsl2Git, wslDistro, isOnboarding, onClose, onSave }: ConfigModalProps) {
  const [wp, setWp] = useState(workspacePath);
  const [pp, setPp] = useState(plansPath);
  const [sp, setSp] = useState(skillsPath);
  const [prp, setPrp] = useState(promptsPath);
  const [tp, setTp] = useState(templatesPath);
  const [td, setTd] = useState('');
  const [cl, setCl] = useState<ClientsConfig>(clients);
  const [scrollback, setScrollback] = useState(terminalScrollback);
  const [bgMusic, setBgMusic] = useState(backgroundMusic);
  const [wsl2Git, setWsl2Git] = useState(useWsl2Git);
  const [distro, setDistro] = useState(wslDistro);
  const [groqKey, setGroqKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ConfigTab>('general');
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setWp(workspacePath);
      setPp(plansPath);
      setSp(skillsPath);
      setPrp(promptsPath);
      setTp(templatesPath);
      setCl(clients);
      setScrollback(terminalScrollback);
      setBgMusic(backgroundMusic);
      setWsl2Git(useWsl2Git);
      setDistro(wslDistro);
      // groqApiKey/todosPath aren't props — read them straight from settings.
      window.electronAPI.getSettings().then((s) => {
        setGroqKey(s.groqApiKey || '');
        setTd(s.todosPath || '');
      });
    }
  }, [open, workspacePath, plansPath, skillsPath, promptsPath, templatesPath, clients, terminalScrollback, backgroundMusic, useWsl2Git, wslDistro]);

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

  const handleBrowseTemplates = async () => {
    const folder = await window.electronAPI.pickFolder('Select Templates Folder');
    if (folder) setTp(folder);
  };

  const handleBrowseTodos = async () => {
    const folder = await window.electronAPI.pickFolder('Select To-Dos Folder');
    if (folder) setTd(folder);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist the Groq key first; onSave (App) re-reads settings and spreads,
      // so this survives without threading through its long signature.
      const s = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({ ...s, groqApiKey: groqKey.trim(), todosPath: td.trim() });
      await onSave(wp, pp, sp, prp, tp, cl, scrollback, bgMusic, wsl2Git, distro.trim() || 'Ubuntu');
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
      <div className="w-[480px] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in">
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

        {/* Tabs */}
        <div className="flex border-b border-[#1f1a15] px-5">
          {(['general', 'paths', 'terminal', 'advanced'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-[11px] font-mono tracking-widest uppercase transition-colors ${
                tab === t
                  ? 'text-[#d4784a] border-b-2 border-[#d4784a] -mb-px'
                  : 'text-[#8b5a3c] hover:text-[#d4784a]/70'
              }`}
            >
              {t === 'general' ? 'GENERAL' : t === 'paths' ? 'PATHS' : t === 'terminal' ? 'TERMINAL' : 'ADVANCED'}
            </button>
          ))}
        </div>

        {/* Body */}
        {/* ponytail: fixed height keeps modal stable across tabs */}
        <div className="h-[60vh] overflow-y-auto px-5 py-5 space-y-5">
          {tab === 'paths' && (
            <>
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

              {/* Templates Path */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
                  Templates Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                    className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                    placeholder="C:\Users\...\.claude\prompt-templates"
                    spellCheck={false}
                  />
                  <button
                    onClick={handleBrowseTemplates}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] hover:border-[#d4784a]/30 transition-all font-mono whitespace-nowrap"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    BROWSE
                  </button>
                </div>
                <p className="text-[10px] text-[#4a2a1a] font-mono">
                  Folder with .md template files for guided prompts
                </p>
              </div>

              {/* To-Dos Path */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
                  To-Dos Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={td}
                    onChange={(e) => setTd(e.target.value)}
                    className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                    placeholder="C:\Users\...\.claude\todos"
                    spellCheck={false}
                  />
                  <button
                    onClick={handleBrowseTodos}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] hover:border-[#d4784a]/30 transition-all font-mono whitespace-nowrap"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    BROWSE
                  </button>
                </div>
                <p className="text-[10px] text-[#4a2a1a] font-mono">
                  External root for per-project To-Do files (&lt;root&gt;/&lt;project&gt;/todos.md)
                </p>
              </div>
            </>
          )}

          {tab === 'terminal' && (
            <>
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
            </>
          )}

          {tab === 'general' && (
            <>
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

              {/* Shortcuts */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
                  Shortcuts
                </label>
                <div className="rounded bg-[#050505] border border-[#1f1a15] divide-y divide-[#1f1a15]/70">
                  {SHORTCUTS.map(([keys, action]) => (
                    <div key={keys} className="flex items-center gap-3 px-3 py-1.5">
                      <kbd className="min-w-[150px] text-[10px] font-mono text-[#d4784a] bg-[#0f0f0f] border border-[#1f1a15] rounded px-1.5 py-0.5">
                        {keys}
                      </kbd>
                      <span className="text-[10px] font-mono text-[#b0a89a]">
                        {action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'advanced' && (
            <>
              {/* Git via WSL2 */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
                  Git Backend
                </label>
                <label className="flex items-center gap-2.5 px-3 py-2 rounded bg-[#050505] border border-[#1f1a15] hover:border-[#d4784a]/30 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={wsl2Git}
                    onChange={(e) => setWsl2Git(e.target.checked)}
                    className="accent-[#d4784a] w-3.5 h-3.5"
                  />
                  <span className="text-xs font-mono text-[#f0ece8] tracking-wider">
                    Git via WSL2
                  </span>
                </label>
                {wsl2Git && (
                  <input
                    type="text"
                    value={distro}
                    onChange={(e) => setDistro(e.target.value)}
                    className="w-full bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                    placeholder="Ubuntu"
                    spellCheck={false}
                  />
                )}
                <p className="text-[10px] text-[#4a2a1a] font-mono">
                  When enabled, git runs inside WSL2 (wsl -d &lt;distro&gt; git ...) against the project at /mnt/c/... instead of native Windows git. Changing this restarts the app.
                </p>
              </div>

              {/* AI curator (Groq) */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-[#8b5a3c] tracking-widest uppercase">
                  IA · Curador de dictado
                </label>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  className="w-full bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 focus:ring-1 focus:ring-[#d4784a]/20 transition-all"
                  placeholder="Groq API key (gsk_...)"
                  spellCheck={false}
                  autoComplete="off"
                />
                <p className="text-[10px] text-[#4a2a1a] font-mono">
                  Clave de Groq (gratis en console.groq.com) para el botón ✨ que cura el dictado. Sin clave, el botón no aparece. Se guarda en settings.json en claro.
                </p>
              </div>
            </>
          )}
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

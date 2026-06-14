import { useState, useRef, useEffect } from 'react';
import { Terminal, X, Plus } from 'lucide-react';
import { TerminalTabComponent } from './TerminalTab';
import type { TerminalTab } from '../types/terminal';
import type { Project } from '../types/project';

interface TerminalPanelProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  activeProject: Project | null;
  onOpenTab: (project: Project, title: string) => void;
  onForceOpenTab: (project: Project, title: string) => void;
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
}

export function TerminalPanel({
  tabs,
  activeTabId,
  activeProject,
  onOpenTab,
  onForceOpenTab,
  onCloseTab,
  onSelectTab,
}: TerminalPanelProps) {
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [promptAction, setPromptAction] = useState<'open' | 'force'>('open');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (promptVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [promptVisible]);

  const handleLaunch = () => {
    if (!activeProject) return;
    setPromptValue(activeProject.name);
    setPromptAction('open');
    setPromptVisible(true);
  };

  const handleNewTab = () => {
    if (!activeProject) return;
    setPromptValue(activeProject.name);
    setPromptAction('force');
    setPromptVisible(true);
  };

  const submitPrompt = () => {
    const title = promptValue.trim() || activeProject?.name || 'terminal';
    setPromptVisible(false);
    if (!activeProject) return;
    if (promptAction === 'force') {
      onForceOpenTab(activeProject, title);
    } else {
      onOpenTab(activeProject, title);
    }
  };

  const cancelPrompt = () => {
    setPromptVisible(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Tab bar — always visible when a project is selected */}
      {activeProject && (
        <div className="flex items-center gap-0 px-2 py-1 bg-[#0a0a0a] border-b border-[#1f1a15] overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-all duration-300 flex-1 min-w-0 border-b-2 font-mono
                ${tab.id === activeTabId
                  ? 'text-[#f0ece8] border-[#d4784a]'
                  : 'text-[#8b5a3c] border-transparent hover:text-[#b0a89a] hover:border-[#8b5a3c]/30'
                }`}
            >
              <Terminal className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${tab.id === activeTabId ? 'text-[#d4784a]' : ''}`} />
              <span className="truncate">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="ml-auto p-0.5 rounded hover:bg-[#1a0a0a] text-[#8b5a3c] hover:text-[#e05555] flex-shrink-0 transition-all duration-200"
                title="Close terminal"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {/* + New tab — only when at least one tab is open */}
          {tabs.length > 0 && (
            <button
              onClick={handleNewTab}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#0f0f0f] text-[#8b5a3c] hover:text-[#d4784a] flex-shrink-0 transition-all duration-200 ml-0.5"
              title="New terminal"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <TerminalTabComponent
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
          />
        ))}

        {/* Prompt overlay */}
        {promptVisible && (
          <div className="absolute inset-0 z-20 flex items-start justify-center pt-20 bg-[#050505]/80 backdrop-blur-sm">
            <div className="bg-[#0a0a0a] border border-[#1f1a15] rounded p-4 w-80 shadow-[0_0_30px_rgba(212,120,74,0.08)] animate-fade-in">
              <p className="text-[10px] font-mono text-[#8b5a3c] tracking-widest uppercase mb-3">
                NEW_TERMINAL
              </p>
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitPrompt();
                  if (e.key === 'Escape') cancelPrompt();
                }}
                className="w-full bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 text-sm font-mono text-[#f0ece8] placeholder-[#4a2a1a] outline-none focus:border-[#d4784a]/50 transition-colors"
                placeholder="Tab title..."
                spellCheck={false}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={submitPrompt}
                  className="flex-1 px-3 py-1.5 text-xs rounded bg-[#d4784a] hover:bg-[#e8956a] text-[#050505] font-mono font-semibold transition-colors"
                >
                  LAUNCH
                </button>
                <button
                  onClick={cancelPrompt}
                  className="flex-1 px-3 py-1.5 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#b0a89a] border border-[#1f1a15] font-mono transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state — no tabs yet */}
        {!promptVisible && tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {activeProject ? (
              <button
                onClick={handleLaunch}
                className="group flex flex-col items-center gap-3 px-8 py-6 bg-[#0a0a0a] border border-[#1f1a15] hover:border-[#d4784a]/40 rounded
                  transition-all duration-500 hover:shadow-[0_0_30px_rgba(212,120,74,0.1)] animate-glow-pulse"
              >
                <Terminal className="w-10 h-10 text-[#d4784a] group-hover:scale-110 transition-transform duration-500 ease-out" />
                <span className="font-mono text-sm text-[#f0ece8] text-glow tracking-wider">
                  LAUNCH_CLAUDE
                  <span className="animate-cursor-blink">_</span>
                </span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Terminal className="w-12 h-12 text-[#1f1a15] animate-float" />
                <p className="font-mono text-xs text-[#4a2a1a] tracking-wider">
                  TERMINAL_READY
                  <span className="text-[#1f1a15]">...</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

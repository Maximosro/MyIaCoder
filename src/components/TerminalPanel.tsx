import { useState, useRef, useEffect } from 'react';
import { Terminal, X, Plus, FileText, Code2, ClipboardList, GitCompare } from 'lucide-react';
import { TerminalTabComponent } from './TerminalTab';
import { FileEditor } from './FileEditor';
import { DiffViewer } from './DiffViewer';
import { UnsavedDialog } from './UnsavedDialog';
import { TodoKanban } from './TodoKanban';
import type { Tab } from '../types/terminal';
import { isFileTab, isTodoTab, isDiffTab, getTabColorClass } from '../types/terminal';
import type { Project } from '../types/project';

interface TerminalPanelProps {
  tabs: Tab[];
  activeTabId: string | null;
  activeProject: Project | null;
  onOpenTab: (project: Project, title: string, command?: string) => void;
  onForceOpenTab: (project: Project, title: string, command?: string) => void;
  onCloseTab: (tabId: string) => Promise<void>;
  onSelectTab: (tabId: string) => void;
  onSaveFile?: (tabId: string, content: string) => Promise<void>;
  onFileDirtyChange?: (tabId: string, isDirty: boolean) => void;
  getFileContent?: (tabId: string) => string | undefined;
}

export function TerminalPanel({
  tabs,
  activeTabId,
  activeProject,
  onOpenTab,
  onForceOpenTab,
  onCloseTab,
  onSelectTab,
  onSaveFile,
  onFileDirtyChange,
  getFileContent,
}: TerminalPanelProps) {
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [promptAction, setPromptAction] = useState<'open' | 'force'>('open');
  const [pendingCommand, setPendingCommand] = useState<string | undefined>(undefined);
  const [showLaunchOverlay, setShowLaunchOverlay] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Unsaved changes dialog state
  const [unsavedDialog, setUnsavedDialog] = useState<{
    open: boolean;
    tabId: string;
    fileName: string;
  }>({ open: false, tabId: '', fileName: '' });

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
    setPendingCommand(undefined); // default: claude
    setPromptVisible(true);
  };

  const handleLaunchVscode = () => {
    if (!activeProject) return;
    window.electronAPI.launchVscode(activeProject.path);
  };

  const handleLaunchCopilot = () => {
    if (!activeProject) return;
    setPromptValue(activeProject.name);
    setPromptAction('open');
    // Store copilot command intent — will be passed when user confirms
    setPendingCommand('copilot');
    setPromptVisible(true);
  };

  const handleNewTab = () => {
    if (!activeProject) return;
    setShowLaunchOverlay(true);
  };

  const submitPrompt = () => {
    const title = promptValue.trim() || activeProject?.name || 'terminal';
    setPromptVisible(false);
    if (!activeProject) return;
    if (promptAction === 'force') {
      onForceOpenTab(activeProject, title, pendingCommand);
    } else {
      onOpenTab(activeProject, title, pendingCommand);
    }
  };

  const cancelPrompt = () => {
    setPromptVisible(false);
  };

  // Close tab with unsaved changes check for file tabs
  const handleCloseTab = (tab: Tab) => {
    if ((isFileTab(tab) || isDiffTab(tab)) && tab.isDirty) {
      setUnsavedDialog({ open: true, tabId: tab.id, fileName: tab.title });
    } else {
      onCloseTab(tab.id);
    }
  };

  const handleUnsavedSave = async () => {
    setUnsavedDialog({ open: false, tabId: '', fileName: '' });
    onCloseTab(unsavedDialog.tabId);
  };

  const handleUnsavedDiscard = () => {
    setUnsavedDialog({ open: false, tabId: '', fileName: '' });
    onCloseTab(unsavedDialog.tabId);
  };

  const handleUnsavedCancel = () => {
    setUnsavedDialog({ open: false, tabId: '', fileName: '' });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Tab bar — visible when a project is selected or any tab is open (e.g. ToDos) */}
      {(activeProject || tabs.length > 0) && (
        <div className="flex items-center gap-0 px-2 py-1 bg-[#0a0a0a] border-b border-[#1f1a15] overflow-x-auto">
          {tabs.map((tab) => {
            const file = isFileTab(tab);
            const diff = isDiffTab(tab);
            const todo = isTodoTab(tab);
            const isActive = tab.id === activeTabId;

            // Accent colors: terminal = copper, copilot = emerald, diff = amber, files = type-dependent, todo = amber
            const accentBorder = todo
              ? 'border-[#d4a44a]'
              : diff
                ? 'border-[#d4a44a]'
                : file
                  ? getTabColorClass(tab.fileType).split(' ')[0]
                  : tab.command === 'copilot'
                    ? 'border-[#6ba86b]'
                    : 'border-[#d4784a]';
            const accentText = todo
              ? 'text-[#d4a44a]'
              : diff
                ? 'text-[#d4a44a]'
                : file
                  ? getTabColorClass(tab.fileType).split(' ')[1]
                  : tab.command === 'copilot'
                    ? 'text-[#6ba86b]'
                    : 'text-[#d4784a]';

            const activeClass = isActive
              ? `${accentBorder} ${accentText}`
              : `${accentBorder}/30 ${accentText}/70 hover:${accentBorder}/60 hover:${accentText}`;

            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-all duration-300 max-w-[220px] min-w-[80px] shrink border-b-2 font-mono ${activeClass}`}
              >
                {/* Icon */}
                {todo ? (
                  <ClipboardList className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${accentText}`} />
                ) : diff ? (
                  <GitCompare className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${accentText}`} />
                ) : file ? (
                  <FileText className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${accentText}`} />
                ) : (
                  <Terminal className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${accentText}`} />
                )}

                <span className="truncate">{tab.title}</span>

                {/* Dirty indicator (yellow dot) */}
                {file && tab.isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a44a] flex-shrink-0" title="Unsaved changes" />
                )}

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab);
                  }}
                  className="ml-auto p-0.5 rounded hover:bg-[#1a0a0a] text-[#8b5a3c] hover:text-[#e05555] flex-shrink-0 transition-all duration-200"
                  title={file ? 'Close editor' : 'Close terminal'}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {/* + New tab — only for terminal tabs */}
          {tabs.length > 0 && (
            <button
              onClick={handleNewTab}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#0f0f0f] text-[#8b5a3c] hover:text-[#d4784a] flex-shrink-0 transition-all duration-200 ml-0.5"
              title="New launch"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? 'absolute inset-0' : 'hidden'}
          >
            {isTodoTab(tab) ? (
              <TodoKanban />
            ) : isDiffTab(tab) ? (
              <DiffViewer
                fileName={tab.title.replace(' (diff)', '')}
                projectPath={tab.projectPath}
                filePath={tab.filePath}
              />
            ) : isFileTab(tab) ? (
              <FileEditor
                tab={tab}
                initialContent={getFileContent?.(tab.id) ?? ''}
                onSave={async (content) => {
                  await onSaveFile?.(tab.id, content);
                }}
                onDirtyChange={(dirty) => {
                  onFileDirtyChange?.(tab.id, dirty);
                }}
              />
            ) : (
              <TerminalTabComponent
                tab={tab}
                isActive={tab.id === activeTabId}
              />
            )}
          </div>
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

        {/* Launch overlay — shown when + is clicked on tab bar */}
        {showLaunchOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050505]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <p className="text-[10px] font-mono text-[#8b5a3c] tracking-widest uppercase">
                LAUNCH_TERMINAL
                <span className="animate-cursor-blink">_</span>
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowLaunchOverlay(false);
                    handleLaunch();
                  }}
                  className="group flex flex-col items-center gap-3 px-8 py-6 bg-[#0a0a0a] border border-[#1f1a15] hover:border-[#d4784a]/40 rounded cursor-pointer
                    transition-all duration-500 hover:scale-[1.02] hover:bg-[#1a0f0a] hover:shadow-[0_0_30px_rgba(212,120,74,0.15)] animate-glow-pulse"
                >
                  <Terminal className="w-10 h-10 text-[#d4784a] group-hover:scale-110 transition-transform duration-500 ease-out" />
                  <span className="font-mono text-sm text-[#f0ece8] text-glow tracking-wider">
                    LAUNCH_CLAUDE
                    <span className="animate-cursor-blink">_</span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowLaunchOverlay(false);
                    handleLaunchCopilot();
                  }}
                  className="group flex flex-col items-center gap-3 px-8 py-6 bg-[#0a0a0a] border border-[#1a1a0f] hover:border-[#6ba86b]/40 rounded cursor-pointer
                    transition-all duration-500 hover:scale-[1.02] hover:bg-[#0a1a0e] hover:shadow-[0_0_30px_rgba(107,168,107,0.15)] animate-glow-pulse-copilot"
                >
                  <svg
                    className="w-10 h-10 text-[#6ba86b] group-hover:scale-110 transition-transform duration-500 ease-out"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2 3 22h6.5l2.5-7 2.5 7H21L12 2z" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  <span className="font-mono text-sm text-[#f0ece8] text-glow-copilot tracking-wider">
                    LAUNCH_COPILOT
                    <span className="animate-cursor-blink">_</span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowLaunchOverlay(false);
                    handleLaunchVscode();
                  }}
                  className="group flex flex-col items-center gap-3 px-8 py-6 bg-[#0a0a0a] border border-[#0f1a25] hover:border-[#3388cc]/40 rounded cursor-pointer
                    transition-all duration-500 hover:scale-[1.02] hover:bg-[#0a1520] hover:shadow-[0_0_30px_rgba(51,136,204,0.15)] animate-glow-pulse-vscode"
                >
                  <Code2 className="w-10 h-10 text-[#3388cc] group-hover:scale-110 transition-transform duration-500 ease-out" />
                  <span className="font-mono text-sm text-[#f0ece8] text-glow-vscode tracking-wider">
                    LAUNCH_VSCODE
                    <span className="animate-cursor-blink">_</span>
                  </span>
                </button>
              </div>
              <button
                onClick={() => setShowLaunchOverlay(false)}
                className="px-4 py-1.5 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#b0a89a] border border-[#1f1a15] font-mono transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Empty state — no tabs yet */}
        {!promptVisible && !showLaunchOverlay && tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {activeProject ? (
              <div className="flex gap-4">
                <button
                  onClick={handleLaunch}
                  className="group flex flex-col items-center gap-3 px-8 py-6 bg-[#0a0a0a] border border-[#1f1a15] hover:border-[#d4784a]/40 rounded cursor-pointer
                    transition-all duration-500 hover:scale-[1.02] hover:bg-[#1a0f0a] hover:shadow-[0_0_30px_rgba(212,120,74,0.15)] animate-glow-pulse"
                >
                  <Terminal className="w-10 h-10 text-[#d4784a] group-hover:scale-110 transition-transform duration-500 ease-out" />
                  <span className="font-mono text-sm text-[#f0ece8] text-glow tracking-wider">
                    LAUNCH_CLAUDE
                    <span className="animate-cursor-blink">_</span>
                  </span>
                </button>
                <button
                  onClick={handleLaunchCopilot}
                  className="group flex flex-col items-center gap-3 px-8 py-6 bg-[#0a0a0a] border border-[#1a1a0f] hover:border-[#6ba86b]/40 rounded cursor-pointer
                    transition-all duration-500 hover:scale-[1.02] hover:bg-[#0a1a0e] hover:shadow-[0_0_30px_rgba(107,168,107,0.15)] animate-glow-pulse-copilot"
                >
                  <svg
                    className="w-10 h-10 text-[#6ba86b] group-hover:scale-110 transition-transform duration-500 ease-out"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2 3 22h6.5l2.5-7 2.5 7H21L12 2z" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  <span className="font-mono text-sm text-[#f0ece8] text-glow-copilot tracking-wider">
                    LAUNCH_COPILOT
                    <span className="animate-cursor-blink">_</span>
                  </span>
                </button>
                <button
                  onClick={handleLaunchVscode}
                  className="group flex flex-col items-center gap-3 px-8 py-6 bg-[#0a0a0a] border border-[#0f1a25] hover:border-[#3388cc]/40 rounded cursor-pointer
                    transition-all duration-500 hover:scale-[1.02] hover:bg-[#0a1520] hover:shadow-[0_0_30px_rgba(51,136,204,0.15)] animate-glow-pulse-vscode"
                >
                  <Code2 className="w-10 h-10 text-[#3388cc] group-hover:scale-110 transition-transform duration-500 ease-out" />
                  <span className="font-mono text-sm text-[#f0ece8] text-glow-vscode tracking-wider">
                    LAUNCH_VSCODE
                    <span className="animate-cursor-blink">_</span>
                  </span>
                </button>
              </div>
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

      {/* Unsaved changes dialog */}
      <UnsavedDialog
        open={unsavedDialog.open}
        fileName={unsavedDialog.fileName}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
    </div>
  );
}

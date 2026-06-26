import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, X, FileText, GitCompare, Sparkles, Brain, Bot, Cpu, SquareTerminal } from 'lucide-react';
import { TerminalTab } from './TerminalTab';
import { UnsavedDialog } from './UnsavedDialog';
import { CloseTerminalDialog } from './CloseTerminalDialog';
import { FileEditor } from './FileEditor';
import { DiffViewer } from './DiffViewer';
import type { Tab } from '../types/tab';
import { isFileTab, isDiffTab, isTerminalTab } from '../types/tab';
import { getTabColorClass, getCommandColor, getCommandColorClass } from '../utils/tabUtils';
import type { Project } from '../types/project';
import { ProjectInfo } from './ProjectInfo';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  /** Called when a terminal tab receives PTY output. Propagated from App → useTabs.markTabBusy. */
  onTabActivity?: (tabId: string) => void;
  /** Called when the user finishes dragging a tab to a new position. */
  onReorderTabs: (fromIndex: number, toIndex: number) => void;
  /** External launch trigger from Sidebar. When tick increments, shows the name prompt. */
  launchTrigger: { command?: string; force: boolean; tick: number };
  /** External close-active-tab trigger from App shortcuts. */
  closeTrigger?: number;
  /** External close-all-tabs trigger from App shortcuts. */
  closeAllTrigger?: number;
  /** Terminal scrollback lines for new terminal tabs (from settings). */
  scrollback?: number;
}

// ── Sortable tab item (drag handle = entire tab, close button excluded) ──

interface SortableTabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: (tabId: string) => void;
  onClose: (tab: Tab) => void;
}

function SortableTabItem({ tab, isActive, onSelect, onClose }: SortableTabItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const isAiTab = tab.command === 'claude' || tab.command === 'copilot' || tab.command === 'reasonix' || tab.command === 'codewhale' || tab.command === 'opencode';
  const isBusy = isAiTab && tab.busy && !isActive;
  const busyGlowClass = isBusy ? 'animate-tab-busy-glow' : '';
  const busyStyle = isBusy ? (() => {
    const c = getCommandColor(tab.command);
    return {
      '--busy-bg': c + '0A',
      '--busy-glow': c + '0F',
      '--busy-glow-strong': c + '24',
    } as React.CSSProperties;
  })() : undefined;

  // ── Style composition: DnD only during drag, busy only when active ──
  // ponytail: idle state = no inline style (preserves CSS animation from className)

  const dndTransform = CSS.Transform.toString(transform);

  let combinedStyle: React.CSSProperties | undefined;
  if (isDragging) {
    combinedStyle = {
      transform: dndTransform,
      transition,
      opacity: 0.5,
      ...busyStyle,
    };
  } else if (busyStyle) {
    combinedStyle = {
      transform: dndTransform,
      transition,
      ...busyStyle,
    };
  }

  const file = isFileTab(tab);
  const diff = isDiffTab(tab);

  // Color: all tab types use Tailwind text-[color] classes (same mechanism as JSON tabs)
  const accentText = diff
    ? 'text-[#d4a44a]'
    : file
      ? getTabColorClass(tab.fileType)
      : getCommandColorClass(tab.command);

  // Icon: map command to distinctive lucide icon (matching Sidebar menu)
  const IconComponent = diff ? GitCompare
    : file ? FileText
    : tab.command === 'copilot' ? Sparkles
    : tab.command === 'reasonix' ? Brain
    : tab.command === 'codewhale' ? Bot
    : tab.command === 'opencode' ? Cpu
    : tab.command === 'terminal' ? SquareTerminal
    : Terminal;

  const activeClass = isActive
    ? `bg-[#050505] -mb-[1px] border-b border-[#050505] ${accentText}`
    : `bg-transparent hover:bg-[#0f0f0f] ${accentText}/70 hover:${accentText}`;

  return (
    <div
      ref={setNodeRef}
      style={combinedStyle}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(tab.id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-all duration-200 max-w-[220px] min-w-[80px] shrink font-mono select-none rounded-t-md ${activeClass} ${busyGlowClass}`}
    >
      <IconComponent
        className="w-3 h-3 flex-shrink-0 transition-colors duration-300"
      />

      <span className="truncate">{tab.title}</span>

      {file && tab.isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#d4a44a] flex-shrink-0" title="Unsaved changes" />
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-auto p-0.5 rounded hover:bg-[#1a0a0a] text-[#8b5a3c] hover:text-[#e05555] flex-shrink-0 transition-all duration-200"
        title={file ? 'Close editor' : 'Close terminal'}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
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
  onTabActivity,
  onReorderTabs,
  launchTrigger,
  closeTrigger,
  closeAllTrigger,
  scrollback,
}: TerminalPanelProps) {
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [promptAction, setPromptAction] = useState<'open' | 'force'>('open');
  const [pendingCommand, setPendingCommand] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track live editor content so handleUnsavedSave can access the latest edits
  const editorContentRef = useRef<Map<string, string>>(new Map());

  // Unsaved changes dialog state
  const [unsavedDialog, setUnsavedDialog] = useState<{
    open: boolean;
    tabId: string;
    fileName: string;
  }>({ open: false, tabId: '', fileName: '' });

  // Close terminal confirmation dialog state
  const [closeTerminalDialog, setCloseTerminalDialog] = useState<{
    open: boolean;
    tabId: string;
    tabTitle: string;
  }>({ open: false, tabId: '', tabTitle: '' });

  useEffect(() => {
    if (promptVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [promptVisible]);

  // External launch trigger (from Sidebar) — show the name prompt
  useEffect(() => {
    if (launchTrigger.tick === 0 || !activeProject) return;
    setPromptValue(activeProject.name);
    setPromptAction(launchTrigger.force ? 'force' : 'open');
    setPendingCommand(launchTrigger.command);
    setPromptVisible(true);
  }, [launchTrigger.tick]);

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

  // ponytail: close-all queue — sequential close respecting dialogs, cancel stops the queue
  const closeAllQueueRef = useRef<string[]>([]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const onCloseTabRef = useRef(onCloseTab);
  onCloseTabRef.current = onCloseTab;

  const processCloseAllNext = useCallback(() => {
    while (closeAllQueueRef.current.length > 0) {
      const nextId = closeAllQueueRef.current.shift()!;
      const tab = tabsRef.current.find((t) => t.id === nextId);
      if (tab) {
        // ponytail: defer to next tick so React has flushed and refs are fresh
        if (isTerminalTab(tab)) {
          setCloseTerminalDialog({ open: true, tabId: tab.id, tabTitle: tab.title });
        } else if ((isFileTab(tab) || isDiffTab(tab)) && tab.isDirty) {
          setUnsavedDialog({ open: true, tabId: tab.id, fileName: tab.title });
        } else {
          onCloseTabRef.current(tab.id).then(() => processCloseAllNext());
        }
        return;
      }
    }
  }, []);

  // Close tab: terminal tabs show confirmation dialog; file/diff tabs check for unsaved changes
  const handleCloseTab = (tab: Tab) => {
    if (isTerminalTab(tab)) {
      setCloseTerminalDialog({ open: true, tabId: tab.id, tabTitle: tab.title });
    } else if ((isFileTab(tab) || isDiffTab(tab)) && tab.isDirty) {
      setUnsavedDialog({ open: true, tabId: tab.id, fileName: tab.title });
    } else {
      onCloseTab(tab.id);
    }
  };

  useEffect(() => {
    if (!closeTrigger) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) handleCloseTab(activeTab);
  }, [closeTrigger]);

  useEffect(() => {
    if (!closeAllTrigger) return;
    closeAllQueueRef.current = tabs.map((t) => t.id);
    processCloseAllNext();
  }, [closeAllTrigger]);

  const handleCloseTerminalConfirm = async () => {
    const tabId = closeTerminalDialog.tabId;
    setCloseTerminalDialog({ open: false, tabId: '', tabTitle: '' });
    try {
      await onCloseTabRef.current(tabId);
    } finally {
      processCloseAllNext();
    }
  };

  const handleCloseTerminalCancel = () => {
    setCloseTerminalDialog({ open: false, tabId: '', tabTitle: '' });
    closeAllQueueRef.current = []; // ponytail: cancel stops the queue
  };

  const handleUnsavedSave = async () => {
    const tabId = unsavedDialog.tabId;
    setUnsavedDialog({ open: false, tabId: '', fileName: '' });
    const content = editorContentRef.current.get(tabId) ?? getFileContent?.(tabId) ?? '';
    if (content !== undefined) {
      await onSaveFile?.(tabId, content);
    }
    try {
      await onCloseTabRef.current(tabId);
    } finally {
      processCloseAllNext();
    }
  };

  const handleUnsavedDiscard = async () => {
    const tabId = unsavedDialog.tabId;
    setUnsavedDialog({ open: false, tabId: '', fileName: '' });
    try {
      await onCloseTabRef.current(tabId);
    } finally {
      processCloseAllNext();
    }
  };

  const handleUnsavedCancel = () => {
    setUnsavedDialog({ open: false, tabId: '', fileName: '' });
    closeAllQueueRef.current = []; // ponytail: cancel stops the queue
  };

  // ── Drag & drop sensors ────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex((t) => t.id === active.id);
    const newIndex = tabs.findIndex((t) => t.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderTabs(oldIndex, newIndex);
    }
  }, [tabs, onReorderTabs]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
      {/* Tab bar — visible when a project is selected or any tab is open */}
      {(activeProject || tabs.length > 0) && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-end gap-0 px-2 pt-1 pb-0 bg-[#0a0a0a] border-b border-[#1f1a15] overflow-x-auto overflow-y-hidden flex-nowrap">
              {tabs.map((tab) => (
                <SortableTabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onSelect={onSelectTab}
                  onClose={handleCloseTab}
                />
              ))}
              {/* TailwindCSS safelist: /70 opacity variants for runtime template-literal class construction. */}
              <span className="text-[#6ba86b]/70 text-[#7b9ec4]/70 text-[#e05555]/70 text-[#d4a44a]/70 text-[#4ab8b8]/70 text-[#d4784a]/70 text-[#a98bd4]/70 text-[#b0a89a]/70 text-[#c4a36b]/70 text-[#6bc4b0]/70" />
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Content area */}
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? 'absolute inset-0' : 'hidden'}
          >
            {isDiffTab(tab) ? (
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
                onContentChange={(content) => {
                  editorContentRef.current.set(tab.id, content);
                }}
              />
            ) : (
              <TerminalTab
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivity={onTabActivity}
                scrollback={scrollback}
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

        {/* Empty state — no tabs yet */}
        {!promptVisible && tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {!activeProject && (
              <div className="relative w-[70%] min-w-[520px] animate-fade-in">
                {/* GIF with radial fade to background */}
                <div
                  className="w-full"
                  style={{
                    maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 72%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 72%)',
                  }}
                >
                  <img
                    src="./select-project.gif"
                    alt="Focusxide"
                    className="w-full"
                  />
                </div>
                {/* SELECT_PROJECT floating over the GIF */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-[#050505]/80 backdrop-blur-sm border border-[#1f1a15]/50 rounded-lg px-5 py-2.5">
                    <ProjectInfo project={activeProject} />
                  </div>
                </div>
              </div>
            )}
            {activeProject && <ProjectInfo project={activeProject} />}
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

      {/* Close terminal confirmation dialog */}
      <CloseTerminalDialog
        open={closeTerminalDialog.open}
        tabTitle={closeTerminalDialog.tabTitle}
        onConfirm={handleCloseTerminalConfirm}
        onCancel={handleCloseTerminalCancel}
      />
    </div>
  );
}

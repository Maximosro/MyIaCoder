import { useState } from 'react';
import { FolderOpen, RefreshCw, BookOpen, Sparkles, FilePlus, LayoutTemplate, FileBox } from 'lucide-react';
import type { TreeNode } from '../types/project';
import { TreeNodeItem } from './TreeNodeItem';
import { GuidedPromptModal } from './GuidedPromptModal';

type PanelTab = 'plans' | 'skills' | 'prompts';
type PromptSubTab = 'prompt' | 'template';
type TreeExpansionKey = PanelTab | 'templates';

interface PlansPanelTabsProps {
  plansTree: TreeNode[];
  plansLoading: boolean;
  plansError: string | null;
  onRefreshPlans: () => void;
  skillsTree: TreeNode[];
  skillsLoading: boolean;
  skillsError: string | null;
  onRefreshSkills: () => void;
  promptsTree: TreeNode[];
  promptsLoading: boolean;
  promptsError: string | null;
  onRefreshPrompts: () => void;
  templatesTree: TreeNode[];
  templatesLoading: boolean;
  templatesError: string | null;
  onRefreshTemplates: () => void;
  onCreatePrompt: (name: string, content?: string) => void | Promise<void>;
  onCreateTemplate: (name: string) => void | Promise<void>;
  onFileClick?: (filePath: string) => void;
  onDeleteFile?: (filePath: string) => void;
}

export function PlansPanelTabs({
  plansTree,
  plansLoading,
  plansError,
  onRefreshPlans,
  skillsTree,
  skillsLoading,
  skillsError,
  onRefreshSkills,
  promptsTree,
  promptsLoading,
  promptsError,
  onRefreshPrompts,
  templatesTree,
  templatesLoading,
  templatesError,
  onRefreshTemplates,
  onCreatePrompt,
  onCreateTemplate,
  onFileClick,
  onDeleteFile,
}: PlansPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('plans');
  const [promptSubTab, setPromptSubTab] = useState<PromptSubTab>('prompt');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [expandedByTree, setExpandedByTree] = useState<Record<TreeExpansionKey, Set<string>>>(() => ({
    plans: new Set(),
    skills: new Set(),
    prompts: new Set(),
    templates: new Set(),
  }));

  const tabBaseClass =
    'flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-all duration-300 max-w-[160px] min-w-[80px] shrink border-b-2 font-mono';
  const tabClass = (isActive: boolean) =>
    isActive
      ? `${tabBaseClass} border-[#d4784a] text-[#d4784a]`
      : `${tabBaseClass} border-transparent text-[#8b5a3c]/70 hover:text-[#d4784a] hover:border-[#d4784a]/30`;

  const subTabBaseClass =
    'px-2 py-1 text-[10px] font-mono cursor-pointer transition-all duration-200 border-b';
  const subTabClass = (isActive: boolean) =>
    isActive
      ? `${subTabBaseClass} border-[#d4784a] text-[#d4784a]`
      : `${subTabBaseClass} border-transparent text-[#8b5a3c]/60 hover:text-[#d4784a]`;

  const TABS: Record<PanelTab, {
    label: string;
    Icon: typeof FolderOpen;
  }> = {
    plans: { label: '/Plans', Icon: FolderOpen },
    skills: { label: '/Skills', Icon: BookOpen },
    prompts: { label: '/Prompt', Icon: Sparkles },
  };

  // Resolve current tree/loading/error based on active tab + sub-tab
  const getActiveData = () => {
    if (activeTab === 'plans') return { tree: plansTree, loading: plansLoading, error: plansError, refresh: onRefreshPlans };
    if (activeTab === 'skills') return { tree: skillsTree, loading: skillsLoading, error: skillsError, refresh: onRefreshSkills };
    // prompts tab — depends on sub-tab
    if (promptSubTab === 'template') return { tree: templatesTree, loading: templatesLoading, error: templatesError, refresh: onRefreshTemplates };
    return { tree: promptsTree, loading: promptsLoading, error: promptsError, refresh: onRefreshPrompts };
  };

  const active = getActiveData();
  const activeTreeKey: TreeExpansionKey = activeTab === 'prompts' && promptSubTab === 'template' ? 'templates' : activeTab;
  const activeLabel = activeTab === 'prompts' && promptSubTab === 'template' ? '/Template' : TABS[activeTab].label;
  const ActiveIcon = activeTab === 'prompts' && promptSubTab === 'template' ? FileBox : TABS[activeTab].Icon;

  const toggleActivePath = (path: string) => {
    setExpandedByTree((prev) => {
      const nextSet = new Set(prev[activeTreeKey]);
      if (nextSet.has(path)) nextSet.delete(path);
      else nextSet.add(path);
      return { ...prev, [activeTreeKey]: nextSet };
    });
  };

  const switchTab = (tab: PanelTab) => {
    setActiveTab(tab);
    setCreating(false);
    setNewName('');
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    if (activeTab === 'prompts' && promptSubTab === 'template') {
      await onCreateTemplate(name);
    } else {
      await onCreatePrompt(name);
    }
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="border-t border-[#1f1a15] flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-2 py-1 bg-[#0a0a0a] border-b border-[#1f1a15]">
        {(Object.keys(TABS) as PanelTab[]).map((tab) => {
          const { label, Icon } = TABS[tab];
          const isActive = activeTab === tab;
          return (
            <button key={tab} onClick={() => switchTab(tab)} className={tabClass(isActive)}>
              <Icon className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${isActive ? 'text-[#d4784a]' : 'text-[#8b5a3c]/70'}`} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Sub-tab bar — only when prompts tab is active */}
      {activeTab === 'prompts' && (
        <div className="flex items-center gap-0 px-3 py-0.5 bg-[#070707] border-b border-[#1f1a15]">
          <button onClick={() => { setPromptSubTab('prompt'); setCreating(false); }} className={subTabClass(promptSubTab === 'prompt')}>
            /Prompt
          </button>
          <button onClick={() => { setPromptSubTab('template'); setCreating(false); }} className={subTabClass(promptSubTab === 'template')}>
            /Template
          </button>
        </div>
      )}

      {/* Active tab content */}
      <div className="flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            <ActiveIcon className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0" />
            <span className="text-[10px] font-mono font-semibold text-[#f0ece8] tracking-wider">
              {activeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Guided prompt — only on /Prompt sub-tab */}
            {activeTab === 'prompts' && promptSubTab === 'prompt' && (
              <button
                onClick={() => setGuidedOpen(true)}
                className="p-1 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a]"
                title="Guided prompt (template)"
              >
                <LayoutTemplate className="w-3 h-3" />
              </button>
            )}
            {/* Create md — visible on prompts tab (both sub-tabs) */}
            {activeTab === 'prompts' && (
              <button
                onClick={() => setCreating((v) => !v)}
                className="p-1 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a]"
                title="Create md"
              >
                <FilePlus className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={active.refresh}
              disabled={active.loading}
              className="p-1 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a] disabled:opacity-30"
              title={`Refresh ${activeLabel} tree`}
            >
              <RefreshCw className={`w-3 h-3 ${active.loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Inline create row — prompts tab (both sub-tabs) */}
        {activeTab === 'prompts' && creating && (
          <div className="flex items-center gap-1.5 px-3 pb-2 animate-fade-in">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate();
                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
              }}
              placeholder="name.md"
              spellCheck={false}
              className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-2 py-1 text-[11px] font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 transition-all"
            />
            <button
              onClick={submitCreate}
              className="px-2 py-1 text-[10px] font-mono bg-[#d4784a]/15 text-[#d4784a] border border-[#d4784a]/30 rounded hover:bg-[#d4784a]/30 transition-all"
            >
              CREATE
            </button>
          </div>
        )}

        {/* Body */}
        <div className="max-h-[40vh] overflow-y-auto px-1 pb-2">
          {/* Loading state */}
          {active.loading && active.tree.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-3.5 h-3.5 text-[#d4784a] animate-spin" />
            </div>
          )}

          {/* Error state */}
          {active.error && (
            <div className="px-2 py-4 text-center animate-fade-in">
              <p className="text-[#e05555] text-[10px] font-mono">{active.error}</p>
              <button
                onClick={active.refresh}
                className="mt-1 text-[10px] font-mono text-[#d4784a] hover:text-[#e8956a] transition-colors tracking-wider"
              >
                RETRY_
              </button>
            </div>
          )}

          {/* Empty state */}
          {!active.loading && !active.error && active.tree.length === 0 && (
            <div className="px-2 py-4 text-center animate-fade-in">
              <p className="text-[#8b5a3c] text-[10px] font-mono tracking-wider">
                NO_FILES
              </p>
            </div>
          )}

          {/* Tree nodes */}
          {!active.loading &&
            active.tree.map((node) => (
              <TreeNodeItem
                key={node.path}
                node={node}
                depth={0}
                onFileClick={onFileClick}
                onDeleteFile={onDeleteFile}
                expandedPaths={expandedByTree[activeTreeKey]}
                onTogglePath={toggleActivePath}
              />
            ))}
        </div>
      </div>
      <GuidedPromptModal
        open={guidedOpen}
        onClose={() => setGuidedOpen(false)}
        onCreate={(n, content) => onCreatePrompt(n, content)}
      />
    </div>
  );
}

import { useState } from 'react';
import { FolderOpen, RefreshCw, ClipboardList, BookOpen } from 'lucide-react';
import type { TreeNode } from '../types/project';
import { TreeNodeItem } from './RpiPlansTree';

type PanelTab = 'plans' | 'skills';

interface RpiPanelTabsProps {
  plansTree: TreeNode[];
  plansLoading: boolean;
  plansError: string | null;
  onRefreshPlans: () => void;
  skillsTree: TreeNode[];
  skillsLoading: boolean;
  skillsError: string | null;
  onRefreshSkills: () => void;
  onOpenTodos: () => void;
  onFileClick?: (filePath: string) => void;
  onDeleteFile?: (filePath: string) => void;
}

export function RpiPanelTabs({
  plansTree,
  plansLoading,
  plansError,
  onRefreshPlans,
  skillsTree,
  skillsLoading,
  skillsError,
  onRefreshSkills,
  onOpenTodos,
  onFileClick,
  onDeleteFile,
}: RpiPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('plans');

  const tabBaseClass =
    'flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-all duration-300 max-w-[160px] min-w-[80px] shrink border-b-2 font-mono';

  const plansActive = activeTab === 'plans';
  const skillsActive = activeTab === 'skills';

  const plansTabClass = plansActive
    ? `${tabBaseClass} border-[#d4784a] text-[#d4784a]`
    : `${tabBaseClass} border-transparent text-[#8b5a3c]/70 hover:text-[#d4784a] hover:border-[#d4784a]/30`;

  const skillsTabClass = skillsActive
    ? `${tabBaseClass} border-[#d4784a] text-[#d4784a]`
    : `${tabBaseClass} border-transparent text-[#8b5a3c]/70 hover:text-[#d4784a] hover:border-[#d4784a]/30`;

  const activeTree = plansActive ? plansTree : skillsTree;
  const activeLoading = plansActive ? plansLoading : skillsLoading;
  const activeError = plansActive ? plansError : skillsError;
  const activeRefresh = plansActive ? onRefreshPlans : onRefreshSkills;
  const activeLabel = plansActive ? '/Plans' : '/Skills';

  return (
    <div className="border-t border-[#1f1a15] flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-2 py-1 bg-[#0a0a0a] border-b border-[#1f1a15]">
        {/* Plans tab */}
        <button
          onClick={() => setActiveTab('plans')}
          className={plansTabClass}
        >
          <FolderOpen className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${plansActive ? 'text-[#d4784a]' : 'text-[#8b5a3c]/70'}`} />
          <span className="truncate">/Plans</span>
        </button>

        {/* Skills tab */}
        <button
          onClick={() => setActiveTab('skills')}
          className={skillsTabClass}
        >
          <BookOpen className={`w-3 h-3 flex-shrink-0 transition-colors duration-300 ${skillsActive ? 'text-[#d4784a]' : 'text-[#8b5a3c]/70'}`} />
          <span className="truncate">/Skills</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ToDos button — always visible */}
        <button
          onClick={onOpenTodos}
          className="p-1 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4a44a] flex-shrink-0"
          title="ToDos — Kanban board"
        >
          <ClipboardList className="w-3 h-3" />
        </button>
      </div>

      {/* Active tab content */}
      <div className="flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            {plansActive ? (
              <FolderOpen className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0" />
            ) : (
              <BookOpen className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0" />
            )}
            <span className="text-[10px] font-mono font-semibold text-[#f0ece8] tracking-wider">
              {activeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={activeRefresh}
              disabled={activeLoading}
              className="p-1 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a] disabled:opacity-30"
              title={`Refresh ${activeLabel} tree`}
            >
              <RefreshCw className={`w-3 h-3 ${activeLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[40vh] overflow-y-auto px-1 pb-2">
          {/* Loading state */}
          {activeLoading && activeTree.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="w-3.5 h-3.5 text-[#d4784a] animate-spin" />
            </div>
          )}

          {/* Error state */}
          {activeError && (
            <div className="px-2 py-4 text-center animate-fade-in">
              <p className="text-[#e05555] text-[10px] font-mono">{activeError}</p>
              <button
                onClick={activeRefresh}
                className="mt-1 text-[10px] font-mono text-[#d4784a] hover:text-[#e8956a] transition-colors tracking-wider"
              >
                RETRY_
              </button>
            </div>
          )}

          {/* Empty state */}
          {!activeLoading && !activeError && activeTree.length === 0 && (
            <div className="px-2 py-4 text-center animate-fade-in">
              <p className="text-[#8b5a3c] text-[10px] font-mono tracking-wider">
                RPI_PATH_NOT_FOUND
              </p>
            </div>
          )}

          {/* Tree nodes */}
          {!activeLoading &&
            activeTree.map((node) => (
              <TreeNodeItem
                key={node.path}
                node={node}
                depth={0}
                onFileClick={onFileClick}
                onDeleteFile={onDeleteFile}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

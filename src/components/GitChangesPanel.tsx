import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Terminal,
  RefreshCw,
  Code2,
  GitBranch,
  GitCommit,
  Plus,
  Minus,
  Edit3,
  Trash2,
  FileQuestion,
  FileText,
  FolderGit2,
  Sparkles,
} from 'lucide-react';
import { useGitChanges } from '../hooks/useGitChanges';
import { getBranchStyle, getBranchLabel } from '../types/project';
import type { Project, GitChange } from '../types/project';

interface GitChangesPanelProps {
  project: Project;
  onOpenTab: (project: Project, title: string, command?: string) => void;
  onForceOpenTab: (project: Project, title: string, command?: string) => void;
  onLaunchVscode: () => void;
  onRefresh: () => void;
  refreshKey: number;
  onOpenDiff?: (filePath: string) => void;
}

/** Maps git status to display metadata. */
const STATUS_META: Record<string, { icon: typeof Edit3; color: string; label: string }> = {
  M:  { icon: Edit3,       color: '#d4a44a', label: 'Modified' },
  A:  { icon: Plus,        color: '#6ba86b', label: 'Added' },
  D:  { icon: Trash2,      color: '#e05555', label: 'Deleted' },
  R:  { icon: Edit3,       color: '#7b9ec4', label: 'Renamed' },
  '??': { icon: FileQuestion, color: '#8b5a3c', label: 'Untracked' },
  MM: { icon: Edit3,       color: '#d4a44a', label: 'Modified' },
  AM: { icon: Plus,        color: '#6ba86b', label: 'Added' },
  RM: { icon: Edit3,       color: '#7b9ec4', label: 'Renamed' },
};

/** Priority for grouping: untracked first (most interesting), then staged, then unstaged. */
function statusGroup(status: string): number {
  if (status === '??') return 0;
  if (status === 'A' || status === 'AM') return 1;
  if (status === 'D') return 2;
  if (status === 'R' || status === 'RM') return 3;
  return 4; // M, MM
}

interface GroupedChanges {
  label: string;
  changes: GitChange[];
}

function groupChanges(changes: GitChange[]): GroupedChanges[] {
  const sorted = [...changes].sort((a, b) => statusGroup(a.status) - statusGroup(b.status));
  const groups: GroupedChanges[] = [];
  const seen = new Set<string>();

  for (const c of sorted) {
    const meta = STATUS_META[c.status] ?? STATUS_META['M'];
    const key = meta.label;
    if (!seen.has(key)) {
      seen.add(key);
      groups.push({ label: key, changes: [c] });
    } else {
      groups.find((g) => g.label === key)!.changes.push(c);
    }
  }
  return groups;
}

export function GitChangesPanel({
  project,
  onOpenTab,
  onForceOpenTab,
  onLaunchVscode,
  onRefresh,
  refreshKey,
  onOpenDiff,
}: GitChangesPanelProps) {
  const { changes, branch, loading, error, refresh } = useGitChanges(project.path, refreshKey);

  const grouped = useMemo(() => groupChanges(changes), [changes]);

  // Name prompt state — shared by CLAUDE and COPILOT launch buttons
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [promptAction, setPromptAction] = useState<'open' | 'force'>('open');
  const [pendingCommand, setPendingCommand] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (promptVisible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [promptVisible]);

  const handleLaunchClaude = () => {
    setPromptValue(project.name);
    setPromptAction('open');
    setPendingCommand('claude');
    setPromptVisible(true);
  };

  const handleLaunchCopilot = () => {
    setPromptValue(project.name);
    setPromptAction('force');
    setPendingCommand('copilot');
    setPromptVisible(true);
  };

  const submitPrompt = () => {
    const title = promptValue.trim() || project.name;
    setPromptVisible(false);
    if (promptAction === 'force') {
      onForceOpenTab(project, title, pendingCommand);
    } else {
      onOpenTab(project, title, pendingCommand);
    }
  };

  const cancelPrompt = () => {
    setPromptVisible(false);
  };

  const handleRefresh = () => {
    refresh();
    onRefresh();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-fade-slide-in relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1f1a15] flex items-center gap-4 flex-shrink-0">
        <FolderGit2 className="w-5 h-5 text-[#d4784a] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-mono font-semibold text-[#f0ece8] truncate">
            {project.name}
          </h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] font-mono text-[#8b5a3c] truncate max-w-[300px]">
              {project.path}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono flex-shrink-0 ${getBranchStyle(branch)}`}>
              <GitBranch className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
              {getBranchLabel(branch)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded hover:bg-[#0f0f0f] text-[#8b5a3c] hover:text-[#d4784a] transition-all duration-200 disabled:opacity-30"
            title="Refresh git status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <span className="w-px h-5 bg-[#1f1a15]" />

          <button
            onClick={handleLaunchClaude}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded bg-[#1a0f0a] border border-[#d4784a]/20 hover:border-[#d4784a]/50 text-[#d4784a] hover:bg-[#2a1a12] font-mono tracking-wider transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,120,74,0.1)]"
            title="Launch Claude terminal"
          >
            <Terminal className="w-3 h-3" />
            CLAUDE
          </button>

          <button
            onClick={handleLaunchCopilot}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded bg-[#0a1010] border border-[#6ba86b]/20 hover:border-[#6ba86b]/50 text-[#6ba86b] hover:bg-[#0f1a18] font-mono tracking-wider transition-all duration-300 hover:shadow-[0_0_20px_rgba(107,168,107,0.1)]"
            title="Launch GitHub Copilot terminal"
          >
            <Sparkles className="w-3 h-3" />
            COPILOT
          </button>

          <button
            onClick={onLaunchVscode}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded bg-[#0a1520] border border-[#7b9ec4]/20 hover:border-[#7b9ec4]/50 text-[#7b9ec4] hover:bg-[#0f1a28] font-mono tracking-wider transition-all duration-300 hover:shadow-[0_0_20px_rgba(123,158,196,0.1)]"
            title="Open in VS Code"
          >
            <Code2 className="w-3 h-3" />
            VSCODE
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-6 h-6 text-[#d4784a] animate-spin" />
            <p className="text-[11px] font-mono text-[#8b5a3c] tracking-widest">
              READING_GIT<span className="animate-cursor-blink">_</span>
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
            <GitCommit className="w-10 h-10 text-[#e05555]/40" />
            <p className="text-xs font-mono text-[#e05555] max-w-md text-center">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-1.5 text-[10px] rounded bg-[#0f0f0f] border border-[#1f1a15] text-[#d4784a] font-mono tracking-wider hover:border-[#d4784a]/40 transition-colors"
            >
              RETRY_
            </button>
          </div>
        )}

        {/* Clean tree */}
        {!loading && !error && changes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
            <GitCommit className="w-12 h-12 text-[#6ba86b]/30" />
            <p className="text-sm font-mono text-[#6ba86b] tracking-wider">
              WORKING_TREE_CLEAN
            </p>
            <p className="text-[10px] font-mono text-[#8b5a3c] tracking-widest">
              No changes in {branch}
            </p>
          </div>
        )}

        {/* Changes list */}
        {!loading && !error && changes.length > 0 && (
          <div className="py-2">
            {grouped.map((group) => {
              const meta = STATUS_META[group.changes[0]?.status] ?? STATUS_META['M'];
              const GroupIcon = meta.icon;
              return (
                <div key={group.label} className="mb-1">
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-6 py-1.5 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#1f1a15]/30 z-[5]">
                    <GroupIcon className="w-3 h-3 flex-shrink-0" style={{ color: meta.color }} />
                    <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: meta.color }}>
                      {group.label}
                    </span>
                    <span className="text-[10px] font-mono text-[#8b5a3c]">
                      ({group.changes.length})
                    </span>
                  </div>

                  {/* File rows */}
                  {group.changes.map((change) => {
                    const changeMeta = STATUS_META[change.status] ?? STATUS_META['M'];
                    const ChangeIcon = changeMeta.icon;
                    const fileName = change.file.replace(/\\/g, '/').split('/').pop() || change.file;
                    const dirPath = change.file.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

                    return (
                      <div
                        key={change.file}
                        onClick={() => onOpenDiff?.(change.file)}
                        className="flex items-center gap-3 px-6 py-1.5 hover:bg-[#0f0f0f] transition-colors duration-150 group cursor-pointer"
                        title={`Click to view diff — ${change.file}`}
                      >
                        <ChangeIcon
                          className="w-3 h-3 flex-shrink-0 opacity-70"
                          style={{ color: changeMeta.color }}
                        />
                        <span className="text-xs font-mono text-[#f0ece8] truncate">
                          {fileName}
                        </span>
                        {dirPath && (
                          <span className="text-[10px] font-mono text-[#8b5a3c]/50 truncate hidden sm:inline">
                            {dirPath}/
                          </span>
                        )}
                        {change.status === 'R' && change.oldFile && (
                          <span className="text-[10px] font-mono text-[#7b9ec4]/50 truncate hidden md:inline ml-auto">
                            ← {change.oldFile}
                          </span>
                        )}
                        {change.status !== 'R' && (
                          <span
                            className="ml-auto text-[10px] font-mono flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            style={{ color: changeMeta.color }}
                          >
                            {change.status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {!loading && !error && (
        <div className="px-6 py-2 border-t border-[#1f1a15] flex items-center gap-4 flex-shrink-0">
          <GitCommit className="w-3 h-3 text-[#8b5a3c]" />
          <span className="text-[10px] font-mono text-[#8b5a3c] tracking-wider">
            {changes.length === 0
              ? 'CLEAN'
              : `${changes.length} FILE${changes.length !== 1 ? 'S' : ''} CHANGED`}
          </span>
          <span className="text-[10px] font-mono text-[#8b5a3c]/40 ml-auto">
            {branch}
          </span>
        </div>
      )}

      {/* Name prompt overlay — shown when CLAUDE or COPILOT is clicked */}
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
    </div>
  );
}

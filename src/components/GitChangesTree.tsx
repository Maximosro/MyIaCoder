import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  GitBranch,
  GitBranchPlus,
  RefreshCw,
  Folder,
  FolderOpen,
  Undo2,
  ArrowUp,
  ArrowDown,
  CloudDownload,
  GitCommit,
} from 'lucide-react';
import { useGitChanges } from '../hooks/useGitChanges';
import { SUPPORTED_EXTENSIONS } from '../utils/tabUtils';
import { GIT_STATUS_META } from '../utils/gitStatus';
import { CommitModal } from './CommitModal';
import { NewBranchModal } from './NewBranchModal';
import type { GitChange, GitTreeNode } from '../types/project';

interface GitChangesTreeProps {
  projectPath: string;
  refreshKey: number;
  onFileClick?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
}

/**
 * Converts a flat list of GitChange entries into a tree structure
 * grouped by directory, for display in the sidebar.
 * Changes at the repo root appear directly under the top-level group.
 */
function buildChangeTree(changes: GitChange[]): GitTreeNode[] {
  const root: GitTreeNode[] = [];
  const dirMap = new Map<string, GitTreeNode>();

  for (const change of changes) {
    const normalized = change.file.replace(/\\/g, '/');
    const parts = normalized.split('/');

    if (parts.length === 1) {
      // File at repo root
      root.push({
        name: parts[0],
        path: change.file,
        type: 'file',
        gitStatus: change.status,
      });
    } else {
      // File inside a directory — build intermediate nodes
      const dirPath = parts.slice(0, -1).join('/');
      const fileName = parts[parts.length - 1];

      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, {
          name: dirPath,
          path: dirPath,
          type: 'directory',
          children: [],
        });
        root.push(dirMap.get(dirPath)!);
      }

      const dir = dirMap.get(dirPath)!;
      dir.children!.push({
        name: fileName,
        path: change.file,
        type: 'file',
        gitStatus: change.status,
      });
    }
  }

  // Sort: directories first, then files, both alphabetically
  const sortNodes = (nodes: GitTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
  };
  sortNodes(root);

  return root;
}

/** Leaf node for a single changed file (flat or inside a dir). */
function ChangeFileRow({
  name,
  fullPath,
  status,
  onFileClick,
  onOpenDiff,
  onDiscard,
}: {
  name: string;
  fullPath: string;
  status: string;
  onFileClick?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
  onDiscard?: (filePath: string) => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const meta = GIT_STATUS_META[status] ?? GIT_STATUS_META['M'];
  const Icon = meta.icon;
  const isSupported = (() => {
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx === -1) return false;
    return SUPPORTED_EXTENSIONS.has(name.slice(dotIdx).toLowerCase());
  })();

  const handleClick = () => {
    if (confirmDiscard) return;
    // Prioritize opening diff for git changes
    if (onOpenDiff) {
      onOpenDiff(fullPath);
    } else if (isSupported && onFileClick) {
      onFileClick(fullPath);
    }
  };

  return (
    <div className="group relative">
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1.5 py-[3px] text-left font-mono transition-colors duration-150 border-l-2 border-transparent hover:bg-[#0f0f0f] hover:border-[#d4784a]/20 cursor-pointer"
        title={`${fullPath} — ${status}`}
        style={{ paddingLeft: '36px' }}
      >
        <Icon className="w-3 h-3 flex-shrink-0 opacity-70" style={{ color: meta.color }} />
        <span className="text-[11px] text-[#b0a89a] truncate flex-1">{name}</span>

        {/* Discard button — visible on hover */}
        {onDiscard && !confirmDiscard && (
          <span
            onClick={(e) => { e.stopPropagation(); setConfirmDiscard(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0 pr-2"
            title="Descartar cambios"
          >
            <Undo2 className="w-3 h-3 text-[#e05555] hover:text-[#ff6b6b] transition-colors duration-150" />
          </span>
        )}
      </button>

      {/* Inline discard confirmation */}
      {confirmDiscard && (
        <div className="flex items-center gap-1.5 py-1 animate-fade-in" style={{ paddingLeft: '36px' }}>
          <span className="text-[10px] font-mono text-[#e05555] tracking-wider truncate flex-1">
            DISCARD "{name}"?
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDiscard(false); onDiscard?.(fullPath); }}
            className="px-2 py-0.5 text-[10px] font-mono bg-[#e05555]/20 text-[#e05555] border border-[#e05555]/40 rounded hover:bg-[#e05555]/40 transition-all duration-150"
          >
            YES
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDiscard(false); }}
            className="px-2 py-0.5 text-[10px] font-mono bg-transparent text-[#8b5a3c] border border-[#8b5a3c]/30 rounded hover:bg-[#0f0f0f] transition-all duration-150 mr-2"
          >
            NO
          </button>
        </div>
      )}
    </div>
  );
}

/** Recursive tree node for directories containing changed files. */
function ChangeDirNode({
  node,
  depth,
  onFileClick,
  onOpenDiff,
  onDiscard,
}: {
  node: GitTreeNode;
  depth: number;
  onFileClick?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
  onDiscard?: (filePath: string) => void;
}) {
  const [expanded, setExpanded] = useState(true); // expanded by default
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-1.5 py-[3px] text-left font-mono transition-colors duration-150 border-l-2 border-transparent hover:bg-[#0f0f0f] hover:border-[#8b5a3c]/30"
        style={{ paddingLeft: `${22 + depth * 12}px` }}
      >
        <ChevronRight
          className={`w-3 h-3 text-[#8b5a3c] transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : 'rotate-0'}`}
        />
        {expanded ? (
          <FolderOpen className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0" />
        ) : (
          <Folder className="w-3.5 h-3.5 text-[#8b5a3c] flex-shrink-0" />
        )}
        <span className="text-[11px] text-[#8b5a3c] truncate">{node.name}</span>
      </button>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) =>
            child.type === 'directory' ? (
              <ChangeDirNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                onOpenDiff={onOpenDiff}
                onDiscard={onDiscard}
              />
            ) : (
              <ChangeFileRow
                key={child.path}
                name={child.name}
                fullPath={child.path}
                status={child.gitStatus || 'M'}
                onFileClick={onFileClick}
                onOpenDiff={onOpenDiff}
                onDiscard={onDiscard}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function GitChangesTree({ projectPath, refreshKey, onFileClick, onOpenDiff }: GitChangesTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const { changes, branch, loading, error, refresh } = useGitChanges(projectPath, refreshKey);

  // Ahead/behind indicator
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);

  const refreshAheadBehind = useCallback(async () => {
    try {
      const ab = await window.electronAPI.gitAheadBehind(projectPath);
      setAhead(ab.ahead);
      setBehind(ab.behind);
    } catch {
      setAhead(0);
      setBehind(0);
    }
  }, [projectPath]);

  useEffect(() => {
    refreshAheadBehind();
  }, [refreshAheadBehind, refreshKey]);

  // Remote operation state
  const [remoteOp, setRemoteOp] = useState<string | null>(null); // 'fetch'|'pull'|'push' while running
  const [remoteMsg, setRemoteMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Auto-clear feedback after 5s
  useEffect(() => {
    if (!remoteMsg) return;
    const t = setTimeout(() => setRemoteMsg(null), 5000);
    return () => clearTimeout(t);
  }, [remoteMsg]);

  const runRemote = async (op: 'fetch' | 'pull' | 'push') => {
    if (remoteOp) return; // already running
    setRemoteOp(op);
    setRemoteMsg(null);
    try {
      const fn = op === 'fetch' ? window.electronAPI.gitFetch
        : op === 'pull' ? window.electronAPI.gitPull
        : window.electronAPI.gitPush;
      const result = await fn(projectPath);
      const successText = result.output || `${op} ok`;
      setRemoteMsg({ text: result.ok ? successText : (result.error ?? `${op} failed`), ok: result.ok });
      if (result.ok) {
        await refresh();
        await refreshAheadBehind();
      }
    } catch (err) {
      setRemoteMsg({ text: err instanceof Error ? err.message : `${op} failed`, ok: false });
    } finally {
      setRemoteOp(null);
    }
  };

  const handleDiscard = async (filePath: string) => {
    try {
      await window.electronAPI.discardGitChanges(projectPath, filePath);
    } catch {
      // Surfaced by the refresh below — the file simply stays listed on failure.
    }
    await refresh();
  };

  // Commit modal state
  const [commitOpen, setCommitOpen] = useState(false);
  // New-branch modal state
  const [newBranchOpen, setNewBranchOpen] = useState(false);

  const handleCommitted = async () => {
    await refresh();
    await refreshAheadBehind();
    setRemoteMsg({ text: 'committed', ok: true });
  };

  const handleBranchCreated = async () => {
    await refresh();
    await refreshAheadBehind();
    setRemoteMsg({ text: 'branch created', ok: true });
  };

  const tree = useMemo(() => buildChangeTree(changes), [changes]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-3">
        <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
        <span className="text-[10px] font-mono text-[#8b5a3c]">git status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-1 px-3">
        <span className="text-[10px] font-mono text-[#e05555]">{error}</span>
      </div>
    );
  }

  const RemoteButton = ({ op, icon: Icon, title }: { op: 'fetch' | 'pull' | 'push'; icon: typeof ArrowUp; title: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); runRemote(op); }}
      disabled={!!remoteOp}
      className="p-0.5 rounded hover:bg-[#1f1a15] transition-colors duration-150 disabled:opacity-30"
      title={title}
    >
      {remoteOp === op
        ? <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
        : <Icon className="w-3 h-3 text-[#8b5a3c] hover:text-[#d4784a] transition-colors duration-150" />
      }
    </button>
  );

  return (
    <div>
      {/* Header toggle */}
      <div className="flex items-center py-1.5 px-3 font-mono">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-left transition-colors duration-150 flex-1 min-w-0"
        >
          <ChevronRight
            className={`w-3 h-3 text-[#8b5a3c] transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : 'rotate-0'}`}
          />
          <GitBranch className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0" />
          <span className="text-[11px] text-[#f0ece8] tracking-wider truncate" title={branch || undefined}>
            {branch && branch !== 'unknown' ? branch : 'git'}
          </span>
          {changes.length > 0 && (
            <span className="text-[10px] text-[#d4784a]">{changes.length}</span>
          )}
        </button>

        {/* Ahead/behind indicator + remote action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          {(ahead > 0 || behind > 0) && (
            <span className="text-[10px] font-mono text-[#8b5a3c] flex items-center gap-1">
              {ahead > 0 && <span className="text-[#6ba86b]">↑{ahead}</span>}
              {behind > 0 && <span className="text-[#d4784a]">↓{behind}</span>}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setNewBranchOpen(true); }}
            className="p-0.5 rounded hover:bg-[#1f1a15] transition-colors duration-150"
            title="New branch"
          >
            <GitBranchPlus className="w-3 h-3 text-[#8b5a3c] hover:text-[#9b7bc4] transition-colors duration-150" />
          </button>
          {changes.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCommitOpen(true); }}
              className="p-0.5 rounded hover:bg-[#1f1a15] transition-colors duration-150"
              title="Commit"
            >
              <GitCommit className="w-3 h-3 text-[#8b5a3c] hover:text-[#6ba86b] transition-colors duration-150" />
            </button>
          )}
          <RemoteButton op="fetch" icon={CloudDownload} title="Fetch" />
          <RemoteButton op="pull" icon={ArrowDown} title="Pull" />
          <RemoteButton op="push" icon={ArrowUp} title="Push" />
        </div>
      </div>

      {/* Inline remote operation feedback */}
      {remoteMsg && (
        <div className="px-3 py-0.5 animate-fade-in">
          <span className={`text-[10px] font-mono tracking-wider ${remoteMsg.ok ? 'text-[#6ba86b]' : 'text-[#e05555]'}`}>
            {remoteMsg.text}
          </span>
        </div>
      )}

      {/* Clean tree message */}
      {changes.length === 0 && (
        <div className="py-1 px-3">
          <span className="text-[10px] font-mono text-[#6ba86b] tracking-wider">✓ Clean tree</span>
        </div>
      )}

      {/* Tree body with slide animation */}
      {changes.length > 0 && (
        <div
          className={`transition-all duration-300 ease-out ${
            expanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
          }`}
        >
          {tree.map((node) =>
            node.type === 'directory' ? (
              <ChangeDirNode
                key={node.path}
                node={node}
                depth={0}
                onFileClick={onFileClick}
                onOpenDiff={onOpenDiff}
                onDiscard={handleDiscard}
              />
            ) : (
              <ChangeFileRow
                key={node.path}
                name={node.name}
                fullPath={node.path}
                status={node.gitStatus || 'M'}
                onFileClick={onFileClick}
                onOpenDiff={onOpenDiff}
                onDiscard={handleDiscard}
              />
            ),
          )}
        </div>
      )}

      {/* Commit modal */}
      <CommitModal
        open={commitOpen}
        projectPath={projectPath}
        onClose={() => setCommitOpen(false)}
        onCommitted={handleCommitted}
      />

      {/* New-branch modal */}
      <NewBranchModal
        open={newBranchOpen}
        projectPath={projectPath}
        onClose={() => setNewBranchOpen(false)}
        onCreated={handleBranchCreated}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  ChevronRight,
  GitBranch,
  RefreshCw,
  Edit3,
  Plus,
  Trash2,
  FileQuestion,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { useGitChanges } from '../hooks/useGitChanges';
import { SUPPORTED_EXTENSIONS } from '../types/terminal';
import type { GitChange } from '../types/project';
import type { TreeNode } from '../types/project';

interface GitChangesTreeProps {
  projectPath: string;
  refreshKey: number;
  onFileClick?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
}

/** Maps git status to display metadata. */
const STATUS_META: Record<string, { icon: typeof Edit3; color: string }> = {
  M:  { icon: Edit3,       color: '#d4a44a' },
  A:  { icon: Plus,        color: '#6ba86b' },
  D:  { icon: Trash2,      color: '#e05555' },
  R:  { icon: Edit3,       color: '#7b9ec4' },
  '??': { icon: FileQuestion, color: '#8b5a3c' },
  MM: { icon: Edit3,       color: '#d4a44a' },
  AM: { icon: Plus,        color: '#6ba86b' },
  RM: { icon: Edit3,       color: '#7b9ec4' },
};

/**
 * Converts a flat list of GitChange entries into a tree structure
 * grouped by directory, for display in the sidebar.
 * Changes at the repo root appear directly under the top-level group.
 */
function buildChangeTree(changes: GitChange[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  for (const change of changes) {
    const normalized = change.file.replace(/\\/g, '/');
    const parts = normalized.split('/');

    if (parts.length === 1) {
      // File at repo root
      root.push({
        name: parts[0],
        path: change.file,
        type: 'file',
        // Attach git metadata via a namespaced property
        ...({ _gitStatus: change.status } as any),
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
        ...({ _gitStatus: change.status } as any),
      });
    }
  }

  // Sort: directories first, then files, both alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
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
}: {
  name: string;
  fullPath: string;
  status: string;
  onFileClick?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
}) {
  const meta = STATUS_META[status] ?? STATUS_META['M'];
  const Icon = meta.icon;
  const isSupported = (() => {
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx === -1) return false;
    return SUPPORTED_EXTENSIONS.has(name.slice(dotIdx).toLowerCase());
  })();

  const handleClick = () => {
    // Prioritize opening diff for git changes
    if (onOpenDiff) {
      onOpenDiff(fullPath);
    } else if (isSupported && onFileClick) {
      onFileClick(fullPath);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-1.5 py-[3px] text-left font-mono transition-colors duration-150 border-l-2 border-transparent hover:bg-[#0f0f0f] hover:border-[#d4784a]/20 cursor-pointer"
      title={`${fullPath} — ${status}`}
      style={{ paddingLeft: '36px' }}
    >
      <Icon className="w-3 h-3 flex-shrink-0 opacity-70" style={{ color: meta.color }} />
      <span className="text-[11px] text-[#b0a89a] truncate">{name}</span>
    </button>
  );
}

/** Recursive tree node for directories containing changed files. */
function ChangeDirNode({
  node,
  depth,
  onFileClick,
  onOpenDiff,
}: {
  node: TreeNode;
  depth: number;
  onFileClick?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
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
              />
            ) : (
              <ChangeFileRow
                key={child.path}
                name={child.name}
                fullPath={child.path}
                status={(child as any)._gitStatus || 'M'}
                onFileClick={onFileClick}
                onOpenDiff={onOpenDiff}
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
  const { changes, loading, error } = useGitChanges(projectPath, refreshKey);

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

  if (changes.length === 0) {
    return (
      <div className="py-1 px-3">
        <span className="text-[10px] font-mono text-[#6ba86b] tracking-wider">✓ Clean tree</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header toggle */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-1.5 py-1.5 px-3 text-left font-mono transition-colors duration-150 border-l-2 border-transparent hover:bg-[#0f0f0f] hover:border-[#8b5a3c]/30"
      >
        <ChevronRight
          className={`w-3 h-3 text-[#8b5a3c] transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-90' : 'rotate-0'}`}
        />
        <GitBranch className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0" />
        <span className="text-[11px] text-[#f0ece8] tracking-wider">git - changes</span>
        <span className="text-[10px] text-[#d4784a] ml-auto">{changes.length}</span>
      </button>

      {/* Tree body with slide animation */}
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
            />
          ) : (
            <ChangeFileRow
              key={node.path}
              name={node.name}
              fullPath={node.path}
              status={(node as any)._gitStatus || 'M'}
              onFileClick={onFileClick}
              onOpenDiff={onOpenDiff}
            />
          ),
        )}
      </div>
    </div>
  );
}

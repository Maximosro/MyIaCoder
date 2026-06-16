import { useState } from 'react';
import { Folder, FolderOpen, FileText, ChevronRight, RefreshCw, ClipboardList } from 'lucide-react';
import type { TreeNode } from '../types/project';
import { SUPPORTED_EXTENSIONS } from '../types/terminal';

interface RpiPlansTreeProps {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenTodos: () => void;
  onFileClick?: (filePath: string) => void;
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  onFileClick?: (filePath: string) => void;
}

export function TreeNodeItem({ node, depth, onFileClick }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = node.type === 'directory';
  const hasChildren = isDirectory && node.children && node.children.length > 0;
  const isSupportedFile = !isDirectory && (() => {
    const dotIndex = node.name.lastIndexOf('.');
    if (dotIndex === -1) return false;
    return SUPPORTED_EXTENSIONS.has(node.name.slice(dotIndex).toLowerCase());
  })();

  const handleClick = () => {
    if (isDirectory) {
      setExpanded((prev) => !prev);
    } else if (isSupportedFile && onFileClick) {
      onFileClick(node.path);
    }
  };

  return (
    <div className="select-none">
      {/* Node row */}
      <button
        onClick={handleClick}
        disabled={!isDirectory && !isSupportedFile}
        title={node.path}
        className={`w-full flex items-center gap-1.5 py-1 text-left font-mono transition-all duration-200 border-l-2
          ${isDirectory || isSupportedFile ? 'cursor-pointer' : 'cursor-default'}
          ${isDirectory
            ? 'border-transparent hover:bg-[#0f0f0f] hover:border-[#8b5a3c]/30'
            : isSupportedFile
              ? 'border-transparent hover:bg-[#0f0f0f] hover:border-[#d4784a]/20'
              : 'border-transparent'
          }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {/* Chevron — only for directories */}
        <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
          {isDirectory && (
            <ChevronRight
              className={`w-3 h-3 text-[#8b5a3c] transition-transform duration-200 ${
                expanded ? 'rotate-90' : 'rotate-0'
              }`}
            />
          )}
        </span>

        {/* Icon */}
        {isDirectory ? (
          expanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0 transition-colors duration-200" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-[#8b5a3c] flex-shrink-0 transition-colors duration-200" />
          )
        ) : (
          <FileText className={`w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200 ${isSupportedFile ? 'text-[#8b5a3c]' : 'text-[#8b5a3c]/40'}`} />
        )}

        {/* Name */}
        <span
          className={`text-xs truncate transition-colors duration-200 ${
            isDirectory ? 'text-[#b0a89a] hover:text-[#f0ece8]'
              : isSupportedFile ? 'text-[#8b5a3c] hover:text-[#d4784a]'
              : 'text-[#8b5a3c]/40'
          }`}
        >
          {node.name}
        </span>
      </button>

      {/* Children — animated expand/collapse */}
      {hasChildren && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {node.children!.map((child) => (
            <TreeNodeItem key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RpiPlansTree({ tree, loading, error, onRefresh, onOpenTodos, onFileClick }: RpiPlansTreeProps) {
  return (
    <div className="border-t border-[#1f1a15] flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-[#d4784a] flex-shrink-0" />
          <span className="text-[10px] font-mono font-semibold text-[#f0ece8] tracking-wider">
            /Plans
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenTodos}
            className="p-1 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4a44a]"
            title="ToDos — Kanban board"
          >
            <ClipboardList className="w-3 h-3" />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a] disabled:opacity-30"
            title="Refresh RPI plans tree"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[40vh] overflow-y-auto px-1 pb-2">
        {/* Loading state */}
        {loading && tree.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-3.5 h-3.5 text-[#d4784a] animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-2 py-4 text-center animate-fade-in">
            <p className="text-[#e05555] text-[10px] font-mono">{error}</p>
            <button
              onClick={onRefresh}
              className="mt-1 text-[10px] font-mono text-[#d4784a] hover:text-[#e8956a] transition-colors tracking-wider"
            >
              RETRY_
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && tree.length === 0 && (
          <div className="px-2 py-4 text-center animate-fade-in">
            <p className="text-[#8b5a3c] text-[10px] font-mono tracking-wider">
              RPI_PATH_NOT_FOUND
            </p>
          </div>
        )}

        {/* Tree nodes */}
        {!loading &&
          tree.map((node) => (
            <TreeNodeItem key={node.path} node={node} depth={0} onFileClick={onFileClick} />
          ))}
      </div>
    </div>
  );
}

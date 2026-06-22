import { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, FolderOpen, FileText, ChevronRight, Trash2, Copy, Check } from 'lucide-react';
import type { TreeNode } from '../types/project';
import { SUPPORTED_EXTENSIONS } from '../utils/tabUtils';

export interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  onFileClick?: (filePath: string) => void;
  onDeleteFile?: (filePath: string) => void;
}

export function TreeNodeItem({ node, depth, onFileClick, onDeleteFile }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDirectory = node.type === 'directory';
  const hasChildren = isDirectory && node.children && node.children.length > 0;
  const isSupportedFile = !isDirectory && (() => {
    const dotIndex = node.name.lastIndexOf('.');
    if (dotIndex === -1) return false;
    return SUPPORTED_EXTENSIONS.has(node.name.slice(dotIndex).toLowerCase());
  })();

  const handleClick = () => {
    if (confirmDelete) return; // Don't navigate during confirmation
    if (isDirectory) {
      setExpanded((prev) => !prev);
    } else if (isSupportedFile && onFileClick) {
      onFileClick(node.path);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
    if (onDeleteFile) {
      onDeleteFile(node.path);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setCopied(false);
  }, []);

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(node.path);
      setCopied(true);
      setTimeout(closeContextMenu, 1200);
    } catch {
      // ponytail: fallback for older Electron or http context — silently ignore
    }
  };

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu, closeContextMenu]);

  return (
    <div className="select-none">
      {/* Node row */}
      <div className="group relative">
        <button
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          disabled={!isDirectory && !isSupportedFile}
          title={confirmDelete ? undefined : node.path}
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
            className={`text-xs truncate transition-colors duration-200 flex-1 ${
              isDirectory ? 'text-[#b0a89a] hover:text-[#f0ece8]'
                : isSupportedFile ? 'text-[#8b5a3c] hover:text-[#d4784a]'
                : 'text-[#8b5a3c]/40'
            }`}
          >
            {node.name}
          </span>

          {/* Delete icon — visible on hover for supported files and directories */}
          {(isSupportedFile || isDirectory) && onDeleteFile && !confirmDelete && (
            <span
              onClick={handleDeleteClick}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0 pr-1"
              title={`Delete ${node.name}`}
            >
              <Trash2 className="w-3 h-3 text-[#e05555] hover:text-[#ff6b6b] transition-colors duration-150" />
            </span>
          )}
        </button>

        {/* Inline confirmation bar */}
        {confirmDelete && (
          <div
            className="flex items-center gap-1.5 py-1 animate-fade-in"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <span className="text-[10px] font-mono text-[#e05555] tracking-wider truncate flex-1">
              DEL "{node.name}"?
            </span>
            <button
              onClick={handleConfirmDelete}
              className="px-2 py-0.5 text-[10px] font-mono bg-[#e05555]/20 text-[#e05555] border border-[#e05555]/40 rounded hover:bg-[#e05555]/40 transition-all duration-150"
            >
              YES
            </button>
            <button
              onClick={handleCancelDelete}
              className="px-2 py-0.5 text-[10px] font-mono bg-transparent text-[#8b5a3c] border border-[#8b5a3c]/30 rounded hover:bg-[#0f0f0f] transition-all duration-150"
            >
              NO
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] py-1 bg-[#141414] border border-[#2a2a2a] rounded shadow-lg shadow-black/50 animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleCopyPath}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-[#b0a89a] hover:bg-[#1a1a1a] hover:text-[#f0ece8] transition-colors duration-100"
          >
            {copied ? (
              <Check className="w-3 h-3 text-[#6b9e6b]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copied ? 'Copied!' : 'Copy absolute path'}</span>
          </button>
        </div>
      )}

      {/* Children — animated expand/collapse */}
      {hasChildren && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {node.children!.map((child) => (
            <TreeNodeItem key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} onDeleteFile={onDeleteFile} />
          ))}
        </div>
      )}
    </div>
  );
}

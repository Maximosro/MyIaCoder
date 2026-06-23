import { useState, useEffect, useRef } from 'react';
import { Search, FolderGit2 } from 'lucide-react';
import type { Project } from '../types/project';
import { getBranchStyle, getBranchLabel } from '../utils/branchUtils';

interface ProjectSearchProps {
  open: boolean;
  projects: Project[];
  onSelect: (project: Project) => void;
  onClose: () => void;
}

export function ProjectSearch({ open, projects, onSelect, onClose }: ProjectSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : projects;

  // ponytail: reset state each time the popup opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keep selectedIndex in bounds when filtered list changes
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex]);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-[480px] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1f1a15]">
          <Search className="w-4 h-4 text-[#8b5a3c] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="flex-1 bg-transparent text-sm font-mono text-[#f0ece8] placeholder-[#4a2a1a] outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#4a2a1a] font-mono">
              No projects found
            </div>
          ) : (
            filtered.map((project, i) => (
              <button
                key={project.path}
                onClick={() => { onSelect(project); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left font-mono transition-colors
                  ${i === selectedIndex
                    ? 'bg-[#0f0f0f] border-l-2 border-[#d4784a]'
                    : 'border-l-2 border-transparent hover:bg-[#0f0f0f]'
                  }`}
              >
                <FolderGit2 className={`w-4 h-4 flex-shrink-0 ${i === selectedIndex ? 'text-[#d4784a]' : 'text-[#8b5a3c]'}`} />
                <span className={`text-sm truncate flex-1 ${i === selectedIndex ? 'text-[#f0ece8]' : 'text-[#b0a89a]'}`} title={project.path}>
                  {project.name}
                </span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded border flex-shrink-0 max-w-[120px] truncate ${getBranchStyle(project.branch)}`}>
                  {getBranchLabel(project.branch)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[#1f1a15] flex items-center gap-3 text-[10px] text-[#4a2a1a] font-mono">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

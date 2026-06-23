import { FolderGit2 } from 'lucide-react';
import { getBranchStyle, getBranchLabel } from '../utils/branchUtils';
import type { Project } from '../types/project';

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  hasOpenTab: boolean;
  hideBranch?: boolean;
  onClick: () => void;
}

export function ProjectItem({ project, isSelected, hasOpenTab, hideBranch, onClick }: ProjectItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer text-left
        transition-all duration-300 border-l-2 font-mono shimmer-surface
        ${isSelected
          ? 'bg-[#0f0f0f] border-[#d4784a] shadow-[0_0_18px_rgba(212,120,74,0.12)]'
          : 'border-transparent hover:bg-[#0f0f0f] hover:border-[#8b5a3c]/30'
        }`}
    >
      {/* Folder icon — lucide-react with float on selected */}
      <FolderGit2
        className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${
          isSelected
            ? 'text-[#d4784a] animate-float'
            : 'text-[#8b5a3c]'
        }`}
      />

      {/* Project name + open-tab indicator */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={`text-sm truncate transition-all duration-200 ${
            isSelected ? 'text-[#f0ece8]' : 'text-[#b0a89a]'
          }`}
          title={project.path}
        >
          {project.name}
        </span>
        {hasOpenTab && (
          <span
            className="text-[#d4784a] text-xs animate-pulse flex-shrink-0"
            title="Terminal activa"
          >
            ▸
          </span>
        )}
      </div>

      {/* Branch badge — unified. Hidden in WSL mode (unknown until opened). */}
      {!hideBranch && (
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded border flex-shrink-0 max-w-[120px] truncate transition-all duration-200 ${getBranchStyle(project.branch)}`}
          title={project.branch || undefined}
        >
          {getBranchLabel(project.branch)}
        </span>
      )}
    </button>
  );
}

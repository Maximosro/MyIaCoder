import type { Project } from '../types/project';

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
}

function getBranchStyle(branch: string): string {
  if (branch === 'main' || branch === 'master') {
    return 'bg-blue-900/50 text-blue-300 border-blue-700';
  }
  if (branch === 'develop') {
    return 'bg-green-900/50 text-green-300 border-green-700';
  }
  if (branch === 'dev') {
    return 'bg-emerald-900/50 text-emerald-300 border-emerald-700';
  }
  if (branch.startsWith('feature/')) {
    return 'bg-purple-900/50 text-purple-300 border-purple-700';
  }
  if (branch.startsWith('hotfix/')) {
    return 'bg-red-900/50 text-red-300 border-red-700';
  }
  if (branch.startsWith('release/')) {
    return 'bg-yellow-900/50 text-yellow-300 border-yellow-700';
  }
  return 'bg-gray-700/50 text-gray-400 border-gray-600';
}

function getBranchLabel(branch: string): string {
  // Truncate long branch names
  return branch.length > 18 ? branch.slice(0, 17) + '…' : branch;
}

export function ProjectItem({ project, isSelected, onClick }: ProjectItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer text-left transition-colors
        ${isSelected
          ? 'bg-gray-800/80 ring-1 ring-inset ring-blue-500/30'
          : 'hover:bg-gray-800/40'
        }`}
    >
      {/* Folder icon */}
      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>

      {/* Project name */}
      <span className="flex-1 text-sm truncate text-gray-200">{project.name}</span>

      {/* Branch badge */}
      <span className={`text-[11px] px-1.5 py-0.5 rounded border flex-shrink-0 max-w-[120px] truncate ${getBranchStyle(project.branch)}`}>
        {getBranchLabel(project.branch)}
      </span>
    </button>
  );
}

import { FolderGit2, FolderOpen } from 'lucide-react';
import { getBranchStyle } from '../utils/branchUtils';
import type { Project } from '../types/project';

interface ProjectInfoProps {
  project: Project | null;
}

export function ProjectInfo({ project }: ProjectInfoProps) {
  if (!project) {
    return (
      <div className="flex items-center gap-3 animate-fade-in">
        <FolderGit2 className="w-4 h-4 text-[#8b5a3c]" />
        <div>
          <p className="text-sm font-mono font-semibold text-[#8b5a3c] tracking-wider">
            SELECT_PROJECT
            <span className="text-[#d4784a] animate-cursor-blink">_</span>
          </p>
          <p className="text-[10px] font-mono text-[#4a2a1a] mt-0.5 tracking-widest">
            ◄ SIDEBAR ►
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3">
        <FolderOpen className="w-4 h-4 text-[#d4784a]" />
        <div>
          <h2 className="text-sm font-mono font-semibold text-[#f0ece8] text-glow tracking-tight">
            {project.name}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs font-mono">
            <span className="text-[#8b5a3c] flex items-center gap-1.5" title={project.path}>
              <span className="text-[#4a2a1a]">PATH:</span>
              <span className="truncate max-w-[400px] text-[#b0a89a]">{project.path}</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded border text-[11px] font-mono ${getBranchStyle(project.branch)}`}>
              {project.branch}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

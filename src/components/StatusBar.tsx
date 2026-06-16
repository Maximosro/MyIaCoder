import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { getBranchStyle } from '../types/project';
import type { Project } from '../types/project';

interface StatusBarProps {
  workspacePath: string;
  selectedProject: Project | null;
}

export function StatusBar({ workspacePath, selectedProject }: StatusBarProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-7 bg-[#0a0a0a] border-t border-[#1f1a15] text-[11px] font-mono text-[#8b5a3c] flex items-center px-4 gap-4 flex-shrink-0 select-none relative z-10">
      {/* Center: selected project or workspace */}
      {selectedProject ? (
        <span className="flex items-center gap-2 truncate" title={selectedProject.path}>
          <FolderOpen className="w-3 h-3 text-[#d4784a] flex-shrink-0" />
          <span className="text-[#f0ece8] truncate">{selectedProject.name}</span>
          <span className="text-[#8b5a3c] truncate max-w-[200px] hidden sm:inline">{selectedProject.path}</span>
          <span className={`text-[10px] px-1 py-0.5 rounded border flex-shrink-0 ${getBranchStyle(selectedProject.branch)}`}>
            {selectedProject.branch}
          </span>
        </span>
      ) : (
        <span className="truncate max-w-[350px] text-[#8b5a3c]/70" title={workspacePath}>
          {workspacePath}
        </span>
      )}

      <span className="ml-auto text-[#d4784a]/60 tabular-nums tracking-wider">{time}</span>
    </div>
  );
}

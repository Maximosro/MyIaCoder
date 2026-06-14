import { RefreshCw, Settings, Power } from 'lucide-react';
import type { Project } from '../types/project';
import { ProjectItem } from './ProjectItem';

interface SidebarProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
  openTabPaths: Set<string>;
  onSelectProject: (project: Project) => void;
  onRefresh: () => void;
  onConfig: () => void;
  onClose: () => void;
}

export function Sidebar({
  projects,
  loading,
  error,
  selectedPath,
  openTabPaths,
  onSelectProject,
  onRefresh,
  onConfig,
  onClose,
}: SidebarProps) {
  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-[#1f1a15] flex flex-col h-full bg-[#0a0a0a] relative z-10">
      {/* Header */}
      <div className="p-4 border-b border-[#1f1a15]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-mono font-semibold text-[#f0ece8] text-glow tracking-wider">
              ◈ AI_CODE_MGR
            </h1>
            <p className="text-[10px] text-[#8b5a3c] mt-0.5 font-mono tracking-widest uppercase">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a] disabled:opacity-30"
            title="Refresh projects"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1f1a15]/40">
        {loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <RefreshCw className="w-5 h-5 text-[#d4784a] animate-spin" />
            <p className="text-[11px] font-mono text-[#8b5a3c] tracking-widest">
              INITIALIZING<span className="animate-cursor-blink">_</span>
            </p>
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-center animate-fade-in">
            <p className="text-[#e05555] text-xs font-mono">{error}</p>
            <button
              onClick={onRefresh}
              className="mt-2 text-xs font-mono text-[#d4784a] hover:text-[#e8956a] transition-colors tracking-wider"
            >
              RETRY_
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="px-4 py-8 text-center animate-fade-in">
            <p className="text-[#8b5a3c] text-xs font-mono tracking-wider">
              NO_PROJECTS_FOUND
            </p>
            <button
              onClick={onConfig}
              className="mt-2 text-xs font-mono text-[#d4784a] hover:text-[#e8956a] transition-colors tracking-wider"
            >
              SET_WORKSPACE_
            </button>
          </div>
        )}

        {projects.map((project, i) => (
          <div key={project.path} className="animate-fade-in-left" style={{ animationDelay: `${i * 40}ms` }}>
            <ProjectItem
              project={project}
              isSelected={project.path === selectedPath}
              hasOpenTab={openTabPaths.has(project.path)}
              onClick={() => onSelectProject(project)}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-[#1f1a15] p-3 flex gap-2">
        <button
          onClick={onConfig}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] border border-[#1f1a15] hover:border-[#d4784a]/30 transition-all duration-200 font-mono"
          title="Change workspace folder"
        >
          <Settings className="w-3.5 h-3.5" />
          CONFIG
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[#0f0f0f] hover:bg-[#1a0a0a] text-[#8b5a3c] hover:text-[#e05555] border border-[#1f1a15] hover:border-[#e05555]/30 transition-all duration-200 font-mono"
          title="Close application"
        >
          <Power className="w-3.5 h-3.5" />
          EXIT
        </button>
      </div>
    </aside>
  );
}

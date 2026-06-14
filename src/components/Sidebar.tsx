import type { Project } from '../types/project';
import { ProjectItem } from './ProjectItem';

interface SidebarProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
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
  onSelectProject,
  onRefresh,
  onConfig,
  onClose,
}: SidebarProps) {
  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-gray-100">AI Code Manager</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Project Workspace</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300 disabled:opacity-50"
            title="Refresh projects"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {loading && projects.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={onRefresh}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500 text-sm">No projects found</p>
            <button
              onClick={onConfig}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Change workspace folder
            </button>
          </div>
        )}

        {projects.map((project) => (
          <ProjectItem
            key={project.path}
            project={project}
            isSelected={project.path === selectedPath}
            onClick={() => onSelectProject(project)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-gray-700 p-3 flex gap-2">
        <button
          onClick={onConfig}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
        >
          Config
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
        >
          Close
        </button>
      </div>
    </aside>
  );
}

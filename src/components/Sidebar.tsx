import { RefreshCw, FolderOpen } from 'lucide-react';
import type { Project } from '../types/project';
import { ProjectItem } from './ProjectItem';
import { RpiPlansTree, TreeNodeItem } from './RpiPlansTree';
import { usePlansTree } from '../hooks/usePlansTree';
import { useProjectTree } from '../hooks/useProjectTree';

interface SidebarProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
  openTabPaths: Set<string>;
  plansPath: string;
  onSelectProject: (project: Project) => void;
  onRefresh: () => void;
  onConfig: () => void;
  onOpenTodos: () => void;
  onFileClick?: (filePath: string) => void;
}

export function Sidebar({
  projects,
  loading,
  error,
  selectedPath,
  openTabPaths,
  plansPath,
  onSelectProject,
  onRefresh,
  onConfig,
  onOpenTodos,
  onFileClick,
}: SidebarProps) {
  const { tree, loading: plansLoading, error: plansError, refresh: refreshPlans } = usePlansTree(plansPath);
  const { tree: projectTree, loading: projectTreeLoading } = useProjectTree(selectedPath);

  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-[#1f1a15] flex flex-col h-full bg-[#0a0a0a] relative z-10">
      {/* Header */}
      <div className="p-4 border-b border-[#1f1a15]">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8b5a3c] font-mono tracking-widest uppercase flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-[#d4784a]" />
            /projects <span className="text-[#6ba86b]">{projects.length}</span>
          </p>
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
            {/* Project .claude / .github tree — shown when selected */}
            {project.path === selectedPath && (
              <div className="border-t border-[#1f1a15]/30">
                {projectTreeLoading && projectTree.length === 0 && (
                  <div className="flex items-center justify-center py-3">
                    <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
                  </div>
                )}
                {!projectTreeLoading && projectTree.length === 0 && (
                  <div className="px-2 py-3 text-center">
                    <p className="text-[#8b5a3c] text-[10px] font-mono tracking-wider">
                      NO_CLAUDE_OR_GITHUB
                    </p>
                  </div>
                )}
                {projectTree.map((node) => (
                  <TreeNodeItem key={node.path} node={node} depth={1} onFileClick={onFileClick} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* RPI Plans tree — always visible below project list */}
      <RpiPlansTree
        tree={tree}
        loading={plansLoading}
        error={plansError}
        onOpenTodos={onOpenTodos}
        onRefresh={refreshPlans}
        onFileClick={onFileClick}
      />
    </aside>
  );
}

import { RefreshCw, FolderOpen, ArrowLeft, ChevronRight, FolderGit2 } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '../types/project';
import { ProjectItem } from './ProjectItem';
import { RpiPlansTree, TreeNodeItem } from './RpiPlansTree';
import { GitChangesTree } from './GitChangesTree';
import { usePlansTree } from '../hooks/usePlansTree';
import { useProjectTree } from '../hooks/useProjectTree';

interface SidebarProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
  openTabPaths: Set<string>;
  plansPath: string;
  treeRefreshKey: number;
  onSelectProject: (project: Project) => void;
  onRefresh: () => void;
  onBack?: () => void;
  onConfig: () => void;
  onOpenTodos: () => void;
  onFileClick?: (filePath: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
}

export function Sidebar({
  projects,
  loading,
  error,
  selectedPath,
  openTabPaths,
  plansPath,
  treeRefreshKey,
  onSelectProject,
  onRefresh,
  onBack,
  onConfig,
  onOpenTodos,
  onFileClick,
  onDeleteFile,
  onOpenDiff,
}: SidebarProps) {
  const { tree, loading: plansLoading, error: plansError, refresh: refreshPlans } = usePlansTree(plansPath, treeRefreshKey);
  const { tree: projectTree, loading: projectTreeLoading } = useProjectTree(selectedPath, treeRefreshKey);
  const [claudeExpanded, setClaudeExpanded] = useState(true);

  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-[#1f1a15] flex flex-col h-full bg-[#0a0a0a] relative z-10">
      {/* Header */}
      <div className="p-4 border-b border-[#1f1a15]">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8b5a3c] font-mono tracking-widest uppercase flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-[#d4784a]" />
            /projects <span className="text-[#6ba86b]">{projects.length}</span>
          </p>
          <div className="flex items-center gap-0.5">
            {onBack && selectedPath && (
              <button
                onClick={onBack}
                className="p-1.5 rounded hover:bg-[#0f0f0f] transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a] animate-fade-in"
                title="Volver a proyectos"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
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

        {/* When a project is focused, only show that project */}
        {(selectedPath
          ? projects.filter((p) => p.path === selectedPath)
          : projects
        ).map((project, i) => (
          <div key={project.path} className="animate-fade-in-left" style={{ animationDelay: `${i * 40}ms` }}>
            <ProjectItem
              project={project}
              isSelected={project.path === selectedPath}
              hasOpenTab={openTabPaths.has(project.path)}
              onClick={() => onSelectProject(project)}
            />
            {/* Project .claude / .github + Git changes — separate sections when selected */}
            {project.path === selectedPath && (
              <div className="slide-expand border-t border-[#1f1a15]/30 divide-y divide-[#1f1a15]/20">
                {/* ── Section 1: Claude & GitHub folders ── */}
                {projectTree.length > 0 && (
                  <div>
                    <button
                      onClick={() => setClaudeExpanded((prev) => !prev)}
                      className="w-full flex items-center gap-1.5 py-1.5 px-3 text-left font-mono transition-colors duration-150 border-l-2 border-transparent hover:bg-[#0f0f0f] hover:border-[#8b5a3c]/30"
                    >
                      <ChevronRight
                        className={`w-3 h-3 text-[#8b5a3c] transition-transform duration-200 flex-shrink-0 ${claudeExpanded ? 'rotate-90' : 'rotate-0'}`}
                      />
                      <FolderGit2 className="w-3.5 h-3.5 text-[#7b9ec4] flex-shrink-0" />
                      <span className="text-[11px] text-[#f0ece8] tracking-wider">Claude & GitHub</span>
                      <span className="text-[10px] text-[#7b9ec4] ml-auto">{projectTree.length}</span>
                    </button>
                    <div
                      className={`transition-all duration-300 ease-out ${
                        claudeExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                      }`}
                    >
                      {projectTreeLoading && (
                        <div className="flex items-center justify-center py-3">
                          <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
                        </div>
                      )}
                      {projectTree.map((node) => (
                        <TreeNodeItem key={node.path} node={node} depth={1} onFileClick={onFileClick} onDeleteFile={onDeleteFile} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading state for claude/github when tree is empty */}
                {projectTreeLoading && projectTree.length === 0 && (
                  <div className="flex items-center justify-center py-3">
                    <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
                  </div>
                )}

                {/* Empty state for claude/github (not loading, no folders) */}
                {!projectTreeLoading && projectTree.length === 0 && (
                  <div className="px-2 py-2 text-center">
                    <p className="text-[#8b5a3c] text-[10px] font-mono tracking-wider">
                      NO_CLAUDE_OR_GITHUB
                    </p>
                  </div>
                )}

                {/* ── Section 2: Git Changes ── */}
                <GitChangesTree
                  projectPath={project.path}
                  refreshKey={treeRefreshKey}
                  onFileClick={onFileClick}
                  onOpenDiff={onOpenDiff}
                />
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
        onDeleteFile={onDeleteFile}
      />
    </aside>
  );
}

import { RefreshCw, FolderOpen, ArrowLeft, FolderGit2, GitCompare, ListTodo, MessageSquarePlus, Terminal, Sparkles, Code2, Bot, Brain, Cpu, SquareTerminal, TerminalSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Project } from '../types/project';
import type { ClientsConfig } from '../../electron/preload';
import type { TaskSource } from '../types/task';
import { ProjectItem } from './ProjectItem';
import { TreeNodeItem } from './TreeNodeItem';
import { PlansPanelTabs } from './PlansPanelTabs';
import { GitChangesTree } from './GitChangesTree';
import { TasksTree } from './TasksTree';
import { usePlansTree } from '../hooks/usePlansTree';
import { useSkillsTree } from '../hooks/useSkillsTree';
import { usePromptsTree } from '../hooks/usePromptsTree';
import { useProjectTree } from '../hooks/useProjectTree';

interface SidebarProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
  openTabPaths: Set<string>;
  plansPath: string;
  skillsPath: string;
  promptsPath: string;
  treeRefreshKey: number;
  onSelectProject: (project: Project) => void;
  onRefresh: () => void;
  onBack?: () => void;
  onConfig: () => void;
  onFileClick?: (filePath: string) => void;
  onDeleteFile?: (filePath: string) => void;
  onOpenDiff?: (filePath: string) => void;
  onCreatePrompt: (name: string) => void | Promise<void>;
  onLaunchClaude: () => void;
  onLaunchCopilot: () => void;
  onLaunchVscode: () => void;
  onLaunchCodewhale: () => void;
  onLaunchReasonix: () => void;
  onLaunchOpencode: () => void;
  onLaunchTerminal: () => void;
  clients: ClientsConfig;
}

export function Sidebar({
  projects,
  loading,
  error,
  selectedPath,
  openTabPaths,
  plansPath,
  skillsPath,
  promptsPath,
  treeRefreshKey,
  onSelectProject,
  onRefresh,
  onBack,
  onConfig,
  onFileClick,
  onDeleteFile,
  onOpenDiff,
  onCreatePrompt,
  onLaunchClaude,
  onLaunchCopilot,
  onLaunchVscode,
  onLaunchCodewhale,
  onLaunchReasonix,
  onLaunchOpencode,
  onLaunchTerminal,
  clients,
}: SidebarProps) {
  const { tree, loading: plansLoading, error: plansError, refresh: refreshPlans } = usePlansTree(plansPath, treeRefreshKey);
  const { tree: skillsTree, loading: skillsLoading, error: skillsError, refresh: refreshSkills } = useSkillsTree(treeRefreshKey);
  const { tree: promptsTree, loading: promptsLoading, error: promptsError, refresh: refreshPrompts } = usePromptsTree(promptsPath, treeRefreshKey);
  const { tree: projectTree, loading: projectTreeLoading } = useProjectTree(selectedPath, treeRefreshKey);
  const [activeTab, setActiveTab] = useState<'files' | 'changes' | 'tasks'>('files');
  const [launchMenuOpen, setLaunchMenuOpen] = useState(false);
  const launchMenuRef = useRef<HTMLDivElement>(null);
  const [termMenuOpen, setTermMenuOpen] = useState(false);
  const termMenuRef = useRef<HTMLDivElement>(null);

  // The Tasks tab only makes sense when at least one CLI client (Claude/Copilot)
  // that registers live sessions is enabled.
  const taskSources: TaskSource[] = [
    ...(clients.copilot ? (['copilot'] as const) : []),
    ...(clients.claude ? (['claude'] as const) : []),
    ...(clients.reasonix ? (['reasonix'] as const) : []),
  ];
  const tasksEnabled = taskSources.length > 0;

  // If the Tasks tab gets disabled while it's active, fall back to Files.
  useEffect(() => {
    if (!tasksEnabled && activeTab === 'tasks') {
      setActiveTab('files');
    }
  }, [tasksEnabled, activeTab]);

  // Close the launch menu on any click outside it (robust across stacking contexts).
  useEffect(() => {
    if (!launchMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (launchMenuRef.current && !launchMenuRef.current.contains(e.target as Node)) {
        setLaunchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [launchMenuOpen]);

  // Close the external-terminal menu on any click outside it.
  useEffect(() => {
    if (!termMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (termMenuRef.current && !termMenuRef.current.contains(e.target as Node)) {
        setTermMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [termMenuOpen]);

  return (
    <aside className="w-[380px] flex-shrink-0 border-r border-[#1f1a15] flex flex-col h-full bg-[#0a0a0a] relative z-10">
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

            {/* Launch menu — only when a project is selected */}
            {selectedPath && (
              <div className="relative animate-fade-in" ref={launchMenuRef}>
                <button
                  onClick={() => setLaunchMenuOpen((o) => !o)}
                  className={`p-1.5 rounded transition-all duration-200 hover:bg-[#0f0f0f] ${
                    launchMenuOpen ? 'text-[#d4784a] bg-[#0f0f0f]' : 'text-[#8b5a3c] hover:text-[#d4784a]'
                  }`}
                  title="Lanzar terminal"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                </button>

                {launchMenuOpen && (
                  <div className="absolute right-0 mt-1 w-44 z-30 bg-[#0a0a0a] border border-[#1f1a15] rounded shadow-[0_8px_30px_rgba(0,0,0,0.6)] py-1 animate-fade-in">
                    {clients.claude && (
                    <button
                      onClick={() => { setLaunchMenuOpen(false); onLaunchClaude(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#d4784a] hover:bg-[#1a0f0a] transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      CLAUDE
                    </button>
                    )}
                    {clients.copilot && (
                    <button
                      onClick={() => { setLaunchMenuOpen(false); onLaunchCopilot(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#6ba86b] hover:bg-[#0a1a0e] transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      COPILOT
                    </button>
                    )}
                    <button
                      onClick={() => { setLaunchMenuOpen(false); onLaunchVscode(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#7b9ec4] hover:bg-[#0a1520] transition-colors"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      VSCODE
                    </button>
                    {clients.codewhale && (
                    <button
                      onClick={() => { setLaunchMenuOpen(false); onLaunchCodewhale(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#c4a36b] hover:bg-[#1a140a] transition-colors"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      CODEWHALE
                    </button>
                    )}
                    {clients.reasonix && (
                    <button
                      onClick={() => { setLaunchMenuOpen(false); onLaunchReasonix(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#a98bd4] hover:bg-[#140a1a] transition-colors"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      REASONIX
                    </button>
                    )}
                    {clients.opencode && (
                    <button
                      onClick={() => { setLaunchMenuOpen(false); onLaunchOpencode(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#6bc4b0] hover:bg-[#0a1a16] transition-colors"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      OPENCODE
                    </button>
                    )}
                    <div className="my-1 border-t border-[#1f1a15]" />
                    <button
                      onClick={() => { setLaunchMenuOpen(false); onLaunchTerminal(); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#b0a89a] hover:bg-[#0f0f0f] transition-colors"
                    >
                      <SquareTerminal className="w-3.5 h-3.5" />
                      TERMINAL
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={termMenuRef}>
              {!selectedPath && (
                <button
                  onClick={() => setTermMenuOpen((o) => !o)}
                  className={`p-1.5 rounded transition-all duration-200 hover:bg-[#0f0f0f] ${
                    termMenuOpen ? 'text-[#d4784a] bg-[#0f0f0f]' : 'text-[#8b5a3c] hover:text-[#d4784a]'
                  }`}
                  title="Abrir terminal externa"
                >
                  <TerminalSquare className="w-4 h-4" />
                </button>
              )}

              {!selectedPath && termMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 z-30 bg-[#0a0a0a] border border-[#1f1a15] rounded shadow-[0_8px_30px_rgba(0,0,0,0.6)] py-1 animate-fade-in">
                  <button
                    onClick={() => { setTermMenuOpen(false); window.electronAPI.launchTerminal('wt'); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#7b9ec4] hover:bg-[#0a1520] transition-colors"
                  >
                    <TerminalSquare className="w-3.5 h-3.5" />
                    WINDOWS TERMINAL
                  </button>
                  <button
                    onClick={() => { setTermMenuOpen(false); window.electronAPI.launchTerminal('powershell'); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono tracking-wider text-[#6ba86b] hover:bg-[#0a1a0e] transition-colors"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    POWERSHELL
                  </button>
                </div>
              )}
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
            {/* Project explorer: Files (.claude/.github) · Changes · Tasks tabs */}
            {project.path === selectedPath && (
              <div className="slide-expand border-t border-[#1f1a15]/30">
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0a0a0a]">
                  <button
                    onClick={() => setActiveTab('files')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono tracking-wider rounded transition-colors ${
                      activeTab === 'files'
                        ? 'bg-[#1a0f0a] text-[#d4784a] border border-[#d4784a]/30'
                        : 'text-[#8b5a3c] hover:text-[#b0a89a] border border-transparent'
                    }`}
                  >
                    <FolderGit2 className="w-3 h-3" />
                    FILES
                  </button>
                  <button
                    onClick={() => setActiveTab('changes')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono tracking-wider rounded transition-colors ${
                      activeTab === 'changes'
                        ? 'bg-[#1a0f0a] text-[#d4784a] border border-[#d4784a]/30'
                        : 'text-[#8b5a3c] hover:text-[#b0a89a] border border-transparent'
                    }`}
                  >
                    <GitCompare className="w-3 h-3" />
                    CHANGES
                  </button>
                  {tasksEnabled && (
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono tracking-wider rounded transition-colors ${
                      activeTab === 'tasks'
                        ? 'bg-[#1a0f0a] text-[#d4784a] border border-[#d4784a]/30'
                        : 'text-[#8b5a3c] hover:text-[#b0a89a] border border-transparent'
                    }`}
                  >
                    <ListTodo className="w-3 h-3" />
                    TASKS
                  </button>
                  )}
                </div>

                {/* ── FILES tab: full project file tree ── */}
                {activeTab === 'files' && (
                  <div>
                    {projectTreeLoading && (
                      <div className="flex items-center justify-center py-3">
                        <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
                      </div>
                    )}
                    {!projectTreeLoading && projectTree.length === 0 && (
                      <div className="px-2 py-2 text-center">
                        <p className="text-[#8b5a3c] text-[10px] font-mono tracking-wider">
                          EMPTY_PROJECT
                        </p>
                      </div>
                    )}
                    {projectTree.map((node) => (
                      <TreeNodeItem key={node.path} node={node} depth={0} onFileClick={onFileClick} onDeleteFile={onDeleteFile} />
                    ))}
                  </div>
                )}

                {/* ── CHANGES tab: git changes ── */}
                {activeTab === 'changes' && (
                  <GitChangesTree
                    projectPath={project.path}
                    refreshKey={treeRefreshKey}
                    onFileClick={onFileClick}
                    onOpenDiff={onOpenDiff}
                  />
                )}

                {/* ── TASKS tab: live CLI tasks ── */}
                {tasksEnabled && activeTab === 'tasks' && (
                  <TasksTree projectPath={project.path} refreshKey={treeRefreshKey} sources={taskSources} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Plans / Skills / Prompt panel tabs */}
      <PlansPanelTabs
        plansTree={tree}
        plansLoading={plansLoading}
        plansError={plansError}
        onRefreshPlans={refreshPlans}
        skillsTree={skillsTree}
        skillsLoading={skillsLoading}
        skillsError={skillsError}
        onRefreshSkills={refreshSkills}
        promptsTree={promptsTree}
        promptsLoading={promptsLoading}
        promptsError={promptsError}
        onRefreshPrompts={refreshPrompts}
        onCreatePrompt={onCreatePrompt}
        onFileClick={onFileClick}
        onDeleteFile={onDeleteFile}
      />
    </aside>
  );
}

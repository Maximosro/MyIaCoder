import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ProjectInfo } from './components/ProjectInfo';
import { TerminalPanel } from './components/TerminalPanel';
import { StatusBar } from './components/StatusBar';
import { useProjects } from './hooks/useProjects';
import { useTerminal } from './hooks/useTerminal';
import type { Project } from './types/project';

function App() {
  const { projects, loading, error, refresh } = useProjects();
  const { tabs, activeTabId, openTab, closeTab, setActiveTab } = useTerminal();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [workspacePath, setWorkspacePath] = useState('C:\\Workspace');

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => setWorkspacePath(s.workspacePath));
  }, [projects]);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    // Also activate the corresponding tab if it exists
    const existingTab = tabs.find((t) => t.projectPath === project.path);
    if (existingTab) {
      setActiveTab(existingTab.id);
    }
  };

  const handleConfig = async () => {
    const folder = await window.electronAPI.pickWorkspace();
    if (folder) {
      const currentSettings = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({ ...currentSettings, workspacePath: folder });
      setWorkspacePath(folder);
      refresh();
    }
  };

  const handleClose = () => {
    window.close();
  };

  const handleOpenTab = (project: Project) => {
    openTab(project);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        loading={loading}
        error={error}
        selectedPath={selectedProject?.path ?? null}
        onSelectProject={handleSelectProject}
        onRefresh={refresh}
        onConfig={handleConfig}
        onClose={handleClose}
      />

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Project info (top) */}
        <div className="border-b border-gray-800 p-6 flex-shrink-0">
          <ProjectInfo project={selectedProject} />
        </div>

        {/* Terminal area (bottom) */}
        <TerminalPanel
          tabs={tabs}
          activeTabId={activeTabId}
          activeProject={selectedProject}
          onOpenTab={handleOpenTab}
          onCloseTab={closeTab}
          onSelectTab={setActiveTab}
        />

        <StatusBar
          projectCount={projects.length}
          workspacePath={workspacePath}
        />
      </main>

      {/* Settings modal (simple) */}
    </div>
  );
}

export default App;

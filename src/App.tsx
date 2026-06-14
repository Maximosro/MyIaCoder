import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TerminalPanel } from './components/TerminalPanel';
import { StatusBar } from './components/StatusBar';
import { useProjects } from './hooks/useProjects';
import { useTerminal } from './hooks/useTerminal';
import type { Project } from './types/project';

function App() {
  const { projects, loading, error, refresh } = useProjects();
  const { tabs, activeTabId, openTab, forceOpenTab, closeTab, setActiveTab } = useTerminal();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [workspacePath, setWorkspacePath] = useState('C:\\Workspace');

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => setWorkspacePath(s.workspacePath));
  }, [projects]);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
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

  const handleOpenTab = (project: Project, title: string) => {
    openTab(project, title);
  };

  const handleForceOpenTab = (project: Project, title: string) => {
    forceOpenTab(project, title);
  };

  const openTabPaths = new Set(tabs.map((t) => t.projectPath));

  return (
    <div className="flex h-screen bg-[#050505] text-[#f0ece8] relative overflow-hidden">
      {/* Warm copper ambient glow — slow breathing background */}
      <div className="warm-ambient" />

      {/* Sidebar */}
      <Sidebar
        projects={projects}
        loading={loading}
        error={error}
        selectedPath={selectedProject?.path ?? null}
        openTabPaths={openTabPaths}
        onSelectProject={handleSelectProject}
        onRefresh={refresh}
        onConfig={handleConfig}
        onClose={handleClose}
      />

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Terminal area — full height */}
        <TerminalPanel
          tabs={tabs}
          activeTabId={activeTabId}
          activeProject={selectedProject}
          onOpenTab={handleOpenTab}
          onForceOpenTab={handleForceOpenTab}
          onCloseTab={closeTab}
          onSelectTab={setActiveTab}
        />

        <StatusBar
          workspacePath={workspacePath}
          selectedProject={selectedProject}
        />
      </main>
    </div>
  );
}

export default App;

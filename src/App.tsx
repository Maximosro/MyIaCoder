import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TerminalPanel } from './components/TerminalPanel';
import { StatusBar } from './components/StatusBar';
import { ConfigModal } from './components/ConfigModal';
import { TitleBar } from './components/TitleBar';
import { useProjects } from './hooks/useProjects';
import { useTabs } from './hooks/useTabs';
import type { Project } from './types/project';

function App() {
  const { projects, loading, error, refresh } = useProjects();
  const {
    tabs,
    activeTabId,
    openTab,
    forceOpenTab,
    openFileTab,
    closeTab,
    setActiveTab,
    saveFileTab,
    markTabDirty,
    getFileContent,
    openTodoTab,
  } = useTabs();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [workspacePath, setWorkspacePath] = useState('C:\\Workspace');
  const [plansPath, setPlansPath] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setWorkspacePath(s.workspacePath);
      setPlansPath(s.plansPath);
    });
  }, [projects]);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    const existingTab = tabs.find((t) => t.projectPath === project.path);
    if (existingTab) {
      setActiveTab(existingTab.id);
    }
  };

  const handleOpenConfig = () => {
    setConfigOpen(true);
  };

  const handleSaveConfig = async (newWorkspacePath: string, newPlansPath: string) => {
    const currentSettings = await window.electronAPI.getSettings();
    await window.electronAPI.saveSettings({
      ...currentSettings,
      workspacePath: newWorkspacePath,
      plansPath: newPlansPath,
    });
    setWorkspacePath(newWorkspacePath);
    setPlansPath(newPlansPath);
    refresh();
  };

  const handleOpenTodos = () => {
    openTodoTab();
  };

  const handleOpenTab = (project: Project, title: string, command?: string) => {
    openTab(project, title, command);
  };

  const handleForceOpenTab = (project: Project, title: string, command?: string) => {
    forceOpenTab(project, title, command);
  };

  const handleFileOpen = async (filePath: string) => {
    // Use selected project if available, otherwise derive from file path
    const project = selectedProject ?? {
      name: 'plans',
      path: filePath.substring(0, filePath.lastIndexOf('\\')),
      branch: '',
    };
    // Ensure a project is selected so TerminalPanel shows the tab bar
    if (!selectedProject) setSelectedProject(project);
    await openFileTab(project, filePath);
  };

  const handleSaveFile = async (tabId: string, content: string) => {
    await saveFileTab(tabId, content);
  };

  const handleFileDirtyChange = (tabId: string, isDirty: boolean) => {
    markTabDirty(tabId, isDirty);
  };

  const handleDeleteFile = async (filePath: string) => {
    try {
      await window.electronAPI.deleteFile(filePath);

      // Close any open tabs whose file is the deleted entry or inside a deleted directory
      const normalizedDeleted = filePath.replace(/\\/g, '/');
      const tabsToClose = tabs.filter((t) => {
        if (!t.filePath) return false;
        const normalizedTab = t.filePath.replace(/\\/g, '/');
        return normalizedTab === normalizedDeleted || normalizedTab.startsWith(normalizedDeleted + '/');
      });

      for (const tab of tabsToClose) {
        await closeTab(tab.id);
      }

      // Refresh the project list to trigger tree re-reading
      refresh();
      setTreeRefreshKey((k) => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      console.error('Delete failed:', message);
      // Tree may be stale — refresh to resync with filesystem
      refresh();
      setTreeRefreshKey((k) => k + 1);
    }
  };

  const openTabPaths = new Set(tabs.map((t) => t.projectPath));

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-[#f0ece8] relative overflow-hidden">
      {/* Custom title bar (replaces native Windows frame) */}
      <TitleBar onConfig={handleOpenConfig} />

      {/* Main content area */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Warm copper ambient glow — slow breathing background */}
        <div className="warm-ambient" />

        {/* Sidebar */}
        <Sidebar
          projects={projects}
          loading={loading}
          error={error}
          selectedPath={selectedProject?.path ?? null}
          openTabPaths={openTabPaths}
          plansPath={plansPath}
          treeRefreshKey={treeRefreshKey}
          onSelectProject={handleSelectProject}
          onRefresh={refresh}
          onConfig={handleOpenConfig}
          onOpenTodos={handleOpenTodos}
          onFileClick={handleFileOpen}
          onDeleteFile={handleDeleteFile}
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
            onSaveFile={handleSaveFile}
            onFileDirtyChange={handleFileDirtyChange}
            getFileContent={getFileContent}
          />

          <StatusBar
            workspacePath={workspacePath}
            selectedProject={selectedProject}
          />
        </main>

        {/* Config Modal */}
        <ConfigModal
          open={configOpen}
          workspacePath={workspacePath}
          plansPath={plansPath}
          onClose={() => setConfigOpen(false)}
          onSave={handleSaveConfig}
        />
      </div>
    </div>
  );
}

export default App;

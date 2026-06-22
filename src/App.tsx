import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TerminalPanel } from './components/TerminalPanel';
import { ConfigModal } from './components/ConfigModal';
import { AboutModal } from './components/AboutModal';
import { TitleBar } from './components/TitleBar';
import { useProjects } from './hooks/useProjects';
import { useTabs } from './hooks/useTabs';
import type { Project } from './types/project';
import type { ClientsConfig } from '../electron/preload';

const DEFAULT_CLIENTS: ClientsConfig = {
  claude: true,
  copilot: true,
  codewhale: true,
  reasonix: true,
  opencode: true,
};

function App() {
  const { projects, loading, error, refresh } = useProjects();
  const {
    tabs,
    activeTabId,
    openTab,
    forceOpenTab,
    openFileTab,
    openDiffTab,
    closeTab,
    setActiveTab,
    saveFileTab,
    markTabDirty,
    getFileContent,
    markTabBusy,
    moveTab,
  } = useTabs();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [workspacePath, setWorkspacePath] = useState('C:\\Workspace');
  const [plansPath, setPlansPath] = useState('');
  const [skillsPath, setSkillsPath] = useState('');
  const [promptsPath, setPromptsPath] = useState('');
  const [clients, setClients] = useState<ClientsConfig>(DEFAULT_CLIENTS);
  const [configOpen, setConfigOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [terminalScrollback, setTerminalScrollback] = useState(20000);
  const [backgroundMusic, setBackgroundMusic] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  // Launch trigger: when tick increments, TerminalPanel shows the name prompt.
  // Sidebar and empty-state buttons both use this instead of opening tabs directly.
  const [launchTrigger, setLaunchTrigger] = useState<{ command?: string; force: boolean; tick: number }>({ force: false, tick: 0 });

  // Background music
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (backgroundMusic) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [backgroundMusic]);

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setWorkspacePath(s.workspacePath);
      setPlansPath(s.plansPath);
      setSkillsPath(s.skillsPath || '');
      setPromptsPath(s.promptsPath || '');
      setClients({ ...DEFAULT_CLIENTS, ...s.clients });
      setTerminalScrollback(s.terminalScrollback ?? 20000);
      setBackgroundMusic(s.backgroundMusic ?? true);
      setOnboardingComplete(s.onboardingComplete ?? false);
      if (!s.onboardingComplete) {
        setConfigOpen(true);
      }
    });
  }, []);

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    const existingTab = tabs.find((t) => t.projectPath === project.path);
    if (existingTab) {
      setActiveTab(existingTab.id);
    }
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
  };

  const handleLaunchVscode = () => {
    if (selectedProject) {
      window.electronAPI.launchVscode(selectedProject.path);
    }
  };

  const requestLaunch = (command?: string, force = false) => {
    setLaunchTrigger((prev) => ({ command, force, tick: prev.tick + 1 }));
  };

  const handleOpenDiff = async (filePath: string) => {
    if (!selectedProject) return;
    await openDiffTab(selectedProject, filePath);
  };

  const handleOpenConfig = () => {
    setConfigOpen(true);
  };

  const handleOpenAbout = () => {
    setAboutOpen(true);
  };

  const handleCloseAbout = () => {
    setAboutOpen(false);
  };

  const handleSaveConfig = async (newWorkspacePath: string, newPlansPath: string, newSkillsPath: string, newPromptsPath: string, newClients: ClientsConfig, newTerminalScrollback: number, newBackgroundMusic: boolean) => {
    const currentSettings = await window.electronAPI.getSettings();
    await window.electronAPI.saveSettings({
      ...currentSettings,
      workspacePath: newWorkspacePath,
      plansPath: newPlansPath,
      skillsPath: newSkillsPath,
      promptsPath: newPromptsPath,
      clients: newClients,
      terminalScrollback: newTerminalScrollback,
      backgroundMusic: newBackgroundMusic,
      onboardingComplete: true,
    });
    setWorkspacePath(newWorkspacePath);
    setPlansPath(newPlansPath);
    setSkillsPath(newSkillsPath);
    setPromptsPath(newPromptsPath);
    setClients(newClients);
    setTerminalScrollback(newTerminalScrollback);
    setBackgroundMusic(newBackgroundMusic);
    setOnboardingComplete(true);
    refresh();
    setTreeRefreshKey((k) => k + 1);
  };

  const handleCreatePrompt = async (rawName: string) => {
    if (!promptsPath) return;
    const trimmed = rawName.trim();
    if (!trimmed) return;
    const name = /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
    const sep = promptsPath.includes('\\') ? '\\' : '/';
    const base = promptsPath.endsWith(sep) ? promptsPath.slice(0, -1) : promptsPath;
    const filePath = `${base}${sep}${name}`;
    try {
      await window.electronAPI.createFile(filePath, '');
      setTreeRefreshKey((k) => k + 1);
      await handleFileOpen(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create prompt';
      console.error('Create prompt failed:', message);
      setTreeRefreshKey((k) => k + 1);
    }
  };

  const handleOpenTab = (project: Project, title: string, command?: string) => {
    openTab(project, title, command);
  };

  const handleForceOpenTab = (project: Project, title: string, command?: string) => {
    forceOpenTab(project, title, command);
  };

  const handleFileOpen = async (filePath: string) => {
    // Plans/skills files are autonomous: they open in a file tab without
    // selecting a project (avoids triggering the git panel on a non-repo folder).
    const sep = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    const dir = sep >= 0 ? filePath.substring(0, sep) : filePath;
    const project = selectedProject ?? {
      name: dir.replace(/\\/g, '/').split('/').pop() || 'file',
      path: dir,
      branch: '',
    };
    // ponytail: prompt files open in editable mode
    const normPath = filePath.replace(/\\/g, '/');
    const normPrompts = (promptsPath || '').replace(/\\/g, '/').replace(/\/$/, '');
    const unlocked = !!normPrompts && normPath.startsWith(normPrompts + '/');
    await openFileTab(project, filePath, unlocked);
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
      <TitleBar onConfig={handleOpenConfig} onAbout={handleOpenAbout} />

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
          skillsPath={skillsPath}
          promptsPath={promptsPath}
          treeRefreshKey={treeRefreshKey}
          onSelectProject={handleSelectProject}
          onRefresh={() => { refresh(); setTreeRefreshKey((k) => k + 1); }}
          onBack={handleBackToProjects}
          onConfig={handleOpenConfig}
          onFileClick={handleFileOpen}
          onDeleteFile={handleDeleteFile}
          onOpenDiff={handleOpenDiff}
          onCreatePrompt={handleCreatePrompt}
          onLaunchClaude={() => selectedProject && requestLaunch('claude', false)}
          onLaunchCopilot={() => selectedProject && requestLaunch('copilot', true)}
          onLaunchVscode={handleLaunchVscode}
          onLaunchCodewhale={() => selectedProject && requestLaunch('codewhale', true)}
          onLaunchReasonix={() => selectedProject && requestLaunch('reasonix', true)}
          onLaunchOpencode={() => selectedProject && requestLaunch('opencode', true)}
          onLaunchTerminal={() => selectedProject && requestLaunch('terminal', true)}
          clients={clients}
        />

        {/* Main panel — TerminalPanel handles its own empty state:
            project info when no project, launch buttons when project selected,
            tab bar + content when tabs exist, prompt overlay on demand. */}
        <main className="flex-1 flex flex-col min-w-0 relative z-10">
          <TerminalPanel
            tabs={tabs}
            activeTabId={activeTabId}
            activeProject={selectedProject}
            launchTrigger={launchTrigger}
            scrollback={terminalScrollback}
            onOpenTab={handleOpenTab}
            onForceOpenTab={handleForceOpenTab}
            onCloseTab={closeTab}
            onSelectTab={setActiveTab}
            onSaveFile={handleSaveFile}
            onFileDirtyChange={handleFileDirtyChange}
            getFileContent={getFileContent}
            onTabActivity={markTabBusy}
            onReorderTabs={moveTab}
          />
        </main>

        {/* Config Modal */}
        <ConfigModal
          open={configOpen}
          workspacePath={workspacePath}
          plansPath={plansPath}
          skillsPath={skillsPath}
          promptsPath={promptsPath}
          clients={clients}
          terminalScrollback={terminalScrollback}
          backgroundMusic={backgroundMusic}
          isOnboarding={!onboardingComplete}
          onClose={() => setConfigOpen(false)}
          onSave={handleSaveConfig}
        />

        {/* About Modal */}
        <AboutModal
          open={aboutOpen}
          onClose={handleCloseAbout}
        />
      </div>

      <audio ref={audioRef} src="/FocusMusic.mp3" loop />    </div>
  );
}

export default App;

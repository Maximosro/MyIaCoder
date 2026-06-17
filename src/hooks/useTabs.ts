import { useState, useCallback, useRef } from 'react';
import type { Project } from '../types/project';
import type { Tab } from '../types/terminal';
import { getFileType, isFileTab, isDiffTab } from '../types/terminal';

function generateTabId(): string {
  return crypto.randomUUID();
}

interface UseTabsReturn {
  tabs: Tab[];
  activeTabId: string | null;
  /** @deprecated Use openTerminalTab instead */
  openTab: (project: Project, title: string, command?: string) => Promise<void>;
  /** @deprecated Use forceOpenTerminalTab instead */
  forceOpenTab: (project: Project, title: string, command?: string) => Promise<void>;
  openTerminalTab: (project: Project, title: string, command?: string) => Promise<void>;
  forceOpenTerminalTab: (project: Project, title: string, command?: string) => Promise<void>;
  openFileTab: (project: Project, filePath: string) => Promise<string>;
  openDiffTab: (project: Project, filePath: string) => Promise<string>;
  openTodoTab: () => void;
  closeTab: (tabId: string, onBeforeClose?: (tab: Tab) => Promise<boolean>) => Promise<void>;
  setActiveTab: (tabId: string) => void;
  saveFileTab: (tabId: string, content: string) => Promise<void>;
  markTabDirty: (tabId: string, isDirty: boolean) => void;
  getFileContent: (tabId: string) => string | undefined;
}

export function useTabs(): UseTabsReturn {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const fileContentsRef = useRef<Map<string, string>>(new Map());
  const [, setTick] = useState(0); // Force re-render for content updates

  // ── Terminal tabs ──────────────────────────────────────────

  const openTerminalTab = useCallback(async (project: Project, title: string, command?: string) => {
    const existing = tabs.find((t) => t.kind === 'terminal' && t.projectPath === project.path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const tabId = generateTabId();
    const newTab: Tab = {
      id: tabId,
      kind: 'terminal',
      projectName: project.name,
      projectPath: project.path,
      title,
      command,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    await window.electronAPI.ptySpawn(tabId, project.path, command);
  }, [tabs]);

  const forceOpenTerminalTab = useCallback(async (project: Project, title: string, command?: string) => {
    const tabId = generateTabId();
    const newTab: Tab = {
      id: tabId,
      kind: 'terminal',
      projectName: project.name,
      projectPath: project.path,
      title,
      command,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    await window.electronAPI.ptySpawn(tabId, project.path, command);
  }, []);

  // ── File tabs ──────────────────────────────────────────────

  const openFileTab = useCallback(async (project: Project, filePath: string): Promise<string> => {
    // Extract file name from path
    const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
    const fileType = getFileType(fileName);
    if (!fileType) return ''; // Unsupported extension

    // Check if already open
    const existing = tabs.find((t) => isFileTab(t) && t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return existing.id;
    }

    const tabId = generateTabId();

    // Read file content via IPC
    let content = '';
    try {
      content = await window.electronAPI.readFileContent(filePath);
    } catch {
      // File not found or path traversal — don't open
      return '';
    }

    fileContentsRef.current.set(tabId, content);

    const newTab: Tab = {
      id: tabId,
      kind: 'file',
      projectName: project.name,
      projectPath: project.path,
      title: fileName,
      filePath,
      fileType,
      isDirty: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    return tabId;
  }, [tabs]);

  // ── Diff tabs ──────────────────────────────────────────────

  const openDiffTab = useCallback(async (project: Project, filePath: string): Promise<string> => {
    const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath;

    // Check if already open
    const existing = tabs.find((t) => isDiffTab(t) && t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return existing.id;
    }

    const tabId = generateTabId();

    // Get diff content via IPC
    let diffContent = '';
    try {
      diffContent = await window.electronAPI.getGitDiff(project.path, filePath);
    } catch {
      diffContent = `# Error: Unable to load diff for ${filePath}`;
    }

    const newTab: Tab = {
      id: tabId,
      kind: 'diff',
      projectName: project.name,
      projectPath: project.path,
      title: `${fileName} (diff)`,
      filePath,
      fileType: 'text',
      diffContent,
      isDirty: false,
    };

    fileContentsRef.current.set(tabId, diffContent);

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    return tabId;
  }, [tabs]);

  const saveFileTab = useCallback(async (tabId: string, content: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !isFileTab(tab)) return;

    await window.electronAPI.writeFileContent(tab.filePath, content);
    fileContentsRef.current.set(tabId, content);

    // Mark clean
    setTabs((prev) => prev.map((t) =>
      t.id === tabId ? { ...t, isDirty: false } : t
    ));
  }, [tabs]);

  const markTabDirty = useCallback((tabId: string, isDirty: boolean) => {
    setTabs((prev) => prev.map((t) =>
      t.id === tabId ? { ...t, isDirty } : t
    ));
  }, []);

  const getFileContent = useCallback((tabId: string): string | undefined => {
    return fileContentsRef.current.get(tabId);
  }, []);

  // ── ToDo tab (unique singleton) ────────────────────────────

  const openTodoTab = useCallback(() => {
    const TODO_TAB_ID = 'todo-tab';

    const existing = tabs.find((t) => t.id === TODO_TAB_ID);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const newTab: Tab = {
      id: TODO_TAB_ID,
      kind: 'todo',
      projectName: 'Focusxide',
      projectPath: '',
      title: 'ToDos',
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(TODO_TAB_ID);
  }, [tabs]);

  // ── Shared tab operations ──────────────────────────────────

  const closeTab = useCallback(async (tabId: string, onBeforeClose?: (tab: Tab) => Promise<boolean>) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Pre-close hook (for unsaved changes check)
    if (onBeforeClose) {
      const shouldClose = await onBeforeClose(tab);
      if (!shouldClose) return;
    }

    // Terminal cleanup
    if (tab.kind === 'terminal') {
      await window.electronAPI.ptyKill(tabId);
    }

    // File/diff cleanup
    if (isFileTab(tab) || isDiffTab(tab)) {
      fileContentsRef.current.delete(tabId);
    }

    setTabs((prev) => {
      const updated = prev.filter((t) => t.id !== tabId);

      if (activeTabId === tabId) {
        setActiveTabId(updated.length > 0 ? updated[updated.length - 1].id : null);
      }

      return updated;
    });
  }, [activeTabId, tabs]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  return {
    tabs,
    activeTabId,
    openTab: openTerminalTab,
    forceOpenTab: forceOpenTerminalTab,
    openTerminalTab,
    forceOpenTerminalTab,
    openFileTab,
    openDiffTab,
    openTodoTab,
    closeTab,
    setActiveTab,
    saveFileTab,
    markTabDirty,
    getFileContent,
  };
}

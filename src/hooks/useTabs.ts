import { useState, useCallback, useRef } from 'react';
import type { Project } from '../types/project';
import type { Tab } from '../types/tab';
import { isFileTab, isDiffTab } from '../types/tab';
import type { SessionEntry } from '../types/session';
import { getFileType } from '../utils/tabUtils';
import { arrayMove } from '@dnd-kit/sortable';

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
  /** Open a terminal tab that runs the project's persisted run command. Returns the tab id. */
  openRunTab: (project: Project, command: string, useWsl: boolean) => Promise<string>;
  openFileTab: (project: Project, filePath: string, unlocked?: boolean) => Promise<string>;
  openDiffTab: (project: Project, filePath: string) => Promise<string>;
  /** Open a read-only transcript tab for a past CLI session. Returns the tab id. */
  openSessionTab: (project: Project, session: SessionEntry) => string;
  closeTab: (tabId: string, onBeforeClose?: (tab: Tab) => Promise<boolean>) => Promise<void>;
  setActiveTab: (tabId: string) => void;
  saveFileTab: (tabId: string, content: string) => Promise<void>;
  markTabDirty: (tabId: string, isDirty: boolean) => void;
  /** Mark a terminal tab as busy (receiving output). Auto-clears after 5s of inactivity. */
  markTabBusy: (tabId: string) => void;
  getFileContent: (tabId: string) => string | undefined;
  /** Reorder tabs by moving the tab at fromIndex to toIndex. No-op on invalid indices. */
  moveTab: (fromIndex: number, toIndex: number) => void;
}

export function useTabs(): UseTabsReturn {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const fileContentsRef = useRef<Map<string, string>>(new Map());
  const busyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const BUSY_TIMEOUT_MS = 5000;

  // ── Terminal tabs ──────────────────────────────────────────

  const openTerminalTab = useCallback(async (project: Project, title: string, command?: string) => {
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

    await window.electronAPI.ptySpawn(tabId, project.path, command, title);
  }, []);

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

    await window.electronAPI.ptySpawn(tabId, project.path, command, title);
  }, []);

  // ── Run tab (Play/Stop) ────────────────────────────────────

  const openRunTab = useCallback(async (project: Project, command: string, useWsl: boolean): Promise<string> => {
    const tabId = generateTabId();
    const title = `▶ ${command}`;
    const newTab: Tab = {
      id: tabId,
      kind: 'terminal',
      projectName: project.name,
      projectPath: project.path,
      title,
      command,
      isRun: true,
    };

    // "Silent background": only steal focus when there's nothing else open.
    setTabs((prev) => {
      if (prev.length === 0) setActiveTabId(tabId);
      return [...prev, newTab];
    });

    await window.electronAPI.ptySpawn(tabId, project.path, command, title, useWsl);
    return tabId;
  }, []);

  // ── File tabs ──────────────────────────────────────────────

  const openFileTab = useCallback(async (project: Project, filePath: string, unlocked = false): Promise<string> => {
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
    } catch (err) {
      // File not found or path traversal — don't open
      console.error('[useTabs] Failed to read file:', filePath, err);
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
      unlocked,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    return tabId;
  }, [tabs]);

  // ── Session transcript tabs ────────────────────────────────

  const openSessionTab = useCallback((project: Project, session: SessionEntry): string => {
    // One tab per session — re-open just focuses the existing one.
    const existing = tabs.find((t) => t.kind === 'session' && t.source === session.source && t.sessionId === session.id);
    if (existing) {
      setActiveTabId(existing.id);
      return existing.id;
    }

    const tabId = generateTabId();
    const newTab: Tab = {
      id: tabId,
      kind: 'session',
      projectName: project.name,
      projectPath: project.path,
      title: session.title,
      // Reuse command-based accent coloring/icon: source maps 1:1 to a command color.
      command: session.source,
      source: session.source,
      sessionId: session.id,
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

  const markTabBusy = useCallback((tabId: string) => {
    // Clear existing timer for this tab (resets the 5s countdown)
    const existing = busyTimersRef.current.get(tabId);
    if (existing) clearTimeout(existing);

    // Set busy = true
    setTabs((prev) => prev.map((t) =>
      t.id === tabId ? { ...t, busy: true } : t
    ));

    // Schedule auto-clear after BUSY_TIMEOUT_MS of inactivity
    const timer = setTimeout(() => {
      busyTimersRef.current.delete(tabId);
      setTabs((prev) => prev.map((t) =>
        t.id === tabId ? { ...t, busy: false } : t
      ));
    }, BUSY_TIMEOUT_MS);

    busyTimersRef.current.set(tabId, timer);
  }, []);

  const getFileContent = useCallback((tabId: string): string | undefined => {
    return fileContentsRef.current.get(tabId);
  }, []);

  // ── Reorder ────────────────────────────────────────────────

  const moveTab = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      return arrayMove(prev, fromIndex, toIndex);
    });
  }, []);

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
      // Clear busy timer if present
      const busyTimer = busyTimersRef.current.get(tabId);
      if (busyTimer) {
        clearTimeout(busyTimer);
        busyTimersRef.current.delete(tabId);
      }
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
    openRunTab,
    openFileTab,
    openDiffTab,
    openSessionTab,
    closeTab,
    setActiveTab,
    saveFileTab,
    markTabDirty,
    markTabBusy,
    getFileContent,
    moveTab,
  };
}

import { useState, useCallback } from 'react';
import type { Project } from '../types/project';
import type { TerminalTab } from '../types/terminal';

function generateTabId(): string {
  return crypto.randomUUID();
}

interface UseTerminalReturn {
  tabs: TerminalTab[];
  activeTabId: string | null;
  openTab: (project: Project) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

export function useTerminal(): UseTerminalReturn {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // PTY uses polling via ptyRead — no event listeners needed

  const openTab = useCallback(async (project: Project) => {
    // If a tab for this project path already exists, just activate it
    const existing = tabs.find((t) => t.projectPath === project.path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const tabId = generateTabId();
    const newTab: TerminalTab = {
      id: tabId,
      projectName: project.name,
      projectPath: project.path,
    };

    // Add tab to state first (so the TerminalTabComponent can mount)
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    // Spawn PTY in main process
    console.log(`[useTerminal] Calling ptySpawn: tabId=${tabId} path=${project.path}`);
    await window.electronAPI.ptySpawn(tabId, project.path);
    console.log(`[useTerminal] ptySpawn returned for tabId=${tabId}`);
  }, [tabs]);

  const closeTab = useCallback(async (tabId: string) => {
    await window.electronAPI.ptyKill(tabId);

    setTabs((prev) => {
      const updated = prev.filter((t) => t.id !== tabId);

      // If closing the active tab, switch to the last remaining tab
      if (activeTabId === tabId) {
        setActiveTabId(updated.length > 0 ? updated[updated.length - 1].id : null);
      }

      return updated;
    });
  }, [activeTabId]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  return { tabs, activeTabId, openTab, closeTab, setActiveTab };
}

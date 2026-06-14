import { useState, useCallback } from 'react';
import type { Project } from '../types/project';
import type { TerminalTab } from '../types/terminal';

function generateTabId(): string {
  return crypto.randomUUID();
}

interface UseTerminalReturn {
  tabs: TerminalTab[];
  activeTabId: string | null;
  openTab: (project: Project, title: string) => void;
  forceOpenTab: (project: Project, title: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

export function useTerminal(): UseTerminalReturn {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = useCallback(async (project: Project, title: string) => {
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
      title,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    await window.electronAPI.ptySpawn(tabId, project.path);
  }, [tabs]);

  const closeTab = useCallback(async (tabId: string) => {
    await window.electronAPI.ptyKill(tabId);

    setTabs((prev) => {
      const updated = prev.filter((t) => t.id !== tabId);

      if (activeTabId === tabId) {
        setActiveTabId(updated.length > 0 ? updated[updated.length - 1].id : null);
      }

      return updated;
    });
  }, [activeTabId]);

  const forceOpenTab = useCallback(async (project: Project, title: string) => {
    const tabId = generateTabId();
    const newTab: TerminalTab = {
      id: tabId,
      projectName: project.name,
      projectPath: project.path,
      title,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);

    await window.electronAPI.ptySpawn(tabId, project.path);
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  return { tabs, activeTabId, openTab, forceOpenTab, closeTab, setActiveTab };
}

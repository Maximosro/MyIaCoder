// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabs } from '../useTabs';

// Mock window.electronAPI
beforeAll(() => {
  (window as any).electronAPI = {
    ptySpawn: vi.fn(),
    ptyRead: vi.fn().mockResolvedValue(''),
    ptyKill: vi.fn(),
    readFileContent: vi.fn().mockResolvedValue(''),
    getGitDiff: vi.fn().mockResolvedValue(''),
    writeFileContent: vi.fn(),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTabs — markTabBusy', () => {
  it('sets busy: true on the target tab', async () => {
    const { result } = renderHook(() => useTabs());

    // Open a terminal tab first
    await act(async () => {
      await result.current.openTerminalTab(
        { name: 'test', path: '/test', branch: 'main' },
        'claude',
        'claude',
      );
    });

    const tabId = result.current.tabs[0].id;
    expect(result.current.tabs[0].busy).toBeUndefined();

    act(() => {
      result.current.markTabBusy(tabId);
    });

    expect(result.current.tabs[0].busy).toBe(true);
  });

  it('auto-clears busy after 5 seconds', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openTerminalTab(
        { name: 'test', path: '/test', branch: 'main' },
        'claude',
        'claude',
      );
    });

    const tabId = result.current.tabs[0].id;

    act(() => {
      result.current.markTabBusy(tabId);
    });
    expect(result.current.tabs[0].busy).toBe(true);

    // Advance timers by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.tabs[0].busy).toBe(false);
  });

  it('resets timer on repeated calls', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openTerminalTab(
        { name: 'test', path: '/test', branch: 'main' },
        'claude',
        'claude',
      );
    });

    const tabId = result.current.tabs[0].id;

    act(() => {
      result.current.markTabBusy(tabId);
    });
    expect(result.current.tabs[0].busy).toBe(true);

    // Advance 4 seconds — still busy
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.tabs[0].busy).toBe(true);

    // Call markTabBusy again (resets timer)
    act(() => {
      result.current.markTabBusy(tabId);
    });
    expect(result.current.tabs[0].busy).toBe(true);

    // Advance another 4 seconds — should still be busy (only 4s since last call)
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.tabs[0].busy).toBe(true);

    // Advance the final second — now 5s have passed since last markTabBusy
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.tabs[0].busy).toBe(false);
  });

  it('is no-op on non-existent tabId', async () => {
    const { result } = renderHook(() => useTabs());

    // No tabs open yet
    expect(result.current.tabs).toHaveLength(0);

    act(() => {
      result.current.markTabBusy('nonexistent');
    });

    // No crash, no tabs created
    expect(result.current.tabs).toHaveLength(0);
  });

  it('closing a tab cleans up its busy timer', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openTerminalTab(
        { name: 'test', path: '/test', branch: 'main' },
        'claude',
        'claude',
      );
    });

    const tabId = result.current.tabs[0].id;

    act(() => {
      result.current.markTabBusy(tabId);
    });
    expect(result.current.tabs[0].busy).toBe(true);

    // Close the tab
    await act(async () => {
      await result.current.closeTab(tabId);
    });

    // The tab is gone
    expect(result.current.tabs).toHaveLength(0);

    // Advance 5 seconds — no crash from orphaned timer
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // No error thrown
    expect(result.current.tabs).toHaveLength(0);
  });
});

describe('useTabs — moveTab', () => {
  const project = { name: 'test', path: '/test', branch: 'main' };

  it('reorders tab from index 0 to index 2', async () => {
    const { result } = renderHook(() => useTabs());

    // Open 4 tabs: A, B, C, D
    await act(async () => { await result.current.openTerminalTab(project, 'A', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'B', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'C', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'D', 'claude'); });

    act(() => { result.current.moveTab(0, 2); });

    expect(result.current.tabs.map((t) => t.title)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('reorders tab from index 2 to index 0', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => { await result.current.openTerminalTab(project, 'A', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'B', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'C', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'D', 'claude'); });

    act(() => { result.current.moveTab(2, 0); });

    expect(result.current.tabs.map((t) => t.title)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('same index is a no-op', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => { await result.current.openTerminalTab(project, 'A', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'B', 'claude'); });

    const titlesBefore = result.current.tabs.map((t) => t.title);

    act(() => { result.current.moveTab(0, 0); });

    expect(result.current.tabs.map((t) => t.title)).toEqual(titlesBefore);
  });

  it('negative fromIndex is a no-op', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => { await result.current.openTerminalTab(project, 'A', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'B', 'claude'); });

    const titlesBefore = result.current.tabs.map((t) => t.title);

    act(() => { result.current.moveTab(-1, 1); });

    expect(result.current.tabs.map((t) => t.title)).toEqual(titlesBefore);
  });

  it('negative toIndex is a no-op', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => { await result.current.openTerminalTab(project, 'A', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'B', 'claude'); });

    const titlesBefore = result.current.tabs.map((t) => t.title);

    act(() => { result.current.moveTab(0, -1); });

    expect(result.current.tabs.map((t) => t.title)).toEqual(titlesBefore);
  });

  it('out-of-bounds toIndex is a no-op', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => { await result.current.openTerminalTab(project, 'A', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'B', 'claude'); });

    const titlesBefore = result.current.tabs.map((t) => t.title);

    act(() => { result.current.moveTab(0, 5); });

    expect(result.current.tabs.map((t) => t.title)).toEqual(titlesBefore);
  });

  it('preserves activeTabId after reorder', async () => {
    const { result } = renderHook(() => useTabs());

    await act(async () => { await result.current.openTerminalTab(project, 'A', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'B', 'claude'); });
    await act(async () => { await result.current.openTerminalTab(project, 'C', 'claude'); });

    const tabCId = result.current.tabs[2].id;

    // Set C as active
    act(() => { result.current.setActiveTab(tabCId); });
    expect(result.current.activeTabId).toBe(tabCId);

    // Move C (index 2) to front (index 0)
    act(() => { result.current.moveTab(2, 0); });

    expect(result.current.activeTabId).toBe(tabCId);
    expect(result.current.tabs[0].title).toBe('C');
  });
});

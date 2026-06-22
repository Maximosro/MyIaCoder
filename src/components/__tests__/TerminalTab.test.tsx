// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Terminal } from '@xterm/xterm';
import { TerminalTab } from '../TerminalTab';
import type { Tab } from '../../types/tab';

// ── Mock xterm.js ─────────────────────────────────────────
const mockTerminal = {
  open: vi.fn(),
  dispose: vi.fn(),
  write: vi.fn(),
  focus: vi.fn(),
  onData: vi.fn(),
  loadAddon: vi.fn(),
  attachCustomKeyEventHandler: vi.fn(),
  get cols() { return 80; },
  get rows() { return 24; },
  hasSelection: vi.fn().mockReturnValue(false),
  unicode: { activeVersion: '' },
};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => mockTerminal),
}));

// Mock addons returning objects with needed methods
vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn(() => ({ fit: vi.fn(), dispose: vi.fn(), activate: vi.fn() })) }));
vi.mock('@xterm/addon-webgl', () => ({ WebglAddon: vi.fn(() => ({ dispose: vi.fn(), activate: vi.fn() })) }));
vi.mock('@xterm/addon-search', () => ({ SearchAddon: vi.fn(() => ({ findNext: vi.fn(), findPrevious: vi.fn(), activate: vi.fn() })) }));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: vi.fn(() => ({ activate: vi.fn() })) }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: vi.fn(() => ({ activate: vi.fn() })) }));
vi.mock('@xterm/addon-serialize', () => ({ SerializeAddon: vi.fn(() => ({ activate: vi.fn() })) }));
vi.mock('@xterm/addon-ligatures', () => ({ LigaturesAddon: vi.fn(() => ({ activate: vi.fn() })) }));

// ── Mock electronAPI ──────────────────────────────────────
let ptyDataCallback: ((tabId: string, data: string) => void) | null = null;

const mockElectronAPI = {
  ptyInput: vi.fn(),
  ptyResize: vi.fn(),
  onPtyData: vi.fn((cb: (tabId: string, data: string) => void) => {
    ptyDataCallback = cb;
    return vi.fn();
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  ptyDataCallback = null;
  mockTerminal.write.mockClear();
  mockTerminal.loadAddon.mockClear();
  mockTerminal.focus.mockClear();
  (window as any).electronAPI = mockElectronAPI;
  (window as any).ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  }));
});

// ── Helpers ───────────────────────────────────────────────
const tab: Tab = {
  id: 'tab-1',
  kind: 'terminal',
  projectName: 'test',
  projectPath: '/test',
  title: 'Test Terminal',
};

// ── Tests ─────────────────────────────────────────────────

describe('TerminalTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<TerminalTab tab={tab} isActive />);
    expect(container.querySelector('.absolute')).toBeTruthy();
  });

  it('creates a Terminal with xterm.js v6', () => {
    render(<TerminalTab tab={tab} isActive />);
    expect(Terminal).toHaveBeenCalled();
  });

  it('loads all 7 addons', () => {
    render(<TerminalTab tab={tab} isActive />);
    expect(mockTerminal.loadAddon).toHaveBeenCalledTimes(7);
  });

  it('registers onPtyData listener', () => {
    render(<TerminalTab tab={tab} isActive />);
    expect(mockElectronAPI.onPtyData).toHaveBeenCalled();
  });

  it('writes push data to terminal when tabId matches', () => {
    render(<TerminalTab tab={tab} isActive />);
    expect(ptyDataCallback).not.toBeNull();
    act(() => { ptyDataCallback!('tab-1', 'hello'); });
    expect(mockTerminal.write).toHaveBeenCalledWith('hello');
  });

  it('ignores push data from other tabs', () => {
    render(<TerminalTab tab={tab} isActive />);
    act(() => { ptyDataCallback!('tab-2', 'foreign'); });
    expect(mockTerminal.write).not.toHaveBeenCalled();
  });

  it('fires onActivity when receiving push data', () => {
    const onActivity = vi.fn();
    render(<TerminalTab tab={tab} isActive onActivity={onActivity} />);
    act(() => { ptyDataCallback!('tab-1', 'data'); });
    expect(onActivity).toHaveBeenCalledWith('tab-1');
  });
});

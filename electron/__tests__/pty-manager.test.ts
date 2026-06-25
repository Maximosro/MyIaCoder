import { describe, it, expect, vi } from 'vitest';

// pty-manager → services/settings.ts imports `electron`, and pty-manager imports
// `node-pty` (native). Stub both so the module loads in a plain test env.
vi.mock('electron', () => ({ app: { getPath: () => '' } }));
const { spawnSpy, loadSettingsMock } = vi.hoisted(() => ({
  spawnSpy: vi.fn(() => ({ onData: vi.fn(), onExit: vi.fn(), write: vi.fn(), kill: vi.fn() })),
  loadSettingsMock: vi.fn(),
}));
vi.mock('node-pty', () => ({ spawn: spawnSpy }));
vi.mock('../services/settings', () => ({ loadSettings: loadSettingsMock }));
vi.mock('../services/tasks', () => ({
  registerClaudeSession: vi.fn(), unregisterClaudeSession: vi.fn(),
  registerCopilotSession: vi.fn(), unregisterCopilotSession: vi.fn(),
  registerReasonixSession: vi.fn(), unregisterReasonixSession: vi.fn(),
}));

import { buildLaunchCommand, PTYManager } from '../pty-manager';

describe('buildLaunchCommand reasonix --dir', () => {
  it('uses the Windows path when not running in WSL', () => {
    expect(buildLaunchCommand('reasonix', 'id1', 'C:\\proj\\app', undefined, false))
      .toBe('reasonix chat --dir="C:\\proj\\app"');
  });

  it('translates the path to /mnt when running in WSL', () => {
    expect(buildLaunchCommand('reasonix', 'id1', 'C:\\proj\\app', undefined, true))
      .toBe('reasonix chat --dir="/mnt/c/proj/app"');
  });
});

describe('PTYManager.spawn gating on useWsl2Git', () => {
  it.each(['copilot', 'claude', 'reasonix', 'terminal'])(
    'launches %s in cmd.exe when the WSL flag is off', (cmd) => {
      spawnSpy.mockClear();
      loadSettingsMock.mockReturnValue({ useWsl2Git: false, wslDistro: 'Ubuntu' });
      new PTYManager().spawn('t1', 'C:\\proj\\app', cmd);
      expect(spawnSpy).toHaveBeenCalledWith('cmd.exe', [], expect.anything());
    },
  );

  it.each(['copilot', 'claude', 'reasonix', 'terminal'])(
    'launches %s in wsl.exe when the WSL flag is on', (cmd) => {
      spawnSpy.mockClear();
      loadSettingsMock.mockReturnValue({ useWsl2Git: true, wslDistro: 'Ubuntu' });
      new PTYManager().spawn('t1', 'C:\\proj\\app', cmd);
      expect(spawnSpy).toHaveBeenCalledWith('wsl.exe', ['-d', 'Ubuntu'], expect.anything());
    },
  );

  it('useWslOverride=true forces wsl.exe even when the global flag is off', () => {
    spawnSpy.mockClear();
    loadSettingsMock.mockReturnValue({ useWsl2Git: false, wslDistro: 'Ubuntu' });
    new PTYManager().spawn('t1', 'C:\\proj\\app', 'npm run dev', undefined, true);
    expect(spawnSpy).toHaveBeenCalledWith('wsl.exe', ['-d', 'Ubuntu'], expect.anything());
  });

  it('useWslOverride=false forces cmd.exe even when the global flag is on', () => {
    spawnSpy.mockClear();
    loadSettingsMock.mockReturnValue({ useWsl2Git: true, wslDistro: 'Ubuntu' });
    new PTYManager().spawn('t1', 'C:\\proj\\app', 'npm run dev', undefined, false);
    expect(spawnSpy).toHaveBeenCalledWith('cmd.exe', [], expect.anything());
  });
});


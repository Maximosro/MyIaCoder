import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ClientsConfig {
  claude: boolean;
  copilot: boolean;
  codewhale: boolean;
  reasonix: boolean;
  opencode: boolean;
}

export interface Settings {
  workspacePath: string;
  plansPath: string;
  skillsPath: string;
  promptsPath: string;
  theme: 'system' | 'light' | 'dark';
  clients: ClientsConfig;
}

const HOME = os.homedir();

const DEFAULTS: Settings = {
  workspacePath: 'C:\\Workspace',
  plansPath: path.join(HOME, '.claude', 'plans'),
  skillsPath: path.join(HOME, '.claude', 'skills'),
  promptsPath: path.join(HOME, '.claude', 'prompts'),
  theme: 'system',
  clients: {
    claude: true,
    copilot: true,
    codewhale: true,
    reasonix: true,
    opencode: true,
  },
};

function getSettingsPath(): string {
  const dir = path.join(app.getPath('appData'), 'ai-code-manager');
  return path.join(dir, 'settings.json');
}

export function loadSettings(): Settings {
  const filePath = getSettingsPath();
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<Settings>;
      // Deep-merge `clients` so a partial saved config keeps defaults for new clients.
      return {
        ...DEFAULTS,
        ...parsed,
        clients: { ...DEFAULTS.clients, ...parsed.clients },
      };
    }
  } catch {
    // Corrupted file — reset to defaults
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: Settings): void {
  const filePath = getSettingsPath();
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

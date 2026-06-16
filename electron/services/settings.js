import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const DEFAULTS = {
    workspacePath: 'C:\\Workspace',
    plansPath: 'C:\\Users\\Rothar\\.claude\\plans',
    theme: 'system',
};
function getSettingsPath() {
    const dir = path.join(app.getPath('appData'), 'ai-code-manager');
    return path.join(dir, 'settings.json');
}
export function loadSettings() {
    const filePath = getSettingsPath();
    try {
        if (existsSync(filePath)) {
            const raw = readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            return { ...DEFAULTS, ...parsed };
        }
    }
    catch {
        // Corrupted file — reset to defaults
    }
    return { ...DEFAULTS };
}
export function saveSettings(settings) {
    const filePath = getSettingsPath();
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

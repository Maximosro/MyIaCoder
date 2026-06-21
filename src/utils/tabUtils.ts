import type { FileType } from '../types/tab';

export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set(['.txt', '.json', '.md', '.yaml', '.yml', '.toml']);

export function getFileType(fileName: string): FileType | null {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const ext = fileName.slice(dotIndex).toLowerCase();
  switch (ext) {
    case '.txt':
      return 'text';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.toml':
      return 'toml';
    default:
      return null;
  }
}

/** Returns Tailwind text class for the tab accent color. */
export function getTabColorClass(fileType: FileType): string {
  switch (fileType) {
    case 'text':
      return 'text-[#6ba86b]';
    case 'json':
      return 'text-[#7b9ec4]';
    case 'markdown':
      return 'text-[#e05555]';
    case 'yaml':
      return 'text-[#d4a44a]';
    case 'toml':
      return 'text-[#4ab8b8]';
  }
}

// ponytail: single source of truth for command colors
/** Returns the hex accent color for a terminal command. */
export function getCommandColor(command?: string): string {
  switch (command) {
    case 'copilot':
      return '#6ba86b';
    case 'reasonix':
      return '#a98bd4';
    case 'codewhale':
      return '#c4a36b';
    case 'opencode':
      return '#6bc4b0';
    case 'terminal':
      return '#b0a89a';
    default:
      return '#d4784a'; // claude + unknown fallback
  }
}

/** Returns a Tailwind text class for a terminal command's accent color. */
export function getCommandColorClass(command?: string): string {
  return `text-[${getCommandColor(command)}]`;
}

/** Returns a hex color string for the file type (used for icons, indicators). */
export function getTabColorHex(fileType: FileType): string {
  switch (fileType) {
    case 'text':
      return '#6ba86b';
    case 'json':
      return '#7b9ec4';
    case 'markdown':
      return '#e05555';
    case 'yaml':
      return '#d4a44a';
    case 'toml':
      return '#4ab8b8';
  }
}

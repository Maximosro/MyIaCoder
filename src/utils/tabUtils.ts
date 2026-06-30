import type { FileType } from '../types/tab';

export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set(['.txt', '.json', '.md', '.yaml', '.yml', '.toml', '.xml', '.properties']);

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
    case '.xml':
      return 'xml';
    case '.properties':
      return 'properties';
    default:
      return null;
  }
}

const FILE_TYPE_COLORS: Record<FileType, string> = {
  text: '#6ba86b',
  json: '#7b9ec4',
  markdown: '#e05555',
  yaml: '#d4a44a',
  toml: '#4ab8b8',
  xml: '#c47ba0',
  properties: '#a89060',
};

/** Returns a hex color string for the file type (used for icons, indicators). */
export function getTabColorHex(fileType: FileType): string {
  return FILE_TYPE_COLORS[fileType];
}

/** Returns Tailwind text class for the tab accent color. */
export function getTabColorClass(fileType: FileType): string {
  return `text-[${FILE_TYPE_COLORS[fileType]}]`;
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

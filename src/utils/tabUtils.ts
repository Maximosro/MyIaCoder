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

/** Returns Tailwind border + text classes for the tab accent color. */
export function getTabColorClass(fileType: FileType): string {
  switch (fileType) {
    case 'text':
      return 'border-[#6ba86b] text-[#6ba86b]';
    case 'json':
      return 'border-[#7b9ec4] text-[#7b9ec4]';
    case 'markdown':
      return 'border-[#9b7bc4] text-[#9b7bc4]';
    case 'yaml':
      return 'border-[#d4a44a] text-[#d4a44a]';
    case 'toml':
      return 'border-[#4ab8b8] text-[#4ab8b8]';
  }
}

/** Returns a hex color string for the file type (used for icons, indicators). */
export function getTabColorHex(fileType: FileType): string {
  switch (fileType) {
    case 'text':
      return '#6ba86b';
    case 'json':
      return '#7b9ec4';
    case 'markdown':
      return '#d4784a';
    case 'yaml':
      return '#d4a44a';
    case 'toml':
      return '#4ab8b8';
  }
}

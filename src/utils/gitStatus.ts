import { Edit3, Plus, Trash2, FileQuestion } from 'lucide-react';

export interface GitStatusMeta {
  icon: typeof Edit3;
  color: string;
  label: string;
}

/** Maps git status codes to display metadata (icon, color, label). Shared by GitChangesTree. */
export const GIT_STATUS_META: Record<string, GitStatusMeta> = {
  M: { icon: Edit3, color: '#d4a44a', label: 'Modified' },
  A: { icon: Plus, color: '#6ba86b', label: 'Added' },
  D: { icon: Trash2, color: '#e05555', label: 'Deleted' },
  R: { icon: Edit3, color: '#7b9ec4', label: 'Renamed' },
  '??': { icon: FileQuestion, color: '#8b5a3c', label: 'Untracked' },
  MM: { icon: Edit3, color: '#d4a44a', label: 'Modified' },
  AM: { icon: Plus, color: '#6ba86b', label: 'Added' },
  RM: { icon: Edit3, color: '#7b9ec4', label: 'Renamed' },
};

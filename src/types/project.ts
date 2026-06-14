export interface Project {
  name: string;
  path: string;
  branch: string;
}

export interface Settings {
  workspacePath: string;
  theme: 'system' | 'light' | 'dark';
}

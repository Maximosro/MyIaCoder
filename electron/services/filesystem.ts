import { readdirSync, existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export interface Project {
  name: string;
  path: string;
  branch: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

/**
 * Fast scan of the workspace directory for git projects (folders containing .git).
 * Does NOT resolve git branches (that runs in the background) so the UI can render
 * immediately. Branch starts empty and is filled in later via 'project-branch-loaded'.
 * Returns empty array if workspacePath does not exist.
 */
export function listWorkspaceProjects(workspacePath: string): Project[] {
  try {
    const entries = readdirSync(workspacePath, { withFileTypes: true });
    return entries
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: path.join(workspacePath, d.name), branch: '' }))
      .filter((p) => existsSync(path.join(p.path, '.git')));
  } catch {
    // Workspace path doesn't exist or is inaccessible
    return [];
  }
}

/**
 * Reads a directory tree recursively.
 * Returns directories first, then files, both sorted alphabetically (case-insensitive).
 * Directory names in `exclude` are skipped entirely (e.g. node_modules, .git).
 * Returns empty array if rootPath does not exist or is inaccessible.
 */
export function readDirectoryTree(rootPath: string, exclude?: Set<string>): TreeNode[] {
  try {
    if (!existsSync(rootPath)) return [];

    const entries = readdirSync(rootPath, { withFileTypes: true });
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        if (exclude?.has(entry.name)) continue;
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          children: readDirectoryTree(fullPath, exclude),
        });
      } else {
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
        });
      }
    }

    // Sort: directories first, then files; both groups alphabetically
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  } catch {
    return [];
  }
}

/**
 * Heavy / generated directories never worth showing in the project file tree.
 * Keeps the recursive scan fast and the tree readable.
 */
const PROJECT_TREE_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', 'dist-electron', 'build', 'out', 'target',
  'release', 'coverage', '.next', '.nuxt', '.turbo', '.cache', '.gradle',
]);

/**
 * Reads the full file tree of a project, skipping heavy/generated folders.
 */
export function readProjectFileTree(projectPath: string): TreeNode[] {
  return readDirectoryTree(projectPath, PROJECT_TREE_EXCLUDE);
}

/**
 * Reads the full UTF-8 content of a file.
 * Throws if the file does not exist or is inaccessible.
 */
export function readFileContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

/**
 * Deletes a file or directory (recursively).
 * Throws if the path does not exist.
 */
export function deleteEntry(entryPath: string): void {
  if (!existsSync(entryPath)) {
    throw new Error(`Path not found: ${entryPath}`);
  }
  rmSync(entryPath, { recursive: true, force: true });
}

/**
 * Writes UTF-8 content to a file, overwriting it.
 * Throws if the path is not writable.
 */
export function writeFileContent(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Creates a new file with the given content, creating parent directories as
 * needed. Throws FILE_EXISTS if a file already exists at that path.
 */
export function createFile(filePath: string, content = ''): void {
  if (existsSync(filePath)) {
    throw new Error('FILE_EXISTS');
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Resolves the per-project To-Do file at `<todosRoot>/<projectName>/todos.md`,
 * external to the project repo. Creates the folder and seeds a template on first
 * use; existing files are left untouched. Returns the absolute file path.
 * // ponytail: name-based mapping; hash the project path if names ever collide.
 */
export function ensureProjectTodos(todosRoot: string, projectName: string): string {
  const dir = path.join(todosRoot, projectName);
  const filePath = path.join(dir, `${projectName}.md`);
  if (!existsSync(filePath)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, todosTemplate(projectName), 'utf-8');
  }
  return filePath;
}

function todosTemplate(projectName: string): string {
  return `# To-Dos — ${projectName}\n\n## Pendiente\n\n- \n\n## Futuro\n\n- \n`;
}

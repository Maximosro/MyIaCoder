import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getGitBranch } from './git';
/**
 * Scans the workspace directory for git projects (folders containing .git).
 * Returns an array of projects with their current git branch.
 * Returns empty array if workspacePath does not exist.
 */
export async function scanWorkspace(workspacePath) {
    try {
        const entries = readdirSync(workspacePath, { withFileTypes: true });
        const directories = entries.filter((d) => d.isDirectory());
        const projects = await Promise.all(directories.map(async (dirent) => {
            const fullPath = path.join(workspacePath, dirent.name);
            const hasGit = existsSync(path.join(fullPath, '.git'));
            if (!hasGit)
                return null;
            const branch = getGitBranch(fullPath);
            return {
                name: dirent.name,
                path: fullPath,
                branch,
            };
        }));
        return projects.filter((p) => p !== null);
    }
    catch {
        // Workspace path doesn't exist or is inaccessible
        return [];
    }
}
/**
 * Reads a directory tree recursively.
 * Returns directories first, then files, both sorted alphabetically (case-insensitive).
 * Returns empty array if rootPath does not exist or is inaccessible.
 */
export function readDirectoryTree(rootPath) {
    try {
        if (!existsSync(rootPath))
            return [];
        const entries = readdirSync(rootPath, { withFileTypes: true });
        const nodes = [];
        for (const entry of entries) {
            const fullPath = path.join(rootPath, entry.name);
            if (entry.isDirectory()) {
                nodes.push({
                    name: entry.name,
                    path: fullPath,
                    type: 'directory',
                    children: readDirectoryTree(fullPath),
                });
            }
            else {
                nodes.push({
                    name: entry.name,
                    path: fullPath,
                    type: 'file',
                });
            }
        }
        // Sort: directories first, then files; both groups alphabetically
        return nodes.sort((a, b) => {
            if (a.type !== b.type)
                return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    }
    catch {
        return [];
    }
}
/**
 * Reads only .claude and .github directories from a project path.
 * Returns tree nodes for whichever of the two folders exist.
 */
export function readClaudeGithubTree(projectPath) {
    const folders = ['.claude', '.github'];
    const nodes = [];
    for (const folder of folders) {
        const folderPath = path.join(projectPath, folder);
        if (existsSync(folderPath)) {
            nodes.push({
                name: folder,
                path: folderPath,
                type: 'directory',
                children: readDirectoryTree(folderPath),
            });
        }
    }
    return nodes;
}
/**
 * Reads the full UTF-8 content of a file.
 * Throws if the file does not exist or is inaccessible.
 */
export function readFileContent(filePath) {
    return readFileSync(filePath, 'utf-8');
}
/**
 * Writes UTF-8 content to a file, overwriting it.
 * Throws if the path is not writable.
 */
export function writeFileContent(filePath, content) {
    writeFileSync(filePath, content, 'utf-8');
}

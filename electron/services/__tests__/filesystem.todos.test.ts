import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureProjectTodos } from '../filesystem';

describe('ensureProjectTodos', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'todos-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('seeds <root>/<project>/<project>.md with a template on first use', () => {
    const file = ensureProjectTodos(root, 'my-proj');
    expect(file).toBe(path.join(root, 'my-proj', 'my-proj.md'));
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf-8')).toContain('# To-Dos — my-proj');
  });

  it('is idempotent: keeps existing content on subsequent calls', () => {
    const file = ensureProjectTodos(root, 'my-proj');
    writeFileSync(file, 'edited', 'utf-8');
    expect(ensureProjectTodos(root, 'my-proj')).toBe(file);
    expect(readFileSync(file, 'utf-8')).toBe('edited');
  });
});

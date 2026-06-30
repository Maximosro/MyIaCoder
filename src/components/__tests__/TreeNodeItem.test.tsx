// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TreeNodeItem } from '../sidebar/TreeNodeItem';
import type { TreeNode } from '../../types/project';

const fileNode: TreeNode = {
  name: 'file.ts',
  path: 'C:\\repo\\src\\file.ts',
  type: 'file',
};

function ControlledTree({ node }: { node: TreeNode }) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return <TreeNodeItem node={node} depth={0} expandedPaths={expandedPaths} onTogglePath={togglePath} />;
}

describe('TreeNodeItem', () => {
  it('keeps a folder expanded after refreshed tree data rerenders', () => {
    const tree: TreeNode = {
      name: 'src',
      path: 'C:\\repo\\src',
      type: 'directory',
      children: [fileNode],
    };
    const { rerender } = render(<ControlledTree node={tree} />);

    fireEvent.click(screen.getByRole('button', { name: /src/i }));
    expect(screen.getByRole('button', { name: /src/i }).getAttribute('aria-expanded')).toBe('true');

    rerender(<ControlledTree node={{ ...tree, children: [{ ...fileNode }] }} />);

    expect(screen.getByRole('button', { name: /src/i }).getAttribute('aria-expanded')).toBe('true');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UnsavedDialog } from '../UnsavedDialog';

afterEach(() => {
  cleanup();
});

describe('UnsavedDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <UnsavedDialog
        open={false}
        fileName="test.md"
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(
      <UnsavedDialog
        open={true}
        fileName="test.md"
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Unsaved Changes')).toBeDefined();
    expect(screen.getByText('test.md')).toBeDefined();
  });

  it('calls onSave when Save button clicked', () => {
    const onSave = vi.fn();
    render(
      <UnsavedDialog
        open={true}
        fileName="test.md"
        onSave={onSave}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onDiscard when Discard button clicked', () => {
    const onDiscard = vi.fn();
    render(
      <UnsavedDialog
        open={true}
        fileName="test.md"
        onSave={vi.fn()}
        onDiscard={onDiscard}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Discard'));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <UnsavedDialog
        open={true}
        fileName="test.md"
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CloseTerminalDialog } from '../terminal/CloseTerminalDialog';

afterEach(() => {
  cleanup();
});

describe('CloseTerminalDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CloseTerminalDialog
        open={false}
        tabTitle="test"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(
      <CloseTerminalDialog
        open={true}
        tabTitle="My Terminal"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getAllByText('Close Terminal').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('My Terminal')).toBeDefined();
  });

  it('calls onConfirm when Close Terminal button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <CloseTerminalDialog
        open={true}
        tabTitle="test"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    const closeButton = screen.getByRole('button', { name: 'Close Terminal' });
    fireEvent.click(closeButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <CloseTerminalDialog
        open={true}
        tabTitle="test"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when backdrop clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <CloseTerminalDialog
        open={true}
        tabTitle="test"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    // Click the backdrop (the outer fixed overlay)
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel when dialog card clicked', () => {
    const onCancel = vi.fn();
    render(
      <CloseTerminalDialog
        open={true}
        tabTitle="test"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    // Click the message text inside the card
    fireEvent.click(screen.getByText(/This terminal tab will be closed/));
    expect(onCancel).not.toHaveBeenCalled();
  });
});

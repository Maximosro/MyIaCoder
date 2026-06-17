// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { RpiPanelTabs } from '../RpiPanelTabs';

afterEach(() => {
  cleanup();
});

const emptyProps = {
  plansTree: [],
  plansLoading: false,
  plansError: null,
  onRefreshPlans: vi.fn(),
  skillsTree: [],
  skillsLoading: false,
  skillsError: null,
  onRefreshSkills: vi.fn(),
  onOpenTodos: vi.fn(),
};

/** Helper: get tab bar buttons by their text content */
function getTabButtons() {
  const tabBar = document.querySelector('.flex.items-center.gap-0.px-2.py-1');
  if (!tabBar) return { plans: null, skills: null };
  return {
    plans: tabBar.querySelector('button:first-child') as HTMLButtonElement | null,
    skills: tabBar.querySelector('button:nth-child(2)') as HTMLButtonElement | null,
  };
}

describe('RpiPanelTabs', () => {
  it('renders both tab buttons', () => {
    render(<RpiPanelTabs {...emptyProps} />);
    const { plans, skills } = getTabButtons();
    expect(plans).not.toBeNull();
    expect(skills).not.toBeNull();
    expect(plans!.textContent).toContain('/Plans');
    expect(skills!.textContent).toContain('/Skills');
  });

  it('defaults to plans tab showing empty state', () => {
    render(<RpiPanelTabs {...emptyProps} />);
    expect(screen.getByText('RPI_PATH_NOT_FOUND')).toBeDefined();
  });

  it('switches to skills tab on click', () => {
    render(<RpiPanelTabs {...emptyProps} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    expect(skills!.className).toContain('text-[#d4784a]');
  });

  it('switches back to plans tab', () => {
    render(<RpiPanelTabs {...emptyProps} />);
    const { plans, skills } = getTabButtons();
    fireEvent.click(skills!);
    fireEvent.click(plans!);
    expect(plans!.className).toContain('text-[#d4784a]');
  });

  it('shows loading spinner for plans when loading', () => {
    render(<RpiPanelTabs {...emptyProps} plansLoading={true} />);
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('shows loading spinner for skills when loading and skills tab active', () => {
    render(<RpiPanelTabs {...emptyProps} skillsLoading={true} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('shows error message for plans', () => {
    render(<RpiPanelTabs {...emptyProps} plansError="Test plans error" />);
    expect(screen.getByText('Test plans error')).toBeDefined();
  });

  it('shows error message for skills when skills tab active', () => {
    render(<RpiPanelTabs {...emptyProps} skillsError="Test skills error" />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    expect(screen.getByText('Test skills error')).toBeDefined();
  });

  it('calls onOpenTodos when ToDos button clicked', () => {
    const onOpenTodos = vi.fn();
    render(<RpiPanelTabs {...emptyProps} onOpenTodos={onOpenTodos} />);
    const todosBtn = document.querySelector('button[title="ToDos — Kanban board"]');
    expect(todosBtn).not.toBeNull();
    fireEvent.click(todosBtn!);
    expect(onOpenTodos).toHaveBeenCalledOnce();
  });

  it('calls onRefreshPlans when plans refresh clicked', () => {
    const onRefreshPlans = vi.fn();
    render(<RpiPanelTabs {...emptyProps} onRefreshPlans={onRefreshPlans} />);
    const refreshBtn = document.querySelector('button[title="Refresh /Plans tree"]');
    expect(refreshBtn).not.toBeNull();
    fireEvent.click(refreshBtn!);
    expect(onRefreshPlans).toHaveBeenCalledOnce();
  });

  it('calls onRefreshSkills when skills refresh clicked', () => {
    const onRefreshSkills = vi.fn();
    render(<RpiPanelTabs {...emptyProps} onRefreshSkills={onRefreshSkills} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    const refreshBtn = document.querySelector('button[title="Refresh /Skills tree"]');
    expect(refreshBtn).not.toBeNull();
    fireEvent.click(refreshBtn!);
    expect(onRefreshSkills).toHaveBeenCalledOnce();
  });

  it('ToDos button is visible in both tabs', () => {
    render(<RpiPanelTabs {...emptyProps} />);
    let todosBtn = document.querySelector('button[title="ToDos — Kanban board"]');
    expect(todosBtn).not.toBeNull();

    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    todosBtn = document.querySelector('button[title="ToDos — Kanban board"]');
    expect(todosBtn).not.toBeNull();
  });

  it('shows RPI_PATH_NOT_FOUND for empty skills tree', () => {
    render(<RpiPanelTabs {...emptyProps} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    expect(screen.getByText('RPI_PATH_NOT_FOUND')).toBeDefined();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { PlansPanelTabs } from '../sidebar/PlansPanelTabs';

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
  promptsTree: [],
  promptsLoading: false,
  promptsError: null,
  onRefreshPrompts: vi.fn(),
  templatesTree: [],
  templatesLoading: false,
  templatesError: null,
  onRefreshTemplates: vi.fn(),
  onCreatePrompt: vi.fn(),
  onCreateTemplate: vi.fn(),
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

describe('PlansPanelTabs', () => {
  it('renders both tab buttons', () => {
    render(<PlansPanelTabs {...emptyProps} />);
    const { plans, skills } = getTabButtons();
    expect(plans).not.toBeNull();
    expect(skills).not.toBeNull();
    expect(plans!.textContent).toContain('/Plans');
    expect(skills!.textContent).toContain('/Skills');
  });

  it('defaults to plans tab showing empty state', () => {
    render(<PlansPanelTabs {...emptyProps} />);
    expect(screen.getByText('NO_FILES')).toBeDefined();
  });

  it('switches to skills tab on click', () => {
    render(<PlansPanelTabs {...emptyProps} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    expect(skills!.className).toContain('text-[#d4784a]');
  });

  it('switches back to plans tab', () => {
    render(<PlansPanelTabs {...emptyProps} />);
    const { plans, skills } = getTabButtons();
    fireEvent.click(skills!);
    fireEvent.click(plans!);
    expect(plans!.className).toContain('text-[#d4784a]');
  });

  it('shows loading spinner for plans when loading', () => {
    render(<PlansPanelTabs {...emptyProps} plansLoading={true} />);
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('shows loading spinner for skills when loading and skills tab active', () => {
    render(<PlansPanelTabs {...emptyProps} skillsLoading={true} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('shows error message for plans', () => {
    render(<PlansPanelTabs {...emptyProps} plansError="Test plans error" />);
    expect(screen.getByText('Test plans error')).toBeDefined();
  });

  it('shows error message for skills when skills tab active', () => {
    render(<PlansPanelTabs {...emptyProps} skillsError="Test skills error" />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    expect(screen.getByText('Test skills error')).toBeDefined();
  });

  it('calls onRefreshPlans when plans refresh clicked', () => {
    const onRefreshPlans = vi.fn();
    render(<PlansPanelTabs {...emptyProps} onRefreshPlans={onRefreshPlans} />);
    const refreshBtn = document.querySelector('button[title="Refresh /Plans tree"]');
    expect(refreshBtn).not.toBeNull();
    fireEvent.click(refreshBtn!);
    expect(onRefreshPlans).toHaveBeenCalledOnce();
  });

  it('calls onRefreshSkills when skills refresh clicked', () => {
    const onRefreshSkills = vi.fn();
    render(<PlansPanelTabs {...emptyProps} onRefreshSkills={onRefreshSkills} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    const refreshBtn = document.querySelector('button[title="Refresh /Skills tree"]');
    expect(refreshBtn).not.toBeNull();
    fireEvent.click(refreshBtn!);
    expect(onRefreshSkills).toHaveBeenCalledOnce();
  });

  it('shows RPI path empty state for empty skills tree', () => {
    render(<PlansPanelTabs {...emptyProps} />);
    const { skills } = getTabButtons();
    fireEvent.click(skills!);
    expect(screen.getByText('NO_FILES')).toBeDefined();
  });

  it('creates a prompt via the new-MD input on the prompts tab', () => {
    const onCreatePrompt = vi.fn();
    render(<PlansPanelTabs {...emptyProps} onCreatePrompt={onCreatePrompt} />);
    const tabBar = document.querySelector('.flex.items-center.gap-0.px-2.py-1');
    const promptsTab = tabBar!.querySelector('button:nth-child(3)') as HTMLButtonElement;
    expect(promptsTab.textContent).toContain('/Prompt');
    fireEvent.click(promptsTab);

    const newBtn = document.querySelector('button[title="Create md"]');
    expect(newBtn).not.toBeNull();
    fireEvent.click(newBtn!);

    const input = document.querySelector('input[placeholder="name.md"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'idea' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreatePrompt).toHaveBeenCalledWith('idea');
  });
});



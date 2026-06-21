import { describe, it, expect } from 'vitest';
import { parseCopilotEvents } from '../tasks';

function jsonl(events: unknown[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n');
}

describe('parseCopilotEvents', () => {
  it('keeps background agents running after task tool dispatch completes', () => {
    const raw = jsonl([
      {
        type: 'tool.execution_start',
        timestamp: '1',
        data: {
          toolCallId: 'bg',
          toolName: 'task',
          arguments: { description: 'Researching', name: 'research-agent', agent_type: 'research', mode: 'background' },
        },
      },
      { type: 'tool.execution_complete', timestamp: '2', data: { toolCallId: 'bg', success: true, result: { agent_id: 'bg' } } },
    ]);

    expect(parseCopilotEvents(raw)[0].status).toBe('in_progress');
  });

  it('marks background agents done only on subagent.completed', () => {
    const raw = jsonl([
      {
        type: 'tool.execution_start',
        timestamp: '1',
        data: {
          toolCallId: 'bg',
          toolName: 'task',
          arguments: { description: 'Researching', name: 'research-agent', mode: 'background' },
        },
      },
      { type: 'tool.execution_complete', timestamp: '2', data: { toolCallId: 'bg', success: true, result: { agent_id: 'bg' } } },
      { type: 'subagent.completed', timestamp: '3', data: { toolCallId: 'bg', agentName: 'research', model: 'claude-sonnet-4.6' } },
    ]);

    const task = parseCopilotEvents(raw)[0];
    expect(task.status).toBe('done');
    expect(task.agentType).toBe('research');
    expect(task.model).toBe('claude-sonnet-4.6');
  });

  it('marks sync task tool completion done', () => {
    const raw = jsonl([
      {
        type: 'tool.execution_start',
        timestamp: '1',
        data: { toolCallId: 'sync', toolName: 'task', arguments: { description: 'Reviewing', mode: 'sync' } },
      },
      { type: 'tool.execution_complete', timestamp: '2', data: { toolCallId: 'sync', success: true } },
    ]);

    expect(parseCopilotEvents(raw)[0].status).toBe('done');
  });

  it('marks failed dispatches and failed subagents blocked', () => {
    const raw = jsonl([
      {
        type: 'tool.execution_start',
        timestamp: '1',
        data: { toolCallId: 'bad-dispatch', toolName: 'task', arguments: { description: 'Bad dispatch', mode: 'sync' } },
      },
      {
        type: 'tool.execution_complete',
        timestamp: '2',
        data: { toolCallId: 'bad-dispatch', success: false, error: { message: '"description": Required' } },
      },
      {
        type: 'tool.execution_start',
        timestamp: '3',
        data: {
          toolCallId: 'bad-agent',
          toolName: 'task',
          arguments: { description: 'Bad agent', mode: 'background' },
        },
      },
      { type: 'subagent.failed', timestamp: '4', data: { toolCallId: 'bad-agent', error: { message: 'AbortError' } } },
    ]);

    expect(parseCopilotEvents(raw).map((task) => task.status)).toEqual(['blocked', 'blocked']);
  });
});

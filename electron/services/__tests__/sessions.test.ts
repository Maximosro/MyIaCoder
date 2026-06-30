import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '' } }));

import { parseCopilotTranscript, parseClaudeTranscript, parseReasonixTranscript, toWslUnc } from '../sessions';

function jsonl(items: unknown[]): string {
  return items.map((e) => JSON.stringify(e)).join('\n');
}

describe('parseCopilotTranscript', () => {
  it('keeps user/assistant text in order and drops thinking + tool-only turns', () => {
    const raw = jsonl([
      { type: 'session.start', data: {} },
      { type: 'user.message', data: { content: 'hola', transformedContent: 'hola<reminder>' } },
      { type: 'assistant.message', data: { content: 'respondo', reasoningOpaque: 'SECRET-THINKING' } },
      { type: 'assistant.message', data: { content: '', toolRequests: [{ name: 'view' }] } },
    ]);
    expect(parseCopilotTranscript(raw)).toEqual([
      { role: 'user', text: 'hola' },
      { role: 'assistant', text: 'respondo' },
    ]);
  });
});

describe('parseClaudeTranscript', () => {
  it('keeps only text blocks, skips thinking/tool_use/tool_result', () => {
    const raw = jsonl([
      { type: 'user', message: { role: 'user', content: 'arregla el bug' } },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'no mostrar' },
            { type: 'text', text: 'vale' },
            { type: 'tool_use', name: 'Edit', input: {} },
          ],
        },
      },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x' }] } },
    ]);
    expect(parseClaudeTranscript(raw)).toEqual([
      { role: 'user', text: 'arregla el bug' },
      { role: 'assistant', text: 'vale' },
    ]);
  });
});

describe('toWslUnc', () => {
  it('maps a POSIX home under a distro to the \\\\wsl.localhost UNC path', () => {
    expect(toWslUnc('Ubuntu', '/home/sergioroy')).toBe('\\\\wsl.localhost\\Ubuntu\\home\\sergioroy');
  });
});

describe('parseReasonixTranscript', () => {
  it('keeps user/assistant strings, skips tool and system', () => {
    const raw = jsonl([
      { role: 'system', content: 'prompt' },
      { role: 'user', content: 'pregunta' },
      { role: 'assistant', content: 'respuesta', tool_calls: [{ id: 't1', name: 'explore' }] },
      { role: 'tool', tool_call_id: 't1', content: 'resultado' },
    ]);
    expect(parseReasonixTranscript(raw)).toEqual([
      { role: 'user', text: 'pregunta' },
      { role: 'assistant', text: 'respuesta' },
    ]);
  });
});

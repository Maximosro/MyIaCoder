import { describe, it, expect } from 'vitest';
import { parseReasonixEvents } from '../tasks';

// A real `<name>.events.jsonl` sidecar captured from reasonix 0.53.2: one plain
// tool call (`ls`, which errored) and one subagent dispatch (`explore`).
const SIDECAR = [
  '{"id":1,"ts":"2026-06-21T09:31:16.902Z","turn":0,"type":"session.opened","name":"default","resumedFromTurn":0}',
  '{"id":2,"ts":"2026-06-21T09:31:30.016Z","turn":1,"type":"model.turn.started","model":"deepseek-v4-flash"}',
  '{"id":3,"ts":"2026-06-21T09:31:30.016Z","turn":1,"type":"tool.preparing","callId":"tc-1","name":"explore"}',
  '{"id":5,"ts":"2026-06-21T09:31:30.071Z","turn":1,"type":"tool.intent","callId":"tc-1","name":"explore","args":"{\\"task\\":\\"survey the repo files\\"}"}',
  '{"id":6,"ts":"2026-06-21T09:31:30.071Z","turn":1,"type":"tool.dispatched","callId":"tc-1"}',
  '{"id":7,"ts":"2026-06-21T09:31:30.083Z","turn":1,"type":"tool.result","callId":"tc-1","ok":true,"output":"done","durationMs":12}',
  '{"id":8,"ts":"2026-06-21T09:31:31.000Z","turn":2,"type":"tool.intent","callId":"tc-2","name":"ls","args":"{\\"path\\":\\".\\"}"}',
  '{"id":9,"ts":"2026-06-21T09:31:31.100Z","turn":2,"type":"tool.result","callId":"tc-2","ok":false,"output":"{\\"error\\":\\"unknown tool: ls\\"}","durationMs":0}',
].join('\n');

describe('parseReasonixEvents', () => {
  it('extracts a subagent and a plain tool with correct status/kind', () => {
    const tasks = parseReasonixEvents(SIDECAR);
    expect(tasks).toHaveLength(2);

    const explore = tasks[0];
    expect(explore.kind).toBe('subagent');
    expect(explore.agentType).toBe('explore');
    expect(explore.status).toBe('done');
    expect(explore.title).toBe('explore: survey the repo files');

    const ls = tasks[1];
    expect(ls.kind).toBe('todo');
    expect(ls.agentType).toBeUndefined();
    expect(ls.status).toBe('blocked'); // ok:false
    expect(ls.title).toBe('ls .');
  });

  it('leaves a tool with no result in_progress', () => {
    const tasks = parseReasonixEvents(
      '{"type":"tool.intent","callId":"x","name":"grep","args":"{\\"pattern\\":\\"foo\\"}","ts":"t"}',
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('in_progress');
    expect(tasks[0].title).toBe('grep foo');
  });
});

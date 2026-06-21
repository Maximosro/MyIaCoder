import { describe, it, expect } from 'vitest';
import { parseReasonixEvents } from '../tasks';

// A real Reasonix ≥ 1.8.0 session transcript JSONL: one subagent dispatch
// (`explore`), one plain tool call (`read_file`), and one unknown tool
// (`ls`).  Only subagent dispatches (explore, research, review,
// securityReview, task) are shown in the panel — regular tools like
// read_file, bash, glob, etc. are implementation details of the main agent
// and are skipped.
const TRANSCRIPT = [
  '{"role":"system","content":"You are Reasonix, a coding agent."}',
  '{"role":"user","content":"survey the repo files"}',
  '{"role":"assistant","reasoning_content":"Let me explore the repo first, then read a file.","tool_calls":[{"id":"call_00_explore","name":"explore","arguments":"{\\"task\\":\\"survey the repo files\\"}"},{"id":"call_01_read","name":"read_file","arguments":"{\\"path\\":\\"README.md\\"}"}]}',
  '{"role":"tool","content":"Subagent reference: sa_20260621_123654. The repo contains...","tool_call_id":"call_00_explore","name":"explore"}',
  '{"role":"tool","content":"# My Project\\nA coding workspace","tool_call_id":"call_01_read","name":"read_file"}',
  '{"role":"user","content":"list files"}',
  '{"role":"assistant","reasoning_content":"Simple ls.","tool_calls":[{"id":"call_02_ls","name":"ls","arguments":"{\\"path\\":\\".\\"}"}]}',
  '{"role":"tool","content":"{\\"error\\":\\"unknown tool: ls\\"}","tool_call_id":"call_02_ls","name":"ls"}',
].join('\n');

describe('parseReasonixEvents (v1.8.0 session transcript)', () => {
  it('extracts only subagent dispatches, skips plain tools', () => {
    const tasks = parseReasonixEvents(TRANSCRIPT);
    // Only the `explore` subagent should appear; read_file and ls are skipped.
    expect(tasks).toHaveLength(1);

    const explore = tasks[0];
    expect(explore.id).toBe('call_00_explore');
    expect(explore.kind).toBe('subagent');
    expect(explore.agentType).toBe('explore');
    // Subagent stays in_progress — caller merges status from subagents/*.meta.json
    expect(explore.status).toBe('in_progress');
    expect(explore.title).toBe('explore: survey the repo files');
  });

  it('skips non-subagent tools even with no result', () => {
    // grep is not in REASONIX_SUBAGENT_TOOLS → skipped
    const tasks = parseReasonixEvents(
      '{"role":"assistant","tool_calls":[{"id":"x","name":"grep","arguments":"{\\"pattern\\":\\"foo\\"}"}]}',
    );
    expect(tasks).toHaveLength(0);
  });

  it('includes research and review as subagent tools', () => {
    const tasks = parseReasonixEvents(
      [
        '{"role":"assistant","tool_calls":[{"id":"r1","name":"research","arguments":"{\\"task\\":\\"find best lib\\"}"}]}',
        '{"role":"assistant","tool_calls":[{"id":"r2","name":"review","arguments":"{\\"task\\":\\"review diff\\"}"}]}',
      ].join('\n'),
    );
    expect(tasks).toHaveLength(2);
    expect(tasks[0].kind).toBe('subagent');
    expect(tasks[0].agentType).toBe('research');
    expect(tasks[1].kind).toBe('subagent');
    expect(tasks[1].agentType).toBe('review');
  });

  it('skips lines that have no tool_calls', () => {
    const tasks = parseReasonixEvents(
      [
        '{"role":"system","content":"system msg"}',
        '{"role":"user","content":"hello"}',
        '{"role":"assistant","content":"no tool calls here"}',
      ].join('\n'),
    );
    expect(tasks).toHaveLength(0);
  });
});

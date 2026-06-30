// Renderer-side copy of the task types produced by electron/services/tasks.ts.
// Duplicated here (like Project in src/types/project.ts) so renderer code does
// not import from the main-process service. Keep in sync with tasks.ts.

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
export type TaskSource = 'copilot' | 'claude' | 'reasonix';
export type TaskKind = 'todo' | 'subagent';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  kind: TaskKind;
  agentType?: string;
  mode?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  dependsOn: string[];
}

export interface TaskSession {
  sessionId: string;
  name: string;
  updatedAt: string;
  live: boolean;
  tasks: Task[];
}

export interface ProjectTasksResult {
  source: TaskSource;
  sessions: TaskSession[];
  error?: string;
}


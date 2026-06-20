import { useState, useMemo } from 'react';
import {
  ChevronRight,
  RefreshCw,
  CircleDashed,
  Circle,
  CheckCircle2,
  Ban,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useTasks } from '../hooks/useTasks';
import type { TaskStatus, TaskSession, TaskSource } from '../types/task';

interface TasksTreeProps {
  projectPath: string;
  refreshKey: number;
}

const STATUS_META: Record<TaskStatus, { color: string; Icon: typeof Circle }> = {
  in_progress: { color: '#d4a44a', Icon: CircleDashed },
  pending: { color: '#8b5a3c', Icon: Circle },
  blocked: { color: '#e05555', Icon: Ban },
  done: { color: '#6ba86b', Icon: CheckCircle2 },
};

/** One CLI session with its task list, collapsible. */
function SessionNode({ session, label, defaultOpen }: { session: TaskSession; label: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const done = session.tasks.filter((t) => t.status === 'done').length;
  const running = session.live && session.tasks.some((t) => t.status === 'in_progress');

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 py-[3px] px-3 text-left font-mono transition-colors duration-150 border-l-2 border-transparent hover:bg-[#0f0f0f] hover:border-[#8b5a3c]/30"
      >
        <ChevronRight
          className={`w-3 h-3 text-[#8b5a3c] transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-90' : 'rotate-0'}`}
        />
        {running && <CircleDashed className="w-3 h-3 text-[#d4a44a] flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />}
        <span className={`text-[11px] truncate ${session.live ? 'text-[#e8e2dc]' : 'text-[#8b5a3c]'}`}>{label}</span>
        {session.live && (
          <span className="flex items-center gap-1 text-[8px] font-mono text-[#6ba86b] flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6ba86b] animate-pulse" />
            LIVE
          </span>
        )}
        <span className="text-[10px] text-[#6ba86b] ml-auto flex-shrink-0">{done}/{session.tasks.length}</span>
      </button>

      {open && (
        <div>
          {session.tasks.map((task) => {
            const meta = STATUS_META[task.status];
            const { Icon } = meta;
            const spinning = task.status === 'in_progress';
            return (
              <div
                key={task.id}
                className="flex items-start gap-1.5 py-[3px] pr-3 font-mono"
                style={{ paddingLeft: '34px' }}
                title={task.description || task.title}
              >
                <Icon
                  className={`w-3 h-3 flex-shrink-0 mt-[2px] ${spinning ? 'animate-spin' : ''}`}
                  style={{ color: meta.color, ...(spinning ? { animationDuration: '3s' } : {}) }}
                />
                <span
                  className={`text-[11px] leading-snug break-words ${
                    task.status === 'done' ? 'text-[#8b5a3c] line-through' : 'text-[#b0a89a]'
                  }`}
                >
                  {task.title}
                  {task.kind === 'subagent' && task.agentType && (
                    <span className="ml-1.5 text-[9px] text-[#7b9ec4]/70 bg-[#0a1520] border border-[#7b9ec4]/20 rounded px-1 py-px align-middle">
                      {task.agentType}
                    </span>
                  )}
                  {task.kind === 'subagent' && task.model && (
                    <span className="ml-1 text-[9px] text-[#d4784a]/70 bg-[#1a0f0a] border border-[#d4784a]/20 rounded px-1 py-px align-middle">
                      {task.model}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Compact tasks list for the sidebar — CLI tasks for the selected project,
 * grouped by session, refreshing live as the terminal runs.
 * Copilot is wired; Claude is a prepared "coming soon" source.
 */
export function TasksTree({ projectPath, refreshKey }: TasksTreeProps) {
  const [source, setSource] = useState<TaskSource>('copilot');
  const { sessions, loading, error } = useTasks(projectPath, source, refreshKey);

  const total = useMemo(() => sessions.reduce((n, s) => n + s.tasks.length, 0), [sessions]);

  const sourceToggle = (
    <div className="flex items-center gap-1 px-3 py-1.5">
      <button
        onClick={() => setSource('copilot')}
        className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono tracking-wider rounded transition-colors ${
          source === 'copilot' ? 'bg-[#0f1a18] text-[#6ba86b] border border-[#6ba86b]/30' : 'text-[#8b5a3c] hover:text-[#b0a89a] border border-transparent'
        }`}
      >
        <Sparkles className="w-2.5 h-2.5" />
        COPILOT
      </button>
      <button
        onClick={() => setSource('claude')}
        className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono tracking-wider rounded transition-colors ${
          source === 'claude' ? 'bg-[#1a0f0a] text-[#d4784a] border border-[#d4784a]/30' : 'text-[#8b5a3c] hover:text-[#b0a89a] border border-transparent'
        }`}
      >
        <Terminal className="w-2.5 h-2.5" />
        CLAUDE
      </button>
    </div>
  );

  let body: React.ReactNode;
  if (loading && sessions.length === 0) {
    body = (
      <div className="flex items-center gap-2 py-1.5 px-3">
        <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
        <span className="text-[10px] font-mono text-[#8b5a3c]">reading tasks...</span>
      </div>
    );
  } else if (error) {
    body = (
      <div className="py-1 px-3">
        <span className="text-[10px] font-mono text-[#e05555]">{error}</span>
      </div>
    );
  } else if (total === 0) {
    body = (
      <div className="py-2 px-3">
        <span className="text-[10px] font-mono text-[#8b5a3c] tracking-wider">No active {source} session</span>
      </div>
    );
  } else {
    // Suffix a serial number only when several live sessions share a name, so
    // two terminals with the same tab title stay distinguishable. The serial is
    // keyed off the (stable) sessionId so it doesn't reshuffle on refresh.
    const groups = new Map<string, string[]>();
    for (const s of sessions) {
      const ids = groups.get(s.name) ?? [];
      ids.push(s.sessionId);
      groups.set(s.name, ids);
    }
    for (const ids of groups.values()) ids.sort();
    body = sessions.map((session) => {
      const ids = groups.get(session.name) ?? [];
      const label = ids.length > 1 ? `${session.name} #${ids.indexOf(session.sessionId) + 1}` : session.name;
      return <SessionNode key={session.sessionId} session={session} label={label} defaultOpen />;
    });
  }

  return (
    <div className="py-1">
      {sourceToggle}
      {body}
    </div>
  );
}

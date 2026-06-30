import { RefreshCw, Sparkles, Terminal, Cpu, MessageSquare } from 'lucide-react';
import { useSessions } from '../hooks/useSessions';
import type { SessionEntry, SessionSource } from '../types/session';

interface SessionsPanelProps {
  projectPath: string;
  refreshKey: number;
  /** Opens the session's transcript as a tab in the body. */
  onOpenSession: (session: SessionEntry) => void;
}

const SOURCE_META: Record<SessionSource, { color: string; Icon: typeof Sparkles }> = {
  copilot: { color: '#6ba86b', Icon: Sparkles },
  claude: { color: '#d4784a', Icon: Terminal },
  reasonix: { color: '#a98bd4', Icon: Cpu },
};

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Sessions list for the sidebar — every CLI session on disk for the selected
 * project (Copilot, Claude, Reasonix), newest first. Clicking one opens its
 * clean transcript as a colored tab in the body.
 */
export function SessionsPanel({ projectPath, refreshKey, onOpenSession }: SessionsPanelProps) {
  const { sessions, loading, error, refresh } = useSessions(projectPath, refreshKey);

  let body: React.ReactNode;
  if (loading && sessions.length === 0) {
    body = (
      <div className="flex items-center gap-2 py-1.5 px-3">
        <RefreshCw className="w-3 h-3 text-[#d4784a] animate-spin" />
        <span className="text-[10px] font-mono text-[#8b5a3c]">reading sessions...</span>
      </div>
    );
  } else if (error) {
    body = <div className="py-1 px-3"><span className="text-[10px] font-mono text-[#e05555]">{error}</span></div>;
  } else if (sessions.length === 0) {
    body = <div className="py-2 px-3"><span className="text-[10px] font-mono text-[#8b5a3c] tracking-wider">No sessions for this project</span></div>;
  } else {
    body = sessions.map((s) => {
      const meta = SOURCE_META[s.source];
      const { Icon } = meta;
      return (
        <button
          key={`${s.source}:${s.id}`}
          onClick={() => onOpenSession(s)}
          className="w-full flex items-center gap-1.5 py-[3px] px-3 text-left font-mono transition-colors duration-150 border-l-2 border-transparent hover:bg-[#0f0f0f] hover:border-[#8b5a3c]/30"
        >
          <Icon className="w-3 h-3 flex-shrink-0" style={{ color: meta.color }} />
          <span className="text-[11px] truncate text-[#e8e2dc]">{s.title}</span>
          <span className="text-[9px] text-[#6b5a4c] ml-auto flex-shrink-0">{formatDate(s.updatedAt)}</span>
          <MessageSquare className="w-2.5 h-2.5 text-[#8b5a3c] flex-shrink-0" />
        </button>
      );
    });
  }

  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[9px] font-mono tracking-widest text-[#8b5a3c]">SESSIONS ({sessions.length})</span>
        <button onClick={refresh} title="Refresh" className="text-[#8b5a3c] hover:text-[#d4784a] transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      {body}
    </div>
  );
}

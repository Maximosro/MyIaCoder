import { RefreshCw } from 'lucide-react';
import { useTranscript } from '../../hooks/useSessions';
import type { SessionSource } from '../../types/session';
import { getCommandColor } from '../../utils/tabUtils';

interface TranscriptViewerProps {
  source: SessionSource;
  sessionId: string;
  projectPath: string;
}

const SOURCE_LABEL: Record<SessionSource, string> = {
  copilot: 'COPILOT',
  claude: 'CLAUDE',
  reasonix: 'REASONIX',
};

/** Full-panel reader for one session's transcript — clean user/assistant turns,
 *  no thinking, no tools. Rendered in the body as a `session` tab. */
export function TranscriptViewer({ source, sessionId, projectPath }: TranscriptViewerProps) {
  const { messages, loading, error } = useTranscript(source, sessionId, projectPath);
  const accent = getCommandColor(source);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#050505] px-6 py-5">
      {loading && (
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#d4784a] animate-spin" />
          <span className="text-xs font-mono text-[#8b5a3c]">reading transcript...</span>
        </div>
      )}
      {error && !loading && (
        <span className="text-xs font-mono text-[#e05555]">{error}</span>
      )}
      {!loading && !error && messages.length === 0 && (
        <span className="text-xs font-mono text-[#8b5a3c]">Empty transcript</span>
      )}

      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i}>
            <div
              className="text-[10px] font-mono tracking-widest mb-1"
              style={{ color: m.role === 'user' ? '#d4a44a' : accent }}
            >
              {m.role === 'user' ? 'YOU' : SOURCE_LABEL[source]}
            </div>
            <div
              className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words font-mono rounded-md px-3 py-2 ${
                m.role === 'user'
                  ? 'text-[#f0ece8] bg-[#0f0f0f] border border-[#1f1a15]'
                  : 'text-[#c8c0b6] bg-transparent'
              }`}
              style={m.role === 'assistant' ? { borderLeft: `2px solid ${accent}` } : undefined}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

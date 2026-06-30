import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionEntry, SessionSource, TranscriptMessage } from '../types/session';

interface UseSessionsReturn {
  sessions: SessionEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Lists CLI sessions on disk for a project (newest first). Refetches on
 *  refreshKey change. Empty when projectPath is null. */
export function useSessions(projectPath: string | null, refreshKey?: number): UseSessionsReturn {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!projectPath) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }
    const currentId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listProjectSessions(projectPath);
      if (currentId !== requestIdRef.current) return;
      if (result.error) {
        setError(result.error);
        setSessions([]);
      } else {
        setSessions(result.sessions);
      }
    } catch (err) {
      if (currentId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to list sessions');
      setSessions([]);
    } finally {
      if (currentId === requestIdRef.current) setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { refresh(); }, [refresh, refreshKey]);

  return { sessions, loading, error, refresh };
}

interface UseTranscriptReturn {
  messages: TranscriptMessage[];
  loading: boolean;
  error: string | null;
}

/** Reads one session's clean transcript on demand. No-op until a session is
 *  selected (source + id non-null). */
export function useTranscript(
  source: SessionSource | null,
  sessionId: string | null,
  projectPath: string | null,
): UseTranscriptReturn {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!source || !sessionId || !projectPath) {
      setMessages([]);
      setError(null);
      return;
    }
    const currentId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    window.electronAPI
      .getSessionTranscript(source, sessionId, projectPath)
      .then((result) => {
        if (currentId !== requestIdRef.current) return;
        if (result.error) {
          setError(result.error);
          setMessages([]);
        } else {
          setMessages(result.messages);
        }
      })
      .catch((err) => {
        if (currentId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to read transcript');
        setMessages([]);
      })
      .finally(() => {
        if (currentId === requestIdRef.current) setLoading(false);
      });
  }, [source, sessionId, projectPath]);

  return { messages, loading, error };
}

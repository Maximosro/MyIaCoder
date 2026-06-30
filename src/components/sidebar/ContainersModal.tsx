import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Container, RefreshCw, Square } from 'lucide-react';
import type { DockerContainer } from '../../../electron/services/docker';

interface ContainersModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContainersModal({ open, onClose }: ContainersModalProps) {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<Set<string>>(new Set());
  const backdropRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.dockerListContainers();
      if (res.ok) {
        setContainers(res.containers);
      } else {
        setError(res.output || 'docker ps failed');
        setContainers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'docker ps failed');
      setContainers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleStop = useCallback(async (id: string) => {
    if (!id || stopping.has(id)) return;
    setStopping((s) => new Set(s).add(id));
    setError(null);
    try {
      const res = await window.electronAPI.dockerStopContainer(id);
      if (!res.ok) setError(res.output || 'docker stop failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'docker stop failed');
    } finally {
      setStopping((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }, [stopping, load]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  const container = document.getElementById('root') || document.body;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-[680px] max-h-[80vh] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#6ba86b]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15]">
          <div className="flex items-center gap-2.5">
            <Container className="w-4 h-4 text-[#6ba86b]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              RUNNING CONTAINERS
            </h2>
            <span className="text-[10px] font-mono text-[#6ba86b]">{containers.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={load}
              disabled={loading}
              className="p-1 rounded hover:bg-[#1f1a15] transition-colors duration-150 text-[#8b5a3c] hover:text-[#6ba86b] disabled:opacity-40"
              title="Refrescar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[#1f1a15] transition-colors duration-150"
            >
              <X className="w-4 h-4 text-[#8b5a3c]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-auto">
          {loading && containers.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-4 h-4 text-[#6ba86b] animate-spin" />
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded bg-[#e05555]/10 border border-[#e05555]/30">
              <pre className="text-[10px] font-mono text-[#e05555] whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {!loading && !error && containers.length === 0 && (
            <p className="text-center text-[11px] font-mono text-[#8b5a3c] tracking-wider py-8">
              NO_RUNNING_CONTAINERS
            </p>
          )}

          {containers.length > 0 && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-mono text-[#8b5a3c] tracking-widest uppercase">
                  <th className="py-1.5 pr-3 font-medium">Name</th>
                  <th className="py-1.5 pr-3 font-medium">Image</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">Ports</th>
                  <th className="py-1.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id || c.names} className="border-t border-[#1f1a15]/50 align-top">
                    <td className="py-1.5 pr-3 text-[11px] font-mono text-[#f0ece8] whitespace-nowrap">{c.names}</td>
                    <td className="py-1.5 pr-3 text-[11px] font-mono text-[#b0a89a] whitespace-nowrap">{c.image}</td>
                    <td className="py-1.5 pr-3 text-[11px] font-mono text-[#6ba86b] whitespace-nowrap">{c.status}</td>
                    <td className="py-1.5 pr-3 text-[11px] font-mono text-[#7b9ec4] break-all">{c.ports || '—'}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleStop(c.id)}
                        disabled={stopping.has(c.id)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono tracking-wider text-[#e05555] border border-[#e05555]/30 rounded hover:bg-[#e05555]/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Parar contenedor"
                      >
                        {stopping.has(c.id)
                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                          : <Square className="w-3 h-3" />}
                        Parar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    container,
  );
}

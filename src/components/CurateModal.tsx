import { DiffEditor, loader } from '@monaco-editor/react';
import { Sparkles, X } from 'lucide-react';
import * as monaco from 'monaco-editor';

loader.config({ monaco });

interface CurateModalProps {
  open: boolean;
  original: string;
  curated: string;
  loading: boolean;
  error: string | null;
  onApply: () => void;
  onClose: () => void;
}

/**
 * Shows the AI-curated dictation (Flujo 2) as a side-by-side diff against the
 * original, and lets the user apply or cancel. Nothing is changed until Apply.
 */
export function CurateModal({ open, original, curated, loading, error, onApply, onClose }: CurateModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-[80vw] h-[80vh] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#d4784a]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              CURADOR · revisión
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#141414] text-[#8b5a3c] hover:text-[#d4784a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs font-mono text-[#8b5a3c] animate-pulse">CURANDO_</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full px-8">
              <span className="text-xs font-mono text-[#e05555] text-center">{error}</span>
            </div>
          ) : (
            <DiffEditor
              height="100%"
              language="markdown"
              theme="copper-dark"
              original={original}
              modified={curated}
              options={{
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#1f1a15]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#e05555] border border-[#1f1a15] transition-all font-mono"
          >
            CANCELAR
          </button>
          <button
            onClick={onApply}
            disabled={loading || !!error || !curated}
            className="px-4 py-2 text-xs rounded bg-[#d4784a]/10 hover:bg-[#d4784a]/20 text-[#d4784a] border border-[#d4784a]/30 hover:border-[#d4784a]/50 transition-all font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            APLICAR
          </button>
        </div>
      </div>
    </div>
  );
}

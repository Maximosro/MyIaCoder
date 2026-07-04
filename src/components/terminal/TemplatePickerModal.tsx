import { FileText, Sparkles, X } from 'lucide-react';
import type { PromptTemplate } from '../../../electron/preload';

interface TemplatePickerModalProps {
  open: boolean;
  templates: PromptTemplate[];
  loading: boolean;
  error: string | null;
  onSelect: (template: PromptTemplate) => void;
  onClose: () => void;
}

/**
 * Modal that lets the user pick a prompt template before running the AI curator.
 * Shown when there are 2+ templates available; for a single template the flow
 * skips this step automatically.
 */
export function TemplatePickerModal({
  open,
  templates,
  loading,
  error,
  onSelect,
  onClose,
}: TemplatePickerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-[480px] max-h-[70vh] bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl shadow-[#d4784a]/5 flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f1a15] shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#d4784a]" />
            <h2 className="text-sm font-mono font-semibold text-[#f0ece8] tracking-wider">
              SELECCIONAR PLANTILLA
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-xs font-mono text-[#8b5a3c] animate-pulse">
                CARGANDO PLANTILLAS...
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 px-6">
              <span className="text-xs font-mono text-[#e05555] text-center">{error}</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
              <FileText className="w-8 h-8 text-[#3a2a1a]" />
              <p className="text-xs font-mono text-[#8b5a3c] text-center leading-relaxed">
                No hay plantillas disponibles.
                <br />
                Añade archivos <code className="text-[#7b9ec4]">.md</code> en la carpeta de
                plantillas (Ajustes → Prompt Templates).
              </p>
            </div>
          ) : (
            <div className="py-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#c8c0b8] hover:bg-[#141414] hover:text-[#f0ece8] border-b border-[#1a1a1a] transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-[#8b5a3c] shrink-0" />
                  <span className="font-mono tracking-wide truncate">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[#1f1a15] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded bg-[#0f0f0f] hover:bg-[#141414] text-[#8b5a3c] hover:text-[#e05555] border border-[#1f1a15] transition-all font-mono"
          >
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
}
